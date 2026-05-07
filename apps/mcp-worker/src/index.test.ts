import { describe, expect, it } from "vitest";
import { createApp } from "./index";
import type { WorkerBindings } from "./config";

const testEnv: WorkerBindings = {
  DEMO_MODE: "true",
  ALLOWED_FHIR_HOSTS: "app.promptopinion.ai"
};

function parseSseJson(text: string) {
  const line = text
    .split("\n")
    .find((entry) => entry.startsWith("data: "));

  if (!line) {
    throw new Error("MCP response did not contain an SSE data payload.");
  }

  return JSON.parse(line.slice(6)) as Record<string, unknown>;
}

async function postMcp(body: Record<string, unknown>) {
  const app = createApp();
  const response = await app.request("http://example.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream"
    },
    body: JSON.stringify(body)
  }, testEnv);

  expect(response.status).toBe(200);
  return parseSseJson(await response.text());
}

describe("mcp worker", () => {
  it("returns health information", async () => {
    const app = createApp();
    const response = await app.request("http://example.com/health");

    expect(response.status).toBe(200);
    const payload = await response.json<{ status: string; supportedSpecialties: Array<{ specialtyId: string }> }>();
    expect(payload.status).toBe("ok");
    expect(payload.supportedSpecialties.length).toBe(2);
  });

  it("advertises Prompt Opinion FHIR context during initialize", async () => {
    const app = createApp();
    const response = await app.request("http://example.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "init",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "vitest",
            version: "0.1.0"
          }
        }
      })
    }, testEnv);

    expect(response.status).toBe(200);
    const payload = parseSseJson(await response.text());
    const capabilities = (payload.result as { capabilities?: Record<string, unknown> } | undefined)?.capabilities;
    const extensions = capabilities && typeof capabilities === "object"
      ? (capabilities.extensions as Record<string, unknown> | undefined)
      : undefined;

    expect(extensions?.["ai.promptopinion/fhir-context"]).toEqual({
      scopes: [
        { name: "patient/Patient.rs", required: true },
        { name: "patient/Condition.rs", required: false },
        { name: "patient/Observation.rs", required: false },
        { name: "patient/DiagnosticReport.rs", required: false },
        { name: "patient/DocumentReference.rs", required: false },
        { name: "patient/Encounter.rs", required: false },
        { name: "patient/MedicationRequest.rs", required: false }
      ]
    });
  });

  it("allows Prompt Opinion FHIR headers in CORS preflight responses", async () => {
    const app = createApp();
    const response = await app.request("http://example.com/mcp", {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.promptopinion.ai",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "content-type,mcp-protocol-version,x-fhir-server-url,x-fhir-access-token,x-patient-id"
      }
    });

    expect(response.status).toBe(204);
    const allowedHeaders = response.headers.get("Access-Control-Allow-Headers") ?? "";
    expect(allowedHeaders).toContain("X-FHIR-Server-URL");
    expect(allowedHeaders).toContain("X-FHIR-Access-Token");
    expect(allowedHeaders).toContain("X-Patient-ID");
  });

  it("returns compact readiness text while preserving structured content", async () => {
    const payload = await postMcp({
      jsonrpc: "2.0",
      id: "analyze",
      method: "tools/call",
      params: {
        name: "analyze_referral_readiness",
        arguments: {
          specialtyId: "gastroenterology",
          demoBundleId: "alex-martin-gi"
        }
      }
    });

    const result = payload.result as {
      content?: Array<{ text?: string }>;
      structuredContent?: {
        patientName?: string;
        presentEvidence?: Array<Record<string, unknown>>;
      };
    };
    const text = result.content?.[0]?.text ?? "";

    expect(result.structuredContent?.patientName).toBe("Alex Martin");
    expect(text).toContain("Readiness score: 70/100");
    expect(text).toContain("Missing workup:");
    expect(text).toContain("Alarm findings:");
    expect(text).not.toContain("\"presentEvidence\"");
    expect(text).not.toContain("\"missingEvidence\"");
    expect(result.structuredContent?.presentEvidence?.[0]).not.toHaveProperty("citations");
  });

  it("returns compact follow-up tasks in structured content", async () => {
    const payload = await postMcp({
      jsonrpc: "2.0",
      id: "tasks",
      method: "tools/call",
      params: {
        name: "create_followup_tasks",
        arguments: {
          specialtyId: "gastroenterology",
          demoBundleId: "alex-martin-gi"
        }
      }
    });

    const result = payload.result as {
      content?: Array<{ text?: string }>;
      structuredContent?: { tasks?: Array<Record<string, unknown>> };
    };
    const tasks = result.structuredContent?.tasks ?? [];

    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0]).toHaveProperty("title");
    expect(tasks[0]).toHaveProperty("owner");
    expect(tasks[0]).toHaveProperty("priority");
    expect(tasks[0]).toHaveProperty("dueInDays");
    expect(tasks[0]).not.toHaveProperty("detail");
  });

  it("returns compact export text and a bundle preview in structured content", async () => {
    const payload = await postMcp({
      jsonrpc: "2.0",
      id: "export",
      method: "tools/call",
      params: {
        name: "export_referral_bundle",
        arguments: {
          specialtyId: "gastroenterology",
          demoBundleId: "alex-martin-gi",
          exportMode: "full"
        }
      }
    });

    const result = payload.result as {
      content?: Array<{ text?: string }>;
      structuredContent?: {
        artifactCounts?: { documentReferenceCount?: number };
        bundlePreview?: { resourceType?: string; entryCount?: number; entries?: Array<Record<string, unknown>> };
      };
    };
    const text = result.content?.[0]?.text ?? "";

    expect(result.structuredContent?.bundlePreview?.resourceType).toBe("Bundle");
    expect(result.structuredContent?.bundlePreview?.entryCount).toBeGreaterThan(0);
    expect(result.structuredContent?.bundlePreview?.entries?.[0]).toHaveProperty("resourceType");
    expect(result.structuredContent?.artifactCounts?.documentReferenceCount).toBe(1);
    expect(text).toContain("Artifacts:");
    expect(text).toContain("Tasks:");
    expect(text).toContain("DocumentReferences:");
    expect(text).not.toContain("\"resourceType\": \"Bundle\"");
    expect(text).not.toContain("\"artifactCounts\"");
  });
});
