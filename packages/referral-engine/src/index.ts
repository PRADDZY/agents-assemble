import cardiologyPlaybook from "../../../data/specialty-playbooks/cardiology.json";
import gastroenterologyPlaybook from "../../../data/specialty-playbooks/gastroenterology.json";
import {
  getPatientName,
  resourceMatchesCodes,
  resourceText,
  resourceToCitation
} from "@agents-assemble/fhir-utils";
import type {
  Citation,
  ExportValidationNote,
  FhirResource,
  FollowupTaskPlan,
  MissingEvidenceItem,
  PatientContext,
  PatientPrepPlan,
  PresentEvidenceItem,
  ReferralBundleExport,
  ReferralExportMode,
  RedFlagFinding,
  ReferralEvidenceReport,
  ReferralPacket,
  ReferralReadinessResult,
  SpecialtyId,
  SpecialtyPlaybook
} from "@agents-assemble/shared-types";

const playbooks: Record<SpecialtyId, SpecialtyPlaybook> = {
  cardiology: cardiologyPlaybook as SpecialtyPlaybook,
  gastroenterology: gastroenterologyPlaybook as SpecialtyPlaybook
};

export interface NarrativeGenerator {
  draftPacket(input: {
    playbook: SpecialtyPlaybook;
    context: PatientContext;
    readiness: ReferralReadinessResult;
  }): Promise<ReferralPacket>;
  draftPatientPrep(input: {
    playbook: SpecialtyPlaybook;
    context: PatientContext;
    readiness: ReferralReadinessResult;
  }): Promise<PatientPrepPlan>;
  draftTasks(input: {
    playbook: SpecialtyPlaybook;
    context: PatientContext;
    readiness: ReferralReadinessResult;
  }): Promise<FollowupTaskPlan>;
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function safeIdToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "unknown";
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  return Buffer.from(bytes).toString("base64");
}

function patientId(context: PatientContext): string | null {
  return typeof context.patient?.id === "string" ? context.patient.id : null;
}

function patientReference(context: PatientContext): string | undefined {
  const id = patientId(context);
  return id ? `Patient/${id}` : undefined;
}

export function listSupportedSpecialties(): Array<{
  specialtyId: SpecialtyId;
  displayName: string;
  shortDescription: string;
}> {
  return Object.values(playbooks).map((playbook) => ({
    specialtyId: playbook.specialtyId,
    displayName: playbook.displayName,
    shortDescription: playbook.shortDescription
  }));
}

export function getPlaybook(specialtyId: SpecialtyId): SpecialtyPlaybook {
  return playbooks[specialtyId];
}

function normalizedKeywords(resourceTextValue: string, keywords: string[]): string[] {
  const haystack = resourceTextValue.toLowerCase();
  return keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
}

function matchRequirement(
  context: PatientContext,
  requirement: SpecialtyPlaybook["requiredEvidence"][number]
): PresentEvidenceItem | MissingEvidenceItem {
  const matchingResources = context.resources.filter((resource) => {
    if (!requirement.resourceTypes.includes(resource.resourceType)) {
      return false;
    }

    if (requirement.observationCodes) {
      if (resourceMatchesCodes(resource, requirement.observationCodes)) {
        return true;
      }

      if (!requirement.keywords || requirement.keywords.length === 0) {
        return false;
      }
    }

    if (!requirement.keywords || requirement.keywords.length === 0) {
      return true;
    }

    return normalizedKeywords(resourceText(resource), requirement.keywords).length > 0;
  });

  if (matchingResources.length === 0) {
    return {
      requirementId: requirement.id,
      label: requirement.label,
      rationale: requirement.rationale,
      suggestedAction: requirement.suggestedAction
    };
  }

  const citations = matchingResources.slice(0, 3).map((resource) => {
    const matchedKeywords = requirement.keywords ? normalizedKeywords(resourceText(resource), requirement.keywords) : [];
    const snippet = matchedKeywords.length > 0
      ? `Matched ${matchedKeywords.join(", ")} in ${resource.resourceType}`
      : resourceText(resource).slice(0, 140);
    return resourceToCitation(resource, snippet);
  });

  return {
    requirementId: requirement.id,
    label: requirement.label,
    rationale: requirement.rationale,
    citations,
    confidence: requirement.observationCodes ? "high" : "medium"
  };
}

