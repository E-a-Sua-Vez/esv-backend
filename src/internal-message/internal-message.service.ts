import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { publish } from 'ett-events-lib';
import * as admin from 'firebase-admin';
import {
  BulkReadDto,
  CreateConversationDto,
  SendMessageDto,
} from './dto/message.dto';
import { GetInboxDto } from './dto/get-inbox.dto';
import { SendSystemNotificationDto } from './dto/send-system-notification.dto';
import { InternalMessageArchived } from './events/internal-message.archived.event';
import { InternalMessageCreated } from './events/internal-message.created.event';
import { InternalMessageRead } from './events/internal-message.read.event';
import { MessageConversationCreated } from './events/message-conversation.created.event';
import { MessageConversationUpdated } from './events/message-conversation.updated.event';
import { InternalMessage } from './model/internal-message.entity';
import { MessageConversation } from './model/message-conversation.entity';
import { MessageCategory } from './model/message-category.enum';
import { MessagePriority } from './model/message-priority.enum';
import { MessageStatus } from './model/message-status.enum';
import { MessageType } from './model/message-type.enum';

@Injectable()
export class InternalMessageService {
  constructor(
    @InjectRepository(InternalMessage)
    private messageRepository = getRepository(InternalMessage),
    @InjectRepository(MessageConversation)
    private conversationRepository = getRepository(MessageConversation),
  ) {}

  /**
   * Enviar notificación del sistema
   */
  async sendSystemNotification(dto: SendSystemNotificationDto): Promise<InternalMessage> {
    const message = new InternalMessage();
    message.type = MessageType.NOTIFICATION;
    message.category = dto.category;
    message.priority = dto.priority || MessagePriority.NORMAL;
    message.title = dto.title;
    message.content = dto.content;
    message.icon = dto.icon;
    message.actionLink = dto.actionLink;
    message.actionLabel = dto.actionLabel;
    message.recipientId = dto.recipientId;
    message.recipientType = dto.recipientType;
    message.commerceId = dto.commerceId;
    message.senderType = 'system';
    message.status = MessageStatus.UNREAD;
    message.read = false;
    message.active = true;
    message.available = true;
    message.createdAt = new Date();

    // Contexto de negocio
    if (dto.attentionId) message.attentionId = dto.attentionId;
    if (dto.bookingId) message.bookingId = dto.bookingId;
    if (dto.queueId) message.queueId = dto.queueId;
    if (dto.productId) message.productId = dto.productId;
    if (dto.clientId) message.clientId = dto.clientId;
    if (dto.documentId) message.documentId = dto.documentId;
    if (dto.taskId) message.taskId = dto.taskId;
    if (dto.expiresAt) message.expiresAt = dto.expiresAt;

    const created = await this.messageRepository.create(message);

    // Publicar evento
    const event = new InternalMessageCreated(new Date(), created);
    await publish(event);

    return created;
  }

  /**
   * Enviar mensaje (para chat futuro)
   */
  async sendMessage(
    userId: string,
    userType: string,
    dto: SendMessageDto,
  ): Promise<InternalMessage> {
    // Buscar información del remitente para enriquecer el mensaje
    const db = admin.firestore();
    let senderInfo = { id: userId, email: null, name: null };

    try {
      // Resolver remitente buscando tanto por ID de documento como por userId
      // Esto es clave para colaboradores, donde el UID de auth suele estar en el campo userId
      const collections = ['collaborator', 'administrator', 'business'];
      for (const colName of collections) {
        let senderDoc = await db.collection(colName).doc(userId).get();

        if (!senderDoc.exists) {
          // Fallback: buscar por userId (UID de autenticación)
          const querySnap = await db
            .collection(colName)
            .where('userId', '==', userId)
            .limit(1)
            .get();

          if (!querySnap.empty) {
            senderDoc = querySnap.docs[0];
          }
        }

        if (senderDoc.exists) {
          const data = senderDoc.data() as any;
          senderInfo.email = data.email || senderInfo.email;
          senderInfo.name =
            data.name ||
            data.firstName ||
            data.fullName ||
            data.businessName ||
            senderInfo.name;
          break;
        }
      }
    } catch (error) {
      console.warn('[sendMessage] Could not fetch sender info:', error.message);
    }

    const message = new InternalMessage();
    message.type = MessageType.CHAT;
    message.category = dto.category;
    message.priority = dto.priority || MessagePriority.NORMAL;
    message.title = dto.title;
    message.content = dto.content;
    message.icon = dto.icon;
    message.actionLink = dto.actionLink;
    message.actionLabel = dto.actionLabel;
    message.senderId = senderInfo; // Guardar objeto con información del remitente
    message.senderType = userType as any;
    message.recipientId = dto.recipientId;
    message.recipientType = dto.recipientType;
    message.commerceId = dto.commerceId;
    message.conversationId = dto.conversationId;
    message.status = MessageStatus.UNREAD;
    message.read = false;
    message.active = true;
    message.available = true;
    message.createdAt = new Date();
    if (dto.expiresAt) message.expiresAt = dto.expiresAt;

    const created = await this.messageRepository.create(message);

    // Publicar evento
    const event = new InternalMessageCreated(new Date(), created, {
      userId,
      userType,
    });
    await publish(event);

    // Si es chat, actualizar conversación
    if (dto.conversationId) {
      await this.updateConversation(dto.conversationId, created);
    }

    return created;
  }

