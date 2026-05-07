import {
  analyzeReferralReadiness,
  createFollowupTasks,
  draftPatientPrep,
  draftReferralPacket,
  exportReferralBundle,
  extractReferralEvidence,
  listSupportedSpecialties
} from "@agents-assemble/referral-engine";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ReferralExportToolInputSchema,
  ReferralToolInputSchema,
  type FollowupTaskPlan,
  type PatientPrepPlan,
  type ReferralBundleExport,
  type ReferralEvidenceReport,
  type ReferralPacket,
  type ReferralReadinessResult
} from "@agents-assemble/shared-types";
import { GoogleNarrativeGenerator } from "./google";
import type { WorkerBindings } from "./config";
import type { RequestContext } from "./fhir";
import { resolvePatientContext } from "./fhir";

function joinBullets(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None";
}

function formatSpecialties(
  specialties: ReturnType<typeof listSupportedSpecialties>
): string {
  return [
    "Supported specialties",
    "",
    ...specialties.map((specialty) => `- ${specialty.displayName} (${specialty.specialtyId}): ${specialty.shortDescription}`)
  ].join("\n");
}

function formatReadiness(result: ReferralReadinessResult): string {
  const missing = result.missingEvidence.map(
    (item) => `${item.label}: ${item.suggestedAction}`
  );
  const redFlags = result.redFlags.map(
    (flag) => `${flag.severity.toUpperCase()} - ${flag.label}: ${flag.message}`
  );

  return [
    "Referral readiness analysis",
    "",
    `Patient: ${result.patientName}`,
    `Specialty: ${result.specialtyName}`,
    `Ready for referral: ${result.readyForReferral ? "Yes" : "No"}`,
    `Readiness score: ${result.readinessScore}/100`,
    "",
    "Summary:",
    result.summary,
    "",
    "Missing workup:",
    joinBullets(missing),
    "",
    "Alarm findings:",
    joinBullets(redFlags),
    "",
    "Suggested next steps:",
    joinBullets(result.suggestedNextSteps)
  ].join("\n");
}

function formatEvidence(report: ReferralEvidenceReport): string {
  const items = report.evidenceItems.map((item) => {
    const citationLabels = item.citations.slice(0, 2).map((citation) => citation.label);
    const evidenceLine = citationLabels.length > 0 ? ` Evidence: ${citationLabels.join("; ")}.` : "";
    return `- ${item.title}: ${item.detail}.${evidenceLine}`;
  });

  return [
    "Referral evidence",
    "",
    `Patient: ${report.patientName}`,
    `Specialty: ${report.specialtyName}`,
    "",
    "Summary:",
    report.summary,
    "",
    "Evidence items:",
    joinBullets(items.map((item) => item.slice(2)))
  ].join("\n");
}

function formatPacket(packet: ReferralPacket): string {
  const warnings = joinBullets(packet.warnings);
  const sections = packet.sections.flatMap((section) => ["", section.title, section.body]);

  return [
    "Referral packet",
    "",
    `Title: ${packet.packetTitle}`,
    "",
    "Warnings:",
    warnings,
    "",
    "Sections:",
    ...sections
  ].join("\n");
}

function formatPatientPrep(plan: PatientPrepPlan): string {
  return [
    "Patient prep",
    "",
    `Patient: ${plan.patientName}`,
    `Specialty: ${plan.specialtyName}`,
    "",
    "Summary:",
    plan.summary,
    "",
    "Checklist:",
    joinBullets(plan.checklist),
    "",
    "Questions to ask:",
    joinBullets(plan.questionsToAsk),
    "",
    "Urgent warnings:",
    joinBullets(plan.urgentWarnings)
  ].join("\n");
}

function formatTasks(plan: FollowupTaskPlan): string {
  const tasks = plan.tasks.map(
    (task) => `${task.title} [${task.owner}, ${task.priority}, due in ${task.dueInDays} days]: ${task.detail}`
  );

  return [
    "Follow-up tasks",
    "",
    `Patient: ${plan.patientName}`,
    `Specialty: ${plan.specialtyName}`,
    "",
    "Summary:",
    plan.summary,
    "",
    "Tasks:",
    joinBullets(tasks)
  ].join("\n");
}

function formatExport(exportResult: ReferralBundleExport): string {
  const notes = exportResult.validationNotes.map(
    (note) => `${note.level.toUpperCase()}: ${note.message}`
  );

  return [
    "FHIR referral export",
    "",
    `Patient: ${exportResult.patientName}`,
    `Specialty: ${exportResult.specialtyName}`,
    `Mode: ${exportResult.exportMode}`,
    "",
    "Summary:",
    exportResult.summary,
    "",
    "Artifacts:",
    `- Tasks: ${exportResult.artifactCounts.taskCount}`,
    `- DocumentReferences: ${exportResult.artifactCounts.documentReferenceCount}`,
    `- Provenance: ${exportResult.artifactCounts.provenanceCount}`,
    "",
    "Warnings:",
    joinBullets(exportResult.warnings),
    "",
    "Validation notes:",
    joinBullets(notes)
  ].join("\n");
}

