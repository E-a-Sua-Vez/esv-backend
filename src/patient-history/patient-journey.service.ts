import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { Attention } from '../attention/model/attention.entity';
import { Booking } from '../booking/model/booking.entity';
import { MedicalExamOrder } from '../medical-exam-order/model/medical-exam-order.entity';
import { Prescription } from '../prescription/model/prescription.entity';

import { ConsultationHistoryService } from './consultation-history.service';
import { ConsultationHistory } from './model/consultation-history.entity';
import { PatientHistory, Control } from './model/patient-history.entity';

export class PatientJourneyItem {
  type: 'booking' | 'attention' | 'consultation' | 'control' | 'prescription' | 'exam_order';
  id: string;
  date: Date;
  item: Booking | Attention | ConsultationHistory | Control | Prescription | MedicalExamOrder;
  relationships: {
    bookingId?: string;
    attentionId?: string;
    patientHistoryId?: string;
    controlId?: string;
    originalAttentionId?: string;
    newBookingId?: string;
    newAttentionId?: string;
    clientId: string;
  };
}

export class PatientJourneyDto {
  clientId: string;
  commerceId: string;
  patientHistory?: PatientHistory;
  timeline: PatientJourneyItem[];
  summary: {
    totalBookings: number;
    totalAttentions: number;
    totalConsultations: number;
    totalControls: number;
    totalPrescriptions: number;
    totalExamOrders: number;
    pendingControls: number;
    pendingBookings: number;
  };
}

@Injectable()
export class PatientJourneyService {
  constructor(
    @InjectRepository(Attention)
    private attentionRepository = getRepository(Attention),
    @InjectRepository(Booking)
    private bookingRepository = getRepository(Booking),
    @InjectRepository(Prescription)
    private prescriptionRepository = getRepository(Prescription),
    @InjectRepository(MedicalExamOrder)
    private examOrderRepository = getRepository(MedicalExamOrder),
    @InjectRepository(PatientHistory)
    private patientHistoryRepository = getRepository(PatientHistory),
    private consultationHistoryService: ConsultationHistoryService
  ) {}

