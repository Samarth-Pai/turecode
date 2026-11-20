import type { CodingTestCase } from "./types";

export interface ParsedZipTestCasePair {
  key: string;
  inputFileName: string;
  outputFileName: string;
  input: string;
  expectedOutput: string;
}

export interface ZipParseReport {
  testCases: CodingTestCase[];
  pairs: ParsedZipTestCasePair[];
  unmatchedFiles: string[];
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream is not supported in this environment.");
  }
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  writer.write(copy);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }

  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return out;
}

/**
 * Extracts all text files from a standard ZIP archive buffer using the Central Directory.
 * Supports method 0 (STORE) and method 8 (DEFLATE).
 */
export async function extractZipTextEntries(
  buffer: ArrayBuffer
): Promise<Map<string, string>> {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("utf-8");

  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  const minEocdOffset = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minEocdOffset; i--) {
    if (readU32LE(bytes, i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error("Invalid ZIP archive: End of Central Directory signature not found.");
  }

  const totalEntries = readU16LE(bytes, eocdOffset + 10);
  const cdOffset = readU32LE(bytes, eocdOffset + 16);

  const entries = new Map<string, string>();
  let ptr = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (ptr + 46 > bytes.length || readU32LE(bytes, ptr) !== 0x02014b50) {
      break;
    }

    const compressionMethod = readU16LE(bytes, ptr + 10);
    const compressedSize = readU32LE(bytes, ptr + 20);
    const fileNameLen = readU16LE(bytes, ptr + 28);
    const extraLen = readU16LE(bytes, ptr + 30);
    const commentLen = readU16LE(bytes, ptr + 32);
    const localHeaderOffset = readU32LE(bytes, ptr + 42);

    const fileName = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + fileNameLen));
    ptr += 46 + fileNameLen + extraLen + commentLen;

    // Skip directories and macOS / hidden metadata files
    if (
      fileName.endsWith("/") ||
      fileName.includes("__MACOSX/") ||
      fileName.split("/").some((part) => part.startsWith("."))
    ) {
      continue;
    }

    if (
      localHeaderOffset + 30 > bytes.length ||
      readU32LE(bytes, localHeaderOffset) !== 0x04034b50
    ) {
      throw new Error(`Corrupt local file header for "${fileName}".`);
    }

    const localNameLen = readU16LE(bytes, localHeaderOffset + 26);
    const localExtraLen = readU16LE(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > bytes.length) {
      throw new Error(`Truncated ZIP entry data for "${fileName}".`);
    }

    const rawSlice = bytes.subarray(dataStart, dataEnd);
    let fileBytes: Uint8Array;
    if (compressionMethod === 0) {
      fileBytes = rawSlice;
    } else if (compressionMethod === 8) {
      fileBytes = await inflateRaw(rawSlice);
    } else {
      throw new Error(
        `Unsupported ZIP compression method (${compressionMethod}) in "${fileName}". Use Standard Deflate or Store.`
      );
    }

    entries.set(fileName, decoder.decode(fileBytes).replace(/\r\n/g, "\n"));
  }

  return entries;
}

/**
 * Classifies a file path inside a HackerRank test case ZIP as an input or output file
 * and extracts its pairing key (e.g. "00" from "input/input00.txt" or "output00.text").
 */
