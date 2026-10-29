# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
"The race": watch the algorithms in action, side by side, on the same map.

    +-----------+-----------+-----------+-----------+
    |  Hilbert  |  Greedy   |  2-opt    |  B-S DP   |   one map panel per algorithm
    +-----------+-----------+-----------+-----------+   (config.RACE_ALGORITHMS)
    |  VND      | Held-Karp |  calories banked      |   timeline fills the free cells
    +-----------+-----------+-----------------------+

Two phases:
  1. PLANNING - each panel shows a bar for how much CPU time its algorithm
     needed to compute the route. The slowest one fills PLANNING_SECONDS of
     screen time; the others finish in proportion (theme.PLANNING_SCALE).
  2. WALKING  - all raccoons leave the den together and eat their routes.

Live window keys:  SPACE pause/resume  |  R restart  |  N new random map
                   LEFT / RIGHT step when paused  |  Q close

How it is built (so you can replace pieces):
  * MapMarker   - one thing on the map, drawn as a shape OR a sprite PNG
  * RacePanel   - one algorithm's map; draw_planning(f) and draw_at(t)
  * Timeline    - the score-over-time chart; draw_planning(f) and draw_at(t)
  * RaceAnimation - builds the figure, runs the clock, saves GIF/MP4/PNG
Everything takes the same inputs: an Instance and a list of Solutions. A
completely different front end (web page, game engine) can be fed the same
data via  python main.py demo --export results/race.json
"""
from __future__ import annotations

import time
from pathlib import Path
import math
from typing import Callable, List, Optional, Sequence, Tuple

import numpy as np

from ..algorithms import ALGORITHMS
from ..problem import Instance, Solution
from . import theme

NewRaceFn = Callable[[], Tuple[Instance, List[Solution]]]


def _plt():
    import matplotlib.pyplot as plt
    theme.apply_matplotlib_style()
    return plt


# =============================================================================
# One thing on the map: a shape, or a picture if assets/sprites/<name>.png exists
# =============================================================================
class MapMarker:
    def __init__(self, ax, xy, sprite_name: str, color: str, marker: str, size: float, zorder: int):
        self.sprite = theme.sprite_path(sprite_name)
        if self.sprite is not None:
            import matplotlib.image as mpimg
            from matplotlib.offsetbox import AnnotationBbox, OffsetImage
            self._image = OffsetImage(mpimg.imread(str(self.sprite)), zoom=theme.SPRITE_ZOOM)
            self._box = AnnotationBbox(self._image, xy, frameon=False, zorder=zorder)
            ax.add_artist(self._box)
            self._shape = None
        else:
            (self._shape,) = ax.plot([xy[0]], [xy[1]], linestyle="none", marker=marker,
                                     markersize=size, markerfacecolor=color,
                                     markeredgecolor=theme.SURFACE, markeredgewidth=1.8,
                                     zorder=zorder)

    def move_to(self, xy) -> None:
        if self._shape is not None:
            self._shape.set_data([xy[0]], [xy[1]])
        else:
            self._box.xy = (xy[0], xy[1])       # the anchor point...
            self._box.xybox = (xy[0], xy[1])    # ...and where the picture is drawn

    def set_alpha(self, alpha: float) -> None:
        if self._shape is not None:
            self._shape.set_alpha(alpha)
        else:
            self._image.image.set_alpha(alpha)

    def set_color(self, color: str) -> None:
        if self._shape is not None:          # sprites keep their own colors
            self._shape.set_markerfacecolor(color)


# =============================================================================
# One algorithm's map
# =============================================================================
class RacePanel:
    def __init__(self, ax, instance: Instance, solution: Solution, best_loss: float,
                 text_scale: float = 1.0):
        self.ax = ax
        self.instance = instance
        self.solution = solution
        self.algo = ALGORITHMS[solution.algorithm]
        self.color = theme.ALGORITHM_COLORS.get(solution.algorithm, theme.INK_SECONDARY)
        self.best_loss = best_loss
        self.s = text_scale
        self.cpu_seconds = float(solution.notes.get("cpu_seconds", 0.0))

        # Route as a polyline: point 0 = den, point k+1 = k-th item eaten.
        self.points = np.array([instance.start] + [instance.items[i].position for i in solution.order],
                               dtype=float).reshape(-1, 2)
        self.times = np.array([0.0] + list(solution.arrival_times))
        self.eaten_at = dict(zip(solution.order, solution.arrival_times))
        self.eat_rank = {item_id: k + 1 for k, item_id in enumerate(solution.order)}
        self.score_after = np.cumsum([0.0] + list(solution.item_scores))   # score after k items

        self._setup_axes()
        self._draw_static_layers()
        self._create_items()
        self._create_raccoon_and_text()
        self._create_planning_overlay()

    # ---- building -----------------------------------------------------------
    def _setup_axes(self) -> None:
        ax, inst, s = self.ax, self.instance, self.s
        pad = 3.0
        ax.set_xlim(-pad, inst.width + pad)
        ax.set_ylim(-pad, inst.height + pad)
        ax.set_aspect("equal")
        ax.set_xticks([])
        ax.set_yticks([])
        ax.grid(False)
        for side, spine in ax.spines.items():
            spine.set_visible(True)
            spine.set_color(self.color if side == "top" else theme.AXIS)
            spine.set_linewidth(4 if side == "top" else 1)
        ax.text(0.0, 1.085, self.algo.name, transform=ax.transAxes, fontsize=15 * s,
                fontweight="bold", color=theme.INK, va="bottom")
        ax.text(0.0, 1.025, self.algo.tagline, transform=ax.transAxes, fontsize=11 * s,
                color=theme.INK_SECONDARY, va="bottom")
        # 10 m scale bar, bottom right
        x1, y = inst.width - 2, 1.0
        ax.plot([x1 - 10, x1], [y, y], color=theme.INK_MUTED, lw=2, zorder=1)
        ax.text(x1 - 5, y + 1.0, "10 m", ha="center", va="bottom", fontsize=9 * s, color=theme.INK_MUTED)

    def _draw_static_layers(self) -> None:
        ax = self.ax
        from matplotlib.collections import LineCollection
        # Algorithms that plan the whole route first: show the plan faintly (once it is ready).
        self.plan_line = None
        if theme.SHOW_PLANNED_ROUTE and self.solution.notes.get("plans_ahead") and len(self.points) > 1:
            (self.plan_line,) = ax.plot(self.points[:, 0], self.points[:, 1], color=self.color,
                                        lw=1.5, ls=(0, (4, 4)), alpha=0.35, zorder=2)
        # Greedy "thinking": faint lines to every candidate at the current decision.
        self.decisions = self.solution.notes.get("decisions") if theme.SHOW_GREEDY_THINKING else None
        self.thinking = LineCollection([], linewidths=1.2, zorder=2)
        ax.add_collection(self.thinking)
        self._thinking_cache = {}
        # Trail (walked so far) and the line to the current target.
        (self.trail,) = ax.plot([], [], color=self.color, lw=2.5, zorder=3)
        (self.target_line,) = ax.plot([], [], color=self.color, lw=1.5, ls=(0, (2, 3)), zorder=3)
        # The den
        den = self.instance.start
        MapMarker(ax, den, "den", theme.DEN_COLOR, theme.DEN_MARKER, theme.DEN_MARKER_SIZE * self.s ** 0.5,
                  zorder=4)
        ax.text(den[0], den[1] - 4.2, "den", ha="center", va="top", fontsize=9 * self.s, color=theme.INK_MUTED)

    def _create_items(self) -> None:
        from matplotlib.patches import Rectangle
        ax, s = self.ax, self.s
        self.item_artists = []
        for item in self.instance.items:
            style = theme.food_style(item.food.name)
            marker = MapMarker(ax, item.position, item.food.name, style["color"], style["marker"],
                               theme.FOOD_MARKER_SIZE * s ** 0.5, zorder=5)
            bx = item.x - theme.FRESHNESS_BAR_WIDTH / 2
            by = item.y - theme.FRESHNESS_BAR_OFFSET
            bar_bg = Rectangle((bx, by), theme.FRESHNESS_BAR_WIDTH, theme.FRESHNESS_BAR_HEIGHT,
                               facecolor=theme.GRID, edgecolor="none", zorder=4)
            bar = Rectangle((bx, by), theme.FRESHNESS_BAR_WIDTH, theme.FRESHNESS_BAR_HEIGHT,
                            facecolor=theme.FRESH, edgecolor="none", zorder=4)
            ax.add_patch(bar_bg)
            ax.add_patch(bar)
            if not theme.SHOW_FRESHNESS_BARS:
                bar_bg.set_visible(False)
                bar.set_visible(False)
            (spoiled_x,) = ax.plot([item.x], [item.y], linestyle="none", marker="x", markersize=9 * s ** 0.5,
                                   markeredgewidth=2.4, color=theme.SPOILED, zorder=6, visible=False)
            rank = ax.text(item.x + 2.0, item.y + 2.0, str(self.eat_rank[item.id]), fontsize=9 * s,
                           fontweight="bold", color=theme.INK_SECONDARY, zorder=7, visible=False)
            self.item_artists.append({"marker": marker, "bar_bg": bar_bg, "bar": bar,
                                      "spoiled_x": spoiled_x, "rank": rank})

    def _create_raccoon_and_text(self) -> None:
        ax, s = self.ax, self.s
        self.raccoon = MapMarker(ax, self.instance.start, "raccoon", theme.RACCOON_COLOR,
                                 theme.RACCOON_MARKER, theme.RACCOON_MARKER_SIZE * s ** 0.5, zorder=8)
        # Live stats sit around the map (never on top of it).
        self.score_text = ax.text(0.0, -0.02, "", transform=ax.transAxes, ha="left", va="top",
                                  fontsize=14 * s, fontweight="bold", color=theme.INK)
        self.status = ax.text(1.0, -0.025, "", transform=ax.transAxes, ha="right", va="top",
                              fontsize=10.5 * s, color=theme.INK_SECONDARY)
        self.compute_text = ax.text(0.0, -0.095, "", transform=ax.transAxes, ha="left", va="top",
                                    fontsize=10 * s, color=theme.INK_MUTED)

    def _create_planning_overlay(self) -> None:
        """Phase 1 card in the middle of the map: 'planning...' + a bar for CPU time."""
        from matplotlib.patches import Rectangle
        ax, s = self.ax, self.s
        tr = ax.transAxes
        self.overlay = [
            Rectangle((0.08, 0.36), 0.84, 0.28, transform=tr, facecolor=theme.SURFACE,
                      edgecolor=theme.GRID, lw=1, alpha=0.94, zorder=20),
            Rectangle((0.14, 0.455), 0.72, 0.055, transform=tr, facecolor=theme.GRID,
                      edgecolor="none", zorder=21),
        ]
        self.overlay_bar = Rectangle((0.14, 0.455), 0.0, 0.055, transform=tr, facecolor=self.color,
                                     edgecolor="none", zorder=22)
        self.overlay.append(self.overlay_bar)
        for patch in self.overlay:
            ax.add_patch(patch)
        self.overlay_title = ax.text(0.5, 0.585, "", transform=tr, ha="center", va="center",
                                     fontsize=12 * s, fontweight="bold", color=theme.INK, zorder=23)
        self.overlay_time = ax.text(0.5, 0.405, "", transform=tr, ha="center", va="center",
                                    fontsize=11 * s, color=theme.INK_SECONDARY, zorder=23)
        self.overlay += [self.overlay_title, self.overlay_time]

    # ---- phase 1: planning --------------------------------------------------
    def draw_planning(self, bar_fraction: float, shown_seconds: float, ready: bool) -> None:
        """bar_fraction: bar length on the SHARED scale (1.0 = the slowest algorithm's time).
        shown_seconds: CPU time counted so far for this algorithm."""
        self.draw_at(0.0, planning=True)
        for art in self.overlay:
            art.set_visible(True)
        self.overlay_bar.set_width(0.72 * max(0.004, min(1.0, bar_fraction)))
        self.overlay_title.set_text("route ready ✓" if ready else "planning route…")
        self.overlay_time.set_text(_format_seconds(shown_seconds) + " of CPU time")
        if self.plan_line is not None:
            self.plan_line.set_visible(ready)
        self.status.set_text("waiting at the den")
        self.compute_text.set_text(f"running time {self.algo.time_complexity}")

    # ---- phase 2: walking -----------------------------------------------------
    def _leg_at(self, t: float) -> int:
        """Index k of the leg being walked at time t (from point k to point k+1)."""
        k = int(np.searchsorted(self.times, t, side="right")) - 1
        return min(max(k, 0), len(self.points) - 1)

    def position_at(self, t: float):
        k = self._leg_at(t)
        if k >= len(self.points) - 1:
            return self.points[-1], k
        t0, t1 = self.times[k], self.times[k + 1]
        frac = (t - t0) / (t1 - t0) if t1 > t0 else 1.0
        return self.points[k] + frac * (self.points[k + 1] - self.points[k]), k

    def _thinking_segments(self, k: int):
        """Lines from decision point k to every candidate, darker = more attractive."""
        if k not in self._thinking_cache:
            d = self.decisions[k]
            ranked = sorted(d["candidates"].items(), key=lambda kv: kv[1])
            segs, colors = [], []
            m = len(ranked)
            for rank, (j, _value) in enumerate(ranked):
                if j == d["chosen"]:
                    continue
                strength = (rank + 1) / m
                segs.append([d["from"], self.instance.items[j].position])
                colors.append((0.32, 0.32, 0.31, 0.06 + 0.30 * strength))
            self._thinking_cache[k] = (segs, colors)
        return self._thinking_cache[k]

    def draw_at(self, t: float, planning: bool = False) -> None:
        pos, k = self.position_at(t)
        finished = t >= self.times[-1] and not planning
        self.raccoon.move_to(pos)
        if not planning:
            for art in self.overlay:
                art.set_visible(False)
            if self.plan_line is not None:
                self.plan_line.set_visible(True)

        # trail + target line
        if theme.SHOW_TRAIL:
            trail = np.vstack([self.points[:k + 1], pos])
            self.trail.set_data(trail[:, 0], trail[:, 1])
        if not planning and not finished and k + 1 < len(self.points):
            nxt = self.points[k + 1]
            self.target_line.set_data([pos[0], nxt[0]], [pos[1], nxt[1]])
        else:
            self.target_line.set_data([], [])

        # greedy thinking lines (only while walking)
        if self.decisions and not planning and not finished and k < len(self.decisions):
            segs, colors = self._thinking_segments(k)
            self.thinking.set_segments(segs)
            self.thinking.set_color(colors)
        else:
            self.thinking.set_segments([])

        # food
        for item, art in zip(self.instance.items, self.item_artists):
            eaten_time = self.eaten_at[item.id]
            eaten = t >= eaten_time and not planning
            when = eaten_time if eaten else t          # freshness frozen once eaten
            fresh = item.freshness_at(when)
            spoiled = fresh < 0
            style = theme.food_style(item.food.name)
            art["marker"].set_color(theme.ROTTEN_FOOD if spoiled else style["color"])
            art["marker"].set_alpha(0.22 if eaten else 1.0)
            art["spoiled_x"].set_visible(spoiled)
            art["spoiled_x"].set_alpha(0.55 if eaten else 1.0)
            art["rank"].set_visible(eaten and theme.SHOW_EAT_ORDER)
            show_bar = theme.SHOW_FRESHNESS_BARS and not eaten
            art["bar_bg"].set_visible(show_bar)
            art["bar"].set_visible(show_bar and fresh > 0)
            if show_bar and fresh > 0:
                art["bar"].set_width(theme.FRESHNESS_BAR_WIDTH * min(fresh, 1.0))
                art["bar"].set_facecolor(theme.FRESH if fresh > theme.STALE_BELOW else theme.STALE)

        # live stats
        eaten_count = 0 if planning else int(np.searchsorted(self.times[1:], t, side="right"))
        score = self.score_after[eaten_count]
        spoiled_count = sum(1 for sc in self.solution.item_scores[:eaten_count] if sc < 0)
        self.score_text.set_text(f"{score:,.0f} cal")
        if planning:
            return
        status = f"t = {min(t, self.times[-1]):.0f} s · eaten {eaten_count}/{self.instance.n} · {spoiled_count} spoiled"
        if finished:
            gap = (self.solution.spoilage_loss / self.best_loss - 1) * 100 if self.best_loss > 0 else 0.0
            status = f"{spoiled_count} spoiled · " + (
                "best route ✓" if gap < 0.05 else f"+{gap:.1f}% spoilage vs best")
        self.status.set_text(status)
        self.compute_text.set_text(f"planned in {_format_seconds(self.cpu_seconds)} CPU · "
                                   f"{self.algo.time_complexity}")


def _format_seconds(seconds: float) -> str:
    if seconds >= 1.0:
        return f"{seconds:.2f} s"
    if seconds >= 1e-3:
        return f"{seconds * 1e3:.1f} ms"
    return f"{seconds * 1e6:.0f} µs"


# =============================================================================
# Score over time (bottom / side chart)
# =============================================================================
class Timeline:
    def __init__(self, ax, solutions: Sequence[Solution], end_time: float, text_scale: float = 1.0):
        self.ax = ax
        self.series = []
        s = text_scale
        lo, hi = 0.0, 0.0
        for sol in solutions:
            color = theme.ALGORITHM_COLORS.get(sol.algorithm, theme.INK_SECONDARY)
            xs = np.array([0.0] + list(sol.arrival_times))
            ys = np.cumsum([0.0] + list(sol.item_scores))
            lo, hi = min(lo, ys.min()), max(hi, ys.max())
            (line,) = ax.plot([], [], color=color, lw=2.2, drawstyle="steps-post",
                              label=ALGORITHMS[sol.algorithm].name)
            (dot,) = ax.plot([], [], "o", color=color, ms=7, markeredgecolor=theme.SURFACE,
                             markeredgewidth=1.8)
            self.series.append((sol, xs, ys, line, dot))
        span = (hi - lo) or 1.0
        ax.set_xlim(0, end_time * 1.04)
        ax.set_ylim(lo - 0.08 * span, hi + (0.45 if len(solutions) > 3 else 0.15) * span)
        ax.set_xlabel("time since leaving the den (seconds)", fontsize=11 * s)
        ax.set_ylabel("score (calories)", fontsize=11 * s)
        ax.tick_params(labelsize=10 * s)
        self.title = ax.set_title("", loc="left", fontsize=12 * s, fontweight="bold")
        ax.legend(loc="upper left", fontsize=9.5 * s, ncol=min(3, len(solutions)),
                  handlelength=1.4, columnspacing=1.0)
        ax.axhline(0, color=theme.AXIS, lw=1, zorder=0)
        self.cursor = ax.axvline(0, color=theme.INK_MUTED, lw=1, zorder=0)
        self.verdict = ax.text(1.0, 1.03, "", transform=ax.transAxes, ha="right", va="bottom",
                               fontsize=11 * s, color=theme.INK)
        self.verdict_text = _verdict(solutions)
        self.end_time = end_time

    def draw_planning(self, phase_fraction: float, slowest_seconds: float) -> None:
        self.title.set_text("Phase 1: planning (each panel's bar = its CPU time)")
        self.verdict.set_text(f"slowest planner: {_format_seconds(slowest_seconds)}")
        self.draw_at(0.0)

    def draw_at(self, t: float) -> None:
        if t > 0:
            self.title.set_text("Phase 2: calories banked over time")
        self.cursor.set_xdata([t, t])
        for sol, xs, ys, line, dot in self.series:
            te = min(t, sol.total_time)
            keep = xs <= te
            x_vis = np.append(xs[keep], te)
            y_vis = np.append(ys[keep], ys[keep][-1])
            line.set_data(x_vis, y_vis)
            dot.set_data([te], [y_vis[-1]])
        if t > 0:
            self.verdict.set_text(self.verdict_text if t >= self.end_time else "")


def _verdict(solutions: Sequence[Solution]) -> str:
    best_loss = min(s.spoilage_loss for s in solutions)
    winners = [s for s in solutions if s.spoilage_loss <= best_loss + 1e-6]
    names = " = ".join(ALGORITHMS[s.algorithm].name for s in winners)
    label = "Best route" if len(winners) == 1 else "Tied for best"
    return f"{label}: {names} ({winners[0].total_score:,.0f} cal)"


# =============================================================================
# The whole window
# =============================================================================
class RaceAnimation:
    def __init__(self, instance: Instance, solutions: List[Solution],
                 interactive: bool = True, new_race: Optional[NewRaceFn] = None):
        self.plt = _plt()
        self.interactive = interactive
        self.new_race = new_race
        size = theme.FIGURE_SIZE if len(solutions) <= 3 else theme.FIGURE_SIZE_MANY
        self.fig = self.plt.figure(figsize=size)
        try:
            self.fig.canvas.manager.set_window_title("The Greedy Raccoon")
        except Exception:
            pass
        if interactive:
            self._free_keys()
            self.fig.canvas.mpl_connect("key_press_event", self._on_key)
        self._build(instance, solutions)

    # ---- timing of the two phases (in seconds of SCREEN time) ----------------------
    @property
    def plan_end(self) -> float:
        return theme.PLANNING_SECONDS

    @property
    def walk_start(self) -> float:
        return theme.PLANNING_SECONDS + theme.PLANNING_HOLD_SECONDS

    @property
    def total_screen(self) -> float:
        return self.walk_start + theme.ANIMATION_SECONDS

    # ---- layout ---------------------------------------------------------------
    def _build(self, instance: Instance, solutions: List[Solution]) -> None:
        fig = self.fig
        fig.clf()
        self.instance, self.solutions = instance, solutions
        self.end_time = max([s.total_time for s in solutions] + [1e-9])
        self.slowest = max([s.notes.get("cpu_seconds", 0.0) for s in solutions] + [1e-9])
        best_loss = min(s.spoilage_loss for s in solutions)
        n_alg = len(solutions)

        # Grid: up to 3 algorithms in one row with the timeline underneath;
        # more go 4 per row, and the timeline fills the empty cells of the last row.
        if n_alg <= 3:
            cols, map_rows, inline = n_alg, 1, False
        else:
            cols = 4
            map_rows = math.ceil(n_alg / cols)
            inline = map_rows * cols - n_alg >= 2
        text_scale = 1.0 if cols <= 2 else (0.85 if cols == 3 else 0.72)
        rows = map_rows + (0 if inline else 1)
        ratios = [3.8] * map_rows + ([] if inline else [1.0 if n_alg <= 3 else 1.4])
        gs = fig.add_gridspec(rows, cols, height_ratios=ratios, left=0.05, right=0.975,
                              top=0.80 if n_alg <= 3 else 0.835, bottom=0.075,
                              hspace=0.42 if n_alg <= 3 else 0.55, wspace=0.10 if n_alg <= 3 else 0.14)
        self.panels = []
        for i, sol in enumerate(solutions):
            ax = fig.add_subplot(gs[i // cols, i % cols])
            self.panels.append(RacePanel(ax, instance, sol, best_loss, text_scale))
        if inline:
            first_free = n_alg - (map_rows - 1) * cols
            tl_ax = fig.add_subplot(gs[map_rows - 1, first_free:])
        else:
            tl_ax = fig.add_subplot(gs[rows - 1, :])
        self.timeline = Timeline(tl_ax, solutions, self.end_time, text_scale=max(text_scale, 0.85))

        seed_text = f"  (map seed {instance.seed})" if instance.seed is not None else ""
        fig.text(0.05, 0.978, f"The Greedy Raccoon — {instance.n} food items{seed_text}",
                 fontsize=19, fontweight="bold", color=theme.INK, va="top")
        fig.text(0.05, 0.942, "Phase 1: each algorithm plans (bar = real CPU time).  Phase 2: every raccoon "
                 "eats everything; food loses freshness each second and spoiled food (×) costs calories.",
                 fontsize=11, color=theme.INK_SECONDARY, va="top")
        self._food_legend()
        if self.interactive:
            fig.text(0.975, 0.012, "SPACE pause   R restart   N new map   ← → step   Q quit",
                     ha="right", va="bottom", fontsize=10, color=theme.INK_MUTED)
        self.clock = 0.0           # seconds of screen time since the start
        self.paused = False
        self._last_tick = None
        self.draw_frame(0.0)

    def _food_legend(self) -> None:
        from matplotlib.lines import Line2D
        seen = {}
        for item in self.instance.items:
            seen.setdefault(item.food.name, item.food)
        handles = []
        for name, food in seen.items():
            style = theme.food_style(name)
            handles.append(Line2D([], [], linestyle="none", marker=style["marker"], markersize=10,
                                  markerfacecolor=style["color"], markeredgecolor=theme.SURFACE,
                                  label=f"{name}  {food.calories:.0f} cal / {food.shelf_life:.0f} s"))
        handles.append(Line2D([], [], color=theme.FRESH, lw=5, label="freshness"))
        handles.append(Line2D([], [], linestyle="none", marker="x", markersize=9, markeredgewidth=2.4,
                              color=theme.SPOILED, label="spoiled"))
        self.fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(0.045, 0.918),
                        ncol=len(handles), fontsize=10, frameon=False,
                        handletextpad=0.35, columnspacing=1.2)

    # ---- drawing --------------------------------------------------------------
    def _bar_length(self, seconds: float) -> float:
        """Bar length (0..1) for a CPU time, on the scale chosen in theme.PLANNING_SCALE."""
        if theme.PLANNING_SCALE == "log":
            floor = self.slowest / 1e4                       # 4 decades of range
            return math.log(max(seconds, floor) / floor) / math.log(self.slowest / floor)
        return seconds / self.slowest

    def draw_frame(self, screen_seconds: float) -> None:
        """Draw what the window shows `screen_seconds` after the start."""
        if screen_seconds < self.walk_start:
            # The planning clock runs from 0 to the slowest algorithm's CPU time.
            phase = min(1.0, screen_seconds / self.plan_end) if self.plan_end > 0 else 1.0
            for panel in self.panels:
                bar_now = min(phase, self._bar_length(panel.cpu_seconds))
                ready = phase >= self._bar_length(panel.cpu_seconds)
                if theme.PLANNING_SCALE == "log":
                    shown = panel.cpu_seconds if ready else self.slowest / 1e4 * (1e4 ** phase)
                else:
                    shown = min(panel.cpu_seconds, phase * self.slowest)
                panel.draw_planning(bar_now, shown, ready)
            self.timeline.draw_planning(phase, self.slowest)
        else:
            walk = min(1.0, (screen_seconds - self.walk_start) / theme.ANIMATION_SECONDS)
            self.draw_at(max(walk * self.end_time, 1e-9))

    def draw_at(self, t: float) -> None:
        """Draw the walking phase at simulated time t (seconds since leaving the den)."""
        for panel in self.panels:
            panel.draw_at(t)
        self.timeline.draw_at(t)

    # ---- live window ------------------------------------------------------------
    def show(self) -> None:
        from matplotlib.animation import FuncAnimation

        def tick(_frame):
            now = time.perf_counter()
            if self._last_tick is not None and not self.paused:
                self.clock = min(self.total_screen, self.clock + (now - self._last_tick))
            self._last_tick = now
            self.draw_frame(self.clock)
            return []

        self._anim = FuncAnimation(self.fig, tick, interval=1000 / theme.FPS,
                                   cache_frame_data=False, blit=False)
        self.plt.show()

    def _free_keys(self) -> None:
        """Stop matplotlib's built-in shortcuts from stealing our keys."""
        import matplotlib as mpl
        for keymap, keys in (("keymap.home", ("r",)), ("keymap.back", ("left",)),
                             ("keymap.forward", ("right",))):
            mpl.rcParams[keymap] = [k for k in mpl.rcParams[keymap] if k not in keys]

    def _on_key(self, event) -> None:
        if event.key == " ":
            self.paused = not self.paused
        elif event.key == "r":
            self.clock, self.paused = 0.0, False
        elif event.key in ("right", "left"):
            self.paused = True
            step = 0.01 * self.total_screen * (1 if event.key == "right" else -1)
            self.clock = min(self.total_screen, max(0.0, self.clock + step))
            self.draw_frame(self.clock)
            self.fig.canvas.draw_idle()
        elif event.key == "n" and self.new_race is not None:
            instance, solutions = self.new_race()
            self._build(instance, solutions)
            self.fig.canvas.draw_idle()

    # ---- files -----------------------------------------------------------------
    def save(self, path: Path, progress: Optional[Callable[[int, int], None]] = None) -> Path:
        """Save the race (planning + walking) as an animated .gif (or .mp4 if ffmpeg is installed)."""
        from matplotlib.animation import FFMpegWriter, FuncAnimation, PillowWriter
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        fps = theme.GIF_FPS
        frames = int(math.ceil(self.total_screen * fps)) + 1
        hold_frames = int(theme.HOLD_SECONDS * fps)

        def frame(i):
            self.draw_frame(min(i / fps, self.total_screen))
            return []

        anim = FuncAnimation(self.fig, frame, frames=frames + hold_frames, blit=False)
        writer = PillowWriter(fps=fps) if path.suffix.lower() == ".gif" else FFMpegWriter(fps=fps)
        anim.save(str(path), writer=writer, dpi=theme.GIF_DPI, progress_callback=progress)
        return path

    def save_snapshot(self, path: Path, t: Optional[float] = None, dpi: int = 150) -> Path:
        """Save one still frame (default: the finished race) as a PNG.  t = simulated seconds."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.draw_at(self.end_time if t is None else t)
        self.fig.savefig(path, dpi=dpi)
        return path

    def save_planning_snapshot(self, path: Path, phase: float = 0.5, dpi: int = 150) -> Path:
        """Save a still frame from the planning phase (phase 0..1)."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.draw_frame(phase * self.plan_end)
        self.fig.savefig(path, dpi=dpi)
        return path

    def close(self) -> None:
        self.plt.close(self.fig)
