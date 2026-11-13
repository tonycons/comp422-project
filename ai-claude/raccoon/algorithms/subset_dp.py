# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Updated 2026-11-03 (Claude): spoiled food is worth 0 -> Pareto-front labels.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
CLEVER ALGORITHM: Subset DP (subset dynamic programming with label dominance)
=============================================================================

Instead of deciding one step at a time, the raccoon plans the WHOLE route
before leaving the den and is guaranteed to find the best possible score.

Step 1 - turn "score" into "loss"  (see problem.py)
    total score = (sum of all calories) - sum_i loss_i(t_i),
    loss_i(t)   = w_i * min(t, shelf_life_i)       (spoiled food is worth 0)
    So we MINIMIZE the total loss.

Step 2 - the table (the (set, last item) shape of Held & Karp 1962)
    One cell per (S, j): "eat exactly the items in set S, finishing at item j".
    Sets are stored as bitmasks: bit k of the integer S is 1 if item k is in S.

Step 3 - why a cell holds a small LIST instead of one number
    Because an item stops losing calories once it has spoiled, the loss of
    the items still to come depends on the exact clock time we are at, not
    just on which items are left. So two partial routes for the same cell can
    trade off "lower loss so far" against "earlier clock time", and neither is
    safe to throw away -- unless one is at least as good on BOTH. Each cell
    therefore keeps a Pareto front of labels (time, loss); see pareto.py.

    Recurrence: extend every label of every cell (S - {j}, i) by walking i -> j:
        time' = time + T(i, j)
        loss' = loss + loss_j(time')
    and keep the Pareto front of all of them as cell (S, j).
    Base case: cell ({j}, j) = { (T(den, j), loss_j(T(den, j))) }.

