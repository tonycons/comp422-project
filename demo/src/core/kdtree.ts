// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * SAME ROUTE AS GREEDY, MUCH FASTER: Greedy with k-d trees
 * Port of raccoon/algorithms/greedy_kd.py. This is step 1 of Greedy + 2-opt.
 *
 * Greedy picks the item with the largest  w_j / travel_time(here, j). Every item
 * of one food type has the same w, so among (say) all the fish the best one is
 * simply the NEAREST fish. Keep one k-d tree per food type; each step ask each
 * tree for its nearest uneaten item and take the best of those few candidates.
 * That is exactly the item Greedy would pick (tests/algorithms.test.ts checks it).
 *
 *     GREEDY-KD-RACCOON(items, den)
 *      1  for each food type f:  tree[f] <- BUILD-KD-TREE(items of type f)
 *      2  here <- den;  clock <- 0;  route <- empty
 *      3  repeat n times
 *      4      best <- NIL
 *      5      for each food type f with uneaten items           # 5 types = a constant
 *      6          j <- NEAREST(tree[f], here)                   # O(log n) expected
 *      7          if w_j / travel(here, j) > best value:  best <- j
 *      8      walk to best;  DELETE(tree[type of best], best)   # O(log n)
 *      9      append best to route
 *     10  return route
 *
 * Running time: O(n log^2 n) expected on uniformly random maps
 * (O(n^2) worst case for very unlucky layouts). Memory: Theta(n).
 */
import { attractiveness } from "./greedy";
import { distance, type Instance } from "./problem";

/** A small 2-D k-d tree supporting "nearest alive point" and "delete point". */
export class KDTree {
  private readonly x: Float64Array;
  private readonly y: Float64Array;
  private readonly item: Int32Array;
  private readonly axis: Uint8Array;     // 0 = split on x, 1 = split on y
  private readonly left: Int32Array;     // child node numbers (-1 = none)
  private readonly right: Int32Array;
  private readonly parent: Int32Array;
  private readonly alive: Int32Array;    // not-yet-eaten points in this subtree
  private readonly dead: Uint8Array;
  private readonly nodeOf = new Map<number, number>();
  private next = 0;
  private readonly root: number;

  /** points = [x, y, itemId][] */
  constructor(points: [number, number, number][]) {
    const n = points.length;
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.item = new Int32Array(n);
    this.axis = new Uint8Array(n);
    this.left = new Int32Array(n).fill(-1);
    this.right = new Int32Array(n).fill(-1);
    this.parent = new Int32Array(n).fill(-1);
    this.alive = new Int32Array(n);
    this.dead = new Uint8Array(n);
    this.root = this.build(points.slice(), 0, -1);
  }

  private build(pts: [number, number, number][], depth: number, parent: number): number {
    if (pts.length === 0) return -1;
    const axis = depth % 2;
    pts.sort((a, b) => a[axis] - b[axis] || a[2] - b[2]);   // sort along this level's axis
    const mid = pts.length >> 1;                            // the median becomes this node
    const node = this.next++;
    const [px, py, pid] = pts[mid];
    this.x[node] = px;
    this.y[node] = py;
    this.item[node] = pid;
    this.axis[node] = axis;
    this.parent[node] = parent;
    this.alive[node] = pts.length;
    this.nodeOf.set(pid, node);
    this.left[node] = this.build(pts.slice(0, mid), depth + 1, node);
    this.right[node] = this.build(pts.slice(mid + 1), depth + 1, node);
    return node;
  }

  get remaining(): number {
    return this.root >= 0 ? this.alive[this.root] : 0;
  }

  /** Mark a point as eaten and update the alive counts up to the root. O(depth). */
  delete(itemId: number): void {
    let node = this.nodeOf.get(itemId)!;
    this.dead[node] = 1;
    while (node >= 0) {
      this.alive[node]--;
      node = this.parent[node];
    }
  }

  /**
   * Closest alive point to (qx, qy); ties go to the smaller item id.
   * Branch-and-bound: search the query's side of the split first, and only
   * cross the splitting line if it is closer than the best point so far.
   */
  nearest(qx: number, qy: number): number {
    let bestD2 = Infinity;
    let bestItem = -1;
    const stackNode: number[] = [this.root];
    const stackD2: number[] = [0];     // squared distance from query to the node's region
    while (stackNode.length > 0) {
      const node = stackNode.pop()!;
      const regionD2 = stackD2.pop()!;
      if (node < 0 || this.alive[node] === 0 || regionD2 > bestD2) continue;
      const px = this.x[node];
      const py = this.y[node];
      if (!this.dead[node]) {
        const dx = px - qx;
        const dy = py - qy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2 || (d2 === bestD2 && this.item[node] < bestItem)) {
          bestD2 = d2;
          bestItem = this.item[node];
        }
      }
      const diff = this.axis[node] === 0 ? qx - px : qy - py;
      const [near, far] = diff < 0 ? [this.left[node], this.right[node]] : [this.right[node], this.left[node]];
      stackNode.push(far, near);       // near is popped (visited) first
      stackD2.push(diff * diff, 0);
    }
    return bestItem;
  }
}

/** Greedy's exact route, built in O(n log^2 n) expected time. Returns item ids. */
export function greedyKdRoute(inst: Instance): number[] {
  const items = inst.items;
  const byType = new Map<string, [number, number, number][]>();
  for (const it of items) {
    if (!byType.has(it.food.name)) byType.set(it.food.name, []);
    byType.get(it.food.name)!.push([it.x, it.y, it.id]);
  }
  const trees = new Map<string, KDTree>();                             // [L1]
  for (const [name, pts] of byType) trees.set(name, new KDTree(pts));

  let [hx, hy] = inst.start;                                           // [L2]
  const route: number[] = [];
  for (let step = 0; step < items.length; step++) {                    // [L3]
    let best = -1;                                                     // [L4]
    let bestValue = -Infinity;
    for (const tree of trees.values()) {                               // [L5]
      if (tree.remaining === 0) continue;
      const j = tree.nearest(hx, hy);                                  // [L6]
      const travel = distance(hx, hy, items[j].x, items[j].y) / inst.speed;
      const value = attractiveness(items[j], travel);
      if (value > bestValue || (value === bestValue && j < best)) {    // [L7]
        best = j;
        bestValue = value;
      }
    }
    hx = items[best].x;                                                // [L8]
    hy = items[best].y;
    trees.get(items[best].food.name)!.delete(best);                    // [L8]
    route.push(best);                                                  // [L9]
  }
  return route;                                                        // [L10]
}
