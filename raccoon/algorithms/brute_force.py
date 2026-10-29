# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
REFERENCE ONLY: Brute force (try every possible order)
======================================================

Not one of our two main algorithms. It exists to PROVE Held-Karp is right:
the tests check that Held-Karp's score equals the brute-force best on small
random maps. It can also be benchmarked (python main.py benchmark --only
brute_force) if you want to show why nobody does this.

Pseudocode
----------
    BRUTE-FORCE-RACCOON(items, den, speed)
     1  best_route <- NIL;  best_score <- -infinity
     2  for each of the n! orderings P of the items
     3      s <- SCORE(P)                         # walk the route: Theta(n)
     4      if s > best_score:  best_route <- P;  best_score <- s
     5  return best_route

Running time:  Theta(n * n!)   (n! orderings, Theta(n) to score each)
Memory:        Theta(n)        (orderings are generated one at a time)
"""
from __future__ import annotations

import itertools
import math

from ..problem import Instance, Solution, distance, evaluate_route

KEY = "brute_force"
NAME = "Brute force"
TAGLINE = "tries every possible order"
TIME_COMPLEXITY = "Θ(n·n!)"
MEMORY_COMPLEXITY = "Θ(n)"


def growth(n: float) -> float:
    """Theoretical growth f(n):  T(n) ~ a*n*n! + b."""
    return n * math.gamma(n + 1)   # gamma(n+1) = n! (and works for non-integers when plotting)


def solve(instance: Instance) -> Solution:
    items = instance.items
    best_route, best_score = None, -math.inf                       # [L1]
    for order in itertools.permutations(range(instance.n)):        # [L2]
        clock, here, score = 0.0, instance.start, 0.0               # [L3] score this order
        for k in order:
            clock += distance(here, items[k].position) / instance.speed
            here = items[k].position
            score += items[k].score_at(clock)
        if score > best_score:                                     # [L4]
            best_route, best_score = order, score
    return evaluate_route(instance, list(best_route), KEY, {"plans_ahead": True})   # [L5]
