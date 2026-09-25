import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports, reportedMessages } from "../test-support.js";

const rule = "shopify-app/s-known-components";
const filename = "app/routes/sample.tsx";

/** A hand-written manifest in Custom Elements Manifest 2.x shape; fictional tags, no Shopify content. */
const manifest = JSON.stringify({
  schemaVersion: "2.1.0",
  modules: [
    {
      kind: "javascript-module",
      path: "widget.js",
      declarations: [
        {
          kind: "class",
          name: "Widget",
          customElement: true,
          tagName: "s-widget",
          attributes: [
            { name: "tone", fieldName: "tone" },
            { name: "accessibilitylabel", fieldName: "accessibilityLabel" },
            { name: "value", fieldName: "defaultValue" },
          ],
          members: [
            { kind: "field", name: "heading" },
            { kind: "field", name: "secret", privacy: "private" },
            { kind: "field", name: "formAssociated", static: true },
            { kind: "method", name: "focusFirst" },
          ],
          events: [{ name: "afterhide" }, { name: "click" }],
        },
        { kind: "class", name: "Helper" },
      ],
    },
    {
      kind: "javascript-module",
      path: "gadget.js",
      declarations: [{ kind: "class", name: "Gadget", customElement: true, tagName: "s-gadget", attributes: [] }],
    },
  ],
});

const installed = {
  "node_modules/@shopify/polaris-types/package.json": JSON.stringify({
    name: "@shopify/polaris-types",
    customElements: "./dist/custom-elements.json",
  }),
  "node_modules/@shopify/polaris-types/dist/custom-elements.json": manifest,
};

const withManifest = { filename, files: installed };

it.each([
  ["<s-widgets />", "`<s-widgets>` is not a Polaris web component"],
  ["<s-gadget><s-unknown /></s-gadget>", "`<s-unknown>` is not a Polaris web component"],
  ['<s-widget tones="info" />', "`tones` is not a property, attribute or event of `<s-widget>`"],
  ['<s-widget aria-label="Save" />', "`aria-label` is not a property"],
  ['<s-widget className="x" />', "`className` is not a property"],
  ['<s-widget secret="x" />', "`secret` is not a property"],
  ["<s-widget formAssociated />", "`formAssociated` is not a property"],
  ["<s-widget focusFirst />", "`focusFirst` is not a property"],
  ["<s-widget onDismiss={close} />", "`onDismiss` is not a property"],
  ["<s-app-nav><s-widget><s-widget rel='x' /></s-widget></s-app-nav>", "`rel` is not a property"],
  ["<s-gadget tone />", "`tone` is not a property, attribute or event of `<s-gadget>`"],
])("reports elements and attributes the manifest does not declare: %s", async (jsx, message) => {
  const messages = await reportedMessages(rule, `const view = ${jsx};`, withManifest);
  expect(messages).toHaveLength(1);
  expect(messages[0]).toContain(message);
});

it("reports every unknown attribute on one element", async () => {
  const messages = await reportedMessages(
    rule,
    'const view = <s-widget tone="info" colour="red" size="big" />;',
    withManifest,
  );
  expect(messages.map((message) => message.split("`")[1]).toSorted()).toEqual(["colour", "size"]);
});

it.each([
  '<s-widget tone="info" heading="Title" />',
  '<s-widget accessibilityLabel="Save" accessibilitylabel="Save" accessibility-label="Save" />',
  '<s-widget value="1" defaultValue="1" />',
  "<s-widget onAfterHide={close} onafterhide={close} onClick={save} />",
  '<s-widget key="a" ref={ref} slot="aside" id="w" data-testid="w">text</s-widget>',
  "<s-widget {...props} />",
  "<s-app-nav><a href='/'>Home</a></s-app-nav>",
  "<s-app-nav><s-widget href='/' rel='home'>Home</s-widget><><s-widget rel='x' /></></s-app-nav>",
  "<s-app-window src='/edit' />",
  "<Widget anything />",
  "<div className='x' />",
  "<ui-modal id='m' />",
])("allows declared names, framework props and non-Polaris elements: %s", async (jsx) => {
  await assertRuleDoesNotReport(rule, `const view = ${jsx};`, withManifest);
});

it("stays silent when no @shopify/polaris-types is installed", async () => {
  await assertRuleDoesNotReport(rule, "const view = <s-widgets tones />;", { filename });
});

it("stays silent when the installed package declares no customElements file", async () => {
  await assertRuleDoesNotReport(rule, "const view = <s-widgets tones />;", {
    filename,
    files: { "node_modules/@shopify/polaris-types/package.json": JSON.stringify({ name: "@shopify/polaris-types" }) },
  });
});

it("reads an explicit manifestPath instead of the installed package", async () => {
  const messages = await reportedMessages(rule, "const view = <s-widget />;", {
    filename,
    files: {
      "manifests/cem.json": JSON.stringify({
        modules: [{ declarations: [{ customElement: true, tagName: "s-other", attributes: [] }] }],
      }),
      ...installed,
    },
    ruleOptions: (directory: string) => ({ manifestPath: `${directory}/manifests/cem.json` }),
  });
  expect(messages).toEqual([expect.stringContaining("`<s-widget>` is not a Polaris web component")]);
});

it.each([
  [
    "a missing explicit manifestPath",
    { ruleOptions: (directory: string) => ({ manifestPath: `${directory}/none.json` }) },
  ],
  [
    "an installed manifest that declares no elements",
    {
      files: {
        ...installed,
        "node_modules/@shopify/polaris-types/dist/custom-elements.json": JSON.stringify({ modules: [] }),
      },
    },
  ],
])("reports once per file for %s", async (_label, options) => {
  const messages = await reportedMessages(rule, "const a = <s-widget />; const b = <s-widget />;", {
    filename,
    ...options,
  });
  expect(messages).toEqual([expect.stringContaining("Polaris Custom Elements Manifest at")]);
});

it.each([
  [{ allowElements: ["s-custom"] }, "<s-custom />"],
  [{ allowAttributes: ["className"] }, '<s-widget className="x" />'],
])("honours allow options %j", async (ruleOptions, jsx) => {
  await assertRuleDoesNotReport(rule, `const view = ${jsx};`, { ...withManifest, ruleOptions });
});

it("replaces the default allowElements rather than merging", async () => {
  await assertRuleReports(rule, "const view = <s-app-nav />;", {
    ...withManifest,
    ruleOptions: { allowElements: ["s-custom"] },
  });
});
