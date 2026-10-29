# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
Set up a race: one map, every algorithm solves it, results ready to draw or export.
"""
from __future__ import annotations

import json
import random
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

from .algorithms import ALGORITHMS, MAIN_ALGORITHMS, greedy
from .generator import generate_instance
from .problem import Instance, Solution


def solve_all(instance: Instance, keys: Sequence[str] = MAIN_ALGORITHMS) -> List[Solution]:
    """Run each algorithm on the same instance. Greedy records its decisions for the animation."""
    solutions = []
    for key in keys:
        if key == "greedy":
            solutions.append(greedy.solve(instance, record_decisions=True))
        else:
            solutions.append(ALGORITHMS[key].solve(instance))
    return solutions


def make_race(n: int, seed: Optional[int] = None,
              keys: Sequence[str] = MAIN_ALGORITHMS) -> Tuple[Instance, List[Solution]]:
    if seed is None:
        seed = random.randrange(1_000_000)
    instance = generate_instance(n, seed=seed)
    return instance, solve_all(instance, keys)


def print_summary(instance: Instance, solutions: Sequence[Solution]) -> None:
    print(f"\nMap seed {instance.seed}: {instance.n} food items, "
          f"{instance.total_calories:,.0f} calories if eaten instantly")
    for s in solutions:
        name = ALGORITHMS[s.algorithm].name
        print(f"  {name:<13} score {s.total_score:9,.1f} cal   lost to spoilage {s.spoilage_loss:8,.1f}"
              f"   spoiled {s.spoiled_count:>2}   finished at {s.total_time:6.1f} s"
              f"   route {s.order}")


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
                       "total_time": s.total_time, "spoiled_count": s.spoiled_count}
                      for s in solutions],
    }
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return path
