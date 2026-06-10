interface Env {
  ASSETS: Fetcher;
}

const HUGGING_FACE_ORIGIN = "https://huggingface.co";
const HUGGING_FACE_MIRROR_ORIGIN = "https://hf-mirror.com";

const proxyHeaders = [
  "accept",
  "accept-encoding",
  "accept-language",
  "range",
  "if-none-match",
  "if-modified-since"
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range, If-None-Match, If-Modified-Since",
  "Access-Control-Expose-Headers":
    "Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, X-Repo-Commit"
} as const;

const CROSS_ORIGIN_ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp"
} as const;

async function proxyHuggingFace(request: Request, url: URL) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);

  if (request.method === "GET") {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const responseHeaders = new Headers(cachedResponse.headers);
      responseHeaders.set("X-PrivacyFilter-Cache", "HIT");
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        responseHeaders.set(key, value);
      }

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: responseHeaders
      });
    }
  }

  const upstreamUrl = new URL(url.pathname.replace(/^\/hf\//, "/"), HUGGING_FACE_MIRROR_ORIGIN);
  upstreamUrl.search = url.search;

  const headers = new Headers();
  for (const header of proxyHeaders) {
    const value = request.headers.get(header);
    if (value) headers.set(header, value);
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    redirect: "follow"
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete("set-cookie");
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    responseHeaders.set(key, value);
  }
  responseHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
  responseHeaders.set("X-PrivacyFilter-Cache", "MISS");

  const response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });

  if (request.method === "GET" && upstreamResponse.ok) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch (error) {
      console.warn("Failed to cache Hugging Face asset", upstreamUrl.toString(), error);
    }
  }

  return response;
}

function withCrossOriginIsolation(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CROSS_ORIGIN_ISOLATION_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/hf/")) {
      return proxyHuggingFace(request, url);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return withCrossOriginIsolation(assetResponse);
  }
};
