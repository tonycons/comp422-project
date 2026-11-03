// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * Page controller: settings -> race -> animation clock -> panels, chart, tables.
 *
 * The animation has two phases, like the Python race (raccoon/visuals/animate.py):
 *   1. PLANNING - each panel's bar shows how long its algorithm took to compute its
 *      route; the slowest bar fills PLANNING_SECONDS of screen time. The 2-opt map
 *      replays every flip it made, starting from Greedy's route.
 *   2. WALKING  - both raccoons leave the den together and eat along their routes.
 */
import "./style.css";
import * as config from "./core/config";
import { MAX_SEED, randomSeed } from "./core/generator";
import * as greedy from "./core/greedy";
import type { AlgorithmKey, Solution } from "./core/problem";
import { makeRace, type Race } from "./core/race";
import * as twoOpt from "./core/twoOpt";
import { fmtInt, fmtMs, fmtPct, fmtSeconds } from "./ui/format";
import { eatenCount, MapView, PLAN_BUILD_FRACTION, type PanelData } from "./ui/mapView";
import {
  ALGORITHM_COLORS, COLORS, foodStyle, PLANNING_HOLD_SECONDS, PLANNING_SECONDS, shapeSvg, STALE_BELOW, WALK_SECONDS,
} from "./ui/theme";
import { Timeline, type Series } from "./ui/timeline";

const N_MIN = 2;
const N_MAX = 2000;
const DEFAULT_N = 20;
const INFO = { greedy: greedy.INFO, two_opt: twoOpt.INFO } as const;
const KEYS: AlgorithmKey[] = ["greedy", "two_opt"];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------
interface Panel {
  key: AlgorithmKey;
  view: MapView;
  canvas: HTMLCanvasElement;
  bar: HTMLElement;
  caption: HTMLElement;
  stat: { banked: HTMLElement; eaten: HTMLElement; spoiled: HTMLElement; plan: HTMLElement };
}

function buildPanel(key: AlgorithmKey): Panel {
  const root = $(`panel-${key}`);
  const info = INFO[key];
  root.innerHTML = `
    <div class="panel-head">
      <div>
        <h2 class="panel-title"><span class="algo-key" data-algo="${key}"></span></h2>
        <p class="panel-tagline"></p>
      </div>
      <span class="chip" title="Time complexity"></span>
    </div>
    <canvas role="img"></canvas>
    <div class="plan">
      <div class="plan-bar" data-algo="${key}" aria-hidden="true"><i></i></div>
      <span class="plan-caption"></span>
    </div>
    <dl class="stats">
      <div><dt>Calories banked</dt><dd data-stat="banked">0</dd></div>
      <div><dt>Eaten</dt><dd data-stat="eaten">0</dd></div>
      <div><dt>Spoiled when eaten</dt><dd data-stat="spoiled">0</dd></div>
      <div><dt>Planning time</dt><dd data-stat="plan">–</dd></div>
    </dl>`;
  root.querySelector(".algo-key")!.textContent = info.name;
  root.querySelector(".panel-tagline")!.textContent = info.tagline;
  root.querySelector(".chip")!.textContent = info.timeComplexity;
  const canvas = root.querySelector("canvas")!;
  const q = (s: string) => root.querySelector<HTMLElement>(`[data-stat="${s}"]`)!;
  return {
    key,
    canvas,
    view: new MapView(canvas),
    bar: root.querySelector<HTMLElement>(".plan-bar > i")!,
    caption: root.querySelector<HTMLElement>(".plan-caption")!,
    stat: { banked: q("banked"), eaten: q("eaten"), spoiled: q("spoiled"), plan: q("plan") },
  };
}

const panels: Record<AlgorithmKey, Panel> = { greedy: buildPanel("greedy"), two_opt: buildPanel("two_opt") };
const timeline = new Timeline($<HTMLCanvasElement>("timeline"), $("tooltip"));

