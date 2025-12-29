import { Collection } from 'fireorm';

import { PackageStatus } from './package-status.enum';
import { PackageType } from './package-type.enum';
import { PackagePeriodicity } from './package-periodicity.enum';

@Collection('package')
export class Package {
  id: string;
  commerceId: string;
  clientId: string;
  firstBookingId: string;
  firstAttentionId: string;
  proceduresAmount: number;
  proceduresLeft: number;
  proceduresUsed?: number; // NEW: Track used sessions
  proceduresConsumed?: number; // NEW: Actually consumed (attended)
  totalAmount: number;
  name: string;
  servicesId: string[];
  bookingsId: string[];
  attentionsId: string[];
  incomesId: string[];
  paid: boolean;
  active: boolean;
  available: boolean;
  type: PackageType;
  status: PackageStatus;
  expireAt: Date;
  createdAt: Date;
  createdBy: string;
  cancelledAt: Date;
  cancelledBy: string;
  completedAt: Date;
  completedBy: string;
  // NEW: Session Management
  lastSessionDate?: Date; // NEW: Last session used
  nextRecommendedSessionDate?: Date; // NEW: Based on periodicity
  // NEW: Periodicity & Scheduling
  periodicity?: PackagePeriodicity; // NEW: Enum (WEEKLY, BIWEEKLY, MONTHLY, CUSTOM)
  periodicityDays?: number; // NEW: Days between sessions
  periodicityStartDate?: Date; // NEW: When periodicity starts
  allowFlexibleScheduling?: boolean; // NEW: Allow sessions outside periodicity
  // NEW: Evaluation Sessions
  hasEvaluationSession?: boolean; // NEW: Requires evaluation first
  evaluationSessionId?: string; // NEW: Link to evaluation attention
  evaluationCompleted?: boolean; // NEW: Evaluation done
  evaluationDate?: Date; // NEW: When evaluation happened
  // NEW: Package Configuration
  packageTemplateId?: string; // NEW: Link to package template
  serviceVariants?: object[]; // NEW: Different session counts per service
  combinedPackages?: object[]; // NEW: Multiple packages combined
  // NEW: Notifications
  notificationSettings?: {
    lowSessionsThreshold?: number; // NEW: Alert when sessions < X
    expirationWarningDays?: number; // NEW: Days before expiration to warn
    sessionReminderEnabled?: boolean; // NEW: Remind before next session
  };
  // NEW: Metadata
  metadata?: {
    notes?: string;
    treatmentPlan?: string;
    specialInstructions?: string;
    clientPreferences?: object;
  };
  // NEW: Metrics Tracking
  metrics?: {
    bookingsTotal?: number; // Total bookings created for this package
    bookingsCancelled?: number; // Bookings cancelled (no-shows + cancellations)
    bookingsNoShow?: number; // Bookings cancelled after scheduled date (actual no-shows)
    bookingsAttended?: number; // Bookings that resulted in attention
    firstSessionDate?: Date; // Date of first session consumed
    lastActivityDate?: Date; // Last activity (session consumed or booking created)
    averageDaysBetweenSessions?: number; // Average days between sessions
    completionRate?: number; // proceduresConsumed / proceduresAmount
    abandonmentDate?: Date; // When package was abandoned (if applicable)
    abandonmentReason?: string; // Reason for abandonment
  };
}
