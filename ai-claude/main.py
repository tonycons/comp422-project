# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
The Greedy Raccoon - COMP 422 algorithms project.  Start here.

    python main.py                      menu (what run.bat / run.sh open)
    python main.py demo                 watch Greedy vs Held-Karp race on a random map
    python main.py demo --n 12 --seed 3 --save results/race.gif
    python main.py demo --n 60 --algos greedy two_opt vnd     (pick the racers)
    python main.py benchmark            full CPU-time benchmark, every algorithm (about 6 minutes)
    python main.py benchmark --quick    smaller benchmark                         (about a minute)
    python main.py benchmark --only greedy held_karp     just the original two
    python main.py tradeoff             speed-vs-quality study: which algorithm is "good enough"?
    python main.py plots                re-draw the charts from saved results
    python main.py test                 correctness tests (Held-Karp vs brute force, ...)
"""
from __future__ import annotations

import argparse
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from raccoon import config                       # noqa: E402
from raccoon.algorithms import ALGORITHMS, BENCHMARK_ALGORITHMS   # noqa: E402


# -----------------------------------------------------------------------------
# Commands
# -----------------------------------------------------------------------------
def cmd_demo(args) -> None:
    from raccoon.race import export_json, make_race, print_summary

    instance, solutions = make_race(args.n, args.seed, args.algos)
    print_summary(instance, solutions)

    if args.export:
        print(f"Exported map + routes to {export_json(instance, solutions, args.export)}")

    if args.save or args.snapshot or args.no_show:
        import matplotlib
        matplotlib.use("Agg")                   # files only, no window
    from raccoon.visuals.animate import RaceAnimation

    if args.save or args.snapshot:
        race = RaceAnimation(instance, solutions, interactive=False)
        if args.snapshot:
            print(f"Saved still image to {race.save_snapshot(args.snapshot)}")
        if args.save:
            print(f"Saving animation to {args.save} (this takes a little while)...")
            race.save(args.save, progress=_progress_printer("  frames"))
            print(f"\nSaved {args.save}")
        race.close()
        return
    if args.no_show:
        return

    def new_race():
        inst, sols = make_race(args.n, None, args.algos)
        print_summary(inst, sols)
        return inst, sols

    RaceAnimation(instance, solutions, interactive=True, new_race=new_race).show()


def cmd_benchmark(args) -> None:
    from raccoon.benchmark import run_benchmark
    keys = args.only or list(BENCHMARK_ALGORITHMS)
    run_benchmark(keys, quick=args.quick)
    _make_plots(keys)


def cmd_tradeoff(args) -> None:
    from raccoon.tradeoff import report, run_tradeoff, summarize, summary_path
    rows = run_tradeoff(quick=args.quick)
    summary = summarize(rows)
    text = report(summary)
    print("\n" + text)
    summary_path().write_text(text, encoding="utf-8")
    print(f"  -> wrote {summary_path()}")
    import matplotlib
    matplotlib.use("Agg")
    from raccoon.visuals.plots import plot_tradeoff
    print(f"  plot -> {plot_tradeoff(summary)}")


def cmd_plots(args) -> None:
    _make_plots(args.only or list(ALGORITHMS))


def cmd_test(args) -> int:
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"), top_level_dir=str(ROOT))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


def _make_plots(keys) -> None:
    import matplotlib
    matplotlib.use("Agg")
    from raccoon.visuals.plots import make_all_plots
    made = make_all_plots(keys)
    if not made:
        print("No results found yet - run the benchmark first.")
    for path in made:
        print(f"  plot -> {path}")


def _progress_printer(label):
    def show(i, total):
        sys.stdout.write(f"\r{label}: {i + 1}/{total}")
        sys.stdout.flush()
    return show


# -----------------------------------------------------------------------------
# Menu (for double-clicking run.bat)
# -----------------------------------------------------------------------------
MENU = """
==================================================
   The Greedy Raccoon  -  COMP 422 project
==================================================
  1) Watch the race: Greedy vs Held-Karp (window)
  2) Save the race as results/race.gif
  3) Quick benchmark + plots   (about 1 minute)
  4) Full benchmark + plots    (about 6 minutes)
  5) Speed-vs-quality study: which algorithm is "good enough"?
  6) Re-draw plots from saved results
  7) Run correctness tests
  q) Quit
"""


def menu() -> None:
    import subprocess
    choices = {
        "1": ["demo"],
        "2": ["demo", "--save", str(config.RESULTS_DIR / "race.gif"),
              "--snapshot", str(config.RESULTS_DIR / "race_final.png")],
        "3": ["benchmark", "--quick"],
        "4": ["benchmark"],
        "5": ["tradeoff"],
        "6": ["plots"],
        "7": ["test"],
    }
    while True:
        print(MENU)
        choice = input("Choose an option: ").strip().lower()
        if choice in ("q", "quit", "exit", ""):
            return
        if choice in choices:
            # Each option runs as its own Python process so window/file drawing
            # modes never interfere with each other.
            subprocess.run([sys.executable, str(ROOT / "main.py"), *choices[choice]], cwd=str(ROOT))
        else:
            print("Please type 1-7 or q.")


# -----------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="The Greedy Raccoon - COMP 422")
    sub = parser.add_subparsers(dest="command")

    demo = sub.add_parser("demo", help="animate the algorithms on one random map")
    demo.add_argument("--n", type=int, default=config.DEMO_N, help="number of food items")
    demo.add_argument("--seed", type=int, default=config.DEMO_SEED, help="random map seed")
    demo.add_argument("--save", type=Path, help="save animation to a .gif (or .mp4 with ffmpeg)")
    demo.add_argument("--snapshot", type=Path, help="save the finished race as a .png")
    demo.add_argument("--export", type=Path, help="save map + routes as .json")
    demo.add_argument("--no-show", action="store_true", help="don't open a window")
    demo.add_argument("--algos", nargs="+", choices=list(ALGORITHMS),
                      help="which algorithms race (default: config.RACE_ALGORITHMS)")
    demo.set_defaults(func=cmd_demo)

    bench = sub.add_parser("benchmark", help="measure CPU time and draw the plots")
    bench.add_argument("--quick", action="store_true", help="fewer sizes (about a minute)")
    bench.add_argument("--only", nargs="+", choices=list(ALGORITHMS), help="which algorithms")
    bench.set_defaults(func=cmd_benchmark)

    trade = sub.add_parser("tradeoff", help="speed-vs-quality study + satisficing verdict")
    trade.add_argument("--quick", action="store_true", help="smaller maps (about 15 seconds)")
    trade.set_defaults(func=cmd_tradeoff)

    plots = sub.add_parser("plots", help="re-draw plots from results/*.csv")
    plots.add_argument("--only", nargs="+", choices=list(ALGORITHMS))
    plots.set_defaults(func=cmd_plots)

    test = sub.add_parser("test", help="run the correctness tests")
    test.set_defaults(func=cmd_test)
    return parser


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command is None:
        menu()
        return 0
    return args.func(args) or 0


if __name__ == "__main__":
    sys.exit(main())
