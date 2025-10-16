import natural from 'natural';
import { MLModel, ExtractionPattern } from '../models/mlModel';
import { FacturaExtracted } from '../types';

const TfIdf = natural.TfIdf;

interface ExtractedField {
  value: string;
  confidence: number;
  method: string;
  position?: number;
}

export class MLService {
  private static patterns: Map<string, ExtractionPattern[]> = new Map();

  /**
   * Inicializa el servicio de ML cargando patrones y modelo
   */
  static async initialize(): Promise<void> {
    console.log('Inicializando servicio de ML...');

    // Cargar patrones desde la base de datos
    await this.loadPatterns();

    // Intentar cargar modelo pre-entrenado
    await this.loadModel();

    console.log('Servicio de ML inicializado');
  }

  /**
   * Carga patrones de extracción desde la base de datos
   */
  private static async loadPatterns(): Promise<void> {
    const fields = ['rfc', 'fecha', 'importeTotal', 'iva', 'subtotal'];

    for (const field of fields) {
      const patterns = await MLModel.getPatternsByField(field);
      this.patterns.set(field, patterns);
    }

    // Si no hay patrones, crear los básicos
    if (this.patterns.size === 0 || this.getTotalPatternCount() < 13) {
      console.log('Recreando patrones mejorados...');
      await this.createDefaultPatterns();
    }
  }

  /**
   * Cuenta el total de patrones cargados
   */
  private static getTotalPatternCount(): number {
    let total = 0;
    for (const patterns of this.patterns.values()) {
      total += patterns.length;
    }
    return total;
  }

  /**
   * Crea patrones por defecto
   */
  private static async createDefaultPatterns(): Promise<void> {
    const defaultPatterns = [
      // RFC
      { field_name: 'rfc', pattern_type: 'regex', pattern_value: 'RFC[:\\s]*([A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3})', confidence_weight: 1.5 },
      { field_name: 'rfc', pattern_type: 'regex', pattern_value: '([A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3})', confidence_weight: 1.0 },

      // Fecha - Mejorada para detectar formatos con meses en texto
      { field_name: 'fecha', pattern_type: 'regex', pattern_value: 'fecha[:\\s]*(\\d{1,2}[-\\/]\\d{1,2}[-\\/]\\d{2,4})', confidence_weight: 1.5 },
      { field_name: 'fecha', pattern_type: 'regex', pattern_value: 'fecha[:\\s]*(\\d{1,2}[-\\/][A-Z]{3})', confidence_weight: 1.4 },
      { field_name: 'fecha', pattern_type: 'regex', pattern_value: '(\\d{1,2}[-\\/]\\d{1,2}[-\\/]\\d{4})', confidence_weight: 1.0 },

      // Total - Mejorado para recibos de CFE con múltiples variantes
      { field_name: 'importeTotal', pattern_type: 'regex', pattern_value: 'cargo[\\s\\.]+a[\\s\\.]+tarjeta[\\s\\.]*.*?\\$?\\s*([\\d,\\s]+\\.?\\d{1,2})', confidence_weight: 2.0 },
      { field_name: 'importeTotal', pattern_type: 'regex', pattern_value: 'cargo[\\s\\.]+(?:a[\\s\\.]+)?tarjeta[\\s\\.]*.*?([\\d,]+\\.[0-9])', confidence_weight: 1.9 },
      { field_name: 'importeTotal', pattern_type: 'regex', pattern_value: '(?:gran\\s+)?total[:\\s]*\\$?\\s*-?\\(?\\s*([\\d,\\s]+\\.?\\d{0,2})', confidence_weight: 1.5 },
      { field_name: 'importeTotal', pattern_type: 'regex', pattern_value: 'importe\\s+total[:\\s]*\\$?\\s*([\\d,\\s]+\\.?\\d{0,2})', confidence_weight: 1.3 },

      // IVA
      { field_name: 'iva', pattern_type: 'regex', pattern_value: 'IVA[:\\s]*\\$?\\s*([\\d,\\s]+\\.?\\d{0,2})', confidence_weight: 1.5 },
      { field_name: 'iva', pattern_type: 'regex', pattern_value: 'impuesto[:\\s]*\\$?\\s*([\\d,\\s]+\\.?\\d{0,2})', confidence_weight: 1.2 },

      // Subtotal - Mejorado para recibos de CFE
      { field_name: 'subtotal', pattern_type: 'regex', pattern_value: 'energ[ií]a[\\s\\.]*\\$?\\s*([\\d,\\s]+\\.?\\d{0,2})', confidence_weight: 1.6 },
      { field_name: 'subtotal', pattern_type: 'regex', pattern_value: 'subtotal[:\\s]*\\$?\\s*([\\d,\\s]+\\.?\\d{0,2})', confidence_weight: 1.5 },
      { field_name: 'subtotal', pattern_type: 'regex', pattern_value: 'sub[\\s-]?total[:\\s]*\\$?\\s*([\\d,\\s]+\\.?\\d{0,2})', confidence_weight: 1.3 },
    ];

    for (const pattern of defaultPatterns) {
      await MLModel.createPattern(pattern);
    }

    await this.loadPatterns();
  }

