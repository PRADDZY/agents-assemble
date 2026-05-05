import alexBundle from "../../../data/synthetic-fhir/alex-martin-gi.json";
import mariaBundle from "../../../data/synthetic-fhir/maria-chen-cardio.json";
import { createPatientContext } from "@agents-assemble/fhir-utils";
import type { DemoBundleId, FhirResource, PatientContext, SpecialtyId } from "@agents-assemble/shared-types";
import { allowedFhirHosts, isDemoMode, type WorkerBindings } from "./config";

export interface RequestContext {
  fhirServerUrl?: string;
  fhirAccessToken?: string;
  patientId?: string;
}

const demoBundles = {
  "alex-martin-gi": alexBundle,
  "maria-chen-cardio": mariaBundle
} as const;

function defaultBundleForSpecialty(specialtyId: SpecialtyId): DemoBundleId {
  return specialtyId === "cardiology" ? "maria-chen-cardio" : "alex-martin-gi";
}

function ensureAllowedHost(baseUrl: string, env: WorkerBindings): void {
  const url = new URL(baseUrl);
  if (!allowedFhirHosts(env).includes(url.hostname)) {
    throw new Error(`FHIR host ${url.hostname} is not allowlisted.`);
  }
}

async function fetchJson(url: string, token?: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/fhir+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`FHIR request failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  return await response.json<Record<string, unknown>>();
}

async function fetchSearchBundle(
  baseUrl: string,
  token: string | undefined,
  resourceType: string,
  query: string
): Promise<FhirResource[]> {
  let nextUrl: string | null = `${baseUrl.replace(/\/$/, "")}/${resourceType}?${query}&_count=100`;
  const results: FhirResource[] = [];
  const seen = new Set<string>();

  while (nextUrl && !seen.has(nextUrl) && results.length < 200) {
    seen.add(nextUrl);
    const bundle = await fetchJson(nextUrl, token);
    const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
    for (const entry of entries) {
      if (typeof entry === "object" && entry && "resource" in entry) {
        const resource = (entry as { resource?: FhirResource }).resource;
        if (resource?.resourceType) {
          results.push(resource);
        }
      }
    }

    const links = Array.isArray(bundle.link) ? bundle.link : [];
    const nextLink = links.find((link) => typeof (link as { relation?: unknown }).relation === "string" && (link as { relation: string }).relation === "next") as
      | { url?: string }
      | undefined;
    nextUrl = nextLink?.url ?? null;
  }

  return results;
}

async function fetchLivePatientContext(requestContext: RequestContext, env: WorkerBindings): Promise<PatientContext> {
  if (!requestContext.fhirServerUrl || !requestContext.patientId) {
    throw new Error("Prompt Opinion FHIR context is missing. Connect the MCP server with FHIR context enabled or use a demo bundle.");
  }

  ensureAllowedHost(requestContext.fhirServerUrl, env);
  const baseUrl = requestContext.fhirServerUrl.replace(/\/$/, "");
  const token = requestContext.fhirAccessToken;
  const patientUrl = `${baseUrl}/Patient/${requestContext.patientId}`;
  const patient = await fetchJson(patientUrl, token);

  const resources = [
    patient as FhirResource,
    ...(await fetchSearchBundle(baseUrl, token, "Condition", `patient=${requestContext.patientId}`)),
    ...(await fetchSearchBundle(baseUrl, token, "Observation", `patient=${requestContext.patientId}`)),
    ...(await fetchSearchBundle(baseUrl, token, "DiagnosticReport", `patient=${requestContext.patientId}`)),
    ...(await fetchSearchBundle(baseUrl, token, "DocumentReference", `patient=${requestContext.patientId}`)),
    ...(await fetchSearchBundle(baseUrl, token, "Encounter", `patient=${requestContext.patientId}`)),
    ...(await fetchSearchBundle(baseUrl, token, "MedicationRequest", `subject=Patient/${requestContext.patientId}`))
  ];

  return createPatientContext(resources);
}

export function requestContextFromHeaders(headers: Headers): RequestContext {
  return {
    fhirServerUrl: headers.get("X-FHIR-Server-URL") ?? undefined,
    fhirAccessToken: headers.get("X-FHIR-Access-Token") ?? undefined,
    patientId: headers.get("X-Patient-ID") ?? undefined
  };
}

export async function resolvePatientContext(input: {
  specialtyId: SpecialtyId;
  demoBundleId?: DemoBundleId;
  requestContext: RequestContext;
  env: WorkerBindings;
}): Promise<PatientContext> {
  if (input.demoBundleId) {
    return createPatientContext(demoBundles[input.demoBundleId]);
  }

  if (input.requestContext.fhirServerUrl && input.requestContext.patientId) {
    return fetchLivePatientContext(input.requestContext, input.env);
  }

  if (isDemoMode(input.env)) {
    return createPatientContext(demoBundles[defaultBundleForSpecialty(input.specialtyId)]);
  }

  throw new Error("No FHIR context was provided and demo mode is disabled.");
}

