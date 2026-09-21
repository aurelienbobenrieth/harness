/**
 * Flags availability booleans and finite-state mirrors cached in machine context.
 *
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import { defineRule, type AgentlintNode, type StateRule } from "@aurelienbbn/agentlint";

const assignCallPattern = /^(?:[\w$]+\.)?assign\s*[(<]/;
const defaultContextFlagPattern = /\b(?:can|is|has)[A-Z]\w*\??\s*:/;
const defaultStateMirrorPattern = /\b(?:status|state|step|phase|mode)\??\s*:\s*(?:\|\s*)?["'`]/;
const defaultMachineFilePattern = /createMachine/;
const machineCalleePattern = /(?:^|\.)createMachine$/;
const typesOwnerCalleePattern = /(?:^|\.)createMachine$|^setup$/;

const flagMessage = "Context flag assignment: model availability as a guard and read snapshot.can() from the UI.";
const mirrorMessage =
  "Context field mirrors the finite state: drop the string-enum copy and read snapshot.matches() or snapshot.hasTag() instead.";

export type DerivedBooleanContextOptions = {
  /** Pattern matching boolean availability flags inside assign(...) calls and machine context declarations. */
  readonly contextFlagPattern?: RegExp;
  /** Pattern matching string-enum context fields that duplicate the finite state (status, step, phase...). */
  readonly stateMirrorPattern?: RegExp;
  /** Pattern tested against the file source to gate the rule to machine files. */
  readonly machineFilePattern?: RegExp;
};

