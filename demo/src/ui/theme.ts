// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Updated 2026-11-12 (Claude): Held-Karp color, set-size ramp for the DP table.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * THE LOOK OF EVERYTHING drawn on a canvas (web copy of raccoon/visuals/theme.py).
 * Page colors live in style.css; keep the two in sync.
 *
 * Palette checked with a colorblind-safety validator (light surface #fcfcfb):
 *  - the two algorithm colors pass every check;
 *  - the five food colors pass, but some pairs sit in the colorblind "warn" band
 *    and three are below 3:1 contrast, so every food type ALSO has its own shape
 *    and the legend names them. Don't make color the only cue.
 * The page is light-mode only: no dark-mode set of five food colors passed the
 * same checks.
 */
import type { AlgorithmKey } from "../core/problem";

export const COLORS = {
    surface: "#fcfcfb",
    ink: "#0b0b0b",
    inkSecondary: "#52514e",
    inkMuted: "#898781",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    // Status colors: ONLY for freshness (good / getting old / spoiled)
    fresh: "#0ca30c",
    stale: "#fab219",
    spoiled: "#d03b3b",
    rottenFood: "#a89f91",   // an uneaten item that has spoiled turns this color
    raccoon: "#3d3a36",
    den: "#7a5c3e",
};

export const ALGORITHM_COLORS: Record<AlgorithmKey, string> = {
    greedy: "#eb6834",       // orange
    subset_dp: "#2a78d6",    // blue
};

/**
 * Sequential blue ramp (light -> dark) for Subset DP's table: a cell is darker the
 * more items its set holds. One hue, so it reads as "more", never as a new category.
 */
export const SET_SIZE_RAMP = ["#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7",
    "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95"];

export type Shape = "diamond" | "hexagon" | "triangle" | "circle" | "pentagon";

export const FOOD_STYLE: Record<string, { color: string; shape: Shape }> = {
    fish:        { color: "#1baf7a", shape: "diamond" },
    blueberries: { color: "#6250d6", shape: "hexagon" },
    pizza:       { color: "#eda100", shape: "triangle" },
    apple:       { color: "#008300", shape: "circle" },
    donut:       { color: "#e87ba4", shape: "pentagon" },
};
const FALLBACK_STYLE = { color: COLORS.inkMuted, shape: "circle" as Shape };
export const foodStyle = (name: string) => FOOD_STYLE[name] ?? FALLBACK_STYLE;

export const STALE_BELOW = 0.5;   // freshness bar turns yellow below this

// Animation timing (screen seconds)
export const PLANNING_SECONDS = 3.2;   // the SLOWEST algorithm's planning bar fills in this long
export const PLANNING_HOLD_SECONDS = 0.7;
export const WALK_SECONDS = 14;        // the longer walk takes this long at 1x speed

/** Vertices of a regular-polygon marker of "radius" r centered on (0, 0). */
export function shapeVertices(shape: Shape, r: number): [number, number][] | null {
    const poly = (k: number, rot: number, scale = 1) =>
        Array.from({ length: k }, (_, i) => {
            const a = rot + (i * 2 * Math.PI) / k;
            return [Math.cos(a) * r * scale, Math.sin(a) * r * scale] as [number, number];
        });
    switch (shape) {
        case "diamond":
            return poly(4, -Math.PI / 2, 1.2);
        case "hexagon":
            return poly(6, 0, 1.05);
        case "triangle":
            return poly(3, -Math.PI / 2, 1.25);
        case "pentagon":
            return poly(5, -Math.PI / 2, 1.1);
        case "circle":
            return null;
    }
}

/** Trace a marker path on a canvas (caller fills/strokes). */
export function traceShape(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, r: number): void {
    ctx.beginPath();
    const verts = shapeVertices(shape, r);
    if (!verts) {
        ctx.arc(x, y, r, 0, Math.PI * 2);
        return;
    }
    verts.forEach(([vx, vy], i) => (i === 0 ? ctx.moveTo(x + vx, y + vy) : ctx.lineTo(x + vx, y + vy)));
    ctx.closePath();
}

/** The same marker as a small inline SVG (for legends). */
export function shapeSvg(shape: Shape, color: string, size = 16): SVGSVGElement {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", `${-size / 2} ${-size / 2} ${size} ${size}`);
    svg.setAttribute("aria-hidden", "true");
    const r = size * 0.36;
    const verts = shapeVertices(shape, r);
    const el = verts ? document.createElementNS(ns, "polygon") : document.createElementNS(ns, "circle");
    if (verts) {
        el.setAttribute("points", verts.map((v) => v.join(",")).join(" "));
    }
    else {
        el.setAttribute("r", String(r));
    }
    el.setAttribute("fill", color);
    svg.appendChild(el);
    return svg;
}

/** Size a canvas's backing store to its CSS size x devicePixelRatio. Returns a ready context. */
export function fitCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): CanvasRenderingContext2D {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
}
