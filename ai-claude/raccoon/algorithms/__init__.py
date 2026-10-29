# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
Registry of algorithms.

The benchmark, the plots and the animation look algorithms up here by key
("greedy", "held_karp", ...). To add a new algorithm, write a module with the
same names (KEY, NAME, TAGLINE, TIME_COMPLEXITY, MEMORY_COMPLEXITY, MAX_N,
GROWTH_LABEL, growth, solve) and add it to the tuple at the bottom.

    hilbert          Theta(n log n)        fastest, ignores food           (baseline)
    greedy           Theta(n^2)            our straightforward algorithm
    greedy_kd        O(n log^2 n) exp.     identical routes to greedy, faster
    two_opt          greedy + 2-opt        local search
    balas_simonetti  greedy + linear-time restricted DP
    vnd              greedy + 2-opt <-> DP, taking turns
    held_karp        Theta(n^2 * 2^n)      exact optimum, small maps only
    brute_force      Theta(n * n!)         checker for the tests
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, Optional

from ..problem import Instance, Solution
from . import balas_simonetti, brute_force, greedy, greedy_kd, held_karp, hilbert, two_opt, vnd


@dataclass(frozen=True)
class AlgorithmInfo:
    key: str                                  # short id used in file names and the CLI
    name: str                                 # display name
    tagline: str                              # one-line description for the animation
    time_complexity: str                      # e.g. "Θ(n²)"
    memory_complexity: str
    growth: Callable[[float], float]          # f(n) for the theoretical trendline a*f(n) + b
    solve: Callable[[Instance], Solution]
    max_n: Optional[int] = None               # practical size limit (None = no limit)
    growth_label: str = "f(n)"                # f(n) written for plot legends (matplotlib mathtext)


def _info(module) -> AlgorithmInfo:
    return AlgorithmInfo(module.KEY, module.NAME, module.TAGLINE, module.TIME_COMPLEXITY,
                         module.MEMORY_COMPLEXITY, module.growth, module.solve,
                         getattr(module, "MAX_N", None), getattr(module, "GROWTH_LABEL", "f(n)"))


ALGORITHMS: Dict[str, AlgorithmInfo] = {
    info.key: info for info in map(_info, (hilbert, greedy, greedy_kd, two_opt,
                                           balas_simonetti, vnd, held_karp, brute_force))
}

MAIN_ALGORITHMS = ("greedy", "held_karp")    # the two in our original README
BENCHMARK_ALGORITHMS = ("hilbert", "greedy", "greedy_kd", "two_opt", "balas_simonetti", "vnd",
                        "held_karp")         # what `python main.py benchmark` runs by default


def plain_text(math_text: str) -> str:
    """'Θ(n²·2ⁿ)' -> 'Theta(n^2*2^n)' so it prints safely in any terminal."""
    for fancy, plain in (("\u0398", "Theta"), ("\u00b2", "^2"), ("\u207f", "^n"), ("\u00b7", "*"),
                         ("\u1d4f", "^k"), ("\u21c4", "<->")):
        math_text = math_text.replace(fancy, plain)
    return math_text
