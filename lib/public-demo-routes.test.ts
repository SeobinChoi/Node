import { describe, expect, it } from "vitest";
import { publicDemoRoutes } from "./public-demo-routes";

const exactPublicRoutes = [
  "/ops-radar-demo",
  "/military-ai-demo",
  "/admin-doc-demo",
  "/after-action-demo",
  "/report-mock",
];

describe("public demo route scope", () => {
  it("contains only the five exact public paths", () => {
    expect([...publicDemoRoutes]).toEqual(exactPublicRoutes);

    for (const path of exactPublicRoutes) {
      expect(publicDemoRoutes.has(`${path}-private`)).toBe(false);
      expect(publicDemoRoutes.has(`${path}/draft`)).toBe(false);
    }
  });
});
