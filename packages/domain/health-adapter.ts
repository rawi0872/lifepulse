// Provider Adapter Interface — pure contract, no NEXTRON logic
import type { HealthRecord, HealthMetricType, HealthSource } from "./health";

export type HealthAvailability = "available" | "unavailable" | "not_configured";

export interface HealthPermissionStatus {
  granted: HealthMetricType[];
  denied: HealthMetricType[];
  notDetermined: HealthMetricType[];
}

export interface HealthSyncResult {
  provider: HealthSource;
  fetchedCount: number;
  normalizedCount: number;
  dedupedCount: number;
  insertedCount: number;
  errors: string[];
  syncedAt: string;
}

export interface HealthSourceAdapter {
  readonly provider: HealthSource;
  /** Whether the OS/provider is reachable on this device (HealthKit only on iOS, etc.) */
  checkAvailability(): Promise<HealthAvailability>;
  /** Which metrics the user has already granted at OS level */
  getGrantedPermissions(requested: HealthMetricType[]): Promise<HealthPermissionStatus>;
  /** Request OS permission for the minimal set — caller decides `requested` */
  requestPermissions(requested: HealthMetricType[]): Promise<HealthPermissionStatus>;
  /** Read authorized raw data and return normalized Life Pulse records (no DB writes) */
  read(requested: HealthMetricType[], options?: { startDate?: string; endDate?: string }): Promise<HealthRecord[]>;
  /** Optional: open OS settings for revocation */
  openSystemSettings?(): Promise<void>;
}
