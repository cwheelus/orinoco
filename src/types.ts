/**
 * types.ts
 *
 * Single shared definition of a data point's shape, used across the
 * store, the CSV parser, and the grid math. Previously this shape was
 * declared independently in three separate files (useStore.ts,
 * parseCSV.ts, gridSpace.ts) — structurally identical, but redeclared,
 * meaning a future field change could get applied in one place and
 * silently drift out of sync in the others. Defining it once here and
 * importing it everywhere removes that risk.
 */
export interface DataPoint {
  uid: string;
  x: number;
  y: number;
  z: number;
  className: string;
}
