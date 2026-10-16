// What to do with cached results of a given age:
//   "serve"      inside the fresh window: the same pictures, no provider call
//   "revalidate" stale but not expired: serve now, refresh after answering
//   "refetch"    expired: fetch first, then answer
export function decide(ageMs, freshTtlMs, maxStaleMs) {
  // A clock change or a bad stored time can give a negative age. Treating it as
  // brand new avoids a burst of refetches.
  if (ageMs < 0 || ageMs < freshTtlMs) return "serve";
  // A max-stale below the fresh window removes the middle tier rather than inverting it.
  return ageMs < maxStaleMs ? "revalidate" : "refetch";
}
