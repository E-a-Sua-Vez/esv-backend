export enum MessageCategory {
  // Comunicación Directa
  DIRECT_MESSAGE = 'direct_message',
  ANNOUNCEMENT = 'announcement',

  // Operaciones
  ATTENTION_REMINDER = 'attention_reminder',
  BOOKING_REMINDER = 'booking_reminder',
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_CANCELLED = 'booking_cancelled',

  // Inventario
  STOCK = 'stock',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  EXPIRING_BATCH = 'expiring_batch',

  // Pagos
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_OVERDUE = 'payment_overdue',

  // Plan/Suscripción
  PLAN_EXPIRING = 'plan_expiring',
  PLAN_EXPIRED = 'plan_expired',
  PLAN_UPGRADED = 'plan_upgraded',

  // Cliente
  SURVEY_PENDING = 'survey_pending',
  DOCUMENT_AVAILABLE = 'document_available',
  FORM_PENDING = 'form_pending',

  // Sistema
  SYSTEM_UPDATE = 'system_update',
  FEATURE_ANNOUNCEMENT = 'feature_announcement',
  MAINTENANCE = 'maintenance',

  // Tareas
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  TASK_OVERDUE = 'task_overdue',
}
