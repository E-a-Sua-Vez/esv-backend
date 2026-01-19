export default class ProfessionalAssignedToAttention {
  attentionId: string;
  professionalId: string;
  businessId: string;
  commerceId: string;
  userId: string;
  serviceId?: string;
  commissionType?: string;
  commissionValue?: number;
  commissionAmount?: number;
  assignedBy: string;
  assignedAt: Date;
  
  constructor(
    attentionId: string,
    professionalId: string,
    businessId: string,
    commerceId: string,
    userId: string,
    assignedBy: string,
    serviceId?: string,
    commissionType?: string,
    commissionValue?: number,
    commissionAmount?: number
  ) {
    this.attentionId = attentionId;
    this.professionalId = professionalId;
    this.businessId = businessId;
    this.commerceId = commerceId;
    this.userId = userId;
    this.serviceId = serviceId;
    this.commissionType = commissionType;
    this.commissionValue = commissionValue;
    this.commissionAmount = commissionAmount;
    this.assignedBy = assignedBy;
    this.assignedAt = new Date();
  }
}
