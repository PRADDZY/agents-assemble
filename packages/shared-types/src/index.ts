import { z } from "zod";

export const SpecialtyIdSchema = z.enum(["cardiology", "gastroenterology"]);
export type SpecialtyId = z.infer<typeof SpecialtyIdSchema>;

export const DemoBundleIdSchema = z.enum(["alex-martin-gi", "maria-chen-cardio"]);
export type DemoBundleId = z.infer<typeof DemoBundleIdSchema>;

export const ReferralToolInputSchema = z.object({
  specialtyId: SpecialtyIdSchema,
  referralQuestion: z.string().min(5).max(300).optional(),
  demoBundleId: DemoBundleIdSchema.optional()
});
export type ReferralToolInput = z.infer<typeof ReferralToolInputSchema>;

export interface Citation {
  resourceType: string;
  id: string;
  label: string;
  snippet: string;
}

export interface EvidenceRequirement {
  id: string;
  label: string;
  description: string;
  rationale: string;
  suggestedAction: string;
  resourceTypes: string[];
  keywords?: string[];
  observationCodes?: string[];
  optional?: boolean;
}

export interface RedFlagRule {
  id: string;
  label: string;
  severity: "high" | "medium";
  keywords: string[];
  message: string;
}

export interface PacketSectionTemplate {
  id: string;
  title: string;
  promptHint: string;
}

export interface SpecialtyPlaybook {
  specialtyId: SpecialtyId;
  displayName: string;
  shortDescription: string;
  defaultReferralQuestion: string;
  requiredEvidence: EvidenceRequirement[];
  optionalEvidence: EvidenceRequirement[];
  redFlags: RedFlagRule[];
  packetSections: PacketSectionTemplate[];
}

export type FhirResource = Record<string, unknown> & {
  resourceType: string;
  id?: string;
};

export interface ResourceNote {
  id: string;
  title: string;
  text: string;
  resourceType: string;
}

export interface PatientContext {
  patient: FhirResource | null;
  conditions: FhirResource[];
  observations: FhirResource[];
  diagnosticReports: FhirResource[];
  medicationRequests: FhirResource[];
  documentReferences: FhirResource[];
  encounters: FhirResource[];
  notes: ResourceNote[];
  resources: FhirResource[];
}

export interface PresentEvidenceItem {
  requirementId: string;
  label: string;
  rationale: string;
  citations: Citation[];
  confidence: "high" | "medium";
}

export interface MissingEvidenceItem {
  requirementId: string;
  label: string;
  rationale: string;
  suggestedAction: string;
}

export interface RedFlagFinding {
  id: string;
  label: string;
  severity: "high" | "medium";
  message: string;
  citations: Citation[];
}

export interface ReferralReadinessResult {
  specialtyId: SpecialtyId;
  specialtyName: string;
  patientName: string;
  referralQuestion: string;
  summary: string;
  readinessScore: number;
  readyForReferral: boolean;
  presentEvidence: PresentEvidenceItem[];
  missingEvidence: MissingEvidenceItem[];
  redFlags: RedFlagFinding[];
  suggestedNextSteps: string[];
}

export interface EvidenceSummaryItem {
  title: string;
  detail: string;
  citations: Citation[];
}

export interface ReferralEvidenceReport {
  specialtyId: SpecialtyId;
  specialtyName: string;
  patientName: string;
  summary: string;
  evidenceItems: EvidenceSummaryItem[];
}

export interface PacketSection {
  title: string;
  body: string;
}

export interface ReferralPacket {
  specialtyId: SpecialtyId;
  specialtyName: string;
  patientName: string;
  packetTitle: string;
  sections: PacketSection[];
  warnings: string[];
  citations: Citation[];
}

export interface PatientPrepPlan {
  specialtyId: SpecialtyId;
  specialtyName: string;
  patientName: string;
  summary: string;
  checklist: string[];
  questionsToAsk: string[];
  urgentWarnings: string[];
}

export interface FollowupTask {
  title: string;
  owner: "Care Coordinator" | "Ordering Clinician" | "Patient";
  priority: "high" | "medium" | "low";
  dueInDays: number;
  detail: string;
}

export interface FollowupTaskPlan {
  specialtyId: SpecialtyId;
  specialtyName: string;
  patientName: string;
  summary: string;
  tasks: FollowupTask[];
}

export const ReferralPacketSchema = z.object({
  specialtyId: SpecialtyIdSchema,
  specialtyName: z.string(),
  patientName: z.string(),
  packetTitle: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      body: z.string()
    })
  ),
  warnings: z.array(z.string()),
  citations: z.array(
    z.object({
      resourceType: z.string(),
      id: z.string(),
      label: z.string(),
      snippet: z.string()
    })
  )
});

export const PatientPrepPlanSchema = z.object({
  specialtyId: SpecialtyIdSchema,
  specialtyName: z.string(),
  patientName: z.string(),
  summary: z.string(),
  checklist: z.array(z.string()),
  questionsToAsk: z.array(z.string()),
  urgentWarnings: z.array(z.string())
});

export const FollowupTaskPlanSchema = z.object({
  specialtyId: SpecialtyIdSchema,
  specialtyName: z.string(),
  patientName: z.string(),
  summary: z.string(),
  tasks: z.array(
    z.object({
      title: z.string(),
      owner: z.enum(["Care Coordinator", "Ordering Clinician", "Patient"]),
      priority: z.enum(["high", "medium", "low"]),
      dueInDays: z.number(),
      detail: z.string()
    })
  )
});

