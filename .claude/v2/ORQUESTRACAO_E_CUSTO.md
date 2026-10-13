# V2: Orchestration / token budget / safety

## 1. Default mode
- MAIN SESSION is PO on `sonnet`, medium effort, ideally launched in `--permission-mode plan` for discovery. Five configured roles are NOT five parallel processes.
- Agent Teams is NOT enabled by package. Do not spawn Agent Team unless Victor explicitly requests, after discussing higher use consumption.
- Each `Agent` call has a narrowly bounded deliverable; no spawn unless genuinely needed. Subagent `maxTurns` is a hard-ish cap on turns, NOT a guaranteed token budget or price cap; report PARTIAL if capped. Avoid recursive delegations.
- Change to Opus only on Victor's explicit approval. Haiku can be benchmarked for narrow clerical work later; not a default for high-risk rules/security.

## 2. Work sizing
| Class | PO strategy | Workers | Output |
|---|---|---|---|
| S: factual question, one file | direct targeted read | 0 | <=250 PT words |
| M: localized bug | rules only if unclear; DEV and QA in approved scope | sequential, 1 at a time | <=450 EN words handoff |
| L: new page | Rules -> UX -> DEV -> QA | sequential, 1 at a time | persist large artifacts in docs/entregas/ID |
| Whole-codebase audit | module-by-module with checkpoints | at most 1 scoped subagent initially | high-level index, evidence file:line |

Do not give the full repository to every agent. Classify search first: route->component->API call->controller->service->model->migration; limit giant tool results with patterns/targeted ranges and ignore generated data. For each stage, ask permission to continue if the user requested a bounded diagnostic.

## 3. Evidence and rules
Rule count for NEW / authorized PAGE: >=100 meaningful EFFECTIVE rules, inherited global/module once plus locally authored; explicitly separate counts and provenance; no feature expansion. Full matrix is persisted as TSV/CSV/Markdown only after microdelivery authorization. Process diagrams must be valid BPMN 2.0 concepts, not just generic flowcharts. QA traces every effective rule with testability and outcomes, reports blocked/unverified truthfully.

## 4. Machine-to-machine communication
Agents may use terse English bullets, IDs, technical field names and valid JSON/TSV when useful. Do not rewrite source or business names merely to 'save tokens'. Technical handoff template:
```
SCOPE: REG-VEICULOS ONLY
VERIFIED: RV-001 ... | src/foo:41
CONFLICT: RV-023 vs approved POLICY-7
GAPS: 2; BLOCKERS: 1
EVIDENCE: docs/entregas/RM-42/regras/matriz.tsv
STATUS: PARTIAL|READY|REJECTED
```
The final report to Victor MUST be in accessible natural pt-BR. Do not promise lower token usage solely from English: benchmark and compare.

## 5. Model/quality benchmarking
Use `.claude/v2/AVALIACAO_QUALIDADE.md` and `/avaliar-equipe`. Measure actual CLI /cost or account usage if available; these readings may not represent subscription billing. Record timing, prompts, perceived context consumed, files opened, warnings, genuine bugs identified, false positives, proposed out-of-scope items and build/test results. Compare the SAME self-contained synthetic fixture as PO-alone vs PO+specialist (new session per trial). Genuine production performance remains unverified until isolated microdelivery completed.

## 6. Known V1 failure modes
- V1 denied writing Claude's temporary plan files; V2 permits only Claude plan/scratchpad paths, NOT arbitrary external writing.
- `git status` when git root is unexpectedly parent may traverse unrelated OneDrive/Home directories; check root first and DO NOT run global git status if unexpected.
- Flutter copy contains .dart_tool/ephemeral/symlinks and duplicated async_Lucas; restrict scanning to lib/, pubspec.yaml, contract/openapi.yaml. Do not read generated .g.dart unless needed.
- Bash command patterns + hook are not a sandbox. For review-only work launch `--permission-mode plan`. Even plan mode can execute read-only shell commands; inspect each command for hidden effects.
