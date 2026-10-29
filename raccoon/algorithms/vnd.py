# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
COMBINED LOCAL SEARCH: Greedy + Variable Neighborhood Descent (2-opt <-> DP)
===========================================================================

Each local search gets stuck in its own way:
  * 2-opt can only flip stretches, so it misses "swap these 3 items around";
  * the Balas-Simonetti DP can reorder anything nearby, but nothing far away.
A route that neither can improve is usually much better than a route that
only one of them cannot improve. Variable Neighborhood Descent simply takes
turns: run 2-opt until it is stuck, then the DP until it is stuck, and repeat
until a full round changes nothing.

Pseudocode (the [Lx] tags in the code point back to these lines)
----------
    VND-RACCOON(items, den, L, k, P)
     1  route <- GREEDY-KD(items, den)
     2  repeat at most P rounds
     3      before <- cost(route)
     4      route <- TWO-OPT(route, L)                 # see two_opt.py
     5      route <- BALAS-SIMONETTI(route, k)         # see balas_simonetti.py
     6      if cost(route) is not lower than before: stop
     7  return route

Running time:  O(n log^2 n) to start, then each round costs one 2-opt run
               (Theta(n * L) per pass) plus one DP run (O(n * k^2 * 2^k) per pass).
               With L, k and the pass limits fixed, every round is linear in n.
Memory:        O(n * k * 2^k) (the DP's back-pointers).

Sources (verify before citing):
  N. Mladenovic and P. Hansen, "Variable neighborhood search", Computers &
    Operations Research 24(11):1097-1100, 1997. doi:10.1016/S0305-0548(97)00031-2
  M. M. Silva, A. Subramanian, T. Vidal, L. S. Ochi, "A simple and effective
    metaheuristic for the Minimum Latency Problem", European Journal of
    Operational Research 221(3):513-520, 2012.  (VND-style local search for
    exactly this kind of "sum of waiting times" objective)
  plus the sources in two_opt.py and balas_simonetti.py.
"""
from __future__ import annotations

import math

from .. import config
from ..problem import Instance, Solution, evaluate_route
from . import balas_simonetti, greedy_kd, two_opt

KEY = "vnd"
NAME = "Greedy + VND (2-opt ⇄ DP)"
TAGLINE = "takes turns: 2-opt, then the DP, until stuck"
TIME_COMPLEXITY = "O(n log² n + rounds·n)"
MEMORY_COMPLEXITY = "O(n·k·2ᵏ)"
MAX_N = None
GROWTH_LABEL = "n log$^2$n"


def growth(n: float) -> float:
    lg = math.log2(max(n, 2.0))
    return n * lg * lg


def solve(instance: Instance) -> Solution:
    route = greedy_kd.solve(instance).order                                   # [L1]
    cost = evaluate_route(instance, route, KEY).spoilage_loss
    rounds = 0
    for rounds in range(1, config.LOCAL_SEARCH_MAX_PASSES + 1):              # [L2]
        before = cost                                                         # [L3]
        route = two_opt.improve(instance, route, max_segment=config.VND_MAX_SEGMENT,
                                max_passes=config.LOCAL_SEARCH_MAX_PASSES)    # [L4]
        route = balas_simonetti.improve(instance, route, k=config.VND_WINDOW,
                                        max_passes=config.LOCAL_SEARCH_MAX_PASSES)   # [L5]
        cost = evaluate_route(instance, route, KEY).spoilage_loss
        if cost >= before - 1e-9:                                             # [L6]
            break
    return evaluate_route(instance, route, KEY, {"plans_ahead": True, "rounds": rounds})  # [L7]
