/**
 * Social networks only accept plain text, so "bold" and "italic" are done with look-alike
 * Unicode letters (like 𝗯𝗼𝗹𝗱). Underline and strikethrough use combining marks.
 * This file turns the editor document into that final plain text, and counts characters.
 */

export type DocNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: DocNode[];
};

// Mathematical Sans-Serif alphabets (start code points)
const BOLD = { up: 0x1d5d4, low: 0x1d5ee, digit: 0x1d7ec };
const ITALIC = { up: 0x1d608, low: 0x1d622 };
const BOLD_ITALIC = { up: 0x1d63c, low: 0x1d656 };
const COMBINING_UNDERLINE = "̲";
const COMBINING_STRIKE = "̶";

/** Swap A-Z, a-z (and 0-9 for bold) for styled look-alikes. Other characters stay as they are. */
export function styleLetters(
  text: string,
  bold: boolean,
  italic: boolean,
): string {
  if (!bold && !italic) return text;
  const set = bold && italic ? BOLD_ITALIC : bold ? BOLD : ITALIC;
  let out = "";
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c >= 65 && c <= 90) out += String.fromCodePoint(set.up + (c - 65));
    else if (c >= 97 && c <= 122)
      out += String.fromCodePoint(set.low + (c - 97));
    else if (c >= 48 && c <= 57 && bold)
      out += String.fromCodePoint(BOLD.digit + (c - 48));
    else out += ch;
  }
  return out;
}

/** Add a line under or through every visible character (spaces are left alone). */
export function decorate(
  text: string,
  underline: boolean,
  strike: boolean,
): string {
  if (!underline && !strike) return text;
  let out = "";
  for (const ch of text) {
    out += ch;
    if (/\s/.test(ch)) continue;
    if (underline) out += COMBINING_UNDERLINE;
    if (strike) out += COMBINING_STRIKE;
  }
  return out;
}

const hasMark = (n: DocNode, type: string) =>
  n.marks?.some((m) => m.type === type) ?? false;
const linkHref = (n: DocNode) => {
  const href = n.marks?.find((m) => m.type === "link")?.attrs?.href;
  return typeof href === "string" ? href : null;
};
const stripScheme = (s: string) =>
  s.replace(/^https?:\/\//i, "").replace(/\/$/, "");

/** Text of one paragraph. A link becomes "label (url)", or just the url when the label is the url. */
function inlineToText(nodes: DocNode[] = []): string {
  let out = "";
  let href: string | null = null;
  let label = "";

  const closeLink = () => {
    if (href && stripScheme(label.trim()) !== stripScheme(href))
      out += ` (${href})`;
    href = null;
    label = "";
  };

  for (const node of nodes) {
    if (node.type === "hardBreak") {
      closeLink();
      out += "\n";
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const nodeHref = linkHref(node);
    if (nodeHref !== href) {
      closeLink();
      href = nodeHref;
    }
    if (href) label += node.text;
    const styled = styleLetters(
      node.text,
      hasMark(node, "bold"),
      hasMark(node, "italic"),
    );
    out += decorate(
      styled,
      hasMark(node, "underline"),
      hasMark(node, "strike"),
    );
  }
  closeLink();
  return out;
}

function blockToLines(node: DocNode, depth = 0): string[] {
  const indent = "  ".repeat(depth);
  switch (node.type) {
    case "bulletList":
    case "orderedList": {
      const lines: string[] = [];
      (node.content ?? []).forEach((item, i) => {
        const marker = node.type === "orderedList" ? `${i + 1}. ` : "• ";
        let first = true;
        for (const child of item.content ?? []) {
          if (child.type === "bulletList" || child.type === "orderedList") {
            lines.push(...blockToLines(child, depth + 1));
          } else {
            const text = inlineToText(child.content);
            lines.push(
              first ? `${indent}${marker}${text}` : `${indent}  ${text}`,
            );
            first = false;
          }
        }
      });
      return lines;
    }
    case "paragraph":
      return [inlineToText(node.content)];
    default:
      return node.content ? [inlineToText(node.content)] : [];
  }
}

/** Editor document -> the exact text that will be posted. */
export function docToText(doc: DocNode | null | undefined): string {
  if (!doc?.content) return "";
  return doc.content
    .flatMap((block) => blockToLines(block))
    .join("\n")
    .replace(/\s+$/, "");
}

/** Plain text -> editor document (one paragraph per line, so blank lines are kept). */
export function textToDoc(text: string): DocNode {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return {
    type: "doc",
    content: lines.map((line) =>
      line
        ? { type: "paragraph", content: [{ type: "text", text: line }] }
        : { type: "paragraph" },
    ),
  };
}

// ---------------------------------------------------------------------------
// Character counting (approximate: networks differ in small ways)
// ---------------------------------------------------------------------------
const URL_RE = /https?:\/\/\S+/g;

function graphemeCount(text: string): number {
  const Seg = (
    Intl as unknown as {
      Segmenter?: new (
        l?: string,
        o?: object,
      ) => { segment(s: string): Iterable<unknown> };
    }
  ).Segmenter;
  if (!Seg) return [...text].length;
  let n = 0;
  for (const _ of new Seg(undefined, { granularity: "grapheme" }).segment(
    text,
  )) {
    void _;
    n += 1;
  }
  return n;
}

/**
 * Styled letters live outside the basic range, so most networks count each as 2 characters
 * (JavaScript's string length does the same). Bluesky counts what you see, so it counts 1.
 */
export function countCharacters(serviceKey: string, text: string): number {
  if (serviceKey === "bluesky") return graphemeCount(text);
  if (serviceKey === "twitter")
    return text.replace(URL_RE, "x".repeat(23)).length;
  if (serviceKey === "instagram")
    return text.length + (text.match(/\n/g)?.length ?? 0);
  return text.length;
}

/** True when the text uses any styled letters or line marks. */
export function usesStyledText(text: string): boolean {
  // eslint-disable-next-line no-misleading-character-class
  return /[\u{1D5D4}-\u{1D66F}\u{1D7EC}-\u{1D7F5}̶̲]/u.test(text);
}
