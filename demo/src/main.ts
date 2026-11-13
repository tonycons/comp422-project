// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Updated 2026-11-12 (Claude): Greedy vs. Held-Karp race + "How they scale" charts.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * Page controller: settings -> race -> animation clock -> panels, chart, tables,
 * plus the scaling study at the bottom of the page.
 *
 * The race animation has two phases:
 *   1. PLANNING - each panel's bar shows how long its algorithm took to compute its
 *      route; the slowest bar fills PLANNING_SECONDS of screen time. Subset DP's map
 *      shows the best partial route its table has found so far, and the strip under
 *      each map lights up the work done (Greedy's comparisons, Subset DP's table rows).
 *   2. WALKING  - both raccoons leave the den together and eat along their routes.
 */
import "./style.css";
import * as config from "./core/config";
import { MAX_SEED, randomSeed } from "./core/generator";
import * as greedy from "./core/greedy";
import * as subsetDp from "./core/subsetDp";
import { isSpoiledAt, type Solution } from "./core/problem";
import { makeRace, type Race } from "./core/race";
import {
    byN, emptyScaling, fitGrowth, GROWTH, MAPS_PER_SIZE, mean, QUALITY_MAPS_PER_SIZE, runScaling, type TimePoint,
} from "./core/scaling";
import { fmtInt, fmtMs, fmtPct, fmtSeconds } from "./ui/format";
import { eatenCount, MapView, type PanelData } from "./ui/mapView";
import { ScatterChart, type ChartSeries } from "./ui/scatterChart";
import {
    ALGORITHM_COLORS, COLORS, foodStyle, PLANNING_HOLD_SECONDS, PLANNING_SECONDS, shapeSvg, STALE_BELOW, WALK_SECONDS,
} from "./ui/theme";
import { Timeline, type Series } from "./ui/timeline";
import { WorkView } from "./ui/workView";

const N_MIN = 2;
const N_MAX = subsetDp.MAX_N;
const DEFAULT_N = 12;
const SLOW_N = 15;   // Subset DP needs about a second from here on
type RaceKey = "greedy" | "subset_dp";
const INFO = { greedy: greedy.INFO, subset_dp: subsetDp.INFO } as const;
const KEYS: RaceKey[] = ["greedy", "subset_dp"];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------
interface Panel {
    key: RaceKey;
    view: MapView;
    work: WorkView;
    canvas: HTMLCanvasElement;
    workCanvas: HTMLCanvasElement;
    workCaption: HTMLElement;
    bar: HTMLElement;
    caption: HTMLElement;
    stat: { banked: HTMLElement; eaten: HTMLElement; spoiled: HTMLElement; plan: HTMLElement };
}

function buildPanel(key: RaceKey): Panel {
    const root = $(`panel-${key}`);
    const info = INFO[key];
    root.innerHTML = `
        <div class="panel-head">
            <div>
                <h2 class="panel-title"><span class="algo-key" data-algo="${key}"></span></h2>
                <p class="panel-tagline"></p>
            </div>
            <span class="chip" title="Time complexity"></span>
        </div>
        <canvas class="map" role="img"></canvas>
        <div class="plan">
            <div class="plan-bar" data-algo="${key}" aria-hidden="true"><i></i></div>
            <span class="plan-caption"></span>
        </div>
        <div class="work">
            <canvas class="work-canvas" aria-hidden="true"></canvas>
            <span class="work-caption help"></span>
        </div>
        <dl class="stats">
            <div><dt>Calories banked</dt><dd data-stat="banked">0</dd></div>
            <div><dt>Eaten</dt><dd data-stat="eaten">0</dd></div>
            <div><dt>Spoiled when eaten</dt><dd data-stat="spoiled">0</dd></div>
            <div><dt>Planning time</dt><dd data-stat="plan">–</dd></div>
        </dl>`;
    root.querySelector(".algo-key")!.textContent = info.name;
    root.querySelector(".panel-tagline")!.textContent = info.tagline;
    root.querySelector(".chip")!.textContent = info.timeComplexity;
    const canvas = root.querySelector<HTMLCanvasElement>("canvas.map")!;
    const workCanvas = root.querySelector<HTMLCanvasElement>("canvas.work-canvas")!;
    const q = (s: string) => root.querySelector<HTMLElement>(`[data-stat="${s}"]`)!;
    return {
        key,
        canvas,
        workCanvas,
        view: new MapView(canvas),
        work: new WorkView(workCanvas),
        workCaption: root.querySelector<HTMLElement>(".work-caption")!,
        bar: root.querySelector<HTMLElement>(".plan-bar > i")!,
        caption: root.querySelector<HTMLElement>(".plan-caption")!,
        stat: { banked: q("banked"), eaten: q("eaten"), spoiled: q("spoiled"), plan: q("plan") },
    };
}

