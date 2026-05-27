import { describe, it, expect } from "vitest";
import { resolveAuthority, assertCanForce, canForce, getForceRejectionNextActions, ForceRequiresHumanOrDoctorError } from "../src/core/authority.js";

describe("authority", () => {
  describe("resolveAuthority", () => {
    it("returns 'agent' by default", () => {
      expect(resolveAuthority({})).toBe("agent");
    });

    it("returns 'human' when TASKFORGE_ACTOR=human", () => {
      expect(resolveAuthority({ TASKFORGE_ACTOR: "human" })).toBe("human");
    });

    it("returns 'doctor' when TASKFORGE_ACTOR=doctor", () => {
      expect(resolveAuthority({ TASKFORGE_ACTOR: "doctor" })).toBe("doctor");
    });

    it("ignores unknown actor values", () => {
      expect(resolveAuthority({ TASKFORGE_ACTOR: "unknown" })).toBe("agent");
    });
  });

  describe("assertCanForce", () => {
    it("throws for agent authority", () => {
      expect(() => assertCanForce("agent")).toThrow(ForceRequiresHumanOrDoctorError);
    });

    it("does not throw for human authority", () => {
      expect(() => assertCanForce("human")).not.toThrow();
    });

    it("does not throw for doctor authority", () => {
      expect(() => assertCanForce("doctor")).not.toThrow();
    });
  });

  describe("canForce", () => {
    it("returns false for agent", () => {
      expect(canForce("agent")).toBe(false);
    });

    it("returns true for human", () => {
      expect(canForce("human")).toBe(true);
    });

    it("returns true for doctor", () => {
      expect(canForce("doctor")).toBe(true);
    });
  });

  describe("getForceRejectionNextActions", () => {
    it("returns doctor action without taskId", () => {
      const actions = getForceRejectionNextActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].command).toContain("taskforge doctor --json");
      expect(actions[0].safety).toBe("safe");
      expect(actions[0].preferred).toBe(true);
    });

    it("returns doctor and block actions with taskId", () => {
      const actions = getForceRejectionNextActions("TASK-001");
      expect(actions).toHaveLength(2);
      expect(actions[0].command).toContain("taskforge doctor --json");
      expect(actions[1].command).toContain("taskforge block TASK-001");
      expect(actions[1].safety).toBe("requires_human");
    });
  });

  describe("ForceRequiresHumanOrDoctorError", () => {
    it("has correct code", () => {
      const err = new ForceRequiresHumanOrDoctorError();
      expect(err.code).toBe("FORCE_REQUIRES_HUMAN_OR_DOCTOR");
    });

    it("has exitCode 1", () => {
      const err = new ForceRequiresHumanOrDoctorError();
      expect(err.exitCode).toBe(1);
    });

    it("has descriptive message", () => {
      const err = new ForceRequiresHumanOrDoctorError();
      expect(err.message).toContain("Normal agents may not use --force");
    });
  });
});
