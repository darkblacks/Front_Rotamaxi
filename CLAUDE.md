# Victor Autonomous Development Protocol

## Goal
When Victor gives a direct task, especially a short command such as `faz`, execute the task end-to-end instead of repeatedly asking what to do next.

## Default behavior
1. Understand the requested outcome.
2. Inspect only the minimum relevant files first.
3. Confirm repository root before any git command.
4. Form a short internal execution plan.
5. Implement.
6. Run the cheapest relevant validation first.
7. If UI changed, visually verify the rendered result when browser/Preview tools are available.
8. Fix problems found by validation.
9. Report only: what changed, validation performed, remaining real blockers.

Do not stop after merely proposing a plan unless the user explicitly asks for planning only.

## "faz" protocol
If Victor says only `faz`, `faz isso`, `resolve`, `arruma`, or equivalent after a clearly defined task:
- treat it as authorization to complete the currently defined task;
- do not ask for confirmation on ordinary file edits, refactors, local build/test commands, or non-destructive fixes;
- continue until the acceptance criteria are satisfied or a genuine external blocker exists.

A genuine blocker means missing credentials/access, an irreversible production action, destructive data mutation, ambiguous business behavior that could materially corrupt data, or unavailable external service.

## Agent routing
Use subagents only when useful. Do NOT start the whole team by default.

- `scout`: only when repository/module location is unclear or a fast code-map is needed.
- `frontend`: Vue/React/TS/CSS/UI work.
- `backend`: API/domain/Laravel/NestJS work.
- `database`: schema/query/migration/data-integrity work.
- `visual-qa`: only for user-visible UI or flows requiring browser verification.
- `devops`: only for deployment, containers, AWS/SSH, services or production diagnostics.
- `reviewer`: only after non-trivial or risky changes.

Prefer one specialist at a time. Run agents in parallel only when tasks are truly independent.

## Token-control protocol
- Never read the entire repository.
- Start with filename search, grep, symbols, routes, imports, and the smallest relevant files.
- Do not reread files already inspected unless they changed.
- Do not paste large files into chat.
- Keep handoffs under 20 concise lines unless a detailed artifact is requested.
- Use Haiku-class agents for reconnaissance/repetitive checks; Sonnet-class agents for implementation.
- Escalate to an expensive model only for genuinely hard architecture/debugging.
- Do not spawn subagents for trivial edits.
- When context becomes noisy, recommend `/compact`; when task changes completely, recommend `/clear`.
- Prefer commands that return targeted output (`grep`, specific tests, route filters) over broad dumps.

## Visual verification / "eyes"
For frontend changes:
- if Claude Code Preview is available, start the dev server and visually inspect the page;
- inspect screenshots/DOM, click the affected flow, test responsive layout when relevant;
- compare against supplied screenshots/mockups;
- do not claim visual success without actually rendering the page when visual tools are available.
If Preview/browser tooling is not available, run build/typecheck and state that visual verification was not performed.

## RotaMaxi project safety
Frontend is normally local. The Laravel backend may be a real AWS environment.
Never assume a local backend copy is the source of truth when Victor says the frontend consumes AWS.

Before touching production:
- identify the exact target repo/container/service;
- do not touch unrelated services/databases;
- do not run destructive/global operations such as `migrate:fresh`, broad prune, global PM2 restart, force push, mass delete, or unscoped SQL;
- prefer backup + narrow idempotent change + verification.

Known production services that must not be mixed:
- RotaMaxi services are separate from Actrya, Orvya deploy manager, and Transmassa services.
Do not operate on unrelated projects.

## Git
Before `git status`, `git diff`, commit or branch operations:
- verify current working directory and repo root.
Do not force-push unless Victor explicitly requests it and the target is confirmed.

## Definition of done
A coding task is not done because the code was written.
Done means the relevant combination of:
- implementation complete;
- typecheck/build/tests relevant to the change pass;
- route/API contract verified if backend changed;
- UI rendered and checked when visual tooling exists;
- no obvious console/runtime error introduced;
- concise final summary.

## Communication
Technical investigation/handoffs may be concise English internally.
Final report to Victor should be Brazilian Portuguese, compact and practical.
Do not make Victor approve every small step. Ask only at real risk boundaries.
