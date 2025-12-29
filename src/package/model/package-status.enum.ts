export enum PackageStatus {
  REQUESTED = 'REQUESTED',
  CONFIRMED = 'CONFIRMED',
  ACTIVE = 'ACTIVE', // NEW: Active with sessions remaining
  PAUSED = 'PAUSED', // NEW: Temporarily paused
  EXPIRED = 'EXPIRED', // NEW: Expired
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  SUSPENDED = 'SUSPENDED', // NEW: Suspended (e.g., payment issue)
}