function matchRedFlag(context: PatientContext, rule: SpecialtyPlaybook["redFlags"][number]): RedFlagFinding | null {
  const citations: Citation[] = [];

  for (const resource of context.resources) {
    const matchedKeywords = normalizedKeywords(resourceText(resource), rule.keywords);
    if (matchedKeywords.length > 0) {
      citations.push(resourceToCitation(resource, `Matched ${matchedKeywords.join(", ")}`));
    }
  }

  if (citations.length === 0) {
    return null;
  }

  return {
    id: rule.id,
    label: rule.label,
    severity: rule.severity,
    message: rule.message,
    citations: citations.slice(0, 3)
  };
}

export function analyzeReferralReadiness(input: {
  specialtyId: SpecialtyId;
  context: PatientContext;
  referralQuestion?: string;
}): ReferralReadinessResult {
  const playbook = getPlaybook(input.specialtyId);
  const patientName = getPatientName(input.context);
  const presentEvidence: PresentEvidenceItem[] = [];
  const missingEvidence: MissingEvidenceItem[] = [];

  for (const requirement of playbook.requiredEvidence) {
    const match = matchRequirement(input.context, requirement);
    if ("citations" in match) {
      presentEvidence.push(match);
    } else {
      missingEvidence.push(match);
    }
  }

  const redFlags = playbook.redFlags
    .map((rule) => matchRedFlag(input.context, rule))
    .filter((flag): flag is RedFlagFinding => Boolean(flag));

  const baseScore = Math.round((presentEvidence.length / playbook.requiredEvidence.length) * 100);
  const scorePenalty = redFlags.filter((flag) => flag.severity === "high").length * 10;
  const readinessScore = Math.max(20, Math.min(100, baseScore - scorePenalty));
  const readyForReferral = missingEvidence.length <= 1 && redFlags.filter((flag) => flag.severity === "high").length === 0;

  const suggestedNextSteps = [
    ...missingEvidence.map((item) => item.suggestedAction),
    ...redFlags.map((flag) => flag.message)
  ].slice(0, 5);

  const summaryBits = [
    `${patientName} has ${presentEvidence.length} of ${playbook.requiredEvidence.length} core ${playbook.displayName.toLowerCase()} referral elements ready.`,
    missingEvidence.length > 0 ? `${missingEvidence.length} gap${missingEvidence.length === 1 ? "" : "s"} remain before the packet is ideal.` : "No major referral gaps were detected.",
    redFlags.length > 0 ? `${redFlags.length} alarm finding${redFlags.length === 1 ? "" : "s"} should be highlighted.` : "No alarm findings were detected from the available chart text."
  ];

  return {
    specialtyId: playbook.specialtyId,
    specialtyName: playbook.displayName,
    patientName,
    referralQuestion: input.referralQuestion ?? playbook.defaultReferralQuestion,
    summary: summaryBits.join(" "),
    readinessScore,
    readyForReferral,
    presentEvidence,
    missingEvidence,
    redFlags,
    suggestedNextSteps
  };
}

export function extractReferralEvidence(input: {
  specialtyId: SpecialtyId;
  context: PatientContext;
  referralQuestion?: string;
}): ReferralEvidenceReport {
  const readiness = analyzeReferralReadiness(input);

  return {
    specialtyId: readiness.specialtyId,
    specialtyName: readiness.specialtyName,
    patientName: readiness.patientName,
    summary: readiness.summary,
    evidenceItems: readiness.presentEvidence.map((item) => ({
      title: item.label,
      detail: item.rationale,
      citations: item.citations
    }))
  };
}

