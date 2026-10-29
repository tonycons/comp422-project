<!-- AI-GENERATED (Claude, 2026-10-29): this log was written by the AI and should be kept up to date by the group. -->
# AI Contributions Log

The project spec encourages AI assistance; this file keeps track of exactly what
the AI did, so the group can see it and take ownership of every decision.

## Session 1 - 2026-10-29

| | |
|---|---|
| **AI tool** | Claude (Anthropic), model Claude Opus 5.5, via claude.ai |
| **Prompted by** | George Rule |
| **Git branch** | `claude/raccoon-algorithms` (one commit, marked `Co-Authored-By: Claude`) |
| **Inputs given** | `README.md` from this repo and the course `Project_Spec.docx` |

**Prompt (verbatim):**
> Set this project up for me on VSCode and implement the two algorithms in an easy to read way
> with comments and all and nice visuals that we can change or replace. This is a group project
> to make the AI contributions apparent and separate. Read the readme.

### How AI-written code is marked

1. Every file the AI created starts with an `AI-GENERATED FILE` banner.
2. All of it arrived in one separate commit on the branch above.
3. In `README.md` only the "Viewing the Solutions" section was replaced, and it is labeled.
4. **Please tag your own changes** to AI files with `# [EDIT: your name]` so it stays clear who wrote what.

### Files created by the AI

| File | What it is |
|---|---|
| `main.py` | Entry point: menu + `demo`, `benchmark`, `plots`, `test` commands |
| `raccoon/problem.py` | Food types, food items, instances, and the ONE route-scoring function |
| `raccoon/config.py` | Every tunable number (map, food types, greedy formula, benchmark sizes) |
| `raccoon/generator.py` | Reproducible random instances (seeded) |
| `raccoon/algorithms/greedy.py` | Straightforward algorithm, Θ(n²), numbered pseudocode in the docstring |
| `raccoon/algorithms/held_karp.py` | Clever algorithm, Θ(n²·2ⁿ), pseudocode + correctness argument in the docstring |
| `raccoon/algorithms/brute_force.py` | Reference only: Θ(n·n!) exhaustive search, used to *prove* Held-Karp is optimal in the tests |
| `raccoon/algorithms/__init__.py` | Registry so benchmark/plots/animation can look algorithms up by name |
| `raccoon/race.py` | Runs all algorithms on one map; JSON export for other front ends |
| `raccoon/benchmark.py` | CPU-time benchmark, ≥10 instances per size, writes `results/*.csv` |
| `raccoon/visuals/theme.py` | All colors, shapes, sizes, animation speed; sprite support |
| `raccoon/visuals/animate.py` | Side-by-side race animation (live window, GIF/MP4, PNG) |
| `raccoon/visuals/plots.py` | Spec plots: scatter + average line + theoretical fit, plus extras |
| `tests/test_algorithms.py` | 11 unit tests (built-in `unittest`, nothing to install) |
| `run.bat`, `run.sh` | One-step launchers (create `.venv`, install numpy+matplotlib, open menu) |
| `.vscode/*` | Run/debug configurations, tasks, settings, extension recommendation |
| `requirements.txt`, `.gitignore`, `.gitattributes`, `assets/sprites/README.md`, `results/.gitkeep` | Setup files |

### Decisions the AI made that the group should review

1. **Exact scoring rule** (`problem.py`). The README describes the score in words; the AI chose
   `score = calories × (1 − t / shelf_life)` per item, and the raccoon eats **every** item.
   Freshness below 0 = spoiled, and the score goes negative. *Why:* with this rule,
   maximizing the score is exactly the weighted Traveling Repairman / minimum-latency objective
   `minimize Σ wᵢ·tᵢ`, and that is what makes Held-Karp provably optimal. A threshold rule
   (e.g. a fixed penalty once spoiled) or letting the raccoon skip food would break the DP's
   optimal substructure; Held-Karp would then need extra state (e.g. elapsed time) per table entry.
2. **Greedy attractiveness** (`greedy.py`). The README's sketch,
   `decay rate × (freshness on arrival / calories)`, divides by calories, so it prefers
   *smaller* meals. All candidate formulas are implemented and selectable in `config.py`
   (`GREEDY_ATTRACTIVENESS`). The default is `ratio` = `decay rate × calories / travel time`
   (Smith's ratio rule). Measured against the optimal route on random maps with n = 8..12, the
   extra calories lost to spoilage were on average: ratio +13%, nearest-neighbor +17%,
   README-inspired "instant" +27%, README literal +186%.
3. **Held-Karp cost trick** (`held_karp.py`): charging each walking leg
   `travel_time × (total spoil weight of uneaten food)` instead of charging each item on
   arrival. This is what lets a table indexed by (set of eaten items, last item) work. Verified
   by the tests (the DP's cost equals the real spoilage on every test map).
4. **Food types and numbers** (`config.py`) are made up: fish 300 cal/150 s, blueberries
   90 cal/250 s, pizza 285 cal/350 s, apple 95 cal/600 s, donut 260 cal/900 s. Map 100×100 m,
   speed 1 m/s, den in the middle.
5. **Timing method** (`benchmark.py`): `time.process_time()` (CPU time, as the spec asks). Small
   instances are re-run until ≥ 0.2 s of CPU time has passed and averaged, because the Windows
   CPU clock only ticks about every 16 ms.
6. **Benchmark sizes**: Greedy n = 50..1000, Held-Karp n = 2..16 (n = 16 ≈ 0.65 s per run on
   the AI's test machine). The full benchmark took about 1.5 minutes there.

### Things to confirm with the team / professor

- **Spec fit.** The spec asks for a clever algorithm that *asymptotically outperforms* the
  straightforward one. Greedy (Θ(n²)) is much **faster** than Held-Karp (Θ(n²·2ⁿ)); Held-Karp
  wins on **solution quality** (always optimal; see `plot_quality_greedy_vs_optimal.png`). The spec
  says outperformance "can take many forms", but if the professor wants a running-time win, the
  textbook pairing is **Brute force Θ(n·n!) vs Held-Karp Θ(n²·2ⁿ)**. Brute force is already
  implemented: `python main.py benchmark --only brute_force held_karp`.
- The scoring rule and greedy formula above are the group's to own; change them in one place each.

### Sources mentioned in the code

The AI checked on 2026-10-29 that these publications exist with these details (title, venue,
pages, DOI). **Nobody has read them for this project yet.** The spec says AI is not a source,
so read the relevant parts yourselves before citing them in the report.

- M. Held, R. M. Karp. "A dynamic programming approach to sequencing problems."
  *J. SIAM* 10(1):196-210, 1962. doi:10.1137/0110015
- R. Bellman. "Dynamic programming treatment of the travelling salesman problem."
  *J. ACM* 9(1):61-63, 1962.
- A. Blum, P. Chalasani, D. Coppersmith, W. R. Pulleyblank, P. Raghavan, M. Sudan.
  "The minimum latency problem." *STOC 1994*, pp. 163-171. doi:10.1145/195058.195125
  (defines the traveling repairman / minimum latency objective)
- W. E. Smith. "Various optimizers for single-stage production."
  *Naval Research Logistics Quarterly* 3(1-2):59-66, 1956. doi:10.1002/nav.3800030106
  (the ratio rule used by the default greedy formula)

### Not done by the AI

The written report summary, the slides, and the oral presentation. The group still needs to
understand and explain every part of this code, as the spec says.