  /**
   * Extrae datos usando ML mejorado con múltiples técnicas
   */
  static async extractWithML(text: string): Promise<FacturaExtracted | undefined> {
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const lowerText = cleanText.toLowerCase();

    console.log('=== DEBUG ML EXTRACTION ===');
    console.log('Clean text (first 500 chars):', cleanText.substring(0, 500));

    // Extraer cada campo usando múltiples métodos
    const rfc = await this.extractField('rfc', cleanText, lowerText);
    const fecha = await this.extractField('fecha', cleanText, lowerText);
    const importeTotal = await this.extractField('importeTotal', cleanText, lowerText);
    const iva = await this.extractField('iva', cleanText, lowerText);
    const subtotal = await this.extractField('subtotal', cleanText, lowerText);

    console.log('Extracted fields:');
    console.log('- importeTotal:', importeTotal);
    console.log('- iva:', iva);
    console.log('- subtotal:', subtotal);

    // Validar coherencia de datos numéricos
    this.validateNumericConsistency(subtotal, iva, importeTotal);

    // Calcular confianza general
    const confidence = this.calculateOverallConfidence([rfc, fecha, importeTotal, iva, subtotal]);

    if (confidence < 60) {
      return undefined;
    }

    // Función para limpiar números
    const cleanNumber = (str: string) => parseFloat(str.replace(/[,\s]/g, '').replace(/[^0-9.]/g, '')) || 0;

    return {
      rfc: rfc.value,
      fecha: fecha.value ? this.normalizeDate(fecha.value) : '',
      importeTotal: cleanNumber(importeTotal.value),
      iva: cleanNumber(iva.value),
      subtotal: cleanNumber(subtotal.value),
      confidence,
      rawText: text,
    };
  }

