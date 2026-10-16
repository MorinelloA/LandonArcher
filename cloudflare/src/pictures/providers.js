// Where pictures come from: DuckDuckGo first, Openverse behind it. A provider that
// fails returns an empty list, so the next one gets a turn and, failing all of
// them, he still gets whatever is cached.
import { BROWSER_USER_AGENT } from "./http.js";
import { hashUrl } from "./images.js";
import { tryConsume } from "./store.js";

/** Calls per provider per month. Far above real use; only a runaway loop reaches it. */
const MONTHLY_CAP = 20_000;

const API_USER_AGENT = "PictureFinder/1.0 (+https://landonarcher.com/search/)";

export async function searchProviders(env, query, count) {
  for (const provider of [duckDuckGo, openverse]) {
    if (!(await tryConsume(env.DB, provider.name, MONTHLY_CAP))) {
      console.error(`Monthly call cap reached for ${provider.name}; skipping. This means a bug, not normal use.`);
      continue;
    }
    const results = await provider.search(env, query, count);
    if (results.length > 0) {
      const images = await Promise.all(results.map(async (result) => ({ hash: await hashUrl(result.originUrl), ...result })));
      return { provider: provider.name, images };
    }
    console.log(`${provider.name} returned nothing for ${query}`);
  }
  return null;
}

// DuckDuckGo has no official image API. This calls the JSON endpoint its own page
// uses, with the per-query vqd token lifted from that page. Since October 2026 the
// endpoint answers automated callers with a bot challenge instead of results; that
// counts as a failure, and DuckDuckGo is then skipped for an hour so searches
// don't wait on it.
const DUCKDUCKGO_PAUSE_MS = 3600 * 1000;
let duckDuckGoPausedUntil = 0;

const duckDuckGo = {
  name: "duckduckgo",

  async search(env, query, count) {
    if (Date.now() < duckDuckGoPausedUntil) return [];
    try {
      const vqd = await fetchVqd(query);
      if (!vqd) {
        console.warn(`DuckDuckGo returned no vqd token for ${query}`);
        return [];
      }

      let results = await fetchDuckDuckGoResults(query, vqd, count);
      if (results === null) {
        duckDuckGoPausedUntil = Date.now() + DUCKDUCKGO_PAUSE_MS;
        console.warn("DuckDuckGo answered with a bot challenge; skipping it for an hour");
        return [];
      }

      // A stale or rejected token comes back as an empty list, not an error, so one
      // retry with a fresh token is worth it.
      if (results.length === 0) {
        const retry = await fetchVqd(query);
        if (retry && retry !== vqd) results = (await fetchDuckDuckGoResults(query, retry, count)) ?? [];
      }
      return results;
    } catch (error) {
      console.warn(`DuckDuckGo search failed for ${query}`, error);
      return [];
    }
  },
};

async function fetchVqd(query) {
  const response = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
    headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(15_000),
  });
  return response.ok ? extractVqd(await response.text()) : null;
}

/** The token appears as vqd="4-123..." or a bare vqd=4-123& depending on the page served. */
export function extractVqd(html) {
  const match = /vqd=["']([^"'&]+)["']|vqd=([^"'&\s]+)[&"']/i.exec(html);
  return match ? match[1] || match[2] || null : null;
}

/** The results, an empty list, or null when DuckDuckGo sent a challenge instead. */
async function fetchDuckDuckGoResults(query, vqd, count) {
  // p=1 is SafeSearch strict. Deliberately not configurable: nothing in this app
  // should be able to turn it off.
  const url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,,,&p=1`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_USER_AGENT,
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: "https://duckduckgo.com/",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    console.warn(`DuckDuckGo image endpoint returned ${response.status}`);
    return [];
  }
  const body = await response.json().catch(() => null);
  if (!body || body.challenge) return null;
  return parseDuckDuckGo(body, count);
}

export function parseDuckDuckGo(body, count) {
  const images = [];
  for (const item of Array.isArray(body?.results) ? body.results : []) {
    if (images.length >= count) break;
    const originUrl = text(item.image);
    const thumbnailUrl = text(item.thumbnail);
    if (!originUrl || !thumbnailUrl) continue;
    images.push({
      originUrl,
      thumbnailUrl,
      sourcePageUrl: text(item.url) ?? originUrl,
      title: text(item.title),
      width: whole(item.width),
      height: whole(item.height),
    });
  }
  return images;
}

// Openverse indexes openly licensed pictures from Flickr, Wikimedia and the like:
// good on real-world things, no cartoon characters. Without client credentials it
// allows 20 pictures per search, 20 searches a minute and 200 a day.
const OPENVERSE = "https://api.openverse.org/v1/";
let openverseToken = null; // { value, expiresAt }, per isolate

const openverse = {
  name: "openverse",

  async search(env, query, count) {
    const token = await fetchOpenverseToken(env);
    const pageSize = Math.min(count, token ? 200 : 20);
    const headers = { "User-Agent": API_USER_AGENT, Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const url = `${OPENVERSE}images/?q=${encodeURIComponent(query)}&page_size=${pageSize}&mature=false`;

    // A word Openverse hasn't been asked for recently can take 15 seconds or more,
    // and now and then a request stalls outright. Its own cache keeps working on an
    // abandoned request, so a retry after a stall usually answers at once.
    const timeouts = [20_000, 10_000];
    for (const [attempt, timeout] of timeouts.entries()) {
      try {
        const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) });
        if (response.ok) return parseOpenverse(await response.json(), count);
        console.warn(`Openverse returned ${response.status} for ${query}`);
        if (response.status < 500) return []; // throttled or refused: retrying won't help
      } catch (error) {
        console.warn(`Openverse search failed for ${query} (attempt ${attempt + 1})`, error);
      }
    }
    return [];
  },
};

export function parseOpenverse(body, count) {
  const images = [];
  for (const item of Array.isArray(body?.results) ? body.results : []) {
    if (images.length >= count) break;
    const originUrl = text(item.url);
    if (!originUrl) continue;
    images.push({
      originUrl,
      // Openverse's own resized copy; the original when it has none.
      thumbnailUrl: text(item.thumbnail) ?? originUrl,
      sourcePageUrl: text(item.foreign_landing_url) ?? originUrl,
      title: text(item.title),
      width: whole(item.width),
      height: whole(item.height),
    });
  }
  return images;
}

/** A bearer token from the client credentials, or null to stay anonymous. */
async function fetchOpenverseToken(env) {
  if (!env.OPENVERSE_CLIENT_ID || !env.OPENVERSE_CLIENT_SECRET) return null;
  if (openverseToken && Date.now() < openverseToken.expiresAt) return openverseToken.value;
  try {
    const response = await fetch(`${OPENVERSE}auth_tokens/token/`, {
      method: "POST",
      headers: { "User-Agent": API_USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.OPENVERSE_CLIENT_ID,
        client_secret: env.OPENVERSE_CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.warn(`Openverse token request failed with ${response.status}`);
      return null;
    }
    const body = await response.json();
    if (!body.access_token) return null;
    // Refreshed a minute early so a search never races the expiry.
    const lifetimeSeconds = body.expires_in > 0 ? body.expires_in : 3600;
    openverseToken = { value: body.access_token, expiresAt: Date.now() + (lifetimeSeconds - 60) * 1000 };
    return openverseToken.value;
  } catch (error) {
    console.warn("Openverse token request failed", error);
    return null;
  }
}

function text(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function whole(value) {
  return Number.isInteger(value) ? value : 0;
}
