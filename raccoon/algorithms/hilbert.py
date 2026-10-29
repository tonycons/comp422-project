# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
FASTEST BASELINE: Space-filling curve order (Hilbert curve)
===========================================================

Idea: a Hilbert curve is a single wiggly line that passes through every cell
of a grid, and points that are close together ON THE CURVE are close together
ON THE MAP. So: give every food item its position along the curve, sort, and
eat in that order. Short walks, almost no thinking -- but it completely
ignores calories and shelf lives.

Pseudocode (the [Lx] tags in the code point back to these lines)
----------
    HILBERT-RACCOON(items, den)
     1  for each item i:  h[i] <- HILBERT-INDEX(cell of item i)    # O(G) each, G = grid bits (constant)
     2  order <- items sorted by h                                  # Theta(n log n)
     3  s <- position in `order` of the item nearest the den        # Theta(n)
     4  A <- order read FORWARDS starting at s (wrapping around)     # Theta(n)
     5  B <- order read BACKWARDS starting at s (wrapping around)    # Theta(n)
     6  return whichever of A, B loses fewer calories               # Theta(n) to score each

Running time:  Theta(n log n)  -- the sort on line 2 dominates.
Memory:        Theta(n).
Quality:       for plain TSP tours, Platzman & Bartholdi report tours about 25%
               longer than optimal on random points; for the raccoon it is
               usually the worst of our algorithms because it never looks at food.

Source (verify before citing):
  L. K. Platzman and J. J. Bartholdi III, "Spacefilling curves and the planar
  travelling salesman problem", Journal of the ACM 36(4):719-737, 1989.
"""
from __future__ import annotations

from ..problem import Instance, Solution, distance, evaluate_route

KEY = "hilbert"
NAME = "Hilbert curve"
TAGLINE = "sorts food along a space-filling curve"
TIME_COMPLEXITY = "Θ(n log n)"
MEMORY_COMPLEXITY = "Θ(n)"
MAX_N = None
GROWTH_LABEL = "n log n"

GRID_BITS = 16      # the curve lives on a 2^16 x 2^16 grid (finer than any map we use)


def growth(n: float) -> float:
    import math
    return n * math.log2(max(n, 2.0))


def hilbert_index(x: int, y: int, bits: int = GRID_BITS) -> int:
    """Position of grid cell (x, y) along the Hilbert curve (classic xy -> d conversion).

    Works one bit-level at a time from the coarsest: decide which of the 4
    quadrants the cell is in, add that quadrant's offset, then rotate/flip the
    coordinates so the next level looks like the standard pattern again.
    """
    side = 1 << bits
    d = 0
    s = side >> 1
    while s > 0:
        rx = 1 if x & s else 0
        ry = 1 if y & s else 0
        d += s * s * ((3 * rx) ^ ry)          # which quadrant, in curve order
        if ry == 0:                            # rotate the quadrant into standard position
            if rx == 1:
                x = side - 1 - x
                y = side - 1 - y
            x, y = y, x
        s >>= 1
    return d


def solve(instance: Instance) -> Solution:
    n = instance.n
    if n == 0:
        return evaluate_route(instance, [], KEY, {"plans_ahead": True})
    side = 1 << GRID_BITS

    def cell(value: float, size: float) -> int:
        return min(side - 1, max(0, int(value / size * side)))

    # [L1] curve position of every item, [L2] sort by it
    keyed = [(hilbert_index(cell(it.x, instance.width), cell(it.y, instance.height)), it.id)
             for it in instance.items]
    keyed.sort()
    order = [item_id for _, item_id in keyed]

    # [L3] start at the item nearest the den
    s = min(range(n), key=lambda p: distance(instance.start, instance.items[order[p]].position))

    # [L4-L5] the curve is open, so treat it as a loop and try both directions
    forwards = order[s:] + order[:s]
    backwards = list(reversed(order[:s + 1])) + list(reversed(order[s + 1:]))

    # [L6] keep the better one
    a = evaluate_route(instance, forwards, KEY, {"plans_ahead": True})
    b = evaluate_route(instance, backwards, KEY, {"plans_ahead": True})
    return a if a.total_score >= b.total_score else b
