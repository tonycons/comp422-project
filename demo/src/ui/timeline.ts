// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * "Calories banked over time": one step line per algorithm, a cursor at the
 * animation's current time, and a hover/keyboard crosshair + tooltip.
 * The same numbers are in the results table, so the tooltip never gates a value.
 */
import { eatenCount } from "./mapView";
import { COLORS, fitCanvas } from "./theme";
import { fmtInt, fmtSeconds, fmtTick } from "./format";

export interface Series {
  name: string;
  color: string;
  times: number[];      // arrival times (sorted)
  banked: number[];     // banked[k] = running score after eating k+1 items
}

const M = { top: 14, right: 132, bottom: 40, left: 60 };
const LABEL_SPACE = 132;   // right margin for end labels (dropped on narrow screens; the legend still names the lines)
const NARROW = 600;
const HEIGHT = 280;

export class Timeline {
  private ctx!: CanvasRenderingContext2D;
  private width = 0;
  private series: Series[] = [];
  private maxT = 1;
  private yMin = 0;
  private yMax = 1;
  private yTicks: number[] = [];
  private cursorT = 0;
  private hoverT: number | null = null;
  private eventTimes: number[] = [];   // every arrival time of every series, sorted (crosshair snaps here)

  constructor(private readonly canvas: HTMLCanvasElement, private readonly tooltip: HTMLElement) {
    canvas.addEventListener("pointermove", (e) => this.onPointer(e));
    canvas.addEventListener("pointerleave", () => this.setHover(null));
    canvas.addEventListener("blur", () => this.setHover(null));
    canvas.addEventListener("keydown", (e) => this.onKey(e));
  }

  setSeries(series: Series[]): void {
    this.series = series;
    this.maxT = Math.max(1, ...series.map((s) => s.times.at(-1) ?? 0));
    const all = series.flatMap((s) => s.banked);
    const lo = Math.min(0, ...all);
    const hi = Math.max(0, ...all);
    [this.yMin, this.yMax, this.yTicks] = niceScale(lo, hi === lo ? lo + 1 : hi, 5);
    this.eventTimes = [0, ...series.flatMap((s) => s.times)].sort((a, b) => a - b);
    this.hoverT = null;
    this.tooltip.hidden = true;
  }

  setCursor(t: number): void {
    this.cursorT = t;
  }

  resize(): void {
    this.width = this.canvas.clientWidth;
    M.right = this.width < NARROW ? 16 : LABEL_SPACE;
    M.left = this.width < NARROW ? 48 : 60;
    this.ctx = fitCanvas(this.canvas, this.width, HEIGHT);
  }

  // --- scales
  private x(t: number): number {
    return M.left + (t / this.maxT) * (this.width - M.left - M.right);
  }
  private y(v: number): number {
    return M.top + (1 - (v - this.yMin) / (this.yMax - this.yMin)) * (HEIGHT - M.top - M.bottom);
  }
  private tAt(px: number): number {
    return ((px - M.left) / (this.width - M.left - M.right)) * this.maxT;
  }

  draw(): void {
    const ctx = this.ctx;
    if (!ctx || this.series.length === 0) return;
    ctx.clearRect(0, 0, this.width, HEIGHT);
    const plotR = this.width - M.right;
    const maxAbs = Math.max(Math.abs(this.yMin), Math.abs(this.yMax));

    // grid + y ticks (hairline, solid)
    ctx.font = "12px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    for (const v of this.yTicks) {
      const y = Math.round(this.y(v)) + 0.5;
      ctx.strokeStyle = v === 0 ? COLORS.axis : COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(M.left, y);
      ctx.lineTo(plotR, y);
      ctx.stroke();
      ctx.fillStyle = COLORS.inkMuted;
      ctx.fillText(fmtTick(v, maxAbs), M.left - 8, y);
    }
    // x ticks
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const [, , xTicks] = niceScale(0, this.maxT, Math.max(3, Math.floor((plotR - M.left) / 90)));
    for (const t of xTicks) {
      if (t > this.maxT + 1e-9) continue;
      ctx.fillStyle = COLORS.inkMuted;
      ctx.fillText(fmtInt(t), this.x(t), HEIGHT - M.bottom + 8);
    }
    ctx.fillStyle = COLORS.inkSecondary;
    ctx.fillText("seconds since leaving the den", (M.left + plotR) / 2, HEIGHT - 16);

