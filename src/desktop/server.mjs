import { createServer } from "node:http";
import { access, readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_PORT = 3789;
const HOST = "127.0.0.1";
const HUGGING_FACE_ORIGIN = "https://huggingface.co";
const DESKTOP_ASSETS_DIRNAME = "desktop-assets";

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
};

const CROSS_ORIGIN_ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp"
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8"
};

function parseArgs(argv) {
  const options = {
    port: DEFAULT_PORT,
    openBrowser: true
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if ((arg === "--port" || arg === "-p") && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
        options.port = parsed;
      }
      i += 1;
      continue;
    }

    if (arg === "--no-open") {
      options.openBrowser = false;
    }
  }

  return options;
}

function resolveDistDir() {
  const cwdDist = resolve(process.cwd(), "dist");
  const exeDist = resolve(process.execPath, "..", "dist");
  return { cwdDist, exeDist };
}

function resolveDesktopAssetsDir() {
  const cwdAssets = resolve(process.cwd(), DESKTOP_ASSETS_DIRNAME);
  const exeAssets = resolve(process.execPath, "..", DESKTOP_ASSETS_DIRNAME);
  return { cwdAssets, exeAssets };
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function pickDistDir() {
  const { cwdDist, exeDist } = resolveDistDir();
  if (await pathExists(cwdDist)) return cwdDist;
  if (await pathExists(exeDist)) return exeDist;

  throw new Error(
    `Cannot find dist directory. Expected one of:\n- ${cwdDist}\n- ${exeDist}\nRun \"pnpm build\" first.`
  );
}

async function pickDesktopAssetsDir() {
  const { cwdAssets, exeAssets } = resolveDesktopAssetsDir();
  if (await pathExists(cwdAssets)) return cwdAssets;
  if (await pathExists(exeAssets)) return exeAssets;
  return null;
}

async function inspectDesktopAssets(assetsDir) {
  if (!assetsDir) {
    return {
      hasLocalModel: false,
      hasOcrAssets: false
    };
  }

  const hasLocalModel = await pathExists(join(assetsDir, "models", "openai", "privacy-filter", "config.json"));
  const hasOcrAssets =
    (await pathExists(join(assetsDir, "ocr", "worker.min.js"))) &&
    (await pathExists(join(assetsDir, "ocr", "core", "tesseract-core.wasm.js"))) &&
    (await pathExists(join(assetsDir, "ocr", "lang-data", "eng.traineddata.gz")));

  return {
    hasLocalModel,
    hasOcrAssets
  };
}

function withIsolationHeaders(headers = {}) {
  return {
    ...headers,
    ...CROSS_ORIGIN_ISOLATION_HEADERS
  };
}

function desktopRuntimeConfig(origin, assetState) {
  return {
    mode: "desktop",
    allowLocalModels: assetState.hasLocalModel,
    allowRemoteModels: !assetState.hasLocalModel,
    localModelPath: assetState.hasLocalModel ? `${origin}/models/` : null,
    remoteHost: `${origin}/hf/`,
    offlineOnly: assetState.hasLocalModel,
    ocr: assetState.hasOcrAssets
      ? {
          workerPath: `${origin}/ocr/worker.min.js`,
          corePath: `${origin}/ocr/core`,
          langPath: `${origin}/ocr/lang-data`,
          gzip: true
        }
      : null
  };
}

function injectDesktopConfig(html, origin, assetState) {
  const payload = JSON.stringify(desktopRuntimeConfig(origin, assetState));
  const injection = `<script>window.__PRIVACYFILTER_DESKTOP__=${payload};</script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${injection}\n  </head>`);
  }
  return `${injection}\n${html}`;
}

async function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true });
    return;
  }
  spawn("xdg-open", [url], { stdio: "ignore", detached: true });
}

function safeAssetPath(distDir, pathname) {
  const cleanPath = decodeURIComponent(pathname.split("?")[0]);
  const normalizedPath = normalize(cleanPath).replace(/^([.]{2}[\\/])+/, "");
  let targetPath = join(distDir, normalizedPath);

  if (cleanPath.endsWith("/")) {
    targetPath = join(distDir, normalizedPath, "index.html");
  }

  return targetPath;
}

