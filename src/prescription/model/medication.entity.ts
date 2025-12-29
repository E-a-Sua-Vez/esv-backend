import { Collection } from 'fireorm';

export class Medication {
  id: string;
  commerceId: string;
  name: string; // Nombre genérico
  commercialName?: string; // Nombre comercial
  atcCode?: string; // Código ATC
  activePrinciple: string; // Principio activo
  presentation: string; // Presentación (ej: "500mg comprimidos")
  dosageForm: string; // Forma farmacéutica (comprimido, cápsula, etc.)
  route: string; // Vía de administración (oral, tópica, etc.)
  standardDosage?: string; // Dosis estándar
  contraindications?: string[]; // Contraindicaciones
  interactions?: string[]; // Interacciones conocidas
  active: boolean;
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Collection('medication')
export class MedicationCatalog extends Medication {
  // Catálogo de medicamentos disponible en el sistema
}