  /**
   * Get complete patient journey with all relationships
   */
  public async getPatientJourney(commerceId: string, clientId: string): Promise<PatientJourneyDto> {
    try {
      // Get all related data
      const [bookings, attentions, consultations, prescriptions, examOrders, patientHistory] =
        await Promise.all([
          this.getBookingsByClient(commerceId, clientId).catch(() => []),
          this.getAttentionsByClient(commerceId, clientId).catch(() => []),
          this.consultationHistoryService
            .getConsultationsByClientId(commerceId, clientId)
            .catch(() => []),
          this.getPrescriptionsByClient(commerceId, clientId).catch(() => []),
          this.getExamOrdersByClient(commerceId, clientId).catch(() => []),
          this.getPatientHistoryByClient(commerceId, clientId).catch(() => null),
        ]);

      // Extract controls from patientHistory
      const controls: Control[] = patientHistory?.control || [];

      // Build timeline
      const timeline: PatientJourneyItem[] = [];

      // Add bookings
      bookings.forEach(booking => {
        timeline.push({
          type: 'booking',
          id: booking.id,
          date: booking.dateFormatted || booking.createdAt,
          item: booking,
          relationships: {
            bookingId: booking.id,
            attentionId: booking.attentionId,
            clientId: booking.clientId,
          },
        });
      });

      // Add attentions
      attentions.forEach(attention => {
        timeline.push({
          type: 'attention',
          id: attention.id,
          date: attention.createdAt,
          item: attention,
          relationships: {
            bookingId: attention.bookingId,
            attentionId: attention.id,
            patientHistoryId: attention.patientHistoryId,
            controlId: attention.controlId,
            originalAttentionId: attention.originalAttentionId,
            clientId: attention.clientId,
          },
        });
      });

      // Add consultations
      consultations.forEach(consultation => {
        timeline.push({
          type: 'consultation',
          id: consultation.id,
          date: consultation.date || consultation.createdAt,
          item: consultation,
          relationships: {
            bookingId: consultation.bookingId,
            attentionId: consultation.attentionId,
            patientHistoryId: consultation.patientHistoryId,
            controlId: consultation.controlId,
            originalAttentionId: consultation.originalAttentionId,
            clientId: consultation.clientId,
          },
        });
      });

      // Add controls
      controls.forEach(control => {
        timeline.push({
          type: 'control',
          id: control.controlId || `control-${control.attentionId}-${control.scheduledDate}`,
          date: control.scheduledDate,
          item: control,
          relationships: {
            attentionId: control.attentionId,
            controlId: control.controlId,
            newBookingId: control.newBookingId,
            newAttentionId: control.newAttentionId,
            clientId: clientId,
          },
        });
      });

      // Add prescriptions
      prescriptions.forEach(prescription => {
        timeline.push({
          type: 'prescription',
          id: prescription.id,
          date: prescription.date,
          item: prescription,
          relationships: {
            attentionId: prescription.attentionId,
            patientHistoryId: prescription.patientHistoryId,
            clientId: prescription.clientId,
          },
        });
      });

      // Add exam orders
      examOrders.forEach(order => {
        timeline.push({
          type: 'exam_order',
          id: order.id,
          date: order.requestedAt,
          item: order,
          relationships: {
            attentionId: order.attentionId,
            patientHistoryId: order.patientHistoryId,
            clientId: order.clientId,
          },
        });
      });

      // Sort timeline by date
      // Filter out items with invalid dates and sort the rest
      const validTimeline = timeline.filter(item => {
        if (!item.date) return false;
        const date = item.date instanceof Date ? item.date : new Date(item.date);
        return !isNaN(date.getTime());
      });

      validTimeline.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateB.getTime() - dateA.getTime(); // Most recent first
      });

      // Replace timeline with sorted valid items
      timeline.length = 0;
      timeline.push(...validTimeline);

      // Calculate summary
      const pendingControls = controls.filter(c => c.status === 'PENDING').length;
      const pendingBookings = bookings.filter(b => b.status === 'PENDING').length;

      return {
        clientId,
        commerceId,
        patientHistory,
        timeline,
        summary: {
          totalBookings: bookings.length,
          totalAttentions: attentions.length,
          totalConsultations: consultations.length,
          totalControls: controls.length,
          totalPrescriptions: prescriptions.length,
          totalExamOrders: examOrders.length,
          pendingControls,
          pendingBookings,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Error retrieving patient journey: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get patient journey for a specific attention
   */
  public async getPatientJourneyByAttention(
    attentionId: string
  ): Promise<PatientJourneyDto | null> {
    const attention = await this.attentionRepository.findById(attentionId);
    if (!attention) {
      return null;
    }

    return this.getPatientJourney(attention.commerceId, attention.clientId);
  }

  // Helper methods
  private async getBookingsByClient(commerceId: string, clientId: string): Promise<Booking[]> {
    return await this.bookingRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .orderByDescending('createdAt')
      .find();
  }

  private async getAttentionsByClient(commerceId: string, clientId: string): Promise<Attention[]> {
    return await this.attentionRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .orderByDescending('createdAt')
      .find();
  }

  private async getPrescriptionsByClient(
    commerceId: string,
    clientId: string
  ): Promise<Prescription[]> {
    return await this.prescriptionRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .orderByDescending('date')
      .find();
  }

  private async getExamOrdersByClient(
    commerceId: string,
    clientId: string
  ): Promise<MedicalExamOrder[]> {
    return await this.examOrderRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .orderByDescending('requestedAt')
      .find();
  }

  private async getPatientHistoryByClient(
    commerceId: string,
    clientId: string
  ): Promise<PatientHistory | null> {
    return await this.patientHistoryRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('available', true)
      .findOne();
  }
}