const panels: Record<RaceKey, Panel> = { greedy: buildPanel("greedy"), subset_dp: buildPanel("subset_dp") };
const timeline = new Timeline($<HTMLCanvasElement>("timeline"), $("tooltip"));

// ---------------------------------------------------------------------------
// Legends
// ---------------------------------------------------------------------------
function lineLegend(target: HTMLElement, keys: RaceKey[]): void {
    target.replaceChildren();
    for (const key of keys) {
        const li = document.createElement("li");
        const k = document.createElement("span");
        k.className = "line-key";
        k.style.background = ALGORITHM_COLORS[key];
        const t = document.createElement("span");
        t.textContent = INFO[key].name;
        li.append(k, t);
        target.appendChild(li);
    }
}

function buildLegends(): void {
    const foods = $("food-legend");
    for (const f of config.FOOD_TYPES) {
        const li = document.createElement("li");
        const style = foodStyle(f.name);
        const name = document.createElement("strong");
        name.textContent = f.name;
        const detail = document.createElement("span");
        detail.textContent = `${f.calories} cal · spoils in ${f.shelfLife} s`;
        li.append(shapeSvg(style.shape, style.color), name, detail);
        foods.appendChild(li);
    }
    const extra = document.createElement("li");
    extra.className = "extra";
    extra.innerHTML = `<span class="fresh-key" aria-hidden="true">
            <i style="background:${COLORS.fresh}"></i><i style="background:${COLORS.stale}"></i><i style="background:${COLORS.spoiled}"></i>
        </span><span>freshness bar: fresh, below ${STALE_BELOW * 100}%, spoiled (item turns gray)</span>`;
    foods.appendChild(extra);

    lineLegend($("timeline-legend"), KEYS);
    lineLegend($("legend-time"), KEYS);
}

// ---------------------------------------------------------------------------
// State + animation clock
// ---------------------------------------------------------------------------
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
    race: null as Race | null,
    maxT: 1,               // the longer of the two walks (seconds of simulated time)
    maxMs: 1,              // the slower of the two planning times
    phase: "planning" as "planning" | "walking",
    planClock: 0,          // screen seconds spent in the planning phase
    walkT: 0,              // simulated seconds since leaving the den
    playing: true,
    speed: 1,
    lastFrame: 0,
};

