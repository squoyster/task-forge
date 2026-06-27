import { describe, it, expect } from "vitest";
import { isValidTransition, getAllowedTransitions, validateTransition } from "../src/core/status-transition.js";
import { normalizeStatus } from "../src/util/status-constants.js";

describe("Status Transitions", () => {
  it("allows Inbox → Needs Spec", () => {
    expect(isValidTransition("Inbox", "Needs Spec")).toBe(true);
  });

  it("allows Inbox → Rejected", () => {
    expect(isValidTransition("Inbox", "Rejected")).toBe(true);
  });

  it("allows Needs Spec → Ready", () => {
    expect(isValidTransition("Needs Spec", "Ready")).toBe(true);
  });

  it("allows Ready → In Progress", () => {
    expect(isValidTransition("Ready", "In Progress")).toBe(true);
  });

  it("allows In Progress → Review", () => {
    expect(isValidTransition("In Progress", "Review")).toBe(true);
  });

  it("rejects In Progress → Implementation Complete (legacy status collapsed)", () => {
    expect(isValidTransition("In Progress", "Implementation Complete")).toBe(false);
  });

  it("allows In Progress → Blocked", () => {
    expect(isValidTransition("In Progress", "Blocked")).toBe(true);
  });

  it("allows Blocked → Ready", () => {
    expect(isValidTransition("Blocked", "Ready")).toBe(true);
  });

  it("rejects Review → Done (must go through Verify)", () => {
    expect(isValidTransition("Review", "Done")).toBe(false);
  });

  it("allows Verify → Done", () => {
    expect(isValidTransition("Verify", "Done")).toBe(true);
  });

  it("rejects Inbox → Done", () => {
    expect(isValidTransition("Inbox", "Done")).toBe(false);
  });

  it("rejects Ready → Done (must go through In Progress first)", () => {
    expect(isValidTransition("Ready", "Done")).toBe(false);
  });

  it("rejects Done → Ready", () => {
    expect(isValidTransition("Done", "Ready")).toBe(false);
  });

  it("rejects Rejected → anything", () => {
    expect(isValidTransition("Rejected", "Ready")).toBe(false);
    expect(isValidTransition("Rejected", "In Progress")).toBe(false);
  });

  it("returns correct allowed transitions from In Progress", () => {
    const transitions = getAllowedTransitions("In Progress");
    expect(transitions).toContain("Review");
    expect(transitions).toContain("Blocked");
    expect(transitions).toContain("Deferred");
    expect(transitions).not.toContain("Implementation Complete");
    expect(transitions).not.toContain("Submitted");
    expect(transitions).not.toContain("Merge Ready");
    expect(transitions).not.toContain("Done");
  });

  it("returns null for valid transition", () => {
    expect(validateTransition("Ready", "In Progress")).toBeNull();
  });

  it("returns error message for invalid transition", () => {
    const error = validateTransition("Inbox", "Done");
    expect(error).not.toBeNull();
    expect(error).toContain("Inbox");
    expect(error).toContain("Done");
  });

  // Legacy status normalization (TF-SIMP-02): the three transport statuses
  // load-compatibly and map onto canonical Review/Verify.
  it("normalizes Implementation Complete → Review", () => {
    expect(normalizeStatus("Implementation Complete")).toBe("Review");
    expect(normalizeStatus("implementation_complete")).toBe("Review");
    expect(normalizeStatus("ImplementationComplete")).toBe("Review");
  });

  it("normalizes Submitted → Review", () => {
    expect(normalizeStatus("Submitted")).toBe("Review");
    expect(normalizeStatus("submitted")).toBe("Review");
  });

  it("normalizes Merge Ready → Verify", () => {
    expect(normalizeStatus("Merge Ready")).toBe("Verify");
    expect(normalizeStatus("merge_ready")).toBe("Verify");
    expect(normalizeStatus("MergeReady")).toBe("Verify");
  });
});
