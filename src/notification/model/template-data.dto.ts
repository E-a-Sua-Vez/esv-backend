import { EmailInputDto } from './email-input.dto';

export class TemplateData extends EmailInputDto {
  email: string;
  name?: string;
}