  /**
   * Obtener inbox del usuario
   */
  async getInbox(userId: string | any, filters: GetInboxDto): Promise<any> {
    // Extraer el ID del usuario (puede venir como string o como objeto)
    const actualUserId = typeof userId === 'string' ? userId : (userId.id || userId.userId);

    let query = this.messageRepository
      .whereEqualTo('recipientId', actualUserId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true);

    // Filtros
    if (filters.status && filters.status.length > 0) {
      query = query.whereIn('status', filters.status);
    }
    if (filters.type) {
      query = query.whereEqualTo('type', filters.type);
    }
    if (filters.commerceId) {
      query = query.whereEqualTo('commerceId', filters.commerceId);
    }

    // Ordenamiento
    const sortOrder = filters.sortOrder || 'desc';
    if (sortOrder === 'desc') {
      query = query.orderByDescending('createdAt');
    } else {
      query = query.orderByAscending('createdAt');
    }

    // Paginación
    const limit = filters.limit || 50;
    query = query.limit(limit);

    const messages = await query.find();

    // Contar total
    const countQuery = this.messageRepository
      .whereEqualTo('recipientId', userId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true);
    const allMessages = await countQuery.find();
    const total = allMessages.length;

    // Summary
    const unreadCount = allMessages.filter(m => !m.read).length;

    return {
      data: messages,
      pagination: {
        total,
        limit,
        hasMore: total > messages.length,
      },
      summary: {
        unreadCount,
      },
    };
  }

