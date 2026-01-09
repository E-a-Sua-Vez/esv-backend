/**
 * Script de migración de mensajes del sistema antiguo al nuevo
 *
 * Uso:
 * npx ts-node src/scripts/migrate-messages-to-new-system.ts
 *
 * Este script:
 * 1. Lee todos los mensajes de la colección 'message' (sistema antiguo)
 * 2. Los convierte al formato del nuevo sistema 'internal-message'
 * 3. Publica eventos para que se procesen en el event-consumer
 * 4. Marca los mensajes antiguos como migrados (available=false)
 */

import * as admin from 'firebase-admin';
import { publish } from 'ett-events-lib';
import { v4 as uuidv4 } from 'uuid';

// Enums del nuevo sistema
enum MessageType {
  NOTIFICATION = 'NOTIFICATION',
  CHAT = 'CHAT',
  BROADCAST = 'BROADCAST',
}

enum MessageCategory {
  STOCK = 'STOCK',
  BOOKING = 'BOOKING',
  PAYMENT = 'PAYMENT',
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
  CLIENT = 'CLIENT',
  SYSTEM = 'SYSTEM',
  ATTENTION = 'ATTENTION',
  QUEUE = 'QUEUE',
  REPORT = 'REPORT',
  NOTIFICATION = 'NOTIFICATION',
  ALERT = 'ALERT',
  REMINDER = 'REMINDER',
  PROMOTION = 'PROMOTION',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  UPDATE = 'UPDATE',
  MAINTENANCE = 'MAINTENANCE',
  FEATURE = 'FEATURE',
  SURVEY = 'SURVEY',
  FEEDBACK = 'FEEDBACK',
  SUPPORT = 'SUPPORT',
  BILLING = 'BILLING',
  SECURITY = 'SECURITY',
  COMPLIANCE = 'COMPLIANCE',
  OTHER = 'OTHER',
}

enum MessagePriority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}

enum MessageStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
  SENT = 'SENT',
}

enum RecipientType {
  ADMINISTRATOR = 'ADMINISTRATOR',
  COLLABORATOR = 'COLLABORATOR',
  CLIENT = 'CLIENT',
  COMMERCE = 'COMMERCE',
  ALL = 'ALL',
}

// Interfaz del mensaje antiguo
interface OldMessage {
  id: string;
  type: 'STANDARD' | 'STOCK_PRODUCT_RECHARGE';
  commerceId: string;
  administratorId?: string;
  collaboratorId?: string;
  clientId?: string;
  title: string;
  content: string;
  active: boolean;
  link?: string;
  icon?: string;
  available: boolean;
  read: boolean;
  createdAt: any;
  readAt?: any;
}

// Interfaz del mensaje nuevo
interface NewMessage {
  id: string;
  type: MessageType;
  category: MessageCategory;
  priority: MessagePriority;
  status: MessageStatus;
  recipientType: RecipientType;
  recipientId: string;
  commerceId: string;
  title: string;
  content: string;
  metadata: {
    link?: string;
    icon?: string;
    oldMessageId?: string;
    migratedFrom?: string;
  };
  conversationId?: string;
  senderId?: string;
  senderType?: string;
  createdAt: Date;
  updatedAt: Date;
  readAt?: Date;
  archivedAt?: Date;
}

// Mapeo de tipos antiguos a categorías nuevas
function mapTypeToCategory(oldType: string): MessageCategory {
  switch (oldType) {
    case 'STOCK_PRODUCT_RECHARGE':
      return MessageCategory.STOCK;
    case 'STANDARD':
    default:
      return MessageCategory.NOTIFICATION;
  }
}

// Mapeo de prioridad (basado en tipo)
function mapPriority(oldType: string): MessagePriority {
  switch (oldType) {
    case 'STOCK_PRODUCT_RECHARGE':
      return MessagePriority.HIGH;
    default:
      return MessagePriority.NORMAL;
  }
}

// Determinar tipo de destinatario
function getRecipientInfo(oldMessage: OldMessage): { type: RecipientType; id: string } {
  if (oldMessage.administratorId) {
    return { type: RecipientType.ADMINISTRATOR, id: oldMessage.administratorId };
  }
  if (oldMessage.collaboratorId) {
    return { type: RecipientType.COLLABORATOR, id: oldMessage.collaboratorId };
  }
  if (oldMessage.clientId) {
    return { type: RecipientType.CLIENT, id: oldMessage.clientId };
  }
  // Fallback - mensaje de sistema
  return { type: RecipientType.COMMERCE, id: oldMessage.commerceId };
}

// Convertir timestamp de Firestore
function convertTimestamp(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000);
  }
  return new Date(timestamp);
}

