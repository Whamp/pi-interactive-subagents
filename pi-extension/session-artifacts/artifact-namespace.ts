/**
 * Artifact namespace resolution for run-scoped artifact identity.
 *
 * When a subagent runs, the framework sets env vars that tell write_artifact
 * and read_artifact where to store/find artifacts. This module encapsulates
 * the path resolution logic so it can be tested independently.
 */
import { join, resolve } from "node:path";

/**
 * Result of resolving an artifact path for writing.
 */
export interface ResolvedArtifactPath {
  /** The absolute directory path for artifacts in this run. */
  artifactDir: string;
  /** The absolute file path for the artifact. */
  filePath: string;
}

/**
 * Resolve the artifact directory and file path for a write operation.
 *
 * When run-scoped env vars are set (PI_ARTIFACT_RUN_ID and
 * PI_ARTIFACT_SESSION_DIR), artifacts are stored under the parent's session
 * directory in a subdirectory named by the run ID. Otherwise, falls back to
 * the session's own artifact directory.
 */
export function resolveArtifactWritePath(
  name: string,
  sessionDir: string,
  sessionId: string,
  env: Record<string, string | undefined>,
): ResolvedArtifactPath {
  const runId = env.PI_ARTIFACT_RUN_ID;
  const artifactSessionDir = env.PI_ARTIFACT_SESSION_DIR;

  const artifactDir =
    runId && artifactSessionDir
      ? join(artifactSessionDir, "artifacts", runId)
      : join(sessionDir, "artifacts", sessionId);

  const filePath = resolve(artifactDir, name);

  return { artifactDir, filePath };
}

/**
 * Resolve the artifact directory for read operations.
 *
 * When run-scoped env vars are set, reads from the run-scoped directory.
 * Otherwise, returns the session's own artifact directory.
 */
export function resolveArtifactReadDir(
  sessionDir: string,
  sessionId: string,
  env: Record<string, string | undefined>,
): string {
  const runId = env.PI_ARTIFACT_RUN_ID;
  const artifactSessionDir = env.PI_ARTIFACT_SESSION_DIR;

  return runId && artifactSessionDir
    ? join(artifactSessionDir, "artifacts", runId)
    : join(sessionDir, "artifacts", sessionId);
}

/**
 * Get the project-level artifacts directory for cross-session/cross-run
 * search. This is the parent directory containing all artifact subdirectories.
 */
export function getProjectArtifactsDir(
  sessionDir: string,
  env: Record<string, string | undefined>,
): string {
  const artifactSessionDir = env.PI_ARTIFACT_SESSION_DIR;
  return artifactSessionDir ? join(artifactSessionDir, "artifacts") : join(sessionDir, "artifacts");
}

/**
 * Get the effective session directory for artifact operations.
 * When PI_ARTIFACT_SESSION_DIR is set, returns that (the parent's session dir).
 * Otherwise returns the current session dir.
 */
export function getEffectiveSessionDir(
  sessionDir: string,
  env: Record<string, string | undefined>,
): string {
  return env.PI_ARTIFACT_SESSION_DIR ?? sessionDir;
}
