import type { RegistryDelivery, RegistrySurface } from "../../domain/registry.js";
import type { ScaffoldKind } from "./request.js";

export type ScaffoldFile = {
  readonly relativePath: string;
  readonly content: string;
};

export type ScaffoldPlan = {
  readonly files: readonly ScaffoldFile[];
  readonly registryPath: string;
  readonly surface: RegistrySurface;
  readonly delivery: RegistryDelivery;
};

function titleCase(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pascalCase(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function blockLiquid(name: string): string {
  return `{% doc %}
  ${titleCase(name)} block.

  Renders inside any section that accepts theme blocks.
{% enddoc %}

<div class="${name}" {{ block.shopify_attributes }}>
  {{ block.settings.heading }}
</div>

{% stylesheet %}
  .${name} {
    color: var(--scheme-text);
  }
{% endstylesheet %}

{% schema %}
{
  "name": "t:names.${name}",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "t:settings.heading"
    }
  ],
  "presets": [
    {
      "name": "t:names.${name}"
    }
  ]
}
{% endschema %}
`;
}

function snippetLiquid(name: string): string {
  return `{% doc %}
  ${titleCase(name)} snippet.

  @param class {string} - optional extra classes

  @example
  {% render '${name}' %}
{% enddoc %}

<div class="${name} {{ class }}"></div>
`;
}

function sectionLiquid(name: string): string {
  return `{% doc %}
  ${titleCase(name)} section.
{% enddoc %}

<section class="${name}">
  {% content_for 'blocks' %}
</section>

{% schema %}
{
  "name": "t:names.${name}",
  "blocks": [{ "type": "@theme" }],
  "settings": [],
  "presets": [
    {
      "name": "t:names.${name}"
    }
  ]
}
{% endschema %}
`;
}

function enhancerTs(name: string, namespace: string): string {
  const className = `${pascalCase(name)}Enhancer`;
  return `import { LitElement } from "lit";

export class ${className} extends LitElement {
  override createRenderRoot(): this {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // enhance the server-rendered light DOM here
  }
}

customElements.define("${namespace}-${name}", ${className});
`;
}

function enhancerTest(name: string): string {
  return `import { expect, it } from "vitest";
import { ${pascalCase(name)}Enhancer } from "./${name}-enhancer.js";

it("registers as a light DOM enhancer", () => {
  const enhancer = new ${pascalCase(name)}Enhancer();
  expect(enhancer.createRenderRoot()).toBe(enhancer);
});
`;
}

function machineTs(name: string, namespace: string): string {
  const machineName = `${name.replaceAll("-", "")}Machine`;
  return `import { setup } from "xstate";

export const ${machineName} = setup({}).createMachine({
  id: "${namespace}.${name}",
  initial: "idle",
  states: {
    idle: {},
  },
});
`;
}

function machineTest(name: string, namespace: string): string {
  const machineName = `${name.replaceAll("-", "")}Machine`;
  return `import { expect, it } from "vitest";
import { createActor } from "xstate";
import { ${machineName} } from "./${name}-machine.js";

it("starts in idle", () => {
  const actor = createActor(${machineName}).start();
  expect(actor.getSnapshot().value).toBe("idle");
  actor.stop();
});

it("uses the ${namespace} namespace", () => {
  expect(${machineName}.id).toBe("${namespace}.${name}");
});
`;
}

export function planScaffold(kind: ScaffoldKind, name: string, namespace: string): ScaffoldPlan {
  switch (kind) {
    case "block":
      return {
        files: [{ relativePath: `blocks/${name}.liquid`, content: blockLiquid(name) }],
        registryPath: `blocks/${name}.liquid`,
        surface: "merchant",
        delivery: "block",
      };
    case "snippet":
      return {
        files: [{ relativePath: `snippets/${name}.liquid`, content: snippetLiquid(name) }],
        registryPath: `snippets/${name}.liquid`,
        surface: "internal",
        delivery: "snippet",
      };
    case "section":
      return {
        files: [{ relativePath: `sections/${name}.liquid`, content: sectionLiquid(name) }],
        registryPath: `sections/${name}.liquid`,
        surface: "merchant",
        delivery: "section",
      };
    case "enhancer":
      return {
        files: [
          { relativePath: `frontend/features/${name}/${name}-enhancer.ts`, content: enhancerTs(name, namespace) },
          { relativePath: `frontend/features/${name}/${name}-enhancer.test.ts`, content: enhancerTest(name) },
        ],
        registryPath: `frontend/features/${name}/${name}-enhancer.ts`,
        surface: "internal",
        delivery: "enhancer",
      };
    case "machine":
      return {
        files: [
          { relativePath: `frontend/features/${name}/${name}-machine.ts`, content: machineTs(name, namespace) },
          { relativePath: `frontend/features/${name}/${name}-machine.test.ts`, content: machineTest(name, namespace) },
        ],
        registryPath: `frontend/features/${name}/${name}-machine.ts`,
        surface: "internal",
        delivery: "adapter",
      };
  }
}
