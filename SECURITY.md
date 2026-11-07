# Security

Shiro handles personal career data, so security reports are taken seriously.

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's private reporting instead: **Security → Report a vulnerability** on this repository. Include what you found, how to reproduce it, and its impact. You'll get a reply within a week.

## What's in scope

- The local server (`ui/server.mjs`): it should only answer `127.0.0.1` / `localhost`, require the session token, and only read or write inside `memory/` and `runs/`.
- Anything that could send a user's memory or runs somewhere they didn't ask for.
- Agent or skill instructions that could be steered by a job posting or web page into leaking data, submitting forms, or inventing facts.

## Out of scope

- Issues that need someone who already has access to your computer.
- Behavior of Claude Code, Claude in Chrome or third-party job sites themselves (report those to their owners).
