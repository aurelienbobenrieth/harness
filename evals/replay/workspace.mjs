import { spawn, execFile } from "node:child_process";
import { mkdir, readFile, writeFile, readdir, symlink, lstat, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { isSource } from "./source-paths.mjs";
import { skillFiles } from "../lib/io.mjs";

export async function command(file, args, cwd, timeout = 120000) {
  return await new Promise((resolve) => {
    const child = spawn(file, args, {
      cwd,
      windowsHide: true,
      detached: process.platform !== "win32",
      env: { ...process.env, KEEPCART_TEST_WORKERS: "2", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "",
      killed = false,
      termination = Promise.resolve();
    const capture = (chunk) => {
      output = (output + chunk).slice(-8 * 1024 * 1024);
    };

    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    const timer = setTimeout(() => {
      killed = true;

      if (process.platform === "win32")
        termination = new Promise((done) =>
          execFile("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => done()),
        );
      else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") capture(error.message);
        }
      }
    }, timeout);

    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ status: null, killed, output: output + error.message });
    });

    child.once("close", async (status) => {
      clearTimeout(timer);
      await termination;
      resolve({ status, killed, output });
    });
  });
}

export async function git(cwd, ...args) {
  const result = await command("git", args, cwd);

  if (result.status !== 0) throw new Error(result.output);

  return result.output.trim();
}

const lines = (value) => value.split(/\r?\n/).filter(Boolean);

