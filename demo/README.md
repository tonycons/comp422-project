<!-- AI-GENERATED (Claude, 2026-11-03) - see ../ai-claude/AI_CONTRIBUTIONS.md -->
# The Greedy Raccoon: web demo

A static website that races the two showcased algorithms on the same random map:

| | Algorithm | Time | Source it was ported from |
|---|---|---|---|
| Straightforward | **Greedy** (Smith's ratio rule) | Θ(n²) | `raccoon/algorithms/greedy.py` |
| Clever | **Greedy + 2-opt** (k-d tree Greedy, then 2-opt flips) | O(n log² n + P·n·L + V·n) | `raccoon/algorithms/greedy_kd.py`, `two_opt.py` |

It is plain TypeScript + [Vite](https://vite.dev), with no framework and no server. Everything runs in the browser.

## Run it locally

Needs Node 20.19+ (22 recommended).

```bash
cd demo
npm install
npm run dev        # http://localhost:5173, live reload
npm test           # TypeScript must match the Python routes exactly
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

## Keeping it in sync with the Python

The algorithms exist twice: Python (the graded implementation, benchmarks, tests) and TypeScript
(this site). `tests/parity.test.ts` checks that both produce **identical routes**
on 13 maps from n = 1 to n = 500, and that `src/core/config.ts` matches `raccoon/config.py`.

If you change `ai-claude/raccoon/problem.py`, `config.py`, `greedy.py`, `greedy_kd.py` or `two_opt.py`:

```bash
cd demo
npm run fixtures   # re-runs the Python and rewrites tests/fixtures/python_routes.json
                   # (on Windows, if "python3" is not found: python scripts/export_fixtures.py)
npm test           # fails if the TypeScript now disagrees, so port the change to src/core/
```

## Where things are

| Path | What it is |
|---|---|
| `src/core/` | The algorithms and scoring, one file per Python module (same `[Lx]` pseudocode tags) |
| `src/core/race.ts` | Builds a map, solves and times both algorithms |
| `src/ui/mapView.ts` | One algorithm's map: planning replay + walking animation |
| `src/ui/timeline.ts` | "Calories banked over time" chart (hover / ← → for values) |
| `src/ui/theme.ts` | Colors, food shapes, animation timing |
| `src/main.ts` | Page controller: controls, animation clock, results tables |
| `scripts/export_fixtures.py` | Exports Python routes for the parity test |

## Differences from the Python demo (on purpose)

- **Maps:** the site uses a different seeded random number generator (mulberry32) than Python's,
  so seed 48 here is not the same map as `python main.py demo --seed 48`. Algorithms and scoring are identical.
- **Timing:** browsers only expose wall-clock time, so "planning time" is wall-clock, averaged over
  repeated runs for at least 40 ms. Expect different numbers from the Python CPU-time benchmark.
- **Light mode only:** no dark-mode version of the five food colors passed a colorblind-safety check,
  so the page always uses its light theme. Every food type also has its own marker shape.
