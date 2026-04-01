/**
 * Pure tests for artifact registry: listing artifacts from a run-scoped directory
 * and selecting the canonical primary artifact.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listRunArtifacts } from "../pi-extension/session-artifacts/artifact-registry.ts";

function createTestDir(): string {
  return mkdtempSync(join(tmpdir(), "artifact-registry-test-"));
}

describe("artifact-registry", () => {
  let dir: string;

  before(() => {
    dir = createTestDir();
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("listRunArtifacts", () => {
    it("returns empty artifacts and null primary when no artifact directory exists", () => {
      const result = listRunArtifacts(join(dir, "nonexistent-session"), "run-abc");

      assert.deepEqual(result.artifacts, []);
      assert.equal(result.primaryArtifact, null);
    });

    it("returns empty artifacts and null primary when artifact directory is empty", () => {
      const runDir = join(dir, "sessions", "s1", "artifacts", "run-empty");
      mkdirSync(runDir, { recursive: true });

      const result = listRunArtifacts(join(dir, "sessions", "s1"), "run-empty");

      assert.deepEqual(result.artifacts, []);
      assert.equal(result.primaryArtifact, null);
    });

    it("returns single artifact as primary when exactly one exists", () => {
      const runDir = join(dir, "sessions", "s2", "artifacts", "run-single");
      mkdirSync(runDir, { recursive: true });
      writeFileSync(join(runDir, "context.md"), "scout output", "utf-8");

      const result = listRunArtifacts(join(dir, "sessions", "s2"), "run-single");

      assert.equal(result.artifacts.length, 1);
      assert.equal(result.artifacts[0].name, "context.md");
      assert.equal(result.primaryArtifact, "context.md");
    });

    it("returns null primary when multiple artifacts exist", () => {
      const runDir = join(dir, "sessions", "s3", "artifacts", "run-multi");
      mkdirSync(runDir, { recursive: true });
      writeFileSync(join(runDir, "context.md"), "scout output", "utf-8");
      writeFileSync(join(runDir, "notes.md"), "extra notes", "utf-8");

      const result = listRunArtifacts(join(dir, "sessions", "s3"), "run-multi");

      assert.equal(result.artifacts.length, 2);
      assert.equal(result.primaryArtifact, null);
    });

    it("handles nested subdirectory artifact names", () => {
      const runDir = join(dir, "sessions", "s4", "artifacts", "run-nested");
      mkdirSync(join(runDir, "plans"), { recursive: true });
      writeFileSync(join(runDir, "plans", "my-plan.md"), "plan content", "utf-8");

      const result = listRunArtifacts(join(dir, "sessions", "s4"), "run-nested");

      assert.equal(result.artifacts.length, 1);
      assert.equal(result.artifacts[0].name, "plans/my-plan.md");
      assert.equal(result.primaryArtifact, "plans/my-plan.md");
    });

    it("includes absolute path for each artifact", () => {
      const runDir = join(dir, "sessions", "s5", "artifacts", "run-paths");
      mkdirSync(runDir, { recursive: true });
      writeFileSync(join(runDir, "review.md"), "review content", "utf-8");

      const result = listRunArtifacts(join(dir, "sessions", "s5"), "run-paths");

      assert.equal(result.artifacts[0].path, join(runDir, "review.md"));
    });
  });
});
