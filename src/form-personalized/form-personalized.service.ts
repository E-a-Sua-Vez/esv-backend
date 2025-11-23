import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';

import FormPersonalizedCreated from './events/FormPersonalizedCreated';
import FormPersonalizedUpdated from './events/FormPersonalizedUpdated';
import { Question, FormPersonalized } from './model/form-personalized.entity';
import { FormType } from './model/type.enum';

export class FormPersonalizedService {
  constructor(
    @InjectRepository(FormPersonalized)
    private formPersonalizedRepository = getRepository(FormPersonalized)
  ) {}

  public async getFormPersonalizedById(id: string): Promise<FormPersonalized> {
    return await this.formPersonalizedRepository.findById(id);
  }

  public async getFormsPersonalized(): Promise<FormPersonalized[]> {
    return await this.formPersonalizedRepository.find();
  }

  public async getFormsPersonalizedByCommerceId(commerceId: string): Promise<FormPersonalized[]> {
    const forms: FormPersonalized[] = await this.formPersonalizedRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('available', true)
      .find();
    const formsToReturn = [];
    if (forms && forms.length > 0) {
      forms.forEach(form => {
        let questions = form.questions;
        if (questions && questions.length > 0) {
          questions = questions.sort((a, b) => a.order - b.order);
          form.questions = questions;
          formsToReturn.push(form);
        }
      });
    }
    return forms;
  }

  public async getFormsPersonalizedByCommerceIdAndType(
    commerceId: string,
    type: FormType
  ): Promise<FormPersonalized[]> {
    const forms: FormPersonalized[] = await this.formPersonalizedRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('type', type)
      .whereEqualTo('available', true)
      .find();
    const formsToReturn = [];
    if (forms && forms.length > 0) {
      forms.forEach(form => {
        let questions = form.questions;
        if (questions && questions.length > 0) {
          questions = questions.sort((a, b) => a.order - b.order);
          form.questions = questions;
          formsToReturn.push(form);
        }
      });
    }
    return forms;
  }

  public async getFormsPersonalizedByQueueId(
    commerceId: string,
    queueId: string
  ): Promise<FormPersonalized[]> {
    const forms: FormPersonalized[] = await this.formPersonalizedRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('queueId', queueId)
      .whereEqualTo('active', true)
      .whereEqualTo('available', true)
      .find();
    const formsToReturn = [];
    if (forms && forms.length > 0) {
      forms.forEach(form => {
        let questions = form.questions;
        if (questions && questions.length > 0) {
          questions = questions.sort((a, b) => a.order - b.order);
          form.questions = questions;
          formsToReturn.push(form);
        }
      });
    }
    return forms;
  }

  public async createFormPersonalized(
    commerceId: string,
    type: FormType,
    questions?: Question[],
    queueId?: string,
    servicesId?: string[]
  ): Promise<FormPersonalized> {
    const form = new FormPersonalized();
    form.commerceId = commerceId;
    form.type = type;
    if (servicesId) {
      form.servicesId = servicesId;
    }
    if (questions) {
      form.questions = questions;
    }
    if (queueId !== undefined) {
      form.queueId = queueId;
    }
    form.active = true;
    form.available = true;
    form.createdAt = new Date();
    const formCreated = await this.formPersonalizedRepository.create(form);
    const formCreatedEvent = new FormPersonalizedCreated(new Date(), formCreated);
    publish(formCreatedEvent);

    return formCreated;
  }

  public async update(user, form: FormPersonalized): Promise<FormPersonalized> {
    const formPersonalizedUpdated = await this.formPersonalizedRepository.update(form);
    const formPersonalizedUpdatedEvent = new FormPersonalizedUpdated(
      new Date(),
      formPersonalizedUpdated,
      { user }
    );
    publish(formPersonalizedUpdatedEvent);
    return formPersonalizedUpdated;
  }

  public async updateFormPersonalized(
    user: string,
    type: FormType,
    id: string,
    active: boolean,
    available: boolean,
    questions?: Question[],
    queueId?: string,
    servicesId?: string[]
  ): Promise<FormPersonalized> {
    try {
      const form = await this.formPersonalizedRepository.findById(id);
      if (type) {
        form.type = type;
      }
      if (active !== undefined) {
        form.active = active;
      }
      if (available !== undefined) {
        form.available = available;
      }
      if (servicesId !== undefined) {
        form.servicesId = servicesId;
      }
      if (questions !== undefined) {
        form.questions = questions;
      }
      if (queueId !== undefined) {
        form.queueId = queueId;
      }
      const formPersonalizedUpdated = await this.update(user, form);
      return formPersonalizedUpdated;
    } catch (error) {
      throw `Hubo un problema al modificar el fomulario: ${error.message}`;
    }
  }
}
