import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createJsxOpening } from "../test-support.js";
import { defineFormErrorRecovery, formErrorRecovery } from "./rule.js";

it.each(['"Enter a postcode"', "{errors.postcode}", "{t('form.postcode.error')}"])(
  "reviews field error wiring %s",
  (error) => {
    const context = createContext();
    createVisitors(formErrorRecovery, context).jsx_self_closing_element?.(
      createJsxOpening("s-text-field", { error }, true),
    );
    expect(context.messages).toHaveLength(1);
  },
);

it.each(['""', '"  "', "{false}", "{null}", "{undefined}"])("ignores statically inactive errors %s", (error) => {
  const context = createContext();
  createVisitors(formErrorRecovery, context).jsx_opening_element?.(createJsxOpening("s-text-field", { error }));
  expect(context.messages).toEqual([]);
});

it("does not infer error wiring from a label or an unrelated component", () => {
  const context = createContext();
  const visitors = createVisitors(formErrorRecovery, context);
  visitors.jsx_opening_element?.(createJsxOpening("s-text-field", { label: '"Example error=wrong"' }));
  visitors.jsx_opening_element?.(createJsxOpening("ErrorBoundary", { error: "{error}" }));
  expect(context.messages).toEqual([]);
});

it("reviews a switch's error recovery without requiring a grouped save workflow", () => {
  const context = createContext();
  createVisitors(formErrorRecovery, context).jsx_self_closing_element?.(
    createJsxOpening("s-switch", { label: '"Send shipment alerts"', error: "{updateError}" }, true),
  );
  expect(context.messages).toHaveLength(1);
});

it("keeps switches without error wiring or with an empty error silent", () => {
  const context = createContext();
  const visitors = createVisitors(formErrorRecovery, context);
  visitors.jsx_opening_element?.(createJsxOpening("s-switch", { checked: true }));
  visitors.jsx_opening_element?.(createJsxOpening("s-switch", { error: '""' }));
  visitors.jsx_opening_element?.(createJsxOpening("s-switch-group", { error: "{error}" }));
  expect(context.messages).toEqual([]);
});

it("supports custom field and error props repeatedly", () => {
  const context = createContext();
  const visitors = createVisitors(
    defineFormErrorRecovery({
      elementNamePattern: /^Input$/g,
      errorAttribute: "validationMessage",
    }),
    context,
  );
  for (let index = 0; index < 2; index++)
    visitors.jsx_opening_element?.(createJsxOpening("Input", { validationMessage: "{error}" }));
  expect(context.messages).toHaveLength(2);
});
