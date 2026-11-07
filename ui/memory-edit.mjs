// Removing things from memory, for free (no Claude): split a memory file into the items the UI
// shows (one job, one project, one skill, one profile field…), remove one, and keep a copy for Undo.
//
// Every removal first saves the files it changes into memory/.trash/<id>/, so Undo can put them
// back exactly. The trash is only for Undo: it's emptied when the server starts and after an hour.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const TRASH_TTL = 60 * 60 * 1000;
// Files whose items are ### headings (several per ## section). Others use ## headings, except the
// line-based ones below.
const H3_FILES = new Set(['certifications', 'answers', 'documents']);
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const isPlaceholder = (title) => /^<[^>]*>/.test(title.trim()) || !title.trim();

export function createMemoryEditor({ root, memoryDir, templatesDir }) {
  const trashDir = path.join(memoryDir, '.trash');
  const rel = (full) => path.relative(root, full).split(path.sep).join('/');
  const inside = (full, dir) => full === dir || full.startsWith(dir + path.sep);
  const read = (full) => (fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '');
  const fileOf = (name) => {
    if (!/^[a-z][a-z0-9-]*$/i.test(String(name))) throw err(400, 'Unknown memory file.');
    const full = path.join(memoryDir, `${name}.md`);
    if (!fs.existsSync(full)) throw err(404, 'That memory file doesn’t exist.');
    return full;
  };

  // Template keys of profile.md ("Email", "Phone (with country code)"…): clearing one keeps the
  // empty field for later, instead of deleting the line.
  const profileKeys = new Set(
    [...read(path.join(templatesDir, 'profile.md')).matchAll(/^- ([^:\n]+):/gm)].map((m) => m[1].trim()),
  );

  /** Lines with their character offsets and whether they sit inside an HTML comment. */
  function lines(text) {
    const out = [];
    let pos = 0;
    let inComment = false;
    for (const line of text.split('\n')) {
      const startsInComment = inComment;
      let probe = line;
      // Track <!-- … --> across lines.
      for (;;) {
        if (inComment) {
          const end = probe.indexOf('-->');
          if (end < 0) break;
          inComment = false;
          probe = probe.slice(end + 3);
        } else {
          const start = probe.indexOf('<!--');
          if (start < 0) break;
          inComment = true;
          probe = probe.slice(start + 4);
        }
      }
      out.push({ text: line, start: pos, end: pos + line.length + 1, comment: startsInComment || /^\s*<!--/.test(line) });
      pos += line.length + 1;
    }
    return out;
  }

  /** The removable items of one memory file. */
  function itemsOf(name, text) {
    const ls = lines(text);
    const items = [];
    let section = '';
    const push = (item) => {
      const n = items.filter((x) => x.raw === item.raw).length;
      items.push({ ...item, id: `${hash(item.raw)}-${n}`, section });
    };

    if (name === 'skills' || name === 'profile') {
      for (let i = 0; i < ls.length; i++) {
        const l = ls[i];
        if (l.comment) continue;
        const h = l.text.match(/^##\s+(.+)$/);
        if (h) { section = h[1].trim(); continue; }
        if (!/^- \S/.test(l.text)) continue;
        // Indented lines under a bullet belong to it.
        let j = i + 1;
        while (j < ls.length && !ls[j].comment && /^\s+\S/.test(ls[j].text)) j++;
        const raw = text.slice(l.start, Math.min(ls[j - 1].end, text.length));
        if (name === 'profile') {
          const isResume = /^Resumes\b/.test(section);
          // A resume line's role can itself contain colons, so split at the path at the end.
          const m = (isResume && l.text.match(/^- (.+):[ \t]*(`?[^\s`]+\.(?:pdf|docx?|md|txt|html?)`?)[ \t]*$/i))
            || l.text.match(/^- ([^:\n]+):[ \t]*(.*)$/);
          if (!m || !m[2].trim()) { i = j - 1; continue; }
          const key = m[1].trim();
          push({
            title: key, body: m[2].trim(), raw, start: l.start, end: Math.min(ls[j - 1].end, text.length),
            action: isResume ? 'resume' : profileKeys.has(key) ? 'clear' : 'remove',
            resumePath: isResume ? m[2].trim().replace(/^`|`$/g, '') : undefined,
          });
        } else {
          const t = l.text.slice(2);
          const cut = t.search(/\s[—–-]\s/);
          push({ title: cut > 0 ? t.slice(0, cut) : t, body: cut > 0 ? t.slice(cut).replace(/^\s[—–-]\s/, '') : '', raw, start: l.start, end: Math.min(ls[j - 1].end, text.length), action: 'remove' });
        }
        i = j - 1;
      }
      return items;
    }

    if (name === 'applications') {
      let afterSep = false;
      for (const l of ls) {
        if (l.comment) continue;
        if (/^\|\s*-{3}/.test(l.text)) { afterSep = true; continue; }
        if (!afterSep || !/^\|/.test(l.text)) continue;
        const cells = l.text.split('|').slice(1, -1).map((c) => c.trim());
        push({ title: [cells[1], cells[2]].filter(Boolean).join(' · ') || cells.join(' '), body: [cells[0], cells[5]].filter(Boolean).join(' · '), raw: text.slice(l.start, Math.min(l.end, text.length)), start: l.start, end: Math.min(l.end, text.length), action: 'remove' });
      }
      return items;
    }

    const level = H3_FILES.has(name) ? 3 : 2;
    const headingAt = (l, max) => {
      const m = !l.comment && l.text.match(/^(#{1,6})\s+(.+)$/);
      return m && m[1].length <= max ? { level: m[1].length, title: m[2].trim() } : null;
    };
    for (let i = 0; i < ls.length; i++) {
      const h = headingAt(ls[i], level);
      if (!h) continue;
      if (h.level < level) { if (h.level > 1) section = h.title; continue; }
      let j = i + 1;
      while (j < ls.length && !headingAt(ls[j], level)) j++;
      if (isPlaceholder(h.title)) { i = j - 1; continue; }
      const start = ls[i].start;
      const end = Math.min(ls[j - 1].end, text.length);
      const raw = text.slice(start, end);
      const body = raw.split('\n').slice(1).join('\n').replace(/<!--[\s\S]*?-->/g, '')
        // Hide empty template fields ("- Dates:") unless indented details follow them.
        .split('\n').filter((l, k, all) => !/^\s*- [^:\n]+:\s*$/.test(l) || /^\s+-\s*\S/.test(all[k + 1] || '')).join('\n')
        .trim();
      const file = name === 'documents' ? (body.match(/^- File:\s*(\S+)/m) || [])[1] : undefined;
      const link = name === 'documents' ? (body.match(/^- Link:\s*(\S+)/m) || [])[1] : undefined;
      push({ title: h.title, body, raw, start, end, action: 'remove', file, link });
      i = j - 1;
    }
    return items;
  }

  // ---------- trash and undo ----------

  function purge(all = false) {
    for (const d of fs.existsSync(trashDir) ? fs.readdirSync(trashDir) : []) {
      const full = path.join(trashDir, d);
      let at = 0;
      try { at = JSON.parse(read(path.join(full, 'manifest.json'))).at || 0; } catch { /* broken: remove */ }
      if (all || Date.now() - at > TRASH_TTL) fs.rmSync(full, { recursive: true, force: true });
    }
  }

  /** Runs `change`, after saving every file it will touch so Undo can restore it. */
  function withUndo(label, { edits = [], moves = [] }) {
    purge();
    const id = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const dir = path.join(trashDir, id);
    fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
    const manifest = { at: Date.now(), label, files: [], moved: [] };
    edits.forEach((e, i) => {
      fs.writeFileSync(path.join(dir, `${i}.bak`), read(e.full));
      manifest.files.push({ rel: rel(e.full), backup: `${i}.bak` });
    });
    moves.forEach((full, i) => {
      if (!fs.existsSync(full)) return;
      const to = path.join(dir, 'files', `${i}-${path.basename(full)}`);
      fs.renameSync(full, to);
      manifest.moved.push({ rel: rel(full), stored: path.relative(dir, to) });
    });
    for (const e of edits) fs.writeFileSync(e.full, e.content);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
    return { undo: id, label };
  }

  function undo(id) {
    if (!/^[a-z0-9]+-[0-9a-f]{6}$/.test(String(id))) throw err(400, 'Unknown undo.');
    const dir = path.join(trashDir, id);
    if (!fs.existsSync(path.join(dir, 'manifest.json'))) throw err(410, 'Too late to undo that one.');
    const m = JSON.parse(read(path.join(dir, 'manifest.json')));
    for (const f of m.files) {
      const full = path.resolve(root, f.rel);
      if (inside(full, memoryDir)) fs.writeFileSync(full, read(path.join(dir, f.backup)));
    }
    for (const f of m.moved) {
      const full = path.resolve(root, f.rel);
      if (!inside(full, memoryDir) || fs.existsSync(full)) continue;
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.renameSync(path.join(dir, f.stored), full);
    }
    fs.rmSync(dir, { recursive: true, force: true });
    return { ok: true, label: m.label };
  }

  // ---------- removals ----------

  const tidy = (s) => s.replace(/\n{3,}/g, '\n\n');
  const cut = (text, item) => tidy(text.slice(0, item.start) + text.slice(item.end));

  /** Removes the documents.md entries that point at `docRel` (or at link `url`). */
  function documentsWithout({ docRel, url }) {
    const full = path.join(memoryDir, 'documents.md');
    let text = read(full);
    const norm = (p) => String(p || '').replace(/\\/g, '/').replace(/^memory\//, '');
    const hits = itemsOf('documents', text)
      .filter((it) => (docRel && it.file && norm(it.file) === norm(docRel)) || (url && it.link === url))
      .sort((a, b) => b.start - a.start);
    for (const it of hits) text = cut(text, it);
    return hits.length ? { full, content: text } : null;
  }

  function removeProfileResumeLines(resumeRel) {
    const full = path.join(memoryDir, 'profile.md');
    let text = read(full);
    const hits = itemsOf('profile', text).filter((it) => it.action === 'resume' && it.resumePath === resumeRel).sort((a, b) => b.start - a.start);
    for (const it of hits) text = cut(text, it);
    return hits.length ? { full, content: text } : null;
  }

  function resumeFull(resumeRel) {
    const full = path.resolve(root, String(resumeRel || ''));
    if (!inside(full, path.join(memoryDir, 'resume')) || !fs.existsSync(full)) throw err(400, 'Only resumes in memory/resume/ can be removed here.');
    return full;
  }

  function forgetResume(resumeRel) {
    const full = resumeFull(resumeRel);
    const r = rel(full);
    const cache = path.join(path.dirname(full), '.text', `${path.basename(full)}.txt`);
    const edit = removeProfileResumeLines(r);
    return withUndo(`resume ${path.basename(full)}`, { edits: edit ? [edit] : [], moves: [full, cache] });
  }

  function forgetDoc(docRel) {
    const full = path.resolve(root, String(docRel || ''));
    const docsDir = path.join(memoryDir, 'documents');
    if (!inside(full, docsDir) || full === docsDir || !fs.existsSync(full) || fs.statSync(full).isDirectory()) throw err(400, 'Unknown document.');
    const edit = documentsWithout({ docRel: rel(full) });
    return withUndo(path.basename(full), { edits: edit ? [edit] : [], moves: [full] });
  }

  function forgetLink(url) {
    const edit = documentsWithout({ url: String(url || '') });
    if (!edit) throw err(404, 'That link isn’t in memory any more.');
    return withUndo(`link ${url}`, { edits: [edit] });
  }

  function forgetItem(name, id) {
    const full = fileOf(name);
    const text = read(full);
    const item = itemsOf(name, text).find((it) => it.id === id);
    if (!item) throw err(409, 'That item changed since the page loaded. Reload and try again.');
    if (item.action === 'resume' && item.resumePath) {
      try { return forgetResume(item.resumePath); } catch { /* file already gone: just drop the line */ }
    }
    if (name === 'documents' && item.file) {
      const doc = path.resolve(root, item.file.startsWith('memory/') ? item.file : `memory/${item.file}`);
      if (inside(doc, path.join(memoryDir, 'documents')) && fs.existsSync(doc)) return forgetDoc(rel(doc));
    }
    const content = item.action === 'clear'
      ? text.slice(0, item.start) + `- ${item.title}:\n` + text.slice(item.end)
      : cut(text, item);
    return withUndo(`${item.title}`, { edits: [{ full, content }] });
  }

  function items(name) {
    const full = fileOf(name);
    return itemsOf(name, read(full)).map(({ raw, start, end, ...it }) => it);
  }

  return { items, forgetItem, forgetDoc, forgetLink, forgetResume, undo, purge };
}

function err(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
