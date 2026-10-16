// The three freshness tiers. Under 3 hours old, a word brings back the same
// pictures; from 3 to 24 hours they come back at once and are refreshed after
// answering; past 24 hours new ones are fetched first. Both thresholds are editable
// on the admin page.
import { decide } from "./freshness.js";
import { isSearchable, normalize } from "./normalize.js";
import { searchProviders } from "./providers.js";
import { loadSettings, lookup, lookupPrefix, recordHit, resolveAlias, store } from "./store.js";

const RESULTS_PER_SEARCH = 60;

/** Cache-only lookup, safe on every keystroke: never asks a provider. */
export async function peek(env, rawQuery) {
  const normalized = normalize(rawQuery);
  if (!normalized) return empty(rawQuery);
  const cached = await lookupPrefix(env.DB, await resolveAlias(env.DB, normalized));
  return cached ? respond(rawQuery, cached, "Fresh") : empty(rawQuery);
}

/** The real search, once typing has settled. */
export async function search(env, ctx, rawQuery) {
  const normalized = normalize(rawQuery);
  if (!isSearchable(normalized)) return empty(rawQuery);

  const query = await resolveAlias(env.DB, normalized);
  const [cached, settings] = await Promise.all([lookup(env.DB, query), loadSettings(env.DB)]);

  if (cached) {
    const age = Date.now() - Date.parse(cached.fetchedUtc);
    const action = decide(age, settings.freshTtlSeconds * 1000, settings.maxStaleSeconds * 1000);
    if (action !== "refetch") {
      if (action === "revalidate") {
        // He gets these pictures now; the next search shows the refreshed set.
        ctx.waitUntil(fetchAndStore(env, query, rawQuery).catch((error) => console.warn(`Background refresh failed: ${query}`, error)));
      }
      ctx.waitUntil(recordHitSafely(env, query));
      return respond(rawQuery, cached, action === "serve" ? "Fresh" : "Revalidating");
    }
  }

  const refreshed = await fetchAndStore(env, query, rawQuery);
  if (refreshed) {
    ctx.waitUntil(recordHitSafely(env, query));
    return respond(rawQuery, refreshed, "Live");
  }

  if (cached) {
    // Every provider failed. Old pictures beat an empty screen.
    console.warn(`Serving stale results for ${query}; no provider succeeded`);
    ctx.waitUntil(recordHitSafely(env, query));
    return respond(rawQuery, cached, "StaleFallback");
  }

  return empty(rawQuery);
}

async function fetchAndStore(env, query, rawQuery) {
  const outcome = await searchProviders(env, query, RESULTS_PER_SEARCH);
  if (!outcome) return null;
  await store(env.DB, query, rawQuery, outcome.provider, outcome.images);
  return lookup(env.DB, query);
}

// Bookkeeping for favourites and the tidy-up. A failure here must never stop
// pictures reaching the screen.
async function recordHitSafely(env, query) {
  try {
    await recordHit(env.DB, query);
  } catch (error) {
    console.warn(`Failed to record a hit for ${query}`, error);
  }
}

function respond(rawQuery, cached, origin) {
  return { query: rawQuery, images: cached.images, origin, fetchedUtc: cached.fetchedUtc };
}

function empty(rawQuery) {
  return { query: rawQuery, images: [], origin: "Empty", fetchedUtc: null };
}
