import alexBundle from "../../../data/synthetic-fhir/alex-martin-gi.json";
import mariaBundle from "../../../data/synthetic-fhir/maria-chen-cardio.json";
import { createPatientContext } from "@agents-assemble/fhir-utils";
import { analyzeReferralReadiness, createFollowupTasks, draftPatientPrep, draftReferralPacket, exportReferralBundle } from "@agents-assemble/referral-engine";
import type { FollowupTaskPlan, PatientPrepPlan, ReferralBundleExport, ReferralPacket, ReferralReadinessResult, SpecialtyId } from "@agents-assemble/shared-types";

export interface CaseStudy {
  id: string;
  specialtyId: SpecialtyId;
  specialtyName: string;
  patientName: string;
  summary: string;
  readiness: ReferralReadinessResult;
  packet: ReferralPacket;
  prep: PatientPrepPlan;
  tasks: FollowupTaskPlan;
  exportBundle: ReferralBundleExport;
}

async function buildCaseStudy(id: string, specialtyId: SpecialtyId, bundle: unknown): Promise<CaseStudy> {
  const context = createPatientContext(bundle);
  const readiness = analyzeReferralReadiness({ specialtyId, context });
  const packet = await draftReferralPacket({ specialtyId, context });
  const prep = await draftPatientPrep({ specialtyId, context });
  const tasks = await createFollowupTasks({ specialtyId, context });
  const exportBundle = await exportReferralBundle({ specialtyId, context });

  return {
    id,
    specialtyId,
    specialtyName: readiness.specialtyName,
    patientName: readiness.patientName,
    summary: readiness.summary,
    readiness,
    packet,
    prep,
    tasks,
    exportBundle
  };
}

export async function loadCaseStudies(): Promise<CaseStudy[]> {
  return Promise.all([
    buildCaseStudy("alex", "gastroenterology", alexBundle),
    buildCaseStudy("maria", "cardiology", mariaBundle)
  ]);
}

