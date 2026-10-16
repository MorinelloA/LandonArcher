// The parent-only API behind /search/admin.html. It is off entirely unless the
// ADMIN_KEY secret is set, and every request must carry that key in an X-Admin-Key
// header or a ?key= parameter. Anything else gets a plain 404.
import { json, badRequest, notFound } from "./http.js";
import { normalize } from "./normalize.js";
import { cachedBytes, evict, loadSettings, providerUsage, saveSetting, setFetchedUtc } from "./store.js";

export async function handleAdmin(request, env, url, path) {
  if (!(await isAuthorized(request, env, url))) return notFound();
  const db = env.DB;
  const route = `${request.method} ${path}`;
  const param = (name) => url.searchParams.get(name);

  if (route === "GET /stats") return json(await stats(db));

  // Forces the next search of a word to fetch new pictures, for spot-checking.
  if (route === "POST /expire") {
    const query = normalize(param("q"));
    if (!query) return badRequest("Query required.");
    await setFetchedUtc(db, query, new Date(0).toISOString());
    return json({ expired: query });
  }

  // Backdates a word, so the freshness tiers can be tried without waiting hours.
  if (route === "POST /backdate") {
    const query = normalize(param("q"));
    if (!query) return badRequest("Query required.");
    const fetchedUtc = new Date(Date.now() - Math.abs(Number(param("hours")) || 0) * 3600 * 1000).toISOString();
    await setFetchedUtc(db, query, fetchedUtc);
    return json({ query, fetchedUtc });
  }

  if (route === "POST /settings") {
    const freshHours = Number(param("freshTtlHours"));
    const staleHours = Number(param("maxStaleHours"));
    if (freshHours > 0) await saveSetting(db, "FreshTtlSeconds", freshHours * 3600);
    if (staleHours > 0) await saveSetting(db, "MaxStaleSeconds", staleHours * 3600);
    const settings = await loadSettings(db);
    const body = { freshTtlHours: settings.freshTtlSeconds / 3600, maxStaleHours: settings.maxStaleSeconds / 3600 };
    if (settings.maxStaleSeconds < settings.freshTtlSeconds) {
      // Not fatal, but every stale search would then wait for new pictures.
      body.warning = "Max stale is below fresh TTL, so background revalidation is disabled and stale searches will wait.";
    }
    return json(body);
  }

  if (route === "POST /evict") return json(await evict(db));

  if (route === "GET /aliases") {
    const { results } = await db.prepare("SELECT Alias, CanonicalQuery FROM QueryAliases ORDER BY Alias").all();
    return json(results.map((row) => ({ alias: row.Alias, canonical: row.CanonicalQuery })));
  }

  // Quietly sends one word to another: for steering a word that brings back
  // something upsetting, without him seeing a refusal.
  if (route === "POST /aliases") {
    const alias = normalize(param("alias"));
    const canonical = normalize(param("canonical"));
    if (!alias || !canonical) return badRequest("Both alias and canonical are required.");
    if (alias === canonical) return badRequest("An alias cannot point at itself.");
    await db
      .prepare("INSERT INTO QueryAliases (Alias, CanonicalQuery) VALUES (?, ?) ON CONFLICT (Alias) DO UPDATE SET CanonicalQuery = excluded.CanonicalQuery")
      .bind(alias, canonical)
      .run();
    return json({ alias, canonical });
  }

  if (route === "DELETE /aliases") {
    await db.prepare("DELETE FROM QueryAliases WHERE Alias = ?").bind(normalize(param("alias"))).run();
    return new Response(null, { status: 204 });
  }

  return notFound();
}

async function stats(db) {
  const count = (sql) => db.prepare(sql);
  const [searches, images, thumbnails, fullSize, totalHits, top] = await db.batch([
    count("SELECT COUNT(*) AS N FROM Searches"),
    count("SELECT COUNT(*) AS N FROM Images"),
    count("SELECT COUNT(*) AS N FROM Images WHERE HasThumb = 1"),
    count("SELECT COUNT(*) AS N FROM Images WHERE HasFull = 1"),
    count("SELECT COALESCE(SUM(HitCount), 0) AS N FROM Searches"),
    db.prepare("SELECT RawQuery, HitCount, Provider, FetchedUtc FROM Searches ORDER BY HitCount DESC, LastHitUtc DESC LIMIT 40"),
  ]);
  const settings = await loadSettings(db);
  return {
    cacheBytes: await cachedBytes(db),
    searches: searches.results[0].N,
    images: images.results[0].N,
    thumbnails: thumbnails.results[0].N,
    fullSize: fullSize.results[0].N,
    totalHits: totalHits.results[0].N,
    providerCallsThisMonth: await providerUsage(db),
    freshTtlHours: settings.freshTtlSeconds / 3600,
    maxStaleHours: settings.maxStaleSeconds / 3600,
    topTerms: top.results.map((row) => ({ query: row.RawQuery, hits: row.HitCount, provider: row.Provider, fetchedUtc: row.FetchedUtc })),
  };
}

// Compared in constant time, so the key can't be worked out from response timings.
async function isAuthorized(request, env, url) {
  if (!env.ADMIN_KEY) return false;
  const supplied = request.headers.get("X-Admin-Key") ?? url.searchParams.get("key");
  if (!supplied) return false;
  const encoder = new TextEncoder();
  const given = encoder.encode(supplied);
  const expected = encoder.encode(env.ADMIN_KEY);
  return given.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(given, expected);
}
