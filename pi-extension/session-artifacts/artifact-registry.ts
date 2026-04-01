/**
 * Artifact registry: lists artifacts from a run-scoped directory and
 * selects the canonical primary artifact.
 */
import { join } from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";

export interface ArtifactInfo {
  /** The logical artifact name (e.g., "context.md", "plans/my-plan.md") */
  name: string;
  /** The absolute file path */
  path: string;
}

export interface ArtifactRegistryResult {
  /** All artifacts found for this run */
  artifacts: ArtifactInfo[];
  /** The canonical primary artifact logical name, or null */
  primaryArtifact: string | null;
}

/**
 * Recursively collect file paths under a directory, returning logical names
 * relative to the base directory.
 */
function collectFiles(baseDir: string, prefix: string): ArtifactInfo[] {
  const results: ArtifactInfo[] = [];
  if (!existsSync(baseDir)) return results;

  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    const logicalName = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = join(baseDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, logicalName));
    } else {
      results.push({ name: logicalName, path: fullPath });
    }
  }
  return results;
}

/**
 * Select the canonical primary artifact from a list.
 *
 * Simple rule: if exactly one artifact exists, it is the primary.
 * If zero or multiple exist, returns null (no guessing).
 */
export function selectPrimaryArtifact(artifacts: ArtifactInfo[]): string | null {
  if (artifacts.length === 1) return artifacts[0].name;
  return null;
}

/**
 * List all artifacts written during a subagent run and determine the primary.
 *
 * @param sessionDir - The parent session directory
 * @param runId - The subagent run ID
 */
export function listRunArtifacts(sessionDir: string, runId: string): ArtifactRegistryResult {
  const runDir = join(sessionDir, "artifacts", runId);
  const artifacts = collectFiles(runDir, "");
  const primaryArtifact = selectPrimaryArtifact(artifacts);

  return { artifacts, primaryArtifact };
}