async function migrateMessages() {
  console.log('🚀 Iniciando migración de mensajes...\n');

  // Inicializar Firebase Admin
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  const db = admin.firestore();
  const oldMessagesRef = db.collection('message');
  const newMessagesRef = db.collection('internal-message');

  try {
    // 1. Leer todos los mensajes antiguos
    console.log('📖 Leyendo mensajes del sistema antiguo...');
    const snapshot = await oldMessagesRef.get();
    const oldMessages: OldMessage[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as OldMessage[];

    console.log(`✓ Encontrados ${oldMessages.length} mensajes para migrar\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 2. Procesar cada mensaje
    for (const oldMessage of oldMessages) {
      try {
        // Verificar si ya fue migrado (available=false)
        if (!oldMessage.available) {
          console.log(`⏩ Mensaje ${oldMessage.id} ya migrado, omitiendo...`);
          skippedCount++;
          continue;
        }

        // Obtener información del destinatario
        const recipient = getRecipientInfo(oldMessage);

        // Construir metadata solo con valores definidos
        const metadata: any = {
          oldMessageId: oldMessage.id,
          migratedFrom: 'legacy-message-system',
        };

        if (oldMessage.link !== undefined && oldMessage.link !== null) {
          metadata.link = oldMessage.link;
        }

        if (oldMessage.icon !== undefined && oldMessage.icon !== null) {
          metadata.icon = oldMessage.icon;
        }

        // Crear nuevo mensaje
        const newMessage: NewMessage = {
          id: uuidv4(),
          type: MessageType.NOTIFICATION,
          category: mapTypeToCategory(oldMessage.type),
          priority: mapPriority(oldMessage.type),
          status: oldMessage.read ? MessageStatus.READ : MessageStatus.UNREAD,
          recipientType: recipient.type,
          recipientId: recipient.id,
          commerceId: oldMessage.commerceId,
          title: oldMessage.title,
          content: oldMessage.content,
          metadata,
          senderId: 'SYSTEM',
          senderType: 'SYSTEM',
          createdAt: convertTimestamp(oldMessage.createdAt),
          updatedAt: new Date(),
        };

        if (oldMessage.readAt) {
          newMessage.readAt = convertTimestamp(oldMessage.readAt);
        }

        // 3. Guardar en nueva colección
        await newMessagesRef.doc(newMessage.id).set(newMessage);

        // 4. Publicar evento para que se proyecte en PostgreSQL
        const event = {
          eventName: 'InternalMessageCreatedEvent',
          eventVersion: '1.0',
          occurredAt: new Date().toISOString(),
          aggregateId: newMessage.id,
          aggregateType: 'InternalMessage',
          eventType: 'InternalMessageCreated',
          payload: {
            id: newMessage.id,
            type: newMessage.type,
            category: newMessage.category,
            priority: newMessage.priority,
            status: newMessage.status,
            recipientType: newMessage.recipientType,
            recipientId: newMessage.recipientId,
            commerceId: newMessage.commerceId,
            title: newMessage.title,
            content: newMessage.content,
            metadata: newMessage.metadata,
            senderId: newMessage.senderId,
            senderType: newMessage.senderType,
            createdAt: newMessage.createdAt.toISOString(),
            updatedAt: newMessage.updatedAt.toISOString(),
            readAt: newMessage.readAt?.toISOString(),
          },
          metadata: {
            user: 'migration-script',
            correlationId: `migration-${oldMessage.id}`,
          },
        };

        await publish(event);

        // 5. Marcar mensaje antiguo como migrado
        await oldMessagesRef.doc(oldMessage.id).update({
          available: false,
          migratedTo: newMessage.id,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✓ Migrado: ${oldMessage.id} -> ${newMessage.id} (${recipient.type})`);
        migratedCount++;
      } catch (error) {
        console.error(`✗ Error migrando mensaje ${oldMessage.id}:`, error.message);
        errorCount++;
      }
    }

    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    console.log(`Total de mensajes:    ${oldMessages.length}`);
    console.log(`✓ Migrados exitosos:  ${migratedCount}`);
    console.log(`⏩ Omitidos:          ${skippedCount}`);
    console.log(`✗ Errores:            ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (migratedCount > 0) {
      console.log('✅ Migración completada exitosamente!');
      console.log('\n📝 Próximos pasos:');
      console.log('1. Verificar los mensajes en la colección "internal-message"');
      console.log('2. Verificar las proyecciones en PostgreSQL (tabla internal_messages)');
      console.log('3. Probar la interfaz de usuario con el nuevo sistema');
      console.log('4. Una vez verificado, eliminar la colección "message" antigua\n');
    }
  } catch (error) {
    console.error('💥 Error durante la migración:', error);
    throw error;
  }
}

// Ejecutar migración
if (require.main === module) {
  migrateMessages()
    .then(() => {
      console.log('🎉 Script finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Script falló:', error);
      process.exit(1);
    });
}

export { migrateMessages };
