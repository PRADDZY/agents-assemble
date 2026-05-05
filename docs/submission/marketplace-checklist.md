# Prompt Opinion Marketplace Checklist

## Before publish

- Deploy the MCP worker to a public Cloudflare Workers URL.
- Verify `/health` responds successfully.
- Confirm real secrets are stored via `wrangler secret put`.
- Keep `DEMO_MODE=true` only if you want synthetic fallback during rehearsals.

## Prompt Opinion setup

1. Go to `Configuration -> Models` and ensure a working model config exists.
2. Go to `Patient Data -> Import` and upload the synthetic FHIR R4 bundles.
3. Go to `Configuration -> MCP Servers`.
4. Add the public MCP URL ending in `/mcp`.
5. Click `Continue` so Prompt Opinion sends `initialize`.
6. Enable the Prompt Opinion FHIR context extension when prompted.
7. Grant the requested patient read scopes.
8. Save the MCP server configuration.
9. Create the `Referral Coordinator` agent and instruct it to call `analyze_referral_readiness` before drafting outputs.
10. Publish the entry to the Marketplace.
11. Open the published entry and capture the `Share Link`.

## Qualification checks

- The project is visible in the Marketplace.
- The project is invokable inside Prompt Opinion.
- The demo uses only synthetic or de-identified data.
- The public repo, worker URL, and proof UI are live.
- The recorded video is under 3 minutes.