function classifyTestCaseFile(
  fullPath: string
): { role: "input" | "output"; key: string; baseName: string } | null {
  const normalized = fullPath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const baseName = parts[parts.length - 1] ?? "";
  const parentDir = (parts[parts.length - 2] ?? "").toLowerCase();

  // Pattern 1: input00.txt, input_00.text, in00.txt, output00.txt, output00.text, out00.txt
  const prefixMatch = baseName.match(
    /^(input|in|output|out)[-_.]?([0-9]+)(?:\.(?:txt|text|in|out|dat))?$/i
  );
  if (prefixMatch) {
    const tag = prefixMatch[1].toLowerCase();
    const role = tag === "input" || tag === "in" ? "input" : "output";
    return { role, key: prefixMatch[2], baseName };
  }

  // Pattern 2: 00.in / 00.out or testcase00.in / testcase00.out
  const extMatch = baseName.match(/^(?:testcase|tc|case)?[-_.]?([0-9]+)\.(in|out)$/i);
  if (extMatch) {
    const role = extMatch[2].toLowerCase() === "in" ? "input" : "output";
    return { role, key: extMatch[1], baseName };
  }

  // Pattern 3: input/00.txt and output/00.txt
  if (parentDir === "input" || parentDir === "inputs" || parentDir === "in") {
    const numMatch = baseName.match(/^([0-9]+)(?:\.(?:txt|text|in|dat))?$/i);
    if (numMatch) {
      return { role: "input", key: numMatch[1], baseName };
    }
  }
  if (parentDir === "output" || parentDir === "outputs" || parentDir === "out") {
    const numMatch = baseName.match(/^([0-9]+)(?:\.(?:txt|text|out|dat))?$/i);
    if (numMatch) {
      return { role: "output", key: numMatch[1], baseName };
    }
  }

  return null;
}

/**
 * Parses a HackerRank-style test case ZIP buffer containing files such as:
 * - `input00.txt` / `output00.txt` (or `output00.text`)
 * - `input/input00.txt` / `output/output00.txt`
 * - `00.in` / `00.out`
 */
