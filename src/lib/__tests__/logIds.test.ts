import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../../store/useStore";
import { CODES } from "../errorCodes";
import { config } from "../config";

// Log ids must be strictly increasing for the session's whole life:
// Toolbar's unreviewed badge (`e.id > reviewedLogId`) and App's banner
// dismissal (`entry.id > dismissedLogId`) both treat "higher id" as
// "newer". These tests pin the property a reset would break — the
// counter used to be a module-level `let`, which Vite Fast Refresh
// re-initializes while the store's state survives.
describe("log entry ids", () => {
  beforeEach(() => {
    useStore.getState().clearLog();
  });

  const push = (message: string) =>
    useStore.getState().pushLog(CODES.CSV_LOADED, message);

  it("increases with every entry", () => {
    push("one");
    push("two");
    push("three");
    const ids = useStore.getState().logEntries.map((e) => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps increasing after clearLog, so cleared ids are never reissued", () => {
    push("before clear");
    const beforeId = useStore.getState().logEntries[0].id;
    useStore.getState().clearLog();
    push("after clear");
    expect(useStore.getState().logEntries[0].id).toBeGreaterThan(beforeId);
  });

  it("keeps increasing once the ring buffer starts dropping the oldest", () => {
    const cap = config.console.maxEntries;
    for (let i = 0; i < cap + 5; i++) push(`entry ${i}`);
    const entries = useStore.getState().logEntries;
    expect(entries.length).toBe(cap);
    const ids = entries.map((e) => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    // The newest entry is the highest id, which is what both
    // "is this unreviewed?" comparisons rely on.
    expect(ids[ids.length - 1]).toBe(Math.max(...ids));
  });

  it("tracks the next id in store state, not in a module-level counter", () => {
    const before = useStore.getState().nextLogId;
    push("bump");
    expect(useStore.getState().nextLogId).toBe(before + 1);
    expect(useStore.getState().logEntries[0].id).toBe(before);
  });
});
