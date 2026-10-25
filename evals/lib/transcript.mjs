/** Normalize CLI streams and saved session events without depending on skill wording. */
export function normalize(events) {
  const messages = [],
    toolCalls = [],
    skillLoads = [],
    usages = [];
  const seen = new Set();
  const usageByMessage = new Map(),
    toolIds = new Set();
  const hasUsageRecords = events.some((e) => e.type === "token_usage_record");
  let reportedCostUsd = null;
  for (const event of events) {
    const p = event.payload ?? event;
    const timestamp = event.timestamp;
    if (event.type === "assistant" || event.type === "user") {
      const m = event.message ?? {};
      messages.push({ role: event.type, content: m.content, timestamp });
      for (const b of Array.isArray(m.content) ? m.content : []) {
        if (b.type === "tool_use" && (!b.id || !toolIds.has(b.id))) {
          toolIds.add(b.id);
          toolCalls.push({ id: b.id, name: b.name, arguments: b.input, timestamp });
        }
      }
      if (m.usage) {
        const id = m.id ?? event.uuid ?? event;
        if (usageByMessage.has(id))
          usages[usageByMessage.get(id)] = {
            ...m.usage,
            model: m.model,
            timestamp,
            provider: "claude",
          };
        else {
          usageByMessage.set(id, usages.length);
          usages.push({ ...m.usage, model: m.model, timestamp, provider: "claude" });
        }
      }
    }
    if (event.type === "response_item") {
      if (p.type === "message") messages.push({ role: p.role, content: p.content, timestamp });
      if (["function_call", "custom_tool_call", "local_shell_call"].includes(p.type)) {
        let args = p.arguments ?? p.input ?? p.action;
        try {
          args = JSON.parse(args);
        } catch {
          /* Custom tools carry raw source. */
        }
        toolCalls.push({ id: p.call_id, name: p.name ?? p.type, arguments: args, timestamp });
      }
    }
    if (event.type === "item.completed" || event.type === "item.started") {
      const i = event.item ?? {};
      if (event.type === "item.completed" && i.type === "agent_message")
        messages.push({ role: "assistant", content: i.text, timestamp });
      if (["command_execution", "mcp_tool_call"].includes(i.type) && !seen.has(i.id)) {
        seen.add(i.id);
        toolCalls.push({
          id: i.id,
          name: i.tool ?? i.type,
          arguments: i.arguments ?? { command: i.command },
          timestamp,
        });
      }
    }
    if (event.type === "token_usage_record" || event.type === "turn.completed") {
      if (p.usage) usages.push({ ...p.usage, timestamp, provider: "codex" });
    }
    if (!hasUsageRecords && event.type === "event_msg" && p.type === "token_count" && p.info?.last_token_usage) {
      // Old Codex sessions expose the last call rather than a token_usage_record.
      const key = JSON.stringify([p.info.total_token_usage, p.info.last_token_usage]);
      if (!seen.has(key)) {
        seen.add(key);
        usages.push({ ...p.info.last_token_usage, timestamp, provider: "codex" });
      }
    }
    if (event.type === "result" && Number.isFinite(event.total_cost_usd)) reportedCostUsd = event.total_cost_usd;
  }
  for (const call of toolCalls) {
    const args = typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments ?? {});
    if (/^(?:Skill|skill)$/i.test(call.name)) skillLoads.push({ skill: call.arguments?.skill, ...call });
    else if (/Read|read_file|command_execution|exec|shell/i.test(call.name)) {
      for (const match of args.matchAll(/(?:skills[\\/]+)([\w-]+)[\\/]+SKILL\.md/g)) {
        skillLoads.push({ skill: match[1], ...call });
      }
    }
  }
  const tokens = { input: 0, output: 0, cached: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
  for (const u of usages) {
    const cached = u.cached_input_tokens ?? u.cache_read_input_tokens ?? 0;
    tokens.input += Math.max(0, (u.input_tokens ?? 0) - (u.provider === "codex" ? cached : 0));
    tokens.output += u.output_tokens ?? 0;
    tokens.cached += cached;
    const c = u.cache_creation ?? {};
    tokens.cacheWrite5m += c.ephemeral_5m_input_tokens ?? 0;
    tokens.cacheWrite1h += c.ephemeral_1h_input_tokens ?? 0;
    // Missing TTL is deliberately unknown, not inferred as a one-hour write.
  }
  return { messages, toolCalls, skillLoads, usages, tokens, reportedCostUsd };
}

/** Conservative planning rates in USD/M tokens, configurable as model prices evolve. */
export function estimateCost(tokens, model) {
  const overrides = JSON.parse(process.env.EVALS_RATES_JSON ?? "{}");
  const rates =
    overrides[model] ??
    (/haiku/i.test(model)
      ? [1, 5, 0.1, 1.25, 2]
      : /claude|sonnet/i.test(model)
        ? [3, 15, 0.3, 3.75, 6]
        : [2.5, 15, 0.25, 0, 0]);
  return [tokens.input, tokens.output, tokens.cached, tokens.cacheWrite5m, tokens.cacheWrite1h].reduce(
    (sum, n, i) => sum + (n * rates[i]) / 1e6,
    0,
  );
}
