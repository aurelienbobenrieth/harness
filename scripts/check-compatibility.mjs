/* eslint-disable no-await-in-loop -- Validate manifests in deterministic package order. */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { validateCompatibility } from "./compatibility-policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
const policy = JSON.parse(await readFile(path.join(root, "policy/compatibility.json"), "utf8"));
const rootManifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const packages = [];
for (const directory of (await readdir(path.join(root, "packages"))).toSorted())
  packages.push({
    directory,
    manifest: JSON.parse(await readFile(path.join(root, "packages", directory, "package.json"), "utf8")),
  });
validateCompatibility({ policy, rootManifest, packages });
console.log(`Validated bounded Node/peer contracts for ${packages.length} packages and pinned compatibility profiles.`);
