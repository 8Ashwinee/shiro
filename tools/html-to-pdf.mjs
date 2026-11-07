#!/usr/bin/env node
// Turn a Shiro HTML page (a resume or cover letter) into a PDF, using the Chrome or Edge
// already installed on this computer. No tokens, no internet.
//
//   node tools/html-to-pdf.mjs <input.html> <output.pdf>
//
// Both files must be inside runs/ or memory/. Set SHIRO_BROWSER to a browser path to override.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED_DIRS = ['runs', 'memory'].map((d) => path.join(ROOT, d));
const inside = (f) => ALLOWED_DIRS.some((d) => f.startsWith(d + path.sep));

export function findBrowser() {
  const override = process.env.SHIRO_BROWSER;
  if (override && fs.existsSync(override)) return override;
  const env = process.env;
  const candidates = process.platform === 'win32'
    ? [
      `${env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      `${env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
      `${env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      `${env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ]
    : process.platform === 'darwin'
      ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ]
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium'];
  return candidates.find((p) => p && !p.startsWith('undefined') && fs.existsSync(p)) || null;
}

/** Number of pages in a PDF the browser made (0 if it can't tell). */
export function pdfPages(file) {
  try {
    const raw = fs.readFileSync(path.resolve(ROOT, file)).toString('latin1');
    const pages = (raw.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length;
    if (pages) return pages;
    return Math.max(0, ...[...raw.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map((m) => Number(m[1])));
  } catch {
    return 0;
  }
}

// Pages that carry <meta name="shiro-fit"> (the resume template) are fitted: if the PDF spills onto
// an extra page, the text and spacing are tightened step by step (never below ~9pt) until it
// doesn't. The chosen step is written into the HTML too, so the HTML and the PDF always match.
const FIT_MARK = /<meta\s+name=["']shiro-fit["']/i;
const FIT_STYLE = /\n?<style id="shiro-fit">[\s\S]*?<\/style>/;
const FIT_STEPS = 5;
function fitCss(k) {
  const s = 1 - 0.025 * k; // text: 100% → 87.5% (10.5pt → ~9.2pt body)
  const g = 1 - 0.1 * k; // gaps: 100% → 50%
  const pt = (v) => `${(v * s).toFixed(2)}pt`;
  const gap = (v) => `${(v * g).toFixed(2)}pt`;
  return `<style id="shiro-fit">
  @page { margin: ${(0.5 - 0.03 * k).toFixed(2)}in ${(0.55 - 0.03 * k).toFixed(2)}in; }
  body { font-size: ${pt(10.5)}; line-height: ${(1.3 - 0.03 * k).toFixed(2)}; }
  h1 { font-size: ${pt(20)}; }
  .contact, .meta { font-size: ${pt(9.5)}; }
  header { margin-bottom: ${gap(6)}; }
  h2 { font-size: ${pt(11)}; margin: ${gap(9)} 0 ${gap(4)}; }
  .entry { margin-bottom: ${gap(5)}; }
  li { margin-bottom: ${gap(1.5)}; }
</style>`;
}
const withFit = (html, k) => {
  const base = html.replace(FIT_STYLE, '');
  return k ? base.replace(/<\/head>/i, `${fitCss(k)}\n</head>`) : base;
};

export async function htmlToPdf(input, output) {
  const src = path.resolve(ROOT, input);
  const out = path.resolve(ROOT, output);
  if (!inside(src) || !inside(out)) throw new Error('Both files must be inside runs/ or memory/.');
  if (!/\.html?$/i.test(src) || !fs.existsSync(src)) throw new Error(`No HTML file at ${input}`);
  if (!/\.pdf$/i.test(out)) throw new Error('The output file must end in .pdf');
  const html = fs.readFileSync(src, 'utf8');
  if (!FIT_MARK.test(html)) return printOnce(src, out);

  // Always start from the template's normal size, even if this HTML was fitted before.
  const pagesAt = [];
  let best = 0;
  for (let k = 0; k <= FIT_STEPS; k++) {
    fs.writeFileSync(src, withFit(html, k));
    await printOnce(src, out);
    pagesAt[k] = pdfPages(out);
    if (pagesAt[k] && pagesAt[k] < pagesAt[best]) best = k;
    if (pagesAt[k] <= 1) break;
  }
  // If even the tightest step didn't save a page, keep the most readable size for that page count.
  const last = pagesAt.length - 1;
  if (best !== last) {
    fs.writeFileSync(src, withFit(html, best));
    await printOnce(src, out);
  }
  return path.relative(ROOT, out).split(path.sep).join('/');
}

function printOnce(src, out) {
  return new Promise((resolve, reject) => {
    const browser = findBrowser();
    if (!browser) {
      return reject(new Error('No Chrome or Edge found. Open the HTML file in a browser and use Ctrl+P → Save as PDF (or set SHIRO_BROWSER).'));
    }

    // A throwaway profile, so this never touches (or waits on) the Chrome you have open.
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shiro-pdf-'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.rmSync(out, { force: true });
    const args = [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${profile}`,
      '--no-pdf-header-footer',
      `--print-to-pdf=${out}`,
      pathToFileURL(src).href,
    ];
    execFile(browser, args, { timeout: 60000, windowsHide: true }, (err) => {
      setTimeout(() => fs.rm(profile, { recursive: true, force: true }, () => {}), 1500);
      if (fs.existsSync(out) && fs.statSync(out).size > 0) resolve(path.relative(ROOT, out).split(path.sep).join('/'));
      else reject(new Error(`The browser couldn't make the PDF${err ? `: ${err.message}` : '.'}`));
    });
  });
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Usage: node tools/html-to-pdf.mjs <input.html> <output.pdf>');
    process.exit(2);
  }
  htmlToPdf(input, output)
    .then((p) => console.log(`Saved ${p}`))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
