# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
Benchmark charts (what the project spec asks for).

For each algorithm:  a scatter plot of CPU time vs. instance size, one dot per
instance, with two lines on top:
  1. the average running time for each size,
  2. a trendline fitted to the THEORETICAL running time:  T(n) = a * f(n) + b
     where f(n) = n^2 for Greedy and n^2 * 2^n for Held-Karp
     (a and b found by least squares; R^2 shows how well theory matches data).

Extras: Held-Karp on a log scale, Greedy-vs-optimal quality, and a side-by-side
comparison. All read the CSVs written by benchmark.py, so you can restyle and
re-draw without re-running the benchmark:   python main.py plots
"""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np

from .. import config
from ..algorithms import ALGORITHMS, MAIN_ALGORITHMS
from ..benchmark import quality_csv_path, read_csv, runtime_csv_path
from . import theme


def _plt():
    import matplotlib.pyplot as plt
    theme.apply_matplotlib_style()
    return plt


# -----------------------------------------------------------------------------
# Small helpers
# -----------------------------------------------------------------------------
def fit_theory(n: np.ndarray, t: np.ndarray, growth) -> Tuple[float, float, float]:
    """Least-squares fit of  t = a * growth(n) + b.  Returns (a, b, R^2)."""
    f = np.array([growth(float(v)) for v in n])
    A = np.column_stack([f, np.ones_like(f)])
    (a, b), *_ = np.linalg.lstsq(A, t, rcond=None)
    predicted = A @ np.array([a, b])
    ss_res = float(np.sum((t - predicted) ** 2))
    ss_tot = float(np.sum((t - t.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 1.0
    return float(a), float(b), r2


def averages_by_size(n: np.ndarray, values: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    groups: Dict[float, List[float]] = defaultdict(list)
    for x, y in zip(n, values):
        groups[x].append(y)
    sizes = np.array(sorted(groups))
    return sizes, np.array([np.mean(groups[s]) for s in sizes])


def _time_unit(max_seconds: float) -> Tuple[float, str]:
    """Pick milliseconds or seconds so the axis numbers are readable."""
    return (1000.0, "ms") if max_seconds < 1.0 else (1.0, "s")


def _sci(x: float) -> str:
    """1.23e-07 -> '1.23×10⁻⁷' style text for legends."""
    if x == 0:
        return "0"
    mantissa, exponent = f"{x:.3g}".split("e") if "e" in f"{x:.3g}" else (f"{x:.3g}", None)
    if exponent is None:
        return mantissa
    return f"{mantissa}×10$^{{{int(exponent)}}}$"


def _finish(fig, ax, title: str, out_path: Path) -> Path:
    ax.set_title(title, fontsize=theme.TITLE_SIZE, loc="left", pad=14, fontweight="bold")
    ax.tick_params(labelsize=theme.TICK_SIZE)
    ax.legend(fontsize=theme.LEGEND_SIZE, loc="upper left")
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=theme.PLOT_DPI)
    return out_path


# -----------------------------------------------------------------------------
# 1) Runtime plot for one algorithm (the one the spec requires)
# -----------------------------------------------------------------------------
def plot_runtime(key: str, log_y: bool = False, out_path: Optional[Path] = None) -> Path:
    plt = _plt()
    algo = ALGORITHMS[key]
    rows = read_csv(runtime_csv_path(key))
    n = np.array([r["n"] for r in rows], dtype=float)
    t = np.array([r["cpu_seconds"] for r in rows], dtype=float)

    a, b, r2 = fit_theory(n, t, algo.growth)
    sizes, avg = averages_by_size(n, t)
    scale, unit = _time_unit(t.max())
    color = theme.ALGORITHM_COLORS.get(key, theme.INK_SECONDARY)
    per_size = int(round(len(rows) / len(sizes)))

    fig, ax = plt.subplots(figsize=theme.PLOT_SIZE)
    # 1. every instance
    ax.scatter(n, t * scale, s=theme.SCATTER_SIZE, color=color, alpha=theme.SCATTER_ALPHA,
               edgecolors="none", label=f"One random instance ({per_size} per size)", zorder=2)
    # 2. average per size
    ax.plot(sizes, avg * scale, color=theme.AVERAGE_COLOR, lw=2, marker="o", ms=6,
            markerfacecolor=theme.AVERAGE_COLOR, markeredgecolor=theme.SURFACE, markeredgewidth=1.5,
            label="Average for each size", zorder=4)
    # 3. theoretical trendline
    n_dense = np.linspace(n.min(), n.max(), 400)
    fit = np.array([a * algo.growth(v) + b for v in n_dense])
    if log_y:
        keep = fit > 0
        n_dense, fit = n_dense[keep], fit[keep]
    growth_text = {"greedy": "n$^2$", "held_karp": "n$^2$·2$^n$", "brute_force": "n·n!"}.get(key, "f(n)")
    sign = "+" if b >= 0 else "−"
    ax.plot(n_dense, fit * scale, color=theme.FIT_COLOR, lw=2, ls=(0, (6, 4)), zorder=3,
            label=f"Theory fit {algo.time_complexity}:  {_sci(a * scale)}·{growth_text}"
                  f" {sign} {_sci(abs(b) * scale)}   (R$^2$ = {r2:.4f})")

    ax.set_xlabel("Instance size  n  (number of food items)", fontsize=theme.LABEL_SIZE)
    ax.set_ylabel(f"CPU time per run ({unit}{', log scale' if log_y else ''})", fontsize=theme.LABEL_SIZE)
    if log_y:
        ax.set_yscale("log")
    else:
        ax.set_ylim(bottom=0)
    ax.set_xlim(n.min() - (n.max() - n.min()) * 0.03, n.max() + (n.max() - n.min()) * 0.03)
    if key != "greedy":
        ax.set_xticks(sizes)

    title = f"{algo.name}: running time vs. instance size"
    out_path = out_path or config.RESULTS_DIR / f"plot_runtime_{key}{'_log' if log_y else ''}.png"
    path = _finish(fig, ax, title, out_path)
    plt.close(fig)
    return path


# -----------------------------------------------------------------------------
# 2) How good is Greedy compared with the optimum?
# -----------------------------------------------------------------------------
def plot_quality(out_path: Optional[Path] = None) -> Path:
    plt = _plt()
    rows = read_csv(quality_csv_path())
    n = np.array([r["n"] for r in rows], dtype=float)
    ratio = np.array([r["loss_ratio"] for r in rows], dtype=float)
    sizes, avg = averages_by_size(n, ratio)

    fig, ax = plt.subplots(figsize=theme.PLOT_SIZE)
    ax.axhline(1.0, color=theme.ALGORITHM_COLORS["held_karp"], lw=2, zorder=1,
               label="Held-Karp (always optimal = 1.0)")
    ax.scatter(n, ratio, s=theme.SCATTER_SIZE, color=theme.ALGORITHM_COLORS["greedy"],
               alpha=theme.SCATTER_ALPHA, edgecolors="none", zorder=2,
               label="Greedy, one random instance")
    ax.plot(sizes, avg, color=theme.AVERAGE_COLOR, lw=2, marker="o", ms=6,
            markeredgecolor=theme.SURFACE, markeredgewidth=1.5, zorder=3,
            label="Greedy, average for each size")
    ax.set_xticks(sizes)
    ax.set_ylim(bottom=0.95)
    ax.set_xlabel("Instance size  n  (number of food items)", fontsize=theme.LABEL_SIZE)
    ax.set_ylabel("Calories lost to spoilage, ÷ optimal", fontsize=theme.LABEL_SIZE)
    ax.text(0.99, 0.02, "1.20 = Greedy lets 20% more calories rot than the best route",
            transform=ax.transAxes, ha="right", va="bottom", fontsize=11, color=theme.INK_MUTED)
    out_path = out_path or config.RESULTS_DIR / "plot_quality_greedy_vs_optimal.png"
    path = _finish(fig, ax, "How close does Greedy get to the optimal route?", out_path)
    plt.close(fig)
    return path


# -----------------------------------------------------------------------------
# 3) Both algorithms on one chart (log-log)
# -----------------------------------------------------------------------------
def plot_comparison(keys: Iterable[str], out_path: Optional[Path] = None) -> Path:
    plt = _plt()
    fig, ax = plt.subplots(figsize=theme.PLOT_SIZE)
    for key in keys:
        algo = ALGORITHMS[key]
        rows = read_csv(runtime_csv_path(key))
        n = np.array([r["n"] for r in rows], dtype=float)
        t = np.array([r["cpu_seconds"] for r in rows], dtype=float)
        sizes, avg = averages_by_size(n, t)
        color = theme.ALGORITHM_COLORS.get(key, theme.INK_SECONDARY)
        ax.plot(sizes, avg, color=color, lw=2, marker="o", ms=6, markeredgecolor=theme.SURFACE,
                markeredgewidth=1.5, label=f"{algo.name}  {algo.time_complexity}")
        ax.annotate(f"n = {int(sizes[-1])}: {avg[-1]:.3g} s", (sizes[-1], avg[-1]),
                    xytext=(8, 0), textcoords="offset points", va="center",
                    fontsize=11, color=theme.INK_SECONDARY)
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("Instance size  n  (number of food items, log scale)", fontsize=theme.LABEL_SIZE)
    ax.set_ylabel("Average CPU time per run (seconds, log scale)", fontsize=theme.LABEL_SIZE)
    ax.margins(x=0.12)
    out_path = out_path or config.RESULTS_DIR / "plot_comparison.png"
    path = _finish(fig, ax, "Average running time: Greedy vs. Held-Karp", out_path)
    plt.close(fig)
    return path


# -----------------------------------------------------------------------------
def make_all_plots(keys: Iterable[str] = MAIN_ALGORITHMS) -> List[Path]:
    """Draw every chart whose data exists. Returns the list of PNG paths."""
    made: List[Path] = []
    available = [k for k in keys if runtime_csv_path(k).exists()]
    for key in available:
        made.append(plot_runtime(key))
        if key in ("held_karp", "brute_force"):
            made.append(plot_runtime(key, log_y=True))
    if quality_csv_path().exists():
        made.append(plot_quality())
    if len(available) >= 2:
        made.append(plot_comparison(available))
    return made
