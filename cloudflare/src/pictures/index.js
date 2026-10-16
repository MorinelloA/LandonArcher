// Pictures' back end on Cloudflare: the search API and the picture URLs under
// /search/. It keeps the URLs and JSON of the ASP.NET app it replaces
// (C:\Repos\ImageSearch), so the app in /search/ runs unchanged.
import { handleAdmin } from "./admin.js";
import { json, notFound } from "./http.js";
import { serveFull, serveThumb } from "./images.js";
import { ensureSchema } from "./schema.js";
import { peek, search } from "./search.js";
import { evict } from "./store.js";

export async function handlePictures(request, env, ctx, path) {
  try {
    await ensureSchema(env.DB);
    const url = new URL(request.url);

    // The app calls this on every keystroke with live=false (cache only, free) and
    // once typing settles with live=true (may ask a provider).
    if (path === "/api/search" && request.method === "GET") {
      const query = url.searchParams.get("q") ?? "";
      const live = (url.searchParams.get("live") ?? "").toLowerCase() === "true";
      return json(live ? await search(env, ctx, query) : await peek(env, query));
    }

    const image = /^\/img\/([tf])\/([^/]+)$/.exec(path);
    if (image && request.method === "GET") {
      return image[1] === "t" ? serveThumb(env, ctx, request, image[2]) : serveFull(env, ctx, request, image[2]);
    }

    if (path.startsWith("/api/admin/")) return handleAdmin(request, env, url, path.slice("/api/admin".length));

    return notFound();
  } catch (error) {
    console.error(`Pictures request failed: ${path}`, error);
    return new Response("Something went wrong.", { status: 500 });
  }
}

export async function tidyPictures(env) {
  await ensureSchema(env.DB);
  console.log("Pictures tidy-up", JSON.stringify(await evict(env.DB)));
}
