# Prompt Opinion Runbook

## Values to use

- MCP server URL: `https://referral-ready-mcp.dpratik3005.workers.dev/mcp`
- Agent name: `Referral Coordinator`
- Demo case 1: `Alex Martin`
- Demo case 2: `Maria Chen`
- Supported specialties: `gastroenterology`, `cardiology`

## Click path

1. Open Prompt Opinion and select the target workspace.
2. Go to `Configuration -> Models` and confirm one model is available.
3. Go to `Patient Data -> Import`.
4. Import `alex-martin-gi.json`.
5. Import `maria-chen-cardio.json`.
6. Go to `Configuration -> MCP Servers`.
7. Add a new external MCP server.
8. Paste `https://referral-ready-mcp.dpratik3005.workers.dev/mcp`.
9. Click `Continue`.
10. Accept the `ai.promptopinion/fhir-context` extension.
11. Grant the requested patient read scopes.
12. Save the MCP server.
13. Create a new agent named `Referral Coordinator`.
14. Paste the system prompt from [referral-coordinator-prompt.md](referral-coordinator-prompt.md).
15. Publish the MCP entry to the Marketplace.
16. Publish the `Referral Coordinator` agent to the Marketplace.
17. Copy both share links:
   - MCP entry: `https://app.promptopinion.ai/marketplace/mcp/019e03f0-e8af-7305-a381-09001b3447dd`
   - Agent entry: `https://app.promptopinion.ai/marketplace/agent/019e0421-5978-7c30-9032-aaa2efc3ff4b`

## GI rehearsal

1. Open `Alex Martin`.
2. Invoke `Referral Coordinator`.
3. Ask: `Prepare a gastroenterology referral readiness review for this patient.`
4. Confirm the response surfaces:
   - missing baseline chemistry or liver markers
   - occult blood / bleeding concern
   - weight-loss alarm finding
5. Ask: `Now draft the specialist referral packet.`
6. Ask: `Now give me patient prep.`
7. Ask: `Now create follow-up tasks to close the gap.`
8. Ask: `Now export the referral bundle as FHIR resources.`
9. Confirm the response includes Task and DocumentReference resources.

## Cardiology rehearsal

1. Open `Maria Chen`.
2. Invoke `Referral Coordinator`.
3. Ask: `Prepare a cardiology referral readiness review for this patient.`
4. Confirm the response surfaces:
   - palpitations / rhythm concern
   - ECG support
   - active medication context
5. Ask for the packet, patient prep, follow-up tasks, and FHIR export only if the GI flow is already stable.

## Publish-close actions

1. Put the final MCP Marketplace share link into `apps/proof-ui/.env.local` as `VITE_MARKETPLACE_URL`.
2. Put the final BYO agent share link into `apps/proof-ui/.env.local` as `VITE_AGENT_MARKETPLACE_URL`.
3. Put the final video link into `apps/proof-ui/.env.local` as `VITE_DEMO_VIDEO_URL` (`https://youtu.be/NYVbcdDkd08`).
4. Redeploy the proof UI with `pnpm deploy:ui`.
5. Re-run `pnpm submissioncheck`.
