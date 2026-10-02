// Copies Leaflet's browser files into public/vendor, so the map is served from the portal itself (no CDN).
import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(root, "node_modules/leaflet/dist");
const to = resolve(root, "public/vendor/leaflet");
mkdirSync(to, { recursive: true });
for (const file of ["leaflet.js", "leaflet.css"]) cpSync(resolve(from, file), resolve(to, file));
cpSync(resolve(from, "images"), resolve(to, "images"), { recursive: true });
console.log("Leaflet copied to public/vendor/leaflet");
