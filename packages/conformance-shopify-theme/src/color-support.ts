const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHexColor(value: string): readonly [number, number, number] | undefined {
  const match = hexPattern.exec(value.trim());
  if (match?.[1] === undefined) return undefined;
  const hex = match[1];
  const expanded = hex.length === 3 ? [...hex].map((character) => character + character).join("") : hex;
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
}

function channelLuminance(channel: number): number {
  const scaled = channel / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([red, green, blue]: readonly [number, number, number]): number {
  return 0.2126 * channelLuminance(red) + 0.7152 * channelLuminance(green) + 0.0722 * channelLuminance(blue);
}

export function contrastRatio(
  first: readonly [number, number, number],
  second: readonly [number, number, number],
): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}
