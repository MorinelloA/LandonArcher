// landonarcher.com. Cloudflare serves the four sites' files from ./dist without
// running this script; wrangler.jsonc runs it first only for the paths handled here.
import { handlePictures, tidyPictures } from "./pictures/index.js";

const APP_FOLDERS = new Set(["/games", "/marblerun", "/search"]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Pictures' search API and picture URLs, the one part of the site that isn't plain files.
    if (pathname.startsWith("/search/api/") || pathname.startsWith("/search/img/")) {
      return handlePictures(request, env, ctx, pathname.slice("/search".length));
    }

    // Every path inside the apps is relative, so they only work with the slash.
    // A permanent redirect, which Cloudflare's own file server doesn't send.
    if (APP_FOLDERS.has(pathname)) {
      url.pathname = `${pathname}/`;
      return Response.redirect(url.toString(), 301);
    }

    // Cloudflare's file server redirects /x/index.html to /x/. Marble Run's and
    // Pictures' service workers store index.html for offline use, and a redirected
    // response can't answer a page load from the cache, so serve the page directly.
    if (pathname.endsWith("/index.html")) {
      url.pathname = pathname.slice(0, -"index.html".length);
      return env.ASSETS.fetch(new Request(url, request));
    }

    return env.ASSETS.fetch(request);
  },

  // Daily, from the cron trigger in wrangler.jsonc.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(tidyPictures(env));
  },
};