function fallbackPacket(playbook: SpecialtyPlaybook, readiness: ReferralReadinessResult): ReferralPacket {
  const presentSummary = readiness.presentEvidence
    .map((item) => `- ${item.label}`)
    .join("\n");
  const missingSummary = readiness.missingEvidence.length > 0
    ? readiness.missingEvidence.map((item) => `- ${item.label}: ${item.suggestedAction}`).join("\n")
    : "- No major gaps detected.";

  const sections = playbook.packetSections.map((section) => {
    switch (section.id) {
      case "reason":
        return {
          title: section.title,
          body: `${readiness.referralQuestion}\n\nReadiness score: ${readiness.readinessScore}/100.`
        };
      case "history":
        return {
          title: section.title,
          body: `Key supporting evidence:\n${presentSummary || "- Limited supporting evidence captured."}`
        };
      case "workup":
        return {
          title: section.title,
          body: readiness.presentEvidence
            .map((item) => `${item.label}: ${item.citations.map((citation) => citation.label).join("; ")}`)
            .join("\n")
        };
      case "gaps":
        return {
          title: section.title,
          body: missingSummary
        };
      default:
        return {
          title: toTitleCase(section.id),
          body: section.promptHint
        };
    }
  });

  return {
    specialtyId: readiness.specialtyId,
    specialtyName: readiness.specialtyName,
    patientName: readiness.patientName,
    packetTitle: `${readiness.specialtyName} Referral Packet for ${readiness.patientName}`,
    sections,
    warnings: readiness.redFlags.map((flag) => flag.message),
    citations: readiness.presentEvidence.flatMap((item) => item.citations).slice(0, 8)
  };
}

function fallbackPrep(readiness: ReferralReadinessResult): PatientPrepPlan {
  return {
    specialtyId: readiness.specialtyId,
    specialtyName: readiness.specialtyName,
    patientName: readiness.patientName,
    summary: `Prepare ${readiness.patientName} for the ${readiness.specialtyName.toLowerCase()} visit with a focus on complete history, medication reconciliation, and missing pre-visit workup.`,
    checklist: [
      "Bring an updated medication list and pharmacy details.",
      ...readiness.missingEvidence.map((item) => item.suggestedAction),
      "Confirm symptom timeline, severity, and any recent worsening before the visit."
    ].slice(0, 6),
    questionsToAsk: [
      "What changed most in the last few weeks?",
      "What testing or treatment has already been tried?",
      "Are there any symptoms that should trigger earlier escalation?"
    ],
    urgentWarnings: readiness.redFlags.map((flag) => flag.message)
  };
}

function fallbackTasks(readiness: ReferralReadinessResult): FollowupTaskPlan {
  return {
    specialtyId: readiness.specialtyId,
    specialtyName: readiness.specialtyName,
    patientName: readiness.patientName,
    summary: `Close the missing referral gaps and route ${readiness.patientName}'s packet with explicit alarm findings.`,
    tasks: [
      ...readiness.missingEvidence.map((item) => ({
        title: `Collect: ${item.label}`,
        owner: "Ordering Clinician" as const,
        priority: "high" as const,
        dueInDays: 2,
        detail: item.suggestedAction
      })),
      {
        title: "Assemble specialist-ready packet",
        owner: "Care Coordinator" as const,
        priority: readiness.readyForReferral ? "medium" as const : "high" as const,
        dueInDays: 1,
        detail: "Attach the referral summary, supporting evidence, and any missing-workup notes."
      },
      {
        title: "Prepare patient outreach",
        owner: "Patient" as const,
        priority: "medium" as const,
        dueInDays: 3,
        detail: "Confirm medications, symptom timeline, and red-flag return precautions before the specialty visit."
      }
    ].slice(0, 6)
  };
}

function priorityForTask(priority: FollowupTaskPlan["tasks"][number]["priority"]): "urgent" | "routine" {
  return priority === "high" ? "urgent" : "routine";
}

function packetBody(packet: ReferralPacket): string {
  const sections = packet.sections.map((section) => `## ${section.title}\n${section.body}`).join("\n\n");
  const warnings = packet.warnings.length > 0 ? `\n\n## Warnings\n${packet.warnings.map((warning) => `- ${warning}`).join("\n")}` : "";
  return `# ${packet.packetTitle}\n\n${sections}${warnings}`.trim();
}

