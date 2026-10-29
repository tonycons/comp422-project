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

  Once freshness goes below 0 the item is SPOILED and eating it makes the
  raccoon sick, i.e. the item's score becomes NEGATIVE.
* The score for eating an item at time t is

        score(t) = calories * freshness(t)
                 = calories  -  (calories / shelf_life) * t
                 = calories  -  w * t        where  w = calories / shelf_life

  We call  w  the item's SPOIL WEIGHT: "calories lost per second of waiting".
* Total score of a route = sum of the item scores.  Higher is better.

Why this exact scoring?  Because then

        total score = (sum of all calories)  -  sum over items of  w_i * t_i

The first part is the same for every route, so maximizing the score is the
same as minimizing the WEIGHTED SUM OF ARRIVAL TIMES (the "weighted latency").
That is precisely the (weighted) Traveling Repairman / Minimum Latency Problem
mentioned in our README, and it is what lets the Held-Karp dynamic program
find the true optimum (see algorithms/held_karp.py).
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
        """1.0 = perfectly fresh, 0.0 = just spoiled, negative = rotten."""
        return 1.0 - self.food.decay_rate * t

    def score_at(self, t: float) -> float:
        """Calories the raccoon actually gets if it eats this item at time t."""
        return self.food.calories * self.freshness_at(t)

    def is_spoiled_at(self, t: float) -> bool:
        return self.freshness_at(t) < 0.0


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
    spoilage_loss: float           # calories lost to waiting = sum(w_i * t_i)  (the DP minimizes this)
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
        if item.is_spoiled_at(clock):
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
