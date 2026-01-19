/**
 * Enum unificado para roles de Colaboradores y Profesionales
 * 
 * Este enum reemplaza:
 * - CollaboratorRole (de collaborator-roles.enum.ts)
 * - ProfessionalType (de professional-type.enum.ts)
 * 
 * Unifica los roles para mantener consistencia entre ambas entidades
 */
export enum ProfessionalRole {
  // ========================================
  // ROLES DE ACCESO AL SISTEMA (Collaborator)
  // ========================================
  STANDARD = 'STANDARD', // Acceso a su cola y colas de servicio
  ASSISTANT = 'ASSISTANT', // Acceso solo a colas de servicio
  FULL = 'FULL', // Acceso a todas las colas

  // ========================================
  // ROLES ADMINISTRATIVOS
  // ========================================
  RECEPTIONIST = 'RECEPTIONIST', // Recepcionista
  SECRETARY = 'SECRETARY', // Secretaria
  ADMINISTRATOR = 'ADMINISTRATOR', // Administrador

  // ========================================
  // ROLES DE SALÓN/BELLEZA
  // ========================================
  STYLIST = 'STYLIST', // Estilista
  BARBER = 'BARBER', // Barbero
  MANICURIST = 'MANICURIST', // Manicurista
  ESTHETICIAN = 'ESTHETICIAN', // Esteticista
  MASSEUR = 'MASSEUR', // Masajista

  // ========================================
  // ROLES MÉDICOS
  // ========================================
  DOCTOR = 'DOCTOR', // Médico general
  SPECIALIST = 'SPECIALIST', // Médico especialista
  NURSE = 'NURSE', // Enfermero/a
  MEDICAL_ASSISTANT = 'MEDICAL_ASSISTANT', // Asistente médico
  DENTIST = 'DENTIST', // Dentista
  PHYSIOTHERAPIST = 'PHYSIOTHERAPIST', // Fisioterapeuta
  THERAPIST = 'THERAPIST', // Terapeuta (físico, ocupacional, etc.)
  PSYCHOLOGIST = 'PSYCHOLOGIST', // Psicólogo/a
  NUTRITIONIST = 'NUTRITIONIST', // Nutricionista
  PHARMACIST = 'PHARMACIST', // Farmacéutico
  TECHNICIAN = 'TECHNICIAN', // Técnico en laboratorio/imagenología

  // ========================================
  // OTROS
  // ========================================
  OTHER = 'OTHER', // Otro
}

/**
 * Datos específicos para profesionales médicos
 * Migrados desde MedicalCollaboratorData
 */
export interface MedicalProfessionalData {
  // Información profesional médica
  medicalLicense: string; // Número de permiso/colegiatura médica
  medicalLicenseState?: string; // Estado/provincia del permiso médico
  specialization?: string; // Especialización médica
  subspecialization?: string; // Sub-especialización
  medicalSchool?: string; // Universidad de medicina
  graduationYear?: number; // Año de graduación

  // Datos de contacto profesional
  professionalAddress: string; // Dirección del consultorio/clínica
  professionalPhone: string; // Teléfono profesional/consultorio
  professionalMobile?: string; // Teléfono móvil profesional
  professionalEmail?: string; // Email profesional
  emergencyPhone?: string; // Teléfono de emergencias

  // Información adicional del profesional
  professionalTitle?: string; // Dr., Dra., Enf., etc.
  department?: string; // Departamento o área de trabajo
  canSignDocuments?: boolean; // Puede firmar documentos médicos

  // Datos adicionales para documentos
  clinicName?: string; // Nombre de la clínica/hospital
  clinicAddress?: string; // Dirección de la clínica
  clinicPhone?: string; // Teléfono de la clínica

  // Configuraciones de práctica
  workingHours?: string; // Horarios de atención
  consultationDuration?: number; // Duración promedio de consulta (minutos)
  acceptsEmergencies?: boolean; // Acepta emergencias
  homeVisits?: boolean; // Hace visitas domiciliarias
  telemedicine?: boolean; // Ofrece telemedicina
  languages?: string[]; // Idiomas que habla
  insuranceProviders?: string[]; // Planes de salud aceptados
}
