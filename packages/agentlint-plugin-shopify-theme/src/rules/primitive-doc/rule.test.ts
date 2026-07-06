import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { primitiveDoc } from "./rule.js";

it("reports doc headers without an @example", () => {
  const source = "{% doc %}\n  Renders an icon.\n  @param name {string}\n{% enddoc %}<svg></svg>";
  const context = createContext({ filename: "snippets/icon.liquid", sourceCode: source });
  const visitors = primitiveDoc.createOnce(context);

  visitors.before?.("snippets/icon.liquid");
  visitors["Document"]?.(createNode("Document", source));

  expect(context.messages).toEqual([expect.stringContaining("@example")]);
});

it("accepts doc headers with an @example", () => {
  const source = "{% doc %}\n  Renders an icon.\n  @example\n  {% render 'icon', name: 'cart' %}\n{% enddoc %}";
  const context = createContext({ filename: "snippets/icon.liquid", sourceCode: source });
  const visitors = primitiveDoc.createOnce(context);

  visitors["Document"]?.(createNode("Document", source));
  expect(context.messages).toEqual([]);
});

it("leaves missing doc headers to conformance", () => {
  const context = createContext({ filename: "snippets/icon.liquid", sourceCode: "<svg></svg>" });
  const visitors = primitiveDoc.createOnce(context);

  visitors["Document"]?.(createNode("Document", "<svg></svg>"));
  expect(context.messages).toEqual([]);
});