function startRace(n: number, seed: number): void {
    setBusy(true, n);
    // let the browser paint "Solving..." before the (synchronous) solve
    setTimeout(() => {
        const race = makeRace(n, seed);
        state.race = race;
        state.maxT = Math.max(race.greedy.solution.totalTime, race.subsetDp.solution.totalTime, 1e-9);
        state.maxMs = Math.max(race.greedy.ms, race.subsetDp.ms);
        const data: Record<RaceKey, PanelData> = {
            greedy: { key: "greedy", instance: race.instance, solution: race.greedy.solution, decisions: race.greedy.decisions },
            subset_dp: { key: "subset_dp", instance: race.instance, solution: race.subsetDp.solution, snapshots: race.subsetDp.snapshots },
        };
        for (const key of KEYS) {
            const panel = panels[key];
            panel.view.setData(data[key]);
            panel.work.setData(key, n);
            panel.canvas.setAttribute("aria-label",
                `Map of ${n} food items with the ${INFO[key].name} raccoon's route. Results are in the table below.`);
        }
        const st = race.subsetDp.stats;
        panels.greedy.workCaption.textContent =
            `Work: ${fmtInt((n * (n + 1)) / 2)} comparisons (a column per decision, a square per item still left)`;
        panels.subset_dp.workCaption.textContent =
            `Table: ${fmtInt(2 ** n)} sets, a square each (darker = more items) · ${fmtInt(st.cells)} cells · ${fmtInt(st.candidates)} labels built`;
        timeline.setSeries(KEYS.map((key) => toSeries(key, data[key].solution)));
        renderResults(race);
        restart();
        setBusy(false, n);
    }, 20);
}

function toSeries(key: RaceKey, s: Solution): Series {
    let sum = 0;
    return { name: INFO[key].name, color: ALGORITHM_COLORS[key], times: s.arrivalTimes, banked: s.itemScores.map((v) => (sum += v)) };
}

function restart(): void {
    state.phase = reducedMotion ? "walking" : "planning";
    state.planClock = 0;
    state.walkT = 0;
    setPlaying(!reducedMotion && !scaling.running);
    render();
}

