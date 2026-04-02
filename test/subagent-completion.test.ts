/**
 * Tests for the formatSubagentCompletion helper that produces
 * artifact-aware completion content and details for subagent results.
 * This covers the artifact contract/handoff logic shared between
 * normal and resume completion paths.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatSubagentCompletion,
  type SubagentCompletionInfo,
} from "../pi-extension/subagents/completion.ts";
import type { ArtifactInfo } from "../pi-extension/session-artifacts/artifact-registry.ts";

describe("formatSubagentCompletion", () => {
  const baseInfo: SubagentCompletionInfo = {
    name: "Scout",
    exitCode: 0,
    elapsed: 45,
    summary: "Analyzed the auth module.",
    artifacts: [],
    primaryArtifact: null,
  };

  describe("successful completion", () => {
    it("includes summary without artifact info when no artifacts produced", () => {
      const result = formatSubagentCompletion(baseInfo);

      assert.ok(result.content.includes("completed (45s)"));
      assert.ok(result.content.includes("Analyzed the auth module."));
      assert.ok(!result.content.includes("Artifacts written"));
      assert.ok(!result.content.includes("read_artifact"));
      assert.deepEqual(result.details.artifacts, []);
      assert.equal(result.details.primaryArtifact, null);
    });

    it("lists artifacts and primary when exactly one artifact exists", () => {
      const artifacts: ArtifactInfo[] = [
        { name: "context.md", path: "/tmp/context.md" },
      ];
      const info = { ...baseInfo, artifacts, primaryArtifact: "context.md" };
      const result = formatSubagentCompletion(info);

      assert.ok(result.content.includes("Artifacts written"));
      assert.ok(result.content.includes("context.md"));
      assert.ok(result.content.includes('Primary artifact: read_artifact("context.md")'));
      assert.equal(result.details.artifacts.length, 1);
      assert.equal(result.details.primaryArtifact, "context.md");
    });

    it("lists artifacts without primary when multiple artifacts exist", () => {
      const artifacts: ArtifactInfo[] = [
        { name: "context.md", path: "/tmp/context.md" },
        { name: "notes.md", path: "/tmp/notes.md" },
      ];
      const info = { ...baseInfo, artifacts, primaryArtifact: null };
      const result = formatSubagentCompletion(info);

      assert.ok(result.content.includes("context.md"));
      assert.ok(result.content.includes("notes.md"));
      assert.ok(!result.content.includes("Primary artifact"));
      assert.equal(result.details.artifacts.length, 2);
      assert.equal(result.details.primaryArtifact, null);
    });

    it("includes session ref when sessionFile is provided", () => {
      const info = { ...baseInfo, sessionFile: "/tmp/session.jsonl" };
      const result = formatSubagentCompletion(info);

      assert.ok(result.content.includes("Session: /tmp/session.jsonl"));
      assert.ok(result.content.includes("Resume: pi --session /tmp/session.jsonl"));
    });

    it("omits session ref when sessionFile is not provided", () => {
      const result = formatSubagentCompletion(baseInfo);

      assert.ok(!result.content.includes("Session:"));
      assert.ok(!result.content.includes("Resume:"));
    });
  });

  describe("failed completion", () => {
    it("formats failure without artifact info even when artifacts exist", () => {
      const artifacts: ArtifactInfo[] = [
        { name: "partial.md", path: "/tmp/partial.md" },
      ];
      const info = { ...baseInfo, exitCode: 1, artifacts, primaryArtifact: "partial.md" };
      const result = formatSubagentCompletion(info);

      assert.ok(result.content.includes("failed (exit code 1)"));
      assert.ok(!result.content.includes("Artifacts written"));
      // Artifacts still exposed in details for programmatic access
      assert.equal(result.details.artifacts.length, 1);
    });
  });

  describe("contract validation", () => {
    it("validates contract when agent defs require an artifact and it is present", () => {
      const artifacts: ArtifactInfo[] = [
        { name: "context.md", path: "/tmp/context.md" },
      ];
      const info: SubagentCompletionInfo = {
        ...baseInfo,
        artifacts,
        primaryArtifact: "context.md",
        agentDefs: {
          artifactRequired: true,
          artifactName: "context.md",
        },
      };
      const result = formatSubagentCompletion(info);

      assert.equal(result.details.contractSatisfied, true);
      assert.equal(result.details.contractRequired, true);
      assert.equal(result.details.contractExpectedName, "context.md");
      assert.ok(!result.content.includes("contract failure"));
    });

    it("reports contract failure when required artifact is missing", () => {
      const info: SubagentCompletionInfo = {
        ...baseInfo,
        artifacts: [],
        primaryArtifact: null,
        agentDefs: {
          artifactRequired: true,
          artifactName: "review.md",
        },
      };
      const result = formatSubagentCompletion(info);

      assert.equal(result.details.contractSatisfied, false);
      assert.ok(result.details.contractFailureReason);
      assert.ok(result.details.contractRecoveryGuidance);
      assert.ok(result.content.includes("contract failure"));
      assert.ok(result.content.includes("Recovery:"));
    });

    it("reports contract failure when required but no expected name and no artifacts", () => {
      const info: SubagentCompletionInfo = {
        ...baseInfo,
        artifacts: [],
        primaryArtifact: null,
        agentDefs: {
          artifactRequired: true,
        },
      };
      const result = formatSubagentCompletion(info);

      assert.equal(result.details.contractSatisfied, false);
      assert.ok(result.details.contractFailureReason);
    });

    it("skips contract validation when no agent defs are provided", () => {
      const info: SubagentCompletionInfo = {
        ...baseInfo,
        agentDefs: null,
      };
      const result = formatSubagentCompletion(info);

      assert.equal(result.details.contractSatisfied, undefined);
      assert.equal(result.details.contractRequired, undefined);
    });

    it("skips contract validation when agent defs do not require artifacts", () => {
      const info: SubagentCompletionInfo = {
        ...baseInfo,
        agentDefs: {
          artifactRequired: false,
        },
      };
      const result = formatSubagentCompletion(info);

      // When not required, contract is satisfied by default
      assert.equal(result.details.contractSatisfied, true);
      assert.equal(result.details.contractRequired, false);
    });

    it("does not validate contract on failed completions", () => {
      const info: SubagentCompletionInfo = {
        ...baseInfo,
        exitCode: 1,
        agentDefs: {
          artifactRequired: true,
          artifactName: "context.md",
        },
      };
      const result = formatSubagentCompletion(info);

      assert.equal(result.details.contractSatisfied, undefined);
      assert.ok(!result.content.includes("contract failure"));
    });
  });

  describe("details structure", () => {
    it("includes all expected fields in details", () => {
      const artifacts: ArtifactInfo[] = [
        { name: "context.md", path: "/tmp/context.md" },
      ];
      const info: SubagentCompletionInfo = {
        name: "Scout",
        exitCode: 0,
        elapsed: 30,
        summary: "Done.",
        sessionFile: "/tmp/sess.jsonl",
        artifacts,
        primaryArtifact: "context.md",
        agentDefs: { artifactRequired: true, artifactName: "context.md" },
      };
      const result = formatSubagentCompletion(info);

      assert.equal(result.details.name, "Scout");
      assert.equal(result.details.exitCode, 0);
      assert.equal(result.details.elapsed, 30);
      assert.equal(result.details.sessionFile, "/tmp/sess.jsonl");
      assert.deepEqual(result.details.artifacts, artifacts);
      assert.equal(result.details.primaryArtifact, "context.md");
      assert.equal(result.details.contractSatisfied, true);
      assert.equal(result.details.contractRequired, true);
      assert.equal(result.details.contractExpectedName, "context.md");
    });
  });
});
