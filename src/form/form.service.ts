import { publish } from 'ett-events-lib';
import { getRepository } from 'fireorm';
import { InjectRepository } from 'nestjs-fireorm';
import { Question } from 'src/form-personalized/model/form-personalized.entity';

import { ClientService } from '../client/client.service';

import FormCreated from './events/FormCreated';
import FormUpdated from './events/FormUpdated';
import FormLoadedToProntuario from './events/FormLoadedToProntuario';
import { Form } from './model/form.entity';
import { FormType } from './model/type.enum';

export class FormService {
  constructor(
    @InjectRepository(Form)
    private formRepository = getRepository(Form),
    private clientService: ClientService
  ) {}

  public async getFormById(id: string): Promise<Form> {
    return await this.formRepository.findById(id);
  }

  public async getForms(): Promise<Form[]> {
    return await this.formRepository.find();
  }

  public async getFormsByClient(commerceId: string, clientId: string): Promise<Form[]> {
    const forms: Form[] = await this.formRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .find();
    return forms;
  }

  public async getFormsByClientAndType(
    commerceId: string,
    clientId: string,
    type: string
  ): Promise<Form[]> {
    const forms: Form[] = await this.formRepository
      .whereEqualTo('commerceId', commerceId)
      .whereEqualTo('clientId', clientId)
      .whereEqualTo('type', type)
      .find();
    return forms;
  }

  public async createForm(
    user: string,
    personalizedId: string,
    type: FormType,
    bookingId: string,
    attentionId: string,
    commerceId: string,
    queueId: string,
    clientId: string,
    questions?: Question[],
    answers?: object[]
  ): Promise<Form> {
    const form = new Form();
    form.commerceId = commerceId;
    form.attentionId = attentionId;
    form.attentionId = attentionId;
    form.bookingId = bookingId;
    form.clientId = clientId;
    form.type = type;
    form.queueId = queueId;
    form.personalizedId = personalizedId;
    if (questions) {
      form.questions = questions;
    }
    if (answers && answers.length > 0) {
      form.answers = answers;
    }
    form.createdAt = new Date();
    const formCreated = await this.formRepository.create(form);
    const formCreatedEvent = new FormCreated(new Date(), formCreated, { user });
    publish(formCreatedEvent);

    if (form.type === FormType.FIRST_ATTENTION) {
      await this.clientService.updateFirstAttentionForm(user, form.clientId);
    }
    return formCreated;
  }

  public async update(user: string, form: Form): Promise<Form> {
    const formUpdated = await this.formRepository.update(form);
    const formUpdatedEvent = new FormUpdated(new Date(), formUpdated, { user });
    publish(formUpdatedEvent);
    return formUpdated;
  }

  public async getPreprontuarioStatus(commerceId: string, clientId: string): Promise<any> {
    const forms = await this.getFormsByClientAndType(commerceId, clientId, FormType.PRE_ATTENTION);

    if (forms && forms.length > 0) {
      const latestForm = forms.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      return {
        completed: true,
        completedAt: latestForm.createdAt,
        formId: latestForm.id,
      };
    }

    return {
      completed: false,
      completedAt: null,
      formId: null,
    };
  }

  public async markAsLoadedToProntuario(id: string, userId: string): Promise<Form> {
    const form = await this.getFormById(id);
    if (!form) {
      throw new Error(`Form with id ${id} not found`);
    }

    form.loadedToProntuario = true;
    form.loadedToProntuarioDate = new Date();
    form.loadedToProntuarioBy = userId;

    const formUpdated = await this.formRepository.update(form);
    const formLoadedEvent = new FormLoadedToProntuario(new Date(), formUpdated, { user: userId });
    publish(formLoadedEvent);

    return formUpdated;
  }
}
