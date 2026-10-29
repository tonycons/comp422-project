# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
"The race": watch the algorithms in action, side by side, on the same map.

    +--------------------------+--------------------------+
    |  Greedy                  |  Held-Karp DP            |   one map panel per algorithm
    |   raccoon, trail, food,  |   (dashed line = the     |
    |   freshness bars         |    plan it made upfront) |
    +--------------------------+--------------------------+
    |  calories banked over time (both raccoons)          |   timeline
    +-----------------------------------------------------+

Live window keys:  SPACE pause/resume  |  R restart  |  N new random map
                   LEFT / RIGHT step when paused  |  Q close

How it is built (so you can replace pieces):
  * MapMarker   - one thing on the map, drawn as a shape OR a sprite PNG
  * RacePanel   - one algorithm's map; draw_at(t) shows the world at time t
  * Timeline    - the score-over-time chart; draw_at(t)
  * RaceAnimation - builds the figure, runs the clock, saves GIF/MP4/PNG
Everything takes the same inputs: an Instance and a list of Solutions. A
completely different front end (web page, game engine) can be fed the same
data via  python main.py demo --export results/race.json
"""
from __future__ import annotations

import time
from pathlib import Path
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
    def __init__(self, ax, instance: Instance, solution: Solution):
        self.ax = ax
        self.instance = instance
        self.solution = solution
        self.algo = ALGORITHMS[solution.algorithm]
        self.color = theme.ALGORITHM_COLORS.get(solution.algorithm, theme.INK_SECONDARY)

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

    # ---- building -----------------------------------------------------------
    def _setup_axes(self) -> None:
        ax, inst = self.ax, self.instance
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
        ax.text(0.0, 1.075, self.algo.name, transform=ax.transAxes, fontsize=15,
                fontweight="bold", color=theme.INK, va="bottom")
        ax.text(0.0, 1.022, f"{self.algo.tagline}  ·  time {self.algo.time_complexity}",
                transform=ax.transAxes, fontsize=11, color=theme.INK_SECONDARY, va="bottom")
        # 10 m scale bar, bottom right
        x1, y = inst.width - 2, 1.0
        ax.plot([x1 - 10, x1], [y, y], color=theme.INK_MUTED, lw=2, zorder=1)
        ax.text(x1 - 5, y + 1.0, "10 m", ha="center", va="bottom", fontsize=9, color=theme.INK_MUTED)

    def _draw_static_layers(self) -> None:
        ax = self.ax
        from matplotlib.collections import LineCollection
        # Held-Karp planned the whole route before moving: show the plan faintly.
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
        MapMarker(ax, den, "den", theme.DEN_COLOR, theme.DEN_MARKER, theme.DEN_MARKER_SIZE, zorder=4)
        ax.text(den[0], den[1] - 4.2, "den", ha="center", va="top", fontsize=9, color=theme.INK_MUTED)

    def _create_items(self) -> None:
        from matplotlib.patches import Rectangle
        ax = self.ax
        self.item_artists = []
        for item in self.instance.items:
            style = theme.food_style(item.food.name)
            marker = MapMarker(ax, item.position, item.food.name, style["color"], style["marker"],
                               theme.FOOD_MARKER_SIZE, zorder=5)
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
            (spoiled_x,) = ax.plot([item.x], [item.y], linestyle="none", marker="x", markersize=9,
                                   markeredgewidth=2.4, color=theme.SPOILED, zorder=6, visible=False)
            rank = ax.text(item.x + 2.0, item.y + 2.0, str(self.eat_rank[item.id]), fontsize=9,
                           fontweight="bold", color=theme.INK_SECONDARY, zorder=7, visible=False)
            self.item_artists.append({"marker": marker, "bar_bg": bar_bg, "bar": bar,
                                      "spoiled_x": spoiled_x, "rank": rank})

    def _create_raccoon_and_text(self) -> None:
        ax = self.ax
        self.raccoon = MapMarker(ax, self.instance.start, "raccoon", theme.RACCOON_COLOR,
                                 theme.RACCOON_MARKER, theme.RACCOON_MARKER_SIZE, zorder=8)
        # Live stats sit in the panel header (right side) so they never cover the map.
        self.score_text = ax.text(1.0, 1.075, "", transform=ax.transAxes, ha="right", va="bottom",
                                  fontsize=15, fontweight="bold", color=theme.INK)
        self.status = ax.text(0.5, -0.02, "", transform=ax.transAxes, ha="center", va="top",
                              fontsize=11, color=theme.INK_SECONDARY)

    # ---- updating -----------------------------------------------------------
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

    def draw_at(self, t: float) -> None:
        pos, k = self.position_at(t)
        finished = t >= self.times[-1]
        self.raccoon.move_to(pos)

        # trail + target line
        if theme.SHOW_TRAIL:
            trail = np.vstack([self.points[:k + 1], pos])
            self.trail.set_data(trail[:, 0], trail[:, 1])
        if not finished and k + 1 < len(self.points):
            nxt = self.points[k + 1]
            self.target_line.set_data([pos[0], nxt[0]], [pos[1], nxt[1]])
        else:
            self.target_line.set_data([], [])

        # greedy thinking lines (only while walking)
        if self.decisions and not finished and k < len(self.decisions):
            segs, colors = self._thinking_segments(k)
            self.thinking.set_segments(segs)
            self.thinking.set_color(colors)
        else:
            self.thinking.set_segments([])

        # food
        for item, art in zip(self.instance.items, self.item_artists):
            eaten_time = self.eaten_at[item.id]
            eaten = t >= eaten_time
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

        # live stats in the header
        eaten_count = int(np.searchsorted(self.times[1:], t, side="right"))
        score = self.score_after[eaten_count]
        spoiled_count = sum(1 for s in self.solution.item_scores[:eaten_count] if s < 0)
        self.score_text.set_text(f"{score:,.0f} cal")
        status = (f"t = {min(t, self.times[-1]):.0f} s  ·  eaten {eaten_count}/{self.instance.n}"
                  f"  ·  {spoiled_count} spoiled")
        self.status.set_text(status + ("  ·  done" if finished else ""))


# =============================================================================
# Score over time (bottom chart)
# =============================================================================
class Timeline:
    def __init__(self, ax, solutions: Sequence[Solution], end_time: float):
        self.ax = ax
        self.series = []
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
            label = ax.text(0, 0, "", fontsize=10, color=theme.INK, va="center", visible=False)
            self.series.append((sol, xs, ys, line, dot, label))
        span = (hi - lo) or 1.0
        ax.set_xlim(0, end_time * 1.08)
        ax.set_ylim(lo - 0.08 * span, hi + 0.15 * span)
        ax.set_xlabel("time since leaving the den (seconds)", fontsize=11)
        ax.set_ylabel("score (calories)", fontsize=11)
        ax.set_title("Calories banked over time", loc="left", fontsize=12, fontweight="bold")
        ax.legend(loc="upper left", fontsize=10, ncol=len(solutions))
        ax.axhline(0, color=theme.AXIS, lw=1, zorder=0)
        self.cursor = ax.axvline(0, color=theme.INK_MUTED, lw=1, zorder=0)
        self.verdict = ax.text(1.0, 1.04, "", transform=ax.transAxes, ha="right", va="bottom",
                               fontsize=11, color=theme.INK)
        self.verdict_text = _verdict(solutions)
        self.end_time = end_time

    def draw_at(self, t: float) -> None:
        self.cursor.set_xdata([t, t])
        for sol, xs, ys, line, dot, label in self.series:
            te = min(t, sol.total_time)
            keep = xs <= te
            x_vis = np.append(xs[keep], te)
            y_vis = np.append(ys[keep], ys[keep][-1])
            line.set_data(x_vis, y_vis)
            dot.set_data([te], [y_vis[-1]])
            done = t >= sol.total_time
            label.set_visible(done)
            if done:
                label.set_position((sol.total_time + self.end_time * 0.012, ys[-1]))
                label.set_text(f"{ys[-1]:,.0f}")
        self.verdict.set_text(self.verdict_text if t >= self.end_time else "")


def _verdict(solutions: Sequence[Solution]) -> str:
    by_key = {s.algorithm: s for s in solutions}
    g, h = by_key.get("greedy"), by_key.get("held_karp")
    if not (g and h):
        return ""
    gap = h.total_score - g.total_score
    if abs(gap) < 1e-6:
        return "Greedy found the optimal route this time!"
    extra = (g.spoilage_loss / h.spoilage_loss - 1) * 100 if h.spoilage_loss > 0 else 0
    return f"Held-Karp wins by {gap:,.0f} cal  (Greedy let {extra:.0f}% more calories spoil)"


# =============================================================================
# The whole window
# =============================================================================
class RaceAnimation:
    def __init__(self, instance: Instance, solutions: List[Solution],
                 interactive: bool = True, new_race: Optional[NewRaceFn] = None):
        self.plt = _plt()
        self.interactive = interactive
        self.new_race = new_race
        self.fig = self.plt.figure(figsize=theme.FIGURE_SIZE)
        try:
            self.fig.canvas.manager.set_window_title("The Greedy Raccoon")
        except Exception:
            pass
        if interactive:
            self._free_keys()
            self.fig.canvas.mpl_connect("key_press_event", self._on_key)
        self._build(instance, solutions)

    # ---- layout ---------------------------------------------------------------
    def _build(self, instance: Instance, solutions: List[Solution]) -> None:
        fig = self.fig
        fig.clf()
        self.instance, self.solutions = instance, solutions
        self.end_time = max([s.total_time for s in solutions] + [1e-9])
        k = len(solutions)
        gs = fig.add_gridspec(2, k, height_ratios=[3.8, 1.0], left=0.05, right=0.97,
                              top=0.80, bottom=0.065, hspace=0.32, wspace=0.10)
        self.panels = [RacePanel(fig.add_subplot(gs[0, i]), instance, s) for i, s in enumerate(solutions)]
        self.timeline = Timeline(fig.add_subplot(gs[1, :]), solutions, self.end_time)

        seed_text = f"  (map seed {instance.seed})" if instance.seed is not None else ""
        fig.text(0.05, 0.975, f"The Greedy Raccoon — {instance.n} food items{seed_text}",
                 fontsize=19, fontweight="bold", color=theme.INK, va="top")
        fig.text(0.05, 0.937, "Each raccoon must eat everything. Food loses freshness every second; "
                 "spoiled food (×) costs calories.   Food key: calories when fresh / seconds until spoiled.",
                 fontsize=11.5, color=theme.INK_SECONDARY, va="top")
        self._food_legend()
        if self.interactive:
            fig.text(0.97, 0.015, "SPACE pause   R restart   N new map   ← → step   Q quit",
                     ha="right", va="bottom", fontsize=10, color=theme.INK_MUTED)
        self.progress = 0.0        # 0 = start of race, 1 = end
        self.paused = False
        self._last_tick = None
        self.draw_at(0.0)

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
        self.fig.legend(handles=handles, loc="upper left", bbox_to_anchor=(0.045, 0.912),
                        ncol=len(handles), fontsize=10, frameon=False,
                        handletextpad=0.35, columnspacing=1.2)

    # ---- drawing --------------------------------------------------------------
    def draw_at(self, t: float) -> None:
        for panel in self.panels:
            panel.draw_at(t)
        self.timeline.draw_at(t)

    # ---- live window ------------------------------------------------------------
    def show(self) -> None:
        from matplotlib.animation import FuncAnimation

        def tick(_frame):
            now = time.perf_counter()
            if self._last_tick is not None and not self.paused:
                self.progress = min(1.0, self.progress + (now - self._last_tick) / theme.ANIMATION_SECONDS)
            self._last_tick = now
            self.draw_at(self.progress * self.end_time)
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
            self.progress, self.paused = 0.0, False
        elif event.key in ("right", "left"):
            self.paused = True
            step = 0.01 if event.key == "right" else -0.01
            self.progress = min(1.0, max(0.0, self.progress + step))
            self.draw_at(self.progress * self.end_time)
            self.fig.canvas.draw_idle()
        elif event.key == "n" and self.new_race is not None:
            instance, solutions = self.new_race()
            self._build(instance, solutions)
            self.fig.canvas.draw_idle()

    # ---- files -----------------------------------------------------------------
    def save(self, path: Path, progress: Optional[Callable[[int, int], None]] = None) -> Path:
        """Save the race as an animated .gif (or .mp4 if ffmpeg is installed)."""
        from matplotlib.animation import FFMpegWriter, FuncAnimation, PillowWriter
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        fps = theme.GIF_FPS
        race_frames = max(2, int(theme.ANIMATION_SECONDS * fps))
        hold_frames = int(theme.HOLD_SECONDS * fps)

        def frame(i):
            self.draw_at(self.end_time * min(i, race_frames - 1) / (race_frames - 1))
            return []

        anim = FuncAnimation(self.fig, frame, frames=race_frames + hold_frames, blit=False)
        writer = PillowWriter(fps=fps) if path.suffix.lower() == ".gif" else FFMpegWriter(fps=fps)
        anim.save(str(path), writer=writer, dpi=theme.GIF_DPI, progress_callback=progress)
        return path

    def save_snapshot(self, path: Path, t: Optional[float] = None, dpi: int = 150) -> Path:
        """Save one still frame (default: the finished race) as a PNG."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.draw_at(self.end_time if t is None else t)
        self.fig.savefig(path, dpi=dpi)
        return path

    def close(self) -> None:
        self.plt.close(self.fig)
