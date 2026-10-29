# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
Speed vs. quality: which algorithm is "good enough, fast enough"?

SATISFICING (Herbert Simon): instead of demanding the single best answer,
decide in advance what counts as good enough (ASPIRATION LEVELS), then pick an
option that meets them. Here the two aspiration levels live in config.py:

    QUALITY_ASPIRATION_PCT    - at most this much extra spoilage compared with
                                the best route we know for the same map
                                (the true optimum when Held-Karp can run)
    SPEED_ASPIRATION_SECONDS  - at most this much CPU time per map at the
                                largest size tested

Procedure (python main.py tradeoff):
  1. For each size n in TRADEOFF_SIZES, make INSTANCES_PER_SIZE random maps.
  2. Run every algorithm that can handle n; record CPU time and spoilage.
  3. Reference = Held-Karp's optimum if it ran, otherwise the best route any
     algorithm found on that map ("best known").
  4. An algorithm SATISFICES if, at EVERY size, its average extra spoilage is
     within the quality aspiration, AND its average time at the largest size
     is within the speed aspiration.
  5. Recommendation = the FASTEST satisficing algorithm (once a route is good
     enough, extra quality is not worth extra time - that is the whole idea).
  6. If NOTHING satisfices, relax the quality aspiration by ASPIRATION_STEP_PCT
     and try again (Simon: aspiration levels drop when the search fails). The
     report says how far it had to be relaxed.
  We also report the Pareto front (algorithms that no other algorithm beats
  on BOTH speed and quality) for each size.

Source (verify before citing):
  H. A. Simon, "Rational choice and the structure of the environment",
  Psychological Review 63(2):129-138, 1956. doi:10.1037/h0042769
