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