function keyName(pair: AgentlintNode): string | undefined {
  return pair.childByFieldName("key")?.text.replace(/^['"`]|['"`]$/g, "");
}

function calleeText(call: AgentlintNode | null | undefined): string {
  return call?.type === "call_expression" ? (call.childByFieldName("function")?.text ?? "") : "";
}

/** The call whose first-level config object directly holds `pair`, when there is one. */
function configOwnerCall(pair: AgentlintNode): AgentlintNode | null {
  const holder = pair.parent?.parent;
  return holder?.type === "arguments" && holder.parent?.type === "call_expression" ? holder.parent : null;
}

function initialContextPair(machineCall: AgentlintNode): AgentlintNode | undefined {
  return machineCall
    .childByFieldName("arguments")
    ?.children.find((child) => child.type === "object")
    ?.children.find((child) => child.type === "pair" && keyName(child) === "context");
}

/** The createMachine call a `types` holder belongs to: itself, or the call chained on a setup(...) result. */
function machineCallFor(typesOwner: AgentlintNode): AgentlintNode | null {
  if (machineCalleePattern.test(calleeText(typesOwner))) return typesOwner;
  const chained = typesOwner.parent?.type === "member_expression" ? typesOwner.parent.parent : null;
  return chained && machineCalleePattern.test(calleeText(chained)) ? chained : null;
}

export function defineDerivedBooleanContext(options: DerivedBooleanContextOptions = {}): StateRule {
  options = structuredClone(options);
  const contextFlagPattern = options.contextFlagPattern ?? defaultContextFlagPattern;
  const stateMirrorPattern = options.stateMirrorPattern ?? defaultStateMirrorPattern;
  const machineFilePattern = options.machineFilePattern ?? defaultMachineFilePattern;

  const messageFor = (text: string): string | undefined => {
    contextFlagPattern.lastIndex = 0;
    if (contextFlagPattern.test(text)) return flagMessage;
    stateMirrorPattern.lastIndex = 0;
    return stateMirrorPattern.test(text) ? mirrorMessage : undefined;
  };

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "xstate/derived-boolean-context",
      revision: 2,
      title: "Derived Boolean Context",
      summary:
        "Flags assign() calls and machine context declarations that cache availability booleans or string-enum copies of the finite state.",
      guidance: {
        standard:
          "Context fields that cache transition availability (canSubmit, isLoading) or mirror the finite state (status, step, phase) drift out of sync with the machine; the machine already knows where it is and what it can do. Model the predicate as a guard, expose UI-facing groupings as state tags, and read snapshot.can(event), snapshot.hasTag(tag) or snapshot.matches(value) from the UI. snapshot.can(event) executes the transition guards, so every guard it reaches must be pure and synchronous.",
        checks: [
          "Availability flags (canSubmit, isReady) move into transition guards.",
          'UI reads snapshot.can({ type: "EVENT" }) instead of context booleans.',
          "UI reads snapshot.hasTag(...) or snapshot.matches(...) instead of a mirrored isLoading flag or a status/step/phase string kept in context.",
          "Guards reachable through snapshot.can(...) are pure: no I/O, no mutation, no dependence on time or randomness.",
          "Booleans or enums that are intentionally persisted domain data (not derived availability or a copy of the finite state) may be accepted with a reason.",
        ],
        refs: [
          { type: "url", href: "https://stately.ai/docs/guards" },
          { type: "url", href: "https://stately.ai/docs/states" },
        ],
      },
    },
    binding: {
      id: "xstate/derived-boolean-context",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx}"],
      exclude: ["**/*.d.ts"],
      options: {
        contextFlagPattern: options.contextFlagPattern
          ? { source: options.contextFlagPattern.source, flags: options.contextFlagPattern.flags }
          : null,
        stateMirrorPattern: options.stateMirrorPattern
          ? { source: options.stateMirrorPattern.source, flags: options.stateMirrorPattern.flags }
          : null,
        machineFilePattern: options.machineFilePattern
          ? { source: options.machineFilePattern.source, flags: options.machineFilePattern.flags }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          { file: "src/module.ts", source: "createMachine({}); assign({canSubmit:true});" },
          {
            label: "enqueue.assign",
            file: "src/module.ts",
            source: "createMachine({entry:enqueueActions(({enqueue})=>{enqueue.assign({isReady:true});})});",
          },
          {
            label: "initial context flag",
            file: "src/module.ts",
            source: "setup({}).createMachine({context:{isLoading:false}});",
          },
          {
            label: "types.context state mirror",
            file: "src/module.ts",
            source: 'setup({types:{context:{} as {status:"idle"|"loading"}}}).createMachine({});',
          },
        ],
        mustStaySilent: [
          { file: "src/module.ts", source: "createMachine({}); assign({count:1});" },
          {
            label: "context key outside a machine config",
            file: "src/module.ts",
            source: "createMachine({}); render({context:{isLoading:false}});",
          },
          {
            label: "non-literal status",
            file: "src/module.ts",
            source: "createMachine({context:{status:initialStatus,items:[]}});",
          },
        ],
      },
      id: "xstate/derived-boolean-context",
      version: 2,
      scan: "file",
      createOnce(context) {
        const inMachineFile = (): boolean => {
          machineFilePattern.lastIndex = 0;
          return machineFilePattern.test(context.source);
        };
        return {
          call_expression(node) {
            if (!assignCallPattern.test(node.text)) return;
            const message = messageFor(node.text);
            if (!message || !inMachineFile()) return;
            context.report({ node, message });
          },
          pair(node) {
            if (keyName(node) !== "context") return;
            const message = messageFor(node.text);
            if (!message || !inMachineFile()) return;
            const owner = configOwnerCall(node);
            if (owner) {
              if (machineCalleePattern.test(calleeText(owner))) context.report({ node, message });
              return;
            }
            const typesPair = node.parent?.parent;
            if (typesPair?.type !== "pair" || keyName(typesPair) !== "types") return;
            const typesOwner = configOwnerCall(typesPair);
            if (!typesOwner || !typesOwnerCalleePattern.test(calleeText(typesOwner))) return;
            const machineCall = machineCallFor(typesOwner);
            const initial = machineCall ? initialContextPair(machineCall) : undefined;
            if (initial && messageFor(initial.text)) return;
            context.report({ node, message });
          },
        };
      },
    },
  });
}

export const derivedBooleanContext = defineDerivedBooleanContext();
