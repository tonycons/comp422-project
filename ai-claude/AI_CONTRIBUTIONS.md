<!-- AI-GENERATED (Claude, 2026-10-29): this log was written by the AI and should be kept up to date by the group. -->
# AI Contributions Log

The project spec encourages AI assistance; this file keeps track of exactly what
the AI did, so the group can see it and take ownership of every decision.

## Session 1 - 2026-10-29

| | |
|---|---|
| **AI tool** | Claude (Anthropic), model Claude Opus 5.5, via claude.ai |
| **Prompted by** | George Rule |
| **Git branch** | `claude/raccoon-algorithms` (one commit, marked `Co-Authored-By: Claude`) |
| **Inputs given** | `README.md` from this repo and the course `Project_Spec.docx` |

**Prompt (verbatim):**
> Set this project up for me on VSCode and implement the two algorithms in an easy to read way
> with comments and all and nice visuals that we can change or replace. This is a group project
> to make the AI contributions apparent and separate. Read the readme.

### How AI-written code is marked

1. Every file the AI created starts with an `AI-GENERATED FILE` banner.
2. All of it arrived in one separate commit on the branch above.
3. In `README.md` only the "Viewing the Solutions" section was replaced, and it is labeled.
4. **Please tag your own changes** to AI files with `# [EDIT: your name]` so it stays clear who wrote what.

### Files created by the AI

| File | What it is |
|---|---|
| `main.py` | Entry point: menu + `demo`, `benchmark`, `plots`, `test` commands |
| `raccoon/problem.py` | Food types, food items, instances, and the ONE route-scoring function |
| `raccoon/config.py` | Every tunable number (map, food types, greedy formula, benchmark sizes) |
| `raccoon/generator.py` | Reproducible random instances (seeded) |
| `raccoon/algorithms/greedy.py` | Straightforward algorithm, Θ(n²), numbered pseudocode in the docstring |
| `raccoon/algorithms/held_karp.py` | Clever algorithm, Θ(n²·2ⁿ), pseudocode + correctness argument in the docstring |
| `raccoon/algorithms/brute_force.py` | Reference only: Θ(n·n!) exhaustive search, used to *prove* Held-Karp is optimal in the tests |
| `raccoon/algorithms/__init__.py` | Registry so benchmark/plots/animation can look algorithms up by name |
| `raccoon/race.py` | Runs all algorithms on one map; JSON export for other front ends |
| `raccoon/benchmark.py` | CPU-time benchmark, ≥10 instances per size, writes `results/*.csv` |
| `raccoon/visuals/theme.py` | All colors, shapes, sizes, animation speed; sprite support |
| `raccoon/visuals/animate.py` | Side-by-side race animation (live window, GIF/MP4, PNG) |
| `raccoon/visuals/plots.py` | Spec plots: scatter + average line + theoretical fit, plus extras |
| `tests/test_algorithms.py` | 11 unit tests (built-in `unittest`, nothing to install) |
| `run.bat`, `run.sh` | One-step launchers (create `.venv`, install numpy+matplotlib, open menu) |
| `.vscode/*` | Run/debug configurations, tasks, settings, extension recommendation |
| `requirements.txt`, `.gitignore`, `.gitattributes`, `assets/sprites/README.md`, `results/.gitkeep` | Setup files |

### Decisions the AI made that the group should review

1. **Exact scoring rule** (`problem.py`). The README describes the score in words; the AI chose
   `score = calories × (1 − t / shelf_life)` per item, and the raccoon eats **every** item.
   Freshness below 0 = spoiled, and the score goes negative. *Why:* with this rule,
   maximizing the score is exactly the weighted Traveling Repairman / minimum-latency objective
   `minimize Σ wᵢ·tᵢ`, and that is what makes Held-Karp provably optimal. A threshold rule
   (e.g. a fixed penalty once spoiled) or letting the raccoon skip food would break the DP's
   optimal substructure; Held-Karp would then need extra state (e.g. elapsed time) per table entry.
