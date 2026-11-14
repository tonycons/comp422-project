<!-- AI-GENERATED (Claude, 2026-11-03; updated 2026-11-12 and 2026-11-13) - see ../AI_CONTRIBUTIONS.md -->
# The Greedy Raccoon: web demo

A static website that races the two algorithms on the same random map, then measures how both
scale as maps grow:

| | Algorithm | Time | Code |
|---|---|---|---|
| Straightforward | **Greedy** (Smith's ratio rule) | Θ(n²) | `src/solutions/greedy.ts` |
| Clever | **Subset DP**: exact dynamic programming over (set, last item), with (time, loss) labels | Θ(n²·2ⁿ), O(n²·2ⁿ·F) with labels | `src/solutions/subsetDp.ts` |

This TypeScript code is the project's reference implementation. Pseudocode, running-time analysis
and the correctness proof are in the project report.

The page has three parts:

1. **The race** (n = 2 to 16): both raccoons plan, then walk. While Subset DP plans, its map shows
   the cheapest partial route its table has found so far, and the strip under each map lights up
   the work done (Greedy's comparisons vs. Subset DP's 2ⁿ sets).
2. **How they scale**: 20 fixed maps per size n = 2..14 (10 of them timed), measured in the
   browser when you scroll there (about 10 s). Charts: extra calories Subset DP earns over Greedy,
   how often Greedy is optimal, planning time on a log scale (Greedy vs. Subset DP), and
   one chart per algorithm with a least-squares fit of its Θ bound (Greedy is timed on
   n = 100..1,500 so its n² curve shows).
3. **How it works**: scoring, and a short summary of each algorithm.

It is plain TypeScript + [Vite](https://vite.dev), with no framework and no server. Everything runs in the browser.

## Run it locally

Needs Node 20.19+ (22 recommended).

```bash
cd demo
npm install
npm run dev        # http://localhost:5173, live reload
npm test           # correctness tests (see below)
npm run benchmark  # CPU-time benchmark (see below)
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
```

## Deploy to Cloudflare Pages

**Option A: connect the GitHub repo** (rebuilds on every push)

1. Cloudflare dashboard → *Workers & Pages* → *Create* → *Pages* → *Connect to Git*, then pick this repo.
2. Build settings:
   - Framework preset: **None** (or *Vite*)
   - **Root directory:** `demo`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Node version: the `.node-version` file in this folder pins Node 22.

**Option B: upload from your machine**

```bash
cd demo
npm run build
npx wrangler pages deploy dist --project-name greedy-raccoon
```

## Tests

`npm test` runs two files:

| File | What it checks |
|---|---|
| `tests/algorithms.test.ts` | **Subset DP is optimal:** on small maps (n = 1 to 8) its score equals an exhaustive search of all n! orders, including crowded maps where most food spoils. Also: Subset DP never scores below Greedy, routes visit every item exactly once, maps are reproducible from (n, seed), and the curve fitting works. |
| `tests/regression.test.ts` | **Nothing changed by accident:** on 14 fixed maps (n = 1 to 500, Subset DP up to 14) both algorithms must produce exactly the routes stored in `tests/fixtures/reference_routes.json`. |

If you change an algorithm, the scoring, or `src/core/config.ts` on purpose, the regression test will
fail. Check the new routes are what you intended, then update `reference_routes.json` to match.

## CPU-time benchmark

A browser cannot read CPU time, so the benchmark runs in Node. It uses the same algorithm files as
the website (`src/core/`).

```bash
npm run benchmark                     # full run, about 1.5 minutes
npm run benchmark -- --quick          # smaller sizes, about 15 seconds
npm run benchmark -- --only greedy    # one algorithm (greedy or subset_dp)
```

For each size it solves 10 random maps (reproducible seeds) and records the CPU time of each:
Greedy on n = 50 to 1,000, Subset DP on n = 2 to 16. Results go to `benchmark/results/`:

| File | What it is |
|---|---|
| `runtime_greedy.csv`, `runtime_subset_dp.csv` | One row per map: n, seed, CPU seconds, repeats, score |
| `quality.csv` | On every Subset DP map: Greedy's score and loss next to the optimal ones |
| `summary.md` | Averages per size and the least-squares fit of each Θ bound, with R² |
| `plot_runtime_greedy.svg`, `plot_runtime_subset_dp.svg`, `plot_runtime_subset_dp_log.svg` | Running time vs. n: one dot per map, the average, and the fitted curve |
| `plot_quality_greedy_vs_optimal.svg` | How much more Greedy loses than the optimal route |

How the time is measured (`benchmark/benchmark.ts`):

- **CPU time** is the user + system time of the Node process (`process.cpuUsage()`).
- A small solve is too short to measure once, so each map is solved repeatedly until 0.2 s of CPU
  time has passed, and the average is recorded.
- Before each size is timed, a throwaway map of that size is solved first, so the time Node spends
  compiling the code is not counted.
- Node runs with `--single-threaded`, so its compiler and garbage collector do not use extra CPU
  on helper threads.

Times depend on the machine; rerun it on yours before quoting numbers. The SVG charts open in any browser.

## Where things are

| Path | What it is |
|---|---|
| `src/core/` | The algorithms and scoring: `problem.ts` (rules), `config.ts` (all the numbers), `generator.ts` (random maps), `greedy.ts`, `subsetDp.ts` (everything Subset DP needs, including its dominance rule) |
| `src/core/race.ts` | Builds a map, solves and times both algorithms |
| `src/core/scaling.ts` | The "How they scale" study: maps, timings, calorie gaps, least-squares fits |
| `src/ui/mapView.ts` | One algorithm's map: planning replay + walking animation |
| `src/ui/workView.ts` | The strip under each map (Greedy's comparisons, Subset DP's table) |
| `src/ui/scatterChart.ts` | The scaling charts (dots per map, average line, fitted trendline, hover) |
| `src/ui/timeline.ts` | "Calories banked over time" chart (hover / ← → for values) |
| `src/ui/theme.ts` | Colors, food shapes, animation timing |
| `src/main.ts` | Page controller: controls, animation clock, results tables |
| `tests/` | Correctness and regression tests (see above) |
| `benchmark/` | CPU-time benchmark: `benchmark.ts` (measuring), `plot.ts` (SVG charts), `results/` (output) |

## Things to know

- **Maps:** a map is fully determined by its size and seed (seeded generator: mulberry32), so the
  same seed gives the same map on every computer.
- **Timing:** browsers only expose wall-clock time, so "planning time" is wall-clock, averaged over
  repeated runs (at least 40 ms in the race, 6 ms in the scaling study). It is not CPU time;
  for CPU time use `npm run benchmark`.
- **Light mode only:** no dark-mode version of the five food colors passed a colorblind-safety check,
  so the page always uses its light theme. Every food type also has its own marker shape.
