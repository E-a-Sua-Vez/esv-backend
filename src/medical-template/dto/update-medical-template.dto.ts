import { PartialType } from '@nestjs/swagger';

import { CreateMedicalTemplateDto } from './create-medical-template.dto';

export class UpdateMedicalTemplateDto extends PartialType(CreateMedicalTemplateDto) {}