  /**
   * Marcar como leído
   */
  async markAsRead(userId: string | any, messageId: string): Promise<InternalMessage> {
    // Extraer el ID y email del usuario (puede venir como string o como objeto)
    const actualUserId = typeof userId === 'string' ? userId : (userId.id || userId.userId);
    const userEmail = typeof userId === 'string' ? null : userId.email;

    console.log('[markAsRead] Request:', { messageId, actualUserId, userEmail });

    // Usar directamente el admin SDK en lugar de fireorm
    const db = admin.firestore();
    const docRef = db.collection('internal-message').doc(messageId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.error('[markAsRead] Message document not found');
      throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
    }

    const data = docSnap.data();
    console.log('[markAsRead] Message data:', {
      recipientId: data.recipientId,
      recipientType: data.recipientType,
      title: data.title
    });

    // Si el recipientType es COLLABORATOR o ADMINISTRATOR, buscar el userId
    let ownerUserId = data.recipientId;
    let allowAccess = false;

    // Normalizar recipientType a minúsculas para comparación
    const recipientType = (data.recipientType || '').toLowerCase();

    if (recipientType === 'collaborator') {
      const collaboratorDoc = await db.collection('collaborator').doc(data.recipientId).get();
      console.log('[markAsRead] Collaborator doc exists:', collaboratorDoc.exists);
      if (collaboratorDoc.exists) {
        const collaboratorData = collaboratorDoc.data();
        console.log('[markAsRead] Collaborator data:', {
          id: collaboratorDoc.id,
          userId: collaboratorData.userId,
          email: collaboratorData.email
        });
        if (collaboratorData.userId) {
          ownerUserId = collaboratorData.userId;
        } else if (userEmail && collaboratorData.email) {
          // Si no hay userId, comparar por email
          if (collaboratorData.email.toLowerCase() === userEmail.toLowerCase()) {
            allowAccess = true;
            console.log('[markAsRead] Access granted - collaborator email matches');
          }
        }
      }
    } else if (recipientType === 'administrator' || recipientType === 'business') {
      let adminDoc = await db.collection('administrator').doc(data.recipientId).get();
      console.log('[markAsRead] Administrator doc exists:', adminDoc.exists);
      if (!adminDoc.exists) {
        adminDoc = await db.collection('business').doc(data.recipientId).get();
        console.log('[markAsRead] Business doc exists:', adminDoc.exists);
      }
      if (adminDoc.exists) {
        const adminData = adminDoc.data();
        console.log('[markAsRead] Admin/Business data:', {
          id: adminDoc.id,
          userId: adminData.userId,
          email: adminData.email
        });
        if (adminData.userId) {
          ownerUserId = adminData.userId;
        } else {
          // Si no tiene userId, comparar por email
          if (userEmail && adminData.email && adminData.email.toLowerCase() === userEmail.toLowerCase()) {
            allowAccess = true;
            console.log('[markAsRead] Access granted by email match');
          }
        }
      }
    }

    console.log('[markAsRead] Access check:', {
      ownerUserId,
      actualUserId,
      allowAccess,
      match: ownerUserId === actualUserId
    });

    if (!allowAccess && ownerUserId !== actualUserId) {
      console.error('[markAsRead] Access denied - user mismatch');
      throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
    }

    if (data.read) {
      // Ya estaba leído, solo retornar
      const message = new InternalMessage();
      message.id = messageId;
      Object.assign(message, data);
      return message;
    }

    const readAt = new Date();

    // Actualizar en Firestore
    await docRef.update({
      read: true,
      status: MessageStatus.READ,
      readAt: readAt,
    });

    // Publicar evento
    const event = new InternalMessageRead(
      new Date(),
      {
        id: messageId,
        recipientId: actualUserId,
        read: true,
        status: 'read',
        readAt: readAt,
      },
      { userId: actualUserId },
    );
    await publish(event);

    // Retornar el mensaje actualizado
    const message = new InternalMessage();
    message.id = messageId;
    Object.assign(message, data);
    message.read = true;
    message.status = MessageStatus.READ;
    message.readAt = readAt;

    return message;
  }

  /**
   * Marcar múltiples como leído
   */
  async bulkMarkAsRead(userId: string | any, dto: BulkReadDto): Promise<any> {
    const updated: string[] = [];

    if (dto.messageIds && dto.messageIds.length > 0) {
      for (const messageId of dto.messageIds) {
        try {
          await this.markAsRead(userId, messageId);
          updated.push(messageId);
        } catch (error) {
          // Continuar con los demás
          console.error(`Error marking message ${messageId} as read:`, error.message);
        }
      }
    }

    return {
      updated: updated.length,
      messageIds: updated,
    };
  }

  /**
   * Archivar múltiples mensajes
   */
  async bulkArchive(userId: string | any, dto: BulkReadDto): Promise<any> {
    const archived: string[] = [];

    if (dto.messageIds && dto.messageIds.length > 0) {
      for (const messageId of dto.messageIds) {
        try {
          await this.archiveMessage(userId, messageId);
          archived.push(messageId);
        } catch (error) {
          // Continuar con los demás
          console.error(`Error archiving message ${messageId}:`, error.message);
        }
      }
    }

    return {
      archived: archived.length,
      messageIds: archived,
    };
  }

