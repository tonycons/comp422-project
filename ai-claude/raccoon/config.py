# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
ALL THE KNOBS IN ONE PLACE.

Change numbers here, not inside the algorithms. Every setting has a comment
saying what it does. (Colors, sizes and other LOOKS live in
raccoon/visuals/theme.py instead.)
"""
from __future__ import annotations

from pathlib import Path

from .problem import FoodType

# -----------------------------------------------------------------------------
# The world
# -----------------------------------------------------------------------------
MAP_WIDTH = 100.0             # map width in meters
MAP_HEIGHT = 100.0            # map height in meters
DEN_POSITION = (50.0, 50.0)   # where the raccoon starts (x, y) - the middle of the map
RACCOON_SPEED = 1.0           # meters per second (a casual raccoon waddle)

# The kinds of food that can appear. Each random item picks one of these
# uniformly at random.
#   calories   = value when perfectly fresh
#   shelf_life = seconds until it is fully spoiled (freshness hits 0)
# A short shelf life = "eat me first!".  Add, remove, or retune freely; if you
# add a new name, also give it a color/marker in visuals/theme.py.
FOOD_TYPES = [
    FoodType("fish",        calories=300, shelf_life=150),   # very tasty, spoils very fast
    FoodType("blueberries", calories=90,  shelf_life=250),   # small snack, spoils fairly fast
    FoodType("pizza",       calories=285, shelf_life=350),   # the classic
    FoodType("apple",       calories=95,  shelf_life=600),   # keeps for a while
    FoodType("donut",       calories=260, shelf_life=900),   # basically immortal
]

# -----------------------------------------------------------------------------
# Greedy algorithm
# -----------------------------------------------------------------------------
# Which "attractiveness" formula the greedy raccoon uses to pick its next meal.
# The formulas themselves are in raccoon/algorithms/greedy.py.
#   "ratio"   - (default) decay_rate * calories / travel_time  (Smith's ratio rule)
#               = "calories this item loses per second, per second of walking"
#   "instant" - README-inspired: decay_rate * calories_on_arrival / travel_time
#   "readme"  - the formula sketched in our README, taken literally:
#               decay_rate * freshness_on_arrival / calories
#   "nearest" - plain nearest-neighbor (ignores food entirely), a sanity baseline
# Measured against the optimal (Held-Karp) route on random maps with n = 8..12,
# the extra calories lost to spoilage were on average about:
#   ratio +13%,  nearest +17%,  instant +27%,  readme +186%
GREEDY_ATTRACTIVENESS = "ratio"

# -----------------------------------------------------------------------------
# Demo / animation
# -----------------------------------------------------------------------------
DEMO_N = 10        # number of food items in the demo race (Held-Karp gets slow above ~16)
DEMO_SEED = 48     # random seed for the demo map; change it to get a different map

# -----------------------------------------------------------------------------
# Benchmarking (the spec requires >= 10 random instances per size)
# -----------------------------------------------------------------------------
INSTANCES_PER_SIZE = 10
BASE_SEED = 422    # instance k of size n uses seed  BASE_SEED + 1000 * n + k  (reproducible)

# Instance sizes (n = number of food items) to benchmark, per algorithm.
# Held-Karp is exponential, so it gets small sizes; greedy gets big ones.
BENCHMARK_SIZES = {
    "greedy":      list(range(50, 1001, 50)),   # 50, 100, ..., 1000
    "held_karp":   list(range(2, 17)),          # 2 .. 16  (n = 16 takes ~1 s per run)
    "brute_force": list(range(2, 10)),          # 2 .. 9 (only if you ask for it)
}
QUICK_BENCHMARK_SIZES = {                       # used by  --quick  (about 15 seconds)
    "greedy":      list(range(50, 501, 50)),
    "held_karp":   list(range(2, 13)),
    "brute_force": list(range(2, 9)),
}

# CPU-time measurement. A single tiny run is shorter than the timer resolution
# (about 16 ms on Windows!), so each instance is re-run until at least this much
# CPU time has passed, and we record the average time of one run.
MIN_TIMED_SECONDS = 0.2
QUICK_MIN_TIMED_SECONDS = 0.05

# Where CSVs, plots and GIFs are written.
RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"
