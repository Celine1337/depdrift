/**
 * Pure semver helpers for depdrift. No dependencies, no I/O.
 *
 * Declared versions in package.json are usually ranges ("^4.17.21"), so we
 * strip the range operator, compare the underlying semver, and keep the
 * original declared string for the unified-version suggestion.
 */

/** Parse a declared version/range into semver parts, or null if opaque. */
export function parseSemver(raw) {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/^[\^~>=<\s]+/, "").replace(/^v/i, "");
  const m = cleaned.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
  );
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? null,
    raw,
  };
}

/** Compare two prerelease identifier lists per SemVer 2.0.0 rule 11. */
function comparePrerelease(a, b) {
  // A version without prerelease outranks one with prerelease.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const pa = a.split(".");
  const pb = b.split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const xa = pa[i];
    const xb = pb[i];
    if (xa === undefined) return -1;
    if (xb === undefined) return 1;
    const na = /^\d+$/.test(xa);
    const nb = /^\d+$/.test(xb);
    if (na && nb) {
      const diff = Number(xa) - Number(xb);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    } else if (na !== nb) {
      return na ? -1 : 1; // numeric identifiers sort lower
    } else if (xa !== xb) {
      return xa < xb ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Compare two declared versions. Returns -1 / 0 / 1.
 * Unparseable versions (e.g. "latest", "workspace:*") compare as equal to
 * each other and lower than any real semver, so they never win a suggestion.
 */
export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (const key of ["major", "minor", "patch"]) {
    if (pa[key] !== pb[key]) return pa[key] < pb[key] ? -1 : 1;
  }
  return comparePrerelease(pa.prerelease, pb.prerelease);
}

/**
 * Pick the highest semver among declared versions, returning the original
 * declared string (range prefix preserved). Ties keep the first occurrence;
 * opaque versions are ignored. Returns null when nothing is comparable.
 */
export function highestSemver(versions) {
  let best = null;
  for (const v of versions) {
    if (parseSemver(v) === null) continue;
    if (best === null || compareSemver(v, best) > 0) best = v;
  }
  return best;
}