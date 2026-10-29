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
  3) Quick benchmark + plots   (about 15 seconds)
  4) Full benchmark + plots    (about 2 minutes)
  5) Re-draw plots from saved results
  6) Run correctness tests
```

Or call commands directly (`run.bat <command>` on Windows, `./run.sh <command>` elsewhere):

| Command | What it does |
|---|---|
| `demo` | Live race window. Keys: SPACE pause, R restart, N new map, ←/→ step |
| `demo --n 12 --seed 3` | Race on a specific map (Held-Karp gets slow above n ≈ 16) |
| `demo --save results/race.gif --snapshot results/race_final.png` | Save the animation and a still image |
| `benchmark` / `benchmark --quick` | CPU-time benchmark (10 random instances per size) + all plots |
| `plots` | Re-draw the plots from `results/*.csv` without re-running |
| `test` | Correctness tests (Held-Karp is checked against brute force) |

Output goes to `results/`: `runtime_*.csv`, `plot_runtime_greedy.png`,
`plot_runtime_held_karp.png` (+ `_log`), `plot_quality_greedy_vs_optimal.png`, `plot_comparison.png`.

### Working on it in VS Code

1. **File → Open Folder…** and pick this folder. Accept the **Python** extension recommendation.
2. **Terminal → Run Task… → "Setup: create .venv + install requirements"** (once).
3. **Ctrl+Shift+P → "Python: Select Interpreter"** → choose the `.venv` one.
4. **Run and Debug** (Ctrl+Shift+D): pick *Race*, *Benchmark*, *Plots* or *Tests* and press **F5**.
   Tests also appear in the **Testing** (beaker) panel.

### Where things are

```
main.py                     start here (menu + commands)
raccoon/config.py           ALL the numbers: map, food types, greedy formula, benchmark sizes
raccoon/problem.py          the rules: freshness, scoring a route
raccoon/algorithms/
    greedy.py               straightforward algorithm  Θ(n²)       (pseudocode in the docstring)
    held_karp.py            clever algorithm           Θ(n²·2ⁿ)    (pseudocode + why it is correct)
    brute_force.py          checker only               Θ(n·n!)
raccoon/benchmark.py        CPU timing -> results/*.csv
raccoon/visuals/theme.py    ALL the looks: colors, shapes, sizes, animation speed
raccoon/visuals/animate.py  the race animation
raccoon/visuals/plots.py    the benchmark charts
assets/sprites/             drop PNGs here to replace shapes with pictures
tests/                      unit tests
```

The algorithm files have `[L1]`, `[L2]`… tags in the code that match the numbered pseudocode
lines, for the running-time analysis.
