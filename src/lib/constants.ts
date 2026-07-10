import { ReleaseState } from "./types";

export const RELEASE_STATES: Record<string, ReleaseState> = {
  CREATED: ReleaseState.CREATED,
  STAGING: ReleaseState.STAGING,
  LIVE: ReleaseState.LIVE,
  HALTED: ReleaseState.HALTED,
  DISABLED: ReleaseState.DISABLED,
  DELETED: ReleaseState.DELETED,
};

export const RELEASE_STATE_LABELS: Record<ReleaseState, string> = {
  [ReleaseState.CREATED]: "Created",
  [ReleaseState.STAGING]: "Staging",
  [ReleaseState.LIVE]: "Live",
  [ReleaseState.HALTED]: "Halted",
  [ReleaseState.DISABLED]: "Disabled",
  [ReleaseState.DELETED]: "Deleted",
};

export const VALID_TRANSITIONS: Record<ReleaseState, ReleaseState[]> = {
  [ReleaseState.CREATED]: [ReleaseState.STAGING, ReleaseState.DELETED],
  [ReleaseState.STAGING]: [ReleaseState.LIVE, ReleaseState.DISABLED, ReleaseState.DELETED],
  [ReleaseState.LIVE]: [ReleaseState.HALTED, ReleaseState.DISABLED, ReleaseState.DELETED],
  [ReleaseState.HALTED]: [ReleaseState.LIVE, ReleaseState.DISABLED, ReleaseState.DELETED],
  [ReleaseState.DISABLED]: [ReleaseState.DELETED],
  [ReleaseState.DELETED]: [],
};

export const PLATFORMS = ["android", "ios"] as const;

export type Platform = (typeof PLATFORMS)[number];
