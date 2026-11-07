---
name: apply
description: Fill a job application form on a company career page from the candidate's memory using Claude in Chrome. Picks the best resume for the job, uploads it, answers the questions, drafts custom answers, and stops before submitting so the user can review and submit.
argument-hint: "<application URL> [resume file]"
disable-model-invocation: true
---

# /apply: fill the form, never submit

Arguments: $ARGUMENTS

This works on its own: it doesn't need a `/review` run first. If an effort level was set for this run (the Shiro app sets one), pass it as `effort` on every Agent call.

## Hard rules
- **Never submit.** Don't click any button that sends the application: Submit, Submit application, Apply (on the form itself), Send, Finish, Complete, Confirm. If you're not sure whether a button submits, don't click it.
  - Allowed: the "Apply" / "Apply for this job" button on a job posting that only *opens* the form, and "Next" / "Continue" / "Save and continue" between pages of a multi-page form.
- **Never** create accounts, type passwords, solve CAPTCHAs, or do email/phone verification. Stop, ask the user to do it in that tab, and continue when they say so.
- **Never** tick consent, certification or terms checkboxes ("I certify…", "I agree to the privacy policy"). Those are the user's to accept. List them in the report.
- **Never guess** legal, eligibility or money answers: work authorization, sponsorship, criminal record, salary, notice period, previous employment with this company. If memory doesn't have it, leave it blank and ask.
- **Never** upload identity or bank documents (passport, Aadhaar, PAN, driver's license, bank statements), even if a form asks. Leave that for the user.
- Only use facts from memory. Drafted text must be truthful. If the uploaded resume and memory disagree, memory wins, unless the resume has something newer than memory's `Last updated` date that memory doesn't have; then use the resume's version and save it to memory.
- Only type memory data into this application (the URL the user gave and the pages it leads to). Never send it anywhere else.

## 1. Check Chrome
The Claude in Chrome tools (`mcp__claude-in-chrome__*`) must be available. If they aren't, stop and tell the user: install the Claude in Chrome extension, start Claude Code with `claude --chrome` (or run `/chrome`), then run `/apply` again.

If the tools are deferred, load them in **one** ToolSearch call: `tabs_context_mcp`, `tabs_create_mcp`, `navigate`, `read_page`, `find`, `form_input`, `computer`, `file_upload`, `get_page_text`.

## 2. Load memory
Read every file in `memory/`: profile, answers, experience, education, projects, certifications, skills, achievements, documents, applications. If `memory/` doesn't exist, tell the user to run `/setup` first.

Check `applications.md`. If this company and role are already listed, tell the user and ask before continuing.

## 3. Open the page and read the job
Get the tab context, open a new tab, and navigate to the URL. If it's a job posting, read it and keep the JD text: you need it to pick the resume and for custom answers. Then click the button that opens the application form. If the URL goes straight to the form, take the job details from the form page.

If you hit a login wall, account creation, CAPTCHA or verification step, hand it to the user and wait.

## 4. Pick the resume to upload
Use the first rule that applies:
1. **A file was given in the arguments:** use it.
2. **A tailored resume exists for this job:** the newest `runs/*<company>*/resume.pdf` whose role matches. If a matching run exists but has no `resume.pdf` yet, say so (they can export it from that run's `resume.html`) and fall through to rule 3.
3. **Base resumes:** every file listed under `## Resumes` in `memory/profile.md`, plus any other resume file in `memory/resume/`.
   - One: use it.
   - Several: save the JD text as `runs/<YYYY-MM-DD>-<company>-<role>/jd.md` (reuse a matching run folder if there is one), run the `resume-picker` agent and wait for it:
     > Job description: <run>/jd.md
     > Resumes: <path 1>, <path 2>, …
     > Write your pick to: <run>/pick.md

Only PDF or DOCX files can be uploaded. If the chosen resume is Markdown or text only, tell the user and ask which file to upload.

Tell the user in one line which file you're using and why.

## 5. Fill
1. **Read the whole form first** with `read_page`, scrolling as needed. Note every field, which ones are required, character limits, and how many pages there are.
2. **Upload the resume first.** Find the file input with `read_page` or `find` and use `file_upload` (never click the file input; it opens a native dialog you can't see). Many systems (Greenhouse, Lever, Ashby, Workday, SmartRecruiters) parse the resume and autofill fields, so after uploading, re-read the form and correct every autofilled value against memory. Parsers often mangle dates, titles and phone numbers. If the upload is rejected, ask the user to attach the file themselves and continue with the rest.
3. **Other file uploads** (cover letter, transcript, certificates, degree, recommendation letter, portfolio, writing or work sample): find the best match in `memory/documents.md` (look under the matching heading: Certificates, Academic, Letters, Portfolio & samples, Cover letters, Other files) and upload the file at its `File:` path with `file_upload`. Never upload anything from `duplicates/`. Match on what the field asks for, not just the file name. If the field is required and nothing fits, leave it and ask (see "Learn from this form" below). A cover letter is the exception: see custom questions below.
4. **Link fields** (portfolio, website, GitHub, LinkedIn, certificate verification, publications): from the links in `profile.md` and under `## Links` in `documents.md`.
5. **Standard fields** come from `profile.md` and the other memory files. Use `form_input` for text inputs, selects and checkboxes. For custom widgets (searchable dropdowns, date pickers), click and type. Choose the dropdown option that matches memory exactly; if none fits, leave it and report it.
6. **Work history and education sections:** fill from `experience.md` and `education.md`, consistent with the resume being uploaded.
7. **Custom questions:**
   - If `answers.md` has an answer to the same or a very similar question, reuse it and adapt names and details to this company.
   - Short factual questions: answer from memory, or leave blank and ask.
   - Open-ended questions ("Why do you want to work here?", "Tell us about a project…"): draft a specific, honest answer from the JD and memory, within the character or word limit. Mark it as a DRAFT in the report.
   - **Cover letter:** draft it the same way, specific to this company and role, and save it as `cover-letter.md` in the run folder for this job (create `runs/<YYYY-MM-DD>-<company>-<role>/` if needed). If the form has a text box, paste it there. If it wants a file: fill `templates/cover-letter.html` (replace the `<!-- LETTER_CONTENT -->` marker using the markup in its comment) and save it as `<run>/cover-letter.html`, then make the PDF by running exactly this one command, with nothing else on the line (no `cd`): `node tools/html-to-pdf.mjs <run>/cover-letter.html <run>/cover-letter.pdf`. Upload the PDF. If the command fails, leave the upload empty and tell the user the HTML file is ready to print to PDF.
   - Self-identification questions: use exactly what `profile.md` says. If it's blank, leave the question blank and ask.
8. **Multi-page forms:** when a page is complete, click Next / Continue. On the final review page, stop.
9. **Final check:** re-read the form and confirm every required field is filled or listed as blank.

## 6. Report
- Which resume was uploaded.
- Filled fields as a compact table (field → value), grouped by page.
- **Drafted answers:** the full text of each, so the user can edit them.
- **Left blank:** each field, with the question you need answered.
- **For you to do:** consent and terms boxes, anything you couldn't fill, then review everything and submit.

## 7. Learn from this form
- When the user answers the blank fields: fill them in the form, then save each new fact to memory following `.claude/skills/remember/SKILL.md`. Question-and-answer pairs go to `answers.md` with the company and date; facts go to their own file.
- When the user provides a missing document: if they give a file path, save it into `memory/documents/` and register it (the "Files and links" rules in the remember skill), then upload it. If you can't copy files (in the Shiro app), ask them to drop it into the app's Memory tab and reply "done"; then register it and upload it. A link goes into `documents.md` before you fill it in.
- Ask once whether to save the drafted answers they approved to `answers.md` for reuse.
- Add a row to `memory/applications.md`: date, company, role, URL, resume file used, status `Filled — waiting for you to submit`. When the user says they submitted it (now or later), update the status.
