import { describe, it, expect } from "vitest";
import { validateCommandReturnSchema } from "../src/core/state-validator.js";

describe("validate-state command return schema", () => {
  it("validates command return schema without errors", () => {
    const result = validateCommandReturnSchema();
    expect(result.errors).toHaveLength(0);
  });

  it("validates standard prohibited actions count", () => {
    const result = validateCommandReturnSchema();
    const prohibitedError = result.errors.find((e) => e.code === "INVALID_PROHIBITED_ACTIONS");
    expect(prohibitedError).toBeUndefined();
  });

  it("validates no --force in prohibited actions", () => {
    const result = validateCommandReturnSchema();
    const forceError = result.errors.find((e) => e.code === "FORCE_IN_PROHIBITED");
    expect(forceError).toBeUndefined();
  });

  it("validates next command maps exist for major commands", () => {
    const result = validateCommandReturnSchema();
    const missingMapError = result.errors.find((e) => e.code === "MISSING_NEXT_COMMAND_MAP");
    expect(missingMapError).toBeUndefined();
  });

  it("validates no --force in next commands for normal agents", () => {
    const result = validateCommandReturnSchema();
    const forceNextError = result.errors.find((e) => e.code === "FORCE_IN_NEXT_COMMANDS");
    expect(forceNextError).toBeUndefined();
  });

  it("validates sample result against schema", () => {
    const result = validateCommandReturnSchema();
    const schemaError = result.errors.find((e) => e.code === "INVALID_COMMAND_RESULT_SCHEMA");
    expect(schemaError).toBeUndefined();
  });
});
