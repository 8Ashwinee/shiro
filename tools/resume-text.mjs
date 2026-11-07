#!/usr/bin/env node
// Extract plain text from a resume or document, for free, with tools already on the computer,
// so agents read text instead of PDF page images (much cheaper, and it's what an ATS sees).
//
//   node tools/resume-text.mjs <file>        prints the text
//
// cachedText() keeps the result in <folder>/.text/<file>.txt and reuses it until the file changes.
// Returns null when no local tool can read the file; the caller can then fall back to Claude once.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = (cmd, args) => new Promise((resolve) => {
  execFile(cmd, args, { maxBuffer: 20 * 1024 * 1024, windowsHide: true, timeout: 60000 }, (err, stdout) => resolve(err ? null : String(stdout)));
});

function candidates(name) {
  const list = [name];
  if (process.platform === 'win32') {
    const pf = process.env.PROGRAMFILES || 'C:\\Program Files';
    if (name === 'pdftotext') list.push(`${pf}\\Git\\mingw64\\bin\\pdftotext.exe`, `${pf}\\Git\\usr\\bin\\pdftotext.exe`);
    if (name === 'python') list.push('py');
  } else if (name === 'python') {
    list.unshift('python3');
  }
  return list;
}

async function tryEach(name, args) {
  for (const cmd of candidates(name)) {
    const out = await run(cmd, args);
    if (out && out.trim().length > 40) return out;
  }
  return null;
}

const PY_PDF = 'import sys\nfrom pypdf import PdfReader\nprint("\\n".join((p.extract_text() or "") for p in PdfReader(sys.argv[1]).pages))';
const PY_DOCX = 'import sys,zipfile,re\nx=zipfile.ZipFile(sys.argv[1]).read("word/document.xml").decode("utf8")\nx=re.sub(r"</w:p>","\\n",x)\nprint(re.sub(r"<[^>]+>","",x))';

const clean = (s) => s.replace(/\r\n?/g, '\n').replace(/\f/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export async function extractText(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.txt' || ext === '.md') return clean(fs.readFileSync(file, 'utf8'));
  if (ext === '.html' || ext === '.htm') {
    const html = fs.readFileSync(file, 'utf8')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|header)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
    return clean(html);
  }
  if (ext === '.pdf') {
    const out = (await tryEach('pdftotext', ['-enc', 'UTF-8', file, '-'])) || (await tryEach('python', ['-c', PY_PDF, file]));
    return out ? clean(out) : null;
  }
  if (ext === '.docx') {
    const out = await tryEach('python', ['-c', PY_DOCX, file]);
    return out ? clean(out) : null;
  }
  return null;
}

export function cachePath(file) {
  return path.join(path.dirname(file), '.text', `${path.basename(file)}.txt`);
}

export function readCache(file) {
  const c = cachePath(file);
  try {
    if (fs.statSync(c).mtimeMs >= fs.statSync(file).mtimeMs) return fs.readFileSync(c, 'utf8');
  } catch { /* no cache yet */ }
  return null;
}

export function writeCache(file, text) {
  const c = cachePath(file);
  fs.mkdirSync(path.dirname(c), { recursive: true });
  fs.writeFileSync(c, text);
}

export async function cachedText(file) {
  const hit = readCache(file);
  if (hit) return hit;
  const text = await extractText(file);
  if (text) writeCache(file, text);
  return text;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node tools/resume-text.mjs <file>'); process.exit(2); }
  const text = await cachedText(path.resolve(file));
  if (!text) { console.error('No local tool could read this file.'); process.exit(1); }
  process.stdout.write(`${text}\n`);
}
