import {
  analyzeReferralReadiness,
  createFollowupTasks,
  draftPatientPrep,
  draftReferralPacket,
  extractReferralEvidence,
  listSupportedSpecialties
} from "@agents-assemble/referral-engine";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ReferralToolInputSchema } from "@agents-assemble/shared-types";
import { GoogleNarrativeGenerator } from "./google";
import type { WorkerBindings } from "./config";
import type { RequestContext } from "./fhir";
import { resolvePatientContext } from "./fhir";

function toolResult(title: string, data: unknown) {
  const base = {
    content: [
      {
        type: "text" as const,
        text: `${title}\n\n${JSON.stringify(data, null, 2)}`
      }
    ]
  };

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return {
      ...base,
      structuredContent: data as Record<string, unknown>
    };
  };

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
        experimental: {
          "ai.promptopinion/fhir-context": fhirCapabilities()
        }
      },
      instructions:
        "Use list_supported_specialties first when unclear. Use analyze_referral_readiness before drafting packets or patient prep. Highlight alarm findings explicitly and never fabricate clinical facts."
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
      return toolResult("Supported specialties", listSupportedSpecialties());
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
      return toolResult(
        "Referral readiness analysis",
        analyzeReferralReadiness({
          specialtyId: args.specialtyId,
          referralQuestion: args.referralQuestion,
          context
        })
      );
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
      return toolResult(
        "Referral evidence",
        extractReferralEvidence({
          specialtyId: args.specialtyId,
          referralQuestion: args.referralQuestion,
          context
        })
      );
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
      return toolResult(
        "Referral packet",
        await draftReferralPacket({
          specialtyId: args.specialtyId,
          referralQuestion: args.referralQuestion,
          context,
          generator
        })
      );
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
      return toolResult(
        "Patient prep",
        await draftPatientPrep({
          specialtyId: args.specialtyId,
          referralQuestion: args.referralQuestion,
          context,
          generator
        })
      );
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
      return toolResult(
        "Follow-up tasks",
        await createFollowupTasks({
          specialtyId: args.specialtyId,
          referralQuestion: args.referralQuestion,
          context,
          generator
        })
      );
    }
  );

  return server;
}
