import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createReferralMcpServer } from "./mcp";
import { requestContextFromHeaders } from "./fhir";
import type { WorkerBindings } from "./config";
import { listSupportedSpecialties } from "@agents-assemble/referral-engine";

export function createApp() {
  const app = new Hono<{ Bindings: WorkerBindings }>();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "mcp-session-id",
        "Last-Event-ID",
        "mcp-protocol-version",
        "X-FHIR-Server-URL",
        "X-FHIR-Access-Token",
        "X-Patient-ID",
        "X-FHIR-Refresh-Token",
        "X-FHIR-Refresh-Url"
      ],
      exposeHeaders: ["mcp-session-id", "mcp-protocol-version"]
    })
  );

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "referral-ready-mcp",
      supportedSpecialties: listSupportedSpecialties()
    })
  );

  app.all("/mcp", async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });
    const server = createReferralMcpServer(c.env, requestContextFromHeaders(c.req.raw.headers));
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return app;
}

const app = createApp();

export default {
  fetch: app.fetch
};
