# Prompt Opinion Marketplace Checklist

Use this list as the final gate before you record the demo video or open the Devpost form.

## Public runtime

- Worker health is live at `https://referral-ready-mcp.dpratik3005.workers.dev/health`.
- MCP endpoint is live at `https://referral-ready-mcp.dpratik3005.workers.dev/mcp`.
- Proof UI is live at `https://referral-ready-proof-ui.pages.dev`.
- Public repo is live at `https://github.com/PRADDZY/agents-assemble`.
- `pnpm verify` passes.
- `pnpm submissioncheck` passes.

## Worker runtime

- `GOOGLE_AI_API_KEY` is stored with `pnpm --filter @agents-assemble/mcp-worker exec wrangler secret put GOOGLE_AI_API_KEY`.
- `pnpm --filter @agents-assemble/mcp-worker exec wrangler secret list` shows the live secret.
- `DEMO_MODE=true` remains enabled so rehearsals can still fall back safely if Prompt Opinion context is unavailable.

## Prompt Opinion setup

1. Go to `Configuration -> Models` and confirm one working model config exists.
2. Go to `Patient Data -> Import`.
3. Upload `data/synthetic-fhir/alex-martin-gi.json`.
4. Upload `data/synthetic-fhir/maria-chen-cardio.json`.
5. Go to `Configuration -> MCP Servers`.
6. Add `https://referral-ready-mcp.dpratik3005.workers.dev/mcp`.
7. Click `Continue` so Prompt Opinion sends `initialize`.
8. Enable the Prompt Opinion FHIR context extension.
9. Grant the requested scopes:
   - `patient/Patient.rs`
   - `patient/Condition.rs`
   - `patient/Observation.rs`
   - `patient/DiagnosticReport.rs`
   - `patient/DocumentReference.rs`
   - `patient/Encounter.rs`
   - `patient/MedicationRequest.rs`
10. Save the MCP server.
11. Create the `Referral Coordinator` agent using [referral-coordinator-prompt.md](referral-coordinator-prompt.md).
12. Run the GI rehearsal flow from [prompt-opinion-runbook.md](prompt-opinion-runbook.md).
13. Run the cardiology rehearsal flow from [prompt-opinion-runbook.md](prompt-opinion-runbook.md).
14. Publish the MCP Marketplace entry.
15. Publish the `Referral Coordinator` BYO agent entry.
16. Capture both final share links:
   - MCP entry: `https://app.promptopinion.ai/marketplace/mcp/019e03f0-e8af-7305-a381-09001b3447dd`
   - Agent entry: `https://app.promptopinion.ai/marketplace/agent/019e0421-5978-7c30-9032-aaa2efc3ff4b`

## Proof UI and docs

- Set `VITE_MARKETPLACE_URL` to the MCP Marketplace link and redeploy the proof UI.
- Set `VITE_AGENT_MARKETPLACE_URL` to the BYO agent Marketplace link before the same redeploy.
- Set `VITE_DEMO_VIDEO_URL` to `https://youtu.be/NYVbcdDkd08` and redeploy the proof UI.
- README still matches the deployed URLs and the Marketplace status.
- No user-facing page still says `Marketplace Candidate`.

## Qualification checks

- The project is visible in the Prompt Opinion Marketplace.
- The `Referral Coordinator` agent is visible in the Prompt Opinion Marketplace.
- The project is invokable inside Prompt Opinion.
- The demo flow uses only synthetic or de-identified data.
- The MCP server works from a live patient context, not just `demoBundleId`.
- The final public Marketplace share link opens successfully.
- The export tool returns a FHIR bundle from the live Prompt Opinion workflow.

## User-owned tasks

- Fill the Devpost form with the description, Marketplace share link, and video URL.
