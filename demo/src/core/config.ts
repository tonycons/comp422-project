// =============================================================================
//  AI-GENERATED FILE  -  written by Claude (Anthropic AI), 2026-11-03,
//  at the request of tonycons. See ../../../ai-claude/AI_CONTRIBUTIONS.md for the full log.
//  Human edits: please tag changed lines with   // [EDIT: <your name>]
// =============================================================================
/**
 * ALL THE KNOBS IN ONE PLACE  (TypeScript copy of raccoon/config.py).
 *
 * Keep these numbers in sync with the Python version -- the parity test
 * (tests/parity.test.ts) fails if the two stop producing the same routes.
 */
import type { FoodType } from "./problem";

// The world
export const MAP_WIDTH = 100;          // meters
export const MAP_HEIGHT = 100;
export const DEN_POSITION: [number, number] = [50, 50];   // the middle of the map
export const RACCOON_SPEED = 1;        // meters per second

// calories = value when perfectly fresh, shelfLife = seconds until fully spoiled
export const FOOD_TYPES: FoodType[] = [
  { name: "fish",        calories: 300, shelfLife: 150 },   // very tasty, spoils very fast
  { name: "blueberries", calories: 90,  shelfLife: 250 },   // small snack, spoils fairly fast
  { name: "pizza",       calories: 285, shelfLife: 350 },   // the classic
  { name: "apple",       calories: 95,  shelfLife: 600 },   // keeps for a while
  { name: "donut",       calories: 260, shelfLife: 900 },   // basically immortal
];

// 2-opt local search (raccoon/config.py: TWO_OPT_MAX_SEGMENT, LOCAL_SEARCH_MAX_PASSES)
export const TWO_OPT_MAX_SEGMENT = 50; // L: longest stretch 2-opt may reverse
export const LOCAL_SEARCH_MAX_PASSES = 20; // P: safety cap on improvement passes
