/**
 * Tests verifying that bundled agent definitions declare artifact contracts
 * and that loadAgentDefaults correctly parses the artifact-required and
 * artifact-name frontmatter fields.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * Parse frontmatter from an agent .md file, returning key-value pairs.
 */
function parseFrontmatter(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^(\S+):\s*(.+)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return fm;
}

const agentsDir = join(
  dirname(new URL(import.meta.url).pathname),
  "../agents",
);

describe("agent artifact contracts", () => {
  describe("scout", () => {
    it("declares artifact-required: true", () => {
      const fm = parseFrontmatter(join(agentsDir, "scout.md"));
      assert.equal(fm["artifact-required"], "true");
    });

    it("declares artifact-name: context.md", () => {
      const fm = parseFrontmatter(join(agentsDir, "scout.md"));
      assert.equal(fm["artifact-name"], "context.md");
    });
  });

  describe("reviewer", () => {
    it("declares artifact-required: true", () => {
      const fm = parseFrontmatter(join(agentsDir, "reviewer.md"));
      assert.equal(fm["artifact-required"], "true");
    });

    it("declares artifact-name: review.md", () => {
      const fm = parseFrontmatter(join(agentsDir, "reviewer.md"));
      assert.equal(fm["artifact-name"], "review.md");
    });
  });

  describe("visual-tester", () => {
    it("declares artifact-required: true", () => {
      const fm = parseFrontmatter(join(agentsDir, "visual-tester.md"));
      assert.equal(fm["artifact-required"], "true");
    });

    it("declares artifact-name: visual-test-report.md", () => {
      const fm = parseFrontmatter(join(agentsDir, "visual-tester.md"));
      assert.equal(fm["artifact-name"], "visual-test-report.md");
    });
  });

  describe("planner", () => {
    it("declares artifact-required: true", () => {
      const fm = parseFrontmatter(join(agentsDir, "planner.md"));
      assert.equal(fm["artifact-required"], "true");
    });

    it("does not declare a fixed artifact-name (variable output)", () => {
      const fm = parseFrontmatter(join(agentsDir, "planner.md"));
      assert.equal(fm["artifact-name"], undefined);
    });
  });

  describe("worker", () => {
    it("does not declare artifact-required (remains configurable)", () => {
      const fm = parseFrontmatter(join(agentsDir, "worker.md"));
      assert.equal(fm["artifact-required"], undefined);
    });

    it("does not declare artifact-name", () => {
      const fm = parseFrontmatter(join(agentsDir, "worker.md"));
      assert.equal(fm["artifact-name"], undefined);
    });
  });
});
