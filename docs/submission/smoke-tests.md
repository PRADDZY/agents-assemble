# Smoke Tests

## Local repo checks

```bash
pnpm verify
```

Checks:

- workspace type-checks
- unit tests
- builds
- secret scan

## Public submission checks

```bash
pnpm submissioncheck
```

Checks:

- public worker `/health`
- MCP `initialize`
- MCP `tools/list`
- MCP `analyze_referral_readiness` on the synthetic GI case
- MCP `export_referral_bundle` on the synthetic GI case
- public proof UI
- public GitHub repo

## After Marketplace publish

Run the same smoke check with the final share link in PowerShell:

```powershell
$env:MARKETPLACE_URL = "https://app.promptopinion.ai/..."
pnpm submissioncheck
Remove-Item Env:MARKETPLACE_URL
```

Expected result:

- every check prints `PASS`
- final line prints `Submission smoke checks passed.`