function buildTaskResource(input: {
  task: FollowupTaskPlan["tasks"][number];
  specialtyId: SpecialtyId;
  patientRef?: string;
  patientToken: string;
  generatedAt: string;
  index: number;
}): FhirResource {
  const endDate = new Date(input.generatedAt);
  endDate.setUTCDate(endDate.getUTCDate() + input.task.dueInDays);

  return {
    resourceType: "Task",
    id: `task-${input.specialtyId}-${input.patientToken}-${input.index + 1}`,
    status: "requested",
    intent: "proposal",
    priority: priorityForTask(input.task.priority),
    code: {
      text: input.task.title
    },
    description: input.task.detail,
    authoredOn: input.generatedAt,
    executionPeriod: {
      end: endDate.toISOString()
    },
    requester: {
      display: input.task.owner
    },
    ...(input.patientRef
      ? {
          for: {
            reference: input.patientRef
          }
        }
      : {})
  };
}

function buildPacketDocumentReference(input: {
  packet: ReferralPacket;
  specialtyId: SpecialtyId;
  patientRef?: string;
  patientToken: string;
  generatedAt: string;
}): FhirResource {
  return {
    resourceType: "DocumentReference",
    id: `referral-packet-${input.specialtyId}-${input.patientToken}`,
    status: "current",
    type: {
      text: `${input.packet.specialtyName} referral packet`
    },
    category: [
      {
        text: "referral-packet"
      }
    ],
    description: input.packet.packetTitle,
    date: input.generatedAt,
    ...(input.patientRef
      ? {
          subject: {
            reference: input.patientRef
          }
        }
      : {}),
    content: [
      {
        attachment: {
          contentType: "text/markdown",
          title: input.packet.packetTitle,
          data: encodeBase64(packetBody(input.packet))
        }
      }
    ]
  };
}

function buildProvenanceResource(input: {
  specialtyId: SpecialtyId;
  patientToken: string;
  generatedAt: string;
  targets: FhirResource[];
}): FhirResource {
  return {
    resourceType: "Provenance",
    id: `provenance-${input.specialtyId}-${input.patientToken}`,
    recorded: input.generatedAt,
    activity: {
      text: "Referral export assembled"
    },
    target: input.targets.map((resource) => ({
      reference: `${resource.resourceType}/${resource.id ?? "unknown"}`
    })),
    agent: [
      {
        type: {
          text: "assembler"
        },
        who: {
          display: "Referral Ready MCP"
        }
      }
    ]
  };
}

function buildBundle(input: { specialtyId: SpecialtyId; patientToken: string; generatedAt: string; resources: FhirResource[] }): FhirResource {
  return {
    resourceType: "Bundle",
    id: `referral-export-${input.specialtyId}-${input.patientToken}`,
    type: "collection",
    timestamp: input.generatedAt,
    entry: input.resources.map((resource) => ({
      fullUrl: `urn:uuid:${resource.id ?? `${resource.resourceType.toLowerCase()}-${input.patientToken}`}`,
      resource
    }))
  };
}

function exportValidationNotes(input: {
  context: PatientContext;
  readiness: ReferralReadinessResult;
  exportMode: ReferralExportMode;
}): ExportValidationNote[] {
  const notes: ExportValidationNote[] = [];

  if (!patientId(input.context)) {
    notes.push({
      level: "warning",
      message: "Patient resource did not expose an id, so export references use local artifact ids only."
    });
  }

  if (input.readiness.missingEvidence.length > 0) {
    notes.push({
      level: "info",
      message: `Export reflects ${input.readiness.missingEvidence.length} open referral gap(s) and should not be treated as final clearance.`
    });
  }

  if (input.exportMode !== "tasks" && input.readiness.redFlags.length > 0) {
    notes.push({
      level: "info",
      message: "The exported referral packet includes alarm findings and should be reviewed before downstream handoff."
    });
  }

  return notes;
}

