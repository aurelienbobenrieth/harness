import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportKeys, findWorkspace, readManifests, workspaceGlobs } from "./workspace.ts";

describe("export keys", () => {
  it.each([
    { label: "no exports field", field: undefined, expected: [{ key: ".", open: true }] },
    { label: "a string export", field: "./src/index.ts", expected: [{ key: ".", open: true }] },
    {
      label: "a conditions object",
      field: { import: "./a.js", types: "./a.d.ts" },
      expected: [{ key: ".", open: true }],
    },
    {
      label: "subpath keys, null kept closed",
      field: { ".": "./a.js", "./x/*": "./x/*.js", "./x/private/*": null },
      expected: [
        { key: ".", open: true },
        { key: "./x/*", open: true },
        { key: "./x/private/*", open: false },
      ],
    },
  ])("reads $label", ({ field, expected }) => {
    expect(exportKeys(field)).toStrictEqual(expected);
  });
});

describe("pnpm workspace globs", () => {
  it("reads the block list up to the next top-level key, quotes and comments stripped", () => {
    const yaml =
      "packages:\n  - apps/*\n  # grouped\n  - \"packages/contracts/*\" # contracts\n  - '!**/fixtures/**'\n\ncatalog:\n  - x/*\n";
    expect(workspaceGlobs(yaml)).toStrictEqual(["apps/*", "packages/contracts/*", "!**/fixtures/**"]);
  });

  it("reads a flow list", () => {
    expect(workspaceGlobs('packages: ["apps/*", packages/*]\n')).toStrictEqual(["apps/*", "packages/*"]);
  });

  it("reads nothing without a packages key", () => {
    expect(workspaceGlobs("catalog:\n  effect: 4.0.0\n")).toStrictEqual([]);
  });
});

const roots: string[] = [];

async function workspaceWith(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "workspace-boundaries-"));
  roots.push(root);
  await Promise.all(
    Object.entries(files).map(async ([relative, content]) => {
      await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
      await writeFile(path.join(root, relative), content);
    }),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const manifest = (name: string, exports?: unknown) => JSON.stringify({ name, exports });

describe("workspace discovery", () => {
  it("finds the nearest pnpm workspace and reads its members, nested and negated globs included", async () => {
    const root = await workspaceWith({
      "pnpm-workspace.yaml": "packages:\n  - apps/*\n  - packages/**\n  - '!packages/fixtures/*'\n",
      "apps/web/package.json": manifest("@f/web"),
      "apps/notes/readme.md": "no manifest, not a member",
      "packages/kernel/package.json": manifest("@f/kernel", { ".": "./src/index.ts" }),
      "packages/features/mage/package.json": manifest("@f/mage"),
      "packages/fixtures/broken/package.json": manifest("@f/broken"),
      "packages/kernel/node_modules/dep/package.json": manifest("dep"),
    });
    const workspace = findWorkspace(path.join(root, "packages/kernel/src/index.ts"));

    expect(workspace?.root).toBe(root);
    expect(readManifests(workspace ?? { root, globs: [] }).map((member) => member.name)).toStrictEqual([
      "@f/web",
      "@f/mage",
      "@f/kernel",
    ]);
  });

  it("falls back to package.json workspaces, array or object form", async () => {
    const root = await workspaceWith({
      "package.json": JSON.stringify({ name: "root", workspaces: { packages: ["libs/*"] } }),
      "libs/a/package.json": manifest("@f/a"),
    });
    const workspace = findWorkspace(path.join(root, "libs/a/src/index.ts"));

    expect(workspace).toStrictEqual({ root, globs: ["libs/*"] });
    expect(readManifests(workspace ?? { root, globs: [] }).map((member) => member.dir)).toStrictEqual(["libs/a"]);
  });

  it("skips a member's own package.json that declares no workspaces", async () => {
    const root = await workspaceWith({
      "pnpm-workspace.yaml": "packages:\n  - libs/*\n",
      "libs/a/package.json": manifest("@f/a"),
    });

    expect(findWorkspace(path.join(root, "libs/a/src/index.ts"))?.root).toBe(root);
  });
});
