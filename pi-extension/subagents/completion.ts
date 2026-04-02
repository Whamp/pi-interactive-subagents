/**
 * Completion formatting for subagent results.
 *
 * Shared between normal subagent completion and subagent_resume completion
 * to ensure both paths produce consistent artifact handoff and contract
 * validation output.
 */
import { validateArtifactContract, type ArtifactContract } from "../session-artifacts/artifact-contract.ts";
import type { ArtifactInfo } from "../session-artifacts/artifact-registry.ts";
import type { AgentDefaults } from "./index.ts";

export interface SubagentCompletionInfo {
  name: string;
  exitCode: number;
  elapsed: number;
  summary: string;
  sessionFile?: string;
  artifacts: ArtifactInfo[];
  primaryArtifact: string | null;
  agentDefs?: AgentDefaults | null;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/**
 * Format a subagent completion into a content string and details record,
 * including artifact discovery, handoff guidance, and contract validation.
 */
export function formatSubagentCompletion(info: SubagentCompletionInfo): {
  content: string;
  details: Record<string, unknown>;
} {
  const sessionRef = info.sessionFile
    ? `\n\nSession: ${info.sessionFile}\nResume: pi --session ${info.sessionFile}`
    : "";

  // Build artifact handoff guidance for successful completions
  let artifactRef = "";
  if (info.exitCode === 0 && info.artifacts.length > 0) {
    const artifactList = info.artifacts
      .map((a) => `  - ${a.name}`)
      .join("\n");
    artifactRef = `\n\nArtifacts written:\n${artifactList}`;
    if (info.primaryArtifact) {
      artifactRef += `\n\nPrimary artifact: read_artifact("${info.primaryArtifact}")`;
    }
  }

  // Validate artifact contract for successful completions
  let contractFailureRef = "";
  const contractDetails: Record<string, unknown> = {};
  if (info.exitCode === 0 && info.agentDefs) {
    const contract: ArtifactContract = {
      required: info.agentDefs.artifactRequired === true,
      expectedName: info.agentDefs.artifactName,
    };
    const validation = validateArtifactContract(contract, info.artifacts);
    contractDetails.contractSatisfied = validation.satisfied;
    contractDetails.contractRequired = contract.required;
    if (contract.expectedName) {
      contractDetails.contractExpectedName = contract.expectedName;
    }
    if (!validation.satisfied) {
      contractDetails.contractFailureReason = validation.failureReason;
      contractDetails.contractRecoveryGuidance = validation.recoveryGuidance;
      contractFailureRef =
        `\n\n⚠ Artifact contract failure: ${validation.failureReason}` +
        `\n\nRecovery: ${validation.recoveryGuidance}`;
    }
  }

  const content =
    info.exitCode !== 0
      ? `Sub-agent "${info.name}" failed (exit code ${info.exitCode}).\n\n${info.summary}${sessionRef}`
      : `Sub-agent "${info.name}" completed (${formatElapsed(info.elapsed)}).\n\n${info.summary}${artifactRef}${contractFailureRef}${sessionRef}`;

  return {
    content,
    details: {
      name: info.name,
      exitCode: info.exitCode,
      elapsed: info.elapsed,
      sessionFile: info.sessionFile,
      artifacts: info.artifacts,
      primaryArtifact: info.primaryArtifact,
      ...contractDetails,
    },
  };
}
