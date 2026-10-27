// A small CSS block scanner for the stylesheet invariant tests (stylesheets.test.ts, tokens.test.ts, contrast.test.ts).
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

/** The one hover query: a pointer that hovers and is fine, optionally negated as a whole. */
export const HOVER_QUERY =
  /^@media (?:\(hover: hover\) and \(pointer: fine\)|not \(\(hover: hover\) and \(pointer: fine\)\))$/;

/** Breaches of the cascade-layer and media-query rules, as messages; empty when the CSS is clean. */
export function styleViolations(nodes: CssNode[]): string[] {
  const violations: string[] = [];
  for (const { node, ancestors } of walk(nodes)) {
    const { prelude } = node;
    // A nested @layer makes a sublayer (components.a11y) that ranks below the top-level layers.
    if (prelude.startsWith('@layer') && ancestors.length > 0) {
      violations.push(`nested layer: ${prelude}`);
    }
    if (
      /^@media.*(forced-colors|prefers-contrast)/.test(prelude) &&
      ancestors[0] !== '@layer a11y'
    ) {
      violations.push(`outside @layer a11y: ${prelude}`);
    }
    if (prelude.startsWith('@media') && /\bhover\b/.test(prelude) && !HOVER_QUERY.test(prelude)) {
      violations.push(`hover query: ${prelude}`);
    }
    if (
      node.hasBlock &&
      !prelude.startsWith('@') &&
      prelude.includes(':hover') &&
      !ancestors.some((ancestor) => HOVER_QUERY.test(ancestor))
    ) {
      violations.push(`:hover outside the hover query: ${prelude}`);
    }
  }
  return violations;
}
