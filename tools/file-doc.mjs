#!/usr/bin/env node
// Move documents into their section of the career memory. Used by /remember when it files documents.
//
//   node tools/file-doc.mjs <file> <section>[/<new-name>] [<file> <section>[/<new-name>] ...]
//
// Sections: certificates, academic, letters, portfolio, cover-letters, other, duplicates
//           → memory/documents/<section>/
//           resumes → memory/resume/
// Only moves files that are already inside memory/. Never overwrites (adds -2, -3 … instead).
// Prints one line per file: "<old path> -> <new path>".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEMORY = path.join(ROOT, 'memory');
export const SECTIONS = ['certificates', 'academic', 'letters', 'portfolio', 'cover-letters', 'other', 'duplicates', 'resumes'];

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

export function fileDoc(from, target) {
  const src = path.resolve(ROOT, from);
  if (!src.startsWith(MEMORY + path.sep)) throw new Error(`${from}: only files inside memory/ can be moved`);
  if (!fs.existsSync(src) || fs.statSync(src).isDirectory()) throw new Error(`${from}: no such file`);

  const [section, ...rest] = String(target).split('/');
  if (!SECTIONS.includes(section)) throw new Error(`${target}: section must be one of ${SECTIONS.join(', ')}`);
  const dir = section === 'resumes' ? path.join(MEMORY, 'resume') : path.join(MEMORY, 'documents', section);

  const ext = path.extname(src).toLowerCase();
  const wanted = rest.join('-') || path.basename(src);
  const stem = path.basename(wanted, path.extname(wanted)).toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^[-.]+|-+$/g, '').slice(0, 90) || 'document';

  fs.mkdirSync(dir, { recursive: true });
  let dest = path.join(dir, `${stem}${ext}`);
  if (dest === src) return rel(dest);
  for (let i = 2; fs.existsSync(dest); i++) dest = path.join(dir, `${stem}-${i}${ext}`);
  fs.renameSync(src, dest);
  return rel(dest);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const args = process.argv.slice(2);
  if (!args.length || args.length % 2) {
    console.error('Usage: node tools/file-doc.mjs <file> <section>[/<new-name>] [<file> <section>[/<new-name>] ...]');
    console.error(`Sections: ${SECTIONS.join(', ')}`);
    process.exit(2);
  }
  let failed = 0;
  for (let i = 0; i < args.length; i += 2) {
    try {
      console.log(`${args[i]} -> ${fileDoc(args[i], args[i + 1])}`);
    } catch (err) {
      failed++;
      console.error(`FAILED ${err.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
