# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
STRAIGHTFORWARD ALGORITHM: Greedy ("instant gratification")
===========================================================

Idea (from our README): standing where it is, the raccoon scores every food
item it hasn't eaten yet with an ATTRACTIVENESS number, walks to the most
attractive one, eats it, and repeats. It never looks more than one step ahead,
so it is fast but not always optimal.

Pseudocode (the [Lx] tags in the code below point back to these lines)
----------
    GREEDY-RACCOON(items, den, speed)
     1  here <- den;  clock <- 0
     2  remaining <- all n items;  route <- empty list
     3  while remaining is not empty
     4      best <- NIL;  best_value <- -infinity
     5      for each item j in remaining
     6          travel <- distance(here, j) / speed
     7          value  <- ATTRACTIVENESS(j, travel, clock + travel)
     8          if value > best_value
     9              best <- j;  best_value <- value;  best_travel <- travel
    10      clock <- clock + best_travel;  here <- position of best
    11      remove best from remaining;  append best to route
    12  return route

Running time:  Theta(n^2)
    The while loop (line 3) runs n times, once per item eaten. The for loop
    (line 5) runs over the remaining items: n, then n-1, ..., then 1 times,
    so lines 6-9 execute n + (n-1) + ... + 1 = n(n+1)/2 times. Each execution
    is O(1) work, so the total is Theta(n^2). Line 11 removes from a Python
    list, which is O(n) per removal and O(n^2) overall -- the same order, so it
    does not change the bound.

Memory:  Theta(n)  -- just the `remaining` list and the `route` list.

Correctness: it always returns a valid route (every item exactly once,
because each loop iteration moves exactly one item from `remaining` to
`route`). It is NOT guaranteed to be optimal -- that is the point of the
comparison with Held-Karp.

Related literature: the default attractiveness, (calories lost per second) /
(travel time), is Smith's "weight / processing time" ratio rule, which is
OPTIMAL for one-machine scheduling where job times do not depend on the order
(W. E. Smith, "Various optimizers for single-stage production", Naval
Research Logistics Quarterly 3(1-2):59-66, 1956, doi:10.1002/nav.3800030106).
For the raccoon, travel times DO depend on the order (where you are standing
changes every distance), so the same rule is only a heuristic.
(Course rule: verify sources yourselves before citing.)
"""
from __future__ import annotations

import math
from typing import Callable, Dict, Optional

from .. import config
from ..problem import FoodItem, Instance, Solution, distance, evaluate_route

KEY = "greedy"
NAME = "Greedy"
TAGLINE = "picks the best-looking next meal"
TIME_COMPLEXITY = "Θ(n²)"      # Θ(n²)
MEMORY_COMPLEXITY = "Θ(n)"
MAX_N = None
GROWTH_LABEL = "n$^2$"


def growth(n: float) -> float:
    """Theoretical growth f(n) used for the trendline:  T(n) ~ a*n^2 + b."""
    return n * n


# -----------------------------------------------------------------------------
# Attractiveness formulas -- swap these to change the raccoon's personality.
# Each one gets (item, travel_time, arrival_time) and returns a number;
# the raccoon walks to the item with the BIGGEST number.
# -----------------------------------------------------------------------------
TINY = 1e-9   # avoids dividing by zero when food is right under the raccoon


def attractiveness_ratio(item: FoodItem, travel: float, arrival: float) -> float:
    """DEFAULT: decay rate x calories / travel time   (Smith's ratio rule).

    - calories x decay rate = calories this item loses every second it waits
    - / travel time         = per second spent walking to it
    "Eat whatever is losing the most calories per second of walking."
    In our tests this was the best of the simple rules (about 13% more
    spoilage than optimal on average, n = 8..12).
    """
    return item.food.decay_rate * item.food.calories / max(travel, TINY)


def attractiveness_instant(item: FoodItem, travel: float, arrival: float) -> float:
    """README-inspired: urgency x calories-on-arrival, per second of walking.

    - calories on arrival : the "instant gratification" (negative if it will be rotten)
    - decay rate          : urgency multiplier, so food that is about to spoil goes first
    - / travel time       : a far-away meal has to be worth the walk
    """
    calories_on_arrival = item.score_at(arrival)
    return item.food.decay_rate * calories_on_arrival / max(travel, TINY)


def attractiveness_readme(item: FoodItem, travel: float, arrival: float) -> float:
    """The README's sketch taken literally:  decay rate * (freshness on arrival / calories).

    Note: dividing by calories makes the raccoon prefer SMALLER meals.
    """
    return item.food.decay_rate * (item.freshness_at(arrival) / item.food.calories)


def attractiveness_nearest(item: FoodItem, travel: float, arrival: float) -> float:
    """Nearest-neighbor: the closest item is the most attractive."""
    return -travel


ATTRACTIVENESS: Dict[str, Callable[[FoodItem, float, float], float]] = {
    "ratio": attractiveness_ratio,
    "instant": attractiveness_instant,
    "readme": attractiveness_readme,
    "nearest": attractiveness_nearest,
}


# -----------------------------------------------------------------------------
# The algorithm
# -----------------------------------------------------------------------------
def solve(instance: Instance,
          attractiveness: Optional[str] = None,
          record_decisions: bool = False) -> Solution:
    """Run the greedy raccoon.

    attractiveness   : name of a formula in ATTRACTIVENESS (default: config.GREEDY_ATTRACTIVENESS)
    record_decisions : if True, remember every candidate's attractiveness at every
                       step (used by the animation to show the raccoon "thinking").
                       Leave False when timing -- it costs Theta(n^2) memory.
    """
    formula_name = attractiveness or config.GREEDY_ATTRACTIVENESS
    attractive = ATTRACTIVENESS[formula_name]
    items = instance.items
    decisions = []

    here = instance.start                         # [L1]
    clock = 0.0                                   # [L1]
    remaining = list(range(instance.n))           # [L2]
    route = []                                    # [L2]

    while remaining:                              # [L3]  runs n times
        best = None                               # [L4]
        best_value = -math.inf                    # [L4]
        best_travel = 0.0
        seen = {} if record_decisions else None

        for j in remaining:                       # [L5]  runs |remaining| times
            item = items[j]
            travel = distance(here, item.position) / instance.speed      # [L6]
            value = attractive(item, travel, clock + travel)            # [L7]
            if seen is not None:
                seen[j] = value
            if value > best_value:                # [L8]
                best, best_value, best_travel = j, value, travel        # [L9]

        if record_decisions:
            decisions.append({"from": here, "time": clock, "candidates": seen, "chosen": best})

        clock += best_travel                      # [L10] walk there and eat it
        here = items[best].position               # [L10]
        remaining.remove(best)                    # [L11]
        route.append(best)                        # [L11]

    notes = {"attractiveness": formula_name, "plans_ahead": False}
    if record_decisions:
        notes["decisions"] = decisions
    return evaluate_route(instance, route, KEY, notes)   # [L12]
