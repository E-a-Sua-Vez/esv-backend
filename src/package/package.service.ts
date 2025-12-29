import { HttpException, HttpStatus, Injectable, Inject, forwardRef } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { IncomeService } from '../income/income.service';
import { AttentionService } from '../attention/attention.service';
import { BookingService } from '../booking/booking.service';
import { AttentionStatus } from '../attention/model/attention-status.enum';
import { BookingStatus } from '../booking/model/booking-status.enum';

import PackageCreated from './events/PackageCreated';
import PackageUpdated from './events/PackageUpdated';
import PackageSessionConsumed from './events/PackageSessionConsumed';
import PackageCancelled from './events/PackageCancelled';
import PackageCompleted from './events/PackageCompleted';
import PackageBookingNoShow from './events/PackageBookingNoShow';
import { PackageStatus } from './model/package-status.enum';
import { PackageType } from './model/package-type.enum';
import { PackagePeriodicity } from './model/package-periodicity.enum';
import { Package } from './model/package.entity';

@Injectable()
export class PackageService {
  constructor(
    @InjectRepository(Package)
    private packRepository = getRepository(Package),
    private incomeService: IncomeService,
    @Inject(forwardRef(() => AttentionService))
    private attentionService: AttentionService,
    @Inject(forwardRef(() => BookingService))
    private bookingService: BookingService
  ) {}

  public async getPackageById(id: string): Promise<Package> {
    const pack = await this.packRepository.findById(id);
    return pack;
  }

  public async getPackages(): Promise<Package[]> {
    let packs: Package[] = [];
    packs = await this.packRepository.find();
    return packs;
  }

  public async getPackageByCommerce(commerceId: string): Promise<Package[]> {
    let packs: Package[] = [];
    packs = await this.packRepository.whereEqualTo('commerceId', commerceId).find();
    return packs;
  }

  public async getPackageByCommerceIdAndClientId(
    commerceId: string,
    clientId: string
  ): Promise<Package[]> {
    let packs: Package[] = [];
    packs = await this.packRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereIn('status', [
        PackageStatus.REQUESTED,
        PackageStatus.CONFIRMED,
        PackageStatus.ACTIVE,
      ])
      .find();
    return packs;
  }

  public async getPackageByCommerceIdAndClientServices(
    commerceId: string,
    clientId: string,
    serviceId: string
  ): Promise<Package[]> {
    let packs: Package[] = [];
    packs = await this.packRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereArrayContains('servicesId', serviceId)
      .whereIn('status', [
        PackageStatus.REQUESTED,
        PackageStatus.CONFIRMED,
        PackageStatus.ACTIVE,
      ])
      .find();
    return packs;
  }

  public async getPackagesById(packsId: string[]): Promise<Package[]> {
    let packs: Package[] = [];
    packs = await this.packRepository.whereIn('id', packsId).find();
    return packs;
  }

