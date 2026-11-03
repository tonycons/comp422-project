# =============================================================================
#  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md for the full log.
#  Human edits: please tag changed lines with   # [EDIT: <your name>]
# =============================================================================
"""
Correctness tests.   Run:  python main.py test   (or the VS Code Testing panel)

Uses only Python's built-in `unittest`, so nothing extra to install.
"""
import unittest

from raccoon.algorithms import brute_force, greedy, held_karp
from raccoon.generator import generate_instance
from raccoon.problem import FoodItem, FoodType, Instance, evaluate_route


def tiny_instance(points, food=FoodType("test", calories=100, shelf_life=100)):
    items = [FoodItem(i, x, y, food) for i, (x, y) in enumerate(points)]
    return Instance(items=items, start=(0.0, 0.0), speed=1.0, width=10, height=10)


class TestScoring(unittest.TestCase):
    def test_freshness_is_linear_and_spoiled_food_scores_zero(self):
        item = tiny_instance([(0, 0)]).items[0]          # 100 cal, shelf life 100 s
        self.assertAlmostEqual(item.freshness_at(0), 1.0)
        self.assertAlmostEqual(item.freshness_at(50), 0.5)
        self.assertAlmostEqual(item.freshness_at(100), 0.0)
        self.assertAlmostEqual(item.score_at(50), 50.0)
        self.assertEqual(item.score_at(150), 0.0)        # spoiled food is worth 0, never less
        self.assertAlmostEqual(item.loss_at(50), 50.0)
        self.assertAlmostEqual(item.loss_at(150), 100.0)  # the loss stops growing at the shelf life
        self.assertTrue(item.is_spoiled_at(100))
        self.assertFalse(item.is_spoiled_at(99))

    def test_spoiled_items_count_and_score(self):
        # den (0,0) -> (0,30) at t=30 (fresh) -> (0,230) at t=230 (spoiled, worth 0)
        inst = tiny_instance([(0, 30), (0, 230)])
        sol = evaluate_route(inst, [0, 1], "manual")
        self.assertEqual(sol.item_scores[1], 0.0)
        self.assertEqual(sol.spoiled_count, 1)
        self.assertAlmostEqual(sol.total_score, 70.0)

    def test_evaluate_route_hand_computed(self):
        # den (0,0) -> (3,4) is 5 s -> (3,10) is 6 s more (t=11)
        inst = tiny_instance([(3, 4), (3, 10)])
        sol = evaluate_route(inst, [0, 1], "manual")
        self.assertEqual(sol.arrival_times, [5.0, 11.0])
        self.assertAlmostEqual(sol.total_score, 100 * 0.95 + 100 * 0.89)
        self.assertEqual(sol.spoiled_count, 0)

    def test_route_must_visit_everything_once(self):
        inst = tiny_instance([(1, 1), (2, 2)])
        with self.assertRaises(ValueError):
            evaluate_route(inst, [0, 0], "bad")
        with self.assertRaises(ValueError):
            evaluate_route(inst, [0], "bad")


class TestHeldKarp(unittest.TestCase):
    def test_matches_brute_force_on_random_maps(self):
        """Held-Karp must find the true optimum (n = 1..8, many random maps)."""
        for n in range(1, 9):
            for seed in range(12):
                inst = generate_instance(n, seed=seed)
                hk = held_karp.solve(inst)
                bf = brute_force.solve(inst)
                self.assertAlmostEqual(hk.total_score, bf.total_score, places=6,
                                       msg=f"n={n} seed={seed}")

    def test_dp_cost_equals_real_spoilage(self):
        """The DP's best loss equals the real spoilage of the route it returns."""
        for seed in range(10):
            inst = generate_instance(9, seed=seed)
            hk = held_karp.solve(inst)
            self.assertAlmostEqual(hk.notes["dp_min_cost"], hk.spoilage_loss, places=6)

    def test_never_worse_than_greedy(self):
        for seed in range(20):
            inst = generate_instance(10, seed=seed)
            self.assertGreaterEqual(held_karp.solve(inst).total_score + 1e-9,
                                    greedy.solve(inst).total_score)

    def test_edge_cases(self):
        self.assertEqual(held_karp.solve(tiny_instance([])).order, [])
        self.assertEqual(held_karp.solve(tiny_instance([(1, 1)])).order, [0])
        # several items in the same spot must not break anything
        sol = held_karp.solve(tiny_instance([(2, 2), (2, 2), (5, 5)]))
        self.assertEqual(sorted(sol.order), [0, 1, 2])


class TestGreedy(unittest.TestCase):
    def test_valid_route_for_every_formula(self):
        inst = generate_instance(40, seed=1)
        for name in greedy.ATTRACTIVENESS:
            sol = greedy.solve(inst, attractiveness=name)
            self.assertEqual(sorted(sol.order), list(range(40)), msg=name)

    def test_nearest_neighbor_on_a_line(self):
        inst = tiny_instance([(3, 0), (1, 0), (2, 0)])
        self.assertEqual(greedy.solve(inst, attractiveness="nearest").order, [1, 2, 0])

    def test_spoiled_food_is_eaten_last(self):
        """Food that is already worthless can wait; fresh food comes first."""
        short = FoodType("short", calories=100, shelf_life=5)     # spoiled before we reach it
        long_ = FoodType("long", calories=100, shelf_life=1000)
        items = [FoodItem(0, 10, 0, short), FoodItem(1, 0, 40, long_)]
        inst = Instance(items=items, start=(0.0, 0.0), speed=1.0, width=50, height=50)
        self.assertEqual(greedy.solve(inst).order, [1, 0])        # far fresh item first

    def test_recorded_decisions_match_route(self):
        inst = generate_instance(8, seed=3)
        sol = greedy.solve(inst, record_decisions=True)
        chosen = [d["chosen"] for d in sol.notes["decisions"]]
        self.assertEqual(chosen, sol.order)
        self.assertEqual([len(d["candidates"]) for d in sol.notes["decisions"]], list(range(8, 0, -1)))


class TestGenerator(unittest.TestCase):
    def test_same_seed_same_map(self):
        a, b = generate_instance(15, seed=42), generate_instance(15, seed=42)
        self.assertEqual([(i.x, i.y, i.food.name) for i in a.items],
                         [(i.x, i.y, i.food.name) for i in b.items])


if __name__ == "__main__":
    unittest.main()
