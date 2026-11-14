// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/** Number formatting shared by every part of the page. */

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** 1,284  (never "-0"). Uses a real minus sign. */
export const fmtInt = (v: number): string => whole.format(Math.round(v) || 0).replace("-", "−");

/** Axis tick: full under 10,000, compact (12K) at or above. */
export const fmtTick = (v: number, maxAbs: number): string =>
    (maxAbs >= 10_000 ? compact.format(v) : whole.format(v)).replace("-", "−");

export function fmtMs(ms: number): string {
    if (ms < 0.1) {
        return `${(ms * 1000).toFixed(0)} µs`;
    }
    if (ms < 10) {
        return `${ms.toFixed(2)} ms`;
    }
    return `${ms.toFixed(0)} ms`;
}

export const fmtSeconds = (s: number): string => `${fmtInt(s)} s`;

export const fmtPct = (v: number): string => `${Math.abs(v) < 10 ? v.toFixed(1) : v.toFixed(0)}%`;
