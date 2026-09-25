import { parse } from "smol-toml";

export function parseToml(content: string): Record<string, unknown> | undefined {
  try {
    return parse(content);
  } catch {
    return undefined;
  }
}
