import type { ParsedTask } from "./task-store.js";

export interface StoppingCondition {
  met: boolean;
  reason: string;
  category: string;
}

const STOP_CATEGORIES = [
  "ambiguous_product_decision",
  "conflicting_requirements",
  "destructive_data_operation",
  "production_deployment",
  "paid_api_usage",
  "cloud_resource_cost",
  "credential_access",
  "security_sensitive",
  "legal_compliance",
  "data_migration",
  "broad_architecture_change",
  "license_change",
  "repeated_failure",
  "unrelated_test_failure",
  "missing_critical_info",
];

export function checkStoppingConditions(
  task: ParsedTask,
  context: {
    humanInterventionRequired?: boolean;
    repeatedFailures?: number;
    hasUnrelatedFailure?: boolean;
    isDestructive?: boolean;
    isProductionDeploy?: boolean;
    requiresCredentials?: boolean;
    isBroadArchitectureChange?: boolean;
  } = {},
): StoppingCondition | null {
  if (context.humanInterventionRequired ?? task.humanInterventionRequired) {
    return {
      met: true,
      reason: "Task requires human intervention",
      category: "human_intervention",
    };
  }

  if ((context.repeatedFailures ?? 0) >= 3) {
    return {
      met: true,
      reason: `Task has failed ${context.repeatedFailures} times`,
      category: "repeated_failure",
    };
  }

  if (context.hasUnrelatedFailure) {
    return {
      met: true,
      reason: "Unrelated test failure cannot be safely isolated",
      category: "unrelated_test_failure",
    };
  }

  if (context.isDestructive) {
    return {
      met: true,
      reason: "Operation is destructive",
      category: "destructive_data_operation",
    };
  }

  if (context.isProductionDeploy) {
    return {
      met: true,
      reason: "Production deployment requires human approval",
      category: "production_deployment",
    };
  }

  if (context.requiresCredentials) {
    return {
      met: true,
      reason: "Operation requires credentials/secrets",
      category: "credential_access",
    };
  }

  if (context.isBroadArchitectureChange) {
    return {
      met: true,
      reason: "Broad architecture change outside task scope",
      category: "broad_architecture_change",
    };
  }

  return null;
}

export function isSafeToContinue(
  task: ParsedTask,
  context?: Parameters<typeof checkStoppingConditions>[1],
): boolean {
  return checkStoppingConditions(task, context) === null;
}
