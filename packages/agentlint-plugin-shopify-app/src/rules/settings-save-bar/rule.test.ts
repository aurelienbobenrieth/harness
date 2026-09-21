import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createNode, createJsxOpening } from "../test-support.js";
import { defineSettingsSaveBar, settingsSaveBar } from "./rule.js";

it("reports forms without save-bar markers in the file", () => {
  const context = createContext({
    sourceCode: "<form onSubmit={handleSubmit}><button>Save</button></form>",
  });
  const visitors = createVisitors(settingsSaveBar, context);

  visitors.jsx_opening_element?.(createNode("jsx_opening_element", "<form onSubmit={handleSubmit}>"));

  expect(context.messages).toHaveLength(1);
});

it("does not let a file-wide save bar suppress an unrelated form", () => {
  const context = createContext({
    sourceCode: 'shopify.saveBar.show("settings");\n<form onSubmit={handleSubmit}>',
  });
  const visitors = createVisitors(settingsSaveBar, context);

  visitors.jsx_opening_element?.(createNode("jsx_opening_element", "<form onSubmit={handleSubmit}>"));

  expect(context.messages).toHaveLength(1);
});

it("ignores non-form elements", () => {
  const context = createContext({ sourceCode: "<section>content</section>" });
  const visitors = createVisitors(settingsSaveBar, context);

  visitors.jsx_opening_element?.(createNode("jsx_opening_element", "<section>"));
  visitors.jsx_opening_element?.(createNode("jsx_opening_element", "<form-helper>"));
  visitors.jsx_opening_element?.(createNode("jsx_opening_element", "<Form.Section>"));

  expect(context.messages).toEqual([]);
});

it("recognizes a direct enabled data-save-bar attribute", () => {
  const context = createContext();
  const visitors = createVisitors(settingsSaveBar, context);
  visitors.jsx_opening_element?.(createJsxOpening("form", { "data-save-bar": true }));
  visitors.jsx_self_closing_element?.(createJsxOpening("Form", { "data-save-bar": '""' }, true));
  expect(context.messages).toEqual([]);
});

it("reviews false or dynamic markers and ignores save-bar prose inside other attributes", () => {
  const context = createContext();
  const visitors = createVisitors(settingsSaveBar, context);
  visitors.jsx_opening_element?.(createJsxOpening("form", { "data-save-bar": "{false}" }));
  visitors.jsx_opening_element?.(createJsxOpening("form", { "data-save-bar": "{enabled}" }));
  visitors.jsx_opening_element?.(createJsxOpening("form", { title: '"SaveBar data-save-bar"' }));
  expect(context.messages).toHaveLength(3);
});

it("supports explicit trusted form wiring without stateful pattern leaks", () => {
  const context = createContext();
  const visitors = createVisitors(
    defineSettingsSaveBar({
      formElementPattern: /^<SettingsForm\b/g,
      saveBarMarkerPattern: /useSaveBar/g,
    }),
    context,
  );
  for (let index = 0; index < 2; index++)
    visitors.jsx_opening_element?.(createNode("jsx_opening_element", "<SettingsForm onChange={useSaveBar}>"));
  expect(context.messages).toEqual([]);
});
