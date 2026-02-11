export interface RefundResponse {
  id: string;
  originalTransactionId: string;
  amount: number;
  type: string;
  reason: string;
  description?: string;
  clientId?: string;
  professionalId?: string;
  status: string;
  processedAt: Date;
  createdAt: Date;
  commerceId: string;
}

export interface ProcessRefundResult {
  success: boolean;
  refundId?: string;
  errorMessage?: string;
  transactionId?: string;
}