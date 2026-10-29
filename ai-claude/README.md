# COMP 422 - Algorithm Project

### *Anthony Constantinescu, George Rule, Josh Burick, Lucas Sanderson*

## Our Problem: *"The Greedy Raccoon"*

This is is a modified version of the traveling repairman problem, in which a path must be selected through a graph of varying-distance nodes such that the sum of the waiting times for each node is the smallest possible. The problem consists of a list of food items that each have an XY position on a fixed-size 2D plane, and a type. Each type (e.g. pizza, fish), has a caloric value and a decay rate. Once a food item is eaten, it’s gone. The goal of the raccoon is to travel a path that results in the maximum caloric intake with the least spoiled food. The score of a given path that the raccoon takes is determined by each food item as follows:

* The score is increased proportional to how much caloric value the item has.
* The score is decreased if the item is spoiled.

The path with the highest possible score wins. Assume for simplicity’s sake that the raccoon can travel in a straight line towards the desired food item, to avoid layering a spatial pathfinding algorithm on top of this problem.

## Our Solutions

We will implement two solution algorithms.

* ### Easy (Greedy Algorithm):
    At the starting position (and after consuming a food item), look at all remaining food items. Calculate an attractiveness for each item, something like:
    attractiveness = decay rate * (freshness upon arrival / calories).
    Then navigate to and consume the item with the highest attractiveness. This approach is based on “instant gratification” (however, with the decay rate multiplier causing the raccoon to prioritize items that won’t last much longer). This gives a baseline for our second algorithm to beat.

* ### Hard (Dynamic Programming):
    We will implement a “Modified TSP Dynamic Programming (Held-Karp)”. This would be much more complex to code but could result in a more optimal solution because dynamic programming can calculate an entire path ahead of time instead of taking decisions in the moment like our greedy algorithm.


## Viewing the Solutions

> *This section was written by Claude (AI). Everything the AI did is listed in
> [AI_CONTRIBUTIONS.md](AI_CONTRIBUTIONS.md).*

**Windows:** double-click **`run.bat`**.  **macOS / Linux:** run **`./run.sh`**.

The first run creates a private Python environment (`.venv`) and installs numpy and
matplotlib into it (needs Python 3.9+ and internet once). Then a menu opens:

```
  1) Watch the race: Greedy vs Held-Karp (window)
  2) Save the race as results/race.gif
  3) Quick benchmark + plots   (about 1 minute)
  4) Full benchmark + plots    (about 6 minutes)
  5) Speed-vs-quality study: which algorithm is "good enough"?
  6) Re-draw plots from saved results
  7) Run correctness tests
```

Or call commands directly (`run.bat <command>` on Windows, `./run.sh <command>` elsewhere):

| Command | What it does |
|---|---|
| `demo` | Live race window. Keys: SPACE pause, R restart, N new map, ←/→ step |
| `demo --n 12 --seed 3` | Race on a specific map (Held-Karp is left out above n = 16) |
| `demo --n 60 --algos greedy two_opt vnd` | Choose which algorithms race |
| `demo --save results/race.gif --snapshot results/race_final.png` | Save the animation and a still image |
| `benchmark` / `benchmark --quick` | CPU-time benchmark of every algorithm (10 random instances per size) + all plots |
| `benchmark --only greedy held_karp` | Just the original two |
| `tradeoff` / `tradeoff --quick` | Speed-vs-quality study and the "most satisficing" verdict |
| `plots` | Re-draw the plots from `results/*.csv` without re-running |
| `test` | Correctness tests (Held-Karp and the windowed DP are checked against brute force) |

**The race** has two phases. *Phase 1, planning:* each panel shows a bar for the CPU time
its algorithm needed to compute the route. All bars share one scale, and the slowest
algorithm fills 3.5 s of screen time. *Phase 2, walking:* all raccoons leave the den
together, and a chart tracks the calories each one has banked.

### The algorithms

| Key | Algorithm | Running time | Quality | Source |
|---|---|---|---|---|
| `hilbert` | Space-filling (Hilbert) curve order | Θ(n log n) | poor: ignores food | Platzman & Bartholdi 1989 |
| `greedy` | **Greedy** (our straightforward algorithm) | Θ(n²) | ok | Smith 1956 (ratio rule) |
| `greedy_kd` | Greedy with k-d trees: *same routes*, faster | O(n log² n) expected | = greedy | Bentley 1975, 1992 |
| `two_opt` | Greedy + 2-opt local search | ≈ n log² n + passes·n·L | good | Croes 1958; Silva et al. 2012 |
| `balas_simonetti` | Greedy + Balas–Simonetti windowed DP | ≈ n log² n + passes·n·k²·2ᵏ | good on small maps | Balas & Simonetti 2001 |
| `vnd` | Greedy + Variable Neighborhood Descent (2-opt ⇄ DP) | ≈ n log² n + rounds·n | best heuristic | Mladenović & Hansen 1997 |
| `held_karp` | **Held–Karp DP** (exact) | Θ(n²·2ⁿ) | optimal | Held & Karp 1962 |
| `brute_force` | Try every order (test checker) | Θ(n·n!) | optimal | – |

**"Most satisficing"** (Simon 1956): the study (`tradeoff`) runs every algorithm on maps with
n = 12, 100 and 1000 items. Pass marks are set in `raccoon/config.py`: at most 3% extra
spoilage compared with the best known route at every size, and at most 1 s per map at
n = 1000. The study recommends the fastest algorithm that meets both. If nothing does, it
relaxes the quality mark 1 point at a time and reports how far it had to go. Results:
`results/tradeoff_summary.md` and `results/plot_tradeoff_satisficing.png`.

Output in `results/`: `runtime_<algorithm>.csv` and `plot_runtime_<algorithm>.png` (scatter, average,
theory fit), `plot_runtime_held_karp_log.png`, `plot_quality_greedy_vs_optimal.png`,
`plot_comparison.png`, `tradeoff.csv`, `tradeoff_summary.md`, `plot_tradeoff_satisficing.png`.

### Working on it in VS Code

1. **File → Open Folder…** and pick this folder. Accept the **Python** extension recommendation.
2. **Terminal → Run Task… → "Setup: create .venv + install requirements"** (once).
3. **Ctrl+Shift+P → "Python: Select Interpreter"** → choose the `.venv` one.
4. **Run and Debug** (Ctrl+Shift+D): pick *Race*, *Benchmark*, *Trade-off*, *Plots* or *Tests* and
   press **F5**. Tests also appear in the **Testing** (beaker) panel.

### Where things are

```
main.py                       start here (menu + commands)
raccoon/config.py             ALL the numbers: map, food, race lineup, local-search knobs,
                              benchmark sizes, satisficing aspiration levels
raccoon/problem.py            the rules: freshness, scoring a route
raccoon/algorithms/           one file per algorithm, each with numbered pseudocode,
                              running-time analysis and sources in its docstring
raccoon/benchmark.py          CPU timing -> results/runtime_*.csv
raccoon/tradeoff.py           speed-vs-quality study + satisficing verdict
raccoon/race.py               one map, every algorithm, timed (feeds the animation)
raccoon/visuals/theme.py      ALL the looks: colors, shapes, sizes, phase lengths
raccoon/visuals/animate.py    the race animation
raccoon/visuals/plots.py      the charts
assets/sprites/               drop PNGs here to replace shapes with pictures
tests/                        unit tests
```

The algorithm files have `[L1]`, `[L2]`… tags in the code that match the numbered pseudocode
lines, for the running-time analysis.
