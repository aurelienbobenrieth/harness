import { createVisitors } from "../test-support.js";
import { expect, it } from "vitest";
import { createContext, createNode } from "../test-support.js";
import { defineSessionTokenAuth, sessionTokenAuth } from "./rule.js";

it("reports document.cookie access", () => {
  const context = createContext();
  const visitors = createVisitors(sessionTokenAuth, context);

  visitors.member_expression?.(createNode("member_expression", "document.cookie"));

  expect(context.messages).toHaveLength(1);
});

it("reports identity-looking Web Storage calls", () => {
  const context = createContext();
  const visitors = createVisitors(sessionTokenAuth, context);

  visitors.call_expression?.(createNode("call_expression", 'localStorage.getItem("shopify-session-token")'));

  expect(context.messages).toHaveLength(1);
});

it("ignores non-identity Web Storage calls", () => {
  const context = createContext();
  const visitors = createVisitors(sessionTokenAuth, context);

  visitors.call_expression?.(createNode("call_expression", 'localStorage.setItem("dismissed-banner", "true")'));

  expect(context.messages).toEqual([]);
});

it("matches project-specific identity keys when configured", () => {
  const custom = defineSessionTokenAuth({ identityKeyPattern: /merchant-identity/ });
  const context = createContext();
  const visitors = createVisitors(custom, context);

  visitors.call_expression?.(createNode("call_expression", 'localStorage.getItem("merchant-identity")'));

  expect(context.messages).toHaveLength(1);
});

it("ignores unrelated member access", () => {
  const context = createContext();
  const visitors = createVisitors(sessionTokenAuth, context);

  visitors.member_expression?.(createNode("member_expression", "document.title"));

  expect(context.messages).toEqual([]);
});

it("does not alternate findings with a stateful identity pattern", () => {
  const context = createContext();
  const visitors = createVisitors(defineSessionTokenAuth({ identityKeyPattern: /identity/g }), context);
  for (let index = 0; index < 2; index++)
    visitors.call_expression?.(createNode("call_expression", 'localStorage.getItem("identity")'));
  expect(context.messages).toHaveLength(2);
});
