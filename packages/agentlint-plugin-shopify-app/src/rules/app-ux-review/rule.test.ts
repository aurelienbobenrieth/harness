import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createJsxOpening, createNode } from "../test-support.js";
import { appUxReview, defineAppUxReview, type AppUxReviewArea } from "./rule.js";

it("does not infer page purpose without project configuration", () => {
  const context = createContext({ filename: "app/routes/app._index.tsx" });
  createVisitors(appUxReview, context).jsx_opening_element?.(createJsxOpening("s-page"));
  expect(context.messages).toEqual([]);
});

it("reviews only configured page routes and merges matching areas once", () => {
  const context = createContext({ filename: "C:\\project\\app\\routes\\app._index.tsx" });
  const visitors = createVisitors(
    defineAppUxReview({
      targets: [
        { filenamePattern: /\/app\._index\.tsx$/g, areas: ["home", "responsive"] },
        { filenamePattern: /\/routes\//g, areas: ["responsive", "navigation"] },
      ],
    }),
    context,
  );
  visitors.jsx_opening_element?.(createJsxOpening("s-page"));
  visitors.jsx_self_closing_element?.(createJsxOpening("s-page", {}, true));
  expect(context.messages).toEqual(["Configured app route requires UX evidence for: home, responsive, navigation."]);
});

it("resets once-per-file state when the runner starts another file", () => {
  const context = createContext({ filename: "src/editor.tsx" });
  const visitors = createVisitors(
    defineAppUxReview({
      targets: [{ filenamePattern: /editor\.tsx$/g, areas: ["visual-editor"] }],
    }),
    context,
  );
  visitors.jsx_opening_element?.(createJsxOpening("s-page"));
  visitors.before?.("src/editor.tsx");
  visitors.jsx_opening_element?.(createJsxOpening("s-page"));
  expect(context.messages).toHaveLength(2);
});

it("ignores mismatched paths, non-page elements, and empty review areas", () => {
  const context = createContext({ filename: "src/service.tsx" });
  const visitors = createVisitors(
    defineAppUxReview({
      targets: [{ filenamePattern: /home\.tsx$/, areas: ["home"] }],
    }),
    context,
  );
  visitors.jsx_opening_element?.(createJsxOpening("s-page"));
  const matching = createVisitors(
    defineAppUxReview({
      targets: [{ filenamePattern: /service\.tsx$/, areas: ["home"] }],
    }),
    context,
  );
  matching.jsx_opening_element?.(createJsxOpening("div"));
  createVisitors(
    defineAppUxReview({ targets: [{ filenamePattern: /service\.tsx$/, areas: [] }] }),
    context,
  ).jsx_opening_element?.(createJsxOpening("s-page"));
  expect(context.messages).toEqual([]);
});

it("supports an explicitly named page wrapper", () => {
  const context = createContext({ filename: "src/settings.tsx" });
  createVisitors(
    defineAppUxReview({
      elementNamePattern: /^AppPage$/,
      targets: [{ filenamePattern: /settings/, areas: ["premium"] }],
    }),
    context,
  ).jsx_opening_element?.(createJsxOpening("AppPage"));
  expect(context.messages).toHaveLength(1);
});

it("reviews an explicit extension entry point without JSX and preserves separate page targets", () => {
  const context = createContext({ filename: "extensions/admin/src/index.tsx" });
  const visitors = createVisitors(
    defineAppUxReview({
      targets: [
        { filenamePattern: /extensions\/admin\//, areas: ["admin-extension"], trigger: "file" },
        { filenamePattern: /index\.tsx$/, areas: ["content"] },
      ],
    }),
    context,
  );
  visitors.program?.(createNode("program", "export const tool = {}"));
  visitors.jsx_opening_element?.(createJsxOpening("s-page"));
  expect(context.messages).toEqual([
    "Configured app route requires UX evidence for: admin-extension.",
    "Configured app route requires UX evidence for: content.",
  ]);
});

it.each<AppUxReviewArea>(["copy-mechanics", "checkout", "admin-extension", "sidekick"])(
  "schedules only the configured %s area",
  (area) => {
    const context = createContext({ filename: "src/surface.ts" });
    const visitors = createVisitors(
      defineAppUxReview({
        targets: [{ filenamePattern: /surface\.ts$/, areas: [area], trigger: "file" }],
      }),
      context,
    );
    visitors.program?.(createNode("program", "export const surface = {}"));
    expect(context.messages).toEqual([`Configured app route requires UX evidence for: ${area}.`]);
  },
);
