# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
THE LOOK OF EVERYTHING. Restyle the project by editing only this file.

* Colors, marker shapes, sizes, fonts, animation speed.
* Want pictures instead of shapes? Drop PNG files into  assets/sprites/
  named after the food type (fish.png, pizza.png, ...) or  raccoon.png / den.png.
  Any PNG that exists is used automatically; missing ones fall back to shapes.
  Square images with a transparent background look best (64x64 or larger).
"""
from __future__ import annotations

from pathlib import Path

# -----------------------------------------------------------------------------
# Base colors (a colorblind-checked palette)
# -----------------------------------------------------------------------------
SURFACE = "#fcfcfb"         # background of every chart
INK = "#0b0b0b"             # main text
INK_SECONDARY = "#52514e"   # secondary text, model/fit lines
INK_MUTED = "#898781"       # axis labels, hints
GRID = "#e1e0d9"            # gridlines (thin, solid)
AXIS = "#c3c2b7"            # axis lines / map border

# Status colors: ONLY for freshness (good / getting old / spoiled)
FRESH = "#0ca30c"
STALE = "#fab219"
SPOILED = "#d03b3b"
ROTTEN_FOOD = "#a89f91"     # what an uneaten spoiled item turns into

# Each algorithm keeps the same color in every chart and in the animation.
ALGORITHM_COLORS = {
    "greedy": "#eb6834",        # orange
    "held_karp": "#2a78d6",     # blue
    "brute_force": "#1baf7a",   # aqua
}

# -----------------------------------------------------------------------------
# Food look: color + marker shape per food type name (shape = colorblind backup)
# Marker codes: https://matplotlib.org/stable/api/markers_api.html
# -----------------------------------------------------------------------------
FOOD_STYLE = {
    "fish":        {"color": "#1baf7a", "marker": "D"},   # aqua diamond
    "blueberries": {"color": "#6250d6", "marker": "h"},   # violet hexagon
    "pizza":       {"color": "#eda100", "marker": "^"},   # yellow triangle
    "apple":       {"color": "#008300", "marker": "o"},   # green circle
    "donut":       {"color": "#e87ba4", "marker": "p"},   # pink pentagon
}
FALLBACK_FOOD_STYLE = {"color": "#898781", "marker": "X"}   # for food types not listed above

FOOD_MARKER_SIZE = 13        # points
RACCOON_COLOR = "#3d3a36"
RACCOON_MARKER = "o"
RACCOON_MARKER_SIZE = 17
DEN_COLOR = "#7a5c3e"
DEN_MARKER = "s"
DEN_MARKER_SIZE = 14

# -----------------------------------------------------------------------------
# Sprites (optional pictures)
# -----------------------------------------------------------------------------
SPRITE_DIR = Path(__file__).resolve().parents[2] / "assets" / "sprites"
SPRITE_ZOOM = 0.45           # scale factor for sprite PNGs (tune to your image size)

# -----------------------------------------------------------------------------
# Animation
# -----------------------------------------------------------------------------
ANIMATION_SECONDS = 14       # how long the race takes on screen
FPS = 30                     # frames per second in the live window
HOLD_SECONDS = 2.5           # pause on the final frame (saved GIFs)
GIF_FPS = 15                 # GIF frame rate (lower = smaller file)
GIF_DPI = 72                 # GIF resolution (higher = sharper, bigger file)
FIGURE_SIZE = (14, 10)       # inches (width, height) of the race window

SHOW_TRAIL = True            # draw the path walked so far
SHOW_PLANNED_ROUTE = True    # Held-Karp: faint dashed line of the full plan
SHOW_GREEDY_THINKING = True  # Greedy: faint lines to every candidate it considered
SHOW_FRESHNESS_BARS = True   # little bar under each food item
SHOW_EAT_ORDER = True        # number each item in the order it was eaten
FRESHNESS_BAR_WIDTH = 5.0    # map units
FRESHNESS_BAR_HEIGHT = 0.9
FRESHNESS_BAR_OFFSET = 3.6   # how far below the item the bar sits
STALE_BELOW = 0.5            # bar turns yellow when freshness drops below this

# -----------------------------------------------------------------------------
# Static charts (benchmark plots)
# -----------------------------------------------------------------------------
PLOT_SIZE = (10, 6.2)        # inches
PLOT_DPI = 150
FONT_FAMILY = ["DejaVu Sans", "Segoe UI", "Arial", "sans-serif"]
TITLE_SIZE = 17
LABEL_SIZE = 14
TICK_SIZE = 12
LEGEND_SIZE = 12
SCATTER_ALPHA = 0.45         # individual instance points
SCATTER_SIZE = 30
AVERAGE_COLOR = INK          # "average per size" line
FIT_COLOR = INK_SECONDARY    # theoretical trendline (dashed)


def food_style(name: str) -> dict:
    return FOOD_STYLE.get(name, FALLBACK_FOOD_STYLE)


def sprite_path(name: str):
    """Path to assets/sprites/<name>.png if it exists, else None."""
    path = SPRITE_DIR / f"{name}.png"
    return path if path.exists() else None


def apply_matplotlib_style() -> None:
    """Global matplotlib settings shared by every figure."""
    import matplotlib as mpl
    mpl.rcParams.update({
        "font.family": "sans-serif",
        "font.sans-serif": FONT_FAMILY,
        "figure.facecolor": SURFACE,
        "axes.facecolor": SURFACE,
        "savefig.facecolor": SURFACE,
        "axes.edgecolor": AXIS,
        "axes.labelcolor": INK_SECONDARY,
        "axes.titlecolor": INK,
        "axes.grid": True,
        "grid.color": GRID,
        "grid.linewidth": 0.8,
        "grid.linestyle": "-",
        "xtick.color": INK_MUTED,
        "ytick.color": INK_MUTED,
        "xtick.labelcolor": INK_SECONDARY,
        "ytick.labelcolor": INK_SECONDARY,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "legend.frameon": False,
        "lines.solid_capstyle": "round",
        "lines.solid_joinstyle": "round",
    })
