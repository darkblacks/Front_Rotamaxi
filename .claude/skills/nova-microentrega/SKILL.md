---
name: nova-microentrega
description: Victor-authorized scoped microdelivery contract for RotaMaxi; rules -> UX -> DEV -> independent QA.
disable-model-invocation: true
---
Read the literal Victor user request after this skill call. Only if Victor explicitly authorizes a microdelivery: identify exact allowed pages, behaviors, exclusions, risks, acceptance criteria and needed decisions; do not expand. Inspect relevant source, not entire repositories. Delegate sequentially to `regras-tms` (>=100 meaningful applicable rules per authorized page and BPMN/SMART), then `ux-tms` (four visual mockups only if NEW/REWORKED pages), then `dev-tms`, then `qa-tms`. If ambiguity or external impacts require Victor, STOP. No changes outside approved scope, no AWS/prod DB/deploy. See `.claude/v2/ORQUESTRACAO_E_CUSTO.md`.
