import { describe, expect, it } from "vitest";
import alexBundle from "../../../data/synthetic-fhir/alex-martin-gi.json";
import mariaBundle from "../../../data/synthetic-fhir/maria-chen-cardio.json";
import { createPatientContext } from "@agents-assemble/fhir-utils";
import { analyzeReferralReadiness, createFollowupTasks, draftReferralPacket } from "./index";

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
});