function compactReadinessStructuredContent(result: ReferralReadinessResult) {
  return {
    specialtyId: result.specialtyId,
    specialtyName: result.specialtyName,
    patientName: result.patientName,
    referralQuestion: result.referralQuestion,
    summary: result.summary,
    readinessScore: result.readinessScore,
    readyForReferral: result.readyForReferral,
    presentEvidence: result.presentEvidence.map((item) => ({
      requirementId: item.requirementId,
      label: item.label,
      confidence: item.confidence
    })),
    missingEvidence: result.missingEvidence.map((item) => ({
      requirementId: item.requirementId,
      label: item.label,
      suggestedAction: item.suggestedAction
    })),
    redFlags: result.redFlags.map((flag) => ({
      id: flag.id,
      label: flag.label,
      severity: flag.severity,
      message: flag.message
    })),
    suggestedNextSteps: result.suggestedNextSteps
  };
}

function compactEvidenceStructuredContent(report: ReferralEvidenceReport) {
  return {
    specialtyId: report.specialtyId,
    specialtyName: report.specialtyName,
    patientName: report.patientName,
    summary: report.summary,
    evidenceItems: report.evidenceItems.map((item) => ({
      title: item.title,
      detail: item.detail,
      citationLabels: item.citations.slice(0, 2).map((citation) => citation.label)
    }))
  };
}

function compactPacketStructuredContent(packet: ReferralPacket) {
  return {
    specialtyId: packet.specialtyId,
    specialtyName: packet.specialtyName,
    patientName: packet.patientName,
    packetTitle: packet.packetTitle,
    warnings: packet.warnings,
    sectionCount: packet.sections.length,
    sections: packet.sections.map((section) => ({
      title: section.title
    }))
  };
}

function compactPatientPrepStructuredContent(plan: PatientPrepPlan) {
  return {
    specialtyId: plan.specialtyId,
    specialtyName: plan.specialtyName,
    patientName: plan.patientName,
    summary: plan.summary,
    checklist: plan.checklist,
    questionsToAsk: plan.questionsToAsk,
    urgentWarnings: plan.urgentWarnings
  };
}

function compactTasksStructuredContent(plan: FollowupTaskPlan) {
  return {
    specialtyId: plan.specialtyId,
    specialtyName: plan.specialtyName,
    patientName: plan.patientName,
    summary: plan.summary,
    tasks: plan.tasks.map((task) => ({
      title: task.title,
      owner: task.owner,
      priority: task.priority,
      dueInDays: task.dueInDays
    }))
  };
}

function buildBundlePreview(bundle: ReferralBundleExport["bundle"]) {
  const rawEntries = Array.isArray(bundle.entry) ? bundle.entry : [];
  const entries = rawEntries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const resource = (entry as { resource?: unknown }).resource;
    if (!resource || typeof resource !== "object") {
      return [];
    }

    const fhirResource = resource as { resourceType?: unknown; id?: unknown };
    return [
      {
        resourceType:
          typeof fhirResource.resourceType === "string" ? fhirResource.resourceType : "Unknown",
        id: typeof fhirResource.id === "string" ? fhirResource.id : null
      }
    ];
  });

  return {
    resourceType: typeof bundle.resourceType === "string" ? bundle.resourceType : "Bundle",
    type: typeof bundle.type === "string" ? bundle.type : undefined,
    entryCount: entries.length,
    entries
  };
}

function compactExportStructuredContent(exportResult: ReferralBundleExport) {
  return {
    specialtyId: exportResult.specialtyId,
    specialtyName: exportResult.specialtyName,
    patientName: exportResult.patientName,
    patientId: exportResult.patientId,
    exportMode: exportResult.exportMode,
    bundleType: exportResult.bundleType,
    summary: exportResult.summary,
    warnings: exportResult.warnings,
    validationNotes: exportResult.validationNotes,
    artifactCounts: exportResult.artifactCounts,
    bundlePreview: buildBundlePreview(exportResult.bundle)
  };
}

function toolResult(text: string, data: unknown, structuredContent?: Record<string, unknown>) {
  const base = {
    content: [
      {
        type: "text" as const,
        text
      }
    ]
  };

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return {
      ...base,
      structuredContent: structuredContent ?? (data as Record<string, unknown>)
    };
  }

  return base;
}

function fhirCapabilities() {
  return {
    scopes: [
      { name: "patient/Patient.rs", required: true },
      { name: "patient/Condition.rs", required: false },
      { name: "patient/Observation.rs", required: false },
      { name: "patient/DiagnosticReport.rs", required: false },
      { name: "patient/DocumentReference.rs", required: false },
      { name: "patient/Encounter.rs", required: false },
      { name: "patient/MedicationRequest.rs", required: false }
    ]
  };
}