function frame(now: number): void {
    const dt = state.lastFrame ? Math.min(0.1, (now - state.lastFrame) / 1000) : 0;
    state.lastFrame = now;
    if (state.playing && state.race) {
        if (state.phase === "planning") {
            state.planClock += dt * state.speed;
            if (state.planClock >= PLANNING_SECONDS + PLANNING_HOLD_SECONDS) {
                state.phase = "walking";
            }
        } else {
            state.walkT += (dt * state.speed * state.maxT) / WALK_SECONDS;
            if (state.walkT >= state.maxT) {
                state.walkT = state.maxT;
                setPlaying(false);
            }
        }
        render();
    }
    requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render(): void {
    const race = state.race;
    if (!race) {
        return;
    }
    const planning = state.phase === "planning";
    const p = Math.min(1, state.planClock / PLANNING_SECONDS);   // 0..1 of the slowest bar

    for (const key of KEYS) {
        const panel = panels[key];
        const result = key === "greedy" ? race.greedy : race.subsetDp;
        const own = planning ? Math.min(1, (p * state.maxMs) / Math.max(result.ms, 1e-12)) : 1;
        panel.bar.style.width = `${own * 100}%`;
        panel.caption.textContent = planCaption(key, own);
        panel.stat.plan.textContent = own >= 1 ? fmtMs(result.ms) : "…";
        panel.work.draw(own);

        if (planning) {
            panel.view.drawPlanning(own);
            panel.stat.banked.textContent = "0";
            panel.stat.eaten.textContent = `0 / ${race.instance.items.length}`;
            panel.stat.spoiled.textContent = "0";
        } else {
            panel.view.drawWalking(state.walkT);
            const s = result.solution;
            const k = eatenCount(s.arrivalTimes, state.walkT);
            let banked = 0;
            let spoiled = 0;
            for (let i = 0; i < k; i++) {
                banked += s.itemScores[i];
                if (isSpoiledAt(race.instance.items[s.order[i]], s.arrivalTimes[i])) {  // worth 0 now
                    spoiled++;
                }
            }
            panel.stat.banked.textContent = fmtInt(banked);
            panel.stat.eaten.textContent = `${k} / ${s.order.length}${k === s.order.length ? " ✓" : ""}`;
            panel.stat.spoiled.textContent = String(spoiled);
        }
    }

    timeline.setCursor(planning ? 0 : state.walkT);
    timeline.draw();

    const scrub = $<HTMLInputElement>("time");
    scrub.value = String(Math.round((state.walkT / state.maxT) * 1000));
    $("time-out").textContent = fmtSeconds(state.walkT);
    const phase = $("phase");
    const label = planning ? "Planning" : state.walkT >= state.maxT ? "Finished" : "Walking";
    if (phase.textContent !== label) {
        phase.textContent = label;
    }
}

function planCaption(key: RaceKey, own: number): string {
    const race = state.race!;
    const n = race.instance.items.length;
    if (key === "greedy") {
        return own < 1 ? "Computing its route…" : "Decides one step at a time; faint lines show what it weighs at each step";
    }
    if (own >= 1) {
        return "Planned the whole route before leaving (dashed = rest of plan)";
    }
    const frame = race.subsetDp.snapshots ? MapView.snapshotAt(race.subsetDp.snapshots, own) : null;
    const done = Math.round(own * 2 ** n);
    return frame
        ? `Filling the table: ${fmtInt(done)} of ${fmtInt(2 ** n)} sets. Line = cheapest way to eat the ${frame.route.length} bright items`
        : "Filling the table…";
}

function renderResults(race: Race): void {
    const g = race.greedy.solution;
    const h = race.subsetDp.solution;
    const summary = $("summary");
    summary.replaceChildren();
    const add = (text: string, strong = false) => {
        const el = strong ? document.createElement("strong") : document.createTextNode(text);
        if (strong) {
            el.textContent = text;
        }
        summary.appendChild(el);
    };
    const ratio = race.subsetDp.ms / race.greedy.ms;
    const extra = h.totalScore - g.totalScore;
    if (extra < 1e-6) {
        add("On this map Greedy happened to find a best route too, so both score the same; Subset DP ");
        add("proves", true);
        add(` no order does better. It took ${fmtRatio(ratio)} as long to plan. Try more items: Greedy's luck runs out fast.`);
    } else {
        const less = g.spoilageLoss > 0 ? (extra / g.spoilageLoss) * 100 : 0;
        add("Subset DP banked ");
        add(`${fmtInt(extra)} more calories`, true);
        add(" than Greedy (");
        add(`${fmtPct(less)} less`, true);
        add(` lost to spoilage), the best score possible on this map. It took ${fmtRatio(ratio)} as long to plan.`);
    }

    const table = $<HTMLTableElement>("results");
    table.replaceChildren();
    const head = table.createTHead().insertRow();
    for (const t of ["Algorithm", "Final score (cal)", "Lost to spoilage (cal)", "Spoiled when eaten", "Finish time",
        "Planning time", "Time complexity", "Table"]) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = t;
        head.appendChild(th);
    }
    const body = table.createTBody();
    const st = race.subsetDp.stats;
    for (const [key, s, ms, extraCol] of [
        ["greedy", g, race.greedy.ms, "–"],
        ["subset_dp", h, race.subsetDp.ms, `${fmtInt(st.cells)} cells, F = ${st.maxFront}`],
    ] as const) {
        const row = body.insertRow();
        const th = document.createElement("th");
        th.scope = "row";
        const name = document.createElement("span");
        name.className = "algo-key";
        name.dataset.algo = key;
        name.textContent = INFO[key].name;
        th.appendChild(name);
        row.appendChild(th);
        for (const v of [fmtInt(s.totalScore), fmtInt(s.spoilageLoss), `${s.spoiledCount} of ${s.order.length}`,
            fmtSeconds(s.totalTime), fmtMs(ms), INFO[key].timeComplexity, extraCol]) {
            row.insertCell().textContent = v;
        }
    }

    const details = $<HTMLDetailsElement>("route-details");
    $("routes").replaceChildren();
    if (details.open) {
        renderRoutes();
    }
}

const fmtRatio = (r: number): string => (r >= 10 ? `${fmtInt(r)}×` : `${r.toFixed(1)}×`);