    // lines: whole route faint, the part already walked solid
    const cx = this.x(Math.min(this.cursorT, this.maxT));
    for (const s of this.series) {
      this.traceStep(s);
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, cx, HEIGHT);
      ctx.clip();
      this.traceStep(s);
      ctx.stroke();
      ctx.restore();
    }

    // cursor (animation time)
    ctx.strokeStyle = COLORS.inkSecondary;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(cx) + 0.5, M.top);
    ctx.lineTo(Math.round(cx) + 0.5, HEIGHT - M.bottom);
    ctx.stroke();
    for (const s of this.series) this.dot(cx, this.y(bankedAt(s, this.cursorT)), s.color);

    this.drawEndLabels();

    // hover crosshair
    if (this.hoverT !== null) {
      const hx = Math.round(this.x(this.hoverT)) + 0.5;
      ctx.strokeStyle = COLORS.inkMuted;
      ctx.beginPath();
      ctx.moveTo(hx, M.top);
      ctx.lineTo(hx, HEIGHT - M.bottom);
      ctx.stroke();
      for (const s of this.series) this.dot(hx, this.y(bankedAt(s, this.hoverT)), s.color);
    }
  }

  private traceStep(s: Series): void {
    const ctx = this.ctx;
    ctx.beginPath();
    let v = 0;
    ctx.moveTo(this.x(0), this.y(0));
    for (let k = 0; k < s.times.length; k++) {
      const x = this.x(s.times[k]);
      ctx.lineTo(x, this.y(v));
      v = s.banked[k];
      ctx.lineTo(x, this.y(v));
    }
  }

  private dot(x: number, y: number, color: string): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = COLORS.surface;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /** Direct labels at each line's end -- skipped if they'd collide (the legend still names them). */
  private drawEndLabels(): void {
    if (M.right < LABEL_SPACE) return;
    const ends = this.series.map((s) => ({ s, y: this.y(s.banked.at(-1) ?? 0), x: this.x(s.times.at(-1) ?? 0) }));
    for (let a = 0; a < ends.length; a++)
      for (let b = a + 1; b < ends.length; b++) if (Math.abs(ends[a].y - ends[b].y) < 30) return;
    const ctx = this.ctx;
    const lx = this.width - M.right + 12;
    for (const { s, y, x } of ends) {
      ctx.strokeStyle = s.color;          // leader from the line's end to its label
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6, y);
      ctx.lineTo(lx - 4, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = COLORS.inkSecondary;
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(s.name, lx, y - 1);
      ctx.textBaseline = "top";
      ctx.fillStyle = COLORS.ink;
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.fillText(`${fmtInt(s.banked.at(-1) ?? 0)} cal`, lx, y + 1);
    }
  }

  // --- interaction
  private onPointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px < M.left - 10 || px > this.width - M.right + 10) return this.setHover(null);
    this.setHover(this.snap(this.tAt(px)));
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") return this.setHover(null);
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const ev = this.eventTimes;
    let idx = this.hoverT === null ? eatenCount(ev, this.cursorT) - 1 : ev.indexOf(this.hoverT);
    idx = Math.min(ev.length - 1, Math.max(0, idx + (e.key === "ArrowRight" ? 1 : -1)));
    this.setHover(ev[idx]);
  }

  /** Snap to the nearest moment something was eaten. */
  private snap(t: number): number {
    const ev = this.eventTimes;
    const i = eatenCount(ev, t);
    const a = ev[Math.max(0, i - 1)];
    const b = ev[Math.min(ev.length - 1, i)];
    return Math.abs(a - t) <= Math.abs(b - t) ? a : b;
  }

  private setHover(t: number | null): void {
    this.hoverT = t;
    this.draw();
    const tip = this.tooltip;
    if (t === null) {
      tip.hidden = true;
      return;
    }
    tip.replaceChildren();
    const head = document.createElement("div");
    head.className = "tip-head";
    head.textContent = `at ${fmtSeconds(t)}`;
    tip.appendChild(head);
    for (const s of this.series) {
      const row = document.createElement("div");
      row.className = "tip-row";
      const key = document.createElement("span");
      key.className = "line-key";
      key.style.background = s.color;
      const value = document.createElement("strong");
      value.textContent = `${fmtInt(bankedAt(s, t))} cal`;
      const name = document.createElement("span");
      name.className = "tip-name";
      name.textContent = `${s.name} · ${eatenCount(s.times, t)} eaten`;
      row.append(key, value, name);
      tip.appendChild(row);
    }
    tip.hidden = false;
    const x = this.x(t);
    const tipW = tip.offsetWidth;
    tip.style.left = `${x + 14 + tipW > this.width ? x - 14 - tipW : x + 14}px`;
    tip.style.top = `${M.top}px`;
  }
}

/** Running score at time t. */
export function bankedAt(s: Series, t: number): number {
  const k = eatenCount(s.times, t);
  return k === 0 ? 0 : s.banked[k - 1];
}

/** Round axis bounds to clean numbers: returns [min, max, ticks]. */
function niceScale(lo: number, hi: number, count: number): [number, number, number[]] {
  const raw = (hi - lo) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return [min, max, ticks];
}
