# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
# =============================================================================
"""The Greedy Raccoon - COMP 422 algorithms project.

Package layout
    problem.py      the rules: food, instances, scoring a route
    config.py       every tunable number (map size, food types, benchmark sizes)
    generator.py    random instances
    algorithms/     hilbert, greedy, greedy_kd, two_opt, balas_simonetti, vnd,
                    held_karp (+ brute_force for checking) - see algorithms/__init__.py
    benchmark.py    CPU-time measurements -> results/*.csv
    tradeoff.py     speed-vs-quality study ("which algorithm is good enough?")
    race.py         one map, every algorithm, timed - feeds the animation
    visuals/        theme.py (looks), animate.py (the race), plots.py (runtime charts)
"""