// ---------------------------------------------------------------------------
// Legends
// ---------------------------------------------------------------------------
function buildLegends(): void {
  const foods = $("food-legend");
  for (const f of config.FOOD_TYPES) {
    const li = document.createElement("li");
    const style = foodStyle(f.name);
    const name = document.createElement("strong");
    name.textContent = f.name;
    const detail = document.createElement("span");
    detail.textContent = `${f.calories} cal · spoils in ${f.shelfLife} s`;
    li.append(shapeSvg(style.shape, style.color), name, detail);
    foods.appendChild(li);
  }
  const extra = document.createElement("li");
  extra.className = "extra";
  extra.innerHTML = `<span class="fresh-key" aria-hidden="true">
      <i style="background:${COLORS.fresh}"></i><i style="background:${COLORS.stale}"></i><i style="background:${COLORS.spoiled}"></i>
    </span><span>freshness bar: fresh, below ${STALE_BELOW * 100}%, spoiled (item turns gray)</span>`;
  foods.appendChild(extra);

  const legend = $("timeline-legend");
  for (const key of KEYS) {
    const li = document.createElement("li");
    const k = document.createElement("span");
    k.className = "line-key";
    k.style.background = ALGORITHM_COLORS[key];
    const t = document.createElement("span");
    t.textContent = INFO[key].name;
    li.append(k, t);
    legend.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// State + animation clock
// ---------------------------------------------------------------------------
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  race: null as Race | null,
  maxT: 1,               // the longer of the two walks (seconds of simulated time)
  maxMs: 1,              // the slower of the two planning times
  phase: "planning" as "planning" | "walking",
  planClock: 0,          // screen seconds spent in the planning phase
  walkT: 0,              // simulated seconds since leaving the den
  playing: true,
  speed: 1,
  lastFrame: 0,
};

function startRace(n: number, seed: number): void {
  setBusy(true);
  // let the browser paint "Solving..." before the (synchronous) solve
  setTimeout(() => {
    const race = makeRace(n, seed);
    state.race = race;
    state.maxT = Math.max(race.greedy.solution.totalTime, race.twoOpt.solution.totalTime, 1e-9);
    state.maxMs = Math.max(race.greedy.ms, race.twoOpt.ms);
    const data: Record<AlgorithmKey, PanelData> = {
      greedy: { key: "greedy", instance: race.instance, solution: race.greedy.solution, decisions: race.greedy.decisions },
      two_opt: {
        key: "two_opt", instance: race.instance, solution: race.twoOpt.solution,
        startRoute: race.twoOpt.startRoute, moves: race.twoOpt.moves,
      },
    };
    for (const key of KEYS) {
      panels[key].view.setData(data[key]);
      panels[key].canvas.setAttribute("aria-label",
        `Map of ${n} food items with the ${INFO[key].name} raccoon's route. Results are in the table below.`);
    }
    timeline.setSeries(KEYS.map((key) => toSeries(key, data[key].solution)));
    renderResults(race);
    restart();
    setBusy(false);
  }, 20);
}

function toSeries(key: AlgorithmKey, s: Solution): Series {
  let sum = 0;
  return { name: INFO[key].name, color: ALGORITHM_COLORS[key], times: s.arrivalTimes, banked: s.itemScores.map((v) => (sum += v)) };
}

function restart(): void {
  state.phase = reducedMotion ? "walking" : "planning";
  state.planClock = 0;
  state.walkT = 0;
  setPlaying(!reducedMotion);
  render();
}

function frame(now: number): void {
  const dt = state.lastFrame ? Math.min(0.1, (now - state.lastFrame) / 1000) : 0;
  state.lastFrame = now;
  if (state.playing && state.race) {
    if (state.phase === "planning") {
      state.planClock += dt * state.speed;
      if (state.planClock >= PLANNING_SECONDS + PLANNING_HOLD_SECONDS) state.phase = "walking";
    } else {
      state.walkT += (dt * state.speed * state.maxT) / WALK_SECONDS;
      if (state.walkT >= state.maxT) {
        state.walkT = state.maxT;
        setPlaying(false);
      }
    }
    render();
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render(): void {
  const race = state.race;
  if (!race) return;
  const planning = state.phase === "planning";
  const p = Math.min(1, state.planClock / PLANNING_SECONDS);   // 0..1 of the slowest bar

  for (const key of KEYS) {
    const panel = panels[key];
    const result = key === "greedy" ? race.greedy : race.twoOpt;
    const own = planning ? Math.min(1, (p * state.maxMs) / Math.max(result.ms, 1e-12)) : 1;
    panel.bar.style.width = `${own * 100}%`;
    panel.caption.textContent = planCaption(key, own);
    panel.stat.plan.textContent = own >= 1 ? fmtMs(result.ms) : "…";

    if (planning) {
      panel.view.drawPlanning(own);
      panel.stat.banked.textContent = "0";
      panel.stat.eaten.textContent = `0 / ${race.instance.items.length}`;
      panel.stat.spoiled.textContent = "0";
    } else {
      panel.view.drawWalking(state.walkT);
      const s = result.solution;
      const k = eatenCount(s.arrivalTimes, state.walkT);
      let banked = 0;
      let spoiled = 0;
      for (let i = 0; i < k; i++) {
        banked += s.itemScores[i];
        if (s.itemScores[i] < 0) spoiled++;
      }
      panel.stat.banked.textContent = fmtInt(banked);
      panel.stat.eaten.textContent = `${k} / ${s.order.length}${k === s.order.length ? " ✓" : ""}`;
      panel.stat.spoiled.textContent = String(spoiled);
    }
  }

  timeline.setCursor(planning ? 0 : state.walkT);
  timeline.draw();

  const scrub = $<HTMLInputElement>("time");
  scrub.value = String(Math.round((state.walkT / state.maxT) * 1000));
  $("time-out").textContent = fmtSeconds(state.walkT);
  const phase = $("phase");
  const label = planning ? "Planning" : state.walkT >= state.maxT ? "Finished" : "Walking";
  if (phase.textContent !== label) phase.textContent = label;
}

function planCaption(key: AlgorithmKey, own: number): string {
  const race = state.race!;
  if (key === "greedy") {
    return own < 1 ? "Computing its route…" : "Decides one step at a time; faint lines show what it weighs at each step";
  }
  const total = race.twoOpt.moves?.length ?? 0;
  if (own <= PLAN_BUILD_FRACTION) return "Step 1: build Greedy's route with k-d trees…";
  const flips = MapView.flipsAt(own, total);
  if (own < 1) return `Step 2: flipping stretches that lose fewer calories, ${flips} of ${total}`;
  return total === 0
    ? "No flip helped: same route as Greedy"
    : `Planned ahead: ${total} flip${total === 1 ? "" : "s"} improved Greedy's route (dashed = rest of plan)`;
}

function renderResults(race: Race): void {
  const g = race.greedy.solution;
  const t = race.twoOpt.solution;
  const moves = race.twoOpt.moves?.length ?? 0;
  const summary = $("summary");
  summary.replaceChildren();
  const add = (text: string, strong = false) => {
    const el = strong ? document.createElement("strong") : document.createTextNode(text);
    if (strong) el.textContent = text;
    summary.appendChild(el);
  };
  const speedRatio = race.twoOpt.ms / race.greedy.ms;
  const speedText = speedRatio >= 1
    ? `took ${speedRatio.toFixed(1)}× as long to plan`
    : `planned ${(1 / speedRatio).toFixed(1)}× faster`;
  if (moves === 0) {
    add("On this map 2-opt found no flip that helps, so both raccoons walk the same route. Try a bigger map or another seed.");
  } else {
    const less = g.spoilageLoss > 0 ? ((g.spoilageLoss - t.spoilageLoss) / g.spoilageLoss) * 100 : 0;
    add("Greedy + 2-opt banked ");
    add(`${fmtInt(t.totalScore - g.totalScore)} more calories`, true);
    add(" than Greedy (");
    add(`${fmtPct(less)} less`, true);
    add(` lost to spoilage) after ${moves} flip${moves === 1 ? "" : "s"}, and ${speedText}.`);
  }

  const table = $<HTMLTableElement>("results");
  table.replaceChildren();
  const head = table.createTHead().insertRow();
  for (const h of ["Algorithm", "Final score (cal)", "Lost to spoilage (cal)", "Spoiled when eaten", "Finish time", "Planning time", "Time complexity"]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = h;
    head.appendChild(th);
  }
  const body = table.createTBody();
  for (const [key, s, ms] of [["greedy", g, race.greedy.ms], ["two_opt", t, race.twoOpt.ms]] as const) {
    const row = body.insertRow();
    const th = document.createElement("th");
    th.scope = "row";
    const name = document.createElement("span");
    name.className = "algo-key";
    name.dataset.algo = key;
    name.textContent = INFO[key].name;
    th.appendChild(name);
    row.appendChild(th);
    for (const v of [fmtInt(s.totalScore), fmtInt(s.spoilageLoss), `${s.spoiledCount} of ${s.order.length}`,
                     fmtSeconds(s.totalTime), fmtMs(ms), INFO[key].timeComplexity]) {
      row.insertCell().textContent = v;
    }
  }

  const details = $<HTMLDetailsElement>("route-details");
  $("routes").replaceChildren();
  if (details.open) renderRoutes();
}

/** Meal-by-meal table (built only when opened; can be 2,000 rows). */
function renderRoutes(): void {
  const race = state.race;
  const table = $<HTMLTableElement>("routes");
  if (!race || table.rows.length) return;
  const items = race.instance.items;
  const head = table.createTHead();
  const top = head.insertRow();
  const blank = document.createElement("th");
  top.appendChild(blank);
  for (const key of KEYS) {
    const th = document.createElement("th");
    th.colSpan = 3;
    th.className = "food group-start";
    th.scope = "colgroup";
    th.textContent = INFO[key].name;
    top.appendChild(th);
  }
  const sub = head.insertRow();
  for (const [h, cls] of [["Meal", ""], ["Food", "food group-start"], ["Eaten at", ""], ["Calories", ""],
                          ["Food", "food group-start"], ["Eaten at", ""], ["Calories", ""]]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = cls;
    th.textContent = h;
    sub.appendChild(th);
  }
  const body = table.createTBody();
  const g = race.greedy.solution;
  const t = race.twoOpt.solution;
  for (let k = 0; k < g.order.length; k++) {
    const row = body.insertRow();
    row.insertCell().textContent = String(k + 1);
    for (const s of [g, t]) {
      const food = row.insertCell();
      food.className = "food group-start";
      food.textContent = items[s.order[k]].food.name;
      row.insertCell().textContent = fmtSeconds(s.arrivalTimes[k]);
      const cal = row.insertCell();
      cal.textContent = fmtInt(s.itemScores[k]);
      if (s.itemScores[k] < 0) cal.className = "neg";
    }
  }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
const nRange = $<HTMLInputElement>("n-range");
const nInput = $<HTMLInputElement>("n-input");
const seedInput = $<HTMLInputElement>("seed-input");
const playBtn = $<HTMLButtonElement>("play");

function setPlaying(on: boolean): void {
  state.playing = on;
  playBtn.textContent = on ? "Pause" : state.walkT >= state.maxT && state.phase === "walking" ? "Replay" : "Play";
  playBtn.setAttribute("aria-pressed", String(on));
}

function setBusy(busy: boolean): void {
  document.body.style.cursor = busy ? "progress" : "";
  for (const key of KEYS) if (busy) panels[key].caption.textContent = "Solving…";
  for (const el of [nRange, nInput, seedInput, $("new-map")]) (el as HTMLInputElement).disabled = busy;
}

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));

function currentSettings(): { n: number; seed: number } {
  return { n: clampInt(Number(nInput.value), N_MIN, N_MAX), seed: clampInt(Number(seedInput.value), 0, MAX_SEED) };
}

function apply(): void {
  const { n, seed } = currentSettings();
  nInput.value = String(n);
  nRange.value = String(Math.min(n, Number(nRange.max)));
  seedInput.value = String(seed);
  const url = new URL(window.location.href);
  url.searchParams.set("n", String(n));
  url.searchParams.set("seed", String(seed));
  history.replaceState(null, "", url);
  startRace(n, seed);
}

let rangeTimer = 0;
nRange.addEventListener("input", () => {
  nInput.value = nRange.value;
  clearTimeout(rangeTimer);
  rangeTimer = window.setTimeout(apply, 250);
});
nInput.addEventListener("change", apply);
seedInput.addEventListener("change", apply);
$("controls").addEventListener("submit", (e) => {
  e.preventDefault();
  apply();
});
$("new-map").addEventListener("click", () => {
  seedInput.value = String(randomSeed());
  apply();
});
$("restart").addEventListener("click", () => {
  state.phase = "planning";
  state.planClock = 0;
  state.walkT = 0;
  setPlaying(true);
});
playBtn.addEventListener("click", togglePlay);
$<HTMLSelectElement>("speed").addEventListener("change", (e) => {
  state.speed = Number((e.target as HTMLSelectElement).value);
});
$<HTMLInputElement>("time").addEventListener("input", (e) => {
  state.phase = "walking";
  state.walkT = (Number((e.target as HTMLInputElement).value) / 1000) * state.maxT;
  setPlaying(false);
  render();
});
$<HTMLDetailsElement>("route-details").addEventListener("toggle", (e) => {
  if ((e.target as HTMLDetailsElement).open) renderRoutes();
});
document.addEventListener("keydown", (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (e.code === "Space" && !["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(tag)) {
    e.preventDefault();
    togglePlay();
  }
});

function togglePlay(): void {
  if (!state.playing && state.phase === "walking" && state.walkT >= state.maxT) state.walkT = 0;
  setPlaying(!state.playing);
}

// Redraw at the right size whenever a canvas's box changes
const observer = new ResizeObserver(() => {
  for (const key of KEYS) panels[key].view.resize();
  timeline.resize();
  render();
});
for (const key of KEYS) observer.observe(panels[key].canvas);
observer.observe($("timeline"));

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
buildLegends();
nRange.min = String(N_MIN);
nInput.min = String(N_MIN);
nInput.max = String(N_MAX);
const params = new URLSearchParams(window.location.search);
nInput.value = String(clampInt(Number(params.get("n") ?? DEFAULT_N), N_MIN, N_MAX));
seedInput.value = params.has("seed") ? String(clampInt(Number(params.get("seed")), 0, MAX_SEED)) : String(randomSeed());
apply();
requestAnimationFrame(frame);