/** Meal-by-meal table (built only when opened). */
function renderRoutes(): void {
    const race = state.race;
    const table = $<HTMLTableElement>("routes");
    if (!race || table.rows.length) {
        return;
    }
    const items = race.instance.items;
    const head = table.createTHead();
    const top = head.insertRow();
    top.appendChild(document.createElement("th"));
    for (const key of KEYS) {
        const th = document.createElement("th");
        th.colSpan = 3;
        th.className = "food group-start";
        th.scope = "colgroup";
        th.textContent = INFO[key].name;
        top.appendChild(th);
    }
    const sub = head.insertRow();
    for (const [t, cls] of [["Meal", ""], ["Food", "food group-start"], ["Eaten at", ""], ["Calories", ""],
        ["Food", "food group-start"], ["Eaten at", ""], ["Calories", ""]]) {
        const th = document.createElement("th");
        th.scope = "col";
        th.className = cls;
        th.textContent = t;
        sub.appendChild(th);
    }
    const body = table.createTBody();
    const g = race.greedy.solution;
    const h = race.subsetDp.solution;
    for (let k = 0; k < g.order.length; k++) {
        const row = body.insertRow();
        row.insertCell().textContent = String(k + 1);
        for (const s of [g, h]) {
            const food = row.insertCell();
            food.className = "food group-start";
            food.textContent = items[s.order[k]].food.name;
            row.insertCell().textContent = fmtSeconds(s.arrivalTimes[k]);
            const cal = row.insertCell();
            cal.textContent = fmtInt(s.itemScores[k]);
            if (isSpoiledAt(items[s.order[k]], s.arrivalTimes[k])) {  // spoiled: 0 cal
                cal.className = "neg";
            }
        }
    }
}

// ---------------------------------------------------------------------------
// "How they scale": the scaling study and its charts
// ---------------------------------------------------------------------------
const chartTip = (id: string) => $(id).parentElement!.querySelector<HTMLElement>(".tooltip")!;
const fmtCal = (v: number) => `${fmtInt(v)} cal`;
const fmtPctAxis = (v: number) => `${fmtInt(v)}%`;
const X_LABEL = "food items on the map (n)";

const charts = {
    quality: new ScatterChart($("chart-quality"), chartTip("chart-quality"),
        { xLabel: X_LABEL, yLabel: "extra calories", formatY: fmtCal, height: 240 }),
    optimal: new ScatterChart($("chart-optimal"), chartTip("chart-optimal"),
        { xLabel: X_LABEL, yLabel: "% of maps", formatY: fmtPctAxis, height: 240, yMin: 0, yMax: 100 }),
    time: new ScatterChart($("chart-time"), chartTip("chart-time"),
        { xLabel: X_LABEL, yLabel: "planning time (ms)", formatY: fmtMs, logY: true, height: 320, labelSpace: 104 }),
    greedy: new ScatterChart($("chart-greedy"), chartTip("chart-greedy"),
        { xLabel: "food items (n)", yLabel: "time (ms)", formatY: fmtMs, height: 220 }),
    subset_dp: new ScatterChart($("chart-subset_dp"), chartTip("chart-subset_dp"),
        { xLabel: "food items (n)", yLabel: "time (ms)", formatY: fmtMs, height: 220 }),
};

const scaling = {
    data: emptyScaling(),
    running: false,
    stop: false,
    started: false,
    lastDraw: 0,
};

const pts = (list: readonly TimePoint[]) => list.map((p) => ({ x: p.n, y: p.ms }));

