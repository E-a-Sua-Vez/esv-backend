import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreateMedicationDto {
  @ApiProperty({ description: 'Commerce ID' })
  @IsString()
  commerceId: string;

  @ApiProperty({ description: 'Nombre genérico del medicamento' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Nombre comercial', required: false })
  @IsOptional()
  @IsString()
  commercialName?: string;

  @ApiProperty({ description: 'Código ATC', required: false })
  @IsOptional()
  @IsString()
  atcCode?: string;

  @ApiProperty({ description: 'Principio activo' })
  @IsString()
  activePrinciple: string;

  @ApiProperty({ description: 'Presentación (ej: "500mg comprimidos")' })
  @IsString()
  presentation: string;

  @ApiProperty({ description: 'Forma farmacéutica (comprimido, cápsula, etc.)' })
  @IsString()
  dosageForm: string;

  @ApiProperty({ description: 'Vía de administración (oral, tópica, etc.)' })
  @IsString()
  route: string;

  @ApiProperty({ description: 'Dosis estándar', required: false })
  @IsOptional()
  @IsString()
  standardDosage?: string;

  @ApiProperty({ description: 'Contraindicaciones', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  contraindications?: string[];

  @ApiProperty({ description: 'Interacciones conocidas', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  interactions?: string[];

  @ApiProperty({ description: 'Activo', default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ description: 'Disponible', default: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean;
}





