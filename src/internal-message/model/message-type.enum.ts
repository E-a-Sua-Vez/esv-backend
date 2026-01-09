export enum MessageType {
  NOTIFICATION = 'notification', // Sistema → Usuario (one-way)
  CHAT = 'chat', // Usuario ↔ Usuario (two-way)
  BROADCAST = 'broadcast', // Master → Muchos (one-to-many)
}