2. **Greedy attractiveness** (`greedy.py`). The README's sketch,
   `decay rate × (freshness on arrival / calories)`, divides by calories, so it prefers
   *smaller* meals. All candidate formulas are implemented and selectable in `config.py`
   (`GREEDY_ATTRACTIVENESS`). The default is `ratio` = `decay rate × calories / travel time`
   (Smith's ratio rule). Measured against the optimal route on random maps with n = 8..12, the
   extra calories lost to spoilage were on average: ratio +13%, nearest-neighbor +17%,
   README-inspired "instant" +27%, README literal +186%.
3. **Held-Karp cost trick** (`held_karp.py`): charging each walking leg
   `travel_time × (total spoil weight of uneaten food)` instead of charging each item on
   arrival. This is what lets a table indexed by (set of eaten items, last item) work. Verified
   by the tests (the DP's cost equals the real spoilage on every test map).
4. **Food types and numbers** (`config.py`) are made up: fish 300 cal/150 s, blueberries
   90 cal/250 s, pizza 285 cal/350 s, apple 95 cal/600 s, donut 260 cal/900 s. Map 100×100 m,
   speed 1 m/s, den in the middle.
5. **Timing method** (`benchmark.py`): `time.process_time()` (CPU time, as the spec asks). Small
   instances are re-run until ≥ 0.2 s of CPU time has passed and averaged, because the Windows
   CPU clock only ticks about every 16 ms.
6. **Benchmark sizes**: Greedy n = 50..1000, Held-Karp n = 2..16 (n = 16 ≈ 0.65 s per run on
   the AI's test machine). The full benchmark took about 1.5 minutes there.

### Things to confirm with the team / professor

- **Spec fit.** The spec asks for a clever algorithm that *asymptotically outperforms* the
  straightforward one. Greedy (Θ(n²)) is much **faster** than Held-Karp (Θ(n²·2ⁿ)); Held-Karp
  wins on **solution quality** (always optimal; see `plot_quality_greedy_vs_optimal.png`). The spec
  says outperformance "can take many forms", but if the professor wants a running-time win, the
  textbook pairing is **Brute force Θ(n·n!) vs Held-Karp Θ(n²·2ⁿ)**. Brute force is already
  implemented: `python main.py benchmark --only brute_force held_karp`.
- The scoring rule and greedy formula above are the group's to own; change them in one place each.

### Sources mentioned in the code

The AI checked on 2026-10-29 that these publications exist with these details (title, venue,
pages, DOI). **Nobody has read them for this project yet.** The spec says AI is not a source,
so read the relevant parts yourselves before citing them in the report.

- M. Held, R. M. Karp. "A dynamic programming approach to sequencing problems."
  *J. SIAM* 10(1):196-210, 1962. doi:10.1137/0110015
- R. Bellman. "Dynamic programming treatment of the travelling salesman problem."
  *J. ACM* 9(1):61-63, 1962.
- A. Blum, P. Chalasani, D. Coppersmith, W. R. Pulleyblank, P. Raghavan, M. Sudan.
  "The minimum latency problem." *STOC 1994*, pp. 163-171. doi:10.1145/195058.195125
  (defines the traveling repairman / minimum latency objective)
- W. E. Smith. "Various optimizers for single-stage production."
  *Naval Research Logistics Quarterly* 3(1-2):59-66, 1956. doi:10.1002/nav.3800030106
  (the ratio rule used by the default greedy formula)

### Not done by the AI

The written report summary, the slides, and the oral presentation. The group still needs to
understand and explain every part of this code, as the spec says.

---

## Session 2 - 2026-10-29 (same day, same branch)

| | |
|---|---|
| **AI tool** | Claude (Anthropic), model Claude Opus 5.5, via claude.ai |
| **Prompted by** | George Rule |
| **Git branch** | `claude/raccoon-algorithms` (second commit, marked `Co-Authored-By: Claude`) |

**Prompts (verbatim):**
> Are you sure that Held-Karp is slower and not just implemented suboptimally with recursion or something

> Consider several different algorithms and optimizations you could try that would run faster than
> greedy and be a clever soln

> Expand the project to show that same animation you made but with several options that balance
> speed and better food that are all well documented algorithms and try to find the one that is the
> most satisficing

> In the gif show the initial setup run time visually as well before the dot starts to travel

### What was added

| File | What it is |
|---|---|
| `raccoon/algorithms/hilbert.py` | Hilbert space-filling-curve order, Θ(n log n) |
| `raccoon/algorithms/greedy_kd.py` | Greedy with one k-d tree per food type: **identical routes** to `greedy.py`, O(n log² n) expected |
| `raccoon/algorithms/two_opt.py` | Greedy + 2-opt local search with O(1) move evaluation for the spoilage cost |
| `raccoon/algorithms/balas_simonetti.py` | Greedy + Balas–Simonetti restricted DP (linear in n for a fixed window k) |
| `raccoon/algorithms/vnd.py` | Greedy + Variable Neighborhood Descent (alternates 2-opt and the DP) |
| `raccoon/tradeoff.py` | Speed-vs-quality study and the satisficing verdict |
| `tests/test_more_algorithms.py` | 9 more tests (k-d tree = linear scan, greedy_kd = greedy, DP = brute force, ...) |
| `raccoon/visuals/animate.py` | Rewritten: any number of panels, plus the **planning phase** (CPU-time bars) |
| `raccoon/visuals/plots.py` | New chart: `plot_tradeoff_satisficing.png`; comparison chart covers all algorithms |
| `config.py`, `theme.py`, `race.py`, `benchmark.py`, `main.py`, `README.md`, `.vscode/launch.json` | Updated for the above |

### Answer to "is Held-Karp just implemented badly?"
No. It is iterative (no recursion) and fills each of the 2ⁿ·n table cells once. Its Θ(n²·2ⁿ) cost comes
from the number of subsets, and the measured times match that curve (R² ≈ 0.98, ×2.36 per extra
item from n = 15 to 16 vs. ×2.28 predicted). The problem is NP-hard, so every known exact algorithm
takes exponential time. Anything faster than Greedy has to be a heuristic.

### Decisions the AI made that the group should review

1. **Which algorithms.** Chosen because each has a well-known published source and they cover the
   whole speed/quality range. All sources were checked to exist with the stated title, venue,
   pages and DOI on 2026-10-29. **Nobody has read them for this project yet.**
2. **Adapting TSP methods to our cost.** Our objective is a weighted sum of waiting times, not a
   tour length, so 2-opt cannot use the usual "two edges change" shortcut. It uses running totals
   (duration, weight, cost of a stretch) instead, the technique used for the Minimum Latency Problem.
   The Balas–Simonetti DP uses the same "charge each walk to the uneaten food" trick as Held-Karp.
3. **Simplification:** Balas & Simonetti's own heuristic contracts arcs between passes. Ours just
   re-runs the DP on the improved route.
4. **Parameters** (`config.py`): 2-opt stretch limit L = 50, DP window k = 6, VND uses L = 50 and k = 5,
   at most 20 passes. Chosen from a small tuning run (k = 8 is near-optimal on small maps but about
   9× slower at n = 1000).
5. **Satisficing rule** (`config.py`): average extra spoilage ≤ 3% compared with the best known route,
   at **every** size (12, 100, 1000), and ≤ 1 s per map at n = 1000. Recommend the **fastest**
   algorithm that meets both. If none does, relax the 3% bar one point at a time (Simon's aspiration
   adaptation). These numbers are a choice, so own them or change them.
6. **Planning-phase display:** bar length = CPU time on a shared linear scale (the slowest algorithm
   fills 3.5 s on screen). `PLANNING_SCALE = "log"` in `theme.py` makes the tiny bars visible instead.

### Result on the AI's test machine (re-run `python main.py tradeoff` on yours)

- No algorithm met the 3% bar at every size. With the bar relaxed to **4%**, the most satisficing is
  **Greedy + VND (2-opt ⇄ DP)**: 3.8% extra at n = 12, ~0% at n = 100 and n = 1000 (it found the best
  known route), about 0.6 s at n = 1000.
- Runner-up: **Greedy + 2-opt**. It would qualify at a 6.4% bar and is about 2.3× faster
  (0.26 s at n = 1000).
- Greedy with k-d trees produces exactly Greedy's routes about 5× faster at n = 1000 (31 ms vs. 153 ms).
  At n = 12 it is slower, because building the trees costs more than it saves.
- The Hilbert curve is the fastest by far but lets about 40% more calories spoil, because it ignores food.
- Runtime fits (full benchmark, about 6 minutes): Held-Karp R² 0.99, Greedy k-d 0.98, Greedy 0.97,
  Hilbert 0.96, 2-opt 0.94. The DP-based local searches are noisier (VND 0.86, Balas–Simonetti 0.83)
  because the number of improvement passes changes from map to map. Report that honestly rather than
  as a clean theoretical curve.
- **For the spec's "clever must asymptotically beat straightforward" rule,** Greedy (Θ(n²)) vs.
  Greedy with k-d trees (O(n log² n) expected) is a clean pair: same output, provably faster on
  average. Brute force vs. Held-Karp is the other clean pair.

### New sources mentioned in the code (verified to exist; read before citing)

- L. K. Platzman, J. J. Bartholdi III. "Spacefilling curves and the planar travelling salesman
  problem." *J. ACM* 36(4):719-737, 1989.
- J. L. Bentley. "Multidimensional binary search trees used for associative searching."
  *Communications of the ACM* 18(9):509-517, 1975. doi:10.1145/361002.361007
- J. L. Bentley. "Fast algorithms for geometric traveling salesman problems."
  *ORSA Journal on Computing* 4(4):387-411, 1992. doi:10.1287/ijoc.4.4.387
- G. A. Croes. "A method for solving traveling-salesman problems."
  *Operations Research* 6(6):791-812, 1958. doi:10.1287/opre.6.6.791
- E. Balas, N. Simonetti. "Linear time dynamic-programming algorithms for new classes of restricted
  TSPs: a computational study." *INFORMS J. Computing* 13(1):56-75, 2001. doi:10.1287/ijoc.13.1.56.9748
- N. Mladenović, P. Hansen. "Variable neighborhood search." *Computers & Operations Research*
  24(11):1097-1100, 1997. doi:10.1016/S0305-0548(97)00031-2
- M. M. Silva, A. Subramanian, T. Vidal, L. S. Ochi. "A simple and effective metaheuristic for the
  Minimum Latency Problem." *European J. Operational Research* 221(3):513-520, 2012.
  doi:10.1016/j.ejor.2012.03.044
- H. A. Simon. "Rational choice and the structure of the environment." *Psychological Review*
  63(2):129-138, 1956. doi:10.1037/h0042769

## Session 3 - 2026-11-03: web demo (`demo/`)

| | |
|---|---|
| **AI tool** | Claude (Anthropic), model Claude Opus 5.5, via Claude Code in VS Code |
| **Prompted by** | git user `tonycons` (fill in the group member's name) |
| **Git branch** | not committed by the AI; everything new is under `demo/` plus this log entry and one README line |

**Prompts (verbatim):**
> In this project, under the ai-claude subfolder, is an implementation of some algorithms for solving a
> puzzle (see README for description). I'd like you to turn this into a website rather than a CLI program,
> but these were written in Python. Is a total rewrite in typescript the way to go, or a flask server that
> preserves the Python logic, or something else? Let me know what you would prefer to go with before
> implementing anything

> My goal is to host the site on my Cloudflare pages. No preference between plain typescript and React,
> unless there is sufficient complexity that calls for React. Now that I think about it, I want to leave
> out held-karp. I only need two algorithms to be showcased for the assignment, a straightforward and
> clever algorithm. I'd choose the straightforward as the naive "Greedy" algorithm, and the clever as the
> Hilbert curve algorithm (which is significantly more accurate and has better time complexity). If this
> is a good choice, then is a re-implementation in typescript better than the complications of running a
> python backend?

> By accuracy I meant score rather. The graphs show hilbert leads to more calories

> Let's do greedy + 2-opt. Could you create the site in a "demo" subdirectory

### What was added

| Path | What it is |
|---|---|
| `demo/src/core/*.ts` | TypeScript port of `problem.py`, `generator.py`, `greedy.py` (ratio formula only), `greedy_kd.py`, `two_opt.py`, `race.py` |
| `demo/src/ui/*.ts`, `demo/src/main.ts`, `demo/index.html`, `demo/src/style.css` | The page: two map panels, planning replay, walking animation, score chart, results tables, pseudocode |
| `demo/tests/parity.test.ts` + `demo/scripts/export_fixtures.py` | Checks that the TypeScript makes **exactly** the Python's decisions (13 maps, n = 1 to 500; all pass) |
| `demo/tests/algorithms.test.ts` | k-d Greedy = naive Greedy, 2-opt never worse than Greedy, recorded flips replay to the final route |
| `demo/README.md` | Run, test, and deploy to Cloudflare Pages |

### Decisions the AI made that the group should review

1. **TypeScript port instead of Flask/Pyodide.** With only two algorithms the port is small (~500 lines).
   A static site needs no server on Cloudflare Pages, and the parity test catches the two versions drifting apart.
2. **Hilbert was advised against as the "clever" algorithm.** Measured scores: on random maps Hilbert
   scored higher than Greedy on 18% of maps at n = 14, 8% at n = 30 and 0% at n = 100. The default demo map
   (seed 48, n = 14) happens to be one where Hilbert wins, which is probably why it looked better.
3. **The 2-opt complexity string is corrected on the site.** The Python registry's
   `"O(n log² n + P·n·L)"` leaves out the Θ(n) recompute after every accepted flip (`two_opt.py` line [L8]).
   Measured accepted flips M ≈ 0.3·n (n = 250 to 4,000), so 2-opt is about Θ(n²) in practice, the same order as
   Greedy. **If the spec requires the clever algorithm to asymptotically beat the straightforward one, Greedy
   + 2-opt only wins on score.** Greedy vs. Greedy (k-d tree) is still the clean asymptotic pair (see Session 2).
4. **Different random maps than Python** (mulberry32 instead of Mersenne Twister), so seeds don't carry
   over between the CLI and the site. The algorithms are identical.
5. **Light mode only.** No dark-mode set of the five food colors passed the colorblind-safety validator,
   and every food type also has a distinct marker shape.
6. **Browser timing is wall-clock** (`performance.now()`, repeated for at least 40 ms), not CPU time.

---

## Session 4 - 2026-11-03: spoiled food = 0 calories, cleanup

| | |
|---|---|
| **AI tool** | Claude (Anthropic), model Claude Opus 5.5, via claude.ai (working in a copy of the repo; files written back into George's local `team-repo`) |
| **Prompted by** | George Rule |
| **Git** | not committed by the AI; review the changes in VS Code's Source Control panel, then commit |

**Prompt (verbatim):**
> Take a look at the current state of the team-repo in vscode and clean up the code, add comments, and
> make it so that the racoon when it visits a spoiled node, gets 0 calories instead of negative calories.

### The rule change and what it forced

`score(t) = calories × max(0, 1 − t/shelf_life)`: spoiled food is worth 0, never negative. Each item's
loss is now `w·min(t, shelf_life)`, which stops growing at the shelf life. That breaks the "every item
costs exactly w·t" property that three algorithms relied on, so they were changed to stay correct:

| Algorithm | Before | Now |
|---|---|---|
| Held-Karp (`held_karp.py`) | one number per (S, j) cell | each cell keeps a short **Pareto front** of (time, loss) labels (`pareto.py`). Still **exact**: matches brute force on 120 random maps (n = 1..8) |
| Balas–Simonetti (`balas_simonetti.py`) | one number per state | same Pareto labels. Still exact inside its window: matches brute force (112 cases), and equals Held-Karp when k = n |
| 2-opt (`two_opt.py`, `demo/src/core/twoOpt.ts`) | exact O(1) move check | O(1) **estimate** (spoiled items count as losing nothing), then an exact Θ(n) **confirmation** before a flip is kept, so a flip never makes a route worse |
| Greedy, Greedy k-d (`greedy.py`, `greedy_kd.py`, `greedy.ts`, `kdtree.ts`) | rotten food still "urgent" | food that will already be spoiled on arrival is ranked below all fresh food (nearest rotten item first). The k-d version still gives identical routes (the argument is in its docstring) |

The pruning rule that keeps the DP lists short: a later-but-cheaper label wins if
`loss_A + (time_A − time_B) · W_live(time_B) ≤ loss_B`, where `W_live` = spoil weight of the remaining
food that is still fresh (proof in `pareto.py`). Under the old negative rule it would collapse every
list to one entry, which is ordinary Held-Karp.

**Cost of exactness:** Held-Karp now takes about 1.3 s at n = 14 and 7 s at n = 16 (was 0.65 s at n = 16).
The benchmark now runs it for n = 2..15, and the full benchmark takes about 9 minutes (was 6). Its bound is O(n²·2ⁿ·F), where F = the longest list in a cell
(it reaches about 20 at n = 16).

### Cleanup

- **`demo/` path bug:** the web demo was written as `ai-claude/demo` but committed at the repo root.
  `scripts/export_fixtures.py` could not find `raccoon`, the README commands said `cd ai-claude/demo`,
  the Cloudflare root directory was `ai-claude/demo`, and every file header pointed to a missing
  `AI_CONTRIBUTIONS.md`. All fixed for `demo/` at the root. **If Cloudflare Pages is already set up,
  check that its Root directory is `demo`.**
- **Spoiled counting bug:** the Python animation and the website counted "spoiled" as "score < 0", which
  would always be 0 under the new rule. Both now ask `is_spoiled_at` / `isSpoiledAt`.
- 2-opt complexity corrected in both languages to `O(n log² n + P·n·L + V·n)` (V = moves checked exactly).
- Unused imports removed. Docstrings, the README table, the website's "How it works" text and config
  comments updated for the new rule. The greedy-formula percentages in `config.py` were re-measured.
- Parity fixtures regenerated. Checks run in the AI's sandbox: **23 Python tests pass**, **47 demo
  tests pass**, and **`tsc` strict type-check passes**. The demo tests were run with Node 22 and a small
  vitest stand-in, because npm packages could not be downloaded there, so run `npm test` once yourselves.

### New results (AI's machine; re-run `python main.py tradeoff` on yours)

| Algorithm | Extra spoilage vs best, n = 12 / 100 / 1000 | Time at n = 1000 |
|---|---|---|
| Hilbert curve | 27.2% / 7.0% / 3.4% | 6 ms |
| Greedy | 21.4% / 2.5% / 1.0% | 194 ms |
| Greedy (k-d tree) | same routes as Greedy | 38 ms |
| **Greedy + 2-opt** | **12.4% / 0.2% / 0.1%** | **183 ms** |
| Greedy + Balas–Simonetti | 1.3% / 0.2% / 0.2% | 2.89 s |
| Greedy + VND | 3.6% / 0.1% / 0.0% | 1.22 s |
| Held-Karp | 0% (optimal) at n = 12, 203 ms | too slow |

- **Most satisficing is now Greedy + 2-opt.** It's the only algorithm under the 1 s limit at n = 1000
  that passes once the quality bar is relaxed (to 13%). That's the pair the website already showcases.
  The DP-based searches got slower with the new rule and now miss the speed limit.
- Differences between algorithms shrink on big maps: at n = 1000 most food spoils whatever the order,
  and spoiled food no longer costs extra. The small maps are where the algorithms really differ.
- With the new rule, the README-inspired "instant" greedy formula does slightly better than the default
  "ratio" one (8% vs. 10% extra spoilage at n = 8..12). The default was left alone, because changing it
  changes Greedy's routes everywhere, including on the website.
- **The top-level `README.md` (the group's own text) still says "The score is decreased if the item is
  spoiled."** It was not edited by the AI, so update it to match the new rule.

---

## Session 5 - 2026-11-12: website switched to Greedy vs. Held-Karp

Requested by George Rule: "switch back to Held-Karp and Greedy, code that up and make sure the site
has good visualizations that show how Held-Karp is asymptotically better in either calories saved or
something. Use the well known published solutions/pseudocode."

Follow-up the same day: "remove brute force, we just need greedy and held karp, also make sure to
comment and cite in the code." Brute force was removed from the website (code, charts, tests,
fixtures), and every algorithm file now has a References block with DOIs.

The Python algorithms were **not** changed in behavior. Only a Sources section was added to the
`pareto.py` docstring. `ai-claude/raccoon/algorithms/brute_force.py` is still there: the Python tests
use it to prove Held-Karp is optimal, and it is not part of the website. Everything else is in `demo/`.

### What was added or changed in `demo/`

- `src/core/heldKarp.ts`, `src/core/pareto.ts`: TypeScript port of the Python Held-Karp (with its
  (time, loss) labels). Same order of operations as the Python, so it picks **identical routes**; the
  parity tests check order, score and label count F.
- `src/core/scaling.ts`: the "How they scale" study. 20 fixed-seed maps per size n = 2..14 (10 timed),
  Greedy also timed on n = 100..1,500, and least-squares fits of `a·f(n) + b` for each Θ bound.
- `src/ui/scatterChart.ts`, `src/ui/workView.ts`: the scaling charts, and the strip under each race map
  (Greedy's n(n+1)/2 comparisons vs. Held-Karp's 2ⁿ table rows).
- `src/ui/mapView.ts`: while Held-Karp plans, its map shows the cheapest partial route found so far
  for the set of items being filled in (read from the finished table, so it never changes the answer).
- `index.html`, `src/main.ts`, `src/style.css`: race panels for Greedy and Held-Karp (n = 2..16), the new
  "How they scale" section, and Held-Karp pseudocode in the published recurrence's form.
- Removed from the site: `src/core/twoOpt.ts`, `src/core/kdtree.ts` and the 2-opt settings in
  `src/core/config.ts`. (The Python 2-opt in `ai-claude/` is untouched.)
- Tests and fixtures: `scripts/export_fixtures.py` now exports Greedy and Held-Karp (n <= 14) routes.
  New tests: Held-Karp never beaten by random orders, cell counts (n·2ⁿ⁻¹, s·C(n, s) per set size),
  snapshot validity, trendline-fit recovery.
- Citations: `greedy.ts` (Rosenkrantz, Stearns & Lewis 1977; Smith 1956), `heldKarp.ts` (Held & Karp
  1962; Bellman 1962; Dumas et al. 1995; Blum et al. 1994), `pareto.ts` (Dumas et al. 1995; Rule 2
  marked as our own), `problem.ts` (Blum et al. 1994), and the page's reference list. Lines the AI
  added to the team-edited `greedy.ts` are tagged `[EDIT: Claude]`.

### What the charts show (AI's sandbox, Node 22; your browser will differ on times, not on calories)

The calorie numbers depend only on the fixed maps, so every browser shows exactly these:

| n | Held-Karp's lead over Greedy (mean of 20 maps) | Share of all the food | Maps where Greedy was optimal |
|---|---|---|---|
| 2 | 1.6 cal | 0.4% | 95% |
| 8 | 35 cal | 2.1% | 30% |
| 14 | 191 cal | 6.6% | 0% |

- Planning time: Greedy is always faster; Held-Karp doubles (and a bit) with every extra item.
- Fits: R² ≈ 0.99 for Greedy (n²) and Held-Karp (n²·2ⁿ).

### Decisions the AI made that the group should review

- **What "asymptotically better" means here.** Held-Karp is *not* faster than Greedy: Θ(n²·2ⁿ) vs. Θ(n²).
  The site argues it on quality: Greedy's calorie shortfall grows with n and its chance of being
  optimal drops to 0. Be ready to explain this in the Q&A; the project spec asks for the clever
  algorithm to "asymptotically outperform" the straightforward one, so consider checking this framing
  with the professor.
- **Held-Karp's labels.** The published Held-Karp keeps one number per cell. Because spoiled food stops
  losing calories, our cell keeps a short list of (time, loss) labels, the two-dimensional labeling of
  Dumas et al. (1995) for TSP with time windows. Rule 2 in `pareto.ts` (a later label can still win if it
  is cheap enough) is the AI's own addition, not from a paper; it keeps the lists about 40% shorter.
  Both rules are exact (the Python tests check the DP against an exhaustive search).
- Timing in the scaling section pauses the race animation while it runs, and starts automatically
  when the section scrolls into view (about 10 seconds).

### Sources added (verified to exist)

- M. Held and R. M. Karp, "A dynamic programming approach to sequencing problems", J. SIAM 10(1):196–210,
  1962. doi:10.1137/0110015
- R. Bellman, "Dynamic programming treatment of the travelling salesman problem", J. ACM 9(1):61–63, 1962.
  doi:10.1145/321105.321111
- Y. Dumas, J. Desrosiers, E. Gelinas, M. M. Solomon, "An optimal algorithm for the traveling salesman
  problem with time windows", Operations Research 43(2):367–371, 1995. doi:10.1287/opre.43.2.367
- D. J. Rosenkrantz, R. E. Stearns, P. M. Lewis II, "An analysis of several heuristics for the traveling
  salesman problem", SIAM J. Computing 6(3):563–581, 1977. doi:10.1137/0206041

### Checks run in the AI's sandbox

`tsc` strict type-check passes; all demo tests pass (Node 22 with a small vitest stand-in, because npm
packages could not be downloaded there); the page was bundled and checked in Chromium with no console
errors. **Run `npm install` and `npm test` once yourselves.**

## Session 6 - 2026-11-13: citations for the exact DP (traveling repairman sources)

| | |
|---|---|
| **AI tool** | Claude (Anthropic), model Claude Fable 5.2, via Claude Code in VS Code |
| **Prompted by** | git user `tonycons` (fill in the group member's name) |
| **Git branch** | not committed by the AI |
| **Inputs given** | the four PDFs in `scientific_sources/` (named `toa_sources/` at the time; the AI read all four) |

**Prompts (verbatim):**
> We have a problem where our held-karp implementation for this problem (which is an instance of TRP)
> isn't exactly supported by any sources. Held-karp is meant for TSP. Now I have some scientific sources
> in the toa_sources folder where there may be an implementation of the DP algorithm that we have in our
> project. I want you to read these sources, propose a new name instead of "modified Held-Karp", and
> write some citations we can use to support our algorithm.

> Yes, update the citations in the project

### What changed (comments, page text and one README cell only; no code logic)

- `demo/src/core/heldKarp.ts`, `pareto.ts`, `problem.ts`, `scaling.ts`, `demo/index.html`,
  `raccoon/algorithms/held_karp.py`, `pareto.py`, `raccoon/problem.py`, `README.md` (algorithm table).
- Dumas et al. (1995) was removed as the source of the label lists (it is not in `scientific_sources/` and is a
  TSP-with-time-windows paper). Earlier sessions of this log still mention it; they are left as history.
- The algorithm is still called Held-Karp everywhere. The AI proposed "Subset dynamic programming with
  label dominance" as a replacement name; the group has not applied it.

### What each source supports (page numbers are the journal's)

- **Wu, Huang & Zhan (2004)**, Section 3.1, p. 304-305: O(n^2 * 2^n) dynamic program for the minimum latency
  (traveling repairman) problem over "configurations" (visited set, last vertex). This is our table.
- **Roberti & Mingozzi (2014)**, Section 2, p. 415 and Section 5, p. 420: the same recursion F(S, i) for the
  delivery man problem, and an exact method using "standard dominance rules".
- **Tsitsiklis (1992)**, p. 275 and Section VIII, p. 277-279: forward DP over states (i, S) that propagates labels
  and keeps track of both time and waiting time. This supports a label LIST per cell.
- **Pei et al. (2020)**, Section 2.1, p. 109-110: the Traveling Repairman Problem with Profits (profit p - t if
  p > t, else 0). It supports the problem definition only; the paper is about heuristics.

### Things the group should know before citing

- **Not in any source:** dominance Rule 2, the per-item weights, the O(n^2 * 2^n * F) bound, and the
  argument that "must eat everything" has the same optimum as "may skip nodes". Present these as your own.
- The Tsitsiklis DOI (10.1002/net.3230220305) was written from the AI's memory; it is not printed in the
  PDF. Check it. The other three DOIs are printed in the PDFs.

### Sources added

- B. Y. Wu, Z.-N. Huang, F.-J. Zhan, "Exact algorithms for the minimum latency problem", Information
  Processing Letters 92(6):303-309, 2004. doi:10.1016/j.ipl.2004.09.009
- R. Roberti, A. Mingozzi, "Dynamic ng-path relaxation for the delivery man problem", Transportation
  Science 48(3):413-424, 2014. doi:10.1287/trsc.2013.0474
- J. N. Tsitsiklis, "Special cases of traveling salesman and repairman problems with time windows",
  Networks 22(3):263-282, 1992. doi:10.1002/net.3230220305
- J. Pei, N. Mladenović, D. Urošević, J. Brimberg, X. Liu, "Solving the traveling repairman problem with
  profits: A novel variable neighborhood search approach", Information Sciences 507:108-123, 2020.
  doi:10.1016/j.ins.2019.08.017

### Follow-up (same session): files renamed

> Rename the held karp files to subset DP

- `raccoon/algorithms/held_karp.py` -> `raccoon/algorithms/subset_dp.py` and
  `demo/src/core/heldKarp.ts` -> `demo/src/core/subsetDp.ts` (with `git mv`), plus every import and
  file-name mention outside this log. Earlier entries above keep the old file names as history.
- Unchanged on purpose: the algorithm key `"held_karp"` (config, CSV names, fixtures, CLI
  `--only held_karp`, page element ids), the display name "Held-Karp", and the type names
  `HeldKarpResult` / `HeldKarpStats`.


### Follow-up (same session): everything renamed to Subset DP

> Yes. Everything named held karp, rename to Subset DP

- Renamed across the Python package, the website, tests, docs and VS Code launch configs: the algorithm key
  `held_karp` -> `subset_dp` (config, registry, CLI `--only subset_dp`, page element ids, CSS variables,
  fixture JSON), display name -> "Subset DP", `HELD_KARP_MAX_N` -> `SUBSET_DP_MAX_N`, types
  `HeldKarpResult`/`HeldKarpStats` -> `SubsetDpResult`/`SubsetDpStats`, `race.heldKarp` -> `race.subsetDp`,
  pseudocode title `SUBSET-DP-RACCOON`, and the `hk` abbreviations (`hkMs`, `HK_MAX_N`, test variables).
- Kept on purpose: citations of M. Held and R. M. Karp (1962), sentences that describe their original TSP
  algorithm (reworded to "the table of Held & Karp (1962)"), the dated "Updated 2026-11-12" lines in file
  headers, and this log's earlier entries and verbatim prompts (history).
- Any old `results/*held_karp*` CSV or PNG files from earlier benchmark runs will no longer be read; re-run
  `python main.py benchmark` to regenerate them under the new name.
