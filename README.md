# COMP 422 - Algorithm Project

### *Anthony Constantinescu, George Rule, Josh Burick, Lucas Sanderson*

## Viewing the Solutions

* Code for the demo of the selected algorithms is located in `demo/src`.
* Demo is accessible at [https://comp422-project.pages.dev].

## Our Problem: *"The Greedy Raccoon"*

This is is a modified version of the traveling repairman problem, in which a path must be selected through a graph of varying-distance nodes such that the sum of the waiting times for each node is the smallest possible. The problem consists of a list of food items that each have an XY position on a fixed-size 2D plane, and a type. Each type (e.g. pizza, fish), has a caloric value and a decay rate. Once a food item is eaten, it’s gone. The goal of the raccoon is to travel a path that results in the maximum caloric intake with the least spoiled food. The score of a given path that the raccoon takes is determined by each food item as follows:

* The score is increased proportional to how much caloric value the item has.
* The score is decreased if the item is spoiled.

The path with the highest possible score wins. Assume for simplicity’s sake that the raccoon can travel in a straight line towards the desired food item, to avoid layering a spatial pathfinding algorithm on top of this problem.

## Our Solutions

We will implement two solution algorithms.

* ### Easy (Greedy Algorithm):
    At the starting position (and after consuming a food item), look at all remaining food items. Calculate an attractiveness for each item, something like:
    attractiveness = decay rate * (freshness upon arrival / calories).
    Then navigate to and consume the item with the highest attractiveness. This approach is based on “instant gratification” (however, with the decay rate multiplier causing the raccoon to prioritize items that won’t last much longer). This gives a baseline for our second algorithm to beat.

* ### Hard (Dynamic Programming):
    We will implement a “Subset Dynamic Programming (Subset DP)”. This would be much more complex to code but could result in a more optimal solution because dynamic programming can calculate an entire path ahead of time instead of taking decisions in the moment like our greedy algorithm.

<!-- The sections below were written by Claude (AI), 2026-11-13. See AI_CONTRIBUTIONS.md. -->
## Implementation

The reference implementation is the TypeScript code in [`demo/src/solutions/`](demo/src/solutions/).
Pseudocode, running-time analysis and the correctness proof are in the project report.

| | Algorithm | Running time | Code |
|---|---|---|---|
| Straightforward | **Greedy** (Smith's ratio rule) | Θ(n²) | [`greedy.ts`](demo/src/solutions/greedy.ts) |
| Clever | **Subset DP** (exact; always finds the best route) | Θ(n²·2ⁿ), O(n²·2ⁿ·F) with label lists | [`subsetDp.ts`](demo/src/solutions/subsetDp.ts) |

F is the longest list of (time, loss) labels kept in one table cell; it is small in practice.

**Scoring** ([`problem.ts`](demo/src/core/problem.ts)): eating an item at time *t* is worth
`calories × max(0, 1 − t / shelfLife)`. Food loses freshness in a straight line and spoiled food is
worth 0 calories, never less. Both algorithms minimize the calories lost to waiting,
`Σ w · min(t, shelfLife)` with `w = calories / shelfLife`.

**Run, test and deploy:** see [`demo/README.md`](demo/README.md). In short: `cd demo`, `npm install`,
then `npm run dev` for the site or `npm test` for the tests. The tests check Subset DP against an
exhaustive search of every possible order on small maps.

**CPU-time benchmark:** `npm run benchmark` (in `demo/`) solves 10 random maps per size with each
algorithm and writes CSVs, a summary and charts to [`demo/benchmark/results/`](demo/benchmark/results/),
including a least-squares fit of each running-time bound
([summary](demo/benchmark/results/summary.md)).

## References

The papers behind Subset DP (PDFs are kept locally in `scientific_sources/`, which is not committed):

1. B. Y. Wu, Z.-N. Huang, and F.-J. Zhan, "Exact algorithms for the minimum latency problem," *Information Processing Letters*, vol. 92, no. 6, pp. 303–309, 2004. doi:10.1016/j.ipl.2004.09.009. The exact O(n²·2ⁿ) dynamic program over (visited set, last vertex) for the traveling repairman problem.
2. R. Roberti and A. Mingozzi, "Dynamic ng-path relaxation for the delivery man problem," *Transportation Science*, vol. 48, no. 3, pp. 413–424, 2014. doi:10.1287/trsc.2013.0474. The same recursion, with dominance rules.
3. J. N. Tsitsiklis, "Special cases of traveling salesman and repairman problems with time windows," *Networks*, vol. 22, no. 3, pp. 263–282, 1992. doi:10.1002/net.3230220305. Forward dynamic programming that propagates labels and tracks both time and waiting time.
4. J. Pei, N. Mladenović, D. Urošević, J. Brimberg, and X. Liu, "Solving the traveling repairman problem with profits: A novel variable neighborhood search approach," *Information Sciences*, vol. 507, pp. 108–123, 2020. doi:10.1016/j.ins.2019.08.017. Defines the problem ours is a weighted version of: a profit that stops at zero.
5. M. Held and R. M. Karp, "A dynamic programming approach to sequencing problems," *J. SIAM*, vol. 10, no. 1, pp. 196–210, 1962. doi:10.1137/0110015. Origin of the (set, last item) table, for the traveling salesman problem.
6. R. Bellman, "Dynamic programming treatment of the travelling salesman problem," *J. ACM*, vol. 9, no. 1, pp. 61–63, 1962. doi:10.1145/321105.321111. The same table, found independently.
7. A. Blum, P. Chalasani, D. Coppersmith, B. Pulleyblank, P. Raghavan, and M. Sudan, "The minimum latency problem," *STOC 1994*, pp. 163–171. doi:10.1145/195058.195125. The sum-of-arrival-times objective.

The papers behind Greedy:

8. W. E. Smith, "Various optimizers for single-stage production," *Naval Research Logistics Quarterly*, vol. 3, no. 1–2, pp. 59–66, 1956. doi:10.1002/nav.3800030106. The ratio rule used as the attractiveness formula.
9. D. J. Rosenkrantz, R. E. Stearns, and P. M. Lewis II, "An analysis of several heuristics for the traveling salesman problem," *SIAM J. Computing*, vol. 6, no. 3, pp. 563–581, 1977. doi:10.1137/0206041. Analysis of the nearest-neighbor loop Greedy is built on.

How the papers map to Subset DP's dominance rule (`subsetDp.ts`, "Dominance"): a label that is no
later and no cheaper than another is dropped, which is the standard rule Roberti & Mingozzi [2] use; a
later-but-cheaper label wins by Claim 1 of Wu et al. [1], adapted so that food that has already
spoiled is not counted. Our own, not from any paper: that adaptation, the per-item weights, and the
O(n²·2ⁿ·F) bound. Verify sources and DOIs yourselves before citing (course rule);
the DOIs of sources 3 and 6 in particular were not checked against the papers.

## AI contributions

Parts of this project were written with AI assistance (Claude). [AI_CONTRIBUTIONS.md](AI_CONTRIBUTIONS.md)
logs every session: the prompts, what was produced, and the decisions the group should review.
AI-written files carry an `AI-GENERATED` banner.
