import { afterEach } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const fixtureRoots = new Set<string>();

/** Writes the given files into a fresh temporary project and removes it after the test. */
export async function createFixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "conformance-cloudflare-"));
  fixtureRoots.add(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
  return root;
}

/** Serializes a Wrangler JSON config fixture. */
export function wrangler(config: Record<string, unknown>): string {
  return JSON.stringify(config, null, 2);
}

afterEach(async () => {
  const roots = [...fixtureRoots];
  fixtureRoots.clear();
  for (const root of roots) {
    if (path.dirname(path.resolve(root)) !== path.resolve(tmpdir())) throw new Error("Unexpected fixture path");
    await rm(root, { recursive: true, force: true });
  }
});
