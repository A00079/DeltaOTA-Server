import { Release, Registry, ReleaseState } from "./types";
import { VALID_TRANSITIONS, PLATFORMS } from "./constants";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateRelease(data: Partial<Release>): ValidationResult {
  if (!data.appId || typeof data.appId !== "string" || data.appId.trim() === "") {
    return { valid: false, error: "appId is required and must be a non-empty string" };
  }

  if (!data.platform || !PLATFORMS.includes(data.platform as "android" | "ios")) {
    return { valid: false, error: `platform is required and must be one of: ${PLATFORMS.join(", ")}` };
  }

  if (data.jsVersion === undefined || typeof data.jsVersion !== "number" || data.jsVersion < 1) {
    return { valid: false, error: "jsVersion is required and must be a positive number" };
  }

  if (data.bundleVersion === undefined || typeof data.bundleVersion !== "number" || data.bundleVersion < 1) {
    return { valid: false, error: "bundleVersion is required and must be a positive number" };
  }

  if (!data.hash || typeof data.hash !== "string") {
    return { valid: false, error: "hash is required and must be a string" };
  }

  if (!data.bundleUrl || typeof data.bundleUrl !== "string") {
    return { valid: false, error: "bundleUrl is required and must be a string" };
  }

  return { valid: true };
}

export function validateStateTransition(
  currentState: ReleaseState,
  newState: ReleaseState
): ValidationResult {
  const validNextStates = VALID_TRANSITIONS[currentState];

  if (!validNextStates || !validNextStates.includes(newState)) {
    return {
      valid: false,
      error: `Invalid state transition from ${currentState} to ${newState}. Valid transitions: ${validNextStates?.join(", ") || "none"}`,
    };
  }

  return { valid: true };
}

export function validateRegistry(data: Partial<Registry>): ValidationResult {
  if (!data.appId || typeof data.appId !== "string" || data.appId.trim() === "") {
    return { valid: false, error: "appId is required and must be a non-empty string" };
  }

  if (!data.platform || !PLATFORMS.includes(data.platform as "android" | "ios")) {
    return { valid: false, error: `platform is required and must be one of: ${PLATFORMS.join(", ")}` };
  }

  if (!data.appName || typeof data.appName !== "string" || data.appName.trim() === "") {
    return { valid: false, error: "appName is required and must be a non-empty string" };
  }

  return { valid: true };
}

export function validateRollout(currentRollout: number, newRollout: number): ValidationResult {
  if (typeof newRollout !== "number" || newRollout < 0 || newRollout > 100) {
    return { valid: false, error: "rollout must be a number between 0 and 100" };
  }

  if (newRollout < currentRollout) {
    return { valid: false, error: `rollout can only increase. Current: ${currentRollout}, Requested: ${newRollout}` };
  }

  return { valid: true };
}
