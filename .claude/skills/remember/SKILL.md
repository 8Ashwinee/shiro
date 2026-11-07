---
name: remember
description: Save a new career fact to the candidate's memory. Covers a new or finished job or internship, a course, certificate, project, skill, award, education update, changed contact details or status, an answer to an application question, or an application status update. Use whenever the user mentions something like this, even in passing.
argument-hint: "<what's new, e.g. 'finished AWS Cloud Practitioner, Nov 2026'>"
---

# /remember: update the career memory

What to remember: $ARGUMENTS

If that's empty, use what the user just said in the conversation. If there's nothing there either, ask what's new.

## Where things go

| Fact | File |
|---|---|
| Job, internship, freelance, research, volunteering | `memory/experience.md` |
| Degree, school, GPA, coursework, exchange | `memory/education.md` |
| Personal, academic, hackathon or open-source project | `memory/projects.md` |
| Certificate, online course, bootcamp, training | `memory/certifications.md` |
| Skill, tool, language, framework (and where it was used) | `memory/skills.md` |
| Award, hackathon result, publication, talk, leadership, club | `memory/achievements.md` |
| Contact, links, location, work authorization, availability, salary, self-ID choices, form defaults | `memory/profile.md` |
| A new base resume for a kind of role | `memory/resume/` + a line under `## Resumes` in `memory/profile.md` |
| A file a form might ask for: certificate, transcript, degree, recommendation letter, portfolio, writing or work sample | its section folder under `memory/documents/` + an entry under its heading in `memory/documents.md` (see below) |
| A link: portfolio, credential verification, project demo, publication | `## Links` in `memory/documents.md`, plus the related entry |
| Answer to an application question | `memory/answers.md` |
| Application submitted, interview, rejection, offer | `memory/applications.md` |

One fact can touch several files. A finished internship updates `experience.md` (end date, results) and `skills.md` (new tools, "used at <company>"). Finishing a degree updates `education.md` and the status in `profile.md`.

## Files and links: identify, sort, record
Memory must stay tidy. Every file is identified, renamed clearly and moved into its section. Nothing stays loose in `memory/documents/`; files sitting directly there are the new, unfiled ones.

| What it is | Folder | Heading in `memory/documents.md` |
|---|---|---|
| Course or professional certificate | `memory/documents/certificates/` | `## Certificates` |
| Transcript, degree certificate, mark sheet | `memory/documents/academic/` | `## Academic` |
| Recommendation, experience or internship-completion letter | `memory/documents/letters/` | `## Letters` |
| Portfolio, writing sample, work sample, case study | `memory/documents/portfolio/` | `## Portfolio & samples` |
| Cover letter | `memory/documents/cover-letters/` | `## Cover letters` |
| A resume | `memory/resume/` (section `resumes`), short name like `ai-engineer-intern-acme` | none; add a line `- <Role>: <path>` under `## Resumes` in `profile.md`, with `<Role>` kept to a few words (e.g. `AI Engineer Intern (Acme)`) and no notes on its contents |
| Anything else useful for forms, or unclear | `memory/documents/other/` | `## Other files` |
| Same document as one already filed | `memory/documents/duplicates/` | none; add `- Duplicate copy (safe to delete): <path>` to the original's entry |

**For each new file:**
1. **A path outside the project** (e.g. `C:\Downloads\cert.pdf`): copy it into `memory/documents/` with a shell copy. If you can't (for example in the Shiro app), ask the user to drop it into the app's Memory tab.
2. **Identify it** by reading it (PDFs and images can be read directly). If `documents.md` or another memory file already describes this exact file, don't read it again; just sort it.
3. **Move and rename it** with Shiro's tool, as one plain command with no `cd`. Several files can go in one command:
   `node tools/file-doc.mjs <file> <section>/<clear-name> [<file> <section>/<clear-name> ...]`
   Clear names are lowercase with hyphens: issuer, title, year-month, e.g. `coursera-google-data-analytics-2026-10`. The tool keeps the extension, never overwrites, and prints each new path. Use the printed paths.
4. **An HTML file** (e.g. a saved certificate page): after moving it, make a PDF next to it, because forms want PDFs: `node tools/html-to-pdf.mjs <file>.html <file>.pdf`. Record the PDF as the file.
5. **Record it** under its heading in `memory/documents.md` (the template comment there shows the fields), and put its facts in the related memory file: a certificate also goes in `certifications.md` (issuer, date, credential ID, verification link, skills), a transcript can fill GPA and coursework in `education.md`, a letter goes with its role in `experience.md`, and the skills it proves go in `skills.md`.
6. **Identity or bank documents** (passport, Aadhaar, PAN, driver's license, bank statements): don't file them. Leave them where they are and tell the user to delete them, since Shiro never uploads them.
7. In your reply, list what each file turned out to be and where it went, grouped by section.

**Links:** work out what the link is (open it with WebFetch if the URL and the user's note don't make it clear). Add it under `## Links` in `documents.md` with its type, and to the related entry: a credential link in `certifications.md`, a demo in `projects.md`, a portfolio under Links in `profile.md`. Don't add a link that's already there.

## Forgetting (when the request starts with `FORGET:`, or the user asks to remove something)
The user wants something out of memory: a wrong fact, an old project, a skill they don't want claimed.
1. Find **every** place it appears: search all of `memory/*.md` (Grep), including mentions inside other entries (a project named in `skills.md` "used in:", a certificate's line in `documents.md`, a resume line in `profile.md`).
2. If it's ambiguous (two projects match, or it's unclear whether to remove a whole entry or just one detail), ask one short question and stop.
3. Remove it: delete whole entries, or just the detail, as asked. When a skill's only evidence was the removed item, remove that skill too; otherwise only drop the reference. Leave template comments and headings alone.
4. Files: don't delete files yourself. If the item has a file in `memory/documents/` or `memory/resume/`, tell the user they can remove it with the bin icon in the Memory tab (that keeps an Undo).
5. Set `Last updated:` in `profile.md` to today, then say in 1–3 lines exactly what was removed and from which files. Never add anything new while forgetting.

## Steps
1. If `memory/` doesn't exist, create it first by copying every file from `templates/memory/`. If it exists, create any template file that's missing (for example `documents.md`) and the `memory/documents/` folder.
2. Read the target file(s) and follow the format shown in each file's template comment.
3. **Update, don't duplicate.** If the item already exists (same company, course or project), update it. For example, an internship marked "Present" gets an end date.
4. If details that matter for resumes and forms are missing (dates, issuer, credential link, what they did, tools, results with numbers), ask for them in one short message. If the user doesn't know or skips, save what you have and leave those fields blank. Never fill in guesses.
5. Write the change. Keep entries newest first. Then set `Last updated:` under `## About this memory` in `memory/profile.md` to today's date (YYYY-MM-DD).
   - **Conflicts:** memory is the source of truth. Only replace a memory fact with a resume's version when the resume is newer than `Last updated` and memory doesn't cover it yet; otherwise keep memory's version. Among resumes, the `Reference resume` in `profile.md` wins.
6. Confirm in 1–3 lines what was saved and where. If it answers a question in a `runs/*/questions.md`, say so, and that the next `/review` will use it.

Never store passwords, government ID numbers (SSN, Aadhaar, PAN, passport) or bank details. If the user gives one, don't save it and tell them why.