"""
from __future__ import annotations

import csv
import statistics
from collections import defaultdict
from typing import Dict, List, Tuple

from . import config
from .algorithms import ALGORITHMS, plain_text
from .benchmark import read_csv, time_cpu
from .generator import generate_instance

TRADEOFF_FIELDS = ["n", "seed", "algorithm", "cpu_seconds", "spoilage_loss", "reference_loss",
                   "reference_kind", "extra_spoilage_pct"]


def tradeoff_csv_path():
    return config.RESULTS_DIR / "tradeoff.csv"


def summary_path():
    return config.RESULTS_DIR / "tradeoff_summary.md"


def tradeoff_keys() -> List[str]:
    return [k for k in ALGORITHMS if k != "brute_force"]


def _can_run(key: str, n: int) -> bool:
    limit = config.HELD_KARP_MAX_N if key == "held_karp" else ALGORITHMS[key].max_n
    return limit is None or n <= limit


# -----------------------------------------------------------------------------
def run_tradeoff(quick: bool = False) -> List[dict]:
    sizes = config.QUICK_TRADEOFF_SIZES if quick else config.TRADEOFF_SIZES
    per_size = config.INSTANCES_PER_SIZE
    min_seconds = config.QUICK_MIN_TIMED_SECONDS
    config.RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    rows: List[dict] = []
    for n in sizes:
        keys = [k for k in tradeoff_keys() if _can_run(k, n)]
        print(f"\nn = {n}: {per_size} random maps x {len(keys)} algorithms")
        for k in range(per_size):
            seed = config.BASE_SEED + 7_000_000 + 1000 * n + k     # different maps from the runtime benchmark
            instance = generate_instance(n, seed=seed)
            results: Dict[str, Tuple[float, float]] = {}
            for key in keys:
                seconds, _reps, sol = time_cpu(ALGORITHMS[key].solve, instance, min_seconds)
                results[key] = (seconds, sol.spoilage_loss)
            if "held_karp" in results:
                reference, kind = results["held_karp"][1], "optimal"
            else:
                reference, kind = min(loss for _s, loss in results.values()), "best known"
            for key, (seconds, loss) in results.items():
                extra = (loss / reference - 1) * 100 if reference > 0 else 0.0
                rows.append({"n": n, "seed": seed, "algorithm": key, "cpu_seconds": f"{seconds:.9f}",
                             "spoilage_loss": f"{loss:.4f}", "reference_loss": f"{reference:.4f}",
                             "reference_kind": kind, "extra_spoilage_pct": f"{extra:.4f}"})
            print(f"\r  map {k + 1}/{per_size}", end="", flush=True)
        print()
    with open(tradeoff_csv_path(), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=TRADEOFF_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  -> wrote {tradeoff_csv_path()}")
    return rows


# -----------------------------------------------------------------------------
def summarize(rows: List[dict] = None) -> dict:
    """Averages per (algorithm, n), the satisficing verdict and the Pareto fronts."""
    rows = rows if rows is not None else read_csv(tradeoff_csv_path())
    groups = defaultdict(list)
    for r in rows:
        groups[(r["algorithm"], int(float(r["n"])))].append(r)
    sizes = sorted({n for _k, n in groups})
    keys = [k for k in tradeoff_keys() if any((k, n) in groups for n in sizes)]
    largest = sizes[-1]

    stats: Dict[Tuple[str, int], dict] = {}
    for (key, n), rs in groups.items():
        extras = [float(r["extra_spoilage_pct"]) for r in rs]
        times = [float(r["cpu_seconds"]) for r in rs]
        stats[(key, n)] = {"extra_mean": statistics.mean(extras), "extra_max": max(extras),
                           "time_mean": statistics.mean(times),
                           "reference": rs[0]["reference_kind"]}

    def judge(quality_bar: float) -> dict:
        out = {}
        for key in keys:
            ran_everywhere = all((key, n) in stats for n in sizes)
            worst = max(stats[(key, n)]["extra_mean"] for n in sizes) if ran_everywhere else None
            quality_ok = ran_everywhere and worst <= quality_bar
            speed_ok = ((key, largest) in stats
                        and stats[(key, largest)]["time_mean"] <= config.SPEED_ASPIRATION_SECONDS)
            out[key] = {"ran_everywhere": ran_everywhere, "worst_extra": worst, "quality_ok": quality_ok,
                        "speed_ok": speed_ok, "satisfices": quality_ok and speed_ok}
        return out

    # Start with the aspiration from config.py; if nothing qualifies, lower the bar step by step.
    quality_bar = config.QUALITY_ASPIRATION_PCT
    verdict = judge(quality_bar)
    while not any(v["satisfices"] for v in verdict.values()) and quality_bar < 100:
        quality_bar += config.ASPIRATION_STEP_PCT
        verdict = judge(quality_bar)

    satisficers = [k for k in keys if verdict[k]["satisfices"]]
    recommended = min(satisficers, key=lambda k: stats[(k, largest)]["time_mean"]) if satisficers else None

    pareto = {}
    for n in sizes:
        here = [k for k in keys if (k, n) in stats]
        front = []
        for a in here:
            sa = stats[(a, n)]
            dominated = any(
                stats[(b, n)]["time_mean"] <= sa["time_mean"] and stats[(b, n)]["extra_mean"] <= sa["extra_mean"]
                and (stats[(b, n)]["time_mean"] < sa["time_mean"] or stats[(b, n)]["extra_mean"] < sa["extra_mean"])
                for b in here if b != a)
            if not dominated:
                front.append(a)
        pareto[n] = sorted(front, key=lambda k: stats[(k, n)]["time_mean"])

    return {"sizes": sizes, "keys": keys, "stats": stats, "verdict": verdict,
            "satisficers": satisficers, "recommended": recommended, "pareto": pareto,
            "quality_bar": quality_bar, "relaxed": quality_bar > config.QUALITY_ASPIRATION_PCT}


def report(summary: dict) -> str:
    """A Markdown report (also printed to the terminal)."""
    sizes, keys, stats, verdict = summary["sizes"], summary["keys"], summary["stats"], summary["verdict"]
    q, sp = config.QUALITY_ASPIRATION_PCT, config.SPEED_ASPIRATION_SECONDS
    lines = ["# Speed vs. quality (satisficing study)", "",
             f"Aspiration levels (config.py): average extra spoilage <= {q:g}% at every size, "
             f"and <= {sp:g} s CPU per map at n = {sizes[-1]}.",
             f"{config.INSTANCES_PER_SIZE} random maps per size. Extra spoilage is measured against the "
             "optimal route (Held-Karp) where it can run, otherwise against the best route any algorithm found.",
             ""]
    if summary["relaxed"]:
        lines += [f"Nothing met {q:g}%, so the quality aspiration was relaxed in {config.ASPIRATION_STEP_PCT:g}-point "
                  f"steps until something qualified: **{summary['quality_bar']:g}%**.", ""]
    header = ("| Algorithm | " + " | ".join(f"n={n}: extra / time" for n in sizes)
              + " | Worst size | Satisfices? |")
    lines += [header, "|" + "---|" * (len(sizes) + 3)]
    for key in keys:
        cells = []
        for n in sizes:
            st = stats.get((key, n))
            cells.append("n/a (too slow)" if st is None else
                         f"{st['extra_mean']:.1f}% / {_fmt_time(st['time_mean'])}")
        v = verdict[key]
        why = "**yes**" if v["satisfices"] else "no (" + ", ".join(
            r for r, bad in (("can't run every size", not v["ran_everywhere"]),
                             ("quality", v["ran_everywhere"] and not v["quality_ok"]),
                             ("speed", v["ran_everywhere"] and not v["speed_ok"])) if bad) + ")"
        worst = "-" if v["worst_extra"] is None else f"{v['worst_extra']:.1f}%"
        lines.append(f"| {plain_text(ALGORITHMS[key].name)} | " + " | ".join(cells) + f" | {worst} | {why} |")
    lines.append("")
    for n in sizes:
        front = ", ".join(plain_text(ALGORITHMS[k].name) for k in summary["pareto"][n])
        lines.append(f"- Pareto front at n = {n} (fastest first): {front}")
    lines.append("")
    rec = summary["recommended"]
    if rec:
        st = stats[(rec, sizes[-1])]
        lines.append(f"**Most satisficing: {plain_text(ALGORITHMS[rec].name)}** - the fastest algorithm that meets "
                     f"both aspiration levels (at most {summary['quality_bar']:g}% extra spoilage at every size; "
                     f"{_fmt_time(st['time_mean'])} per map at n = {sizes[-1]}).")
        others = sorted((k for k in keys if verdict[k]["speed_ok"] and verdict[k]["worst_extra"] is not None
                         and k != rec), key=lambda k: verdict[k]["worst_extra"])
        if others:
            nxt = others[0]
            lines.append(f"Runner-up: {plain_text(ALGORITHMS[nxt].name)} - would qualify at a "
                         f"{verdict[nxt]['worst_extra']:.1f}% bar and takes "
                         f"{_fmt_time(stats[(nxt, sizes[-1])]['time_mean'])} at n = {sizes[-1]}.")
    else:
        lines.append("**No algorithm meets both aspiration levels.** Relax QUALITY_ASPIRATION_PCT or "
                     "SPEED_ASPIRATION_SECONDS in config.py (Simon: lower the aspiration when the search fails).")
    return "\n".join(lines) + "\n"


def _fmt_time(seconds: float) -> str:
    if seconds < 1e-3:
        return f"{seconds * 1e6:.0f} us"
    return f"{seconds * 1000:.1f} ms" if seconds < 1 else f"{seconds:.2f} s"
