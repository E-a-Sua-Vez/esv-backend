import { Collection } from 'fireorm';

@Collection('laboratory')
export class Laboratory {
  id: string;
  name: string;
  code?: string; // Código único del laboratorio
  commerceId?: string; // Si está asociado a un comercio específico
  businessId?: string; // Si está asociado a un negocio específico

  // Información de contacto
  email?: string;
  phone?: string;
  address?: string;

  // Configuración HL7
  hl7Enabled: boolean; // Si acepta mensajes HL7
  hl7ApiKey?: string; // API Key para autenticación
  hl7Endpoint?: string; // Endpoint donde enviamos órdenes (si aplica)
  hl7SendingApplication?: string; // Código de aplicación para HL7
  hl7SendingFacility?: string; // Código de instalación para HL7

  // Configuración de integración
  integrationType?: 'hl7' | 'api' | 'manual'; // Tipo de integración
  apiUrl?: string; // URL de API si usa integración API
  apiCredentials?: {
    username?: string;
    password?: string;
    token?: string;
  };

  // Metadata
  active: boolean;
  available: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
}
