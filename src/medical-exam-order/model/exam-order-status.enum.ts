export enum ExamOrderStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ExamPriority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

export enum ExamType {
  LABORATORY = 'laboratory',
  IMAGING = 'imaging',
  PROCEDURE = 'procedure',
  OTHER = 'other',
}
