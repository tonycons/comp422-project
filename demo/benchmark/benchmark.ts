// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-13,
//  at the request of tonycons. See ../../AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * Benchmark: CPU time vs. instance size, as the project spec asks.
 *
 *     npm run benchmark                         full run (a few minutes)
 *     npm run benchmark -- --quick              smaller sizes (well under a minute)
 *     npm run benchmark -- --only greedy        one algorithm (greedy or subset_dp)
 *
 * It runs in Node (not the browser) because Node can read CPU time and a browser
 * cannot. The algorithms are the SAME files the website uses (src/core/).
 * Output goes to benchmark/results/.
 *
 * For every algorithm and every size n in SIZES:
 *   - generate INSTANCES_PER_SIZE (>= 10) random maps with reproducible seeds,
 *   - measure the CPU time of solving each one (see cpuTimeOf),
 *   - write one row per map to  runtime_<algorithm>.csv.
 * It also writes
 *   - quality.csv : on every Subset DP map, Greedy's route vs. the optimal one,
 *   - summary.md  : averages per size and the least-squares fit of each Theta bound,
 *   - plot_*.svg  : the charts (see plot.ts).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateInstance } from "../src/core/generator";
import * as greedy from "../src/solutions/greedy";
import type { Problem, Solution } from "../src/core/problem";
import { fitGrowth, GROWTH, type Fit } from "../src/core/scaling";
import * as subsetDp from "../src/solutions/subsetDp";
import { writeChart, type ChartSeries } from "./plot";

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------
type Key = "greedy" | "subset_dp";

const INSTANCES_PER_SIZE = 10;   // the spec requires at least 10 random instances per size
const BASE_SEED = 422;           // map k of size n uses seed  BASE_SEED + 1000 * n + k  (reproducible)

const range = (from: number, to: number, step = 1): number[] =>
    Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, k) => from + k * step);

/** Sizes (n = number of food items) per algorithm. The exponential one gets small sizes. */
const SIZES: Record<Key, number[]> = {
    greedy: range(50, 1000, 50),             // 50 .. 1,000
    subset_dp: range(2, subsetDp.MAX_N),     // 2 .. 16  (n = 16 takes a few seconds per map)
};
const QUICK_SIZES: Record<Key, number[]> = {
    greedy: range(50, 500, 50),
    subset_dp: range(2, 12),
};

/**
 * A single small solve is shorter than the CPU clock can measure well, so each map
 * is re-solved until at least this much CPU time has passed; we record the average.
 */
const MIN_TIMED_SECONDS = 0.2;
const QUICK_MIN_TIMED_SECONDS = 0.05;

const ALGORITHMS: Record<Key, { name: string; complexity: string; solve: (p: Problem) => Solution }> = {
    greedy: { name: greedy.INFO.name, complexity: greedy.INFO.timeComplexity, solve: (p) => greedy.solve(p).solution },
    subset_dp: { name: subsetDp.INFO.name, complexity: subsetDp.INFO.timeComplexity, solve: (p) => subsetDp.solve(p).solution },
};
const COLORS: Record<Key, string> = { greedy: "#eb6834", subset_dp: "#2a78d6" };   // same as the website

// this file runs from benchmark/.build/, so ".." is benchmark/
const RESULTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "results");

// -----------------------------------------------------------------------------
// Timing one map
// -----------------------------------------------------------------------------
/**
 * CPU seconds this process has used so far (user + system time).
 * `npm run benchmark` starts Node with --single-threaded, so the compiler and the garbage
 * collector run on the main thread and no helper threads add CPU time on the side.
 */
function cpuSeconds(): number {
    const u = process.cpuUsage();
    return (u.user + u.system) / 1e6;
}

/** Run the garbage collector now (if Node was started with --expose-gc), so it is less likely to run mid-measurement. */
function collectGarbage(): void {
    (globalThis as { gc?: () => void }).gc?.();
}

/** CPU seconds for ONE run of solve(map): repeated until minSeconds of CPU time has passed, then averaged. */
function cpuTimeOf(solve: (p: Problem) => Solution, map: Problem, minSeconds: number): { seconds: number; repeats: number; solution: Solution } {
    collectGarbage();
    let repeats = 0;
    let elapsed = 0;
    let solution: Solution;
    const start = cpuSeconds();
    do {
        solution = solve(map);
        repeats++;
        elapsed = cpuSeconds() - start;
    } while (elapsed < minSeconds);
    return { seconds: elapsed / repeats, repeats, solution };
}