  /**
   * Archivar mensaje
   */
  async archiveMessage(userId: string | any, messageId: string): Promise<InternalMessage> {
    // Extraer el ID y email del usuario (puede venir como string o como objeto)
    const actualUserId = typeof userId === 'string' ? userId : (userId.id || userId.userId);
    const userEmail = typeof userId === 'string' ? null : userId.email;

    console.log('[Service] Searching for message:', { messageId, actualUserId, userEmail });

    // Usar directamente el admin SDK en lugar de fireorm
    const db = admin.firestore();
    const docRef = db.collection('internal-message').doc(messageId);
    const docSnap = await docRef.get();

    console.log('[Service] Document exists:', docSnap.exists);

    if (!docSnap.exists) {
      console.error('[Service] Message document not found in Firestore');
      throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
    }

    const data = docSnap.data();
    console.log('[Service] Document data:', {
      id: docSnap.id,
      recipientId: data.recipientId,
      recipientType: data.recipientType,
      title: data.title,
      status: data.status,
    });

    // Si el recipientType es COLLABORATOR o ADMINISTRATOR, buscar el userId
    let ownerUserId = data.recipientId;
    let allowAccess = false;

    // Normalizar recipientType a minúsculas para comparación
    const recipientType = (data.recipientType || '').toLowerCase();

    if (recipientType === 'collaborator') {
      const collaboratorDoc = await db.collection('collaborator').doc(data.recipientId).get();
      console.log('[Service] Collaborator doc exists:', collaboratorDoc.exists);
      if (collaboratorDoc.exists) {
        const collaboratorData = collaboratorDoc.data();
        console.log('[Service] Collaborator data:', {
          id: collaboratorDoc.id,
          userId: collaboratorData.userId,
          email: collaboratorData.email
        });
        if (collaboratorData.userId) {
          ownerUserId = collaboratorData.userId;
          console.log('[Service] Found collaborator userId:', ownerUserId);
        } else if (userEmail && collaboratorData.email) {
          // Si no hay userId, comparar por email
          if (collaboratorData.email.toLowerCase() === userEmail.toLowerCase()) {
            allowAccess = true;
            console.log('[Service] Access granted - collaborator email matches');
          }
        }
      }
    } else if (recipientType === 'administrator' || recipientType === 'business') {
      // Intentar primero en 'administrator', luego en 'business'
      let adminDoc = await db.collection('administrator').doc(data.recipientId).get();
      console.log('[Service] Administrator doc exists in administrator:', adminDoc.exists);

      if (!adminDoc.exists) {
        adminDoc = await db.collection('business').doc(data.recipientId).get();
        console.log('[Service] Administrator doc exists in business:', adminDoc.exists);
      }

      if (adminDoc.exists) {
        const adminData = adminDoc.data();
        console.log('[Service] Administrator data:', { id: adminDoc.id, userId: adminData.userId, email: adminData.email });
        if (adminData.userId) {
          ownerUserId = adminData.userId;
          console.log('[Service] Found administrator userId:', ownerUserId);
        } else {
          // Si no tiene userId, comparar por email
          console.log('[Service] No userId in administrator doc, comparing by email');
          if (userEmail && adminData.email && adminData.email.toLowerCase() === userEmail.toLowerCase()) {
            // El email coincide, permitir acceso
            allowAccess = true;
            console.log('[Service] Allowing access - email matches:', userEmail);
          } else {
            console.log('[Service] Email mismatch:', { adminEmail: adminData.email, userEmail });
          }
        }
      } else {
        console.error('[Service] Administrator document not found in any collection:', data.recipientId);
      }
    }

    if (!allowAccess && ownerUserId !== actualUserId) {
      console.error('[Service] User mismatch:', {
        recipientId: data.recipientId,
        recipientType: data.recipientType,
        ownerUserId: ownerUserId,
        requestedUserId: actualUserId,
      });
      throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
    }

    // Actualizar en Firestore
    await docRef.update({
      status: MessageStatus.ARCHIVED,
      archivedAt: new Date(),
    });

    // Publicar evento
    const event = new InternalMessageArchived(
      new Date(),
      {
        id: messageId,
        status: 'archived',
        archivedAt: new Date(),
      },
      { userId: actualUserId },
    );
    await publish(event);

    // Retornar el mensaje actualizado (buscar de nuevo o construir)
    const message = new InternalMessage();
    message.id = messageId;
    Object.assign(message, data);
    message.status = MessageStatus.ARCHIVED;
    message.archivedAt = new Date();

    return message;
  }

