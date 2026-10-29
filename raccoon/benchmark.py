# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
Benchmark: CPU time vs. instance size, as the project spec asks.

For every algorithm and every size n in config.BENCHMARK_SIZES:
  * generate INSTANCES_PER_SIZE (>= 10) random instances (reproducible seeds),
  * measure the CPU time (time.process_time) of solving each one,
  * write one row per instance to  results/runtime_<algorithm>.csv.

It also writes results/quality.csv: for every Held-Karp instance, how good the
greedy route was compared with the optimal one.
"""
from __future__ import annotations

import csv
import gc
import sys
import time
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Tuple

from . import config
from .algorithms import ALGORITHMS, MAIN_ALGORITHMS, plain_text
from .generator import benchmark_seed, generate_instance
from .problem import Instance, Solution

RUNTIME_FIELDS = ["algorithm", "n", "seed", "cpu_seconds", "repeats", "score", "spoiled"]
QUALITY_FIELDS = ["n", "seed", "greedy_score", "optimal_score",
                  "greedy_spoilage_loss", "optimal_spoilage_loss", "loss_ratio"]


def runtime_csv_path(key: str) -> Path:
    return config.RESULTS_DIR / f"runtime_{key}.csv"


def quality_csv_path() -> Path:
    return config.RESULTS_DIR / "quality.csv"


# -----------------------------------------------------------------------------
# Timing one instance
# -----------------------------------------------------------------------------
def time_cpu(solve: Callable[[Instance], Solution], instance: Instance,
             min_seconds: float) -> Tuple[float, int, Solution]:
    """CPU seconds for ONE run of solve(instance).

    Small instances finish faster than the CPU clock can tick (about 16 ms
    on Windows), so we repeat the run until at least `min_seconds` of CPU time
    has passed and divide by the number of repeats. The garbage collector is
    paused while timing (like Python's `timeit`) so it doesn't add random spikes.
    """
    gc_was_on = gc.isenabled()
    gc.collect()
    gc.disable()
    try:
        repeats = 0
        start = time.process_time()
        while True:
            solution = solve(instance)
            repeats += 1
            elapsed = time.process_time() - start
            if elapsed >= min_seconds:
                break
    finally:
        if gc_was_on:
            gc.enable()
    return elapsed / repeats, repeats, solution


# -----------------------------------------------------------------------------
# Running a whole benchmark
# -----------------------------------------------------------------------------
def _progress(label: str, n: int, done: int, total: int, avg: Optional[float]) -> None:
    bar = "#" * done + "." * (total - done)
    avg_text = f"avg {avg * 1000:9.3f} ms" if avg is not None else ""
    sys.stdout.write(f"\r  {label:<13} n={n:<5} [{bar}] {done:>2}/{total}  {avg_text}")
    sys.stdout.flush()


def run_benchmark(keys: Iterable[str] = MAIN_ALGORITHMS, quick: bool = False) -> Dict[str, Path]:
    """Benchmark the given algorithms and write their CSV files. Returns {key: csv path}."""
    sizes_table = config.QUICK_BENCHMARK_SIZES if quick else config.BENCHMARK_SIZES
    min_seconds = config.QUICK_MIN_TIMED_SECONDS if quick else config.MIN_TIMED_SECONDS
    per_size = config.INSTANCES_PER_SIZE
    config.RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    written: Dict[str, Path] = {}
    quality_rows: List[dict] = []
    greedy = ALGORITHMS["greedy"]

    for key in keys:
        algo = ALGORITHMS[key]
        sizes = sizes_table[key]
        print(f"\n{algo.name}  {plain_text(algo.time_complexity)}"
              f"  - sizes {sizes[0]}..{sizes[-1]}, {per_size} instances each")
        rows: List[dict] = []
        for n in sizes:
            times = []
            for k in range(per_size):
                seed = benchmark_seed(n, k)
                instance = generate_instance(n, seed=seed)
                seconds, repeats, solution = time_cpu(algo.solve, instance, min_seconds)
                times.append(seconds)
                rows.append({"algorithm": key, "n": n, "seed": seed,
                             "cpu_seconds": f"{seconds:.9f}", "repeats": repeats,
                             "score": f"{solution.total_score:.3f}",
                             "spoiled": solution.spoiled_count})
                if key == "held_karp":
                    # Same instance, greedy route: how close to optimal is it?
                    g = greedy.solve(instance)
                    ratio = (g.spoilage_loss / solution.spoilage_loss
                             if solution.spoilage_loss > 0 else 1.0)
                    quality_rows.append({"n": n, "seed": seed,
                                         "greedy_score": f"{g.total_score:.3f}",
                                         "optimal_score": f"{solution.total_score:.3f}",
                                         "greedy_spoilage_loss": f"{g.spoilage_loss:.3f}",
                                         "optimal_spoilage_loss": f"{solution.spoilage_loss:.3f}",
                                         "loss_ratio": f"{ratio:.6f}"})
                _progress(algo.name, n, k + 1, per_size, sum(times) / len(times))
            print()
        path = runtime_csv_path(key)
        _write_csv(path, RUNTIME_FIELDS, rows)
        written[key] = path
        print(f"  -> wrote {path}")

    if quality_rows:
        _write_csv(quality_csv_path(), QUALITY_FIELDS, quality_rows)
        written["quality"] = quality_csv_path()
        print(f"  -> wrote {quality_csv_path()}")
    return written


# -----------------------------------------------------------------------------
# CSV helpers
# -----------------------------------------------------------------------------
def _write_csv(path: Path, fields: List[str], rows: List[dict]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def read_csv(path: Path) -> List[dict]:
    """Read a results CSV back as a list of dicts (numbers converted to float)."""
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        for k, v in row.items():
            try:
                row[k] = float(v)
            except (TypeError, ValueError):
                pass
    return rows