export async function draftReferralPacket(input: {
  specialtyId: SpecialtyId;
  context: PatientContext;
  referralQuestion?: string;
  generator?: NarrativeGenerator;
}): Promise<ReferralPacket> {
  const playbook = getPlaybook(input.specialtyId);
  const readiness = analyzeReferralReadiness(input);

  if (!input.generator) {
    return fallbackPacket(playbook, readiness);
  }

  return input.generator.draftPacket({ playbook, context: input.context, readiness });
}

export async function draftPatientPrep(input: {
  specialtyId: SpecialtyId;
  context: PatientContext;
  referralQuestion?: string;
  generator?: NarrativeGenerator;
}): Promise<PatientPrepPlan> {
  const playbook = getPlaybook(input.specialtyId);
  const readiness = analyzeReferralReadiness(input);

  if (!input.generator) {
    return fallbackPrep(readiness);
  }

  return input.generator.draftPatientPrep({ playbook, context: input.context, readiness });
}

export async function createFollowupTasks(input: {
  specialtyId: SpecialtyId;
  context: PatientContext;
  referralQuestion?: string;
  generator?: NarrativeGenerator;
}): Promise<FollowupTaskPlan> {
  const playbook = getPlaybook(input.specialtyId);
  const readiness = analyzeReferralReadiness(input);

  if (!input.generator) {
    return fallbackTasks(readiness);
  }

  return input.generator.draftTasks({ playbook, context: input.context, readiness });
}

export async function exportReferralBundle(input: {
  specialtyId: SpecialtyId;
  context: PatientContext;
  referralQuestion?: string;
  generator?: NarrativeGenerator;
  exportMode?: ReferralExportMode;
  generatedAt?: string;
}): Promise<ReferralBundleExport> {
  const exportMode = input.exportMode ?? "full";
  const readiness = analyzeReferralReadiness(input);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const patientRef = patientReference(input.context);
  const patientToken = safeIdToken(patientId(input.context) ?? readiness.patientName);
  const resources: FhirResource[] = [];

  let taskCount = 0;
  let documentReferenceCount = 0;
  let provenanceCount = 0;

  if (exportMode !== "packet") {
    const tasks = await createFollowupTasks({
      specialtyId: input.specialtyId,
      context: input.context,
      referralQuestion: input.referralQuestion,
      generator: input.generator
    });
    const taskResources = tasks.tasks.map((task, index) =>
      buildTaskResource({
        task,
        specialtyId: input.specialtyId,
        patientRef,
        patientToken,
        generatedAt,
        index
      })
    );
    resources.push(...taskResources);
    taskCount = taskResources.length;
  }

  if (exportMode !== "tasks") {
    const packet = await draftReferralPacket({
      specialtyId: input.specialtyId,
      context: input.context,
      referralQuestion: input.referralQuestion,
      generator: input.generator
    });
    resources.push(
      buildPacketDocumentReference({
        packet,
        specialtyId: input.specialtyId,
        patientRef,
        patientToken,
        generatedAt
      })
    );
    documentReferenceCount = 1;
  }

  if (resources.length > 0) {
    resources.push(
      buildProvenanceResource({
        specialtyId: input.specialtyId,
        patientToken,
        generatedAt,
        targets: resources
      })
    );
    provenanceCount = 1;
  }

  return {
    specialtyId: readiness.specialtyId,
    specialtyName: readiness.specialtyName,
    patientName: readiness.patientName,
    patientId: patientId(input.context),
    exportMode,
    bundleType: "collection",
    summary: `Exported ${taskCount} Task resource${taskCount === 1 ? "" : "s"}, ${documentReferenceCount} DocumentReference resource${documentReferenceCount === 1 ? "" : "s"}, and ${provenanceCount} Provenance record for ${readiness.patientName}.`,
    warnings: readiness.redFlags.map((flag) => flag.message),
    validationNotes: exportValidationNotes({
      context: input.context,
      readiness,
      exportMode
    }),
    artifactCounts: {
      taskCount,
      documentReferenceCount,
      provenanceCount
    },
    bundle: buildBundle({
      specialtyId: input.specialtyId,
      patientToken,
      generatedAt,
      resources
    })
  };
}