  /**
   * Crear o obtener conversación (para fase 2 - chat)
   */
  async getOrCreateConversation(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<MessageConversation> {
    console.log('[getOrCreateConversation] ========================================');
    console.log('[getOrCreateConversation] Called by userId:', userId);
    console.log('[getOrCreateConversation] DTO:', dto);

    // Asegurar que los IDs sean strings, no objetos
    const cleanUserId = typeof userId === 'object' ? (userId as any).id || (userId as any).userId : userId;
    let cleanParticipantId = typeof dto.participantId === 'object'
      ? (dto.participantId as any).id || (dto.participantId as any).userId
      : dto.participantId;

    // IMPORTANTE: cleanParticipantId podría ser el document ID de Firestore,
    // pero necesitamos el Auth UID. Buscar en el documento para obtener userId.
    try {
      const db = this.messageRepository['firestoreColRef'].firestore;
      let participantAuthUid = cleanParticipantId;

      // Intentar buscar en collaborator
      const collabDoc = await db.collection('collaborator').doc(cleanParticipantId).get();
      if (collabDoc.exists) {
        const collabData = collabDoc.data();
        participantAuthUid = collabData.userId || cleanParticipantId;
        console.log('[getOrCreateConversation] Found collaborator document');
        console.log('[getOrCreateConversation] collabData.userId:', collabData.userId);
        console.log('[getOrCreateConversation] Resolved collaborator Auth UID:', participantAuthUid);
      } else {
        // Intentar en administrator - NO usar document ID, buscar por email para encontrar el correcto
        const adminDoc = await db.collection('administrator').doc(cleanParticipantId).get();
        if (adminDoc.exists) {
          const adminData = adminDoc.data();
          console.log('[getOrCreateConversation] Found administrator document');
          console.log('[getOrCreateConversation] Administrator document fields:', Object.keys(adminData));
          console.log('[getOrCreateConversation] adminData.userId:', adminData.userId);
          console.log('[getOrCreateConversation] adminData.id:', adminData.id);

          // Si no tiene userId, usar el document ID directamente como UID
          // Esto es un workaround porque administrator no tiene userId field
          participantAuthUid = adminData.userId || cleanParticipantId;
          console.log('[getOrCreateConversation] Resolved administrator Auth UID (using document ID):', participantAuthUid);
        } else {
          console.warn('[getOrCreateConversation] No document found for participant:', cleanParticipantId);
        }
      }

      cleanParticipantId = participantAuthUid;
    } catch (error) {
      console.warn('[getOrCreateConversation] Could not resolve participant Auth UID:', error.message);
    }

    // Ordenar IDs alfabéticamente
    const participantIds = [cleanUserId, cleanParticipantId].sort();
    console.log('[getOrCreateConversation] Participant IDs (sorted, using Auth UIDs):', participantIds);

    console.log('[getOrCreateConversation] Looking for existing conversation:', {
      participantIds,
      commerceId: dto.commerceId,
    });

    // Buscar existente (solo activas no archivadas)
    const existing = await this.conversationRepository
      .whereArrayContains('participantIds', participantIds[0])
      .whereEqualTo('commerceId', dto.commerceId)
      .whereEqualTo('active', true)
      .find();

    console.log('[getOrCreateConversation] Found', existing.length, 'conversations');

    const found = existing.find(
      conv =>
        conv.participantIds.length === 2 &&
        conv.participantIds.includes(participantIds[0]) &&
        conv.participantIds.includes(participantIds[1]),
    );

    if (found) {
      console.log('[getOrCreateConversation] Reusing existing conversation:', found.id);
      return found;
    }

    console.log('[getOrCreateConversation] Creating new conversation');

    // Crear nueva
    const conversation = new MessageConversation();
    conversation.participantIds = participantIds;
    conversation.participants = []; // Llenar con datos de usuarios
    conversation.commerceId = dto.commerceId;
    conversation.totalMessages = 0;
    conversation.unreadCountByUser = {
      [cleanUserId]: 0,
      [cleanParticipantId]: 0,
    };
    conversation.active = true;
    conversation.createdAt = new Date();
    conversation.updatedAt = new Date();

    console.log('[getOrCreateConversation] Conversation object to create:', {
      participantIds: conversation.participantIds,
      commerceId: conversation.commerceId,
      active: conversation.active,
    });

    const created = await this.conversationRepository.create(conversation);

    console.log('[getOrCreateConversation] New conversation created successfully:', {
      id: created.id,
      participantIds: created.participantIds,
      commerceId: created.commerceId,
      active: created.active,
    });
    console.log('[getOrCreateConversation] ========================================');

    // Publicar evento
    const event = new MessageConversationCreated(new Date(), created, { userId });
    await publish(event);

    return created;
  }

  /**
   * Actualizar conversación cuando llega nuevo mensaje
   */
  private async updateConversation(
    conversationId: string,
    message: InternalMessage,
  ): Promise<void> {
    try {
      console.log('[updateConversation] Updating conversation:', conversationId);
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        console.error('[updateConversation] Conversation not found:', conversationId);
        return;
      }

      console.log('[updateConversation] Current conversation state:', {
        id: conversation.id,
        totalMessages: conversation.totalMessages,
        participantIds: conversation.participantIds,
      });

      conversation.lastMessageId = message.id;
      conversation.lastMessageContent = message.content;
      conversation.lastMessageAt = message.createdAt;
      // Guardar toda la información del remitente para mostrarlo en el frontend
      conversation.lastMessageSenderId = message.senderId;
      conversation.totalMessages = (conversation.totalMessages || 0) + 1;
      conversation.updatedAt = new Date();

      // Incrementar contador de no leídos para el recipiente
      if (!conversation.unreadCountByUser) {
        conversation.unreadCountByUser = {};
      }
      conversation.unreadCountByUser[message.recipientId] =
        (conversation.unreadCountByUser[message.recipientId] || 0) + 1;

      console.log('[updateConversation] Saving updated conversation:', {
        id: conversation.id,
        totalMessages: conversation.totalMessages,
        unreadCountByUser: conversation.unreadCountByUser,
      });

      await this.conversationRepository.update(conversation);

      // Publicar evento
      const event = new MessageConversationUpdated(
        new Date(),
        {
          id: conversationId,
          lastMessageId: conversation.lastMessageId,
          lastMessageContent: conversation.lastMessageContent,
          lastMessageAt: conversation.lastMessageAt,
          lastMessageSenderId: conversation.lastMessageSenderId,
          totalMessages: conversation.totalMessages,
          unreadCountByUser: conversation.unreadCountByUser,
          updatedAt: conversation.updatedAt,
        },
        { userId: message.senderId },
      );
      await publish(event);
    } catch (error) {
      console.error('Error updating conversation:', error);
    }
  }

