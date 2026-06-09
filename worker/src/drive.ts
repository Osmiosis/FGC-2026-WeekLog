import type { Env } from "./bindings";

// Seam for an optional Google Drive sync (PRD Section 8). v1 ships the no-op
// connector only. A future connector drops in here with no UI or core changes.
export interface DriveConnector {
  isConfigured(): boolean;
  pushDayMedia(dayId: string): Promise<{ pushed: number }>;
}

// Default connector: not configured, push is a no-op. Users export a ZIP and
// upload to the mentors' Drive manually instead.
export class NullDriveConnector implements DriveConnector {
  isConfigured(): boolean {
    return false;
  }
  async pushDayMedia(_dayId: string): Promise<{ pushed: number }> {
    return { pushed: 0 };
  }
}

// TODO (v2): R2ToDriveConnector. A service account (credentials in a Worker secret)
// writes a day's media from R2 into ONE mentor-shared Drive folder (env DRIVE_FOLDER_ID).
// Implement DriveConnector, then return it here when DRIVE_ENABLED === "1". No other
// code needs to change: routes already call getDriveConnector(env).
export function getDriveConnector(env: Env): DriveConnector {
  if (env.DRIVE_ENABLED === "1") {
    // return new R2ToDriveConnector(env);  // not implemented in v1
  }
  return new NullDriveConnector();
}
