import { HttpException, HttpStatus, Injectable, Inject, forwardRef, Optional } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { PackageStatus } from 'src/package/model/package-status.enum';
import { PackageType } from 'src/package/model/package-type.enum';
import { PackageService } from 'src/package/package.service';
import { PaymentConfirmation } from 'src/payment/model/payment-confirmation';
import { QueueType } from 'src/queue/model/queue-type.enum';
import { ServiceService } from 'src/service/service.service';
import { BookingService } from 'src/booking/booking.service';

import { Queue } from '../../queue/model/queue.entity';
import { QueueService } from '../../queue/queue.service';
import { BuilderInterface } from '../../shared/interfaces/builder';
import AttentionCreated from '../events/AttentionCreated';
import { AttentionStatus } from '../model/attention-status.enum';
import { AttentionType } from '../model/attention-type.enum';
import { Attention, Block } from '../model/attention.entity';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { LgpdConsentService } from '../../shared/services/lgpd-consent.service';
import TermsAccepted from '../../shared/events/TermsAccepted';
import { ConsentType } from '../../shared/model/lgpd-consent.entity';
import { ConsentStatus } from '../../shared/model/lgpd-consent.entity';

@Injectable()
export class AttentionReserveBuilder implements BuilderInterface {
  constructor(
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    private queueService: QueueService,
    private serviceService: ServiceService,
    private packageService: PackageService,
    @Inject(forwardRef(() => BookingService))
    private bookingService: BookingService,
    @Optional() @Inject(AuditLogService) private auditLogService?: AuditLogService,
    @Optional() @Inject(LgpdConsentService) private lgpdConsentService?: LgpdConsentService
  ) {}

