import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import { IncomeService } from '../income/income.service';

import PackageCreated from './events/PackageCreated';
import PackageUpdated from './events/PackageUpdated';
import { PackageStatus } from './model/package-status.enum';
import { PackageType } from './model/package-type.enum';
import { Package } from './model/package.entity';

@Injectable()
export class PackageService {
  constructor(
    @InjectRepository(Package)
    private packRepository = getRepository(Package),
    private incomeService: IncomeService
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
      .whereIn('status', [PackageStatus.REQUESTED, PackageStatus.CONFIRMED])
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
      .whereIn('status', [PackageStatus.REQUESTED, PackageStatus.CONFIRMED])
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
        if (!pack.paid && pack.incomesId.length === 0) {
          pack.status = PackageStatus.CANCELLED;
          pack.cancelledAt = new Date();
          pack.cancelledBy = user;
          return await this.updatePackage(user, pack);
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
}