  public async updatePackageConfigurations(
    user: string,
    id: string,
    firstBookingId: string,
    firstAttentionId: string,
    proceduresAmount: number,
    proceduresLeft: number,
    name: string,
    servicesId: string[],
    bookingsId: string[],
    attentionsId: string[],
    active: boolean,
    available: boolean,
    type: PackageType,
    status: PackageStatus,
    cancelledAt: Date,
    cancelledBy: string,
    completedAt: Date,
    completedBy: string,
    expireAt: Date
  ): Promise<Package> {
    try {
      const pack = await this.packRepository.findById(id);
      if (name !== undefined) {
        pack.name = name;
      }
      if (firstBookingId !== undefined) {
        pack.firstBookingId = firstBookingId;
      }
      if (firstAttentionId !== undefined) {
        pack.firstAttentionId = firstAttentionId;
      }
      if (proceduresAmount !== undefined) {
        pack.proceduresAmount = proceduresAmount;
      }
      if (proceduresLeft !== undefined) {
        pack.proceduresLeft = proceduresLeft;
      }
      if (name !== undefined) {
        pack.name = name;
      }
      if (servicesId !== undefined) {
        pack.servicesId = servicesId;
      }
      if (bookingsId !== undefined) {
        if (pack.bookingsId && pack.bookingsId.length >= 0) {
          pack.bookingsId = Array.from(new Set([...bookingsId, ...pack.bookingsId]).values());
        } else {
          pack.bookingsId = [...bookingsId];
        }
      }
      if (attentionsId !== undefined) {
        if (pack.attentionsId && pack.attentionsId.length >= 0) {
          pack.attentionsId = Array.from(new Set([...attentionsId, ...pack.attentionsId]).values());
        } else {
          pack.attentionsId = [...attentionsId];
        }
      }
      if (status !== undefined) {
        pack.status = status;
      }
      if (type !== undefined) {
        pack.type = type;
      }
      if (active !== undefined) {
        pack.active = active;
      }
      if (available !== undefined) {
        pack.available = available;
      }
      if (cancelledAt !== undefined) {
        pack.cancelledAt = cancelledAt;
      }
      if (cancelledBy !== undefined) {
        pack.cancelledBy = cancelledBy;
      }
      if (completedAt !== undefined) {
        pack.completedAt = completedAt;
      }
      if (available !== undefined) {
        pack.available = available;
      }
      if (completedBy !== undefined) {
        pack.completedBy = completedBy;
      }
      if (expireAt !== undefined) {
        pack.expireAt = expireAt;
      }
      return await this.updatePackage(user, pack);
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al modificar el package: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async updatePackage(user: string, pack: Package): Promise<Package> {
    const packUpdated = await await this.packRepository.update(pack);
    const packUpdatedEvent = new PackageUpdated(new Date(), packUpdated, { user });
    publish(packUpdatedEvent);
    return packUpdated;
  }

  public async createPackage(
    user: string,
    commerceId: string,
    clientId: string,
    firstBookingId: string,
    firstAttentionId: string,
    proceduresAmount: number,
    name: string,
    servicesId: string[],
    bookingsId: string[],
    attentionsId: string[],
    type: PackageType,
    status: PackageStatus
  ): Promise<Package> {
    const pack = new Package();
    pack.commerceId = commerceId;
    pack.clientId = clientId;
    pack.firstBookingId = firstBookingId;
    pack.firstAttentionId = firstAttentionId;
    pack.proceduresAmount = proceduresAmount;
    // Initialize proceduresLeft properly - CRITICAL FIX
    pack.proceduresLeft = proceduresAmount;
    pack.proceduresUsed = 0;
    pack.proceduresConsumed = 0;
    pack.name = name;
    pack.servicesId = servicesId;
    pack.bookingsId = bookingsId;
    pack.attentionsId = attentionsId;
    pack.type = type || PackageType.STANDARD;
    pack.status = status || PackageStatus.CONFIRMED;
    pack.createdAt = new Date();
    pack.active = true;
    pack.available = true;
    pack.createdBy = user;
    // Initialize new fields with defaults
    pack.allowFlexibleScheduling = true;
    pack.hasEvaluationSession = false;
    pack.evaluationCompleted = false;
    // Initialize metrics
    pack.metrics = {
      bookingsTotal: 0,
      bookingsCancelled: 0,
      bookingsNoShow: 0,
      bookingsAttended: 0,
    };
    const packCreated = await this.packRepository.create(pack);
    const packCreatedEvent = new PackageCreated(new Date(), packCreated, { user });
    publish(packCreatedEvent);
    return packCreated;
  }

  public async addProcedureToPackage(
    user: string,
    id: string,
    bookingsId: string[],
    attentionsId: string[]
  ): Promise<Package> {
    try {
      const pack = await this.packRepository.findById(id);
      // Initialize arrays if they are undefined
      if (!pack.bookingsId) {
        pack.bookingsId = [];
      }
      if (!pack.attentionsId) {
        pack.attentionsId = [];
      }

      if (bookingsId !== undefined) {
        if (pack.bookingsId && pack.bookingsId.length >= 0) {
          pack.bookingsId = Array.from(new Set([...bookingsId, ...pack.bookingsId]).values());
        } else {
          pack.bookingsId = [...bookingsId];
        }
      }
      if (attentionsId !== undefined) {
        if (pack.attentionsId && pack.attentionsId.length >= 0) {
          pack.attentionsId = Array.from(new Set([...attentionsId, ...pack.attentionsId]).values());
        } else {
          pack.attentionsId = [...attentionsId];
        }
      }
      if (pack.status === PackageStatus.REQUESTED) {
        pack.status = PackageStatus.CONFIRMED;
      }
      if (pack.bookingsId.length === pack.proceduresAmount) {
        pack.status = PackageStatus.COMPLETED;
      }
      return await this.updatePackage(user, pack);
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al agregar procedure al package: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async removeProcedureToPackage(
    user: string,
    id: string,
    bookingId: string,
    attentionId: string
  ): Promise<Package> {
    try {
      const pack = await this.packRepository.findById(id);
      if (pack && pack.id) {
        // Initialize arrays if they are undefined
        if (!pack.bookingsId) {
          pack.bookingsId = [];
        }
        if (!pack.attentionsId) {
          pack.attentionsId = [];
        }

        if (bookingId !== undefined) {
          if (pack.bookingsId && pack.bookingsId.length >= 0) {
            pack.bookingsId = pack.bookingsId.filter(id => id !== bookingId);
          }
        }
        if (attentionId !== undefined) {
          if (pack.attentionsId && pack.attentionsId.length >= 0) {
            pack.attentionsId = pack.attentionsId.filter(id => id !== attentionId);
          }
        }
        if (!pack.paid && pack.bookingsId.length === pack.proceduresAmount) {
          pack.status = PackageStatus.COMPLETED;
        }
        const packageUpdated = await this.updatePackage(user, pack);
        if (pack.bookingsId.length === 0 && pack.attentionsId.length === 0) {
          await this.cancelPackage(user, id);
        }
        return packageUpdated;
      } else {
        throw new HttpException(`Package no existe`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al eliminar procedure al package: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async payPackage(user: string, id: string, incomesId: string[]): Promise<Package> {
    try {
      const pack = await this.packRepository.findById(id);
      if (incomesId !== undefined) {
        if (pack.incomesId && pack.incomesId.length >= 0) {
          pack.incomesId = Array.from(new Set([...incomesId, ...pack.incomesId]).values());
        } else {
          pack.incomesId = [...incomesId];
        }
      }
      const pendingIncomes = await this.incomeService.getPendingIncomeByPackage(
        pack.commerceId,
        pack.id
      );
      if (pendingIncomes && pendingIncomes.length === 0) {
        pack.paid = true;
      }
      return await this.updatePackage(user, pack);
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al pagar package: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async cancelPackage(user: string, id: string): Promise<Package> {
    try {
      const pack = await this.packRepository.findById(id);
      if (pack && pack.id) {
        // Initialize incomesId if it's undefined
        if (!pack.incomesId) {
          pack.incomesId = [];
        }
        if (!pack.paid && pack.incomesId.length === 0) {
          // Cancel pending and processing attentions first
          if (pack.attentionsId && Array.isArray(pack.attentionsId) && pack.attentionsId.length > 0) {
            console.log(`[PackageService] Cancelling ${pack.attentionsId.length} attentions for package ${id}`);
            for (const attentionId of pack.attentionsId) {
              try {
                const attention = await this.attentionService.getAttentionById(attentionId);
                console.log(`[PackageService] Attention ${attentionId} status: ${attention?.status}`);
                // Cancel if status is PENDING, PROCESSING, or REACTIVATED (can be cancelled)
                if (
                  attention &&
                  (attention.status === AttentionStatus.PENDING ||
                    attention.status === AttentionStatus.PROCESSING ||
                    attention.status === AttentionStatus.REACTIVATED)
                ) {
                  console.log(`[PackageService] Cancelling attention ${attentionId} with status ${attention.status}`);
                  const cancelledAttention = await this.attentionService.cancelAttention(user, attentionId);
                  console.log(`[PackageService] Successfully cancelled attention ${attentionId}, new status: ${cancelledAttention.status}`);
                } else {
                  console.log(`[PackageService] Skipping attention ${attentionId} - status ${attention?.status} is not cancellable`);
                }
              } catch (error) {
                // Log error but continue with other cancellations
                console.error(`[PackageService] Error cancelling attention ${attentionId}:`, error);
              }
            }
          } else {
            console.log(`[PackageService] No attentions to cancel for package ${id}`);
          }

          // Cancel pending bookings
          if (pack.bookingsId && Array.isArray(pack.bookingsId) && pack.bookingsId.length > 0) {
            console.log(`[PackageService] Cancelling ${pack.bookingsId.length} bookings for package ${id}`);
            for (const bookingId of pack.bookingsId) {
              try {
                const booking = await this.bookingService.getBookingById(bookingId);
                console.log(`[PackageService] Booking ${bookingId} status: ${booking?.status}`);
                // Only cancel if status is PENDING
                if (booking && booking.status === BookingStatus.PENDING) {
                  console.log(`[PackageService] Cancelling booking ${bookingId} with status ${booking.status}`);
                  const cancelledBooking = await this.bookingService.cancelBooking(user, bookingId);
                  console.log(`[PackageService] Successfully cancelled booking ${bookingId}, new status: ${cancelledBooking.status}`);
                } else {
                  console.log(`[PackageService] Skipping booking ${bookingId} - status ${booking?.status} is not PENDING`);
                }
              } catch (error) {
                // Log error but continue with other cancellations
                console.error(`[PackageService] Error cancelling booking ${bookingId}:`, error);
              }
            }
          } else {
            console.log(`[PackageService] No bookings to cancel for package ${id}`);
          }

          // Now cancel the package itself
          pack.status = PackageStatus.CANCELLED;
          pack.cancelledAt = new Date();
          pack.cancelledBy = user;

          // Update metrics
          if (!pack.metrics) {
            pack.metrics = {
              bookingsTotal: 0,
              bookingsCancelled: 0,
              bookingsNoShow: 0,
              bookingsAttended: 0,
            };
          }
          pack.metrics.abandonmentDate = new Date();
          pack.metrics.abandonmentReason = 'CANCELLED';

          const cancelledPack = await this.updatePackage(user, pack);

          // Publish cancellation event
          const cancelledEvent = new PackageCancelled(
            new Date(),
            {
              id: cancelledPack.id,
              packageId: cancelledPack.id,
              cancelledAt: cancelledPack.cancelledAt,
              cancelledBy: cancelledPack.cancelledBy,
              proceduresUsed: cancelledPack.proceduresUsed || 0,
              proceduresLeft: cancelledPack.proceduresLeft || 0,
              completionRate: cancelledPack.metrics?.completionRate || 0,
            },
            { user }
          );
          publish(cancelledEvent);

          return cancelledPack;
        }
      } else {
        throw new HttpException(`Package no existe`, HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      throw new HttpException(
        `Hubo un problema al cancelar el package: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Track booking cancellation for a package
   * Called when a booking related to a package is cancelled
   */
  public async trackBookingCancellation(
    user: string,
    packageId: string,
    bookingId: string,
    bookingDate: Date,
    isNoShow: boolean
  ): Promise<Package> {
    try {
      const pack = await this.packRepository.findById(packageId);
      if (!pack || !pack.id) {
        // Package doesn't exist, silently fail (booking cancellation shouldn't fail if package is missing)
        return null;
      }

      // Initialize metrics if not present
      if (!pack.metrics) {
        pack.metrics = {
          bookingsTotal: 0,
          bookingsCancelled: 0,
          bookingsNoShow: 0,
          bookingsAttended: 0,
        };
      }

      pack.metrics.bookingsCancelled = (pack.metrics.bookingsCancelled || 0) + 1;
      if (isNoShow) {
        pack.metrics.bookingsNoShow = (pack.metrics.bookingsNoShow || 0) + 1;

        // Publish no-show event
        const noShowEvent = new PackageBookingNoShow(
          new Date(),
          {
            id: pack.id,
            packageId: pack.id,
            bookingId: bookingId,
            bookingDate: bookingDate,
            sessionNumber: pack.bookingsId?.indexOf(bookingId) + 1 || null,
            proceduresUsed: pack.proceduresUsed || 0,
            proceduresLeft: pack.proceduresLeft || 0,
          },
          { user, bookingId }
        );
        publish(noShowEvent);
      }

      pack.metrics.lastActivityDate = new Date();

      return await this.updatePackage(user, pack);
    } catch (error) {
      // Log error but don't fail booking cancellation
      console.error(`Error tracking booking cancellation for package ${packageId}:`, error);
      return null;
    }
  }

  /**
   * Track booking creation for a package
   */
  public async trackBookingCreation(packageId: string): Promise<void> {
    try {
      const pack = await this.packRepository.findById(packageId);
      if (!pack || !pack.id) {
        return;
      }

      if (!pack.metrics) {
        pack.metrics = {
          bookingsTotal: 0,
          bookingsCancelled: 0,
          bookingsNoShow: 0,
          bookingsAttended: 0,
        };
      }

      pack.metrics.bookingsTotal = (pack.metrics.bookingsTotal || 0) + 1;
      pack.metrics.lastActivityDate = new Date();

      await this.updatePackage('system', pack);
    } catch (error) {
      // Log error but don't fail
      console.error(`Error tracking booking creation for package ${packageId}:`, error);
    }
  }

  /**
   * Consume a session from a package when an attention is completed
   * This is the CRITICAL method that fixes proceduresLeft tracking
   */
  public async consumeSession(
    user: string,
    packageId: string,
    attentionId: string,
    bookingId?: string
  ): Promise<Package> {
    try {
      const pack = await this.packRepository.findById(packageId);
      if (!pack || !pack.id) {
        throw new HttpException(`Package no existe`, HttpStatus.NOT_FOUND);
      }

      // Check if package has sessions remaining
      if (pack.proceduresLeft === undefined || pack.proceduresLeft === null) {
        // Initialize if not set (backward compatibility)
        pack.proceduresLeft = pack.proceduresAmount || 0;
      }

      if (pack.proceduresLeft <= 0) {
        throw new HttpException(
          'No sessions remaining in package',
          HttpStatus.BAD_REQUEST
        );
      }

      // Decrement proceduresLeft
      pack.proceduresLeft = pack.proceduresLeft - 1;
      pack.proceduresUsed = (pack.proceduresUsed || 0) + 1;
      pack.proceduresConsumed = (pack.proceduresConsumed || 0) + 1;
      pack.lastSessionDate = new Date();

      // Update next recommended session date based on periodicity
      if (pack.periodicity && pack.periodicity !== PackagePeriodicity.NONE) {
        pack.nextRecommendedSessionDate = this.calculateNextSessionDate(
          pack.periodicity,
          pack.periodicityDays
        );
      }

      // Add to attentionsId if not already there
      if (pack.attentionsId && !pack.attentionsId.includes(attentionId)) {
        pack.attentionsId = [...pack.attentionsId, attentionId];
      } else if (!pack.attentionsId) {
        pack.attentionsId = [attentionId];
      }

      if (bookingId && pack.bookingsId && !pack.bookingsId.includes(bookingId)) {
        pack.bookingsId = [...pack.bookingsId, bookingId];
      } else if (bookingId && !pack.bookingsId) {
        pack.bookingsId = [bookingId];
      }

      // Update metrics
      if (!pack.metrics) {
        pack.metrics = {
          bookingsTotal: 0,
          bookingsCancelled: 0,
          bookingsNoShow: 0,
          bookingsAttended: 0,
        };
      }
      pack.metrics.bookingsAttended = (pack.metrics.bookingsAttended || 0) + 1;
      if (!pack.metrics.firstSessionDate) {
        pack.metrics.firstSessionDate = new Date();
      }
      pack.metrics.lastActivityDate = new Date();
      pack.metrics.completionRate =
        pack.proceduresConsumed && pack.proceduresAmount
          ? (pack.proceduresConsumed / pack.proceduresAmount) * 100
          : 0;

      // Update status
      const wasCompleted = pack.proceduresLeft === 0;
      if (pack.proceduresLeft === 0) {
        pack.status = PackageStatus.COMPLETED;
        pack.completedAt = new Date();
        pack.completedBy = user;
      } else if (pack.status === PackageStatus.CONFIRMED) {
        pack.status = PackageStatus.ACTIVE;
      }

      const updatedPack = await this.updatePackage(user, pack);

      // Publish event for CQRS
      const sessionConsumedEvent = new PackageSessionConsumed(
        new Date(),
        {
          id: updatedPack.id,
          packageId: updatedPack.id,
          attentionId: attentionId,
          bookingId: bookingId,
          sessionNumber: pack.proceduresUsed,
          sessionsRemaining: updatedPack.proceduresLeft,
          proceduresUsed: pack.proceduresUsed,
          proceduresLeft: updatedPack.proceduresLeft,
          lastSessionDate: updatedPack.lastSessionDate,
          status: updatedPack.status,
        },
        { user, bookingId }
      );
      publish(sessionConsumedEvent);

      // Publish completion event if package was just completed
      if (wasCompleted) {
        const completedEvent = new PackageCompleted(
          new Date(),
          {
            id: updatedPack.id,
            packageId: updatedPack.id,
            proceduresAmount: updatedPack.proceduresAmount,
            proceduresConsumed: updatedPack.proceduresConsumed,
            completedAt: updatedPack.completedAt,
            completedBy: updatedPack.completedBy,
            completionRate: pack.metrics.completionRate,
            totalDays: pack.metrics.firstSessionDate
              ? Math.floor(
                  (updatedPack.completedAt.getTime() - pack.metrics.firstSessionDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              : null,
          },
          { user }
        );
        publish(completedEvent);
      }

      return updatedPack;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Hubo un problema al consumir sesión del package: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Calculate next recommended session date based on periodicity
   */
  private calculateNextSessionDate(
    periodicity: PackagePeriodicity,
    periodicityDays?: number
  ): Date {
    const today = new Date();

    switch (periodicity) {
      case PackagePeriodicity.WEEKLY:
        return new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      case PackagePeriodicity.BIWEEKLY:
        return new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
      case PackagePeriodicity.MONTHLY:
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      case PackagePeriodicity.CUSTOM:
        const days = periodicityDays || 7;
        return new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }

  /**
   * Get active packages for a commerce
   */
  public async getActivePackagesByCommerce(commerceId: string): Promise<Package[]> {
    const packs = await this.packRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('active', true)
      .whereIn('status', [PackageStatus.ACTIVE, PackageStatus.CONFIRMED, PackageStatus.REQUESTED])
      .find();
    return packs.filter(p => (p.proceduresLeft || 0) > 0);
  }

  /**
   * Get active packages for a client
   */
  public async getActivePackagesByClient(
    commerceId: string,
    clientId: string
  ): Promise<Package[]> {
    const packs = await this.packRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('active', true)
      .whereIn('status', [PackageStatus.ACTIVE, PackageStatus.CONFIRMED, PackageStatus.REQUESTED])
      .find();
    return packs.filter(p => (p.proceduresLeft || 0) > 0);
  }

  /**
   * Get available packages for a service (for booking selection)
   */
  public async getAvailablePackagesForService(
    commerceId: string,
    clientId: string,
    serviceId: string
  ): Promise<Package[]> {
    const packs = await this.getPackageByCommerceIdAndClientServices(
      commerceId,
      clientId,
      serviceId
    );

    // Filter only active packages with sessions remaining and not expired
    const now = new Date();
    return packs.filter(
      p =>
        p.active &&
        (p.status === PackageStatus.ACTIVE ||
         p.status === PackageStatus.CONFIRMED ||
         p.status === PackageStatus.REQUESTED) &&
        (p.proceduresLeft || 0) > 0 &&
        (!p.expireAt || p.expireAt > now)
    );
  }

  /**
   * Get packages by client with all statuses
   */
  public async getPackagesByClient(
    commerceId: string,
    clientId: string
  ): Promise<{
    active: Package[];
    completed: Package[];
    expired: Package[];
    cancelled: Package[];
  }> {
    const allPacks = await this.packRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .find();

    console.log(`[PackageService.getPackagesByClient] Found ${allPacks.length} packages for commerceId: ${commerceId}, clientId: ${clientId}`);
    if (allPacks.length > 0) {
      console.log(`[PackageService.getPackagesByClient] Sample package:`, {
        id: allPacks[0].id,
        status: allPacks[0].status,
        active: allPacks[0].active,
        proceduresLeft: allPacks[0].proceduresLeft,
        expireAt: allPacks[0].expireAt,
      });
    }

    const now = new Date();
    const active = allPacks.filter(
      p =>
        p.active &&
        (p.status === PackageStatus.ACTIVE ||
         p.status === PackageStatus.CONFIRMED ||
         p.status === PackageStatus.REQUESTED) &&
        (p.proceduresLeft || 0) > 0 &&
        (!p.expireAt || p.expireAt > now)
    );
    const completed = allPacks.filter(p => p.status === PackageStatus.COMPLETED);
    const expired = allPacks.filter(
      p => p.expireAt && p.expireAt <= now && (p.proceduresLeft || 0) > 0
    );
    const cancelled = allPacks.filter(p => p.status === PackageStatus.CANCELLED);

    console.log(`[PackageService.getPackagesByClient] Filtered results:`, {
      active: active.length,
      completed: completed.length,
      expired: expired.length,
      cancelled: cancelled.length,
    });

    return {
      active,
      completed,
      expired,
      cancelled,
    };
  }

  /**
   * Get package analytics for a commerce
   */
  public async getPackageAnalytics(commerceId: string): Promise<{
    totalPackages: number;
    activePackages: number;
    completedPackages: number;
    expiredPackages: number;
    totalSessionsSold: number;
    totalSessionsUsed: number;
    totalSessionsRemaining: number;
    averageSessionsPerPackage: number;
    averageCompletionRate: number;
    packagesByType: { [type: string]: number };
    packagesByStatus: { [status: string]: number };
    expiringSoon: Package[]; // Expiring in next 7 days
    lowSessions: Package[]; // < 3 sessions remaining
  }> {
    const allPacks = await this.getPackageByCommerce(commerceId);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const activePacks = allPacks.filter(
      p =>
        p.active &&
        (p.status === PackageStatus.ACTIVE ||
         p.status === PackageStatus.CONFIRMED ||
         p.status === PackageStatus.REQUESTED) &&
        (p.proceduresLeft || 0) > 0 &&
        (!p.expireAt || p.expireAt > now)
    );

    const completedPacks = allPacks.filter(p => p.status === PackageStatus.COMPLETED);
    const expiredPacks = allPacks.filter(
      p => p.expireAt && p.expireAt <= now && (p.proceduresLeft || 0) > 0
    );

    const totalSessionsSold = allPacks.reduce(
      (sum, p) => sum + (p.proceduresAmount || 0),
      0
    );
    const totalSessionsUsed = allPacks.reduce(
      (sum, p) => sum + (p.proceduresUsed || 0),
      0
    );
    const totalSessionsRemaining = allPacks.reduce(
      (sum, p) => sum + (p.proceduresLeft || 0),
      0
    );

    const packagesByType: { [type: string]: number } = {};
    allPacks.forEach(p => {
      const type = p.type || PackageType.STANDARD;
      packagesByType[type] = (packagesByType[type] || 0) + 1;
    });

    const packagesByStatus: { [status: string]: number } = {};
    allPacks.forEach(p => {
      const status = p.status || PackageStatus.CONFIRMED;
      packagesByStatus[status] = (packagesByStatus[status] || 0) + 1;
    });

    const expiringSoon = allPacks.filter(
      p =>
        p.expireAt &&
        p.expireAt > now &&
        p.expireAt <= sevenDaysFromNow &&
        (p.proceduresLeft || 0) > 0
    );

    const lowSessions = activePacks.filter(p => (p.proceduresLeft || 0) < 3 && (p.proceduresLeft || 0) > 0);

    const averageSessionsPerPackage =
      allPacks.length > 0 ? totalSessionsSold / allPacks.length : 0;
    const averageCompletionRate =
      totalSessionsSold > 0 ? (totalSessionsUsed / totalSessionsSold) * 100 : 0;

    return {
      totalPackages: allPacks.length,
      activePackages: activePacks.length,
      completedPackages: completedPacks.length,
      expiredPackages: expiredPacks.length,
      totalSessionsSold,
      totalSessionsUsed,
      totalSessionsRemaining,
      averageSessionsPerPackage: Math.round(averageSessionsPerPackage * 100) / 100,
      averageCompletionRate: Math.round(averageCompletionRate * 100) / 100,
      packagesByType,
      packagesByStatus,
      expiringSoon,
      lowSessions,
    };
  }

  /**
   * Get recommended session dates for a package
   */
  public async getRecommendedSessionDates(
    packageId: string,
    count: number = 3
  ): Promise<Date[]> {
    const pack = await this.getPackageById(packageId);
    if (!pack) {
      throw new HttpException(`Package no existe`, HttpStatus.NOT_FOUND);
    }

    const dates: Date[] = [];
    let currentDate = pack.nextRecommendedSessionDate || pack.lastSessionDate || new Date();
    const sessionsLeft = pack.proceduresLeft || 0;

    for (let i = 0; i < count && i < sessionsLeft; i++) {
      dates.push(new Date(currentDate));
      currentDate = this.calculateNextSessionDate(pack.periodicity, pack.periodicityDays);
      if (!currentDate) {
        break;
      }
    }

    return dates;
  }

  /**
   * Pause a package
   */
  public async pausePackage(user: string, id: string): Promise<Package> {
    try {
      const pack = await this.packRepository.findById(id);
      if (!pack || !pack.id) {
        throw new HttpException(`Package no existe`, HttpStatus.NOT_FOUND);
      }
      pack.status = PackageStatus.PAUSED;
      return await this.updatePackage(user, pack);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Hubo un problema al pausar el package: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Resume a paused package
   */
  public async resumePackage(user: string, id: string): Promise<Package> {
    try {
      const pack = await this.packRepository.findById(id);
      if (!pack || !pack.id) {
        throw new HttpException(`Package no existe`, HttpStatus.NOT_FOUND);
      }
      if (pack.status !== PackageStatus.PAUSED) {
        throw new HttpException(
          `Package no está pausado`,
          HttpStatus.BAD_REQUEST
        );
      }
      pack.status = (pack.proceduresLeft || 0) > 0 ? PackageStatus.ACTIVE : PackageStatus.COMPLETED;
      return await this.updatePackage(user, pack);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Hubo un problema al reanudar el package: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get package metrics analytics for a commerce
   * Returns: most requested packages, no-show rate, completion rate, abandonment rate
   */
  public async getPackageMetricsAnalytics(commerceId: string): Promise<{
    mostRequestedPackages: Array<{
      packageId: string;
      packageName: string;
      serviceIds: string[];
      type: string;
      totalCreated: number;
      totalActive: number;
      totalCompleted: number;
    }>;
    overallNoShowRate: number; // Percentage of bookings that were no-shows
    overallCompletionRate: number; // Average completion rate across all packages
    overallAbandonmentRate: number; // Percentage of packages that were abandoned
    packagesByCompletionRate: Array<{
      packageId: string;
      packageName: string;
      completionRate: number;
      proceduresConsumed: number;
      proceduresAmount: number;
    }>;
    packagesByNoShowRate: Array<{
      packageId: string;
      packageName: string;
      noShowRate: number;
      bookingsCancelled: number;
      bookingsNoShow: number;
      bookingsTotal: number;
    }>;
    abandonedPackages: Array<{
      packageId: string;
      packageName: string;
      abandonmentReason: string;
      proceduresUsed: number;
      proceduresAmount: number;
      lastActivityDate: Date;
    }>;
  }> {
    const allPacks = await this.getPackageByCommerce(commerceId);

    // Calculate most requested packages (by serviceId and type)
    const packageCounts: {
      [key: string]: {
        packageId: string;
        packageName: string;
        serviceIds: string[];
        type: string;
        totalCreated: number;
        totalActive: number;
        totalCompleted: number;
      };
    } = {};

    allPacks.forEach(pack => {
      // Create a key from serviceIds and type
      const servicesKey = (pack.servicesId || []).sort().join(',');
      const key = `${servicesKey}|${pack.type || 'STANDARD'}`;

      if (!packageCounts[key]) {
        packageCounts[key] = {
          packageId: pack.id,
          packageName: pack.name || 'Unnamed Package',
          serviceIds: pack.servicesId || [],
          type: pack.type || 'STANDARD',
          totalCreated: 0,
          totalActive: 0,
          totalCompleted: 0,
        };
      }

      packageCounts[key].totalCreated += 1;
      if (pack.status === PackageStatus.ACTIVE ||
          pack.status === PackageStatus.CONFIRMED ||
          pack.status === PackageStatus.REQUESTED) {
        packageCounts[key].totalActive += 1;
      }
      if (pack.status === PackageStatus.COMPLETED) {
        packageCounts[key].totalCompleted += 1;
      }
    });

    const mostRequestedPackages = Object.values(packageCounts)
      .sort((a, b) => b.totalCreated - a.totalCreated)
      .slice(0, 10);

    // Calculate overall metrics
    let totalBookingsCancelled = 0;
    let totalBookingsNoShow = 0;
    let totalBookingsTotal = 0;
    let totalProceduresConsumed = 0;
    let totalProceduresAmount = 0;
    let totalCompletedPackages = 0;
    let totalAbandonedPackages = 0;
    let totalPackages = allPacks.length;

    const packagesByCompletionRate: Array<{
      packageId: string;
      packageName: string;
      completionRate: number;
      proceduresConsumed: number;
      proceduresAmount: number;
    }> = [];

    const packagesByNoShowRate: Array<{
      packageId: string;
      packageName: string;
      noShowRate: number;
      bookingsCancelled: number;
      bookingsNoShow: number;
      bookingsTotal: number;
    }> = [];

    const abandonedPackages: Array<{
      packageId: string;
      packageName: string;
      abandonmentReason: string;
      proceduresUsed: number;
      proceduresAmount: number;
      lastActivityDate: Date;
    }> = [];

    allPacks.forEach(pack => {
      const metrics = pack.metrics || {};

      // Aggregate booking metrics
      const bookingsTotal = metrics.bookingsTotal || 0;
      const bookingsCancelled = metrics.bookingsCancelled || 0;
      const bookingsNoShow = metrics.bookingsNoShow || 0;

      totalBookingsTotal += bookingsTotal;
      totalBookingsCancelled += bookingsCancelled;
      totalBookingsNoShow += bookingsNoShow;

      // Aggregate completion metrics
      const proceduresAmount = pack.proceduresAmount || 0;
      const proceduresConsumed = pack.proceduresConsumed || 0;

      totalProceduresAmount += proceduresAmount;
      totalProceduresConsumed += proceduresConsumed;

      if (pack.status === PackageStatus.COMPLETED) {
        totalCompletedPackages += 1;
      }

      // Calculate completion rate for this package
      const completionRate =
        proceduresAmount > 0 ? (proceduresConsumed / proceduresAmount) * 100 : 0;

      packagesByCompletionRate.push({
        packageId: pack.id,
        packageName: pack.name || 'Unnamed Package',
        completionRate: completionRate,
        proceduresConsumed: proceduresConsumed,
        proceduresAmount: proceduresAmount,
      });

      // Calculate no-show rate for this package
      const noShowRate =
        bookingsTotal > 0 ? (bookingsNoShow / bookingsTotal) * 100 : 0;

      if (bookingsTotal > 0) {
        packagesByNoShowRate.push({
          packageId: pack.id,
          packageName: pack.name || 'Unnamed Package',
          noShowRate: noShowRate,
          bookingsCancelled: bookingsCancelled,
          bookingsNoShow: bookingsNoShow,
          bookingsTotal: bookingsTotal,
        });
      }

      // Track abandoned packages (cancelled with sessions used)
      if (
        (pack.status === PackageStatus.CANCELLED || metrics.abandonmentDate) &&
        (pack.proceduresUsed || 0) > 0
      ) {
        totalAbandonedPackages += 1;
        abandonedPackages.push({
          packageId: pack.id,
          packageName: pack.name || 'Unnamed Package',
          abandonmentReason: metrics.abandonmentReason || 'CANCELLED',
          proceduresUsed: pack.proceduresUsed || 0,
          proceduresAmount: proceduresAmount,
          lastActivityDate: metrics.lastActivityDate || pack.lastSessionDate || pack.createdAt,
        });
      }
    });

    // Calculate overall rates
    const overallNoShowRate =
      totalBookingsTotal > 0 ? (totalBookingsNoShow / totalBookingsTotal) * 100 : 0;

    const overallCompletionRate =
      totalProceduresAmount > 0 ? (totalProceduresConsumed / totalProceduresAmount) * 100 : 0;

    const overallAbandonmentRate =
      totalPackages > 0 ? (totalAbandonedPackages / totalPackages) * 100 : 0;

    // Sort by completion rate (descending)
    packagesByCompletionRate.sort((a, b) => b.completionRate - a.completionRate);

    // Sort by no-show rate (descending)
    packagesByNoShowRate.sort((a, b) => b.noShowRate - a.noShowRate);

    return {
      mostRequestedPackages,
      overallNoShowRate: Number(overallNoShowRate.toFixed(2)),
      overallCompletionRate: Number(overallCompletionRate.toFixed(2)),
      overallAbandonmentRate: Number(overallAbandonmentRate.toFixed(2)),
      packagesByCompletionRate: packagesByCompletionRate.slice(0, 20),
      packagesByNoShowRate: packagesByNoShowRate.slice(0, 20),
      abandonedPackages,
    };
  }
}