/**
 * Before timing a size, solve a throwaway map of that size (a seed no timed map uses).
 * Node compiles and re-optimizes code while it runs; the first solves at a new size can
 * be several times slower for that reason alone, and we do not want to time the compiler.
 */
function warmUp(solve: (p: Problem) => Solution, n: number, minSeconds: number): void {
    const map = generateInstance(n, BASE_SEED + 1000 * n + 999);
    const start = cpuSeconds();
    let runs = 0;
    do {
        solve(map);
        runs++;
    } while (runs < 2 || (cpuSeconds() - start < minSeconds / 2 && runs < 50));
}

// -----------------------------------------------------------------------------
// Running the benchmark
// -----------------------------------------------------------------------------
interface RuntimeRow {
    algorithm: Key;
    n: number;
    seed: number;
    cpuSeconds: number;
    repeats: number;
    score: number;
    spoiled: number;
}

interface QualityRow {
    n: number;
    seed: number;
    greedyScore: number;
    optimalScore: number;
    greedyLoss: number;
    optimalLoss: number;
    lossRatio: number;   // Greedy's calories lost / optimal calories lost (1 = Greedy was optimal)
}

function main(): void {
    const args = process.argv.slice(2);
    const quick = args.includes("--quick");
    const only = args.includes("--only") ? args.slice(args.indexOf("--only") + 1).filter((a) => !a.startsWith("--")) : [];
    const unknown = only.filter((k) => !(k in ALGORITHMS));
    if (unknown.length > 0) {
        throw new Error(`Unknown algorithm: ${unknown.join(", ")}. Choose from: ${Object.keys(ALGORITHMS).join(", ")}`);
    }
    const keys = (only.length > 0 ? only : Object.keys(ALGORITHMS)) as Key[];
    const sizes = quick ? QUICK_SIZES : SIZES;
    const minSeconds = quick ? QUICK_MIN_TIMED_SECONDS : MIN_TIMED_SECONDS;
    mkdirSync(RESULTS_DIR, { recursive: true });
    if (typeof (globalThis as { gc?: unknown }).gc !== "function") {
        console.log("(note: run with `node --expose-gc --single-threaded` for steadier timings; `npm run benchmark` does this)");
    }

    // Warm-up: let the JIT compiler optimize both algorithms before anything is timed.
    for (let k = 0; k < 30; k++) {
        greedy.solve(generateInstance(200, k));
        subsetDp.solve(generateInstance(9, k));
    }

    const runtime: Partial<Record<Key, RuntimeRow[]>> = {};
    const quality: QualityRow[] = [];
    for (const key of keys) {
        const algo = ALGORITHMS[key];
        const ns = sizes[key];
        console.log(`\n${algo.name}  ${algo.complexity}  - sizes ${ns[0]}..${ns[ns.length - 1]}, ${INSTANCES_PER_SIZE} maps each`);
        const rows: RuntimeRow[] = [];
        for (const n of ns) {
            warmUp(algo.solve, n, minSeconds);
            let total = 0;
            for (let k = 0; k < INSTANCES_PER_SIZE; k++) {
                const seed = BASE_SEED + 1000 * n + k;
                const map = generateInstance(n, seed);
                const { seconds, repeats, solution } = cpuTimeOf(algo.solve, map, minSeconds);
                total += seconds;
                rows.push({ algorithm: key, n, seed, cpuSeconds: seconds, repeats, score: solution.totalScore, spoiled: solution.spoiledCount });
                if (key === "subset_dp") {
                    // Same map, Greedy's route: how close to optimal is it?
                    const g = greedy.solve(map).solution;
                    quality.push({
                        n, seed,
                        greedyScore: g.totalScore, optimalScore: solution.totalScore,
                        greedyLoss: g.spoilageLoss, optimalLoss: solution.spoilageLoss,
                        lossRatio: solution.spoilageLoss > 0 ? g.spoilageLoss / solution.spoilageLoss : 1,
                    });
                }
                const bar = "#".repeat(k + 1) + ".".repeat(INSTANCES_PER_SIZE - k - 1);
                process.stdout.write(`\r  n=${String(n).padEnd(5)} [${bar}] avg ${formatTime(total / (k + 1)).padStart(10)}`);
            }
            process.stdout.write("\n");
        }
        runtime[key] = rows;
        const path = join(RESULTS_DIR, `runtime_${key}.csv`);
        writeCsv(path, ["algorithm", "n", "seed", "cpu_seconds", "repeats", "score", "spoiled"],
            rows.map((r) => [r.algorithm, r.n, r.seed, r.cpuSeconds.toFixed(9), r.repeats, r.score.toFixed(3), r.spoiled]));
        console.log(`  -> wrote ${path}`);
    }

    if (quality.length > 0) {
        const path = join(RESULTS_DIR, "quality.csv");
        writeCsv(path, ["n", "seed", "greedy_score", "optimal_score", "greedy_spoilage_loss", "optimal_spoilage_loss", "loss_ratio"],
            quality.map((q) => [q.n, q.seed, q.greedyScore.toFixed(3), q.optimalScore.toFixed(3), q.greedyLoss.toFixed(3), q.optimalLoss.toFixed(3), q.lossRatio.toFixed(6)]));
        console.log(`\n  -> wrote ${path}`);
    }

    const fits: Partial<Record<Key, Fit | null>> = {};
    for (const key of keys) {
        // fitGrowth works in milliseconds (it is the same helper the website uses)
        fits[key] = fitGrowth(runtime[key]!.map((r) => ({ n: r.n, ms: r.cpuSeconds * 1000 })), GROWTH[key].f);
    }
    writePlots(keys, runtime, quality, fits);
    writeSummary(keys, runtime, quality, fits, quick);
}

