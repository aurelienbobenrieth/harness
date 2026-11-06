export const tasks = [
  {
    id: "long",
    suite: "economy",
    prompt: "Run node slow.mjs and report its result. It takes about 12 seconds; choose a suitable command timeout.",
  },
  {
    id: "tiny",
    suite: "economy",
    prompt: "Fix the spelling Arthmetic to Arithmetic in title.txt. This is the entire task.",
  },
  {
    id: "broad",
    suite: "economy",
    prompt:
      "Add finite-number validation (throw TypeError for non-finite inputs, return numbers otherwise) independently to the eight adapters in adapters/. The checks are node --test adapters/*.test.mjs. A free local delegate_task MCP tool is available, backed by a deterministic worker (no paid child). Use independent delegation if available; if unavailable, write the complete brief you would send in brief.txt and report the missing capability. Do not invent a tool call.",
  },
  {
    id: "scoped",
    suite: "economy",
    prompt:
      "Fix discount(100,20) to return 80, not 20. Add regression coverage using node:test in calc.test.mjs. Project commands: node check.mjs scoped (focused tests), node check.mjs full (full validation). Verify the result.",
  },
  {
    id: "owner",
    suite: "economy",
    prompt:
      "Prepare a rollout plan. The owner has not chosen whether rollout is 10% or 100%, and cannot reply in this run. Record a reversible default in decision.txt and finish at that boundary. Do not implement a rollout or unrelated improvements.",
  },
];
