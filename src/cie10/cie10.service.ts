import * as fs from 'fs';
import * as path from 'path';

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

export interface CIE10Code {
  code: string;
  description: string;
  category?: string;
  chapter?: string;
}

@Injectable()
export class CIE10Service {
  private codes: CIE10Code[] = [];
  private codesByCode: Map<string, CIE10Code> = new Map();

  constructor() {
    this.loadCIE10Codes();
  }

  /**
   * Cargar códigos CIE-10 desde archivo JSON
   * TODO: Cargar desde base de datos o archivo real
   */
  private loadCIE10Codes() {
    try {
      // Por ahora usamos datos de ejemplo
      // En producción, esto debería cargarse desde un archivo JSON o base de datos
      this.codes = this.getDefaultCIE10Codes();
      this.codes.forEach(code => {
        this.codesByCode.set(code.code, code);
      });
    } catch (error) {
      console.error('Error loading CIE-10 codes:', error);
      // Si falla, usar códigos por defecto
      this.codes = this.getDefaultCIE10Codes();
    }
  }

  /**
   * Códigos CIE-10 por defecto (ejemplos comunes)
   * TODO: Reemplazar con catálogo completo
   */
  private getDefaultCIE10Codes(): CIE10Code[] {
    return [
      // Capítulo I: Ciertas enfermedades infecciosas y parasitarias
      { code: 'A00', description: 'Cólera', chapter: 'I' },
      { code: 'A01', description: 'Fiebres tifoidea y paratifoidea', chapter: 'I' },
      { code: 'A02', description: 'Otras infecciones debidas a Salmonella', chapter: 'I' },

      // Capítulo II: Neoplasias
      { code: 'C00', description: 'Neoplasia maligna del labio', chapter: 'II' },
      { code: 'C50', description: 'Neoplasia maligna de la mama', chapter: 'II' },

      // Capítulo IV: Enfermedades endocrinas, nutricionales y metabólicas
      { code: 'E10', description: 'Diabetes mellitus tipo 1', chapter: 'IV' },
      { code: 'E11', description: 'Diabetes mellitus tipo 2', chapter: 'IV' },
      {
        code: 'E78',
        description: 'Trastornos del metabolismo de las lipoproteínas',
        chapter: 'IV',
      },

      // Capítulo V: Trastornos mentales y del comportamiento
      { code: 'F32', description: 'Episodio depresivo', chapter: 'V' },
      { code: 'F41', description: 'Trastornos de ansiedad', chapter: 'V' },

      // Capítulo VI: Enfermedades del sistema nervioso
      { code: 'G40', description: 'Epilepsia', chapter: 'VI' },
      { code: 'G93', description: 'Otras enfermedades del encéfalo', chapter: 'VI' },

      // Capítulo IX: Enfermedades del sistema circulatorio
      { code: 'I10', description: 'Hipertensión esencial (primaria)', chapter: 'IX' },
      { code: 'I20', description: 'Angina de pecho', chapter: 'IX' },
      { code: 'I21', description: 'Infarto agudo de miocardio', chapter: 'IX' },
      { code: 'I50', description: 'Insuficiencia cardíaca', chapter: 'IX' },

      // Capítulo X: Enfermedades del sistema respiratorio
      { code: 'J00', description: 'Rinofaringitis aguda (resfriado común)', chapter: 'X' },
      {
        code: 'J06',
        description: 'Infecciones agudas de las vías respiratorias superiores',
        chapter: 'X',
      },
      { code: 'J18', description: 'Neumonía, organismo no especificado', chapter: 'X' },
      {
        code: 'J44',
        description: 'Otras enfermedades pulmonares obstructivas crónicas',
        chapter: 'X',
      },
      { code: 'J45', description: 'Asma', chapter: 'X' },

      // Capítulo XI: Enfermedades del sistema digestivo
      { code: 'K25', description: 'Úlcera gástrica', chapter: 'XI' },
      { code: 'K29', description: 'Gastritis y duodenitis', chapter: 'XI' },
      { code: 'K59', description: 'Otros trastornos funcionales del intestino', chapter: 'XI' },

      // Capítulo XIII: Enfermedades del sistema osteomuscular y del tejido conectivo
      { code: 'M25', description: 'Otros trastornos articulares', chapter: 'XIII' },
      { code: 'M79', description: 'Otros trastornos de los tejidos blandos', chapter: 'XIII' },

      // Capítulo XIV: Enfermedades del sistema genitourinario
      { code: 'N18', description: 'Enfermedad renal crónica', chapter: 'XIV' },
      { code: 'N39', description: 'Otros trastornos del sistema urinario', chapter: 'XIV' },

      // Capítulo XIX: Traumatismos, envenenamientos y otras consecuencias de causas externas
      { code: 'S00', description: 'Traumatismo superficial de la cabeza', chapter: 'XIX' },
      { code: 'S72', description: 'Fractura del fémur', chapter: 'XIX' },

      // Capítulo XXI: Factores que influyen en el estado de salud
      {
        code: 'Z00',
        description: 'Examen general e investigación de personas sin quejas',
        chapter: 'XXI',
      },
      { code: 'Z51', description: 'Otras atenciones médicas', chapter: 'XXI' },
    ];
  }

  /**
   * Buscar códigos CIE-10
   */
  searchCodes(searchTerm: string, limit = 50): CIE10Code[] {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.codes.slice(0, limit);
    }

    const term = searchTerm.toLowerCase().trim();
    const results: CIE10Code[] = [];

    // Buscar por código exacto primero
    const exactMatch = this.codesByCode.get(term.toUpperCase());
    if (exactMatch) {
      results.push(exactMatch);
    }

    // Buscar por código que empiece con el término
    for (const code of this.codes) {
      if (code.code.toLowerCase().startsWith(term)) {
        if (!results.find(r => r.code === code.code)) {
          results.push(code);
        }
      }
    }

    // Buscar por descripción
    for (const code of this.codes) {
      if (code.description.toLowerCase().includes(term)) {
        if (!results.find(r => r.code === code.code)) {
          results.push(code);
        }
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Obtener código CIE-10 por código exacto
   */
  getCodeByCode(code: string): CIE10Code | null {
    return this.codesByCode.get(code.toUpperCase()) || null;
  }

  /**
   * Validar código CIE-10
   */
  validateCode(code: string): boolean {
    return this.codesByCode.has(code.toUpperCase());
  }

  /**
   * Obtener todos los códigos (paginado)
   */
  getAllCodes(
    page = 1,
    limit = 50
  ): {
    codes: CIE10Code[];
    total: number;
    page: number;
    limit: number;
  } {
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      codes: this.codes.slice(start, end),
      total: this.codes.length,
      page,
      limit,
    };
  }

  /**
   * Obtener códigos por capítulo
   */
  getCodesByChapter(chapter: string): CIE10Code[] {
    return this.codes.filter(code => code.chapter === chapter);
  }
}
