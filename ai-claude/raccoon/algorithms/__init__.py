# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
Registry of algorithms.

The benchmark, the plots and the animation look algorithms up here by key
("greedy", "held_karp", ...). To add a new algorithm, write a module with the
same names (KEY, NAME, TAGLINE, TIME_COMPLEXITY, MEMORY_COMPLEXITY, growth,
solve) and add it to the tuple at the bottom.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict

from ..problem import Instance, Solution
from . import brute_force, greedy, held_karp


@dataclass(frozen=True)
class AlgorithmInfo:
    key: str                                  # short id used in file names and the CLI
    name: str                                 # display name
    tagline: str                              # one-line description for the animation
    time_complexity: str                      # e.g. "Θ(n²)"
    memory_complexity: str
    growth: Callable[[float], float]          # f(n) for the theoretical trendline a*f(n) + b
    solve: Callable[[Instance], Solution]


def _info(module) -> AlgorithmInfo:
    return AlgorithmInfo(module.KEY, module.NAME, module.TAGLINE, module.TIME_COMPLEXITY,
                         module.MEMORY_COMPLEXITY, module.growth, module.solve)


ALGORITHMS: Dict[str, AlgorithmInfo] = {
    info.key: info for info in (_info(greedy), _info(held_karp), _info(brute_force))
}

MAIN_ALGORITHMS = ("greedy", "held_karp")    # the two our project is about


def plain_text(math_text: str) -> str:
    """'Θ(n²·2ⁿ)' -> 'Theta(n^2*2^n)' so it prints safely in any terminal."""
    for fancy, plain in (("Θ", "Theta"), ("²", "^2"), ("ⁿ", "^n"), ("·", "*")):
        math_text = math_text.replace(fancy, plain)
    return math_text
