import { mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

const outputDirectory = "dist";
const publicFiles = [
  "index.html",
  "privacy.html",
  "que-esta-pasando.html",
  "styles.css",
  "script.js",
  "noise-meter.js",
  "og.png",
  "favicon.svg",
  "favicon.ico",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "assets/sardina.jpg",
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(join(outputDirectory, "server"), { recursive: true });
await mkdir(join(outputDirectory, "public"), { recursive: true });

const assets = {};

for (const file of publicFiles) {
  try {
    const contents = await readFile(file);
    const route = file === "index.html" ? "/" : `/${file}`;
    assets[route] = {
      body: contents.toString("base64"),
      contentType:
        extname(file) === ".html"
          ? "text/html; charset=utf-8"
          : extname(file) === ".css"
            ? "text/css; charset=utf-8"
            : extname(file) === ".js"
              ? "text/javascript; charset=utf-8"
              : extname(file) === ".jpg"
                ? "image/jpeg"
                : extname(file) === ".svg"
                  ? "image/svg+xml"
                  : extname(file) === ".ico"
                    ? "image/x-icon"
                    : "image/png",
    };
    await mkdir(dirname(join(outputDirectory, "public", file)), {
      recursive: true,
    });
    await copyFile(file, join(outputDirectory, "public", file));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const workerSource = `const assets = ${JSON.stringify(assets)};

function decodeBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const asset = assets[url.pathname];

    if (!asset) {
      return new Response("Página no encontrada", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return new Response(decodeBase64(asset.body), {
      headers: {
        "content-type": asset.contentType,
        "cache-control": url.pathname === "/" ? "no-cache" : "public, max-age=86400",
        "x-content-type-options": "nosniff",
      },
    });
  },
};
`;

await writeFile(join(outputDirectory, "server", "index.js"), workerSource);
