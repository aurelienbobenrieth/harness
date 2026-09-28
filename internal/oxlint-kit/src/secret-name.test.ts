import { describe, expect, it } from "vitest";
import { secretNameMatcher } from "./secret-name.js";

const defaults = { secretPattern: "TOKEN|API_?KEY", benignPattern: "_TTL$" };

describe("secretNameMatcher", () => {
  it("matches secret names case-insensitively and lets the benign pattern win", () => {
    const isSecret = secretNameMatcher({}, defaults);

    expect(["API_KEY", "github_token", "ApiKey"].map(isSecret)).toEqual([true, true, true]);
    expect(["TOKEN_TTL", "REGION"].map(isSecret)).toEqual([false, false]);
  });

  it("replaces a default only with a non-empty string option", () => {
    const custom = secretNameMatcher({ secretPattern: "^PIN$", benignPattern: "" }, defaults);
    const invalid = secretNameMatcher({ secretPattern: 42 }, defaults);

    expect([custom("PIN"), custom("API_KEY"), custom("PIN_TTL")]).toEqual([true, false, false]);
    expect([invalid("API_KEY"), invalid("PIN")]).toEqual([true, false]);
  });
});
