// Copies the four sites into ./dist, the folder Cloudflare serves. Each project
// stays in its own folder under C:\Repos; only the files a browser loads come across.
import { execFileSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repos = fileURLToPath(new URL("../../", import.meta.url));
const dist = fileURLToPath(new URL("./dist/", import.meta.url));

const sites = [
  { from: "LandonArcher", to: "", files: ["index.html", "script.js", "styles.css", "images"] },
  {
    from: "LandonGames",
    to: "games/",
    files: ["index.html", "sw.js", "manifest.webmanifest", "css", "js", "fonts", "vendor", "icons", "photos"],
  },
  {
    from: "MarbleRun",
    to: "marblerun/",
    files: ["index.html", "sw.js", "manifest.webmanifest", "css", "js", "vendor", "fonts", "icons"],
  },
  {
    from: "ImageSearch/src/PictureFinder.Web/wwwroot",
    to: "search/",
    files: ["index.html", "admin.html", "manifest.webmanifest", "sw.js", "css", "js", "icons"],
  },
];

// Marble Run's and the Game Room's service workers keep every file under a
// version made from their contents. Publishing changed files without
// restamping would leave iPads on the old copies, so stop here instead.
for (const app of ["MarbleRun", "LandonGames"]) {
  execFileSync(process.execPath, ["tools/stamp-sw.mjs", "--check"], { cwd: `${repos}${app}`, stdio: "inherit" });
}

// The Game Room publishes whatever is in its folder, committed or not.
try {
  const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: `${repos}LandonGames`, encoding: "utf8" }).trim();
  if (dirty) console.warn("Note: LandonGames has uncommitted changes, and they're being published too.");
} catch (_) {}

await rm(dist, { recursive: true, force: true });

for (const site of sites) {
  for (const file of site.files) {
    const target = `${dist}${site.to}${file}`;
    await mkdir(dirname(target), { recursive: true });
    await cp(`${repos}${site.from}/${file}`, target, {
      recursive: true,
      // dotnet publish leaves .br and .gz copies beside Pictures' files; Cloudflare compresses by itself.
      filter: (path) => !/\.(br|gz)$/.test(path),
    });
  }
}

// The headers Pictures has always sent with its pages, and a request that
// search engines leave the Game Room's family photos out of their results.
await writeFile(
  `${dist}_headers`,
  "/search/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n" +
    "/games/photos/*\n  X-Robots-Tag: noindex\n",
);

console.log(`Built ${dist}`);
