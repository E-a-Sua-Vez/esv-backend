import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class MedicationSearchDto {
  @ApiProperty({ description: 'Término de búsqueda', required: false, example: 'paracetamol' })
  @IsOptional()
  @IsString()
  searchTerm?: string;

  @ApiProperty({ description: 'Código ATC', required: false, example: 'N02BE01' })
  @IsOptional()
  @IsString()
  atcCode?: string;

  @ApiProperty({ description: 'Principio activo', required: false, example: 'acetaminophen' })
  @IsOptional()
  @IsString()
  activePrinciple?: string;

  @ApiProperty({ description: 'Número de página', required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Tamaño de página', required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
