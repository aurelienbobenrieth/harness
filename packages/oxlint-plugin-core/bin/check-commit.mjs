#!/usr/bin/env node
/** Reject model credits while keeping human coauthors and ordinary technical mentions. */
import { readFileSync } from "node:fs";

try {
  if (process.argv.length !== 3) throw new Error("Usage: harness-check-commit <commit-message-file>");
  const message = readFileSync(process.argv[2], "utf8");
  const model =
    /\b(?:claude|anthropic|codex|openai|chatgpt|gpt(?:-?\d[\w.-]*)?|gemini|copilot|cursor|aider|windsurf|cline|llama|deepseek|qwen|mistral|[a-z]+\[bot\])\b/i;
  const attribution = message
    .split(/\r?\n/)
    .some((line) =>
      /^\s*(?:co-authored|assisted|generated|written|created|powered)-by\s*:/i.test(line)
        ? model.test(line)
        : /^\s*(?:🤖\s*)?(?:generated\s+(?:with|by)|(?:written|created|assisted)\s+(?:with|by))\b/i.test(line),
    );
  if (attribution) {
    console.error("Model or tool attribution is forbidden in commit messages; remove the credit line.");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
