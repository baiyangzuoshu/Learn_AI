import { inflateSync } from "node:zlib";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_OUTPUT_CHARS = 200_000;

type PdfArray = Array<PdfToken>;
type PdfToken = string | PdfArray | { kind: "text"; value: string };

const definition = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ToolDefinition => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

function safePath(workspace: string, requested: string): string {
  const root = resolve(workspace);
  const path = resolve(root, requested);
  const rel = relative(root, path);
  if (rel === ".." || rel.startsWith(`..\\`) || rel.startsWith(`../`) || isAbsolute(rel)) {
    throw new Error(`Path escapes workspace: ${requested}`);
  }
  return path;
}

function decodeBytes(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const littleEndian = new Uint8Array(bytes.length - 2);
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      littleEndian[index - 2] = bytes[index + 1];
      littleEndian[index - 1] = bytes[index];
    }
    return Buffer.from(littleEndian).toString("utf16le");
  }
  const buffer = Buffer.from(bytes);
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("�")) return utf8;
  return buffer.toString("latin1");
}

function readLiteral(source: string, start: number): { value: string; next: number } {
  let index = start + 1;
  let depth = 1;
  const bytes: number[] = [];
  while (index < source.length && depth > 0) {
    const char = source[index++];
    if (char === "\\") {
      if (index >= source.length) break;
      const escaped = source[index++];
      const escapes: Record<string, number> = {
        n: 0x0a,
        r: 0x0d,
        t: 0x09,
        b: 0x08,
        f: 0x0c,
      };
      if (escapes[escaped] !== undefined) {
        bytes.push(escapes[escaped]);
      } else if (/[0-7]/.test(escaped)) {
        let octal = escaped;
        while (octal.length < 3 && index < source.length && /[0-7]/.test(source[index])) {
          octal += source[index++];
        }
        bytes.push(parseInt(octal, 8));
      } else if (escaped !== "\r" && escaped !== "\n") {
        bytes.push(escaped.charCodeAt(0));
      }
      continue;
    }
    if (char === "(") {
      depth++;
      bytes.push(char.charCodeAt(0));
    } else if (char === ")") {
      depth--;
      if (depth > 0) bytes.push(char.charCodeAt(0));
    } else {
      bytes.push(char.charCodeAt(0));
    }
  }
  return { value: decodeBytes(Uint8Array.from(bytes)), next: index };
}

function readHex(source: string, start: number): { value: string; next: number } {
  const end = source.indexOf(">", start + 1);
  if (end < 0) return { value: "", next: source.length };
  const hex = source.slice(start + 1, end).replace(/\s/g, "");
  const normalized = hex.length % 2 === 0 ? hex : `${hex}0`;
  return { value: decodeBytes(Buffer.from(normalized, "hex")), next: end + 1 };
}

function tokenize(source: string, start = 0, stopAtArrayEnd = false): { tokens: PdfToken[]; next: number } {
  const tokens: PdfToken[] = [];
  let index = start;
  while (index < source.length) {
    while (/\s/.test(source[index] ?? "")) index++;
    if (source[index] === "%") {
      const lineEnd = source.indexOf("\n", index);
      index = lineEnd < 0 ? source.length : lineEnd + 1;
      continue;
    }
    if (source[index] === "]") {
      return { tokens, next: stopAtArrayEnd ? index + 1 : index };
    }
    if (source[index] === "[") {
      const array = tokenize(source, index + 1, true);
      tokens.push(array.tokens);
      index = array.next;
      continue;
    }
    if (source[index] === "(") {
      const literal = readLiteral(source, index);
      tokens.push({ kind: "text", value: literal.value });
      index = literal.next;
      continue;
    }
    if (source[index] === "<" && source[index + 1] !== "<") {
      const hex = readHex(source, index);
      tokens.push({ kind: "text", value: hex.value });
      index = hex.next;
      continue;
    }
    const tokenStart = index;
    while (index < source.length && !/[\s()[\]<>%]/.test(source[index])) index++;
    if (tokenStart === index) {
      index++;
      continue;
    }
    tokens.push(source.slice(tokenStart, index));
  }
  return { tokens, next: index };
}

