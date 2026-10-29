# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
CLEVER ALGORITHM: Held-Karp dynamic programming (modified for the raccoon)
==========================================================================

Instead of deciding one step at a time, the raccoon plans the WHOLE route
before leaving the den and is guaranteed to find the best possible score.

Step 1 - turn "score" into "cost"  (see problem.py)
    total score = (sum of all calories) - sum_i  w_i * t_i
    where w_i = calories_i / shelf_life_i ("spoil weight") and t_i = arrival time.
    So we MINIMIZE  COST = sum_i w_i * t_i   (the calories lost to spoilage).

Step 2 - charge the cost while walking, not on arrival  (the key trick)
    While the raccoon walks one leg of its route, EVERY item it has not eaten
    yet is waiting and losing w per second. So a leg of length `travel`
    costs   travel * (sum of w over the items not yet eaten).
    Adding this up over all legs gives exactly sum_i w_i * t_i.
    The cost of a leg depends only on WHICH items are already eaten, not on
    the ORDER they were eaten in -- that is what makes dynamic programming work.

Step 3 - the table
    cost[S][j] = the smallest cost of leaving the den, eating exactly the
                 items in set S, and finishing at item j (j is in S).

    Recurrence (the last leg comes from some item i that was eaten before j):
        cost[S][j] = min over i in S-{j} of  cost[S-{j}][i] + T(i,j) * W_waiting
        where W_waiting = sum of w over items NOT in S-{j}   (j itself is still waiting)
    Base case (first leg, from the den, everybody is waiting):
        cost[{j}][j] = T(den,j) * W_all

    Sets are stored as bitmasks: bit k of the integer S is 1 if item k is in S.

Pseudocode (the [Lx] tags in the code below point back to these lines)
----------
    HELD-KARP-RACCOON(items, den, speed)
     1  T[i][j] <- travel time i -> j for every pair;  T0[j] <- travel time den -> j
     2  w[k] <- calories[k] / shelf_life[k]          for every item k
     3  W[S] <- sum of w[k] for k in S               for every subset S
     4  W_all <- W[ALL]
     5  for each item j:  cost[{j}][j] <- T0[j] * W_all
     6  for each subset S, smallest first (|S| >= 2)
     7      for each item j in S
     8          prev <- S - {j};   waiting <- W_all - W[prev]
     9          for each item i in prev
    10              c <- cost[prev][i] + T[i][j] * waiting
    11              if c < cost[S][j]:  cost[S][j] <- c;  parent[S][j] <- i
    12  last <- the j minimizing cost[ALL][j]
    13  follow parent[][] back from (ALL, last) to rebuild the route
    14  return route

Running time:  Theta(n^2 * 2^n)
    Line 6 loops over all 2^n subsets. For each one, line 7 checks all n
    items and line 9 checks all n items again, and line 10-11 is O(1).
    So lines 10-11 run 2^n * n * n times  ->  Theta(n^2 * 2^n).
    Line 1 is Theta(n^2), line 3 is Theta(2^n) (each W[S] reuses a smaller
    W), line 13 is Theta(n): all smaller, so they do not change the bound.

Memory:  Theta(n * 2^n)  -- the cost[][] and parent[][] tables have 2^n rows of n.

Why it is correct: optimal substructure. Take a best route that eats set S
and ends at j, coming from i. Its first part (eat S-{j}, end at i) must itself
be a cheapest way to do that: if a cheaper first part existed, we could swap
it in -- the last leg costs the same (it only depends on the set S-{j}, Step 2)
-- and get a cheaper route, a contradiction. Line 10 tries every possible i,
so it finds that best route. Filling smaller sets first (line 6) guarantees
cost[prev][i] is final before it is used, because S-{j} < S as an integer.

Compared with brute force (try all n! orders, Theta(n * n!)), Held-Karp shares
work between orders that visit the same SET of items, so it only needs
2^n * n table cells. Compared with Greedy (Theta(n^2)) it is much slower, but
it is always optimal.

