import { describe, expect, it } from "vitest";
import alexBundle from "../../../data/synthetic-fhir/alex-martin-gi.json";
import mariaBundle from "../../../data/synthetic-fhir/maria-chen-cardio.json";
import { createPatientContext } from "@agents-assemble/fhir-utils";
import { analyzeReferralReadiness, createFollowupTasks, draftReferralPacket, exportReferralBundle } from "./index";

describe("referral engine", () => {
  it("finds missing chemistry labs for the GI demo patient", () => {
    const context = createPatientContext(alexBundle);
    const result = analyzeReferralReadiness({
      specialtyId: "gastroenterology",
      context
    });

    expect(result.patientName).toBe("Alex Martin");
    expect(result.presentEvidence.length).toBeGreaterThan(0);
    expect(result.missingEvidence.some((item) => item.requirementId === "baseline-labs")).toBe(true);
    expect(result.redFlags.some((flag) => flag.id === "gi-bleeding-flag")).toBe(true);
  });

  it("marks the cardiology demo patient as having ECG support", async () => {
    const context = createPatientContext(mariaBundle);
    const result = analyzeReferralReadiness({
      specialtyId: "cardiology",
      context
    });

    expect(result.presentEvidence.some((item) => item.requirementId === "ecg-data")).toBe(true);

    const packet = await draftReferralPacket({
      specialtyId: "cardiology",
      context
    });

    expect(packet.sections.some((section) => section.title === "Completed Workup")).toBe(true);

    const tasks = await createFollowupTasks({
      specialtyId: "cardiology",
      context
    });

    expect(tasks.tasks.length).toBeGreaterThan(0);
  });

  it("exports a full FHIR bundle with task, packet, and provenance resources", async () => {
    const context = createPatientContext(alexBundle);
    const exported = await exportReferralBundle({
      specialtyId: "gastroenterology",
      context,
      exportMode: "full",
      generatedAt: "2026-05-06T00:00:00.000Z"
    });

    expect(exported.patientId).toBe("alex-martin");
    expect(exported.artifactCounts.taskCount).toBeGreaterThan(0);
    expect(exported.artifactCounts.documentReferenceCount).toBe(1);
    expect(exported.artifactCounts.provenanceCount).toBe(1);

    const entries = Array.isArray(exported.bundle.entry) ? exported.bundle.entry : [];
    const resources = entries.map((entry) => (entry as { resource?: { resourceType?: string; id?: string } }).resource);
    const documentReference = resources.find((resource) => resource?.resourceType === "DocumentReference") as
      | { subject?: { reference?: string }; content?: Array<{ attachment?: { data?: string } }> }
      | undefined;
    const provenance = resources.find((resource) => resource?.resourceType === "Provenance") as
      | { target?: Array<{ reference?: string }> }
      | undefined;

    expect(resources.some((resource) => resource?.resourceType === "Task")).toBe(true);
    expect(documentReference?.subject?.reference).toBe("Patient/alex-martin");
    expect(documentReference?.content?.[0]?.attachment?.data).toBeTruthy();
    expect(provenance?.target?.some((target) => target.reference?.startsWith("Task/"))).toBe(true);
  });

  it("falls back to deterministic outputs when the narrative generator fails", async () => {
    const context = createPatientContext(alexBundle);
    const failingGenerator = {
      draftPacket: async () => {
        throw new Error("quota exceeded");
      },
      draftPatientPrep: async () => {
        throw new Error("quota exceeded");
      },
      draftTasks: async () => {
        throw new Error("quota exceeded");
      }
    };

    const packet = await draftReferralPacket({
      specialtyId: "gastroenterology",
      context,
      generator: failingGenerator
    });

    expect(packet.packetTitle).toContain("Alex Martin");

    const exported = await exportReferralBundle({
      specialtyId: "gastroenterology",
      context,
      exportMode: "full",
      generator: failingGenerator,
      generatedAt: "2026-05-06T00:00:00.000Z"
    });

    expect(exported.bundle.resourceType).toBe("Bundle");
    expect(exported.artifactCounts.documentReferenceCount).toBe(1);
    expect(exported.artifactCounts.taskCount).toBeGreaterThan(0);
  });
});
