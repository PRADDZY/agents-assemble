import type { Citation, FhirResource, PatientContext, ResourceNote } from "@agents-assemble/shared-types";

function resourceArray(input: unknown): FhirResource[] {
  if (!input || typeof input !== "object") {
    return [];
  }

  if (Array.isArray(input)) {
    return input.filter((item): item is FhirResource => typeof item === "object" && item !== null && "resourceType" in item);
  }

  const bundle = input as { entry?: Array<{ resource?: FhirResource }> };
  return (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter((resource): resource is FhirResource => Boolean(resource?.resourceType));
}

function decodeBase64(value: string): string {
  if (typeof atob === "function") {
    return atob(value);
  }

  return Buffer.from(value, "base64").toString("utf8");
}

function pickNoteText(resource: FhirResource): string | null {
  if (resource.resourceType !== "DocumentReference") {
    return null;
  }

  const content = Array.isArray(resource.content) ? resource.content[0] : undefined;
  const attachment = content?.attachment as Record<string, string> | undefined;

  if (attachment?.data) {
    try {
      return decodeBase64(attachment.data);
    } catch {
      return attachment.data;
    }
  }

  if (attachment?.title) {
    return attachment.title;
  }

  return null;
}

function buildNote(resource: FhirResource): ResourceNote | null {
  const text = pickNoteText(resource);
  if (!text) {
    return null;
  }

  return {
    id: resource.id ?? "unknown-note",
    title: text.split("\n")[0].slice(0, 80),
    text,
    resourceType: resource.resourceType
  };
}

export function createPatientContext(resourcesInput: unknown): PatientContext {
  const resources = resourceArray(resourcesInput);
  const patient = resources.find((resource) => resource.resourceType === "Patient") ?? null;
  const notes = resources.map(buildNote).filter((note): note is ResourceNote => Boolean(note));

  return {
    patient,
    conditions: resources.filter((resource) => resource.resourceType === "Condition"),
    observations: resources.filter((resource) => resource.resourceType === "Observation"),
    diagnosticReports: resources.filter((resource) => resource.resourceType === "DiagnosticReport"),
    medicationRequests: resources.filter((resource) => resource.resourceType === "MedicationRequest"),
    documentReferences: resources.filter((resource) => resource.resourceType === "DocumentReference"),
    encounters: resources.filter((resource) => resource.resourceType === "Encounter"),
    notes,
    resources
  };
}

export function getPatientName(context: PatientContext): string {
  const names = Array.isArray(context.patient?.name) ? (context.patient?.name as Array<Record<string, unknown>>) : [];
  const first = names[0];
  if (!first) {
    return "Unknown Patient";
  }

  const given = Array.isArray(first.given) ? first.given.join(" ") : "";
  const family = typeof first.family === "string" ? first.family : "";
  const display = `${given} ${family}`.trim();

  return display || "Unknown Patient";
}

export function getResourceDisplay(resource: FhirResource): string {
  if (resource.resourceType === "Observation" || resource.resourceType === "DiagnosticReport") {
    const code = resource.code as Record<string, unknown> | undefined;
    const coding = Array.isArray(code?.coding) ? code?.coding[0] as Record<string, unknown> : undefined;
    const display = typeof coding?.display === "string" ? coding.display : undefined;
    const text = typeof code?.text === "string" ? code.text : undefined;
    const valueQuantity = resource.valueQuantity as Record<string, unknown> | undefined;
    const quantityText = valueQuantity?.value ? `${valueQuantity.value} ${valueQuantity.unit ?? ""}`.trim() : "";
    const base = display ?? text ?? resource.resourceType;
    return quantityText ? `${base}: ${quantityText}` : base;
  }

  if (resource.resourceType === "MedicationRequest") {
    const med = resource.medicationCodeableConcept as Record<string, unknown> | undefined;
    return (med?.text as string | undefined) ?? "Medication";
  }

  if (resource.resourceType === "Condition") {
    const code = resource.code as Record<string, unknown> | undefined;
    return (code?.text as string | undefined) ?? "Condition";
  }

  if (resource.resourceType === "DocumentReference") {
    const description = typeof resource.description === "string" ? resource.description : "";
    const note = pickNoteText(resource);
    return description || note?.split("\n")[0] || "Clinical note";
  }

  if (resource.resourceType === "Encounter") {
    return typeof resource.status === "string" ? `Encounter (${resource.status})` : "Encounter";
  }

  return resource.resourceType;
}

export function resourceToCitation(resource: FhirResource, snippet?: string): Citation {
  return {
    resourceType: resource.resourceType,
    id: resource.id ?? "unknown",
    label: getResourceDisplay(resource),
    snippet: snippet ?? getResourceDisplay(resource)
  };
}

function observationCodes(resource: FhirResource): string[] {
  const code = resource.code as Record<string, unknown> | undefined;
  const coding = Array.isArray(code?.coding) ? code.coding : [];
  return coding
    .map((item) => (typeof (item as Record<string, unknown>).code === "string" ? (item as Record<string, unknown>).code as string : ""))
    .filter(Boolean);
}

export function resourceText(resource: FhirResource): string {
  const chunks: string[] = [getResourceDisplay(resource)];
  if (resource.resourceType === "Condition" || resource.resourceType === "DiagnosticReport") {
    if (typeof resource.conclusion === "string") {
      chunks.push(resource.conclusion);
    }
  }

  if (resource.resourceType === "Encounter") {
    const reasonCodes = Array.isArray(resource.reasonCode) ? (resource.reasonCode as Array<Record<string, unknown>>) : [];
    if (typeof reasonCodes[0]?.text === "string") {
      chunks.push(reasonCodes[0].text);
    }
  }

  if (resource.resourceType === "DocumentReference") {
    const note = pickNoteText(resource);
    if (note) {
      chunks.push(note);
    }
  }

  return chunks.join(" ").toLowerCase();
}

export function resourceMatchesCodes(resource: FhirResource, codes: string[]): boolean {
  if (resource.resourceType !== "Observation") {
    return false;
  }

  const available = observationCodes(resource);
  return codes.some((code) => available.includes(code));
}
