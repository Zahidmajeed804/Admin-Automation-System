import request from "supertest";
import app from "../src/app.js";

describe("smoke: backend test pipeline", () => {
  it("GET /api/v1/health returns 200 with success envelope", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
