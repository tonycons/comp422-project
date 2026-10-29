# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
Set up a race: one map, every chosen algorithm solves it (and we time it),
results ready to draw or export.
"""
from __future__ import annotations

import json
import random
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

from . import config
from .algorithms import ALGORITHMS, greedy, plain_text
from .benchmark import time_cpu
from .generator import generate_instance
from .problem import Instance, Solution

DISPLAY_TIMING_SECONDS = 0.05   # re-run tiny solves until this much CPU time passes (accurate ms)


def race_keys(n: int, keys: Optional[Sequence[str]] = None) -> List[str]:
    """The algorithms to race on a map with n items (too-slow ones are left out)."""
    chosen = []
    for key in (keys or config.RACE_ALGORITHMS):
        limit = config.HELD_KARP_MAX_N if key == "held_karp" else ALGORITHMS[key].max_n
        if limit is None or n <= limit:
            chosen.append(key)
        else:
            print(f"  (leaving out {ALGORITHMS[key].name}: n = {n} is above its limit of {limit})")
    return chosen


def solve_all(instance: Instance, keys: Sequence[str]) -> List[Solution]:
    """Run (and time) each algorithm on the same map.

    notes["cpu_seconds"] = CPU time of one solve (what the animation shows as
    "planning time"). Greedy is re-run once with its decisions recorded so the
    animation can show it "thinking" -- that extra run is not timed.
    """
    solutions = []
    for key in keys:
        algo = ALGORITHMS[key]
        seconds, _repeats, solution = time_cpu(algo.solve, instance, DISPLAY_TIMING_SECONDS)
        if key == "greedy":
            solution = greedy.solve(instance, record_decisions=True)
        solution.notes["cpu_seconds"] = seconds
        solutions.append(solution)
    return solutions


def make_race(n: int, seed: Optional[int] = None,
              keys: Optional[Sequence[str]] = None) -> Tuple[Instance, List[Solution]]:
    if seed is None:
        seed = random.randrange(1_000_000)
    instance = generate_instance(n, seed=seed)
    return instance, solve_all(instance, race_keys(n, keys))


def print_summary(instance: Instance, solutions: Sequence[Solution]) -> None:
    best = min(s.spoilage_loss for s in solutions)
    print(f"\nMap seed {instance.seed}: {instance.n} food items, "
          f"{instance.total_calories:,.0f} calories if eaten instantly")
    print(f"  {'algorithm':<28} {'score':>9} {'spoiled':>8} {'vs best':>8} {'compute':>12}")
    for s in solutions:
        name = plain_text(ALGORITHMS[s.algorithm].name)
        gap = (s.spoilage_loss / best - 1) * 100 if best > 0 else 0.0
        ms = s.notes.get("cpu_seconds", 0.0) * 1000
        print(f"  {name:<28} {s.total_score:9,.0f} {s.spoiled_count:>8} {gap:>7.1f}% {ms:>9.3f} ms")


def export_json(instance: Instance, solutions: Sequence[Solution], path: Path) -> Path:
    """Write the map and every route to JSON, for a different front end (web, Unity, ...)."""
    data = {
        "map": {"width": instance.width, "height": instance.height, "den": list(instance.start),
                "speed": instance.speed, "seed": instance.seed},
        "items": [{"id": it.id, "x": it.x, "y": it.y, "food": it.food.name,
                   "calories": it.food.calories, "shelf_life": it.food.shelf_life}
                  for it in instance.items],
        "solutions": [{"algorithm": s.algorithm, "order": s.order,
                       "arrival_times": s.arrival_times, "item_scores": s.item_scores,
                       "total_score": s.total_score, "spoilage_loss": s.spoilage_loss,
                       "total_time": s.total_time, "spoiled_count": s.spoiled_count,
                       "cpu_seconds": s.notes.get("cpu_seconds")}
                      for s in solutions],
    }
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return path
