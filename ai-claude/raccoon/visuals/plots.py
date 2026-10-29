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
from ..algorithms import ALGORITHMS, BENCHMARK_ALGORITHMS
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


def _finish(fig, ax, title: str, out_path: Path, legend_cols: int = 1, legend_loc: str = "upper left") -> Path:
    ax.set_title(title, fontsize=theme.TITLE_SIZE, loc="left", pad=14, fontweight="bold")
    ax.tick_params(labelsize=theme.TICK_SIZE)
    ax.legend(fontsize=theme.LEGEND_SIZE - (1 if legend_cols > 1 else 0), loc=legend_loc, ncol=legend_cols)
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
    growth_text = algo.growth_label
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
    if len(sizes) <= 20 and sizes.max() <= 40:
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
    keys = list(keys)
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
        if len(keys) <= 3:     # end labels only while they cannot collide
            ax.annotate(f"n = {int(sizes[-1])}: {avg[-1]:.3g} s", (sizes[-1], avg[-1]),
                        xytext=(8, 0), textcoords="offset points", va="center",
                        fontsize=11, color=theme.INK_SECONDARY)
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("Instance size  n  (number of food items, log scale)", fontsize=theme.LABEL_SIZE)
    ax.set_ylabel("Average CPU time per run (seconds, log scale)", fontsize=theme.LABEL_SIZE)
    ax.margins(x=0.12)
    out_path = out_path or config.RESULTS_DIR / "plot_comparison.png"
    title = ("Average running time: Greedy vs. Held-Karp" if set(keys) == {"greedy", "held_karp"}
             else "Average running time of every algorithm")
    path = _finish(fig, ax, title, out_path, legend_cols=1,
                   legend_loc="lower right" if len(keys) > 3 else "upper left")
    plt.close(fig)
    return path


# -----------------------------------------------------------------------------
def make_all_plots(keys: Iterable[str] = BENCHMARK_ALGORITHMS) -> List[Path]:
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
    from ..tradeoff import summarize, tradeoff_csv_path
    if tradeoff_csv_path().exists():
        made.append(plot_tradeoff(summarize()))
    return made


