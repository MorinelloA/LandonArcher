/** Presented to DuckDuckGo and to image hosts, some of which refuse anything else. */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    // The app's service worker keeps its own copy of each answer for offline use;
    // nothing between here and the iPad should.
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function notFound() {
  return new Response("Not found.", { status: 404 });
}

export function badRequest(message = "Bad request.") {
  return new Response(message, { status: 400 });
}
