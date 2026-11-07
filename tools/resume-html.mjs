#!/usr/bin/env node
// Turn a resume written in Shiro's Markdown format into the printable HTML template, for free,
// so the resume writer only writes the resume once (resume.md) instead of also typing out HTML.
//
//   node tools/resume-html.mjs <resume.md> <resume.html>      (both inside runs/ or memory/)
//
// Format the writer uses:
//   # Full Name
//   City, Country · email · phone · linkedin.com/in/x
//   ## Experience
//   ### **Job Title**, Company | Jan 2025 – Present
//   *City, Country*                      (optional; may also be "left | right")
//   - Bullet
//   ## Skills
//   **Languages:** Python, SQL

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED = ['runs', 'memory'].map((d) => path.join(ROOT, d));
const inside = (f) => ALLOWED.some((d) => f.startsWith(d + path.sep));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const emphasis = (s) => s
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
  .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');

// A link to a code repository (github.com/<owner>/<repo>…) always reads "GitHub", whether the
// writer gave it as [github.com/owner/repo](url) or as a bare URL. Profile links (github.com/<owner>)
// and links with real text are left alone.
const GITHUB_REPO = /^https?:\/\/(?:www\.)?github\.com\/[\w-]+\/[\w.-]+/i;
const BARE_GITHUB_REPO = /(?<![\w.\/@-])(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+\/[\w-]+(?:[.\/][\w-]+)*\/?/gi;

// Bare links become real (blue) links too: full URLs and emails anywhere, and on the contact line
// also scheme-less addresses like linkedin.com/in/name, github.com/name or name.pages.dev.
const BARE_URL = /(?<![\w"=\/])https?:\/\/[^\s<>()\u0000·|]+/gi;
const EMAIL = /(?<![\w.+-])[\w.+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const BARE_DOMAIN = /(?<![\w@.\/\u0000-])(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s<>()\u0000·|,]*)?/gi;
const trimEnd = (url) => { const m = url.match(/[.,;:!?]+$/); return m ? [url.slice(0, -m[0].length), m[0]] : [url, '']; };

function inline(s, { contact = false } = {}) {
  // Links become placeholders first, so emphasis rules never touch URLs (underscores in repo names).
  const links = [];
  const keep = (href, text) => { links.push(`<a href="${href}">${text}</a>`); return `\u0000${links.length - 1}\u0000`; };
  const bare = (re, toHref) => (str) => str.replace(re, (match) => {
    const [url, tail] = trimEnd(match);
    return keep(toHref(url), url) + tail;
  });
  let out = esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_, text, href) =>
      keep(href, GITHUB_REPO.test(href) && /github\.com\//i.test(text) ? 'GitHub' : emphasis(text)))
    .replace(BARE_GITHUB_REPO, (url) => keep(/^https?:/i.test(url) ? url : `https://${url}`, 'GitHub'));
  out = bare(BARE_URL, (u) => u)(out);
  out = bare(EMAIL, (u) => `mailto:${u}`)(out);
  if (contact) out = bare(BARE_DOMAIN, (u) => `https://${u}`)(out);
  return emphasis(out).replace(/\u0000(\d+)\u0000/g, (_, i) => links[i]);
}
const split = (s) => {
  const i = s.lastIndexOf(' | ');
  return i < 0 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 3).trim()];
};
const row = (cls, text) => {
  const [l, r] = split(text);
  return `<div class="row${cls ? ` ${cls}` : ''}"><span>${inline(l)}</span>${r ? `<span>${inline(r)}</span>` : ''}</div>`;
};

export function resumeMarkdownToHtml(md, template) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  let html = '';
  let name = 'Resume';
  let inSection = false;
  let inEntry = false;
  let inList = false;
  let afterHeading = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  const closeEntry = () => { closeList(); if (inEntry) { html += '</div>'; inEntry = false; } };
  const closeSection = () => { closeEntry(); if (inSection) { html += '</section>'; inSection = false; } };
  let header = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }
    let m;
    if ((m = line.match(/^#\s+(.+)$/))) {
      name = m[1].replace(/[*_]/g, '').trim();
      html += `<header><h1>${inline(m[1])}</h1>`;
      header = true;
      continue;
    }
    if (header && !/^#{2,3}\s/.test(line)) {
      html += `<p class="contact">${inline(line.trim(), { contact: true })}</p>`;
      continue;
    }
    if (header) { html += '</header>'; header = false; }
    if ((m = line.match(/^##\s+(.+)$/))) {
      closeSection();
      html += `<section><h2>${inline(m[1])}</h2>`;
      inSection = true;
      continue;
    }
    if ((m = line.match(/^###\s+(.+)$/))) {
      closeEntry();
      html += `<div class="entry">${row('', m[1])}`;
      inEntry = true;
      afterHeading = true;
      continue;
    }
    if (afterHeading && /^\s*[*_][^*_].*[*_]\s*$/.test(line) && !/^\s*[-*]\s/.test(line)) {
      html += row('meta', line.trim().replace(/^[*_]|[*_]$/g, ''));
      afterHeading = false;
      continue;
    }
    afterHeading = false;
    if ((m = line.match(/^\s*[-•]\s+(.+)$/))) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(m[1])}</li>`;
      continue;
    }
    closeList();
    html += `<p>${inline(line.trim())}</p>`;
  }
  if (header) html += '</header>';
  closeSection();
  return template
    .replace('<!-- RESUME_CONTENT -->', html)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(name)} — Resume</title>`);
}

export function convertFile(input, output) {
  const src = path.resolve(ROOT, input);
  const out = path.resolve(ROOT, output);
  if (!inside(src) || !inside(out)) throw new Error('Both files must be inside runs/ or memory/.');
  const template = fs.readFileSync(path.join(ROOT, 'templates', 'resume.html'), 'utf8');
  fs.writeFileSync(out, resumeMarkdownToHtml(fs.readFileSync(src, 'utf8'), template));
  return path.relative(ROOT, out).split(path.sep).join('/');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) { console.error('Usage: node tools/resume-html.mjs <resume.md> <resume.html>'); process.exit(2); }
  try { console.log(`Saved ${convertFile(input, output)}`); } catch (e) { console.error(e.message); process.exit(1); }
}
