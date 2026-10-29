# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
SAME ROUTE AS GREEDY, MUCH FASTER: Greedy with k-d trees
========================================================

Greedy (greedy.py, "ratio" formula) picks the item with the largest

        value(j) = w_j / travel_time(here, j)        w_j = calories lost per second

and it spends Theta(n) per step checking EVERY remaining item.

The trick: every item of the same food type has the same w. So among, say,
all the fish, the best one is simply the NEAREST fish. Keep one k-d tree
(a spatial search tree) per food type; each step ask each tree for its nearest
uneaten item, and pick the best of those few candidates. That is exactly the
item Greedy would pick -- the tests check that the routes are identical.

Pseudocode (the [Lx] tags in the code point back to these lines)
----------
    GREEDY-KD-RACCOON(items, den)
     1  for each food type f:  tree[f] <- BUILD-KD-TREE(items of type f)
     2  here <- den;  clock <- 0;  route <- empty
     3  repeat n times
     4      best <- NIL
     5      for each food type f with uneaten items           # T types (5 = a constant)
     6          j <- NEAREST(tree[f], here)                   # O(log n) expected
     7          if w_j / travel(here, j) > best value:  best <- j
     8      walk to best;  DELETE(tree[type of best], best)   # O(log n)
     9      append best to route
    10  return route

Running time:  O(n log^2 n) to build (we sort at each tree level) plus
               n steps x T queries x O(log n) expected  ->  O(n log^2 n) expected
               on uniformly random maps. Worst case (very unlucky layouts) a
               nearest-neighbor query can touch many nodes, up to O(n), so the
               worst case is still O(n^2). (Plots use n log^2 n for the fit.)
Memory:        Theta(n) for the trees.

Sources (verify before citing):
  J. L. Bentley, "Multidimensional binary search trees used for associative
    searching", Communications of the ACM 18(9):509-517, 1975.  (k-d trees;
    nearest-neighbor queries observed to take O(log n) on average)
  J. L. Bentley, "Fast algorithms for geometric traveling salesman problems",
    ORSA Journal on Computing 4(4):387-411, 1992.  (k-d trees with deletion to
    build nearest-neighbor tours in about O(n log n) on uniform data)
"""
from __future__ import annotations

import math
from typing import Dict, List

from ..problem import Instance, Solution, distance, evaluate_route
from .greedy import attractiveness_ratio

KEY = "greedy_kd"
NAME = "Greedy (k-d tree)"
TAGLINE = "same picks as Greedy, found with k-d trees"
TIME_COMPLEXITY = "O(n log² n) exp."
MEMORY_COMPLEXITY = "Θ(n)"
MAX_N = None
GROWTH_LABEL = "n log$^2$n"


def growth(n: float) -> float:
    lg = math.log2(max(n, 2.0))
    return n * lg * lg


# -----------------------------------------------------------------------------
# A small 2-D k-d tree that supports "nearest alive point" and "delete point".
# Stored as parallel lists (node number -> data) instead of node objects: it is
# a lot faster in Python and still easy to follow.
# -----------------------------------------------------------------------------
class KDTree:
    def __init__(self, points: List[tuple]):
        """points = [(x, y, item_id), ...]"""
        n = len(points)
        self.x = [0.0] * n            # point stored at each node
        self.y = [0.0] * n
        self.item = [0] * n
        self.axis = [0] * n           # 0 = split on x, 1 = split on y
        self.left = [-1] * n          # child node numbers (-1 = none)
        self.right = [-1] * n
        self.parent = [-1] * n
        self.alive = [0] * n          # how many not-yet-eaten points are in this subtree
        self.dead = [False] * n
        self.node_of: Dict[int, int] = {}
        self._next = 0
        self.root = self._build(list(points), depth=0, parent=-1)

    def _build(self, pts: List[tuple], depth: int, parent: int) -> int:
        if not pts:
            return -1
        axis = depth % 2
        pts.sort(key=lambda p: (p[axis], p[2]))          # sort along this level's axis
        mid = len(pts) // 2                               # the median becomes this node
        node = self._next
        self._next += 1
        px, py, pid = pts[mid]
        self.x[node], self.y[node], self.item[node] = px, py, pid
        self.axis[node], self.parent[node], self.alive[node] = axis, parent, len(pts)
        self.node_of[pid] = node
        self.left[node] = self._build(pts[:mid], depth + 1, node)
        self.right[node] = self._build(pts[mid + 1:], depth + 1, node)
        return node

    @property
    def remaining(self) -> int:
        return self.alive[self.root] if self.root >= 0 else 0

    def delete(self, item_id: int) -> None:
        """Mark a point as eaten and update the alive counts up to the root. O(depth)."""
        node = self.node_of[item_id]
        self.dead[node] = True
        while node >= 0:
            self.alive[node] -= 1
            node = self.parent[node]

    def nearest(self, qx: float, qy: float):
        """Closest alive point to (qx, qy). Returns (item_id, squared distance).

        Classic branch-and-bound: look in the child on the query's side of the
        splitting line first; only look on the other side if the splitting line
        itself is closer than the best point found so far. Subtrees with no
        alive points are skipped. Ties go to the smaller item id (like Greedy).
        """
        best_d2, best_item = math.inf, -1
        stack = [(self.root, 0.0)]      # (node, squared distance from query to the node's region)
        while stack:
            node, region_d2 = stack.pop()
            if node < 0 or self.alive[node] == 0 or region_d2 > best_d2:
                continue
            px, py = self.x[node], self.y[node]
            if not self.dead[node]:
                d2 = (px - qx) ** 2 + (py - qy) ** 2
                if d2 < best_d2 or (d2 == best_d2 and self.item[node] < best_item):
                    best_d2, best_item = d2, self.item[node]
            diff = (qx - px) if self.axis[node] == 0 else (qy - py)
            near, far = (self.left[node], self.right[node]) if diff < 0 else (self.right[node], self.left[node])
            stack.append((far, diff * diff))     # visited later, only if still worth it
            stack.append((near, 0.0))            # visited next
        return best_item, best_d2


# -----------------------------------------------------------------------------
def solve(instance: Instance) -> Solution:
    items = instance.items
    by_type: Dict[str, List[tuple]] = {}
    for it in items:
        by_type.setdefault(it.food.name, []).append((it.x, it.y, it.id))
    trees = {name: KDTree(points) for name, points in by_type.items()}      # [L1]

    here = instance.start                                                    # [L2]
    clock = 0.0
    route = []
    for _ in range(instance.n):                                              # [L3]
        best, best_value, best_travel = -1, -math.inf, 0.0                   # [L4]
        for tree in trees.values():                                          # [L5]
            if tree.remaining == 0:
                continue
            j, _d2 = tree.nearest(here[0], here[1])                          # [L6]
            travel = distance(here, items[j].position) / instance.speed      # same math as greedy.py
            value = attractiveness_ratio(items[j], travel, clock + travel)
            if value > best_value or (value == best_value and j < best):     # [L7]
                best, best_value, best_travel = j, value, travel
        clock += best_travel                                                 # [L8]
        here = items[best].position
        trees[items[best].food.name].delete(best)                            # [L8]
        route.append(best)                                                   # [L9]

    return evaluate_route(instance, route, KEY, {"plans_ahead": False})     # [L10]
