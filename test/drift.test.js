import { describe, expect, it } from "vitest";
import { collectVersions, findDrift, summarize } from "../src/drift.js";

const pkg = (path, deps) => ({ path, deps });

describe("collectVersions", () => {
  it("merges declarations across packages", () => {
    const collected = collectVersions([
      pkg("a/package.json", { lodash: "^4.17.20" }),
      pkg("b/package.json", { lodash: "^4.17.21", react: "^18.2.0" }),
    ]);
    expect(collected.get("lodash").size).toBe(2);
    expect(collected.get("lodash").get("^4.17.20")).toEqual(["a/package.json"]);
    expect(collected.get("react").size).toBe(1);
  });

  it("deduplicates identical declarations", () => {
    const collected = collectVersions([
      pkg("a/package.json", { lodash: "^4.17.21" }),
      pkg("b/package.json", { lodash: "^4.17.21" }),
    ]);
    expect(collected.get("lodash").get("^4.17.21")).toEqual([
      "a/package.json",
      "b/package.json",
    ]);
  });

  it("handles empty input", () => {
    expect(collectVersions([]).size).toBe(0);
  });
});

describe("findDrift", () => {
  it("flags differing versions and suggests the highest semver", () => {
    const collected = collectVersions([
      pkg("a/package.json", { lodash: "^4.17.20" }),
      pkg("b/package.json", { lodash: "^4.17.21" }),
    ]);
    const drifts = findDrift(collected);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].name).toBe("lodash");
    expect(drifts[0].suggested).toBe("^4.17.21");
    expect(drifts[0].versions.map((v) => v.version)).toEqual([
      "^4.17.20",
      "^4.17.21",
    ]);
  });

  it("reports no drift when versions agree", () => {
    const collected = collectVersions([
      pkg("a/package.json", { lodash: "^4.17.21" }),
      pkg("b/package.json", { lodash: "^4.17.21" }),
    ]);
    expect(findDrift(collected)).toEqual([]);
  });

  it("sorts drifts by name and keeps opaque suggestions null", () => {
    const collected = collectVersions([
      pkg("a/package.json", { zod: "latest", axios: "^1.6.0" }),
      pkg("b/package.json", { zod: "*", axios: "^1.7.0" }),
    ]);
    const drifts = findDrift(collected);
    expect(drifts.map((d) => d.name)).toEqual(["axios", "zod"]);
    expect(drifts[0].suggested).toBe("^1.7.0");
    expect(drifts[1].suggested).toBeNull();
  });

  it("summarizes counts", () => {
    const packages = [pkg("a/package.json", { x: "1.0.0" })];
    const collected = collectVersions(packages);
    expect(summarize(packages, collected, [])).toEqual({
      packageCount: 1,
      uniqueDeps: 1,
      driftCount: 0,
    });
  });
});