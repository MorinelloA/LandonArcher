// The picture URLs the app shows: img/t/{hash} for thumbnails, img/f/{hash} for
// the full-size picture. Each one is fetched from where the search found it the
// first time anyone asks, then kept in Cloudflare's cache. The app's service worker
// keeps its own copy on the iPad as well, so the iPad never talks to a third party
// and anything he has seen still works offline.
import { BROWSER_USER_AGENT, badRequest, notFound } from "./http.js";

/** Any single picture larger than this is skipped. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Picture URLs never change what they point to, so browsers may keep them for good. */
const IMMUTABLE = "public, max-age=31536000, immutable";

export async function serveThumb(env, ctx, request, hash) {
  if (!isWellFormedHash(hash)) return badRequest();
  const key = cacheKey(request, "t", hash);
  const cached = await caches.default.match(key);
  if (cached) return cached;

  const row = await env.DB.prepare("SELECT ThumbnailUrl FROM Images WHERE Hash = ?").bind(hash).first();
  if (!row) return notFound();

  const fetched = await fetchImage(row.ThumbnailUrl);
  if (!fetched) {
    // The app drops a tile whose thumbnail fails, and this keeps the picture out of
    // results until the word is next refetched.
    ctx.waitUntil(env.DB.prepare("UPDATE Images SET ThumbBroken = 1 WHERE Hash = ?").bind(hash).run());
    return notFound();
  }

  const response = imageResponse(fetched);
  ctx.waitUntil(caches.default.put(key, response.clone()));
  ctx.waitUntil(
    env.DB.prepare("UPDATE Images SET HasThumb = 1, ThumbBytes = ?2 WHERE Hash = ?1").bind(hash, fetched.bytes.byteLength).run(),
  );
  return response;
}

export async function serveFull(env, ctx, request, hash) {
  if (!isWellFormedHash(hash)) return badRequest();
  const touch = env.DB.prepare("UPDATE Images SET LastHitUtc = ?2 WHERE Hash = ?1").bind(hash, new Date().toISOString());
  const key = cacheKey(request, "f", hash);
  const cached = await caches.default.match(key);
  if (cached) {
    ctx.waitUntil(touch.run());
    return cached;
  }

  const row = await env.DB.prepare("SELECT OriginUrl FROM Images WHERE Hash = ?").bind(hash).first();
  if (!row) return notFound();

  const fetched = await fetchImage(row.OriginUrl);
  if (!fetched) {
    // The original has gone away: show the thumbnail rather than nothing.
    return serveThumb(env, ctx, request, hash);
  }

  const response = imageResponse(fetched);
  ctx.waitUntil(caches.default.put(key, response.clone()));
  ctx.waitUntil(
    env.DB.batch([
      touch,
      env.DB.prepare("UPDATE Images SET HasFull = 1, FullBytes = ?2 WHERE Hash = ?1").bind(hash, fetched.bytes.byteLength),
    ]),
  );
  return response;
}

/**
 * Downloads a picture from a URL that arrived in third-party search results, so it
 * is treated as untrusted: http(s) only, size-capped, and kept only if the bytes
 * really are an image, not an HTML error page that would sit in the cache as a
 * broken tile forever.
 */
export async function fetchImage(url) {
  let target;
  try {
    target = new URL(url);
  } catch {
    return null;
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") return null;

  let response;
  try {
    response = await fetch(target, {
      headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return null; // a dead image URL is routine; the grid shows one fewer picture
  }
  if (!response.ok || Number(response.headers.get("Content-Length")) > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    return null;
  }

  const bytes = await readCapped(response, MAX_IMAGE_BYTES).catch(() => null);
  const contentType = bytes && detectFormat(bytes);
  return contentType ? { bytes, contentType } : null;
}

async function readCapped(response, limit) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * The format from the leading bytes, as a Content-Type, or null. The host's own
 * Content-Type isn't trusted: plenty serve an HTML "not found" page as image/jpeg.
 */
export function detectFormat(bytes) {
  if (bytes.length < 12) return null;
  const starts = (offset, ...values) => values.every((value, i) => bytes[offset + i] === value);
  if (starts(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0, 0x47, 0x49, 0x46, 0x38) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return "image/gif";
  if (starts(0, 0x52, 0x49, 0x46, 0x46) && starts(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** First 20 bytes of the SHA-256 of a picture's full-size URL, in hex: the same hash the old app used. */
export async function hashUrl(url) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url)));
  return Array.from(digest.subarray(0, 20), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isWellFormedHash(hash) {
  return /^[0-9a-f]{40}$/.test(hash);
}

function cacheKey(request, kind, hash) {
  return new Request(new URL(`/search/img/${kind}/${hash}`, request.url));
}

function imageResponse({ bytes, contentType }) {
  return new Response(bytes, {
    headers: { "Content-Type": contentType, "Cache-Control": IMMUTABLE, "X-Content-Type-Options": "nosniff" },
  });
}
