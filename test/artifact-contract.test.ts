/**
 * Pure tests for artifact contract validation.
 * Covers the acceptance criteria for per-agent artifact contract and failure reporting.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateArtifactContract } from "../pi-extension/session-artifacts/artifact-contract.ts";
import type { ArtifactInfo } from "../pi-extension/session-artifacts/artifact-registry.ts";

describe("artifact-contract", () => {
  describe("validateArtifactContract", () => {
    it("returns satisfied when artifact is not required", () => {
      const result = validateArtifactContract(
        { required: false },
        [],
      );

      assert.equal(result.satisfied, true);
      assert.equal(result.failureReason, undefined);
      assert.equal(result.recoveryGuidance, undefined);
    });

    it("returns failure when artifact is required but none produced", () => {
      const result = validateArtifactContract(
        { required: true },
        [],
      );

      assert.equal(result.satisfied, false);
      assert.ok(result.failureReason);
      assert.ok(result.recoveryGuidance);
      assert.ok(
        result.failureReason!.includes("required"),
        `Failure reason should mention "required": ${result.failureReason}`,
      );
    });

    it("returns failure with specific name when expected artifact not produced", () => {
      const artifacts: ArtifactInfo[] = [
        { name: "notes.md", path: "/tmp/notes.md" },
      ];

      const result = validateArtifactContract(
        { required: true, expectedName: "context.md" },
        artifacts,
      );

      assert.equal(result.satisfied, false);
      assert.ok(result.failureReason!.includes("context.md"));
      assert.ok(result.recoveryGuidance!.includes("context.md"));
    });

    it("returns satisfied when required artifact with expected name is produced", () => {
      const artifacts: ArtifactInfo[] = [
        { name: "context.md", path: "/tmp/context.md" },
      ];

      const result = validateArtifactContract(
        { required: true, expectedName: "context.md" },
        artifacts,
      );

      assert.equal(result.satisfied, true);
      assert.equal(result.failureReason, undefined);
    });

    it("returns satisfied when required (no expected name) and any artifact exists", () => {
      const artifacts: ArtifactInfo[] = [
        { name: "review.md", path: "/tmp/review.md" },
      ];

      const result = validateArtifactContract(
        { required: true },
        artifacts,
      );

      assert.equal(result.satisfied, true);
      assert.equal(result.failureReason, undefined);
    });

    it("includes resume instruction in recovery guidance", () => {
      const result = validateArtifactContract(
        { required: true, expectedName: "review.md" },
        [],
      );

      assert.ok(result.recoveryGuidance);
      assert.ok(
        result.recoveryGuidance!.includes("Resume"),
        "Recovery guidance should mention resuming the subagent",
      );
      assert.ok(
        result.recoveryGuidance!.includes("write_artifact"),
        "Recovery guidance should mention write_artifact",
      );
      assert.ok(
        result.recoveryGuidance!.includes("review.md"),
        "Recovery guidance should include the expected artifact name",
      );
    });
  });
});
