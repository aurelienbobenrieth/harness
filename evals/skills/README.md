# Skill behavior probes

These artifacts preserve synthetic inputs, exact model responses, skill revisions, and inspected failures. They are qualitative evidence from a small sample, not automated quality scores. Repository test counts mentioned inside prompts are invented scenario facts unless an execution record explicitly says otherwise.

For a new model or host, open a fresh isolated session for each case. Supply the selected skill and only the request and facts. Keep stored responses and review notes out of the model input. Record the actual response model, skill SHA-256, host/version, elapsed time, tool availability, and any actions separately from stated intent. Compare factual scope, preserved authorization, completion, and reading effort before comparing length.

Use existing authorized model access. Do not publish artifacts, enable integrations, expose credentials, or let a text probe operate on a real project. An unavailable model is an unrun case, not a pass or a reason to substitute another model silently.

The Astra artifact preserves seven of eight initial/follow-up responses, including the contention inference that failed inspection. A longer requested-depth explanation was also inspected but is not reproduced here. The separate Fable record includes its CLI isolation limits and revised-prompt probes. Neither record measures a person's attention or proves automatic skill discovery.