function updateScalingCharts(): void {
    const d = scaling.data;
    charts.quality.setSeries([{
        name: "Subset DP − Greedy", color: ALGORITHM_COLORS.subset_dp, kind: "scatter",
        points: d.quality.map((q) => ({ x: q.n, y: q.extraCalories })),
    }]);
    charts.optimal.setSeries([{
        name: "Greedy optimal", color: ALGORITHM_COLORS.greedy, kind: "bars",
        points: byN(d.quality, (q) => (q.greedyOptimal ? 100 : 0)).map(([n, v]) => ({ x: n, y: mean(v) })),
    }]);

    // least-squares trendlines of each Theta bound (Greedy on its large maps, where n^2 shows)
    const fits = {
        greedy: fitGrowth(d.greedyLarge, GROWTH.greedy.f),
        subset_dp: fitGrowth(d.time.subset_dp, GROWTH.subset_dp.f),
    };
    const fitFor = (key: keyof typeof fits) => {
        const f = fits[key];
        return f ? { label: GROWTH[key].label, at: f.at } : null;
    };
    const timeSeries: ChartSeries[] = KEYS.map((key) => ({
        name: INFO[key].name,
        color: ALGORITHM_COLORS[key],
        kind: "scatter",
        points: pts(d.time[key]),
    }));   // the fitted trendlines are on each algorithm's own chart below (linear axes)
    charts.time.setSeries(timeSeries.filter((s) => s.points.length > 0));

    charts.greedy.setSeries([{ name: "Greedy", color: ALGORITHM_COLORS.greedy, kind: "scatter", points: pts(d.greedyLarge), fit: fitFor("greedy") }]);
    charts.subset_dp.setSeries([{ name: "Subset DP", color: ALGORITHM_COLORS.subset_dp, kind: "scatter", points: pts(d.time.subset_dp), fit: fitFor("subset_dp") }]);
    for (const key of KEYS) {
        const f = fits[key];
        if (f) {
            $(`fit-${key}`).textContent = `Dots = maps, line = average, dashed = fit ${GROWTH[key].label} (R² = ${f.r2.toFixed(3)})`;
        }
    }
    for (const c of Object.values(charts)) {
        c.draw();
    }
    renderScalingTables();
    renderTiles();
}

/** Headline numbers from the largest size measured so far. */
function renderTiles(): void {
    const d = scaling.data;
    const ul = $("scaling-tiles");
    ul.replaceChildren();
    const q = byN(d.quality, (p) => p.extraCalories);
    if (q.length === 0) {
        return;
    }
    const [nTop, extras] = q[q.length - 1];
    const top = d.quality.filter((p) => p.n === nTop);
    const optimalTop = top.filter((p) => p.greedyOptimal).length;
    const tiles: [string, string, string][] = [
        [`+${fmtInt(mean(extras))} cal`, `Subset DP's average lead over Greedy at n = ${nTop}`,
            `${fmtPct(mean(top.map((p) => p.extraPercent)))} of all the food on the map (at n = ${q[0][0]}: ${fmtInt(mean(q[0][1]))} cal)`],
        [`${optimalTop} of ${top.length}`, `maps at n = ${nTop} where Greedy found the best route`,
            "Subset DP finds it on every map, by construction"],
    ];
    tiles.push([`${fmtPct(mean(top.map((p) => p.extraSpoilagePercent)))} more`,
        `calories Greedy lets spoil than the best route, at n = ${nTop}`,
        `at n = ${q[0][0]}: ${fmtPct(mean(d.quality.filter((p) => p.n === q[0][0]).map((p) => p.extraSpoilagePercent)))} more`]);
    for (const [value, label, note] of tiles) {
        const li = document.createElement("li");
        li.className = "tile";
        const v = document.createElement("strong");
        v.textContent = value;
        const l = document.createElement("span");
        l.textContent = label;
        const s = document.createElement("small");
        s.textContent = note;
        li.append(v, l, s);
        ul.appendChild(li);
    }
}

