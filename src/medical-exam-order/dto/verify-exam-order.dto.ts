import { ApiProperty } from '@nestjs/swagger';

export class VerifyExamOrderResponseDto {
  @ApiProperty({ description: 'Si el documento es válido' })
  valid: boolean;

  @ApiProperty({ description: 'ID de la orden de examen' })
  examOrderId: string;

  @ApiProperty({ description: 'Fecha de emisión' })
  date: Date;

  @ApiProperty({ description: 'Nombre del médico' })
  doctorName: string;

  @ApiProperty({ description: 'Nombre del comercio/clínica' })
  commerceName: string;

  @ApiProperty({ description: 'Hash del documento para verificación de integridad' })
  documentHash: string;

  @ApiProperty({ description: 'Mensaje de verificación' })
  message: string;

  @ApiProperty({ description: 'Si el documento ha sido alterado', required: false })
  tampered?: boolean;
}














