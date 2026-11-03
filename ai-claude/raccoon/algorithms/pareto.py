# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
Pareto fronts of (time, loss) "labels" -- shared by held_karp.py and
balas_simonetti.py.

Why the DPs need this
---------------------
Spoiled food is worth 0, so an item's loss is  w * min(arrival time, shelf life):
it depends on the exact clock time, not just on the order. Two partial routes
that ate the same items and stand at the same place can therefore differ in
BOTH the loss so far AND the current time, and neither number alone tells us
which one will end up better. So a DP cell keeps a short list of labels
(time, loss, back-pointer...) and throws away only labels that can never win.

When can a label be thrown away?  ("A dominates B")
  Rule 1 (plain Pareto):  A is no later and no more expensive than B.
      Any way of finishing from B also works from A, reaching every remaining
      item no later, and losses never shrink with time.
  Rule 2 (time is worth at most W_live per second):  A is LATER than B by
      d seconds, but  loss_A + d * W_live(time_B) <= loss_B.
      Finishing from A along B's best remaining route reaches every remaining
      item exactly d seconds later. An item that is still fresh at that point
      loses at most w * d extra; an item that has already spoiled by time_B
      loses nothing extra. So A costs at most d * W_live(time_B) more than B
      afterwards, where W_live(t) = total spoil weight of the remaining items
      whose shelf life is longer than t -- and A started that much cheaper.

Rule 2 is what keeps the lists short. (If nothing could ever spoil, Rule 2
would leave exactly one label per cell: the classic Held-Karp table.)
"""
from __future__ import annotations

from typing import Callable, List, Optional, Sequence

EPS = 1e-9   # treat values this close as equal (so float-noise twins are not both kept)


def pareto_front(labels: Sequence[tuple],
                 w_live: Optional[Callable[[float], float]] = None) -> List[tuple]:
    """Keep only labels that no other label dominates (see the module docstring).

    labels  : tuples whose first two entries are (time, loss)
    w_live  : w_live(t) = spoil weight of the remaining items still fresh at time t.
              If None, only Rule 1 is used.
    Returns the survivors sorted by time. O(m log m + m * f) for m labels and
    f survivors (f is small).
    """
    kept: List[tuple] = []
    for label in sorted(labels, key=lambda lab: (lab[0], lab[1])):
        t, loss = label[0], label[1]
        # Rule 1: every kept label is no later than this one. Kept losses always
        # decrease (each new keeper is cheaper than all before it), so the last
        # kept label is the cheapest one to compare against.
        if kept and kept[-1][1] <= loss + EPS:
            continue
        # Rule 2: this later-but-cheaper label may beat some earlier ones.
        if w_live is not None:
            kept = [k for k in kept if loss + (t - k[0]) * w_live(k[0]) > k[1] - EPS]
        kept.append(label)
    return kept


def live_weight_function(remaining_shelf_weight: Sequence[tuple]) -> Callable[[float], float]:
    """Build W_live(t) from [(shelf_life, total spoil weight of remaining items with it), ...].

    There are only a few food types, so a short loop is fast enough.
    """
    pairs = list(remaining_shelf_weight)

    def w_live(t: float) -> float:
        return sum(weight for shelf, weight in pairs if shelf > t)

    return w_live
