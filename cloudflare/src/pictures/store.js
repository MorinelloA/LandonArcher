// Everything Pictures keeps in D1: which pictures each word found, how often each
// word is used, aliases, the admin-editable settings and the provider call counts.

export const DEFAULT_FRESH_TTL_SECONDS = 3 * 3600;
export const DEFAULT_MAX_STALE_SECONDS = 24 * 3600;

/** Pictures nobody has looked at for this long are forgotten by the daily tidy-up. */
export const MAX_IMAGE_AGE_MS = 30 * 24 * 3600 * 1000;

const IMAGES_FOR_QUERY = `
  SELECT i.Hash, i.Title, i.Width, i.Height
  FROM SearchResults r
  JOIN Images i ON i.Hash = r.Hash
  WHERE r.NormalizedQuery = ? AND i.ThumbBroken = 0
  ORDER BY r.Rank`;

const now = () => new Date().toISOString();

function toImages(rows) {
  return rows.map((row) => ({
    hash: row.Hash,
    thumbUrl: `img/t/${row.Hash}`,
    fullUrl: `img/f/${row.Hash}`,
    title: row.Title ?? null,
    width: row.Width,
    height: row.Height,
  }));
}

/** "dino" -> "dinosaur" when the parent has set that up; otherwise unchanged. */
export async function resolveAlias(db, normalized) {
  const row = await db.prepare("SELECT CanonicalQuery FROM QueryAliases WHERE Alias = ?").bind(normalized).first();
  return row?.CanonicalQuery ?? normalized;
}

/** Cached results for one exact word, or null. */
export async function lookup(db, normalized) {
  const [header, images] = await db.batch([
    db.prepare("SELECT Provider, FetchedUtc FROM Searches WHERE NormalizedQuery = ?").bind(normalized),
    db.prepare(IMAGES_FOR_QUERY).bind(normalized),
  ]);
  const search = header.results[0];
  if (!search || images.results.length === 0) return null;
  return { query: normalized, provider: search.Provider, fetchedUtc: search.FetchedUtc, images: toImages(images.results) };
}

/**
 * Best cached match while he's still typing: the exact word if it's cached,
 * otherwise the most-searched word that starts with what he has typed so far.
 */
export async function lookupPrefix(db, prefix) {
  if (!prefix) return null;
  const match = await db
    .prepare(
      `SELECT NormalizedQuery, Provider, FetchedUtc FROM Searches
       WHERE NormalizedQuery = ?1 OR NormalizedQuery LIKE ?2 ESCAPE '~'
       ORDER BY (NormalizedQuery = ?1) DESC, HitCount DESC
       LIMIT 1`,
    )
    .bind(prefix, `${escapeLike(prefix)}%`)
    .first();
  if (!match) return null;
  const { results } = await db.prepare(IMAGES_FOR_QUERY).bind(match.NormalizedQuery).all();
  if (results.length === 0) return null;
  return { query: match.NormalizedQuery, provider: match.Provider, fetchedUtc: match.FetchedUtc, images: toImages(results) };
}

/** Counts a search for the favourites list and keeps its pictures from being tidied away. */
export async function recordHit(db, normalized) {
  const stamp = now();
  await db.batch([
    db.prepare("UPDATE Searches SET HitCount = HitCount + 1, LastHitUtc = ?2 WHERE NormalizedQuery = ?1").bind(normalized, stamp),
    db
      .prepare("UPDATE Images SET LastHitUtc = ?2 WHERE Hash IN (SELECT Hash FROM SearchResults WHERE NormalizedQuery = ?1)")
      .bind(normalized, stamp),
  ]);
}

/**
 * Replaces a word's results with what a provider just returned, in one batch (D1
 * runs a batch as a single transaction). Each result carries a hash of its
 * full-size URL, so a picture found by two words is stored once.
 */
