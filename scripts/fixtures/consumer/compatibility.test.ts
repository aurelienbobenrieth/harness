import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { defineStrictOxlintConfig } from "@aurelienbbn/oxlint-config";
import { defineOxfmtConfig } from "@aurelienbbn/oxfmt-config";
import { dependencyOverlap } from "@aurelienbbn/conformance-core";
import {
  complianceWebhooks,
  evaluateShopifyPerformance,
  evaluateShopifyIframeProtection,
  appUrlSecurity,
  apiVersionContract,
} from "@aurelienbbn/conformance-shopify-app";
import { run, runnerRoot, writeFixture } from "./runner-support.js";

it("uses the packed formatter policy in the actual formatter", async () => {
  await writeFixture("format-config.json", JSON.stringify(defineOxfmtConfig()));
  await writeFixture("format-clean.ts", 'export const name = "harness";\n');
  await writeFixture("format-broken.ts", "export const name='harness'\n");
  const executable = path.resolve("node_modules/oxfmt/bin/oxfmt");
  expect(run(executable, ["--config", "format-config.json", "--check", "format-clean.ts"], 0)).toContain(
    "correct format",
  );
  expect(run(executable, ["--config", "format-config.json", "--check", "format-broken.ts"], 1)).toContain(
    "format-broken.ts",
  );
});

it("uses the packed strict lint policy in the actual linter", async () => {
  const config = defineStrictOxlintConfig();
  expect(config.options?.typeAware).toBe(true);
  expect(config.options?.typeCheck).toBe(true);
  await writeFixture("policy-config.json", JSON.stringify(config));
  await writeFixture("policy-broken.ts", "export function read(value: any) { return value; }\n");
  await writeFixture("policy-clean.ts", "export const count = 1;\n");
  await writeFixture(
    "policy-tsconfig.json",
    JSON.stringify({
      compilerOptions: { strict: true, types: [], target: "ES2023" },
      files: ["policy-broken.ts", "policy-clean.ts"],
    }),
  );
  const executable = path.resolve("node_modules/oxlint/bin/oxlint");
  const broken = JSON.parse(
    run(
      executable,
      ["--config", "policy-config.json", "--tsconfig", "policy-tsconfig.json", "--format", "json", "policy-broken.ts"],
      1,
    ),
  ) as { diagnostics: { code: string }[]; number_of_files: number };
  expect(broken.number_of_files).toBe(1);
  expect(broken.diagnostics.some((finding) => finding.code === "typescript(no-explicit-any)")).toBe(true);
  const clean = JSON.parse(
    run(
      executable,
      ["--config", "policy-config.json", "--tsconfig", "policy-tsconfig.json", "--format", "json", "policy-clean.ts"],
      0,
    ),
  ) as { diagnostics: unknown[]; number_of_files: number };
  expect(clean.number_of_files).toBe(1);
  expect(clean.diagnostics).toEqual([]);
  await writeFixture("policy-typed.ts", 'export const count: number = "one";\n');
  await writeFixture(
    "policy-typed-tsconfig.json",
    JSON.stringify({
      compilerOptions: { strict: true, types: [], target: "ES2023" },
      files: ["policy-typed.ts"],
    }),
  );
  const typedArgs = [
    "--config",
    "policy-config.json",
    "--tsconfig",
    "policy-typed-tsconfig.json",
    "--format",
    "json",
    "policy-typed.ts",
  ];
  const typedBroken = JSON.parse(run(executable, typedArgs, 1)) as {
    diagnostics: { code: string }[];
    number_of_files: number;
  };
  expect(typedBroken.number_of_files).toBe(1);
  expect(typedBroken.diagnostics.map((finding) => finding.code)).toContain("typescript(TS2322)");
  await writeFixture("policy-typed.ts", "export const count = 1;\n");
  const typedClean = JSON.parse(run(executable, typedArgs, 0)) as {
    diagnostics: unknown[];
    number_of_files: number;
  };
  expect(typedClean.number_of_files).toBe(1);
  expect(typedClean.diagnostics).toEqual([]);
});

