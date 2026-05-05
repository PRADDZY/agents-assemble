const defaults = {
  repoUrl: "https://github.com/PRADDZY/agents-assemble",
  proofUiUrl: "https://referral-ready-proof-ui.pages.dev",
  mcpUrl: "https://referral-ready-mcp.dpratik3005.workers.dev/mcp",
  marketplaceUrl: process.env.MARKETPLACE_URL || ""
};

const config = {
  repoUrl: process.env.PUBLIC_REPO_URL || defaults.repoUrl,
  proofUiUrl: process.env.PUBLIC_PROOF_UI_URL || defaults.proofUiUrl,
  mcpUrl: process.env.PUBLIC_MCP_URL || defaults.mcpUrl,
  marketplaceUrl: defaults.marketplaceUrl
};

const results = [];

function fail(message) {
  throw new Error(message);
}

async function check(name, run) {
  try {
    await run();
    results.push({ name, status: "ok" });
  } catch (error) {
    results.push({
      name,
      status: "fail",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

async function expectJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    fail(`${url} returned ${response.status}`);
  }

  return response.json();
}

async function postMcp(body) {
  const response = await fetch(config.mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    fail(`MCP endpoint returned ${response.status}`);
  }

  return response.text();
}

function parseSseJson(text) {
  const line = text
    .split("\n")
    .find((entry) => entry.startsWith("data: "));

  if (!line) {
    fail("MCP response did not contain an SSE data payload.");
  }

  return JSON.parse(line.slice(6));
}

await check("Worker health", async () => {
  const healthUrl = new URL(config.mcpUrl);
  healthUrl.pathname = "/health";
  const payload = await expectJson(healthUrl.toString());
  if (payload.status !== "ok") {
    fail(`Unexpected health status: ${payload.status}`);
  }
});

await check("MCP initialize", async () => {
  const payload = parseSseJson(
    await postMcp({
      jsonrpc: "2.0",
      id: "init",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "submission-check",
          version: "0.1.0"
        }
      }
    })
  );

  if (payload.result?.serverInfo?.name !== "referral-ready-mcp") {
    fail("Unexpected MCP serverInfo.name");
  }
});

await check("MCP tools/list", async () => {
  const payload = parseSseJson(
    await postMcp({
      jsonrpc: "2.0",
      id: "tools",
      method: "tools/list",
      params: {}
    })
  );

  const tools = Array.isArray(payload.result?.tools) ? payload.result.tools : [];
  const toolNames = tools.map((tool) => tool.name);
  const required = [
    "list_supported_specialties",
    "analyze_referral_readiness",
    "extract_referral_evidence",
    "draft_referral_packet",
    "draft_patient_prep",
    "create_followup_tasks"
  ];

  for (const name of required) {
    if (!toolNames.includes(name)) {
      fail(`Missing tool ${name}`);
    }
  }
});

await check("MCP analyze_referral_readiness", async () => {
  const payload = parseSseJson(
    await postMcp({
      jsonrpc: "2.0",
      id: "analyze",
      method: "tools/call",
      params: {
        name: "analyze_referral_readiness",
        arguments: {
          specialtyId: "gastroenterology",
          demoBundleId: "alex-martin-gi"
        }
      }
    })
  );

  const structured = payload.result?.structuredContent;
  if (!structured || structured.patientName !== "Alex Martin") {
    fail("Structured readiness payload was missing the expected synthetic patient.");
  }
});

await check("Proof UI", async () => {
  const response = await fetch(config.proofUiUrl);
  if (!response.ok) {
    fail(`Proof UI returned ${response.status}`);
  }

  const html = await response.text();
  if (!html.includes("<title>Referral Ready MCP</title>")) {
    fail("Proof UI did not return the expected title.");
  }
});

await check("GitHub repo", async () => {
  const response = await fetch(config.repoUrl);
  if (!response.ok) {
    fail(`GitHub repo returned ${response.status}`);
  }
});

if (config.marketplaceUrl) {
  await check("Marketplace share link", async () => {
    const response = await fetch(config.marketplaceUrl, { redirect: "follow" });
    if (!response.ok) {
      fail(`Marketplace link returned ${response.status}`);
    }
  });
}

const failed = results.filter((result) => result.status === "fail");

for (const result of results) {
  const label = result.status === "ok" ? "PASS" : "FAIL";
  if (result.detail) {
    console.log(`${label}  ${result.name}: ${result.detail}`);
  } else {
    console.log(`${label}  ${result.name}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log("Submission smoke checks passed.");
}
