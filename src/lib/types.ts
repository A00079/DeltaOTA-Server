export enum ReleaseState {
  CREATED = 0,
  STAGING = 10,
  LIVE = 20,
  HALTED = 25,
  DISABLED = 30,
  DELETED = 40,
}

export interface Release {
  appId: string;
  platform: string;
  jsVersion: number;
  bundleVersion: number;
  releaseState: ReleaseState;
  rollout: number;
  hash: string;
  bundleUrl: string;
  patchUrl?: string;
  patches?: Record<string, string>;
  isMandatory: boolean;
  description: string;
  appVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Registry {
  appId: string;
  platform: string;
  appName: string;
  createdAt: string;
}

export interface AnalyticsEvent {
  id: string;
  appId: string;
  event: string;
  jsVersion: number;
  bundleVersion: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface HistoryEntry {
  id: string;
  appId: string;
  jsVersion: number;
  bundleVersion: number;
  action: string;
  previousState?: ReleaseState;
  newState?: ReleaseState;
  rollout?: number;
  timestamp: string;
  description?: string;
}

export interface CheckUpdateRequest {
  appId: string;
  jsVersion: number;
  bundleVersion: number;
  bucket: number;
  iu?: boolean;
}

export type CheckUpdateResponse =
  | { isUpdateAvailable: false }
  | { rollback: true }
  | {
      isUpdateAvailable: true;
      isMandatory: boolean;
      hash: string;
      jsVersion: number;
      bundleVersion: number;
      releaseState: ReleaseState;
      patchUrl?: string;
      bundleUrl: string;
    };
