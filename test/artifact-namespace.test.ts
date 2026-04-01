/**
 * Pure tests for artifact namespace resolution and duplicate-write behavior.
 * Covers the acceptance criteria for run-scoped artifact identity.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join, resolve as pathResolve, dirname as pathDirname } from "node:path";
import { tmpdir } from "node:os";
import {
  resolveArtifactWritePath,
  resolveArtifactReadDir,
  getProjectArtifactsDir,
  getEffectiveSessionDir,
} from "../pi-extension/session-artifacts/artifact-namespace.ts";

// --- Helpers ---

function createTestDir(): string {
  return mkdtempSync(join(tmpdir(), "artifact-namespace-test-"));
}

describe("artifact-namespace", () => {
  let dir: string;

  before(() => {
    dir = createTestDir();
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("resolveArtifactWritePath", () => {
    it("uses session directory when no run-scoped env vars are set", () => {
      const result = resolveArtifactWritePath("context.md", "/sessions/s1", "sess-001", {});

      assert.equal(result.artifactDir, "/sessions/s1/artifacts/sess-001");
      assert.equal(result.filePath, "/sessions/s1/artifacts/sess-001/context.md");
    });

    it("uses run-scoped directory when env vars are set", () => {
      const env = {
        PI_ARTIFACT_RUN_ID: "run-abc123",
        PI_ARTIFACT_SESSION_DIR: "/sessions/s1",
      };
      const result = resolveArtifactWritePath("context.md", "/sessions/s2", "sess-002", env);

      // Should use the PARENT's session dir with the run ID, not the subagent's own session
      assert.equal(result.artifactDir, "/sessions/s1/artifacts/run-abc123");
      assert.equal(result.filePath, "/sessions/s1/artifacts/run-abc123/context.md");
    });

    it("supports subdirectory paths in the artifact name", () => {
      const env = {
        PI_ARTIFACT_RUN_ID: "run-xyz",
        PI_ARTIFACT_SESSION_DIR: "/sessions/parent",
      };
      const result = resolveArtifactWritePath("plans/my-plan.md", "/sessions/child", "sess-c", env);

      assert.equal(result.artifactDir, "/sessions/parent/artifacts/run-xyz");
      assert.equal(result.filePath, "/sessions/parent/artifacts/run-xyz/plans/my-plan.md");
    });

    it("ignores PI_ARTIFACT_RUN_ID without PI_ARTIFACT_SESSION_DIR", () => {
      const env = { PI_ARTIFACT_RUN_ID: "run-orphan" };
      const result = resolveArtifactWritePath("context.md", "/sessions/s1", "sess-001", env);

      // Should fall back to session-scoped since the session dir is missing
      assert.equal(result.artifactDir, "/sessions/s1/artifacts/sess-001");
    });

    it("ignores PI_ARTIFACT_SESSION_DIR without PI_ARTIFACT_RUN_ID", () => {
      const env = { PI_ARTIFACT_SESSION_DIR: "/sessions/parent" };
      const result = resolveArtifactWritePath("context.md", "/sessions/s1", "sess-001", env);

      // Should fall back to session-scoped since the run ID is missing
      assert.equal(result.artifactDir, "/sessions/s1/artifacts/sess-001");
    });
  });

  describe("resolveArtifactReadDir", () => {
    it("returns session directory when no env vars are set", () => {
      const result = resolveArtifactReadDir("/sessions/s1", "sess-001", {});
      assert.equal(result, "/sessions/s1/artifacts/sess-001");
    });

    it("returns run-scoped directory when env vars are set", () => {
      const env = {
        PI_ARTIFACT_RUN_ID: "run-abc123",
        PI_ARTIFACT_SESSION_DIR: "/sessions/s1",
      };
      const result = resolveArtifactReadDir("/sessions/s2", "sess-002", env);
      assert.equal(result, "/sessions/s1/artifacts/run-abc123");
    });
  });

  describe("getProjectArtifactsDir", () => {
    it("uses session dir when no env var is set", () => {
      const result = getProjectArtifactsDir("/sessions/s1", {});
      assert.equal(result, "/sessions/s1/artifacts");
    });

    it("uses PI_ARTIFACT_SESSION_DIR when set", () => {
      const env = { PI_ARTIFACT_SESSION_DIR: "/sessions/parent" };
      const result = getProjectArtifactsDir("/sessions/child", env);
      assert.equal(result, "/sessions/parent/artifacts");
    });
  });

  describe("getEffectiveSessionDir", () => {
    it("returns session dir when no env var is set", () => {
      const result = getEffectiveSessionDir("/sessions/s1", {});
      assert.equal(result, "/sessions/s1");
    });

    it("returns PI_ARTIFACT_SESSION_DIR when set", () => {
      const env = { PI_ARTIFACT_SESSION_DIR: "/sessions/parent" };
      const result = getEffectiveSessionDir("/sessions/child", env);
      assert.equal(result, "/sessions/parent");
    });
  });

  describe("duplicate-write behavior (end-to-end file operations)", () => {
    it("repeated writes to the same logical name update the same file", () => {
      // Simulate a run-scoped artifact directory
      const runDir = join(dir, "sessions", "parent", "artifacts", "run-dupe");
      mkdirSync(runDir, { recursive: true });

      const env = {
        PI_ARTIFACT_RUN_ID: "run-dupe",
        PI_ARTIFACT_SESSION_DIR: join(dir, "sessions", "parent"),
      };

      // First write
      const resolved1 = resolveArtifactWritePath("context.md", join(dir, "sessions", "child"), "sess-child", env);
      mkdirSync(pathDirname(resolved1.filePath), { recursive: true });
      writeFileSync(resolved1.filePath, "First content", "utf-8");

      // Second write to same logical name
      const resolved2 = resolveArtifactWritePath("context.md", join(dir, "sessions", "child"), "sess-child", env);

      // Both resolves should point to the same path
      assert.equal(resolved1.filePath, resolved2.filePath);

      // Overwrite
      writeFileSync(resolved2.filePath, "Updated content", "utf-8");

      // Should have exactly one file with the updated content
      const files = readdirSync(runDir);
      assert.deepEqual(files, ["context.md"]);

      const content = readFileSync(resolved2.filePath, "utf-8");
      assert.equal(content, "Updated content");
    });

    it("different run IDs produce separate artifact directories", () => {
      const parentDir = join(dir, "sessions", "parent2");
      const env1 = { PI_ARTIFACT_RUN_ID: "run-alpha", PI_ARTIFACT_SESSION_DIR: parentDir };
      const env2 = { PI_ARTIFACT_RUN_ID: "run-beta", PI_ARTIFACT_SESSION_DIR: parentDir };

      const resolved1 = resolveArtifactWritePath("context.md", "/child", "sess-c", env1);
      const resolved2 = resolveArtifactWritePath("context.md", "/child", "sess-c", env2);

      assert.notEqual(resolved1.filePath, resolved2.filePath);
      assert.ok(resolved1.filePath.includes("run-alpha"));
      assert.ok(resolved2.filePath.includes("run-beta"));
    });
  });
});
