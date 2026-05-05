import fs from "fs";
import path from "path";

const RULES_DIR = path.join(__dirname, "..");

describe("Rule files completeness", () => {
  const expectedRules = [
    {
      file: "sandbox-node-patterns.md",
      requiredPatterns: [
        "encryptServiceKey",
        "privateKey",
        "NEVER return",
        "sandboxNode.sshKey.create",
      ],
    },
    {
      file: "marketplace-patterns.md",
      requiredPatterns: [
        "marketplacePlans",
        "seedMarketplacePlans",
        "order.create",
        "idempotent",
      ],
    },
    {
      file: "collaboration-health-checks.md",
      requiredPatterns: [
        "checkStalwartHealth",
        "SERVICE_UNAVAILABLE",
        "CalDAV",
        "CardDAV",
        "inline",
      ],
    },
  ];

  for (const rule of expectedRules) {
    describe(rule.file, () => {
      it("should exist", () => {
        const filePath = path.join(RULES_DIR, rule.file);
        expect(fs.existsSync(filePath)).toBe(true);
      });

      it("should contain all required patterns", () => {
        const filePath = path.join(RULES_DIR, rule.file);
        const content = fs.readFileSync(filePath, "utf-8");

        for (const pattern of rule.requiredPatterns) {
          expect(content).toContain(pattern);
        }
      });
    });
  }

  describe("Updated rules", () => {
    it("stalwart-mail-patterns.md should mention DNS Wizard Integration", () => {
      const content = fs.readFileSync(
        path.join(RULES_DIR, "stalwart-mail-patterns.md"),
        "utf-8",
      );
      expect(content).toContain("DNS Wizard Integration");
      expect(content).toContain("dns-wizard.tsx");
    });

    it("dns-provider-patterns.md should mention credential roundtrip", () => {
      const content = fs.readFileSync(
        path.join(RULES_DIR, "dns-provider-patterns.md"),
        "utf-8",
      );
      expect(content).toContain("verifyCredentialRoundtrip");
      expect(content).toContain("apiToken");
    });

    it("pricing-source-of-truth.md should mention entitlement translations", () => {
      const content = fs.readFileSync(
        path.join(RULES_DIR, "pricing-source-of-truth.md"),
        "utf-8",
      );
      expect(content).toContain("entitlements.usage.features");
      expect(content).toContain("common.json");
    });
  });
});
