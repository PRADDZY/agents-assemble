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
15. Publish the agent to the Marketplace.
16. Open the published entry and copy the `Share Link`.

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

## Cardiology rehearsal

1. Open `Maria Chen`.
2. Invoke `Referral Coordinator`.
3. Ask: `Prepare a cardiology referral readiness review for this patient.`
4. Confirm the response surfaces:
   - palpitations / rhythm concern
   - ECG support
   - active medication context
5. Ask for the packet, patient prep, and follow-up tasks only if the GI flow is already stable.

## Publish-close actions

1. Put the final Marketplace share link into `apps/proof-ui/.env.local` as `VITE_MARKETPLACE_URL`.
2. Redeploy the proof UI with `pnpm deploy:ui`.
3. Re-run `pnpm submissioncheck`.
4. Only then record the video.