  async create(
    queue: Queue,
    collaboratorId?: string,
    type?: AttentionType,
    channel?: string,
    userId?: string,
    block?: Block,
    date?: Date,
    paymentConfirmationData?: PaymentConfirmation,
    bookingId?: string,
    servicesId?: string[],
    servicesDetails?: object[],
    clientId?: string,
    termsConditionsToAcceptCode?: string,
    termsConditionsAcceptedCode?: string,
    termsConditionsToAcceptedAt?: Date
  ): Promise<Attention> {
    if (!block) {
      throw new HttpException(
        `Intentando crear atención pero no tiene block`,
        HttpStatus.BAD_REQUEST
      );
    }
    const attention = new Attention();
    attention.status = AttentionStatus.PENDING;
    attention.type = type || AttentionType.STANDARD;
    attention.createdAt = date || new Date();
    attention.queueId = queue.id;
    attention.commerceId = queue.commerceId;
    const currentNumber = queue.currentNumber;
    if (block && Object.keys(block).length > 0 && queue.type !== QueueType.SELECT_SERVICE) {
      // attentionNumber is set from block.number but not used
    } else {
      attention.number = currentNumber + 1;
    }
    if (block && block.number) {
      attention.number = block.number;
      attention.block = block;
    }
    if (queue.professionalId !== undefined) {
      attention.collaboratorId = queue.professionalId; // Attention usa collaboratorId para referirse al profesional que registra
    } else if (queue.collaboratorId !== undefined) {
      // Compatibilidad temporal: si aún no migrado, usar collaboratorId del queue
      attention.collaboratorId = queue.collaboratorId;
    }
    if (collaboratorId !== undefined) {
      attention.collaboratorId = collaboratorId;
    }
    attention.channel = channel;
    if (userId !== undefined) {
      attention.userId = userId;
    }
    if (termsConditionsToAcceptCode !== undefined) {
      attention.termsConditionsToAcceptCode = termsConditionsToAcceptCode;
    }
    if (termsConditionsAcceptedCode !== undefined) {
      attention.termsConditionsAcceptedCode = termsConditionsAcceptedCode;
    }
    if (termsConditionsToAcceptedAt !== undefined) {
      attention.termsConditionsToAcceptedAt = termsConditionsToAcceptedAt;

      // Si se aceptaron términos, publicar evento
      if (termsConditionsAcceptedCode && termsConditionsToAcceptedAt) {
        const termsAcceptedEvent = new TermsAccepted(new Date(), {
          attentionId: attention.id,
          clientId: attention.clientId,
          commerceId: attention.commerceId,
          acceptedAt: termsConditionsToAcceptedAt,
          acceptedCode: termsConditionsAcceptedCode,
        }, { user: attention.userId || 'system' });
        publish(termsAcceptedEvent);

        // Crear consentimiento LGPD automáticamente
        if (this.lgpdConsentService && attention.clientId && attention.commerceId) {
          try {
            await this.lgpdConsentService.createOrUpdateConsent(
              attention.userId || 'system',
              {
                clientId: attention.clientId,
                commerceId: attention.commerceId,
                consentType: ConsentType.TERMS_ACCEPTANCE,
                purpose: 'Aceptación de términos y condiciones de servicio',
                legalBasis: 'CONSENT',
                status: ConsentStatus.GRANTED,
                notes: `Consentimiento otorgado al aceptar términos y condiciones para atención ${attention.id}`,
                ipAddress: undefined, // TODO: Obtener IP del request
                consentMethod: 'WEB',
              }
            );
          } catch (error) {
            // Log error but don't fail the attention creation
            console.error(`Error creating LGPD consent for attention ${attention.id}:`, error);
          }
        }

        // Registrar auditoría específica
        if (this.auditLogService) {
          await this.auditLogService.logAction(
            attention.userId || 'system',
            'UPDATE',
            'attention_terms',
            attention.id,
            {
              entityName: `Aceptación Términos - Atención ${attention.id}`,
              result: 'SUCCESS',
              metadata: {
                attentionId: attention.id,
                clientId: attention.clientId,
                commerceId: attention.commerceId,
                acceptedCode: termsConditionsAcceptedCode,
                acceptedAt: termsConditionsToAcceptedAt,
              },
              complianceFlags: {
                lgpdConsent: true,
              },
            }
          );
        }
      }
    }
    const dateToCreate = date || new Date();
    const existingAttention = await this.getAttentionByNumberAndDate(
      attention.number,
      attention.queueId,
      dateToCreate
    );
    if (existingAttention && existingAttention.length > 0) {
      throw new HttpException(
        `Ya existe una atención con este numero para esta fecha ${attention.number} ${attention.queueId} ${dateToCreate}´`,
        HttpStatus.BAD_REQUEST
      );
    }
    if (queue.serviceId !== undefined) {
      attention.serviceId = queue.serviceId;
    }
    if (servicesId) {
      attention.servicesId = servicesId;
    }
    if (servicesDetails) {
      attention.servicesDetails = servicesDetails;
    }
    if (paymentConfirmationData !== undefined) {
      if (paymentConfirmationData.paid && paymentConfirmationData.paid === true) {
        attention.paymentConfirmationData = paymentConfirmationData;
        attention.paid = paymentConfirmationData.paid;
        attention.paidAt = paymentConfirmationData.paymentDate;
        attention.confirmed = true;
        attention.confirmedAt = new Date();
      }
    }
    if (bookingId != undefined) {
      attention.bookingId = bookingId;
    }
    if (clientId) {
      attention.clientId = clientId;
    }
    const attentionCreated = await this.attentionRepository.create(attention);

    // If attention is created from a booking, copy packageId from booking
    if (bookingId) {
      try {
        const booking = await this.bookingService.getBookingById(bookingId);
        if (booking && booking.packageId) {
          attention.packageId = booking.packageId;
          attention.packageProcedureNumber = booking.packageProcedureNumber;
          attention.packageProceduresTotalNumber = booking.packageProceduresTotalNumber;
          await this.attentionRepository.update(attention);
          // Add attention to package
          await this.packageService.addProcedureToPackage(
            'ett',
            booking.packageId,
            [],
            [attentionCreated.id]
          );

          // CRITICAL: If the package is already paid, mark the attention as paid automatically
          try {
            const pack = await this.packageService.getPackageById(booking.packageId);
            if (pack && pack.paid === true) {
              attention.paid = true;
              attention.paidAt = new Date();
              attention.paymentConfirmationData = {
                bankEntity: '',
                procedureNumber: attention.packageProcedureNumber || 0,
                proceduresTotalNumber: attention.packageProceduresTotalNumber || 0,
                transactionId: '',
                paymentType: null,
                paymentMethod: null,
                installments: 0,
                paid: true,
                totalAmount: 0,
                paymentAmount: 0,
                paymentPercentage: 0,
                paymentDate: new Date(),
                paymentCommission: 0,
                paymentComment: 'Pago incluido en paquete prepagado',
                paymentFiscalNote: '',
                promotionalCode: '',
                paymentDiscountAmount: 0,
                paymentDiscountPercentage: 0,
                user: 'ett',
                packageId: attention.packageId,
                pendingPaymentId: '',
                processPaymentNow: false,
                confirmInstallments: false,
              } as PaymentConfirmation;
              await this.attentionRepository.update(attention);
            }
          } catch (error) {
            console.error('[AttentionReserveBuilder] Error checking package payment status:', error);
            // Don't block attention creation if we can't check package status
          }
        }
      } catch (error) {
        console.error('[AttentionReserveBuilder] Error getting booking for packageId:', error);
      }
    }

    if (paymentConfirmationData && paymentConfirmationData.packageId) {
      attention.packageId = paymentConfirmationData.packageId;
      attention.packageProceduresTotalNumber = paymentConfirmationData.proceduresTotalNumber;
      attention.packageProcedureNumber = paymentConfirmationData.procedureNumber;
      await this.attentionRepository.update(attention);
    } else if (!bookingId || !attention.packageId) {
      // Only check for/create packages if not already set from booking
      if (attentionCreated.servicesId && attentionCreated.servicesId.length === 1) {
        const service = await this.serviceService.getServiceById(attentionCreated.servicesId[0]);

        // Determine procedures amount: from servicesDetails first, then service.serviceInfo.procedures, then service.serviceInfo.proceduresList
        let proceduresAmount = 0;
        console.log('[AttentionReserveBuilder] Determining procedures amount:', {
          servicesDetails: servicesDetails,
          servicesDetailsLength: servicesDetails?.length,
          firstServiceDetails: servicesDetails?.[0],
          proceduresInDetails: servicesDetails?.[0]?.['procedures'],
          serviceProcedures: service?.serviceInfo?.procedures,
          serviceProceduresList: service?.serviceInfo?.proceduresList
        });

        if (servicesDetails && servicesDetails.length > 0 && servicesDetails[0]['procedures']) {
          proceduresAmount = parseInt(servicesDetails[0]['procedures'], 10) || servicesDetails[0]['procedures'];
          console.log('[AttentionReserveBuilder] Using procedures from servicesDetails:', proceduresAmount);
        } else if (service && service.serviceInfo && service.serviceInfo.procedures) {
          proceduresAmount = service.serviceInfo.procedures;
          console.log('[AttentionReserveBuilder] Using procedures from service.serviceInfo:', proceduresAmount);
        } else if (service && service.serviceInfo && service.serviceInfo.proceduresList) {
          // Use first value from proceduresList as fallback
          const proceduresList = service.serviceInfo.proceduresList.trim().split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p) && p > 0);
          if (proceduresList.length > 0) {
            proceduresAmount = proceduresList[0];
            console.log('[AttentionReserveBuilder] Using first value from proceduresList:', proceduresAmount);
          }
        }

        console.log('[AttentionReserveBuilder] Final proceduresAmount:', proceduresAmount);

        if (proceduresAmount > 1) {
          if (attentionCreated.clientId) {
            const packs = await this.packageService.getPackageByCommerceIdAndClientServices(
              attentionCreated.commerceId,
              attentionCreated.clientId,
              attentionCreated.servicesId[0]
            );
            if (packs && packs.length > 0) {
              // Associate attention to existing active package with sessions remaining
              const activePackage = packs.find(pkg => {
                const isActive = [PackageStatus.ACTIVE, PackageStatus.CONFIRMED, PackageStatus.REQUESTED].includes(pkg.status);
                const hasPendingSessions = (pkg.proceduresLeft || 0) > 0;
                return isActive && hasPendingSessions;
              });
              if (activePackage) {
                attention.packageId = activePackage.id;
                await this.attentionRepository.update(attention);
                // Add attention to package
                await this.packageService.addProcedureToPackage(
                  'ett',
                  activePackage.id,
                  [],
                  [attentionCreated.id]
                );
              } else {
                // No active package found, create new one
                const packageName = service.tag.toLocaleUpperCase();
                const packCreated = await this.packageService.createPackage(
                  'ett',
                  attentionCreated.commerceId,
                  attentionCreated.clientId,
                  undefined,
                  attentionCreated.id,
                  proceduresAmount,
                  packageName,
                  attentionCreated.servicesId,
                  [],
                  [attentionCreated.id],
                  PackageType.STANDARD,
                  PackageStatus.REQUESTED
                );
                attention.packageId = packCreated.id;
                await this.attentionRepository.update(attention);
              }
            } else {
              // No packages exist, create new one
              const packageName = service.tag.toLocaleUpperCase();
              const packCreated = await this.packageService.createPackage(
                'ett',
                attentionCreated.commerceId,
                attentionCreated.clientId,
                undefined,
                attentionCreated.id,
                proceduresAmount,
                packageName,
                attentionCreated.servicesId,
                [],
                [attentionCreated.id],
                PackageType.STANDARD,
                PackageStatus.REQUESTED
              );
              attention.packageId = packCreated.id;
              await this.attentionRepository.update(attention);
            }
          }
        }
      }
    }
    queue.currentNumber = attentionCreated.number;
    // Set currentAttentionNumber when it's the first attention or when it's not set
    if (
      queue.currentNumber === 1 ||
      !queue.currentAttentionNumber ||
      queue.currentAttentionNumber === 0
    ) {
      queue.currentAttentionId = attentionCreated.id;
      queue.currentAttentionNumber = attentionCreated.number;
    }
    await this.queueService.updateQueue('', queue);
    // Use attention.createdAt for occurredOn to preserve historical dates
    // Falls back to new Date() for backward compatibility if createdAt is not set
    const attentionCreatedEvent = new AttentionCreated(
      attentionCreated.createdAt || new Date(),
      attentionCreated
    );
    publish(attentionCreatedEvent);

    return attentionCreated;
  }

  public async getAttentionByNumberAndDate(
    number: number,
    queueId: string,
    date: Date
  ): Promise<Attention[]> {
    const startDate = date.toISOString().slice(0, 10);
    const dateValue = new Date(startDate);
    return await this.attentionRepository
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('number', number)
      .whereIn('status', [
        AttentionStatus.PENDING,
        AttentionStatus.PROCESSING,
        AttentionStatus.RATED,
        AttentionStatus.TERMINATED,
        AttentionStatus.REACTIVATED,
      ])
      .whereGreaterOrEqualThan('createdAt', dateValue)
      .whereLessOrEqualThan('createdAt', dateValue)
      .orderByDescending('createdAt')
      .find();
  }
}
