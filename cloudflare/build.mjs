// Copies the five sites into ./dist, the folder Cloudflare serves. Each project
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
    files: ["index.html", "sw.js", "manifest.webmanifest", "css", "js", "fonts", "vendor", "icons", "photos", "voice"],
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
  {
    // Bubble Wall is built by Vite: its dist folder is what a browser loads.
    from: "bubble-wall/dist",
    to: "bubble-wall/",
    files: ["index.html", "sw.js", "manifest.webmanifest", "assets", "icons"],
  },
];

// Bubble Wall publishes its build, not its source, so build it now. A stale dist
// would otherwise go out, and its service worker would keep iPads on the old files.
execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], {
  cwd: `${repos}bubble-wall`,
  stdio: "inherit",
});

// Marble Run's and the Game Room's service workers keep every file under a
// version made from their contents. Publishing changed files without
// restamping would leave iPads on the old copies, so stop here instead.
for (const app of ["MarbleRun", "LandonGames"]) {
  execFileSync(process.execPath, ["tools/stamp-sw.mjs", "--check"], { cwd: `${repos}${app}`, stdio: "inherit" });
}
// Every line the Game Room says needs its recorded clip (tools/voice.mjs build).
execFileSync(process.execPath, ["tools/voice.mjs", "check"], { cwd: `${repos}LandonGames`, stdio: "inherit" });

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
// Bubble Wall is kept out of search results and out of frames. Its files are
// always rechecked, so an update reaches the iPad on the next launch, and
// "no-transform" tells Cloudflare not to add anything to its pages: without it the
// zone's Web Analytics beacon script is injected into the app, which promises to
// send nothing anywhere. (Its Content-Security-Policy, in the page itself, blocks
// that script too.)
await writeFile(
  `${dist}_headers`,
  "/search/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n" +
    "/games/photos/*\n  X-Robots-Tag: noindex\n" +
    "/bubble-wall/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n" +
    "  X-Frame-Options: DENY\n  X-Robots-Tag: noindex\n" +
    "  Cache-Control: public, max-age=0, must-revalidate, no-transform\n",
);

console.log(`Built ${dist}`);