// -----------------------------------------------------------------------------
// Output: summary + plots
// -----------------------------------------------------------------------------
/** Mean of `value` over the rows of each size n, in increasing n. */
function averageBySize<T extends { n: number }>(rows: readonly T[], value: (r: T) => number): { n: number; mean: number }[] {
    const groups = new Map<number, number[]>();
    for (const r of rows) {
        if (!groups.has(r.n)) {
            groups.set(r.n, []);
        }
        groups.get(r.n)!.push(value(r));
    }
    return [...groups].sort((a, b) => a[0] - b[0]).map(([n, v]) => ({ n, mean: v.reduce((s, x) => s + x, 0) / v.length }));
}

function writePlots(keys: Key[], runtime: Partial<Record<Key, RuntimeRow[]>>, quality: QualityRow[], fits: Partial<Record<Key, Fit | null>>): void {
    console.log("");
    for (const key of keys) {
        const rows = runtime[key]!;
        const algo = ALGORITHMS[key];
        const fit = fits[key];
        const maxSeconds = Math.max(...rows.map((r) => r.cpuSeconds));
        const [scale, unit] = maxSeconds < 1e-3 ? [1e6, "µs"] : maxSeconds < 1 ? [1e3, "ms"] : [1, "s"];
        const ns = [...new Set(rows.map((r) => r.n))].sort((a, b) => a - b);
        const fitCurve = (): [number, number][] => {
            // a smooth curve between the smallest and largest n
            const pts: [number, number][] = [];
            for (let i = 0; i <= 120; i++) {
                const n = ns[0] + ((ns[ns.length - 1] - ns[0]) * i) / 120;
                pts.push([n, (fit!.at(n) / 1000) * scale]);
            }
            return pts;
        };
        const series = (logY: boolean): ChartSeries[] => [
            { label: `one map (${INSTANCES_PER_SIZE} per size)`, kind: "dots", color: COLORS[key], points: rows.map((r) => [r.n, r.cpuSeconds * scale]) },
            { label: "average per size", kind: "line", color: "#0b0b0b", points: averageBySize(rows, (r) => r.cpuSeconds).map((p) => [p.n, p.mean * scale]) },
            ...(fit ? [{
                label: `least-squares fit of ${GROWTH[key].label}  (R² = ${fit.r2.toFixed(4)})`, kind: "dashed" as const, color: "#52514e",
                points: logY ? fitCurve().filter((p) => p[1] > 0) : fitCurve(),
            }] : []),
        ];
        const base = {
            xLabel: "n = number of food items",
            subtitle: `${algo.complexity} · ${INSTANCES_PER_SIZE} random maps per size · CPU time (Node ${process.version})`,
        };
        const path = join(RESULTS_DIR, `plot_runtime_${key}.svg`);
        writeChart(path, { ...base, title: `${algo.name}: running time vs. instance size`, yLabel: `CPU time per run (${unit})`, series: series(false) });
        console.log(`  -> wrote ${path}`);
        if (key === "subset_dp") {
            const logPath = join(RESULTS_DIR, "plot_runtime_subset_dp_log.svg");
            writeChart(logPath, {
                ...base, title: `${algo.name}: running time vs. instance size (log scale)`,
                yLabel: `CPU time per run (${unit}, log scale)`, logY: true, series: series(true),
            });
            console.log(`  -> wrote ${logPath}`);
        }
    }
    if (quality.length > 0) {
        const path = join(RESULTS_DIR, "plot_quality_greedy_vs_optimal.svg");
        writeChart(path, {
            title: "How close is Greedy to the optimal route?",
            subtitle: `Calories Greedy loses to spoilage ÷ calories the optimal route (Subset DP) loses · 1.0 = Greedy was optimal`,
            xLabel: "n = number of food items",
            yLabel: "Calories lost, Greedy ÷ optimal",
            yMin: 1,
            series: [
                { label: `one map (${INSTANCES_PER_SIZE} per size)`, kind: "dots", color: COLORS.greedy, points: quality.map((q) => [q.n, q.lossRatio]) },
                { label: "average per size", kind: "line", color: "#0b0b0b", points: averageBySize(quality, (q) => q.lossRatio).map((p) => [p.n, p.mean]) },
            ],
        });
        console.log(`  -> wrote ${path}`);
    }
}

