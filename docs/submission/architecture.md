# Referral Ready MCP Architecture

## Core path

1. Prompt Opinion opens a patient context.
2. The user invokes the `Referral Coordinator` agent.
3. The agent calls the external MCP server.
4. Prompt Opinion forwards FHIR context headers to the MCP server.
5. The worker fetches the patient chart or falls back to a synthetic bundle in demo mode.
6. The referral engine scores readiness, extracts evidence, and identifies missing workup.
7. Optional Google AI generation improves the packet, patient prep, and follow-up phrasing.
8. The worker returns structured outputs back to Prompt Opinion.

## Why the worker is stateless

The TypeScript MCP SDK does not conveniently pass HTTP request headers down into tool handlers on a shared server instance. Referral Ready avoids that trap by creating a fresh MCP server per HTTP request. That lets each tool call see the live Prompt Opinion FHIR headers without bolting on fragile global state.

## Why rules first, model second

The deterministic playbooks own:

- readiness scoring
- missing-workup checks
- red-flag surfacing
- citations

The LLM is only used to improve the narrative form of the outputs after the evidence and gaps are already determined.

## Contest fit

This architecture is optimized for:

- visible AI use
- meaningful healthcare workflow impact
- realistic implementation within the hackathon timeline

