# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
The problem itself: food, the map, and how a route is scored.

THE GREEDY RACCOON (our variant of the Traveling Repairman Problem)
-------------------------------------------------------------------
* There are n food items scattered on a 2-D map. Each item has a TYPE
  (fish, pizza, ...). The type decides
      - calories   : how much the item is worth when perfectly fresh
      - shelf_life : seconds until it is completely spoiled
* The raccoon leaves its den at time 0 and walks in straight lines at a
  constant speed. It eats every item exactly once (it is a GREEDY raccoon!),
  and eating is instant.
* Freshness drops linearly with time:

        freshness(t) = 1 - t / shelf_life          (1.0 = fresh, 0.0 = spoiled)

  Once freshness reaches 0 the item is SPOILED: eating it is allowed but it
  is worth 0 calories (it never goes below 0).
* The score for eating an item at time t is

        score(t) = calories * max(0, freshness(t))

  and the calories LOST by waiting until time t are

        loss(t)  = calories - score(t) = w * min(t, shelf_life)
                   where  w = calories / shelf_life

  We call  w  the item's SPOIL WEIGHT: "calories lost per second of waiting",
  and an item stops losing calories once it has spoiled (there is nothing left).
* Total score of a route = sum of the item scores.  Higher is better.
  Equivalently:  total score = (sum of all calories) - sum_i loss_i(t_i),
  so the algorithms MINIMIZE the total loss.

What this means for the algorithms
  This is our variant of the Traveling Repairman / Minimum Latency Problem
  (minimize a weighted sum of arrival times), except that each item's cost
  stops growing at its shelf life. A score that stops at zero is the Traveling
  Repairman Problem with Profits (profit p - t if p > t, else 0: J. Pei et al.,
  Information Sciences 507:108-123, 2020, doi:10.1016/j.ins.2019.08.017,
  Section 2.1); ours is the weighted version, w * max(0, shelf_life - t).
  [added 2026-11-13, Claude]
  Because of that cap, the cost of eating an
  item depends on the exact clock time it is reached, so:
    * Subset DP and the Balas-Simonetti DP keep, for each table cell, every
      (time, loss) pair that might still lead to the best route (a "Pareto
      front"); see subset_dp.py. They are still exact.
    * 2-opt estimates each move in O(1) and confirms promising ones with the
      exact score; see two_opt.py. It never accepts a move that makes things worse.
  (Before 2026-11-03 spoiled food scored NEGATIVE calories, which made every
  item's cost exactly w*t; that version is in the git history if you need it.)
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

Point = Tuple[float, float]


# -----------------------------------------------------------------------------
# Food
# -----------------------------------------------------------------------------
@dataclass(frozen=True)
class FoodType:
    """A kind of food. All the numbers that describe a kind live here."""

    name: str           # e.g. "fish"
    calories: float     # value when perfectly fresh
    shelf_life: float   # seconds until freshness reaches 0 (fully spoiled)

    @property
    def decay_rate(self) -> float:
        """Fraction of freshness lost per second (1 / shelf_life)."""
        return 1.0 / self.shelf_life

    @property
    def spoil_weight(self) -> float:
        """Calories lost per second the raccoon makes this item wait."""
        return self.calories * self.decay_rate


@dataclass(frozen=True)
class FoodItem:
    """One piece of food sitting somewhere on the map."""

    id: int             # index of this item in Instance.items (0 .. n-1)
    x: float
    y: float
    food: FoodType

    @property
    def position(self) -> Point:
        return (self.x, self.y)

    def freshness_at(self, t: float) -> float:
        """1.0 = perfectly fresh, 0.0 = just spoiled, negative = spoiled for a while.

        (Freshness itself keeps falling; the SCORE is what stops at 0.)
        """
        return 1.0 - self.food.decay_rate * t

    def score_at(self, t: float) -> float:
        """Calories the raccoon gets if it eats this item at time t (never below 0)."""
        return self.food.calories * max(0.0, self.freshness_at(t))

    def loss_at(self, t: float) -> float:
        """Calories lost by eating at time t instead of time 0:  w * min(t, shelf_life).

        Written as calories * min(1, decay_rate * t) so the TypeScript demo can
        compute exactly the same floating-point number.
        """
        return self.food.calories * min(1.0, self.food.decay_rate * t)

    def is_spoiled_at(self, t: float) -> bool:
        """True once the item is worth nothing (freshness has reached 0)."""
        return self.freshness_at(t) <= 0.0


# -----------------------------------------------------------------------------
# A problem instance
# -----------------------------------------------------------------------------
@dataclass
class Instance:
    """Everything an algorithm needs to know to plan a route."""

    items: List[FoodItem]
    start: Point                 # the raccoon's den
    speed: float                 # map units (meters) per second
    width: float                 # map size, used only for drawing
    height: float
    seed: Optional[int] = None   # random seed that produced this instance

    @property
    def n(self) -> int:
        return len(self.items)

    @property
    def total_calories(self) -> float:
        """Best score imaginable (every item eaten at time 0, impossible)."""
        return sum(item.food.calories for item in self.items)

    def travel_time(self, a: Point, b: Point) -> float:
        """Seconds to walk in a straight line from point a to point b."""
        return distance(a, b) / self.speed


def distance(a: Point, b: Point) -> float:
    """Straight-line (Euclidean) distance."""
    return math.hypot(a[0] - b[0], a[1] - b[1])


# -----------------------------------------------------------------------------
# A solution (a route) and how it is scored
# -----------------------------------------------------------------------------
@dataclass
class Solution:
    """A route through all food items plus everything we measured about it."""

    algorithm: str                 # key of the algorithm that made it, e.g. "greedy"
    order: List[int]               # item ids in the order they are eaten
    arrival_times: List[float]     # arrival_times[k] = time the raccoon reaches order[k]
    item_scores: List[float]       # item_scores[k]   = calories gained from order[k]
    total_score: float             # sum of item_scores
    spoilage_loss: float           # calories lost to waiting = sum of loss_i(t_i)  (what the algorithms minimize)
    total_time: float              # time the last item is eaten
    spoiled_count: int             # how many items were rotten when eaten
    notes: Dict[str, object] = field(default_factory=dict)  # algorithm-specific extras


def evaluate_route(instance: Instance, order: Sequence[int], algorithm: str,
                   notes: Optional[Dict[str, object]] = None) -> Solution:
    """Walk the raccoon along `order` and score it.

    Every algorithm hands its route to this ONE function, so all algorithms
    are scored by exactly the same rules.  Runs in Theta(n).
    """
    if sorted(order) != list(range(instance.n)):
        raise ValueError(f"{algorithm}: route must visit every item exactly once, got {list(order)}")

    clock = 0.0
    here = instance.start
    arrival_times, item_scores = [], []
    spoiled = 0
    for item_id in order:
        item = instance.items[item_id]
        clock += instance.travel_time(here, item.position)   # walk there
        here = item.position
        arrival_times.append(clock)
        item_scores.append(item.score_at(clock))              # eat it
        if item.is_spoiled_at(clock):                         # worth 0 calories now
            spoiled += 1

    total_score = sum(item_scores)
    return Solution(
        algorithm=algorithm,
        order=list(order),
        arrival_times=arrival_times,
        item_scores=item_scores,
        total_score=total_score,
        spoilage_loss=instance.total_calories - total_score,
        total_time=clock,
        spoiled_count=spoiled,
        notes=dict(notes or {}),
    )