it("runs packed core and Shopify conformance checks against clean and broken inputs", async () => {
  const root = path.join(runnerRoot, "conformance");
  await mkdir(path.join(root, "sections"), { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { zod: "4.0.0", yup: "1.0.0" } }));
  expect(await dependencyOverlap.run({ root, dependencyOverlapGroups: [["zod", "yup"]] })).toHaveLength(1);
  await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { zod: "4.0.0" } }));
  expect(await dependencyOverlap.run({ root, dependencyOverlapGroups: [["zod", "yup"]] })).toEqual([]);
  await writeFile(path.join(root, "shopify.app.toml"), "embedded = true\n");
  expect((await complianceWebhooks.run({ root })).length).toBeGreaterThan(0);
  await writeFile(
    path.join(root, "shopify.app.toml"),
    'embedded = true\n[[webhooks.subscriptions]]\ncompliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]\nuri = "/webhooks"\n',
  );
  expect(await complianceWebhooks.run({ root })).toEqual([]);
});

/** Invalid public options must fail declaration checking, not merely runtime validation. */
export function rejectInvalidCompatibilityOptions(): void {
  // @ts-expect-error Format widths are numbers.
  defineOxfmtConfig({ printWidth: "wide" });
  // @ts-expect-error Replacement is a boolean.
  defineStrictOxlintConfig({}, { replaceLists: "true" });
}

it("uses the packed Shopify manifest and measured-evidence contracts", async () => {
  const root = path.join(runnerRoot, "shopify-contracts");
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, "shopify.app.toml"),
    'application_url = "http://app.example.com"\n[webhooks]\napi_version = "2024-01"\n',
  );
  expect((await appUrlSecurity.run({ root })).some((finding) => finding.severity === "error")).toBe(true);
  expect(
    (await apiVersionContract.run({ root, minimumApiVersion: "2026-01" })).some(
      (finding) => finding.severity === "error",
    ),
  ).toBe(true);
  await writeFile(
    path.join(root, "shopify.app.toml"),
    'application_url = "https://app.example.com"\n[webhooks]\napi_version = "2026-07"\n',
  );
  expect(await appUrlSecurity.run({ root })).toEqual([]);
  expect(await apiVersionContract.run({ root, minimumApiVersion: "2026-01" })).toEqual([]);
  const options = { required: ["admin-lcp"] as const, appId: "consumer-app", now: "2026-09-05T00:00:00.000Z" };
  const evidence = [
    {
      metric: "admin-lcp",
      value: 2500,
      samples: 100,
      unit: "ms",
      statistic: "p75",
      appId: options.appId,
      windowStart: "2026-08-08T00:00:00.000Z",
      windowEnd: options.now,
      reference: "fixture-export",
      source: "observability",
    },
  ];
  expect(evaluateShopifyPerformance(evidence, options).status).toBe("passed");
  expect(evaluateShopifyPerformance([{ ...evidence[0], samples: 99 }], options).status).toBe("incomplete");
  expect(evaluateShopifyPerformance([{ ...evidence[0], value: 2501 }], options).status).toBe("failed");
  expect(
    evaluateShopifyIframeProtection({
      embedded: true,
      authenticatedShopDomain: "fixture.myshopify.com",
      response: new Response("", {
        headers: {
          "content-security-policy": "frame-ancestors https://fixture.myshopify.com https://admin.shopify.com",
        },
      }),
    }),
  ).toEqual([]);
  expect(
    evaluateShopifyIframeProtection({
      embedded: true,
      authenticatedShopDomain: "fixture.myshopify.com",
      response: new Response("", { headers: { "content-security-policy": "frame-ancestors *" } }),
    }),
  ).toHaveLength(1);
});
