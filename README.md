# Referral Ready MCP

Referral Ready MCP is a healthcare-focused MCP server for Prompt Opinion that turns patient context into specialist-ready referral outputs instead of generic chat summaries.

It is built for the `Agents Assemble` hackathon and focuses on one painful workflow: outpatient referrals that fail because the receiving specialist gets incomplete context, missing workup, or no clear referral question.

## What it does

- Scores whether a patient chart is actually ready for referral.
- Surfaces missing workup before the packet is sent.
- Extracts evidence from FHIR resources and chart notes.
- Drafts a specialist-ready referral packet.
- Generates patient prep and care-team follow-up tasks.
- Exports interoperable FHIR artifacts as Task, DocumentReference, and Provenance resources.
- Supports two MVP specialties: `gastroenterology` and `cardiology`.

## Architecture

- `apps/mcp-worker`
  Cloudflare Worker that exposes the MCP endpoint and reads Prompt Opinion FHIR headers.
- `packages/referral-engine`
  Deterministic specialty playbooks, readiness scoring, missing-workup detection, and fallback drafting logic.
- `packages/fhir-utils`
  FHIR bundle parsing, note extraction, and resource citation helpers.
- `apps/proof-ui`
  Static proof site for judges and public demo framing.
- `data/synthetic-fhir`
  Synthetic patient bundles for deterministic rehearsal and local testing.

## Local setup

Prerequisites:

- `Node.js 22+`
- `pnpm 10+`
- Cloudflare auth available through `wrangler` for deployment

Install:

```bash
pnpm install
```

Create local config files from the examples:

- root: `.env.example`
- worker: `apps/mcp-worker/.dev.vars.example`
- UI: `apps/proof-ui/.env.example`

Recommended local defaults:

- keep `DEMO_MODE=true` while developing
- add `GOOGLE_AI_API_KEY` only when you want live narrative drafting

Run locally:

```bash
pnpm dev:worker
pnpm dev:ui
```

## Verification

Run the full verification pass:

```bash
pnpm verify
```

Run the public submission smoke checks:

```bash
pnpm submissioncheck
```

That runs:

- workspace type-checks
- unit tests
- builds
- a lightweight secret-pattern scan

The submission smoke check hits the deployed worker, MCP endpoint, proof UI, and public repo. If you already have the final Marketplace share link in PowerShell, run:

```powershell
$env:MARKETPLACE_URL = "https://app.promptopinion.ai/..."
pnpm submissioncheck
Remove-Item Env:MARKETPLACE_URL
```

## Public links

- GitHub repo: `https://github.com/PRADDZY/agents-assemble`
- MCP worker: `https://referral-ready-mcp.dpratik3005.workers.dev/mcp`
- Worker health: `https://referral-ready-mcp.dpratik3005.workers.dev/health`
- Proof UI: `https://referral-ready-proof-ui.pages.dev`
- Prompt Opinion Marketplace share link: add after publish

## Deployment

Deploy the MCP worker:

```bash
pnpm deploy:worker
```

Deploy the proof UI:

```bash
pnpm deploy:ui
```

Before deploying the worker in live mode, set secrets with `wrangler secret put` instead of writing them into tracked files:

```bash
pnpm --filter @agents-assemble/mcp-worker exec wrangler secret put GOOGLE_AI_API_KEY
pnpm --filter @agents-assemble/mcp-worker exec wrangler secret list
```

## Prompt Opinion integration

Referral Ready expects Prompt Opinion to pass FHIR context headers when the MCP server is connected with the documented extension enabled:

- `X-FHIR-Server-URL`
- `X-FHIR-Access-Token`
- `X-Patient-ID`

The worker is intentionally stateless per request so each tool call can see the live Prompt Opinion headers.

Manual platform steps are documented in [docs/submission/marketplace-checklist.md](docs/submission/marketplace-checklist.md).

## Demo data

The repo includes two synthetic rehearsal cases:

- `alex-martin-gi`
  GI referral with weight loss, positive stool testing, and missing baseline chemistry/liver labs.
- `maria-chen-cardio`
  Cardiology referral with palpitations, ECG support, active meds, and risk-factor context.

## Submission assets

- Marketplace checklist: [docs/submission/marketplace-checklist.md](docs/submission/marketplace-checklist.md)
- Demo script: [docs/submission/demo-script.md](docs/submission/demo-script.md)
- Architecture note: [docs/submission/architecture.md](docs/submission/architecture.md)
- Prompt Opinion runbook: [docs/submission/prompt-opinion-runbook.md](docs/submission/prompt-opinion-runbook.md)
- Referral Coordinator prompt: [docs/submission/referral-coordinator-prompt.md](docs/submission/referral-coordinator-prompt.md)
- Judging map: [docs/submission/judging-map.md](docs/submission/judging-map.md)
- Smoke tests: [docs/submission/smoke-tests.md](docs/submission/smoke-tests.md)

## Scope note

This MVP is intentionally narrow. It is built to win on:

- `AI Factor`
- `Potential Impact`
- `Feasibility`

That means it prefers a polished referral workflow over a broad assistant that tries to do everything.

