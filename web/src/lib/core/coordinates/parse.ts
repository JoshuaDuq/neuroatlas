/** A coordinate as papers print it: three numbers in millimetres. */
export type Coordinate = [number, number, number];

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * A pasted coordinate, forgiving of how a paper or table writes it: "-42, 22, 6", "(-42 22 6)",
 * "[-42;22;6]", tab-separated, with a true minus sign. Null unless it holds exactly three numbers.
 */
export function parseCoordinate(text: string): Coordinate | null {
  const tokens = text
    .replaceAll('−', '-')
    .replace(/[()[\]{}]/g, ' ')
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (tokens.length !== 3 || !tokens.every((token) => NUMBER.test(token))) return null;
  return tokens.map(Number) as Coordinate;
}
