# Judging Map

## AI Factor

- The MCP server is not a chat wrapper. It exposes a focused six-tool workflow surface with structured outputs.
- Prompt Opinion passes live FHIR context into the worker, so the agent acts on patient-specific chart data rather than a pasted summary.
- Deterministic rules own readiness scoring, missing-workup detection, and red-flag surfacing.
- Google AI is used only where narrative lift matters: packet drafting, patient prep, and follow-up phrasing.
- Referral Ready now exports FHIR-native artifacts, so the workflow ends in interoperable deliverables rather than UI-only text.

## Potential Impact

- Referral leakage is a real last-mile healthcare problem: incomplete packets waste specialist capacity and delay care.
- The outputs are operational artifacts that care teams can act on immediately:
  - readiness table
  - evidence extraction
  - referral packet
  - patient prep
  - follow-up tasks
  - FHIR export bundle
- The demo is narrow enough to feel real, not aspirational.

## Feasibility

- The worker is stateless and deploys on Cloudflare Workers.
- The core logic is deterministic and covered by unit tests.
- Synthetic FHIR cases are bundled into the repo for rehearsal and fallback.
- The public proof UI, repo, and worker are already live, reducing last-minute demo risk.

## What to emphasize in the pitch

- This runs inside Prompt Opinion.
- It uses patient-context-aware MCP, not a one-off prompt.
- It catches missing workup before the specialist visit is wasted.
- It produces workflow artifacts and FHIR-native exports, not generic summaries.