Sources (verify yourselves before citing - course rule):
  M. Held and R. M. Karp, "A dynamic programming approach to sequencing
    problems", J. SIAM 10(1):196-210, 1962. doi:10.1137/0110015
  R. Bellman, "Dynamic programming treatment of the travelling salesman
    problem", J. ACM 9(1):61-63, 1962.
  A. Blum, P. Chalasani, D. Coppersmith, W. Pulleyblank, P. Raghavan, M. Sudan,
    "The minimum latency problem", STOC 1994, pp. 163-171.
    doi:10.1145/195058.195125   (defines the traveling repairman / latency objective)
"""
from __future__ import annotations

import math

from ..problem import Instance, Solution, distance, evaluate_route

KEY = "held_karp"
NAME = "Held-Karp DP"
TAGLINE = "plans the whole route before leaving"
TIME_COMPLEXITY = "Θ(n²·2ⁿ)"     # Θ(n²·2ⁿ)
MEMORY_COMPLEXITY = "Θ(n·2ⁿ)"

INF = math.inf


def growth(n: float) -> float:
    """Theoretical growth f(n) used for the trendline:  T(n) ~ a*n^2*2^n + b."""
    return n * n * 2.0 ** n


def solve(instance: Instance) -> Solution:
    """Find the route with the highest possible score (exact, exponential time)."""
    n = instance.n
    items = instance.items
    if n == 0:
        return evaluate_route(instance, [], KEY, {"plans_ahead": True, "table_cells": 0})

    # --- [L1] travel times between every pair of items, and from the den -----
    T = [[distance(a.position, b.position) / instance.speed for b in items] for a in items]
    T0 = [distance(instance.start, item.position) / instance.speed for item in items]

    # --- [L2] spoil weight of every item: calories lost per second of waiting -
    w = [item.food.spoil_weight for item in items]

    # --- [L3] W[S] = total spoil weight of the items in subset S --------------
    # Build each W[S] from a smaller set: S minus its lowest item.
    num_subsets = 1 << n                      # 2^n
    W = [0.0] * num_subsets
    for S in range(1, num_subsets):
        lowest_bit = S & -S                   # e.g. 0b10100 -> 0b00100
        k = lowest_bit.bit_length() - 1       # index of that item
        W[S] = W[S ^ lowest_bit] + w[k]
    ALL = num_subsets - 1                     # bitmask with every item in it
    W_all = W[ALL]                            # [L4]

    # --- the DP tables --------------------------------------------------------
    cost = [[INF] * n for _ in range(num_subsets)]
    parent = [[-1] * n for _ in range(num_subsets)]

    # [L5] base case: walk straight from the den to j while EVERY item waits
    for j in range(n):
        cost[1 << j][j] = T0[j] * W_all

    # [L6] every subset S, in increasing integer order (so S-{j} is always done first)
    for S in range(1, num_subsets):
        if S & (S - 1) == 0:
            continue                          # S has only one item: base case, already done
        for j in range(n):                    # [L7] j = the item eaten LAST in S
            if not (S >> j) & 1:
                continue
            prev = S ^ (1 << j)               # [L8] items eaten before j
            waiting = W_all - W[prev]         # [L8] spoil weight still on the map during the last leg
            best = INF
            best_i = -1
            prev_costs = cost[prev]
            for i in range(n):                # [L9] i = the item eaten just before j
                if (prev >> i) & 1:
                    c = prev_costs[i] + T[i][j] * waiting      # [L10]
                    if c < best:                               # [L11]
                        best = c
                        best_i = i
            cost[S][j] = best
            parent[S][j] = best_i

    # [L12] the cheapest way to eat everything, over every possible last item
    last = min(range(n), key=lambda j: cost[ALL][j])
    best_cost = cost[ALL][last]

    # [L13] walk the parent pointers backwards to recover the order
    route = []
    S, j = ALL, last
    while j != -1:
        route.append(j)
        S, j = S ^ (1 << j), parent[S][j]
    route.reverse()

    notes = {
        "plans_ahead": True,
        "table_cells": num_subsets * n,       # size of the DP table (2^n * n)
        "dp_min_cost": best_cost,             # equals Solution.spoilage_loss (checked in the tests)
    }
    return evaluate_route(instance, route, KEY, notes)   # [L14]