async function resolveAssetFile(distDir, pathname) {
  const directPath = safeAssetPath(distDir, pathname);

  try {
    const directStat = await stat(directPath);
    if (directStat.isDirectory()) {
      const indexPath = join(directPath, "index.html");
      const indexStat = await stat(indexPath);
      if (indexStat.isFile()) return indexPath;
    } else if (directStat.isFile()) {
      return directPath;
    }
  } catch {
    // Fallback to route-style lookup below.
  }

  const fallbackIndex = join(distDir, pathname.replace(/^\//, ""), "index.html");
  if (await pathExists(fallbackIndex)) {
    return fallbackIndex;
  }

  const rootIndex = join(distDir, "index.html");
  if (await pathExists(rootIndex)) {
    return rootIndex;
  }

  return null;
}

async function proxyHuggingFace(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, withIsolationHeaders(CORS_HEADERS));
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, withIsolationHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Method Not Allowed");
    return;
  }

  const upstreamPath = url.pathname.replace(/^\/hf\//, "/");
  const upstreamUrl = new URL(upstreamPath + url.search, HUGGING_FACE_ORIGIN);

  const headers = {};
  for (const header of proxyHeaders) {
    const value = req.headers[header];
    if (value) headers[header] = value;
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      redirect: "follow"
    });
  } catch (error) {
    console.error("Hugging Face upstream request failed", error);
    res.writeHead(502, withIsolationHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Bad Gateway");
    return;
  }

  const responseHeaders = {
    ...Object.fromEntries(upstream.headers.entries()),
    ...CORS_HEADERS,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-PrivacyFilter-Cache": "BYPASS"
  };
  delete responseHeaders["set-cookie"];

  res.writeHead(upstream.status, withIsolationHeaders(responseHeaders));

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      res.write(chunk.value);
    }
    res.end();
  } catch (error) {
    console.error("Proxy stream failed", error);
    res.destroy(error);
  }
}

async function serveStatic(distDir, req, res, url, origin, assetState) {
  const filePath = await resolveAssetFile(distDir, url.pathname);

  if (!filePath) {
    res.writeHead(404, withIsolationHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Not Found");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] ?? "application/octet-stream";

  if (ext === ".html") {
    const html = await readFile(filePath, "utf8");
    const output = injectDesktopConfig(html, origin, assetState);
    res.writeHead(200, withIsolationHeaders({ "Content-Type": contentType }));
    res.end(output);
    return;
  }

  res.writeHead(200, withIsolationHeaders({ "Content-Type": contentType }));
  createReadStream(filePath).pipe(res);
}

function resolveResourcePath(rootDir, pathname) {
  const cleanPath = decodeURIComponent(pathname.split("?")[0]).replace(/^\//, "");
  const resourcePath = resolve(rootDir, cleanPath);

  if (!resourcePath.startsWith(resolve(rootDir))) {
    return null;
  }

  return resourcePath;
}

async function serveDesktopResource(assetsDir, req, res, url) {
  const filePath = resolveResourcePath(assetsDir, url.pathname);

  if (!filePath || !(await pathExists(filePath))) {
    res.writeHead(404, withIsolationHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Not Found");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] ?? "application/octet-stream";
  res.writeHead(200, withIsolationHeaders({ "Content-Type": contentType }));

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

async function start() {
  const options = parseArgs(process.argv);
  const distDir = await pickDistDir();
  const assetsDir = await pickDesktopAssetsDir();
  const assetState = await inspectDesktopAssets(assetsDir);

  const server = createServer(async (req, res) => {
    try {
      if (!req.url) {
        res.writeHead(400, withIsolationHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
        res.end("Bad Request");
        return;
      }

      const url = new URL(req.url, `http://${HOST}:${options.port}`);
      const origin = `${url.protocol}//${url.host}`;

      if (url.pathname.startsWith("/hf/")) {
        await proxyHuggingFace(req, res, url);
        return;
      }

      if (assetsDir && (url.pathname.startsWith("/models/") || url.pathname.startsWith("/ocr/"))) {
        await serveDesktopResource(assetsDir, req, res, url);
        return;
      }

      await serveStatic(distDir, req, res, url, origin, assetState);
    } catch (error) {
      console.error(error);
      res.writeHead(500, withIsolationHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
      res.end("Internal Server Error");
    }
  });

  server.on("error", (error) => {
    if (error && error.code === "EADDRINUSE") {
      console.error(`Port ${options.port} is already in use. Try --port <another-port>.`);
      process.exit(1);
    }
    console.error("Server failed to start", error);
    process.exit(1);
  });

  server.listen(options.port, HOST, async () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : options.port;
    const url = `http://${HOST}:${port}`;

    console.log(`Privacy Filter desktop server running at ${url}`);
    console.log(`Serving static files from ${distDir}`);
    if (assetsDir) {
      console.log(`Serving desktop assets from ${assetsDir}`);
      console.log(`Offline model assets: ${assetState.hasLocalModel ? "enabled" : "missing"}`);
      console.log(`Offline OCR assets: ${assetState.hasOcrAssets ? "enabled" : "missing"}`);
    }

    if (options.openBrowser) {
      await openBrowser(url);
    }
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