# -----------------------------------------------------------------------------
# 4) Speed vs. quality (the satisficing study, python main.py tradeoff)
# -----------------------------------------------------------------------------
def plot_tradeoff(summary: dict, out_path: Optional[Path] = None) -> Path:
    """One small chart per map size: CPU time (x, log) vs. extra spoilage (y).

    Bottom-left is better. The shaded box is the aspiration region ("good
    enough and fast enough"); the dashed line joins the Pareto front.
    """
    from matplotlib.lines import Line2D
    from matplotlib.ticker import FuncFormatter
    from .. import config as cfg

    plt = _plt()
    sizes, keys, stats = summary["sizes"], summary["keys"], summary["stats"]
    rec = summary["recommended"]
    fig, axes = plt.subplots(1, len(sizes), figsize=(5.2 * len(sizes), 5.6), sharey=True, squeeze=False)
    axes = axes[0]
    all_times = [st["time_mean"] for st in stats.values()]
    x_lo, x_hi = min(all_times) / 2.5, max(max(all_times), cfg.SPEED_ASPIRATION_SECONDS) * 2.5
    y_hi = max(st["extra_mean"] for st in stats.values()) * 1.6 + 1

    for ax, n in zip(axes, sizes):
        largest = n == sizes[-1]
        x_edge = cfg.SPEED_ASPIRATION_SECONDS if largest else x_hi
        bar = summary.get("quality_bar", cfg.QUALITY_ASPIRATION_PCT)
        ax.fill_between([x_lo, x_edge], -0.5, bar, color=theme.FRESH, alpha=0.10, lw=0, zorder=0)
        ax.axhline(bar, color=theme.FRESH, lw=1, zorder=1)
        if largest:
            ax.axvline(cfg.SPEED_ASPIRATION_SECONDS, color=theme.FRESH, lw=1, zorder=1)
        front = summary["pareto"][n]
        ax.plot([stats[(k, n)]["time_mean"] for k in front], [stats[(k, n)]["extra_mean"] for k in front],
                color=theme.INK_MUTED, lw=1.2, ls=(0, (4, 3)), zorder=2)
        for key in keys:
            if (key, n) not in stats:
                continue
            st = stats[(key, n)]
            ax.plot(st["time_mean"], st["extra_mean"], linestyle="none",
                    marker=theme.ALGORITHM_MARKERS.get(key, "o"), ms=15 if key == "vnd" else 9,
                    color=theme.ALGORITHM_COLORS.get(key, theme.INK_SECONDARY),
                    markeredgecolor=theme.SURFACE, markeredgewidth=1.5, zorder=4)
            if key == rec:
                ax.plot(st["time_mean"], st["extra_mean"], linestyle="none", marker="o", ms=22,
                        markerfacecolor="none", markeredgecolor=theme.INK, markeredgewidth=1.5, zorder=5)
                if largest:
                    ax.annotate("most satisficing", (st["time_mean"], st["extra_mean"]), xytext=(14, 16),
                                textcoords="offset points", fontsize=11, color=theme.INK, fontweight="bold",
                                arrowprops=dict(arrowstyle="-", color=theme.INK, lw=1))
        ref = next(stats[(k, n)]["reference"] for k in keys if (k, n) in stats)
        ax.set_title(f"n = {n} food items", loc="left", fontsize=14, fontweight="bold", pad=22)
        ax.text(0, 1.012, f"compared with the {ref} route", transform=ax.transAxes, fontsize=10,
                color=theme.INK_MUTED, va="bottom")
        ax.set_xscale("log")
        ax.set_yscale("symlog", linthresh=2)
        ax.set_xlim(x_lo, x_hi)
        ax.set_ylim(-0.5, y_hi)
        ticks = sorted({0, 1, bar, 10, 30, 100} - {t for t in (30, 100) if t > y_hi})
        ax.set_yticks(ticks)
        ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _p: f"{v:g}%"))
        ax.set_xlabel("average CPU time per map (s, log scale)", fontsize=12)
        ax.tick_params(labelsize=11)
    axes[0].set_ylabel("extra calories lost to spoilage vs. best", fontsize=12)

    handles = [Line2D([], [], linestyle="none", marker=theme.ALGORITHM_MARKERS.get(k, "o"),
                      ms=13 if k == "vnd" else 9,
                      color=theme.ALGORITHM_COLORS.get(k, theme.INK_SECONDARY), markeredgecolor=theme.SURFACE,
                      label=ALGORITHMS[k].name) for k in keys]
    handles.append(Line2D([], [], color=theme.INK_MUTED, lw=1.2, ls=(0, (4, 3)), label="Pareto front"))
    bar = summary.get("quality_bar", cfg.QUALITY_ASPIRATION_PCT)
    relaxed = f", relaxed from {cfg.QUALITY_ASPIRATION_PCT:g}%" if summary.get("relaxed") else ""
    handles.append(Line2D([], [], color=theme.FRESH, lw=6, alpha=0.3,
                          label=f"good enough: ≤ {bar:g}% extra{relaxed}"
                                f" (and ≤ {cfg.SPEED_ASPIRATION_SECONDS:g} s at n = {sizes[-1]})"))
    fig.legend(handles=handles, loc="lower center", ncol=5, fontsize=10.5, frameon=False,
               bbox_to_anchor=(0.5, 0.0))
    fig.suptitle("Speed vs. quality: which algorithm is good enough, fast enough?  (lower-left is better)",
                 x=0.01, ha="left", fontsize=16, fontweight="bold")
    fig.tight_layout(rect=(0, 0.11, 1, 0.95))
    out_path = out_path or config.RESULTS_DIR / "plot_tradeoff_satisficing.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=theme.PLOT_DPI)
    plt.close(fig)
    return out_path
