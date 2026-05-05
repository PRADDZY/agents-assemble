import type {
  FollowupTaskPlan,
  PatientContext,
  PatientPrepPlan,
  ReferralPacket,
  ReferralReadinessResult,
  SpecialtyPlaybook
} from "@agents-assemble/shared-types";
import { getPatientName } from "@agents-assemble/fhir-utils";
import type { NarrativeGenerator } from "@agents-assemble/referral-engine";
import { FollowupTaskPlanSchema, PatientPrepPlanSchema, ReferralPacketSchema } from "@agents-assemble/shared-types";
import type { WorkerBindings } from "./config";

function contextDigest(context: PatientContext, readiness: ReferralReadinessResult): string {
  const noteDigest = context.notes.map((note) => `- ${note.title}: ${note.text}`).join("\n");
  const presentDigest = readiness.presentEvidence
    .map((item) => `- ${item.label}: ${item.citations.map((citation) => citation.label).join("; ")}`)
    .join("\n");
  const missingDigest = readiness.missingEvidence
    .map((item) => `- ${item.label}: ${item.suggestedAction}`)
    .join("\n");

  return [
    `Patient: ${getPatientName(context)}`,
    `Referral question: ${readiness.referralQuestion}`,
    `Summary: ${readiness.summary}`,
    "Present evidence:",
    presentDigest || "- None",
    "Missing evidence:",
    missingDigest || "- None",
    "Notes:",
    noteDigest || "- None"
  ].join("\n");
}

async function generateStructuredJson<T>(input: {
  env: WorkerBindings;
  prompt: string;
  schema: Record<string, unknown>;
  validator: (value: unknown) => T;
}): Promise<T> {
  const apiKey = input.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured.");
  }

  const model = input.env.GOOGLE_MODEL ?? "gemini-2.0-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: input.prompt }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: input.schema
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google model request failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = await response.json<Record<string, unknown>>();
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const text = candidates[0] && typeof candidates[0] === "object"
    ? (candidates[0] as { content?: { parts?: Array<{ text?: string }> } }).content?.parts?.[0]?.text
    : undefined;

  if (!text) {
    throw new Error("Google model response did not contain text output.");
  }

  return input.validator(JSON.parse(text));
}

export class GoogleNarrativeGenerator implements NarrativeGenerator {
  constructor(private readonly env: WorkerBindings) {}

  async draftPacket(input: {
    playbook: SpecialtyPlaybook;
    context: PatientContext;
    readiness: ReferralReadinessResult;
  }): Promise<ReferralPacket> {
    const schema = {
      type: "object",
      properties: {
        packetTitle: { type: "string" },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "string" }
            },
            required: ["title", "body"]
          }
        },
        warnings: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["packetTitle", "sections", "warnings"]
    };

    const prompt = [
      `You are drafting a ${input.playbook.displayName} referral packet for a care coordinator.`,
      "Be concise, clinical, and specific. Do not fabricate data. Only use the provided context.",
      "Return JSON that matches the requested schema.",
      contextDigest(input.context, input.readiness)
    ].join("\n\n");

    const generated = await generateStructuredJson({
      env: this.env,
      prompt,
      schema,
      validator: (value) => value as {
        packetTitle: string;
        sections: Array<{ title: string; body: string }>;
        warnings: string[];
      }
    });

    return ReferralPacketSchema.parse({
      specialtyId: input.readiness.specialtyId,
      specialtyName: input.readiness.specialtyName,
      patientName: input.readiness.patientName,
      packetTitle: generated.packetTitle,
      sections: generated.sections,
      warnings: generated.warnings,
      citations: input.readiness.presentEvidence.flatMap((item) => item.citations).slice(0, 8)
    });
  }

  async draftPatientPrep(input: {
    playbook: SpecialtyPlaybook;
    context: PatientContext;
    readiness: ReferralReadinessResult;
  }): Promise<PatientPrepPlan> {
    const schema = {
      type: "object",
      properties: {
        summary: { type: "string" },
        checklist: { type: "array", items: { type: "string" } },
        questionsToAsk: { type: "array", items: { type: "string" } },
        urgentWarnings: { type: "array", items: { type: "string" } }
      },
      required: ["summary", "checklist", "questionsToAsk", "urgentWarnings"]
    };

    const prompt = [
      `You are preparing a patient-friendly checklist before a ${input.playbook.displayName} visit.`,
      "Use plain language, but keep it clinically accurate. Do not invent tests or diagnoses.",
      "Return JSON that matches the requested schema.",
      contextDigest(input.context, input.readiness)
    ].join("\n\n");

    const generated = await generateStructuredJson({
      env: this.env,
      prompt,
      schema,
      validator: (value) => value as Omit<PatientPrepPlan, "specialtyId" | "specialtyName" | "patientName">
    });

    return PatientPrepPlanSchema.parse({
      specialtyId: input.readiness.specialtyId,
      specialtyName: input.readiness.specialtyName,
      patientName: input.readiness.patientName,
      ...generated
    });
  }

  async draftTasks(input: {
    playbook: SpecialtyPlaybook;
    context: PatientContext;
    readiness: ReferralReadinessResult;
  }): Promise<FollowupTaskPlan> {
    const schema = {
      type: "object",
      properties: {
        summary: { type: "string" },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              owner: { type: "string", enum: ["Care Coordinator", "Ordering Clinician", "Patient"] },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              dueInDays: { type: "number" },
              detail: { type: "string" }
            },
            required: ["title", "owner", "priority", "dueInDays", "detail"]
          }
        }
      },
      required: ["summary", "tasks"]
    };

    const prompt = [
      `You are creating follow-up tasks for a ${input.playbook.displayName} referral workflow.`,
      "Create operational tasks for a care team. Keep them concrete and short.",
      "Return JSON that matches the requested schema.",
      contextDigest(input.context, input.readiness)
    ].join("\n\n");

    const generated = await generateStructuredJson({
      env: this.env,
      prompt,
      schema,
      validator: (value) => value as Omit<FollowupTaskPlan, "specialtyId" | "specialtyName" | "patientName">
    });

    return FollowupTaskPlanSchema.parse({
      specialtyId: input.readiness.specialtyId,
      specialtyName: input.readiness.specialtyName,
      patientName: input.readiness.patientName,
      ...generated
    });
  }
}

