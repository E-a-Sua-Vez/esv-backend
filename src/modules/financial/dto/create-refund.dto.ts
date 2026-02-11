import { IsNotEmpty, IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum RefundType {
  PAYMENT_REFUND = 'payment-refund',
  COMMISSION_REVERSAL = 'commission-reversal',
  SERVICE_REFUND = 'service-refund',
  CANCELLATION_REFUND = 'cancellation-refund'
}

export enum RefundReason {
  CUSTOMER_REQUEST = 'customer-request',
  SERVICE_ISSUE = 'service-issue',
  TECHNICAL_ERROR = 'technical-error',
  DUPLICATE_PAYMENT = 'duplicate-payment',
  POLICY_VIOLATION = 'policy-violation',
  OTHER = 'other'
}

export class CreateRefundDto {
  @ApiProperty({ description: 'ID de la transacción original a reembolsar' })
  @IsNotEmpty()
  @IsString()
  originalTransactionId: string;

  @ApiProperty({ description: 'Monto del reembolso', minimum: 0.01 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: RefundType, description: 'Tipo de reembolso' })
  @IsNotEmpty()
  @IsEnum(RefundType)
  type: RefundType;

  @ApiProperty({ enum: RefundReason, description: 'Razón del reembolso' })
  @IsNotEmpty()
  @IsEnum(RefundReason)
  reason: RefundReason;

  @ApiProperty({ description: 'Descripción detallada del reembolso', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'ID del cliente afectado', required: false })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty({ description: 'ID del profesional afectado', required: false })
  @IsOptional()
  @IsString()
  professionalId?: string;
}