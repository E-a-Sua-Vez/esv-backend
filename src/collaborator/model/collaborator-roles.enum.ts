/**
 * Nuevos roles específicos para colaboradores en el contexto médico
 * Extiende el sistema actual manteniendo compatibilidad hacia atrás
 */
export enum CollaboratorRole {
  // Roles existentes (compatibilidad)
  STANDARD = 'STANDARD',
  ASSISTANT = 'ASSISTANT',
  FULL = 'FULL',

  // Nuevos roles médicos específicos
  DOCTOR = 'DOCTOR',                    // Médico general
  SPECIALIST = 'SPECIALIST',            // Médico especialista
  NURSE = 'NURSE',                     // Enfermero/a
  SECRETARY = 'SECRETARY',             // Secretaria médica
  RECEPTIONIST = 'RECEPTIONIST',       // Recepcionista
  MEDICAL_ASSISTANT = 'MEDICAL_ASSISTANT', // Asistente médico
  TECHNICIAN = 'TECHNICIAN',           // Técnico en laboratorio/imagenología
  PHARMACIST = 'PHARMACIST',           // Farmacéutico
  THERAPIST = 'THERAPIST',             // Terapeuta (físico, ocupacional, etc.)
  ADMINISTRATOR = 'ADMINISTRATOR'       // Administrador médico
}

/**
 * Datos específicos para colaboradores médicos
 * Campos adicionales requeridos para documentos médicos
 */
export interface MedicalCollaboratorData {
  // Información profesional médica
  medicalLicense: string;              // Número de permiso/colegiatura médica
  medicalLicenseState?: string;        // Estado/provincia del permiso médico
  specialization?: string;             // Especialización médica
  subspecialization?: string;          // Sub-especialización
  medicalSchool?: string;             // Universidad de medicina
  graduationYear?: number;            // Año de graduación

  // Datos de contacto profesional
  professionalAddress: string;         // Dirección del consultorio/clínica
  professionalPhone: string;           // Teléfono profesional/consultorio
  professionalMobile?: string;         // Teléfono móvil profesional
  professionalEmail?: string;          // Email profesional
  emergencyPhone?: string;            // Teléfono de emergencias

  // Datos adicionales para documentos
  clinicName?: string;                // Nombre de la clínica/hospital
  clinicAddress?: string;             // Dirección de la clínica
  clinicPhone?: string;               // Teléfono de la clínica

  // Configuraciones de práctica
  workingHours?: string;              // Horarios de atención
  acceptsInsurance?: string[];        // Seguros médicos que acepta
  languages?: string[];               // Idiomas que habla

  // URLs y archivos
  profilePhoto?: string;              // URL de la foto de perfil
  digitalSignature?: string;          // URL de la firma digital (ya existe)
  medicalStamp?: string;             // URL del sello médico
}

/**
 * Configuración de permisos por rol
 * Define qué puede hacer cada tipo de colaborador
 */
export const ROLE_PERMISSIONS = {
  [CollaboratorRole.DOCTOR]: {
    canPrescribe: true,
    canOrderExams: true,
    canCreateReferences: true,
    canAccessPatientHistory: true,
    canEditPatientHistory: true,
    canGenerateDocuments: true,
    canSignDocuments: true,
    hasDigitalSignature: true,
    requiresMedicalLicense: true
  },
  [CollaboratorRole.SPECIALIST]: {
    canPrescribe: true,
    canOrderExams: true,
    canCreateReferences: true,
    canAccessPatientHistory: true,
    canEditPatientHistory: true,
    canGenerateDocuments: true,
    canSignDocuments: true,
    hasDigitalSignature: true,
    requiresMedicalLicense: true
  },
  [CollaboratorRole.NURSE]: {
    canPrescribe: false,
    canOrderExams: false,
    canCreateReferences: false,
    canAccessPatientHistory: true,
    canEditPatientHistory: true,
    canGenerateDocuments: false,
    canSignDocuments: false,
    hasDigitalSignature: false,
    requiresMedicalLicense: true
  },
  [CollaboratorRole.SECRETARY]: {
    canPrescribe: false,
    canOrderExams: false,
    canCreateReferences: false,
    canAccessPatientHistory: true,
    canEditPatientHistory: false,
    canGenerateDocuments: true, // Puede generar documentos administrativos
    canSignDocuments: false,
    hasDigitalSignature: false,
    requiresMedicalLicense: false
  },
  [CollaboratorRole.RECEPTIONIST]: {
    canPrescribe: false,
    canOrderExams: false,
    canCreateReferences: false,
    canAccessPatientHistory: false,
    canEditPatientHistory: false,
    canGenerateDocuments: false,
    canSignDocuments: false,
    hasDigitalSignature: false,
    requiresMedicalLicense: false
  }
  // ... otros roles
};