function renderScalingTables(): void {
    const d = scaling.data;
    const qa = byN(d.quality, (p) => p.extraCalories);
    const qp = new Map(byN(d.quality, (p) => p.extraPercent));
    const qo = byN(d.quality, (p) => (p.greedyOptimal ? 1 : 0));
    fillTable($("table-quality"), ["n", "Maps", "Mean extra calories", "Min", "Max", "% of all food"],
        qa.map(([n, v]) => [String(n), String(v.length), fmtInt(mean(v)), fmtInt(Math.min(...v)), fmtInt(Math.max(...v)),
            fmtPct(mean(qp.get(n)!))]));
    fillTable($("table-optimal"), ["n", "Maps", "Greedy optimal", "Share"],
        qo.map(([n, v]) => [String(n), String(v.length), String(v.reduce((a, b) => a + b, 0)), `${fmtInt(mean(v) * 100)}%`]));
    const g = new Map(byN(d.time.greedy, (p) => p.ms));
    const h = new Map(byN(d.time.subset_dp, (p) => p.ms));
    const sizes = [...new Set([...g.keys(), ...h.keys()])].sort((x, y) => x - y);
    const cell = (m: Map<number, number[]>, n: number) => (m.has(n) ? fmtMs(mean(m.get(n)!)) : "–");
    fillTable($("table-time"), ["n", "Greedy (mean)", "Subset DP (mean)"], [
        ...sizes.map((n) => [String(n), cell(g, n), cell(h, n)]),
        ...byN(d.greedyLarge, (p) => p.ms).map(([n, v]) => [fmtInt(n), fmtMs(mean(v)), "–"]),
    ]);
}

function fillTable(table: HTMLTableElement, head: string[], rows: string[][]): void {
    table.replaceChildren();
    const hr = table.createTHead().insertRow();
    for (const t of head) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = t;
        hr.appendChild(th);
    }
    const body = table.createTBody();
    for (const r of rows) {
        const row = body.insertRow();
        r.forEach((v) => (row.insertCell().textContent = v));
    }
}

async function startScaling(): Promise<void> {
    if (scaling.running) {
        scaling.stop = true;     // the button doubles as "Stop"
        return;
    }
    scaling.started = true;
    scaling.running = true;
    scaling.stop = false;
    scaling.data = emptyScaling();
    const btn = $<HTMLButtonElement>("scaling-run");
    const status = $("scaling-status");
    const bar = $("scaling-bar");
    btn.textContent = "Stop";
    const resume = state.playing;
    setPlaying(false);           // the race animation would disturb the timings
    const t0 = performance.now();
    const finished = await runScaling(scaling.data, (done, total) => {
        bar.style.width = `${(done / total) * 100}%`;
        status.textContent = `Measuring… ${done} of ${total} maps (race paused)`;
        const now = performance.now();
        if (now - scaling.lastDraw > 250 || done === total) {
            scaling.lastDraw = now;
            updateScalingCharts();
        }
    }, () => scaling.stop);
    scaling.running = false;
    btn.textContent = "Measure again";
    status.textContent = finished
        ? `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s · ${QUALITY_MAPS_PER_SIZE} maps per size (${MAPS_PER_SIZE} timed)`
        : "Stopped. The charts show what was measured so far.";
    updateScalingCharts();
    if (resume) {
        setPlaying(true);
    }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
const nRange = $<HTMLInputElement>("n-range");
const nInput = $<HTMLInputElement>("n-input");
const seedInput = $<HTMLInputElement>("seed-input");
const playBtn = $<HTMLButtonElement>("play");

function setPlaying(on: boolean): void {
    state.playing = on;
    playBtn.textContent = on ? "Pause" : state.walkT >= state.maxT && state.phase === "walking" ? "Replay" : "Play";
    playBtn.setAttribute("aria-pressed", String(on));
}

function setBusy(busy: boolean, n: number): void {
    document.body.style.cursor = busy ? "progress" : "";
    if (busy) {
        panels.greedy.caption.textContent = "Solving…";
        panels.subset_dp.caption.textContent = n >= SLOW_N ? `Solving… (2^${n} sets: about a second)` : "Solving…";
    }
    for (const el of [nRange, nInput, seedInput, $("new-map")]) {
        (el as HTMLInputElement).disabled = busy;
    }
}

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));

