import { readdir } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import {
  findAlchemyInvocations,
  type AlchemyInvocation,
  type ScriptContext,
  type UnresolvedCommand,
} from "./commands.js";
import type { ConformanceFinding, ConformanceRunOptions } from "./finding.js";
import { isRecord, joinProject, readText, workflowsDir } from "./project-files.js";
import { loadWorkspace, readManifest, type PackageManifest } from "./workspace.js";

/** One `run:` step of a GitHub Actions job, with the Alchemy commands it runs. */
export type WorkflowStep = {
  /** `<job> › <step name>`, for messages. */
  readonly label: string;
  readonly job: string;
  readonly run: string;
  /** Workflow, job and step `env`, later levels winning, as GitHub merges them. */
  readonly env: Readonly<Record<string, string>>;
  readonly invocations: readonly AlchemyInvocation[];
  /** Commands that may run Alchemy through a package script this reading cannot resolve. */
  readonly unresolved: readonly UnresolvedCommand[];
};

export type Workflow = {
  /** Project-relative path. */
  readonly path: string;
  /** Triggered by `pull_request` or `pull_request_target` with `types` listing `closed`. */
  readonly closesPullRequests: boolean;
  readonly steps: readonly WorkflowStep[];
};

type YamlMap = Readonly<Record<string, unknown>>;

function field(value: unknown, ...keys: readonly string[]): unknown {
  let current = value;
  for (const key of keys) current = isRecord(current) ? current[key] : undefined;
  return current;
}

function envOf(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => ["string", "number", "boolean"].includes(typeof entry))
      .map(([name, entry]) => [name, String(entry)]),
  );
}

function closesPullRequests(on: unknown): boolean {
  return ["pull_request", "pull_request_target"].some((event) => {
    const types = field(on, event, "types");
    return types === "closed" || (Array.isArray(types) && types.includes("closed"));
  });
}

function workingDirectory(workflow: YamlMap, job: YamlMap, step: YamlMap): string | undefined {
  const declared = [
    step["working-directory"],
    field(job, "defaults", "run", "working-directory"),
    field(workflow, "defaults", "run", "working-directory"),
  ].find((entry) => typeof entry === "string");
  if (typeof declared !== "string") return "";
  if (declared.includes("${{") || path.isAbsolute(declared)) return undefined;
  return joinProject(declared);
}

/**
 * Substitutes `${{ env.NAME }}`, `$NAME` and `${NAME}` from the step environment, twice, so a job-level value
 * that itself reads the workflow `env` resolves. Unknown names and other expressions stay as written.
 */
function expandEnv(text: string, env: Readonly<Record<string, string>>): string {
  const once = (value: string): string =>
    value.replaceAll(
      /\$\{\{\s*env\.([A-Za-z_]\w*)\s*\}\}|\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*)/gu,
      (match, expression?: string, braced?: string, bare?: string) => env[expression ?? braced ?? bare ?? ""] ?? match,
    );
  return once(once(text));
}

/** The stage an invocation targets as written: `--stage`, else `ALCHEMY_STAGE`, expanded. Unset means `live_$USER`. */
export function invocationStage(invocation: AlchemyInvocation, step: WorkflowStep): string | undefined {
  const env = { ...step.env, ...invocation.env };
  const raw = invocation.stage ?? env["ALCHEMY_STAGE"];
  return raw === undefined ? undefined : expandEnv(raw, env);
}

/**
 * Reads every `.yml` / `.yaml` workflow in `workflowsDir`. A missing directory is unsupported evidence
 * (another CI system may deploy); an unparseable workflow is a failed evaluation.
 */
export async function loadWorkflows(
  options: ConformanceRunOptions,
  check: string,
  docs: string,
): Promise<{ readonly workflows: readonly Workflow[]; readonly findings: readonly ConformanceFinding[] }> {
  const directory = workflowsDir(options);
  let entries: string[];
  try {
    entries = (await readdir(path.join(options.root, directory))).filter((entry) => /\.ya?ml$/u.test(entry));
  } catch {
    entries = [];
  }
  if (entries.length === 0)
    return {
      workflows: [],
      findings: [
        {
          check,
          docs,
          severity: "warning",
          evaluation: "unsupported",
          message: `No GitHub Actions workflow in ${directory}/, so CI deploys were not reviewed. Other CI systems are not read; set workflowsDir if the workflows live elsewhere.`,
        },
      ],
    };
  const manifests = new Map<string, Promise<PackageManifest | "unreadable" | undefined>>();
  const context: ScriptContext = {
    members: (await loadWorkspace(options.root)).manifests,
    manifestAt(folder) {
      const known = manifests.get(folder) ?? readManifest(options.root, joinProject(folder, "package.json"));
      manifests.set(folder, known);
      return known;
    },
  };
  const workflows: Workflow[] = [];
  const findings: ConformanceFinding[] = [];
  for (const entry of entries.toSorted()) {
    const relative = `${directory}/${entry}`;
    let document: unknown;
    try {
      document = parseYaml((await readText(path.join(options.root, relative))) ?? "");
    } catch {
      document = undefined;
    }
    const jobs = field(document, "jobs");
    if (!isRecord(document) || !isRecord(jobs)) {
      findings.push({
        check,
        docs,
        path: relative,
        severity: "error",
        evaluation: "failed",
        message: `${relative} is unreadable, invalid YAML, or has no \`jobs\` map. Fix it so GitHub and this check can read it.`,
      });
      continue;
    }
    const steps: WorkflowStep[] = [];
    for (const [jobName, job] of Object.entries(jobs)) {
      if (!isRecord(job) || !Array.isArray(job["steps"])) continue;
      for (const [index, step] of job["steps"].entries()) {
        if (!isRecord(step) || typeof step["run"] !== "string") continue;
        const name = [step["name"], step["id"]].find((value) => typeof value === "string") ?? `step ${index + 1}`;
        const run = step["run"];
        const scan = await findAlchemyInvocations(run, workingDirectory(document, job, step), context);
        steps.push({
          label: `${jobName} › ${String(name)}`,
          job: jobName,
          run,
          env: { ...envOf(document["env"]), ...envOf(job["env"]), ...envOf(step["env"]) },
          invocations: scan.invocations,
          unresolved: scan.unresolved,
        });
      }
    }
    workflows.push({ path: relative, closesPullRequests: closesPullRequests(document["on"]), steps });
  }
  return { workflows, findings };
}

/** One unsupported-evidence warning per command of the step that may run Alchemy through an unresolved script. */
export function unresolvedFindings(
  workflow: Workflow,
  step: WorkflowStep,
  check: string,
  docs: string,
  consequence: string,
): ConformanceFinding[] {
  return step.unresolved.map((command) => ({
    check,
    docs,
    path: workflow.path,
    severity: "warning",
    evaluation: "unsupported",
    message: `${step.label}: \`${command.text}\` ${command.reason}, so ${consequence} was not reviewed.`,
  }));
}
