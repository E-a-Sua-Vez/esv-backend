import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';

import { ClientService } from '../client/client.service';
import { MedicalExamOrderService } from '../medical-exam-order/medical-exam-order.service';
import { ExamResult } from '../medical-exam-order/model/medical-exam-order.entity';
import { NotificationService } from '../notification/notification.service';

import { HL7MapperService } from './hl7-mapper.service';
import { HL7ParserService } from './hl7-parser.service';
import { ORU_R01_Message } from './model/hl7-message.model';

@Injectable()
export class HL7Service {
  private readonly logger = new Logger(HL7Service.name);

  constructor(
    private readonly parserService: HL7ParserService,
    private readonly mapperService: HL7MapperService,
    private readonly examOrderService: MedicalExamOrderService,
    private readonly notificationService: NotificationService,
    private readonly clientService: ClientService
  ) {}

  /**
   * Process incoming HL7 message
   */
  async processMessage(
    rawMessage: string,
    laboratoryId?: string,
    laboratoryName?: string
  ): Promise<{
    success: boolean;
    messageId: string;
    examOrderIds: string[];
    error?: string;
  }> {
    try {
      this.logger.log('Processing HL7 message...');

      // Parse HL7 message
      const hl7Message = this.parserService.parseMessage(rawMessage);
      this.logger.log(
        `Parsed HL7 message: ${hl7Message.messageType}, Control ID: ${hl7Message.messageControlId}`
      );

      // Find matching exam order
      const examOrderId = await this.findMatchingExamOrder(hl7Message);
      if (!examOrderId) {
        throw new HttpException(
          `No matching exam order found for patient ${hl7Message.patientId} and order ${hl7Message.orderNumber}`,
          HttpStatus.NOT_FOUND
        );
      }

      // Map HL7 to ExamResult
      const examResult = this.mapperService.mapToExamResult(hl7Message, examOrderId);

      // Add laboratory information
      if (laboratoryId) {
        examResult.interpretedBy = laboratoryName || laboratoryId;
      }

      // Add results to exam order
      await this.examOrderService.addExamResults('system', examOrderId, [examResult]);

      // Send notification
      await this.sendResultNotification(examOrderId, examResult);

      this.logger.log(`Successfully processed HL7 message. Exam Order ID: ${examOrderId}`);

      return {
        success: true,
        messageId: hl7Message.messageControlId,
        examOrderIds: [examOrderId],
      };
    } catch (error) {
      this.logger.error(`Error processing HL7 message: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Error processing HL7 message: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Find matching exam order for HL7 message
   */
  private async findMatchingExamOrder(hl7Message: ORU_R01_Message): Promise<string | null> {
    // Strategy 1: Try to find order by order number (if it's an order ID)
    if (hl7Message.orderNumber) {
      try {
        const order = await this.examOrderService.getExamOrderById(hl7Message.orderNumber);
        if (order) {
          this.logger.log(`Found order by ID: ${hl7Message.orderNumber}`);
          return order.id;
        }
      } catch (error) {
        // Order not found by ID, continue to other strategies
        this.logger.debug(`Order not found by ID: ${hl7Message.orderNumber}`);
      }

      // Strategy 1b: Try to find by HL7 order number (stored in metadata)
      try {
        const order = await this.examOrderService.findExamOrderByHL7OrderNumber(
          hl7Message.orderNumber
        );
        if (order) {
          this.logger.log(`Found order by HL7 order number: ${hl7Message.orderNumber}`);
          return order.id;
        }
      } catch (error) {
        this.logger.debug(`Order not found by HL7 order number: ${error.message}`);
      }
    }

    // Strategy 2: Find by HL7 patient ID (sin necesidad de commerceId)
    if (hl7Message.patientId) {
      try {
        const orders = await this.examOrderService.findExamOrdersByHL7PatientId(
          hl7Message.patientId
        );

        if (orders.length === 0) {
          this.logger.warn(`No orders found for HL7 patient ID: ${hl7Message.patientId}`);
        } else if (orders.length === 1) {
          // Si solo hay una orden pendiente, usarla
          this.logger.log(`Found single pending order for HL7 patient ID: ${hl7Message.patientId}`);
          return orders[0].id;
        } else {
          // Múltiples órdenes pendientes - intentar match por order number o exam name
          if (hl7Message.orderNumber) {
            const matchingOrder = orders.find(
              order =>
                order.hl7OrderNumber === hl7Message.orderNumber ||
                order.exams.some(exam => exam.examCode === hl7Message.orderNumber)
            );
            if (matchingOrder) {
              this.logger.log(`Found order by HL7 patient ID and order number`);
              return matchingOrder.id;
            }
          }

          // Match por nombre de examen
          if (hl7Message.observations.length > 0) {
            const examName = hl7Message.observations[0].observationName;
            if (examName) {
              const matchingOrder = orders.find(order =>
                order.exams.some(
                  exam =>
                    exam.examName.toLowerCase().includes(examName.toLowerCase()) ||
                    examName.toLowerCase().includes(exam.examName.toLowerCase())
                )
              );
              if (matchingOrder) {
                this.logger.log(`Found order by HL7 patient ID and exam name`);
                return matchingOrder.id;
              }
            }
          }

          // Si no hay match específico, usar la más reciente
          this.logger.warn(
            `Multiple pending orders found for HL7 patient ID: ${hl7Message.patientId}. ` +
              `Using most recent order: ${orders[0].id}`
          );
          return orders[0].id;
        }
      } catch (error) {
        this.logger.warn(`Error finding orders by HL7 patient ID: ${error.message}`);
      }
    }

    this.logger.error(
      `Could not find matching exam order. ` +
        `Order Number: ${hl7Message.orderNumber}, Patient ID: ${hl7Message.patientId}`
    );

    return null;
  }

  /**
   * Send notification about received results
   */
  private async sendResultNotification(examOrderId: string, examResult: ExamResult): Promise<void> {
    try {
      // Get exam order to find doctor
      const examOrder = await this.examOrderService.getExamOrderById(examOrderId);

      // Create in-app notification (stored in database)
      // Note: For email/SMS notifications, you would use createEmailNotification or createWhatsappNotification
      // For now, we'll create a simple notification record
      // In a full implementation, you might want to:
      // 1. Create a notification entity in Firestore
      // 2. Send email notification to doctor
      // 3. Send push notification if mobile app exists

      this.logger.log(
        `Exam result received for order ${examOrderId}. ` +
          `Doctor: ${examOrder.doctorId}, Exam: ${examResult.examName}`
      );

      // TODO: Implement full notification system
      // For now, we'll just log the notification
      // In production, you would:
      // - Create notification record
      // - Send email to doctor
      // - Trigger frontend notification via WebSocket/Firebase
    } catch (error) {
      this.logger.error(`Error sending notification: ${error.message}`);
      // Don't throw - notification failure shouldn't fail the whole process
    }
  }
}
