import { afterEach } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export async function createFixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "conformance-shopify-"));
  fixtureRoots.add(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
  return root;
}

const fixtureRoots = new Set<string>();
afterEach(async () => {
  const roots = [...fixtureRoots];
  fixtureRoots.clear();
  await Promise.all(
    roots.map(async (root) => {
      if (path.dirname(path.resolve(root)) !== path.resolve(tmpdir())) throw new Error("Unexpected fixture path");
      await rm(root, { recursive: true, force: true });
    }),
  );
});