export async function contents(cwd, base = "HEAD") {
  const names = [
    ...lines(await git(cwd, "diff", "--name-only", base)),
    ...lines(await git(cwd, "ls-files", "--others", "--exclude-standard")),
  ];
  const sources = {};

  for (const file of new Set(names.filter(isSource))) {
    try {
      sources[file] = await readFile(path.join(cwd, file), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return sources;
}

async function link(source, target) {
  await mkdir(path.dirname(target), { recursive: true });
  await symlink(source, target, process.platform === "win32" ? "junction" : "dir");
}

/** Link installed third-party dependencies, but rebind every workspace package to this trial. */
async function dependencies(cwd, donor) {
  const packages = new Map();
  const manifests = lines(await git(cwd, "ls-files", "**/package.json"));

  for (const file of manifests) {
    const pkg = JSON.parse(await readFile(path.join(cwd, file), "utf8"));

    if (pkg.name) packages.set(pkg.name, path.dirname(path.join(cwd, file)));
  }

  for (const relative of ["", ...new Set(manifests.map((file) => path.dirname(file)))]) {
    const source = path.join(donor, relative, "node_modules"),
      target = path.join(cwd, relative, "node_modules");
    let entries;

    try {
      entries = await readdir(source, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") continue;

      throw error;
    }

    await mkdir(target, { recursive: true });

    for (const entry of entries) {
      if ([".vite", ".cache", ".bin"].includes(entry.name)) continue;
      if (entry.name.startsWith("@")) {
        for (const member of await readdir(path.join(source, entry.name))) {
          const name = `${entry.name}/${member}`;

          await link(packages.get(name) ?? path.join(source, name), path.join(target, name));
        }
      } else await link(path.join(source, entry.name), path.join(target, entry.name));
    }

    // Local command shims resolve ../<package> through this trial's dependency links.
    const bin = path.join(source, ".bin");

    try {
      await mkdir(path.join(target, ".bin"));
      for (const name of await readdir(bin))
        await writeFile(path.join(target, ".bin", name), await readFile(path.join(bin, name)));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

async function exposure(cwd, condition, ref) {
  // Erase restored/committed harness skills in disposable trial only. Never touch donor.
  for (const name of [".agents/skills", ".claude/skills"])
    await rm(path.join(cwd, name), { force: true, recursive: true });
  const sources =
    condition === "none"
      ? []
      : (await skillFiles(ref)).filter(
          (entry) => ["full", "delta"].includes(condition) || entry.file.startsWith(`skills/${condition}/`),
        );

  for (const { file, text } of sources) {
    const target = path.join(cwd, ".agents", file);

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text);
  }

  const cores = sources
    .filter((s) => s.file.endsWith("/core.md"))
    .map((s) => s.text)
    .join("\n");
  const inventory = sources
    .filter((s) => s.file.endsWith("/SKILL.md"))
    .map((s) => `- ${s.file.replace("skills/", ".agents/skills/")}`)
    .join("\n");

  await writeFile(
    path.join(cwd, "AGENTS.md"),
    `# Replay instructions\nFollow docs/conventions.md and existing local API conventions.\nRun scoped tests with node node_modules/vite-plus/bin/vp test <paths> --run.\nRun scoped lint with node node_modules/vite-plus/bin/vp lint <paths>.\nNo push, deploy, external writes, paid agents, installs, or history inspection. Work only inside this detached trial.\n${condition === "delta" ? `Changed-source verification tool (authorized outside this trial): node "${path.resolve(import.meta.dirname, "../../scripts/verify-changed.mjs")}" --cwd . --base HEAD. Run it before handoff; it checks type-aware lint on producers/consumers and mutations against existing consumer suites. Use --codec <file> for the archive codec.\n` : ""}${cores}\n${inventory ? "Load matching available skills before acting:\n" + inventory : ""}\n`,
  );

  await writeFile(path.join(cwd, "CLAUDE.md"), "@AGENTS.md\n");

  return {
    files: sources.map((s) => s.file),
    missingReferences: condition === "build" ? ["../testing/SKILL.md (intentionally absent ablation)"] : [],
  };
}

/** Cleanup unlinks junctions first, so recursive deletion cannot enter donor dependencies. */
export async function removeOwnedTree(target, root) {
  const resolved = path.resolve(target),
    relative = path.relative(path.resolve(root), resolved);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(`Unsafe cleanup target: ${resolved}`);
  const stat = await lstat(resolved).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });

  if (!stat) return;

  if (stat.isSymbolicLink()) {
    await unlink(resolved);

    return;
  }

  if (stat.isDirectory()) {
    const stripLinks = async (dir) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const name = path.join(dir, entry.name);

        if (entry.isSymbolicLink()) await unlink(name);
        else if (entry.isDirectory()) await stripLinks(name);
      }
    };

    await stripLinks(resolved);
    await rm(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } else await unlink(resolved);
}

export async function workspace({
  repository,
  donor,
  task,
  condition,
  ref,
  root = path.join(tmpdir(), "keepcart-replay"),
}) {
  await mkdir(root, { recursive: true });
  const cwd = path.join(root, `${task.id}-${randomUUID()}`);
  const base = await git(repository, "rev-parse", `${task.commit}^`);

  try {
    const created = await command(
      "git",
      ["-c", "core.hooksPath=", "worktree", "add", "--detach", cwd, base],
      repository,
      480000,
    );

    if (created.status !== 0) throw new Error(created.output);
    await dependencies(cwd, donor);
    const exposed = await exposure(cwd, condition, ref);
    const cleanup = async () => {
      // Remove only our checked absolute directory. Git metadata is pruned after the directory is gone.
      await removeOwnedTree(cwd, root);
      await git(repository, "worktree", "prune");
    };

    return { cwd, base, exposed, cleanup };
  } catch (error) {
    await removeOwnedTree(cwd, root);
    await git(repository, "worktree", "prune");

    throw error;
  }
}

export async function hiddenTests(repository, task) {
  const result = {};

  for (const name of task.tests) {
    const files = lines(await git(repository, "ls-tree", "-r", "--name-only", task.commit, "--", name));

    for (const file of files.filter((f) => /\.test\.[jt]sx?$|\/testing\.tsx$/.test(f))) {
      const value = await command("git", ["show", `${task.commit}:${file}`], repository);

      if (value.status !== 0) throw new Error(value.output);
      result[file] = value.output;
    }
  }

  if (!Object.keys(result).length) throw new Error(`Empty acceptance: ${task.id}`);

  return result;
}

export async function overlay(cwd, sources, action) {
  const saved = new Map();

  try {
    for (const [file, value] of Object.entries(sources)) {
      const target = path.join(cwd, file);

      saved.set(
        target,
        await readFile(target).catch((error) => {
          if (error.code !== "ENOENT") throw error;

          return null;
        }),
      );

      await mkdir(path.dirname(target), { recursive: true });
      if (value === null) await rm(target, { force: true });
      else await writeFile(target, value);
    }

    return await action();
  } finally {
    for (const [target, value] of saved) {
      if (value === null) await rm(target, { force: true });
      else await writeFile(target, value);
    }
  }
}

export async function check(cwd, mode, paths, timeout = 180000) {
  if (!paths.length) return { status: "skipped", reason: "empty selection", pass: false };
  const result = await command(
    process.execPath,
    [
      path.join(cwd, "node_modules/vite-plus/bin/vp"),
      mode === "types" ? "lint" : mode,
      ...paths,
      ...(mode === "types" ? ["--type-aware", "--type-check"] : []),
      ...(mode === "test" ? ["--run", "--reporter=dot"] : []),
    ],
    cwd,
    timeout,
  );
  const selected = mode !== "test" || /Tests\s+\d+ passed|Test Files\s+\d+ passed/.test(result.output);

  return { ...result, pass: result.status === 0 && selected, selected };
}
