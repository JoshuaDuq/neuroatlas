// A small CSS block scanner for the stylesheet invariant tests (stylesheets.test.ts, parity/u1.test.ts).
// It understands nesting by braces only: rules, at-rules, @layer blocks and statements such as @import.

export interface CssNode {
  /** The text before `{`, or the whole statement for a node without a block. */
  prelude: string;
  /** `prop: value` declarations written directly in this block. */
  declarations: string[];
  children: CssNode[];
  hasBlock: boolean;
}

const COMMENT = /\/\*[\s\S]*?\*\//g;

export function parseCss(css: string): CssNode[] {
  const text = css.replace(COMMENT, '');
  let position = 0;

  function parseBlock(inBraces: boolean): { declarations: string[]; children: CssNode[] } {
    const declarations: string[] = [];
    const children: CssNode[] = [];
    let buffer = '';
    while (position < text.length) {
      const character = text[position++];
      if (character === '{') {
        const inner = parseBlock(true);
        children.push({ prelude: buffer.trim(), ...inner, hasBlock: true });
        buffer = '';
      } else if (character === '}') {
        if (!inBraces) throw new Error('Unbalanced "}"');
        if (buffer.trim()) declarations.push(buffer.trim());
        return { declarations, children };
      } else if (character === ';') {
        const statement = buffer.trim();
        buffer = '';
        if (!statement) continue;
        if (inBraces && !statement.startsWith('@')) declarations.push(statement);
        else children.push({ prelude: statement, declarations: [], children: [], hasBlock: false });
      } else {
        buffer += character;
      }
    }
    if (inBraces) throw new Error('Unclosed "{"');
    return { declarations, children };
  }

  return parseBlock(false).children;
}

/** Every node with the preludes of the blocks that contain it, outermost first. */
export function* walk(
  nodes: CssNode[],
  ancestors: string[] = [],
): Generator<{ node: CssNode; ancestors: string[] }> {
  for (const node of nodes) {
    yield { node, ancestors };
    yield* walk(node.children, [...ancestors, node.prelude]);
  }
}

/** The CSS inside every `<style>` element of a Svelte file. */
export function styleBlocks(svelte: string): string[] {
  return [...svelte.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css);
}

/** Declared values per selector, flattening `@layer` blocks. Later rules of one selector merge. */
export function declarationsBySelector(css: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const { node } of walk(parseCss(css))) {
    if (!node.hasBlock || node.prelude.startsWith('@') || node.declarations.length === 0) continue;
    const properties = (result[node.prelude.replace(/\s+/g, ' ')] ??= {});
    for (const declaration of node.declarations) {
      const colon = declaration.indexOf(':');
      properties[declaration.slice(0, colon).trim()] = declaration
        .slice(colon + 1)
        .trim()
        .replace(/\s+/g, ' ');
    }
  }
  return result;
}
