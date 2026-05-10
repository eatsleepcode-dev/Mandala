export type FrontmatterMeta = Record<string, string | number | boolean | string[]>;

export interface ParsedFile {
  meta: FrontmatterMeta;
  body: string;
}

const FENCE_RE = /^---[ \t]*$/;

function parseValue(raw: string): string | number | boolean | string[] {
  const trimmed = raw.trim();

  // Inline array: [a, b, c]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1);
    return inner
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter((s) => s.length > 0);
  }

  // Quoted string
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== '') return num;

  return trimmed;
}

export function parseFrontmatter(content: string): ParsedFile {
  // Normalise line endings
  const text = content.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  if (!FENCE_RE.test(lines[0])) {
    return { meta: {}, body: text.trim() };
  }

  const closeIdx = lines.findIndex((l, i) => i > 0 && FENCE_RE.test(l));
  if (closeIdx === -1) {
    return { meta: {}, body: text.trim() };
  }

  const meta: FrontmatterMeta = {};
  for (let i = 1; i < closeIdx; i++) {
    const colonIdx = lines[i].indexOf(':');
    if (colonIdx === -1) continue;
    const key = lines[i].slice(0, colonIdx).trim();
    const val = lines[i].slice(colonIdx + 1).trim();
    if (key) meta[key] = parseValue(val);
  }

  const body = lines.slice(closeIdx + 1).join('\n').trim();
  return { meta, body };
}

function serializeValue(val: string | number | boolean | string[]): string {
  if (Array.isArray(val)) {
    return `[${val.join(', ')}]`;
  }
  if (typeof val === 'string' && val.includes(':')) {
    return `"${val}"`;
  }
  return String(val);
}

export function serializeFrontmatter(
  meta: FrontmatterMeta,
  body: string
): string {
  const lines = ['---'];
  for (const [key, val] of Object.entries(meta)) {
    lines.push(`${key}: ${serializeValue(val)}`);
  }
  lines.push('---');
  if (body) lines.push(body);
  return lines.join('\n');
}
