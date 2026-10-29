# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
Random problem instances for the demo and the benchmark.

Each instance is fully determined by (n, seed), so any result can be
reproduced exactly by re-running with the same seed.
"""
from __future__ import annotations

import random
from typing import Optional, Sequence

from . import config
from .problem import FoodItem, FoodType, Instance


def generate_instance(n: int,
                      seed: Optional[int] = None,
                      food_types: Sequence[FoodType] = None,
                      width: float = None,
                      height: float = None,
                      start=None,
                      speed: float = None) -> Instance:
    """Scatter n food items uniformly at random over the map.

    Any argument left as None falls back to the value in config.py.
    """
    food_types = list(food_types or config.FOOD_TYPES)
    width = config.MAP_WIDTH if width is None else width
    height = config.MAP_HEIGHT if height is None else height
    start = config.DEN_POSITION if start is None else start
    speed = config.RACCOON_SPEED if speed is None else speed

    rng = random.Random(seed)   # private generator: does not disturb global randomness
    items = [
        FoodItem(
            id=i,
            x=rng.uniform(0.0, width),
            y=rng.uniform(0.0, height),
            food=rng.choice(food_types),
        )
        for i in range(n)
    ]
    return Instance(items=items, start=tuple(start), speed=speed,
                    width=width, height=height, seed=seed)


def benchmark_seed(n: int, k: int) -> int:
    """Seed for the k-th random instance of size n (see config.BASE_SEED)."""
    return config.BASE_SEED + 1000 * n + k