function textFromTokens(tokens: PdfToken[]): string {
  const output: string[] = [];
  const textValue = (token: PdfToken): string => {
    if (typeof token === "object" && !Array.isArray(token)) return token.value;
    if (Array.isArray(token)) return token.map(textValue).join("");
    return "";
  };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === "Tj" || token === "TJ" || token === "'" || token === '"') {
      const value = textValue(tokens[index - 1] ?? "");
      if (value) output.push(value);
      if (token === "'" || token === '"') output.push("\n");
    } else if (token === "T*" || token === "Td" || token === "TD") {
      if (output.length && !output[output.length - 1].endsWith("\n")) output.push("\n");
    }
  }
  return output.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractInfo(source: string): Record<string, string> {
  const info: Record<string, string> = {};
  for (const key of ["Title", "Author", "Subject", "Creator", "Producer", "CreationDate"]) {
    const marker = source.indexOf(`/${key}`);
    if (marker < 0) continue;
    let index = marker + key.length + 1;
    while (/\s/.test(source[index] ?? "")) index++;
    if (source[index] === "(") info[key] = readLiteral(source, index).value;
    else if (source[index] === "<" && source[index + 1] !== "<") info[key] = readHex(source, index).value;
  }
  return info;
}

function extractPdf(sourceBytes: Uint8Array): { pages: number; text: string; metadata: Record<string, string> } {
  const source = Buffer.from(sourceBytes).toString("latin1");
  const streams: string[] = [];
  const streamPattern = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of source.matchAll(streamPattern)) {
    const dictionary = match[1] ?? "";
    const raw = Buffer.from(match[2] ?? "", "latin1");
    let decoded: Uint8Array<ArrayBufferLike> = raw;
    if (/\/Filter\s*(?:\[\s*)?\/FlateDecode\b/.test(dictionary)) {
      try {
        decoded = inflateSync(raw);
      } catch {
        continue;
      }
    } else if (/\/Filter\b/.test(dictionary)) {
      continue;
    }
    streams.push(Buffer.from(decoded).toString("latin1"));
  }
  const text = streams.map((stream) => textFromTokens(tokenize(stream).tokens)).filter(Boolean).join("\n\n");
  const pages = (source.match(/\/Type\s*\/Page\b/g) ?? []).length;
  return { pages, text, metadata: extractInfo(source) };
}

function limitText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: `${text.slice(0, maxChars)}\n\n[output truncated]`, truncated: true };
}

export const pdfReader: HarnessFeature = {
  id: "pdf-reader",
  register({ tools, prompts }) {
    tools.register(
      definition(
        "read_pdf",
        "Read text and metadata from a PDF file inside the active workspace. Scanned PDFs may require OCR.",
        {
          path: { type: "string", description: "PDF path relative to the active workspace" },
          max_chars: { type: "number", description: "Maximum returned text length, capped at 200000" },
          include_metadata: { type: "boolean", description: "Whether to include PDF metadata" },
        },
        ["path"],
      ),
      async (input, context) => {
        const requested = String(input.path ?? "").trim();
        if (!requested.toLowerCase().endsWith(".pdf")) throw new Error("read_pdf requires a .pdf file");
        const path = safePath(context.workspace, requested);
        const file = await stat(path);
        if (!file.isFile()) throw new Error(`PDF path is not a file: ${requested}`);
        if (file.size > MAX_PDF_BYTES) {
          throw new Error(`PDF is too large (${file.size} bytes; maximum is ${MAX_PDF_BYTES} bytes)`);
        }
        if (context.signal?.aborted) throw new DOMException("PDF read stopped", "AbortError");
        const parsed = extractPdf(await readFile(path, context.signal ? { signal: context.signal } : undefined));
        const maxChars = Math.min(
          MAX_OUTPUT_CHARS,
          Math.max(1_000, Number.isFinite(Number(input.max_chars)) ? Number(input.max_chars) : 100_000),
        );
        const limited = limitText(parsed.text, maxChars);
        const result: Record<string, unknown> = {
          path: requested,
          pages: parsed.pages,
          text: limited.text,
          truncated: limited.truncated,
          warning: parsed.text
            ? undefined
            : "No extractable page text found. The PDF may be scanned, use embedded fonts, or store content only in metadata; OCR may be required.",
        };
        if (input.include_metadata !== false) result.metadata = parsed.metadata;
        return JSON.stringify(result);
      },
    );
    prompts.register({
      id: "pdf-reader",
      title: "PDF reading",
      priority: 25,
      content:
        "Use read_pdf for workspace PDFs before making claims about their contents. Quote or summarize only extracted text and metadata, and disclose when OCR or visual inspection may be needed.",
    });
  },
};