  /**
   * Extrae un campo específico usando múltiples técnicas
   */
  private static async extractField(
    fieldName: string,
    text: string,
    lowerText: string
  ): Promise<ExtractedField> {
    const candidates: ExtractedField[] = [];

    // Método 1: Usar patrones aprendidos
    const patterns = this.patterns.get(fieldName) || [];
    for (const pattern of patterns) {
      if (pattern.pattern_type === 'regex') {
        const regex = new RegExp(pattern.pattern_value, 'i');
        const match = text.match(regex);
        if (match && match[1]) {
          const candidate = {
            value: match[1].trim(),
            confidence: (pattern.accuracy || 80) * (pattern.confidence_weight || 1.0),
            method: 'pattern',
          };
          candidates.push(candidate);
          if (fieldName === 'importeTotal') {
            console.log(`  Pattern match for ${fieldName}: value="${candidate.value}", confidence=${candidate.confidence}, pattern="${pattern.pattern_value}"`);
          }
        }
      }
    }

    // Método 2: Búsqueda por contexto usando NLP
    const contextResult = this.extractByContext(fieldName, text, lowerText);
    if (contextResult) {
      candidates.push(contextResult);
    }

    // Método 3: Posición relativa (aprendida de datos históricos)
    const positionResult = this.extractByPosition(fieldName, text);
    if (positionResult) {
      candidates.push(positionResult);
    }

    // Seleccionar mejor candidato
    if (candidates.length === 0) {
      return { value: '', confidence: 0, method: 'none' };
    }

    // Ordenar por confianza
    candidates.sort((a, b) => b.confidence - a.confidence);

    // Si múltiples candidatos tienen valores similares, aumentar confianza
    const topValue = candidates[0].value;
    const similarCount = candidates.filter(c =>
      this.areSimilarValues(c.value, topValue, fieldName)
    ).length;

    if (similarCount > 1) {
      candidates[0].confidence = Math.min(100, candidates[0].confidence * 1.2);
    }

    return candidates[0];
  }