export async function store(db, normalized, rawQuery, provider, results) {
  const stamp = now();
  const rows = JSON.stringify(results);
  await db.batch([
    db
      .prepare(
        `INSERT INTO Searches (NormalizedQuery, RawQuery, Provider, FetchedUtc, ResultCount, HitCount, LastHitUtc)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?4)
         ON CONFLICT (NormalizedQuery) DO UPDATE SET
           RawQuery = excluded.RawQuery, Provider = excluded.Provider,
           FetchedUtc = excluded.FetchedUtc, ResultCount = excluded.ResultCount`,
      )
      .bind(normalized, rawQuery, provider, stamp, results.length),
    db.prepare("DELETE FROM SearchResults WHERE NormalizedQuery = ?").bind(normalized),
    // ThumbBroken resets on every refetch, so a thumbnail that failed once (a
    // timeout, a busy host) gets another chance the next day.
    db
      .prepare(
        `INSERT INTO Images (Hash, OriginUrl, ThumbnailUrl, SourcePageUrl, Title, Width, Height, FirstSeenUtc, LastHitUtc)
         SELECT json_extract(value, '$.hash'), json_extract(value, '$.originUrl'), json_extract(value, '$.thumbnailUrl'),
                json_extract(value, '$.sourcePageUrl'), json_extract(value, '$.title'),
                json_extract(value, '$.width'), json_extract(value, '$.height'), ?2, ?2
         FROM json_each(?1) WHERE true
         ON CONFLICT (Hash) DO UPDATE SET
           LastHitUtc = excluded.LastHitUtc,
           Title = COALESCE(Images.Title, excluded.Title),
           ThumbnailUrl = excluded.ThumbnailUrl,
           ThumbBroken = 0`,
      )
      .bind(rows, stamp),
    db
      .prepare(
        `INSERT INTO SearchResults (NormalizedQuery, Hash, Rank)
         SELECT ?1, json_extract(value, '$.hash'), key FROM json_each(?2) WHERE true
         ON CONFLICT (NormalizedQuery, Hash) DO UPDATE SET Rank = excluded.Rank`,
      )
      .bind(normalized, rows),
  ]);
}

/** Makes a word look expired, so its next search fetches new pictures. */
export async function setFetchedUtc(db, normalized, fetchedUtc) {
  await db.prepare("UPDATE Searches SET FetchedUtc = ? WHERE NormalizedQuery = ?").bind(fetchedUtc, normalized).run();
}

export async function loadSettings(db) {
  const { results } = await db.prepare("SELECT Key, Value FROM Settings").all();
  const values = Object.fromEntries(results.map((row) => [row.Key, Number(row.Value)]));
  return {
    freshTtlSeconds: values.FreshTtlSeconds > 0 ? values.FreshTtlSeconds : DEFAULT_FRESH_TTL_SECONDS,
    maxStaleSeconds: values.MaxStaleSeconds > 0 ? values.MaxStaleSeconds : DEFAULT_MAX_STALE_SECONDS,
  };
}

export async function saveSetting(db, key, value) {
  await db
    .prepare("INSERT INTO Settings (Key, Value) VALUES (?, ?) ON CONFLICT (Key) DO UPDATE SET Value = excluded.Value")
    .bind(key, String(value))
    .run();
}

const thisMonth = () => now().slice(0, 7);

/**
 * Counts one call to a provider and says whether it is still under the monthly
 * cap. A backstop against a bug firing a request per keystroke, not a bill: none
 * of the providers charge.
 */
export async function tryConsume(db, provider, cap) {
  const row = await db
    .prepare(
      `INSERT INTO ProviderCalls (YearMonth, Provider, CallCount) VALUES (?, ?, 1)
       ON CONFLICT (YearMonth, Provider) DO UPDATE SET CallCount = CallCount + 1
       RETURNING CallCount`,
    )
    .bind(thisMonth(), provider)
    .first();
  return row.CallCount <= cap;
}

export async function providerUsage(db) {
  const { results } = await db.prepare("SELECT Provider, CallCount FROM ProviderCalls WHERE YearMonth = ?").bind(thisMonth()).all();
  return Object.fromEntries(results.map((row) => [row.Provider, row.CallCount]));
}

/**
 * Forgets pictures nobody has looked at for 30 days, and the words left with none.
 * Their copies in Cloudflare's cache age out on their own.
 */
export async function evict(db, at = Date.now()) {
  const cutoff = new Date(at - MAX_IMAGE_AGE_MS).toISOString();
  const [stale] = await db.batch([
    db.prepare("SELECT COUNT(*) AS Count, COALESCE(SUM(ThumbBytes + FullBytes), 0) AS Bytes FROM Images WHERE LastHitUtc < ?").bind(cutoff),
    db.prepare("DELETE FROM SearchResults WHERE Hash IN (SELECT Hash FROM Images WHERE LastHitUtc < ?)").bind(cutoff),
    db.prepare("DELETE FROM Images WHERE LastHitUtc < ?").bind(cutoff),
    db.prepare("DELETE FROM Searches WHERE NormalizedQuery NOT IN (SELECT DISTINCT NormalizedQuery FROM SearchResults)"),
  ]);
  return {
    filesRemoved: stale.results[0].Count,
    bytesRemoved: stale.results[0].Bytes,
    cacheBytesRemaining: await cachedBytes(db),
  };
}

export async function cachedBytes(db) {
  const row = await db.prepare("SELECT COALESCE(SUM(ThumbBytes + FullBytes), 0) AS Bytes FROM Images").first();
  return row.Bytes;
}

// "~" as the LIKE escape character keeps backslashes out of the SQL.
function escapeLike(value) {
  return value.replaceAll("~", "~~").replaceAll("%", "~%").replaceAll("_", "~_");
}