function currentSettings(): { n: number; seed: number } {
    return { n: clampInt(Number(nInput.value), N_MIN, N_MAX), seed: clampInt(Number(seedInput.value), 0, MAX_SEED) };
}

function apply(): void {
    const { n, seed } = currentSettings();
    nInput.value = String(n);
    nRange.value = String(n);
    seedInput.value = String(seed);
    const url = new URL(window.location.href);
    url.searchParams.set("n", String(n));
    url.searchParams.set("seed", String(seed));
    history.replaceState(null, "", url);
    startRace(n, seed);
}

let rangeTimer = 0;
nRange.addEventListener("input", () => {
    nInput.value = nRange.value;
    clearTimeout(rangeTimer);
    rangeTimer = window.setTimeout(apply, 250);
});
nInput.addEventListener("change", apply);
seedInput.addEventListener("change", apply);
$("controls").addEventListener("submit", (e) => {
    e.preventDefault();
    apply();
});
$("new-map").addEventListener("click", () => {
    seedInput.value = String(randomSeed());
    apply();
});
$("restart").addEventListener("click", () => {
    state.phase = "planning";
    state.planClock = 0;
    state.walkT = 0;
    setPlaying(true);
});
playBtn.addEventListener("click", togglePlay);
$<HTMLSelectElement>("speed").addEventListener("change", (e) => {
    state.speed = Number((e.target as HTMLSelectElement).value);
});
$<HTMLInputElement>("time").addEventListener("input", (e) => {
    state.phase = "walking";
    state.walkT = (Number((e.target as HTMLInputElement).value) / 1000) * state.maxT;
    setPlaying(false);
    render();
});
$<HTMLDetailsElement>("route-details").addEventListener("toggle", (e) => {
    if ((e.target as HTMLDetailsElement).open) {
        renderRoutes();
    }
});
$("scaling-run").addEventListener("click", () => void startScaling());
document.addEventListener("keydown", (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (e.code === "Space" && !["INPUT", "SELECT", "BUTTON", "TEXTAREA", "CANVAS"].includes(tag)) {
        e.preventDefault();
        togglePlay();
    }
});

function togglePlay(): void {
    if (!state.playing && state.phase === "walking" && state.walkT >= state.maxT) {
        state.walkT = 0;
    }
    setPlaying(!state.playing);
}

// Redraw at the right size whenever a canvas's box changes
const observer = new ResizeObserver(() => {
    for (const key of KEYS) {
        panels[key].view.resize();
        panels[key].work.resize();
    }
    timeline.resize();
    for (const c of Object.values(charts)) {
        c.resize();
        c.draw();
    }
    render();
});
for (const key of KEYS) {
    observer.observe(panels[key].canvas);
    observer.observe(panels[key].workCanvas);
}
observer.observe($("timeline"));
for (const id of ["chart-quality", "chart-optimal", "chart-time", "chart-greedy", "chart-subset_dp"]) {
    observer.observe($(id));
}

// Start the scaling study the first time its section scrolls into view
const scalingObserver = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && !scaling.started) {
        scalingObserver.disconnect();
        void startScaling();
    }
}, { rootMargin: "200px" });
scalingObserver.observe($("scaling-title"));

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
buildLegends();
nRange.min = String(N_MIN);
nRange.max = String(N_MAX);
nInput.min = String(N_MIN);
nInput.max = String(N_MAX);
const params = new URLSearchParams(window.location.search);
nInput.value = String(clampInt(Number(params.get("n") ?? DEFAULT_N), N_MIN, N_MAX));
seedInput.value = params.has("seed") ? String(clampInt(Number(params.get("seed")), 0, MAX_SEED)) : String(randomSeed());
apply();
updateScalingCharts();
requestAnimationFrame(frame);
