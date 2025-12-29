export class ClientSearchDto {
  id: string;
  idNumber: string;
  name: string;
  lastName?: string;
  phone?: string;
  email?: string;
  phoneCode?: string;
  personalInfo?: {
    birthday?: string;
    addressText?: string;
    addressCode?: string;
    addressComplement?: string;
    origin?: string;
    code1?: string;
    code2?: string;
    code3?: string;
    healthAgreementId?: string;
  };
  businessId: string;
  commerceId: string;
  neededToInclude: string[];
}
