import { normalize } from "../lib/transcript.mjs";

/** Behavioral counts are signals, not claims that a commit or tool use was unjustified.
 * @attribution extract.py (owner-provided behavioral specification; independent implementation)
 */
export function detect(events, { t3Available = false, commits = [] } = {}) {
  const transcript = normalize(events);
  const result = {
    pollingLoops: 0,
    above200k: 0,
    fullGateRuns: 0,
    proofCommitWindow: 0,
    nativeSubagentsWithT3: 0,
    cacheWrite5m: 0,
    cacheWrite1h: 0,
    cacheWriteUnknown: 0,
  };
  let consecutive = 0;
  const contextText = JSON.stringify(
    events.filter(
      (e) =>
        e.type === "session_meta" ||
        e.type === "turn_context" ||
        e.type === "system" ||
        e.type === "user" ||
        (e.type === "response_item" && e.payload?.type === "message"),
    ),
  );
  const hasT3 =
    t3Available ||
    /mcp__t3_code__|T3 Code orchestration|"(?:server|name)":"t3-code"/.test(contextText) ||
    transcript.toolCalls.some((c) => /t3_code/.test(c.name));
  for (const call of transcript.toolCalls) {
    const arg = typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments ?? {});
    const isPoll =
      /(?:^|[_.:])(wait|sleep|status)(?:$|[_(:])/.test(call.name) ||
      /(?:\b(?:sleep|Start-Sleep)\b|\b(?:task_status|preview_status|wait_agent)\s*\(|\b(?:git|gh|docker)\s+status\b)/i.test(
        arg,
      );
    consecutive = isPoll ? consecutive + 1 : 0;
    if (consecutive === 3) result.pollingLoops++;
    result.fullGateRuns += [...arg.matchAll(/\bpnpm\s+(?:run\s+)?(?:gate|check)(?![\w:-])|--integrate\b/g)].length;
    if (
      hasT3 &&
      /^(?:Agent|Task|spawn_agent|functions[.]collaboration[.]spawn_agent|collaboration[.]spawn_agent)$/.test(call.name)
    )
      result.nativeSubagentsWithT3++;
    if (hasT3 && /(?:tools[.])?(?:collaboration[.])?spawn_agent\s*\(/.test(arg)) result.nativeSubagentsWithT3++;
  }
  for (const u of transcript.usages) {
    const cached = u.cache_read_input_tokens ?? 0;
    const write = u.cache_creation_input_tokens ?? 0;
    const context = (u.input_tokens ?? 0) + (u.provider === "claude" ? cached + write : 0);
    if (context > 200000) result.above200k++;
    const c = u.cache_creation ?? {};
    result.cacheWrite5m += c.ephemeral_5m_input_tokens ?? 0;
    result.cacheWrite1h += c.ephemeral_1h_input_tokens ?? 0;
    result.cacheWriteUnknown += Math.max(
      0,
      write - (c.ephemeral_5m_input_tokens ?? 0) - (c.ephemeral_1h_input_tokens ?? 0),
    );
  }
  if (
    commits.length &&
    commits.filter((c) => /^(?:test\([^)]*\):\s*prove\b|docs\([^)]*\):)/i.test(c.subject)).length / commits.length > 0.5
  )
    result.proofCommitWindow = 1;
  return result;
}

export function weekOf(timestamp) {
  const d = new Date(timestamp);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
