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
    python main.py benchmark            full CPU-time benchmark  (about 2 minutes)
    python main.py benchmark --quick    smaller benchmark        (about 15 seconds)
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
from raccoon.algorithms import ALGORITHMS, MAIN_ALGORITHMS   # noqa: E402

HELD_KARP_WARN_N = 17


# -----------------------------------------------------------------------------
# Commands
# -----------------------------------------------------------------------------
def cmd_demo(args) -> None:
    from raccoon.race import export_json, make_race, print_summary

    if args.n >= HELD_KARP_WARN_N:
        print(f"Note: Held-Karp needs 2^{args.n} x {args.n} table cells - this may take a while.")
    instance, solutions = make_race(args.n, args.seed)
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
        inst, sols = make_race(args.n, None)
        print_summary(inst, sols)
        return inst, sols

    RaceAnimation(instance, solutions, interactive=True, new_race=new_race).show()


def cmd_benchmark(args) -> None:
    from raccoon.benchmark import run_benchmark
    keys = args.only or list(MAIN_ALGORITHMS)
    run_benchmark(keys, quick=args.quick)
    _make_plots(keys)


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
  3) Quick benchmark + plots   (about 15 seconds)
  4) Full benchmark + plots    (about 2 minutes)
  5) Re-draw plots from saved results
  6) Run correctness tests
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
        "5": ["plots"],
        "6": ["test"],
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
            print("Please type 1-6 or q.")


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
    demo.set_defaults(func=cmd_demo)

    bench = sub.add_parser("benchmark", help="measure CPU time and draw the plots")
    bench.add_argument("--quick", action="store_true", help="fewer sizes (about 15 seconds)")
    bench.add_argument("--only", nargs="+", choices=list(ALGORITHMS), help="which algorithms")
    bench.set_defaults(func=cmd_benchmark)

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
