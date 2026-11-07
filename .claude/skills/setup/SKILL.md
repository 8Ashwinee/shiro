---
name: setup
description: First-time setup. Creates the private career memory, imports everything from the user's current resume, and collects the standard answers job application forms ask for.
argument-hint: "[path to your current resume: PDF, DOCX or MD]"
disable-model-invocation: true
---

# /setup: build the career memory

Arguments: $ARGUMENTS

## 1. Create memory/
For each file in `templates/memory/`, create `memory/<same name>` if it doesn't exist yet. Also create the folders `memory/resume/` and `memory/documents/`.

**Never overwrite an existing memory file.** If memory already exists, tell the user and continue in update mode: only fill in what's missing.

## 2. Import the resumes
People often keep one resume per kind of role (for example software engineer and data analyst). Import all of them.
1. Take the path(s) from the arguments, or ask for them. Ask whether there are more resumes for other kinds of roles.
2. Copy each file into `memory/resume/` with a shell copy, naming it after the role it targets (e.g. `software-engineer.pdf`). If a file is already in `memory/resume/` (for example dropped in the Shiro app), don't copy it; rename it in place with `node tools/file-doc.mjs memory/resume/<file> resumes/<role-name>` (one plain command, no `cd`). Add one line per resume under `## Resumes` in `memory/profile.md`: `- <Role>: memory/resume/<file>`. Keep `<Role>` to a few words (e.g. `AI Engineer Intern`, or `AI Engineer Intern (Acme)` for a version made for one company), because the app shows it in its resume pickers; don't write notes about what's in the resume there, the picker reads the resume itself. Keep file names short too (role, plus the company or `v2` when needed). Ask which role a resume targets if it isn't obvious.
3. Read each one and move **every** fact into the right memory file, using the table in `.claude/skills/remember/SKILL.md`: contact details and links go to `profile.md`, each role to `experience.md`, and so on. When resumes describe the same job differently, keep every distinct fact under one entry. Keep the user's wording and numbers exactly. Don't improve anything at this stage.
4. When resumes disagree (dates, titles, grades), ask the user which is right, and ask which resume is the most accurate overall. Record it as `Reference resume` under `## About this memory` in `profile.md`, and set `Last updated` to today. From then on memory is the source of truth (see rule 5 in `CLAUDE.md`).

## 3. Fill the gaps
In the Shiro app you can't show multiple-choice pickers: write each batch as a short numbered list in your final message (offer the options inline) and stop; the user's reply continues the setup. Skip any question the user already answered.

Ask in short batches. Use multiple-choice questions where the answers are fixed. Everything can be skipped. Never guess.

1. **Contact and links** that aren't on the resume: phone with country code, LinkedIn, GitHub, portfolio.
2. **Eligibility:** countries where they can work, sponsorship needs, willingness to relocate, remote / hybrid / onsite preference.
3. **Availability and pay:** current status, graduation date (if a student), earliest start date or notice period, expected compensation (or "prefer to discuss").
4. **Self-identification questions** (gender, ethnicity, veteran, disability). Explain that these are voluntary on forms and "Decline to self-identify" is a fine answer for all of them.
5. **Form defaults:** how they usually heard about jobs, languages, over 18, OK with a background check.
6. **What's not on the resume:** other internships, courses, certificates, projects, hackathons, awards, leadership. Save each one following the /remember rules.
7. **Documents and links forms ask for:** certificate PDFs or verification links, transcripts, degree certificate, recommendation letters, portfolio, writing or work samples. Ask for file paths and links, and save them following the "Files and links" rules in `.claude/skills/remember/SKILL.md`. Mention that they can also drop files into the Memory tab of the Shiro app (`npm run ui`). Don't accept identity or bank documents.

## 4. Finish
Summarize what's in memory in a few lines: how many entries per file, and anything still blank that forms commonly ask for. Then tell them:
- `/review <JD file or URL>` runs the panel on a job.
- `/apply <application URL>` fills an application (needs Chrome, see the README).
- `/remember <anything new>` keeps memory current. Claude also saves new facts on its own when they mention them.