  /**
   * Extrae por contexto usando palabras clave cercanas
   */
  private static extractByContext(
    fieldName: string,
    text: string,
    lowerText: string
  ): ExtractedField | null {
    const keywords: { [key: string]: string[] } = {
      rfc: ['rfc', 'r.f.c', 'registro federal'],
      fecha: ['fecha', 'date', 'día', 'emitida', 'emision'],
      importeTotal: ['cargo', 'total', 'importe total', 'monto total', 'total a pagar', 'tarjeta'],
      iva: ['iva', 'i.v.a', 'impuesto', 'tax'],
      subtotal: ['subtotal', 'sub total', 'sub-total', 'importe', 'energia', 'energía'],
    };

    const fieldKeywords = keywords[fieldName] || [];

    for (const keyword of fieldKeywords) {
      const keywordIndex = lowerText.indexOf(keyword);
      if (keywordIndex === -1) continue;

      // Buscar valor después de la palabra clave (siguientes 80 caracteres para tener más contexto)
      const afterKeyword = text.substring(keywordIndex, keywordIndex + 80);

      let pattern: RegExp;
      if (fieldName === 'rfc') {
        pattern = /([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/;
      } else if (fieldName === 'fecha') {
        pattern = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/;
      } else {
        // Patrón mejorado para capturar números con espacios, comas y formatos variados
        pattern = /[\$\-\(\)]*\s*([1-9][\d\s,]*\.?\d{1,2})/;
      }

      const match = afterKeyword.match(pattern);
      if (match && match[1]) {
        return {
          value: match[1].trim(),
          confidence: 75,
          method: 'context',
        };
      }
    }

    return null;
  }

  /**
   * Extrae por posición aproximada en el documento
   */
  private static extractByPosition(fieldName: string, text: string): ExtractedField | null {
    // Dividir texto en líneas
    const lines = text.split('\n').filter(line => line.trim());

    // Posiciones típicas (basado en tickets comunes)
    const positions: { [key: string]: number } = {
      rfc: 0.1, // Generalmente en el 10% superior
      fecha: 0.15, // 15% desde el inicio
      subtotal: 0.8, // 80% hacia el final
      iva: 0.85, // 85% hacia el final
      importeTotal: 0.9, // 90% hacia el final
    };

    const targetPosition = positions[fieldName];
    if (!targetPosition) return null;

    const lineIndex = Math.floor(lines.length * targetPosition);
    const searchStart = Math.max(0, lineIndex - 2);
    const searchEnd = Math.min(lines.length, lineIndex + 3);
    const searchText = lines.slice(searchStart, searchEnd).join(' ');

    let pattern: RegExp;
    if (fieldName === 'rfc') {
      pattern = /([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/;
    } else if (fieldName === 'fecha') {
      pattern = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/;
    } else {
      pattern = /\$?\s*([\d,]+\.?\d{0,2})/;
    }

    const match = searchText.match(pattern);
    if (match && match[1]) {
      return {
        value: match[1].trim(),
        confidence: 65,
        method: 'position',
        position: lineIndex,
      };
    }

    return null;
  }

  /**
   * Valida consistencia numérica
   */
  private static validateNumericConsistency(
    subtotal: ExtractedField,
    iva: ExtractedField,
    total: ExtractedField
  ): void {
    // Limpiar números: remover espacios, comas y caracteres no numéricos excepto punto decimal
    const cleanNumber = (str: string) => str.replace(/[,\s]/g, '').replace(/[^0-9.]/g, '');
    const subVal = parseFloat(cleanNumber(subtotal.value)) || 0;
    const ivaVal = parseFloat(cleanNumber(iva.value)) || 0;
    const totalVal = parseFloat(cleanNumber(total.value)) || 0;

    // Verificar: subtotal + iva ≈ total
    const expectedTotal = subVal + ivaVal;
    const difference = Math.abs(expectedTotal - totalVal);
    const tolerance = totalVal * 0.01; // 1% de tolerancia

    if (difference <= tolerance && totalVal > 0) {
      // Aumentar confianza si los números son consistentes
      subtotal.confidence = Math.min(100, subtotal.confidence * 1.15);
      iva.confidence = Math.min(100, iva.confidence * 1.15);
      total.confidence = Math.min(100, total.confidence * 1.15);
    }

    // Verificar: IVA ≈ 16% del subtotal (para México)
    const expectedIVA = subVal * 0.16;
    const ivaDifference = Math.abs(expectedIVA - ivaVal);
    const ivaTolerance = expectedIVA * 0.01;

    if (ivaDifference <= ivaTolerance && ivaVal > 0) {
      iva.confidence = Math.min(100, iva.confidence * 1.1);
    }
  }

  /**
   * Compara si dos valores son similares según el tipo de campo
   */
  private static areSimilarValues(value1: string, value2: string, fieldName: string): boolean {
    if (value1 === value2) return true;

    if (fieldName === 'rfc') {
      return value1.toUpperCase() === value2.toUpperCase();
    }

    if (fieldName === 'fecha') {
      // Comparar fechas normalizadas
      return this.normalizeDate(value1) === this.normalizeDate(value2);
    }

    // Para números, comparar valores
    const num1 = parseFloat(value1.replace(/,/g, ''));
    const num2 = parseFloat(value2.replace(/,/g, ''));
    return Math.abs(num1 - num2) < 0.01;
  }

  /**
   * Normaliza fecha
   */
  private static normalizeDate(dateStr: string): string {
    const parts = dateStr.split(/[-\/]/);
    if (parts.length < 2) return dateStr;

    const day = parts[0];
    let month = parts[1];
    let year = parts[2];

    // Mapa de meses en español abreviados
    const monthMap: { [key: string]: string } = {
      'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04',
      'MAY': '05', 'JUN': '06', 'JUL': '07', 'AGO': '08',
      'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
    };

    // Si el mes es texto, convertirlo a número
    if (isNaN(parseInt(month)) && month && month.length === 3) {
      month = monthMap[month.toUpperCase()] || month;
    }

    // Si no hay año o es incompleto, usar el año actual
    if (!year || year.length === 0) {
      year = String(new Date().getFullYear());
    } else if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = String(century + parseInt(year));
    }

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  /**
   * Calcula confianza general
   */
  private static calculateOverallConfidence(fields: ExtractedField[]): number {
    const weights: { [key: number]: number } = {
      0: 30, // RFC
      1: 20, // Fecha
      2: 25, // Total
      3: 15, // IVA
      4: 10, // Subtotal
    };

    let totalWeight = 0;
    let weightedConfidence = 0;

    fields.forEach((field, index) => {
      const weight = weights[index] || 10;
      if (field.value && field.confidence > 0) {
        weightedConfidence += field.confidence * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? Math.round(weightedConfidence / totalWeight) : 0;
  }

  /**
   * Aprende de una corrección
   */
  static async learnFromCorrection(
    extractionId: number,
    fieldName: string,
    _extractedValue: string,
    correctedValue: string
  ): Promise<void> {
    // Analizar qué salió mal y ajustar patrones
    const extraction = await MLModel.getExtractionById(extractionId);
    if (!extraction || !extraction.raw_text) return;

    const text = extraction.raw_text;

    // Buscar el valor correcto en el texto
    const correctValueIndex = text.indexOf(correctedValue);
    if (correctValueIndex !== -1) {
      // Extraer contexto alrededor del valor correcto
      const contextBefore = text.substring(Math.max(0, correctValueIndex - 30), correctValueIndex);
      const contextAfter = text.substring(correctValueIndex + correctedValue.length, correctValueIndex + correctedValue.length + 30);

      // Crear nuevo patrón basado en el contexto
      const contextPattern = this.generatePatternFromContext(contextBefore, correctedValue, contextAfter, fieldName);

      if (contextPattern) {
        await MLModel.createPattern({
          field_name: fieldName,
          pattern_type: 'regex',
          pattern_value: contextPattern,
          confidence_weight: 1.2,
          success_count: 1,
        });
      }
    }

    // Recargar patrones
    await this.loadPatterns();
  }

  /**
   * Genera patrón desde contexto
   */
  private static generatePatternFromContext(
    before: string,
    _value: string,
    _after: string,
    fieldName: string
  ): string | null {
    // Extraer palabras clave del contexto anterior
    const beforeWords = before.toLowerCase().trim().split(/\s+/).slice(-3);
    const keyword = beforeWords[beforeWords.length - 1];

    if (!keyword) return null;

    let valuePattern: string;
    if (fieldName === 'rfc') {
      valuePattern = '([A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3})';
    } else if (fieldName === 'fecha') {
      valuePattern = '(\\d{1,2}[-\\/]\\d{1,2}[-\\/]\\d{2,4})';
    } else {
      valuePattern = '\\$?\\s*([\\d,]+\\.?\\d{0,2})';
    }

    return `${keyword}[:\\s]*${valuePattern}`;
  }

  /**
   * Carga modelo de TensorFlow (si existe)
   */
  private static async loadModel(): Promise<void> {
    try {
      // Intentar cargar modelo guardado
      // this.model = await tf.loadLayersModel('file://./models/extraction-model/model.json');
      // console.log('Modelo de ML cargado');
    } catch (error) {
      console.log('No hay modelo pre-entrenado, se usarán solo patrones');
    }
  }

  /**
   * Extrae features para entrenamiento futuro
   */
  static extractFeatures(text: string, _extracted: any): number[] {
    const features: number[] = [];

    // Feature 1-10: TF-IDF de palabras clave
    const tfidf = new TfIdf();
    tfidf.addDocument(text);
    const keywords = ['rfc', 'fecha', 'total', 'iva', 'subtotal', 'factura', 'ticket', 'comprobante', 'importe', 'pago'];
    keywords.forEach(keyword => {
      features.push(tfidf.tfidf(keyword, 0));
    });

    // Feature 11: Longitud del texto
    features.push(text.length / 1000);

    // Feature 12: Número de líneas
    features.push(text.split('\n').length);

    // Feature 13: Densidad de números
    const numbers = text.match(/\d/g) || [];
    features.push(numbers.length / text.length);

    // Feature 14: Densidad de signos de dinero
    const moneySymbols = text.match(/\$/g) || [];
    features.push(moneySymbols.length / text.length);

    // Feature 15: Tiene RFC válido
    features.push(/[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}/.test(text) ? 1 : 0);

    return features;
  }
}
