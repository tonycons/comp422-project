# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Updated 2026-11-03 (Claude): spoiled food is worth 0 -> Pareto-front labels.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
DYNAMIC-PROGRAMMING LOCAL SEARCH: Greedy + Balas-Simonetti DP
=============================================================

Subset DP is exact but exponential in n. Balas & Simonetti's idea: take a
starting route and only allow orders where nothing moves "too far":

    item i must still come before item j whenever j >= i + k
    (positions measured in the starting route; k = window size, e.g. 6)

Inside that restriction, a subset DP (like subset_dp.py) finds the BEST route exactly,
in time LINEAR in n (exponential only in the small constant k). The number
of routes it considers is exponential in n, so it is a very large
neighborhood searched very quickly. Repeat from the new route until it stops
improving. With k = n it IS the Subset DP (every order is allowed).

Why the DP state is small. Let f = the first position not eaten yet.
  * Nothing at position >= f + k can have been eaten (it would have to come
    after f, which is still waiting).
  * So "what has been eaten" = every position before f, plus some subset M of
    positions f+1 .. f+k-1  ->  only 2^(k-1) possibilities for M.
  * The last item eaten is within k of f as well.
So a state is (f, M, last) and the eaten set is known from it.

Spoiled food is worth 0, so (exactly as in subset_dp.py) a state keeps a short
Pareto front of labels (time, loss) instead of one number, pruned with the
two rules in pareto.py. Eating position j at time t' adds loss_j(t').

Pseudocode (the [Lx] tags in the code point back to these lines)
----------
    BALAS-SIMONETTI-RACCOON(items, den, k, P)
     1  route <- GREEDY-KD(items, den)
     2  repeat at most P times
     3      layer[0] <- { (f=0, M=empty, last=den) : [label (time 0, loss 0)] }
     4      for c <- 0 to n-1                                  # c = items eaten so far
     5          for each state (f, M, last) in layer[c]        # O(k * 2^k) states
     6              for each allowed next position j:          # j = f, or f+1..f+k-1 not in M
     7                  new <- state after eating j (if j = f, slide the window forward)
     8                  for each label (t, c) of the state:
     9                      add (t + travel(last, j), c + loss_j(that time)) to new's candidates
    10          every new state keeps PARETO-FRONT(its candidates)
    11      new_route <- follow back-pointers from the cheapest label in layer[n]
    12      if new_route is not cheaper: stop
    13      route <- new_route
    14  return route

Running time:  O(n log^2 n) for the start, plus per pass  O(n * k^2 * 2^k * F log F):
               n layers x O(k * 2^k) states x O(k) choices x F labels (F = largest
               front, small in practice). For fixed k that is LINEAR in n.
               P passes at most (config.py).
Memory:        O(n * k * 2^k * F) for the back-pointers.

Correctness: the states of layer[n] correspond one-to-one to orders that obey
the "i before j when j >= i + k" rule, and a label is only dropped when another
label of the same state is at least as good for every way of finishing (see
pareto.py), so the DP finds the cheapest allowed order. The tests check this
against brute force on small maps, and that k = n gives the true optimum. The
starting route is always allowed, so a pass never makes things worse.

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
from .pareto import live_weight_function, pareto_front

KEY = "balas_simonetti"
NAME = "Greedy + Balas-Simonetti"
TAGLINE = "Greedy, then an exact DP over nearby swaps"
TIME_COMPLEXITY = "O(n log² n + P·n·k²·2ᵏ·F)"
MEMORY_COMPLEXITY = "O(n·k·2ᵏ·F)"
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

    Returns (route as item ids, its spoilage loss). Runs in O(n * k^2 * 2^k * F log F).
    """
    n = len(base)
    if n == 0:
        return [], 0.0
    items, speed = instance.items, instance.speed
    X = [items[b].x for b in base]                    # everything below is in BASE order
    Y = [items[b].y for b in base]
    cal = [items[b].food.calories for b in base]      # loss of eating position p at time t:
    dec = [items[b].food.decay_rate for b in base]    #   cal[p] * min(1, dec[p] * t)
    w = [items[b].food.spoil_weight for b in base]
    shelf_classes = sorted({items[b].food.shelf_life for b in base})
    cls = [shelf_classes.index(items[b].food.shelf_life) for b in base]
    den_x, den_y = instance.start
    hypot = math.hypot
    width = k - 1                                     # M has one bit per position f+1 .. f+k-1

    # suffix[f][c] = spoil weight of positions f..n-1 with shelf class c (for W_live, pareto.py Rule 2)
    suffix = [[0.0] * len(shelf_classes) for _ in range(n + 1)]
    for p in range(n - 1, -1, -1):
        suffix[p] = list(suffix[p + 1])
        suffix[p][cls[p]] += w[p]

    def w_live_for(f: int, M: int):
        """W_live(t) for the positions NOT yet eaten in state (f, M)."""
        per_class = list(suffix[f])
        for b in range(width):
            if (M >> b) & 1:
                per_class[cls[f + 1 + b]] -= w[f + 1 + b]
        return live_weight_function(zip(shelf_classes, per_class))

    # A state is (f, M, last); its value is a Pareto front of labels
    # (time, loss, previous_state, index of the label in the previous state).
    # last = -1 means "still at the den".
    layer: Dict[tuple, list] = {(0, 0, -1): [(0.0, 0.0, None, -1)]}           # [L3]
    history: List[Dict[tuple, list]] = [layer]

    for _c in range(n):                                                       # [L4]
        candidates: Dict[tuple, list] = {}
        for state, labels in layer.items():                                   # [L5]
            f, M, last = state
            if last < 0:
                lx, ly = den_x, den_y
            else:
                lx, ly = X[last], Y[last]

            moves = []                                                        # [L6] (next position, new state)
            if f < n:                                 # option 1: eat position f, then slide the window
                shift = 1
                m = M
                while m & 1:                          # skip positions already eaten right after f
                    m >>= 1
                    shift += 1
                moves.append((f, (f + shift, m >> 1, f)))                     # [L7]
            for b in range(width):                    # option 2: jump ahead to f+1+b (not eaten yet)
                j = f + 1 + b
                if j >= n:
                    break
                if not (M >> b) & 1:
                    moves.append((j, (f, M | (1 << b), j)))                   # [L7]

            for j, key in moves:
                travel = hypot(X[j] - lx, Y[j] - ly) / speed
                bucket = candidates.setdefault(key, [])
                cal_j, dec_j = cal[j], dec[j]
                for idx, (t, loss, _prev, _pidx) in enumerate(labels):        # [L8]
                    t2 = t + travel
                    bucket.append((t2, loss + cal_j * min(1.0, dec_j * t2), state, idx))   # [L9]

        layer = {key: pareto_front(bucket, w_live_for(key[0], key[1]))       # [L10]
                 for key, bucket in candidates.items()}
        history.append(layer)

    # [L11] cheapest finished label, then walk the back-pointers
    best_state, best_idx, total = None, -1, math.inf
    for state, labels in layer.items():
        for idx, label in enumerate(labels):
            if label[1] < total:
                best_state, best_idx, total = state, idx, label[1]
    positions = []
    state, idx = best_state, best_idx
    for c in range(n, 0, -1):
        positions.append(state[2])            # `last` of each state = the position eaten at that step
        _t, _loss, state, idx = history[c][state][idx]
    positions.reverse()
    return [base[p] for p in positions], total