function writeSummary(keys: Key[], runtime: Partial<Record<Key, RuntimeRow[]>>, quality: QualityRow[], fits: Partial<Record<Key, Fit | null>>, quick: boolean): void {
    const lines: string[] = [
        "# CPU-time benchmark",
        "",
        `Generated by \`npm run benchmark${quick ? " -- --quick" : ""}\` on ${new Date().toISOString().slice(0, 10)} with Node ${process.version} (${process.platform} ${process.arch}).`,
        `${INSTANCES_PER_SIZE} random maps per size (seed = ${BASE_SEED} + 1000·n + k). CPU time = user + system time of the process,`,
        "averaged over repeated solves of the same map. Times depend on the machine; the shape of the curves should not.",
        "",
    ];
    for (const key of keys) {
        const rows = runtime[key]!;
        const algo = ALGORITHMS[key];
        const fit = fits[key];
        lines.push(`## ${algo.name}  (${algo.complexity})`, "");
        if (fit) {
            lines.push(`Least-squares fit of \`time = ${GROWTH[key].label}\` over all ${rows.length} maps: `
                + `a = ${(fit.a / 1000).toExponential(3)} s, b = ${(fit.b / 1000).toExponential(3)} s, **R² = ${fit.r2.toFixed(4)}**.`, "");
        }
        lines.push("| n | average CPU time | fastest map | slowest map | fit predicts |", "|---:|---:|---:|---:|---:|");
        for (const { n, mean } of averageBySize(rows, (r) => r.cpuSeconds)) {
            const times = rows.filter((r) => r.n === n).map((r) => r.cpuSeconds);
            lines.push(`| ${n} | ${formatTime(mean)} | ${formatTime(Math.min(...times))} | ${formatTime(Math.max(...times))} | ${fit ? formatTime(Math.max(0, fit.at(n) / 1000)) : "–"} |`);
        }
        lines.push("");
    }
    if (quality.length > 0) {
        lines.push("## Greedy vs. the optimal route", "",
            "On the Subset DP maps. Loss ratio = calories Greedy loses to spoilage ÷ calories the optimal route loses.", "",
            "| n | Greedy optimal on | average loss ratio | worst loss ratio |", "|---:|---:|---:|---:|");
        for (const { n, mean } of averageBySize(quality, (q) => q.lossRatio)) {
            const q = quality.filter((r) => r.n === n);
            const optimal = q.filter((r) => r.greedyScore >= r.optimalScore - 1e-6).length;
            lines.push(`| ${n} | ${optimal} of ${q.length} maps | ${mean.toFixed(3)} | ${Math.max(...q.map((r) => r.lossRatio)).toFixed(3)} |`);
        }
        lines.push("");
    }
    const path = join(RESULTS_DIR, "summary.md");
    writeFileSync(path, lines.join("\n"), "utf8");
    console.log(`  -> wrote ${path}`);

    console.log("");
    for (const key of keys) {
        const fit = fits[key];
        const avg = averageBySize(runtime[key]!, (r) => r.cpuSeconds);
        const last = avg[avg.length - 1];
        console.log(`${ALGORITHMS[key].name.padEnd(10)} n=${last.n}: ${formatTime(last.mean)} per run` + (fit ? `   fit ${GROWTH[key].label}: R² = ${fit.r2.toFixed(4)}` : ""));
    }
}

function writeCsv(path: string, header: string[], rows: (string | number)[][]): void {
    writeFileSync(path, [header, ...rows].map((r) => r.join(",")).join("\n") + "\n", "utf8");
}

function formatTime(seconds: number): string {
    if (seconds < 1e-3) {
        return `${(seconds * 1e6).toFixed(1)} µs`;
    }
    if (seconds < 1) {
        return `${(seconds * 1e3).toFixed(3)} ms`;
    }
    return `${seconds.toFixed(3)} s`;
}

main();
