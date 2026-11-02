export type Token = {
  text: string;
  drawText: string;
  source_range: [number, number];
  kind: "text" | "math";
  scale: number;
  rise: number;
};
const supers = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const subs = "₀₁₂₃₄₅₆₇₈₉";

// Only a single-letter variable or number followed by ^ or _ and a digit sequence.
// Braces permit signed integers. Escapes, identifiers and unsupported syntax stay literal.
export function parseTokens(source: string, enabled: boolean): Token[] {
  const tokens: Token[] = [];
  for (let index = 0; index < source.length; ) {
    const char = String.fromCodePoint(source.codePointAt(index)!);
    const previous = source[index - 1] ?? "";
    const match =
      enabled && !/[\\\w]/.test(previous)
        ? /^([a-zA-Z0-9])([\^_])(\d+|\{[+-]?\d+\})(?![\w{}])/.exec(
            source.slice(index),
          )
        : null;
    if (match) {
      tokens.push({
        text: match[1],
        drawText: match[1],
        source_range: [index, index + 1],
        kind: "math",
        scale: 1,
        rise: 0,
      });
      const digits = match[3].replace(/[{}]/g, "");
      const table = match[2] === "^" ? supers : subs;
      const sign = match[2] === "^" ? ["⁺", "⁻"] : ["₊", "₋"];
      for (const digit of digits) {
        const text =
          digit === "+"
            ? sign[0]
            : digit === "-"
              ? sign[1]
              : table[Number(digit)];
        tokens.push({
          text,
          drawText: digit,
          source_range: [index + 2, index + match[0].length],
          kind: "math",
          scale: 0.7,
          rise: match[2] === "^" ? -0.38 : 0.18,
        });
      }
      index += match[0].length;
    } else {
      tokens.push({
        text: char,
        drawText: char,
        source_range: [index, index + char.length],
        kind: "text",
        scale: 1,
        rise: 0,
      });
      index += char.length;
    }
  }
  return tokens;
}
