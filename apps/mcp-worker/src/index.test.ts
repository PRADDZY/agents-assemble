import { describe, expect, it } from "vitest";
import { createApp } from "./index";

describe("mcp worker", () => {
  it("returns health information", async () => {
    const app = createApp();
    const response = await app.request("http://example.com/health");

    expect(response.status).toBe(200);
    const payload = await response.json<{ status: string; supportedSpecialties: Array<{ specialtyId: string }> }>();
    expect(payload.status).toBe("ok");
    expect(payload.supportedSpecialties.length).toBe(2);
  });
});
