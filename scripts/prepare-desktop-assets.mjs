import { mkdir, access, copyFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, "..");
const desktopAssetsRoot = resolve(workspaceRoot, "desktop-assets");
const modelRoot = join(desktopAssetsRoot, "models", "openai", "privacy-filter");
const ocrRoot = join(desktopAssetsRoot, "ocr");
const ocrCoreRoot = join(ocrRoot, "core");
const ocrLangRoot = join(ocrRoot, "lang-data");

const httpProxy = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY;

if (httpProxy) {
  setGlobalDispatcher(new ProxyAgent(httpProxy));
}

const modelFiles = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "viterbi_calibration.json",
  "onnx/model_q4.onnx",
  "onnx/model_q4.onnx_data"
];

const ocrCoreFiles = [
  "tesseract-core.wasm.js",
  "tesseract-core.wasm",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-lstm.wasm",
  "tesseract-core-simd.wasm.js",
  "tesseract-core-simd.wasm",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-relaxedsimd.wasm.js",
  "tesseract-core-relaxedsimd.wasm",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm"
];

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function wait(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function downloadFile(url, destination, options = {}) {
  const { retries = 3, timeoutMs = 45000 } = options;
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      await ensureDir(dirname(destination));
      await writeFile(destination, Buffer.from(arrayBuffer));
      return;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) {
        console.warn(`Download attempt ${attempt} failed for ${url}. Retrying...`);
        await wait(1000 * attempt);
      }
    }
  }

  const message = lastError?.name === "AbortError"
    ? `Timed out downloading ${url}. Check network access and try again.`
    : `Failed to download ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`;
  throw new Error(message);
}

async function ensureModelAssets() {
  for (const file of modelFiles) {
    const destination = join(modelRoot, file);
    if (await exists(destination)) continue;
    const url = `https://huggingface.co/openai/privacy-filter/resolve/main/${file}`;
    console.log(`Downloading model asset ${file}`);
    await downloadFile(url, destination);
  }
}

async function ensureOcrAssets() {
  const tesseractDist = resolve(workspaceRoot, "node_modules", "tesseract.js", "dist");
  const tesseractCore = resolve(workspaceRoot, "node_modules", ".pnpm", "tesseract.js-core@7.0.0", "node_modules", "tesseract.js-core");

  await ensureDir(ocrRoot);
  await ensureDir(ocrCoreRoot);
  await ensureDir(ocrLangRoot);

  const workerSource = join(tesseractDist, "worker.min.js");
  const workerDestination = join(ocrRoot, "worker.min.js");
  if (!(await exists(workerDestination))) {
    await copyFile(workerSource, workerDestination);
  }

  for (const file of ocrCoreFiles) {
    const source = join(tesseractCore, file);
    const destination = join(ocrCoreRoot, file);
    if (await exists(destination)) continue;
    await copyFile(source, destination);
  }

  const trainedDataDestination = join(ocrLangRoot, "eng.traineddata.gz");
  if (!(await exists(trainedDataDestination))) {
    console.log("Downloading OCR language asset eng.traineddata.gz");
    await downloadFile(
      "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
      trainedDataDestination
    );
  }
}

async function writeManifest() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    modelFiles,
    ocr: {
      worker: "worker.min.js",
      lang: ["eng.traineddata.gz"],
      coreFiles: ocrCoreFiles
    }
  };

  await writeFile(join(desktopAssetsRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  if (httpProxy) {
    console.log(`Using download proxy: ${httpProxy}`);
  }

  await ensureDir(desktopAssetsRoot);
  await ensureModelAssets();
  await ensureOcrAssets();
  await writeManifest();
  console.log(`Desktop assets prepared in ${desktopAssetsRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
