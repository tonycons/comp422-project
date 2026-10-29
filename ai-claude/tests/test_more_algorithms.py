# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
Tests for the speed-vs-quality algorithms (hilbert, greedy_kd, two_opt,
balas_simonetti, vnd).   Run:  python main.py test
"""
import itertools
import math
import unittest

from raccoon.algorithms import (ALGORITHMS, balas_simonetti, greedy, greedy_kd, held_karp,
                                hilbert, two_opt, vnd)
from raccoon.generator import generate_instance
from raccoon.problem import evaluate_route


def loss(instance, order):
    return evaluate_route(instance, order, "check").spoilage_loss


class TestEveryAlgorithm(unittest.TestCase):
    def test_valid_routes_including_tiny_maps(self):
        for key, algo in ALGORITHMS.items():
            for n in (0, 1, 2, 3, 9):
                if algo.max_n is not None and n > algo.max_n:
                    continue
                inst = generate_instance(n, seed=n)
                self.assertEqual(sorted(algo.solve(inst).order), list(range(n)), msg=f"{key} n={n}")

    def test_never_better_than_optimal(self):
        for seed in range(5):
            inst = generate_instance(9, seed=seed)
            best = held_karp.solve(inst).spoilage_loss
            for key in ("hilbert", "greedy_kd", "two_opt", "balas_simonetti", "vnd"):
                self.assertGreaterEqual(ALGORITHMS[key].solve(inst).spoilage_loss, best - 1e-6, msg=key)


class TestHilbert(unittest.TestCase):
    def test_curve_visits_neighbouring_cells(self):
        """Consecutive positions on a Hilbert curve are always side-by-side grid cells."""
        bits = 3
        side = 1 << bits
        cells = sorted((hilbert.hilbert_index(x, y, bits), x, y) for x in range(side) for y in range(side))
        self.assertEqual([d for d, _, _ in cells], list(range(side * side)))
        for (_, x1, y1), (_, x2, y2) in zip(cells, cells[1:]):
            self.assertEqual(abs(x1 - x2) + abs(y1 - y2), 1)


class TestGreedyKD(unittest.TestCase):
    def test_identical_routes_to_greedy(self):
        """The k-d tree version must pick exactly what plain Greedy picks."""
        for n in (1, 2, 7, 40, 150, 400):
            for seed in range(6):
                inst = generate_instance(n, seed=seed)
                self.assertEqual(greedy_kd.solve(inst).order,
                                 greedy.solve(inst, attractiveness="ratio").order, msg=f"n={n} seed={seed}")

    def test_kd_tree_nearest_matches_linear_scan(self):
        inst = generate_instance(300, seed=11)
        pts = [(it.x, it.y, it.id) for it in inst.items]
        tree = greedy_kd.KDTree(pts)
        alive = {p[2]: p for p in pts}
        for step, (qx, qy) in enumerate([(5, 5), (50, 50), (99, 1), (30, 70)] * 20):
            j, d2 = tree.nearest(qx, qy)
            expect = min(alive.values(), key=lambda p: ((p[0] - qx) ** 2 + (p[1] - qy) ** 2, p[2]))
            self.assertEqual(j, expect[2])
            tree.delete(j)
            del alive[j]


class TestLocalSearch(unittest.TestCase):
    def test_two_opt_never_makes_the_route_worse(self):
        for seed in range(8):
            inst = generate_instance(60, seed=seed)
            start = greedy_kd.solve(inst).order
            better = two_opt.improve(inst, start, max_segment=20, max_passes=5)
            self.assertEqual(sorted(better), list(range(60)))
            self.assertLessEqual(loss(inst, better), loss(inst, start) + 1e-9)

    def test_balas_simonetti_matches_brute_force(self):
        """The DP must find the best order among all orders obeying the window rule."""
        for n in range(1, 7):
            for k in (1, 2, 3, 4):
                inst = generate_instance(n, seed=100 + n)
                base = hilbert.solve(inst).order
                pos = {item: p for p, item in enumerate(base)}
                best = math.inf
                for perm in itertools.permutations(base):
                    # allowed iff no item appears before an item that is k or more places earlier in base
                    ok = all(not (pos[perm[a]] >= pos[perm[b]] + k)
                             for a in range(n) for b in range(a + 1, n))
                    if ok:
                        best = min(best, loss(inst, list(perm)))
                route, cost = balas_simonetti.best_in_window(inst, base, k)
                self.assertAlmostEqual(cost, best, places=6, msg=f"n={n} k={k}")
                self.assertAlmostEqual(cost, loss(inst, route), places=6)

    def test_balas_simonetti_with_k_equal_n_is_held_karp(self):
        for seed in range(4):
            inst = generate_instance(8, seed=seed)
            _route, cost = balas_simonetti.best_in_window(inst, hilbert.solve(inst).order, k=8)
            self.assertAlmostEqual(cost, held_karp.solve(inst).spoilage_loss, places=6)

    def test_vnd_at_least_as_good_as_its_start(self):
        for seed in range(5):
            inst = generate_instance(50, seed=seed)
            self.assertLessEqual(vnd.solve(inst).spoilage_loss, greedy_kd.solve(inst).spoilage_loss + 1e-9)


class TestSatisficing(unittest.TestCase):
    """The verdict logic in tradeoff.py, on made-up numbers."""

    def _rows(self, table):
        rows = []
        for (key, n), (extra, seconds) in table.items():
            rows.append({"n": n, "seed": 1, "algorithm": key, "cpu_seconds": seconds, "spoilage_loss": 1,
                         "reference_loss": 1, "reference_kind": "best known", "extra_spoilage_pct": extra})
        return rows

    def test_fastest_good_enough_wins_and_bar_relaxes(self):
        from raccoon import config, tradeoff
        saved = (config.QUALITY_ASPIRATION_PCT, config.SPEED_ASPIRATION_SECONDS, config.ASPIRATION_STEP_PCT)
        try:
            config.QUALITY_ASPIRATION_PCT, config.SPEED_ASPIRATION_SECONDS, config.ASPIRATION_STEP_PCT = 3, 1, 1
            table = {("greedy", 10): (2, 0.001), ("greedy", 100): (2, 0.5),        # good + fast
                     ("vnd", 10): (0, 0.002), ("vnd", 100): (0, 0.9),              # better but slower
                     ("hilbert", 10): (40, 0.0001), ("hilbert", 100): (40, 0.01)}  # fast but bad
            s = tradeoff.summarize(self._rows(table))
            self.assertEqual(s["recommended"], "greedy")
            self.assertFalse(s["relaxed"])
            table[("greedy", 100)] = (4.5, 0.5)                                    # now nobody meets 3%...
            table[("vnd", 100)] = (3.2, 0.9)
            s = tradeoff.summarize(self._rows(table))
            self.assertTrue(s["relaxed"])
            self.assertEqual(s["quality_bar"], 4)                                  # ...so the bar drops to 4%
            self.assertEqual(s["recommended"], "vnd")
        finally:
            config.QUALITY_ASPIRATION_PCT, config.SPEED_ASPIRATION_SECONDS, config.ASPIRATION_STEP_PCT = saved


if __name__ == "__main__":
    unittest.main()
