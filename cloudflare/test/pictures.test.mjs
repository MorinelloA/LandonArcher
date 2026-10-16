// The pure parts of Pictures' back end, with the cases carried over from the
// ASP.NET app's tests (C:\Repos\ImageSearch\tests).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { decide } from "../src/pictures/freshness.js";
import { detectFormat, hashUrl, isWellFormedHash } from "../src/pictures/images.js";
import { MAX_QUERY_LENGTH, isSearchable, normalize } from "../src/pictures/normalize.js";
import { extractVqd, parseDuckDuckGo, parseOpenverse } from "../src/pictures/providers.js";

test("normalizes to one cache key per word", () => {
  const cases = [
    ["Dinosaur", "dinosaur"],
    ["  dinosaur  ", "dinosaur"],
    ["DINOSAUR", "dinosaur"],
    ["big   red   truck", "big red truck"],
    ["dinosaur!!!", "dinosaur"],
    ["what's a dinosaur?", "what s a dinosaur"],
    ["pokémon", "pokemon"],
    ["", ""],
    ["   ", ""],
    ["!!!", ""],
  ];
  for (const [input, expected] of cases) assert.equal(normalize(input), expected, JSON.stringify(input));
  assert.equal(normalize(null), "");
  assert.equal(normalize(undefined), "");
});

test("cuts runaway input to the maximum length", () => {
  assert.equal(normalize("a".repeat(500)).length, MAX_QUERY_LENGTH);
});

test("doesn't fold plurals", () => {
  assert.notEqual(normalize("mouse"), normalize("mice"));
  assert.notEqual(normalize("dinosaur"), normalize("dinosaurs"));
});

test("only two or more characters are searchable", () => {
  assert.equal(isSearchable("a"), false);
  assert.equal(isSearchable(""), false);
  assert.equal(isSearchable("go"), true);
  assert.equal(isSearchable("dinosaur"), true);
});

test("freshness tiers match the old app's boundaries", () => {
  const hour = 3600 * 1000;
  const at = (hours) => decide(hours * hour, 3 * hour, 24 * hour);
  for (const hours of [0, 0.08, 1, 2.99, 2.9999, -5]) assert.equal(at(hours), "serve", `${hours}h`);
  for (const hours of [3, 6, 23.99, 23.9999]) assert.equal(at(hours), "revalidate", `${hours}h`);
  for (const hours of [24, 48, 24 * 30]) assert.equal(at(hours), "refetch", `${hours}h`);
  // Max stale below fresh collapses the middle tier rather than inverting it.
  assert.equal(decide(2 * hour, 3 * hour, 1 * hour), "serve");
  assert.equal(decide(4 * hour, 3 * hour, 1 * hour), "refetch");
  // Both windows at zero: everything is refetched.
  assert.equal(decide(0, 0, 0), "refetch");
});

test("lifts the vqd token from either form of the page", () => {
  assert.equal(extractVqd(`<script>vqd="4-123456789012345678901234567890"</script>`), "4-123456789012345678901234567890");
  assert.equal(extractVqd(`<a href="/?q=cat&vqd=4-98765&ia=images">`), "4-98765");
  assert.equal(extractVqd("<html>nothing here</html>"), null);
});

test("maps DuckDuckGo and Openverse results, skipping incomplete ones", () => {
  const ddg = parseDuckDuckGo(
    {
      results: [
        { image: "https://a.example/cat.jpg", thumbnail: "https://t.example/1", url: "https://a.example/", title: "Cat", width: 800, height: 600 },
        { image: "https://b.example/no-thumb.jpg" },
        { image: "https://c.example/dog.jpg", thumbnail: "https://t.example/2" },
      ],
    },
    60,
  );
  assert.deepEqual(ddg, [
    { originUrl: "https://a.example/cat.jpg", thumbnailUrl: "https://t.example/1", sourcePageUrl: "https://a.example/", title: "Cat", width: 800, height: 600 },
    { originUrl: "https://c.example/dog.jpg", thumbnailUrl: "https://t.example/2", sourcePageUrl: "https://c.example/dog.jpg", title: null, width: 0, height: 0 },
  ]);
  assert.equal(parseDuckDuckGo({ results: ddg.map(() => ({ image: "x", thumbnail: "y" })) }, 1).length, 1);
  assert.deepEqual(parseDuckDuckGo({ challenge: {} }, 60), []);

  const ov = parseOpenverse(
    { results: [{ url: "https://o.example/a.jpg", foreign_landing_url: "https://flickr.example/a", title: "A", width: 10, height: 20 }, { title: "no url" }] },
    20,
  );
  assert.deepEqual(ov, [
    { originUrl: "https://o.example/a.jpg", thumbnailUrl: "https://o.example/a.jpg", sourcePageUrl: "https://flickr.example/a", title: "A", width: 10, height: 20 },
  ]);
});

test("recognises images by their first bytes, not their headers", () => {
  const pad = (...bytes) => Uint8Array.from([...bytes, ...new Array(16).fill(0)]);
  assert.equal(detectFormat(pad(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(detectFormat(pad(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "image/png");
  assert.equal(detectFormat(pad(...Buffer.from("GIF89a"))), "image/gif");
  assert.equal(detectFormat(pad(...Buffer.from("GIF87a"))), "image/gif");
  assert.equal(detectFormat(pad(...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"))), "image/webp");
  assert.equal(detectFormat(pad(...Buffer.from("<!DOCTYPE html>"))), null);
  assert.equal(detectFormat(Uint8Array.from([0xff, 0xd8, 0xff])), null); // too short to judge
});

test("hashes a URL the way the old app did", async () => {
  const url = "https://example.com/pictures/cat.jpg";
  const expected = createHash("sha256").update(url, "utf8").digest().subarray(0, 20).toString("hex");
  assert.equal(await hashUrl(url), expected);
  assert.equal(isWellFormedHash(expected), true);
  assert.equal(isWellFormedHash(expected.toUpperCase()), false);
  assert.equal(isWellFormedHash("../../etc/passwd"), false);
});
