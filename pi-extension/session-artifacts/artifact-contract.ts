/**
 * Artifact contract validation for per-agent artifact requirements.
 *
 * Agent definitions can declare whether an artifact is required and what
 * logical artifact name is expected. This module validates that the artifacts
 * produced by a subagent run satisfy the declared contract.
 */
import type { ArtifactInfo } from "./artifact-registry.ts";

/**
 * An artifact contract declared in agent frontmatter.
 */
export interface ArtifactContract {
  /** Whether producing an artifact is required for this agent */
  required: boolean;
  /** Expected logical artifact name (e.g., "context.md") */
  expectedName?: string;
}

/**
 * Result of validating artifacts against a contract.
 */
export interface ContractValidationResult {
  /** Whether the contract was satisfied */
  satisfied: boolean;
  /** The contract that was checked */
  contract: ArtifactContract;
  /** Artifacts actually produced by the subagent */
  artifacts: ArtifactInfo[];
  /** Failure reason when contract is not satisfied */
  failureReason?: string;
  /** Recovery guidance for contract failures */
  recoveryGuidance?: string;
}

/**
 * Validate that a set of artifacts satisfies an agent's artifact contract.
 *
 * Returns a validation result with satisfaction status, failure reason,
 * and recovery guidance when the contract is not met.
 */
export function validateArtifactContract(
  contract: ArtifactContract,
  artifacts: ArtifactInfo[],
): ContractValidationResult {
  if (!contract.required) {
    return { satisfied: true, contract, artifacts };
  }

  // No artifacts produced at all
  if (artifacts.length === 0) {
    return {
      satisfied: false,
      contract,
      artifacts,
      failureReason: contract.expectedName
        ? `Agent was required to produce artifact "${contract.expectedName}" but produced no artifacts.`
        : "Agent was required to produce an artifact but produced no artifacts.",
      recoveryGuidance: contract.expectedName
        ? `Resume the subagent and instruct it to call write_artifact(name: "${contract.expectedName}", content: ...) with its findings.`
        : "Resume the subagent and instruct it to write its output using write_artifact.",
    };
  }

  // Expected a specific artifact name — check for it
  if (contract.expectedName) {
    const found = artifacts.some((a) => a.name === contract.expectedName);
    if (!found) {
      const names = artifacts.map((a) => a.name).join(", ");
      return {
        satisfied: false,
        contract,
        artifacts,
        failureReason: `Agent was required to produce artifact "${contract.expectedName}" but found: ${names}.`,
        recoveryGuidance: `Resume the subagent and instruct it to call write_artifact(name: "${contract.expectedName}", content: ...) with its findings.`,
      };
    }
  }

  return { satisfied: true, contract, artifacts };
}
