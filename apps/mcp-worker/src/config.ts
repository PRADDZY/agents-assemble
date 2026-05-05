export interface WorkerBindings {
  GOOGLE_AI_API_KEY?: string;
  GOOGLE_MODEL?: string;
  DEMO_MODE?: string;
  LOG_LEVEL?: string;
  ALLOWED_FHIR_HOSTS?: string;
  PUBLIC_MCP_BASE_URL?: string;
}

export function isDemoMode(env: WorkerBindings): boolean {
  return (env.DEMO_MODE ?? "true").toLowerCase() === "true";
}

export function allowedFhirHosts(env: WorkerBindings): string[] {
  return (env.ALLOWED_FHIR_HOSTS ?? "app.promptopinion.ai")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

