# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
DYNAMIC-PROGRAMMING LOCAL SEARCH: Greedy + Balas-Simonetti DP
=============================================================

Held-Karp is exact but exponential in n. Balas & Simonetti's idea: take a
starting route and only allow orders where nothing moves "too far":

    item i must still come before item j whenever j >= i + k
    (positions measured in the starting route; k = window size, e.g. 6)

Inside that restriction, a Held-Karp-style DP finds the BEST route exactly,
in time LINEAR in n (exponential only in the small constant k). The number
of routes it considers is exponential in n, so it is a very large
neighborhood searched very quickly. Repeat from the new route until it stops
improving. With k = n it IS Held-Karp (every order is allowed).

Why the DP state is small. Let f = the first position not eaten yet.
  * Nothing at position >= f + k can have been eaten (it would have to come
    after f, which is still waiting).
  * So "what has been eaten" = every position before f, plus some subset M of
    positions f+1 .. f+k-1  ->  only 2^(k-1) possibilities for M.
  * The last item eaten is within k of f as well.
So a state is (f, M, last) and the eaten set is known from it. That is all
the "charge while walking" cost trick from held_karp.py needs: a leg costs
travel_time * (spoil weight of everything NOT eaten yet).

Pseudocode (the [Lx] tags in the code point back to these lines)
----------
    BALAS-SIMONETTI-RACCOON(items, den, k, P)
     1  route <- GREEDY-KD(items, den)
     2  repeat at most P times
     3      layer[0] <- { (f=0, M=empty, last=den) : cost 0 }
     4      for c <- 0 to n-1                                  # c = items eaten so far
     5          for each state (f, M, last) in layer[c]        # O(k * 2^k) states
     6              waiting <- total weight - weight eaten in (f, M)
     7              for each allowed next position j:          # j = f, or f+1..f+k-1 not in M
     8                  new <- state after eating j (if j = f, slide the window forward)
     9                  relax layer[c+1][new] with cost + travel(last, j) * waiting
    10      new_route <- follow back-pointers from the cheapest state in layer[n]
    11      if new_route is not cheaper: stop
    12      route <- new_route
    13  return route

Running time:  O(n log^2 n) for the start, plus per pass  O(n * k^2 * 2^k):
               n layers x O(k * 2^k) states x O(k) choices. For a fixed k that is
               LINEAR in n. P passes at most (config.py).
Memory:        O(n * k * 2^k) for the back-pointers.

Correctness: the states of layer[n] correspond one-to-one to orders that obey
the "i before j when j >= i + k" rule, and each leg's cost depends only on the
state, so (as in Held-Karp) the DP finds the cheapest allowed order. The tests
check this against brute force on small maps, and that k = n gives the true
optimum. The starting route is always allowed, so a pass never makes things worse.

Note: Balas & Simonetti's own heuristic re-applies the DP after contracting
arcs of the tour; we simply re-apply it to the improved route (simpler).

Source (verify before citing):
  E. Balas and N. Simonetti, "Linear time dynamic-programming algorithms for
  new classes of restricted TSPs: a computational study", INFORMS Journal on
  Computing 13(1):56-75, 2001. doi:10.1287/ijoc.13.1.56.9748
"""
from __future__ import annotations

import math
from typing import Dict, List, Sequence, Tuple

from .. import config
from ..problem import Instance, Solution, evaluate_route
from . import greedy_kd

KEY = "balas_simonetti"
NAME = "Greedy + Balas-Simonetti"
TAGLINE = "Greedy, then an exact DP over nearby swaps"
TIME_COMPLEXITY = "O(n log² n + P·n·k²·2ᵏ)"
MEMORY_COMPLEXITY = "O(n·k·2ᵏ)"
MAX_N = None
GROWTH_LABEL = "n log$^2$n"


def growth(n: float) -> float:
    lg = math.log2(max(n, 2.0))
    return n * lg * lg


def solve(instance: Instance) -> Solution:
    start = greedy_kd.solve(instance)                                         # [L1]
    route = improve(instance, start.order, k=config.BS_WINDOW,
                    max_passes=config.LOCAL_SEARCH_MAX_PASSES)
    return evaluate_route(instance, route, KEY, {"plans_ahead": True})       # [L13]


def improve(instance: Instance, route: List[int], k: int, max_passes: int) -> List[int]:
    route = list(route)
    best_cost = evaluate_route(instance, route, KEY).spoilage_loss
    for _pass in range(max_passes):                                           # [L2]
        new_route, new_cost = best_in_window(instance, route, k)
        if new_cost >= best_cost - 1e-9:                                      # [L11]
            break
        route, best_cost = new_route, new_cost                                # [L12]
    return route


def best_in_window(instance: Instance, base: Sequence[int], k: int) -> Tuple[List[int], float]:
    """The cheapest order in which item base[i] comes before base[j] whenever j >= i + k.

    Returns (route as item ids, its spoilage loss). Runs in O(n * k^2 * 2^k).
    """
    n = len(base)
    if n == 0:
        return [], 0.0
    items, speed = instance.items, instance.speed
    X = [items[b].x for b in base]                    # positions in BASE order
    Y = [items[b].y for b in base]
    w = [items[b].food.spoil_weight for b in base]
    W_total = sum(w)
    den_x, den_y = instance.start
    hypot = math.hypot
    width = k - 1                                     # M has one bit per position f+1 .. f+k-1

    # A state is (f, M, last); value = (cost, eaten_weight, previous_state).
    # last = -1 means "still at the den".
    layer: Dict[tuple, tuple] = {(0, 0, -1): (0.0, 0.0, None)}               # [L3]
    history: List[Dict[tuple, tuple]] = [layer]

    for _c in range(n):                                                       # [L4]
        nxt: Dict[tuple, tuple] = {}
        for state, (cost, eaten_w, _prev) in layer.items():                   # [L5]
            f, M, last = state
            waiting = W_total - eaten_w                                       # [L6]
            if last < 0:
                lx, ly = den_x, den_y
            else:
                lx, ly = X[last], Y[last]

            # [L7] option 1: eat position f itself, then slide the window forward
            if f < n:
                c = cost + hypot(X[f] - lx, Y[f] - ly) / speed * waiting
                shift = 1
                m = M
                while m & 1:                      # skip positions already eaten right after f
                    m >>= 1
                    shift += 1
                key = (f + shift, m >> 1, f)                                  # [L8]
                old = nxt.get(key)
                if old is None or c < old[0]:                                 # [L9]
                    nxt[key] = (c, eaten_w + w[f], state)

            # [L7] option 2: jump ahead to position f+1+b (b < k-1) that is not eaten yet
            for b in range(width):
                j = f + 1 + b
                if j >= n:
                    break
                if (M >> b) & 1:
                    continue
                c = cost + hypot(X[j] - lx, Y[j] - ly) / speed * waiting
                key = (f, M | (1 << b), j)                                    # [L8]
                old = nxt.get(key)
                if old is None or c < old[0]:                                 # [L9]
                    nxt[key] = (c, eaten_w + w[j], state)
        layer = nxt
        history.append(layer)

    # [L10] best finished state, then walk the back-pointers
    end_state = min(layer, key=lambda s: layer[s][0])
    total = layer[end_state][0]
    positions = []
    state = end_state
    for c in range(n, 0, -1):
        positions.append(state[2])            # `last` of each state = the item eaten at that step
        state = history[c][state][2]
    positions.reverse()
    return [base[p] for p in positions], total