export async function parseHackerRankTestCaseZip(
  buffer: ArrayBuffer,
  options?: {
    sampleCount?: number;
    pointsPerCase?: number;
  }
): Promise<ZipParseReport> {
  const sampleCount = options?.sampleCount ?? 1;
  const pointsPerCase = options?.pointsPerCase ?? 25;

  const entries = await extractZipTextEntries(buffer);
  const buckets = new Map<
    string,
    {
      key: string;
      input?: { name: string; content: string };
      output?: { name: string; content: string };
    }
  >();
  const unmatchedFiles: string[] = [];

  for (const [filePath, content] of entries.entries()) {
    const info = classifyTestCaseFile(filePath);
    if (!info) {
      unmatchedFiles.push(filePath);
      continue;
    }

    // Normalize numeric key for pairing while preserving display label
    const normKey = String(Number.parseInt(info.key, 10));
    const bucket = buckets.get(normKey) ?? { key: info.key };
    if (info.key.length > bucket.key.length) {
      bucket.key = info.key;
    }
    if (info.role === "input") {
      bucket.input = { name: filePath, content };
    } else {
      bucket.output = { name: filePath, content };
    }
    buckets.set(normKey, bucket);
  }

  const sortedKeys = [...buckets.keys()].sort(
    (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
  );

  const pairs: ParsedZipTestCasePair[] = [];
  for (const normKey of sortedKeys) {
    const b = buckets.get(normKey)!;
    if (b.input && b.output) {
      pairs.push({
        key: b.key,
        inputFileName: b.input.name,
        outputFileName: b.output.name,
        input: b.input.content,
        expectedOutput: b.output.content.trimEnd(),
      });
    } else {
      if (b.input) unmatchedFiles.push(`${b.input.name} (missing matching output${b.key})`);
      if (b.output) unmatchedFiles.push(`${b.output.name} (missing matching input${b.key})`);
    }
  }

  if (pairs.length === 0) {
    throw new Error(
      "No matching input/output pairs found in ZIP. Expected files like input00.txt & output00.txt (or input/input00.txt & output/output00.txt)."
    );
  }

  const now = Date.now();
  const testCases: CodingTestCase[] = pairs.map((pair, idx) => ({
    id: `tc-zip-${now}-${idx}`,
    input: pair.input.endsWith("\n") ? pair.input : `${pair.input}\n`,
    expectedOutput: pair.expectedOutput,
    isSample: idx < sampleCount,
    points: pointsPerCase,
    explanation: idx < sampleCount ? `Sample case imported from ${pair.inputFileName}` : undefined,
  }));

  return { testCases, pairs, unmatchedFiles };
}

// CRC-32 lookup table for generating a downloadable sample ZIP in the browser
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16LE(buf: Uint8Array, offset: number, val: number) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function writeU32LE(buf: Uint8Array, offset: number, val: number) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

/**
 * Builds a valid HackerRank-format sample ZIP (`input/input00.txt`, `output/output00.txt`, etc.)
 * using STORE (method 0) so moderators can download a template archive immediately.
 */
export function buildSampleHackerRankZip(): Uint8Array {
  const encoder = new TextEncoder();
  const files: { name: string; content: string }[] = [
    { name: "input/input00.txt", content: "5\n1 2 3 4 5\n" },
    { name: "output/output00.txt", content: "15\n" },
    { name: "input/input01.txt", content: "3\n10 20 30\n" },
    { name: "output/output01.txt", content: "60\n" },
    { name: "input/input02.txt", content: "4\n-5 5 -10 10\n" },
    { name: "output/output02.txt", content: "0\n" },
  ];

  const localParts: Uint8Array[] = [];
  const cdParts: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = encoder.encode(f.content);
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    writeU32LE(localHeader, 0, 0x04034b50);
    writeU16LE(localHeader, 4, 20); // version needed
    writeU16LE(localHeader, 6, 0); // flags
    writeU16LE(localHeader, 8, 0); // method 0 = STORE
    writeU16LE(localHeader, 10, 0);
    writeU16LE(localHeader, 12, 0);
    writeU32LE(localHeader, 14, crc);
    writeU32LE(localHeader, 18, dataBytes.length);
    writeU32LE(localHeader, 22, dataBytes.length);
    writeU16LE(localHeader, 26, nameBytes.length);
    writeU16LE(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);
    localHeader.set(dataBytes, 30 + nameBytes.length);
    localParts.push(localHeader);

    const cdHeader = new Uint8Array(46 + nameBytes.length);
    writeU32LE(cdHeader, 0, 0x02014b50);
    writeU16LE(cdHeader, 4, 20);
    writeU16LE(cdHeader, 6, 20);
    writeU16LE(cdHeader, 8, 0);
    writeU16LE(cdHeader, 10, 0);
    writeU16LE(cdHeader, 12, 0);
    writeU16LE(cdHeader, 14, 0);
    writeU32LE(cdHeader, 16, crc);
    writeU32LE(cdHeader, 20, dataBytes.length);
    writeU32LE(cdHeader, 24, dataBytes.length);
    writeU16LE(cdHeader, 28, nameBytes.length);
    writeU16LE(cdHeader, 30, 0);
    writeU16LE(cdHeader, 32, 0);
    writeU16LE(cdHeader, 34, 0);
    writeU16LE(cdHeader, 36, 0);
    writeU32LE(cdHeader, 38, 0);
    writeU32LE(cdHeader, 42, offset);
    cdHeader.set(nameBytes, 46);
    cdParts.push(cdHeader);

    offset += localHeader.length;
  }

  const cdSize = cdParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  writeU32LE(eocd, 0, 0x06054b50);
  writeU16LE(eocd, 4, 0);
  writeU16LE(eocd, 6, 0);
  writeU16LE(eocd, 8, files.length);
  writeU16LE(eocd, 10, files.length);
  writeU32LE(eocd, 12, cdSize);
  writeU32LE(eocd, 16, offset);
  writeU16LE(eocd, 20, 0);

  const totalSize = offset + cdSize + eocd.length;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of localParts) {
    out.set(part, pos);
    pos += part.length;
  }
  for (const part of cdParts) {
    out.set(part, pos);
    pos += part.length;
  }
  out.set(eocd, pos);
  return out;
}