export function createReferralMcpServer(env: WorkerBindings, requestContext: RequestContext) {
  const generator = env.GOOGLE_AI_API_KEY ? new GoogleNarrativeGenerator(env) : undefined;
  const server = new McpServer(
    {
      name: "referral-ready-mcp",
      version: "0.1.0"
    },
    {
      capabilities: {
        logging: {},
        extensions: {
          "ai.promptopinion/fhir-context": fhirCapabilities()
        }
      },
      instructions:
        "Use list_supported_specialties first when unclear. Use analyze_referral_readiness before drafting packets, patient prep, or export bundles. Highlight alarm findings explicitly and never fabricate clinical facts."
    }
  );

  server.registerTool(
    "list_supported_specialties",
    {
      title: "List Supported Specialties",
      description: "List the referral workflows this MCP server supports.",
      inputSchema: z.object({})
    },
    async () => {
      const specialties = listSupportedSpecialties();
      return toolResult(formatSpecialties(specialties), specialties);
    }
  );

  server.registerTool(
    "analyze_referral_readiness",
    {
      title: "Analyze Referral Readiness",
      description:
        "Analyze whether the current patient chart has the required workup and documentation for a specialist-ready referral packet.",
      inputSchema: ReferralToolInputSchema
    },
    async (args) => {
      const context = await resolvePatientContext({
        specialtyId: args.specialtyId,
        demoBundleId: args.demoBundleId,
        requestContext,
        env
      });
      const result = analyzeReferralReadiness({
        specialtyId: args.specialtyId,
        referralQuestion: args.referralQuestion,
        context
      });
      return toolResult(formatReadiness(result), result, compactReadinessStructuredContent(result));
    }
  );

  server.registerTool(
    "extract_referral_evidence",
    {
      title: "Extract Referral Evidence",
      description: "Extract the evidence that supports the referral and cite the underlying FHIR resources.",
      inputSchema: ReferralToolInputSchema
    },
    async (args) => {
      const context = await resolvePatientContext({
        specialtyId: args.specialtyId,
        demoBundleId: args.demoBundleId,
        requestContext,
        env
      });
      const result = extractReferralEvidence({
        specialtyId: args.specialtyId,
        referralQuestion: args.referralQuestion,
        context
      });
      return toolResult(formatEvidence(result), result, compactEvidenceStructuredContent(result));
    }
  );

  server.registerTool(
    "draft_referral_packet",
    {
      title: "Draft Referral Packet",
      description: "Draft a specialist-ready referral packet from the chart evidence and missing-workup analysis.",
      inputSchema: ReferralToolInputSchema
    },
    async (args) => {
      const context = await resolvePatientContext({
        specialtyId: args.specialtyId,
        demoBundleId: args.demoBundleId,
        requestContext,
        env
      });
      const result = await draftReferralPacket({
        specialtyId: args.specialtyId,
        referralQuestion: args.referralQuestion,
        context,
        generator
      });
      return toolResult(formatPacket(result), result, compactPacketStructuredContent(result));
    }
  );

  server.registerTool(
    "draft_patient_prep",
    {
      title: "Draft Patient Prep",
      description: "Draft a patient-facing pre-visit checklist and questions for the specialist visit.",
      inputSchema: ReferralToolInputSchema
    },
    async (args) => {
      const context = await resolvePatientContext({
        specialtyId: args.specialtyId,
        demoBundleId: args.demoBundleId,
        requestContext,
        env
      });
      const result = await draftPatientPrep({
        specialtyId: args.specialtyId,
        referralQuestion: args.referralQuestion,
        context,
        generator
      });
      return toolResult(formatPatientPrep(result), result, compactPatientPrepStructuredContent(result));
    }
  );

  server.registerTool(
    "create_followup_tasks",
    {
      title: "Create Follow-Up Tasks",
      description: "Create care-team follow-up tasks that close referral gaps and prepare the visit.",
      inputSchema: ReferralToolInputSchema
    },
    async (args) => {
      const context = await resolvePatientContext({
        specialtyId: args.specialtyId,
        demoBundleId: args.demoBundleId,
        requestContext,
        env
      });
      const result = await createFollowupTasks({
        specialtyId: args.specialtyId,
        referralQuestion: args.referralQuestion,
        context,
        generator
      });
      return toolResult(formatTasks(result), result, compactTasksStructuredContent(result));
    }
  );

  server.registerTool(
    "export_referral_bundle",
    {
      title: "Export Referral Bundle",
      description:
        "Export standards-native referral artifacts as a FHIR Bundle containing Task, DocumentReference, and Provenance resources.",
      inputSchema: ReferralExportToolInputSchema
    },
    async (args) => {
      const context = await resolvePatientContext({
        specialtyId: args.specialtyId,
        demoBundleId: args.demoBundleId,
        requestContext,
        env
      });
      const result = await exportReferralBundle({
        specialtyId: args.specialtyId,
        referralQuestion: args.referralQuestion,
        exportMode: args.exportMode,
        context,
        generator
      });
      return toolResult(formatExport(result), result, compactExportStructuredContent(result));
    }
  );

  return server;
}