  /**
   * Obtener mensaje por ID
   */
  async getMessageById(messageId: string): Promise<InternalMessage> {
    return await this.messageRepository.findById(messageId);
  }

  /**
   * Enviar mensaje masivo (solo para usuarios MASTER)
   */
  async sendMassMessage(
    userId: string,
    userType: string,
    dto: any, // SendMassMessageDto
  ): Promise<{ sent: number; failed: number; details: any[] }> {
    console.log('[sendMassMessage] Master user sending mass message:', { userId, userType, dto });

    // TODO: Verificar permisos - solo MASTER puede usar esto
    if (userType !== 'master' && userType !== 'administrator') {
      throw new Error('Unauthorized: Only master users can send mass messages');
    }

    const db = admin.firestore();
    const results = { sent: 0, failed: 0, details: [] };

    try {
      // 1. Obtener todos los usuarios target según los criterios
      const targetUsers = await this.getTargetUsers(dto);
      console.log(`[sendMassMessage] Found ${targetUsers.length} target users`);

      // 2. Enviar mensaje a cada usuario
      for (const targetUser of targetUsers) {
        try {
          const message = new InternalMessage();
          message.type = MessageType.CHAT;
          message.category = dto.category || MessageCategory.ANNOUNCEMENT;
          message.priority = dto.priority || MessagePriority.NORMAL;
          message.title = dto.title;
          message.content = dto.content;
          message.icon = dto.icon || 'bi-megaphone';
          message.actionLink = dto.actionLink;
          message.actionLabel = dto.actionLabel;
          message.senderId = { id: userId, email: null, name: 'Sistema' };
          message.senderType = userType as any;
          message.recipientId = targetUser.id;
          message.recipientType = targetUser.type as any;
          message.commerceId = targetUser.commerceId || null;
          message.status = MessageStatus.UNREAD;
          message.read = false;
          message.active = true;
          message.available = true;
          message.createdAt = new Date();
          if (dto.expiresAt) message.expiresAt = dto.expiresAt;

          const created = await this.messageRepository.create(message);

          // Publicar evento
          const event = new InternalMessageCreated(new Date(), created, {
            userId,
            userType,
          });
          await publish(event);

          results.sent++;
          results.details.push({
            recipientId: targetUser.id,
            recipientType: targetUser.type,
            status: 'sent',
            messageId: created.id
          });

          console.log(`[sendMassMessage] Sent to ${targetUser.id} (${targetUser.type})`);
        } catch (error) {
          results.failed++;
          results.details.push({
            recipientId: targetUser.id,
            recipientType: targetUser.type,
            status: 'failed',
            error: error.message
          });
          console.error(`[sendMassMessage] Failed to send to ${targetUser.id}:`, error.message);
        }
      }

      console.log(`[sendMassMessage] Mass message completed: ${results.sent} sent, ${results.failed} failed`);
      return results;

    } catch (error) {
      console.error('[sendMassMessage] Error in mass message send:', error);
      throw error;
    }
  }