Pseudocode (the [Lx] tags in the code below point back to these lines)
----------
    SUBSET-DP-RACCOON(items, den, speed)
     1  T[i][j] <- travel time i -> j for every pair;  T0[j] <- travel time den -> j
     2  for each item j:  front[{j}][j] <- { (T0[j], loss_j(T0[j])) }
     3  for each subset S, smallest first (|S| >= 2)
     4      for each item j in S
     5          prev <- S - {j};   candidates <- empty list
     6          for each item i in prev
     7              for each label (t, c) in front[prev][i]
     8                  t' <- t + T[i][j];   add (t', c + loss_j(t')) to candidates
     9          front[S][j] <- PARETO-FRONT(candidates)
    10  best <- the label with the smallest loss among all front[ALL][j]
    11  follow the back-pointers from best to rebuild the route
    12  return route

Running time:  O(n^2 * 2^n * F log(nF)),   F = the largest front size
    Line 3 loops over all 2^n subsets, line 4 over n items, line 6 over n
    items, and line 7 over at most F labels: 2^n * n * n * F candidate labels,
    plus sorting them on line 9. On our random maps F stays small (the solver
    reports it as notes["max_front"]), so it behaves like the classic
    one-value-per-cell Theta(n^2 * 2^n) table times a small constant.
Memory:  O(n * 2^n * F)  for the fronts.

Why it is correct: optimal substructure plus dominance. A best route that
eats set S and ends at j reaches j through some label of cell (S - {j}, i).
If that label had been dropped, some kept label is at least as early AND at
least as cheap; finishing the route from it reaches every later item no
later, and losses never shrink with time, so it does at least as well. Line 7
tries every i and every kept label, so the optimum survives to line 10.
Filling smaller sets first (line 3) guarantees front[prev] is complete
before it is used, because S - {j} < S as an integer.

Compared with brute force (all n! orders, Theta(n * n!)), Subset DP shares
work between orders that visit the same SET of items. Compared with Greedy
(Theta(n^2)) it is much slower, but it is always optimal.

Sources (verify yourselves before citing - course rule)
Updated 2026-11-13 (Claude): Held & Karp's 1962 DP is a TSP algorithm; the first four
sources (read from the group's scientific_sources/ folder) cover the REPAIRMAN problem.
  B. Y. Wu, Z.-N. Huang, F.-J. Zhan, "Exact algorithms for the minimum latency
    problem", Information Processing Letters 92(6):303-309, 2004.
    doi:10.1016/j.ipl.2004.09.009   (Section 3.1: the O(n^2 * 2^n) DP over
    "configurations" (visited set, last vertex) for the repairman objective:
    our table of cells (S, j))
  R. Roberti and A. Mingozzi, "Dynamic ng-path relaxation for the delivery man
    problem", Transportation Science 48(3):413-424, 2014.
    doi:10.1287/trsc.2013.0474   (Section 2: the same recursion F(S, i), "a
    well-known DP recursion"; Section 5: an exact method with "standard
    dominance rules")
  J. N. Tsitsiklis, "Special cases of traveling salesman and repairman problems
    with time windows", Networks 22(3):263-282, 1992. doi:10.1002/net.3230220305
    (Section VIII, Theorems 8-9: forward DP over states (i, S) that propagates
    labels and tracks both time and waiting time: why a cell keeps a list)
  J. Pei, N. Mladenovic, D. Urosevic, J. Brimberg, X. Liu, "Solving the
    traveling repairman problem with profits: A novel variable neighborhood
    search approach", Information Sciences 507:108-123, 2020.
    doi:10.1016/j.ins.2019.08.017   (Section 2.1: profit p - t if p > t, else 0;
    our score is the weighted version, w * max(0, shelf_life - t). A heuristics
    paper: it supports the problem, not this algorithm.)
  M. Held and R. M. Karp, "A dynamic programming approach to sequencing
    problems", J. SIAM 10(1):196-210, 1962. doi:10.1137/0110015
    (origin of the (set, last) table, for the TSP)
  R. Bellman, "Dynamic programming treatment of the travelling salesman
    problem", J. ACM 9(1):61-63, 1962.
  A. Blum, P. Chalasani, D. Coppersmith, W. Pulleyblank, P. Raghavan, M. Sudan,
    "The minimum latency problem", STOC 1994, pp. 163-171.
    doi:10.1145/195058.195125   (defines the traveling repairman / latency objective)
Not from any of these: dominance Rule 2 (pareto.py), the per-item weights, and
the O(n^2 * 2^n * F) bound with label lists are our own.
"""
from __future__ import annotations


from ..problem import Instance, Solution, distance, evaluate_route
from .pareto import live_weight_function, pareto_front

KEY = "subset_dp"
NAME = "Subset DP"
TAGLINE = "plans the whole route before leaving"
TIME_COMPLEXITY = "O(n²·2ⁿ·F)"     # F = largest Pareto front (small in practice)
MEMORY_COMPLEXITY = "O(n·2ⁿ·F)"
MAX_N = 20
GROWTH_LABEL = "n$^2$·2$^n$"



def growth(n: float) -> float:
    """Growth f(n) used for the trendline:  T(n) ~ a*n^2*2^n + b  (F treated as a constant)."""
    return n * n * 2.0 ** n


def solve(instance: Instance) -> Solution:
    """Find the route with the highest possible score (exact, exponential time)."""
    n = instance.n
    items = instance.items
    if n == 0:
        return evaluate_route(instance, [], KEY, {"plans_ahead": True, "table_cells": 0, "max_front": 0})

    # [L1] travel times between every pair of items, and from the den
    T = [[distance(a.position, b.position) / instance.speed for b in items] for a in items]
    T0 = [distance(instance.start, item.position) / instance.speed for item in items]
    # Calories lost eating j at time t = cal[j] * min(1, dec[j] * t)  (same formula as
    # FoodItem.loss_at, written out here because this line runs millions of times)
    cal = [item.food.calories for item in items]
    dec = [item.food.decay_rate for item in items]
    w = [item.food.spoil_weight for item in items]      # calories lost per second while still fresh
    shelf = [item.food.shelf_life for item in items]
    shelf_classes = sorted(set(shelf))                  # one class per distinct shelf life (= food type)
    class_of = [shelf_classes.index(s) for s in shelf]

    num_subsets = 1 << n                      # 2^n
    ALL = num_subsets - 1                     # bitmask with every item in it

    # front[S][j] = list of labels (time, loss, i, k): "reached j at `time` having
    # lost `loss`, coming from label number k of cell (S - {j}, i)".  i = -1: from the den.
    front = [None] * num_subsets

    # [L2] base case: walk straight from the den to j
    for j in range(n):
        cells = [[] for _ in range(n)]
        t = T0[j]
        cells[j] = [(t, cal[j] * min(1.0, dec[j] * t), -1, -1)]
        front[1 << j] = cells

    def remaining_weight(S):
        """W_live(t) for the items NOT in S (see pareto.py, Rule 2). O(n) to build."""
        per_class = [0.0] * len(shelf_classes)
        for k in range(n):
            if not (S >> k) & 1:
                per_class[class_of[k]] += w[k]
        return live_weight_function(zip(shelf_classes, per_class))

    # [L3] every subset S, in increasing integer order (so S - {j} is always done first)
    max_front = 1
    for S in range(1, num_subsets):
        if S & (S - 1) == 0:
            continue                          # S has only one item: base case, already done
        cells = [[] for _ in range(n)]
        w_live = remaining_weight(S)          # same for every j in S
        for j in range(n):                    # [L4] j = the item eaten LAST in S
            if not (S >> j) & 1:
                continue
            prev = S ^ (1 << j)               # [L5] items eaten before j
            prev_cells = front[prev]
            cal_j, dec_j = cal[j], dec[j]
            candidates = []
            for i in range(n):                # [L6] i = the item eaten just before j
                if not (prev >> i) & 1:
                    continue
                travel = T[i][j]
                for k, (t, c, _i, _k) in enumerate(prev_cells[i]):      # [L7]
                    t2 = t + travel                                     # [L8]
                    candidates.append((t2, c + cal_j * min(1.0, dec_j * t2), i, k))
            kept = pareto_front(candidates, w_live)                     # [L9]
            cells[j] = kept
            if len(kept) > max_front:
                max_front = len(kept)
        front[S] = cells

    # [L10] the cheapest finished label, over every possible last item
    best = None
    for j in range(n):
        for k, label in enumerate(front[ALL][j]):
            if best is None or label[1] < best[0]:
                best = (label[1], j, k)
    best_loss, j, k = best

    # [L11] walk the back-pointers to recover the order
    route = []
    S = ALL
    while j != -1:
        route.append(j)
        _t, _c, i, k_prev = front[S][j][k]
        S, j, k = S ^ (1 << j), i, k_prev
    route.reverse()

    notes = {
        "plans_ahead": True,
        "table_cells": num_subsets * n,       # number of (S, j) cells (2^n * n)
        "max_front": max_front,               # F in the running-time bound
        "dp_min_cost": best_loss,             # equals Solution.spoilage_loss (checked in the tests)
    }
    return evaluate_route(instance, route, KEY, notes)   # [L12]
