import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { listDirectory, readTextFile } from "../fs-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates";

type JsonTemplate = {
  readonly sections?: Record<string, { readonly type?: unknown }>;
  readonly order?: readonly unknown[];
};

function parseTemplate(content: string): JsonTemplate | undefined {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    return parsed as JsonTemplate;
  } catch {
    return undefined;
  }
}

export const templatesValid: ConformanceCheck = {
  id: "templates-valid",
  description: "JSON templates must parse and keep sections and order consistent.",
  docs,
  async run({ root }) {
    const findings: ConformanceFinding[] = [];
    const templatesRoot = path.join(root, "templates");
    const templateDirectories = [
      templatesRoot,
      path.join(templatesRoot, "customers"),
      path.join(templatesRoot, "metaobject"),
    ];

    for (const templateDirectory of templateDirectories) {
      for (const entry of await listDirectory(templateDirectory)) {
        if (!entry.endsWith(".json")) continue;
        const templatePath = path.join(templateDirectory, entry);
        const content = (await readTextFile(templatePath)) ?? "";
        const template = parseTemplate(content);

        if (template === undefined || typeof template.sections !== "object" || template.sections === null) {
          findings.push({
            check: "templates-valid",
            severity: "error",
            message: `${path.relative(root, templatePath)} must be a JSON object with a "sections" object.`,
            path: templatePath,
            docs,
          });
          continue;
        }

        for (const [sectionId, section] of Object.entries(template.sections)) {
          if (typeof section.type === "string" && section.type.length > 0) continue;
          findings.push({
            check: "templates-valid",
            severity: "error",
            message: `${path.relative(root, templatePath)} section "${sectionId}" is missing its "type".`,
            path: templatePath,
            docs,
          });
        }

        for (const orderedId of template.order ?? []) {
          if (typeof orderedId === "string" && orderedId in template.sections) continue;
          findings.push({
            check: "templates-valid",
            severity: "error",
            message: `${path.relative(root, templatePath)} order entry "${String(orderedId)}" does not exist in "sections".`,
            path: templatePath,
            docs,
          });
        }
      }
    }

    return findings;
  },
};
