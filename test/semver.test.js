import { describe, expect, it } from "vitest";
import { compareSemver, highestSemver, parseSemver } from "../src/semver.js";

describe("parseSemver", () => {
  it("strips range operators", () => {
    expect(parseSemver("^4.17.21")).toMatchObject({ major: 4, minor: 17, patch: 21 });
    expect(parseSemver("~1.2.3")).toMatchObject({ major: 1, minor: 2, patch: 3 });
    expect(parseSemver(">=2.0.0")).toMatchObject({ major: 2 });
  });

  it("captures prerelease tags", () => {
    expect(parseSemver("1.0.0-beta.2").prerelease).toBe("beta.2");
  });

  it("rejects opaque versions", () => {
    expect(parseSemver("latest")).toBeNull();
    expect(parseSemver("*")).toBeNull();
    expect(parseSemver("workspace:*")).toBeNull();
    expect(parseSemver("")).toBeNull();
  });
});

describe("compareSemver", () => {
  it("compares numerically, not lexically", () => {
    expect(compareSemver("4.17.9", "4.17.21")).toBe(-1);
    expect(compareSemver("2.0.0", "10.0.0")).toBe(-1);
  });

  it("ignores range prefixes when comparing", () => {
    expect(compareSemver("^4.17.20", "~4.17.21")).toBe(-1);
    expect(compareSemver("^1.0.0", "1.0.0")).toBe(0);
  });

  it("ranks releases above prereleases", () => {
    expect(compareSemver("1.0.0", "1.0.0-alpha")).toBe(1);
    expect(compareSemver("1.0.0-alpha", "1.0.0")).toBe(-1);
  });

  it("orders prerelease identifiers per spec", () => {
    expect(compareSemver("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
    expect(compareSemver("1.0.0-alpha.1", "1.0.0-alpha.2")).toBe(-1);
    expect(compareSemver("1.0.0-alpha.1", "1.0.0-alpha.beta")).toBe(-1);
    expect(compareSemver("1.0.0-alpha", "1.0.0-alpha.1")).toBe(-1);
  });

  it("treats opaque versions as lowest", () => {
    expect(compareSemver("latest", "1.0.0")).toBe(-1);
    expect(compareSemver("latest", "*")).toBe(0);
  });
});

describe("highestSemver", () => {
  it("picks the highest patch version", () => {
    expect(highestSemver(["^4.17.20", "^4.17.21"])).toBe("^4.17.21");
  });

  it("compares numerically (9 < 21)", () => {
    expect(highestSemver(["^4.17.9", "^4.17.21"])).toBe("^4.17.21");
  });

  it("preserves the declared range prefix", () => {
    expect(highestSemver(["~1.2.3", "^1.3.0"])).toBe("^1.3.0");
  });

  it("keeps the first declaration on ties", () => {
    expect(highestSemver(["1.0.0", "^1.0.0"])).toBe("1.0.0");
  });

  it("ignores opaque versions", () => {
    expect(highestSemver(["latest", "*", "^2.0.0"])).toBe("^2.0.0");
    expect(highestSemver(["latest", "*"])).toBeNull();
    expect(highestSemver([])).toBeNull();
  });
});