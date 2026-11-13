// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-12,
//  at the request of George Rule. See ../../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * The "work" strip under each map, filled in as the planning bar fills.
 *
 *   Greedy:    a staircase. Column k is decision k; it holds one square per item the
 *              raccoon still had to compare (n, n-1, ..., 1), so the area is n(n+1)/2.
 *   Held-Karp: its table. One square per set of items S (2^n of them), in the order the
 *              algorithm fills them (S = 1, 2, 3, ...). Darker = more items in the set,
 *              which shows that the integer order mixes small and large sets while
 *              always finishing S - {j} before S.
 *
 * Both are drawn from a tiny pre-rendered image (one pixel per square) scaled up, so
 * even 65,536 squares cost one drawImage per frame.
 */
import { popcount } from "../core/heldKarp";
import type { AlgorithmKey } from "../core/problem";
import { ALGORITHM_COLORS, COLORS, fitCanvas, SET_SIZE_RAMP } from "./theme";

const HEIGHT = 64;

export class WorkView {
    private ctx!: CanvasRenderingContext2D;
    private width = 0;
    private image: HTMLCanvasElement | null = null;   // one pixel per square, fully lit
    private cols = 1;
    private rows = 1;
    private squares = 0;          // number of squares in the picture
    private key: AlgorithmKey = "greedy";

    constructor(private readonly canvas: HTMLCanvasElement) {}

    /** Build the picture for an n-item map. */
    setData(key: AlgorithmKey, n: number): void {
        this.key = key;
        if (key === "held_karp") {
            this.squares = 2 ** n;
            // a wide rectangle of squares, about as wide as the canvas is
            this.cols = Math.max(1, Math.ceil(Math.sqrt(this.squares * 5)));
            this.rows = Math.ceil(this.squares / this.cols);
            this.image = makeImage(this.cols, this.rows, (x, y) => {
                const S = y * this.cols + x;   // row-major = the algorithm's order
                if (S >= this.squares) {
                    return null;
                }
                const size = popcount(S);
                const step = n <= 1 ? SET_SIZE_RAMP.length - 1
                    : Math.round((size / n) * (SET_SIZE_RAMP.length - 1));
                return SET_SIZE_RAMP[step];
            });
        } else {
            // staircase: column k (decision k) has n - k squares, stacked from the bottom
            this.squares = n;
            this.cols = Math.max(1, n);
            this.rows = Math.max(1, n);
            this.image = makeImage(this.cols, this.rows, (x, y) =>
                this.rows - y <= n - x ? ALGORITHM_COLORS.greedy : null);
        }
    }

    resize(): void {
        this.width = this.canvas.clientWidth;
        this.ctx = fitCanvas(this.canvas, this.width, HEIGHT);
    }

    /** progress = 0..1 of this algorithm's planning bar. */
    draw(progress: number): void {
        const ctx = this.ctx;
        if (!ctx || !this.image) {
            return;
        }
        ctx.clearRect(0, 0, this.width, HEIGHT);
        // largest whole-rectangle scale that fits, keeping squares square
        const cell = Math.min(this.width / this.cols, HEIGHT / this.rows);
        const w = this.cols * cell;
        const h = this.rows * cell;
        const x0 = (this.width - w) / 2;
        const y0 = (HEIGHT - h) / 2;
        ctx.imageSmoothingEnabled = false;

        // unlit background, in the same footprint
        ctx.globalAlpha = 1;
        ctx.fillStyle = COLORS.grid;
        if (this.key === "held_karp") {
            const fullRows = Math.floor(this.squares / this.cols);
            ctx.fillRect(x0, y0, w, fullRows * cell);
            const rest = this.squares - fullRows * this.cols;
            if (rest > 0) {
                ctx.fillRect(x0, y0 + fullRows * cell, rest * cell, cell);
            }
        } else {
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.drawImage(this.image, x0, y0, w, h);   // the staircase outline, washed out
            ctx.restore();
            ctx.globalCompositeOperation = "source-atop";
            ctx.fillStyle = COLORS.grid;
            ctx.fillRect(x0, y0, w, h);
            ctx.globalCompositeOperation = "source-over";
        }

        // lit part = the work done so far
        const done = Math.round(Math.min(1, Math.max(0, progress)) * this.squares);
        if (done <= 0) {
            return;
        }
        if (this.key === "held_karp") {
            const fullRows = Math.floor(done / this.cols);
            if (fullRows > 0) {
                ctx.drawImage(this.image, 0, 0, this.cols, fullRows, x0, y0, w, fullRows * cell);
            }
            const rest = done - fullRows * this.cols;
            if (rest > 0) {
                ctx.drawImage(this.image, 0, fullRows, rest, 1, x0, y0 + fullRows * cell, rest * cell, cell);
            }
        } else {
            ctx.drawImage(this.image, 0, 0, done, this.rows, x0, y0, done * cell, h);
        }
    }
}

/** A cols x rows canvas with one pixel per square (null = transparent). */
function makeImage(cols: number, rows: number, color: (x: number, y: number) => string | null): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = cols;
    c.height = rows;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(cols, rows);
    const cache = new Map<string, number[]>();
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const hex = color(x, y);
            if (!hex) {
                continue;
            }
            let rgb = cache.get(hex);
            if (!rgb) {
                rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
                cache.set(hex, rgb);
            }
            const p = (y * cols + x) * 4;
            img.data[p] = rgb[0];
            img.data[p + 1] = rgb[1];
            img.data[p + 2] = rgb[2];
            img.data[p + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return c;
}
