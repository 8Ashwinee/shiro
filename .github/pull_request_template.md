## What this changes

<!-- One or two sentences. Link the issue if there is one: Fixes #12 -->

## How I tested it

<!-- e.g. ran a review in the app, played the free demo, built a resume PDF with tools/html-to-pdf.mjs -->

## Checklist

- [ ] No personal details (names, emails, phone numbers, employers, resumes) in agents, skills, templates, screenshots or test files
- [ ] The writer and form filler still never invent facts, and nothing submits an application
- [ ] If the server changed: `VERSION` in `ui/server.mjs` and `APP_VERSION` in `ui/public/app.js` are bumped together
- [ ] If an agent was added or renamed: `.claude/agents/`, `ui/review-pipeline.mjs` and `ui/public/creatures.js` all match
- [ ] README updated if the change is user-visible
