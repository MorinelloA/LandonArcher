// Created on first use, as the ASP.NET app did at startup, so a new database needs
// no setup step. Images keeps each picture's two source URLs; the bytes are fetched
// on first view and kept in Cloudflare's cache (see images.js).
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS Searches (
    NormalizedQuery TEXT PRIMARY KEY,
    RawQuery        TEXT NOT NULL,
    Provider        TEXT NOT NULL,
    FetchedUtc      TEXT NOT NULL,
    ResultCount     INTEGER NOT NULL,
    HitCount        INTEGER NOT NULL DEFAULT 0,
    LastHitUtc      TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Images (
    Hash          TEXT PRIMARY KEY,
    OriginUrl     TEXT NOT NULL,
    ThumbnailUrl  TEXT NOT NULL,
    SourcePageUrl TEXT NOT NULL,
    Title         TEXT,
    Width         INTEGER NOT NULL,
    Height        INTEGER NOT NULL,
    HasThumb      INTEGER NOT NULL DEFAULT 0,
    HasFull       INTEGER NOT NULL DEFAULT 0,
    ThumbBroken   INTEGER NOT NULL DEFAULT 0,
    ThumbBytes    INTEGER NOT NULL DEFAULT 0,
    FullBytes     INTEGER NOT NULL DEFAULT 0,
    FirstSeenUtc  TEXT NOT NULL,
    LastHitUtc    TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS SearchResults (
    NormalizedQuery TEXT NOT NULL,
    Hash            TEXT NOT NULL,
    Rank            INTEGER NOT NULL,
    PRIMARY KEY (NormalizedQuery, Hash)
  )`,
  "CREATE INDEX IF NOT EXISTS IX_SearchResults_Query ON SearchResults (NormalizedQuery, Rank)",
  `CREATE TABLE IF NOT EXISTS ProviderCalls (
    YearMonth TEXT NOT NULL,
    Provider  TEXT NOT NULL,
    CallCount INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (YearMonth, Provider)
  )`,
  "CREATE TABLE IF NOT EXISTS QueryAliases (Alias TEXT PRIMARY KEY, CanonicalQuery TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS Settings (Key TEXT PRIMARY KEY, Value TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS IX_Images_LastHit ON Images (LastHitUtc)",
  "CREATE INDEX IF NOT EXISTS IX_Searches_HitCount ON Searches (HitCount DESC)",
];

// Once per isolate. A plain flag rather than a shared promise: Workers won't let one
// request wait on I/O another request started.
let ready = false;

export async function ensureSchema(db) {
  if (ready) return;
  await db.batch(STATEMENTS.map((sql) => db.prepare(sql)));
  ready = true;
}