  /**
   * Crear conversación cross-business (solo para usuarios MASTER)
   */
  async createCrossBusinessConversation(
    userId: string,
    userType: string,
    dto: any, // CreateCrossBusinessConversationDto
  ): Promise<MessageConversation> {
    console.log('[createCrossBusinessConversation] Master creating cross-business conversation:', { userId, userType, dto });

    // TODO: Verificar permisos - solo MASTER puede usar esto
    if (userType !== 'master' && userType !== 'administrator') {
      throw new Error('Unauthorized: Only master users can create cross-business conversations');
    }

    // Crear conversación usando commerceId si existe, o null para cross-business
    const conversationDto = {
      participantId: dto.recipientId,
      recipientId: dto.recipientId,
      recipientType: dto.recipientType,
      commerceId: dto.targetCommerceId || null // null permite cross-business
    };

    const conversation = await this.getOrCreateConversation(userId, conversationDto);

    // Si hay mensaje inicial, enviarlo
    if (dto.initialMessage) {
      const messageDto = {
        title: 'Nuevo chat',
        content: dto.initialMessage,
        category: MessageCategory.DIRECT_MESSAGE,
        priority: MessagePriority.NORMAL,
        recipientId: dto.recipientId,
        recipientType: dto.recipientType,
        commerceId: dto.targetCommerceId || null,
        conversationId: conversation.id
      };

      await this.sendMessage(userId, userType, messageDto);
    }

    console.log('[createCrossBusinessConversation] Cross-business conversation created:', conversation.id);
    return conversation;
  }

  /**
   * Obtener usuarios target para mensaje masivo
   */
  private async getTargetUsers(dto: any): Promise<Array<{ id: string; type: string; commerceId?: string }>> {
    const db = admin.firestore();
    const users = [];

    try {
      // Si se especifican businesses específicos
      if (dto.targetBusinessIds && dto.targetBusinessIds.length > 0) {
        for (const businessId of dto.targetBusinessIds) {
          // Obtener administrators de este business
          if (dto.targetUserTypes.includes('administrator')) {
            const adminSnapshot = await db.collection('administrator')
              .where('businessId', '==', businessId)
              .where('active', '==', true)
              .get();

            adminSnapshot.forEach(doc => {
              users.push({
                id: doc.id,
                type: 'administrator',
                commerceId: null
              });
            });
          }

          // Obtener collaborators de los commerces de este business
          if (dto.targetUserTypes.includes('collaborator')) {
            const commerceSnapshot = await db.collection('commerce')
              .where('businessId', '==', businessId)
              .where('active', '==', true)
              .get();

            for (const commerceDoc of commerceSnapshot.docs) {
              const commerceId = commerceDoc.id;

              const collabSnapshot = await db.collection('collaborator')
                .where('commerceId', '==', commerceId)
                .where('active', '==', true)
                .get();

              collabSnapshot.forEach(doc => {
                users.push({
                  id: doc.id,
                  type: 'collaborator',
                  commerceId: commerceId
                });
              });
            }
          }
        }
      } else {
        // Envío masivo a TODOS los businesses
        if (dto.targetUserTypes.includes('administrator')) {
          const adminSnapshot = await db.collection('administrator')
            .where('active', '==', true)
            .get();

          adminSnapshot.forEach(doc => {
            users.push({
              id: doc.id,
              type: 'administrator',
              commerceId: null
            });
          });
        }

        if (dto.targetUserTypes.includes('collaborator')) {
          const collabSnapshot = await db.collection('collaborator')
            .where('active', '==', true)
            .get();

          collabSnapshot.forEach(doc => {
            const data = doc.data();
            users.push({
              id: doc.id,
              type: 'collaborator',
              commerceId: data.commerceId || null
            });
          });
        }

        if (dto.targetUserTypes.includes('business')) {
          const businessSnapshot = await db.collection('business')
            .where('active', '==', true)
            .get();

          businessSnapshot.forEach(doc => {
            users.push({
              id: doc.id,
              type: 'business',
              commerceId: null
            });
          });
        }
      }

      console.log(`[getTargetUsers] Found ${users.length} target users for mass message`);
      return users;

    } catch (error) {
      console.error('[getTargetUsers] Error getting target users:', error);
      throw error;
    }
  }
}
