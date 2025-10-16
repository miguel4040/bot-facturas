import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import sharp from 'sharp';
import fs from 'fs/promises';
import { OCRResult, FacturaExtracted } from '../types';
import { config } from '../config/env';
import { MLService } from './mlService';
import { MLModel } from '../models/mlModel';
import { OpenAIService } from './openaiService';

export class OCRService {
  /**
   * Procesa una imagen y extrae texto usando Tesseract OCR
   */
  static async processImage(imagePath: string, facturaId?: number): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      // Preprocesar imagen para mejorar OCR
      const processedImagePath = await this.preprocessImage(imagePath);

      const result = await Tesseract.recognize(
        processedImagePath,
        config.ocr.language,
        {
          logger: (info) => {
            if (info.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(info.progress * 100)}%`);
            }
          },
        }
      );

      // Limpiar imagen procesada temporal
      if (processedImagePath !== imagePath) {
        await fs.unlink(processedImagePath).catch(() => {});
      }

      const processingTime = Date.now() - startTime;

      // Usar ML para extracción mejorada
      const extractedDataML = await MLService.extractWithML(result.data.text);

      // Fallback a método tradicional si ML falla
      let extractedData = extractedDataML || this.extractFacturaData(result.data.text);

      let usedOpenAI = false;
      let usedVision = false;

      // Verificar si el texto OCR es basura (mala calidad)
      const isGarbageText = this.isGarbageOCRText(result.data.text);

      // Si el texto es basura Y OpenAI está habilitado, usar Vision API directamente
      if (isGarbageText && OpenAIService.isEnabled()) {
        console.log('⚠️ Texto OCR de mala calidad detectado - Activando GPT-4 Vision...');

        const visionData = await OpenAIService.extractFromImage(imagePath);

        if (visionData) {
          console.log('✓ GPT-4 Vision extrajo datos exitosamente');
          extractedData = visionData;
          usedOpenAI = true;
          usedVision = true;

          // Marcar que se usó Vision
          if (facturaId) {
            await MLModel.createExtraction({
              factura_id: facturaId,
              raw_text: 'Vision API usado debido a OCR de mala calidad',
              preprocessed_text: result.data.text.substring(0, 500),
              extracted_data: visionData,
              confidence_score: visionData.confidence,
              ocr_method: 'gpt4-vision',
              processing_time_ms: processingTime,
            });
          }
        }
      }

      // Si no se usó Vision, continuar con el flujo normal
      if (!usedVision) {
        // Verificar si faltan campos críticos
        const missingCriticalFields = !extractedData?.rfc || !extractedData?.emisor || extractedData?.importeTotal === 0;

        // Si la confianza es baja O faltan campos críticos, y OpenAI está habilitado, usarlo como fallback
        if (extractedData && OpenAIService.isEnabled() &&
            (extractedData.confidence < config.openai.confidenceThreshold || missingCriticalFields)) {
          console.log(`Activando OpenAI - Confianza: ${extractedData.confidence}%, Campos faltantes: RFC=${!extractedData?.rfc}, Emisor=${!extractedData?.emisor}, Total=${extractedData?.importeTotal === 0}`);

          const openAIData = await OpenAIService.extractFacturaData(result.data.text);

          if (openAIData) {
            console.log('OpenAI mejoró la extracción exitosamente');
            extractedData = openAIData;
            usedOpenAI = true;

            // Marcar que se usó OpenAI
            if (facturaId) {
              await MLModel.createExtraction({
                factura_id: facturaId,
                raw_text: result.data.text,
                preprocessed_text: result.data.text.replace(/\n/g, ' ').replace(/\s+/g, ' '),
                extracted_data: openAIData,
                confidence_score: openAIData.confidence,
                ocr_method: 'tesseract+openai',
                processing_time_ms: processingTime,
              });
            }
          }
        } else if (facturaId && extractedData) {
          // Guardar registro de extracción normal
          await MLModel.createExtraction({
            factura_id: facturaId,
            raw_text: result.data.text,
            preprocessed_text: result.data.text.replace(/\n/g, ' ').replace(/\s+/g, ' '),
            extracted_data: extractedData,
            confidence_score: extractedData.confidence,
            ocr_method: 'tesseract+ml',
            processing_time_ms: processingTime,
          });
        }
      }

      return {
        text: result.data.text,
        confidence: result.data.confidence,
        data: extractedData,
        usedOpenAI,
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('No se pudo procesar la imagen');
    }
  }

  /**
   * Procesa un PDF y extrae texto
   */
  static async processPDF(pdfPath: string, facturaId?: number): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdfParse(dataBuffer);

      const processingTime = Date.now() - startTime;

      // Usar ML para extracción mejorada
      const extractedDataML = await MLService.extractWithML(data.text);

      // Fallback a método tradicional si ML falla
      let extractedData = extractedDataML || this.extractFacturaData(data.text);

      let usedOpenAI = false;

      // Verificar si faltan campos críticos
      const missingCriticalFields = !extractedData?.rfc || !extractedData?.emisor || extractedData?.importeTotal === 0;

      // Si la confianza es baja O faltan campos críticos, y OpenAI está habilitado, usarlo como fallback
      if (extractedData && OpenAIService.isEnabled() &&
          (extractedData.confidence < config.openai.confidenceThreshold || missingCriticalFields)) {
        console.log(`Activando OpenAI - Confianza: ${extractedData.confidence}%, Campos faltantes: RFC=${!extractedData?.rfc}, Emisor=${!extractedData?.emisor}, Total=${extractedData?.importeTotal === 0}`);

        const openAIData = await OpenAIService.extractFacturaData(data.text);

        if (openAIData) {
          console.log('OpenAI mejoró la extracción exitosamente');
          extractedData = openAIData;
          usedOpenAI = true;

          // Marcar que se usó OpenAI
          if (facturaId) {
            await MLModel.createExtraction({
              factura_id: facturaId,
              raw_text: data.text,
              preprocessed_text: data.text.replace(/\n/g, ' ').replace(/\s+/g, ' '),
              extracted_data: openAIData,
              confidence_score: openAIData.confidence,
              ocr_method: 'pdf+openai',
              processing_time_ms: processingTime,
            });
          }
        }
      } else if (facturaId && extractedData) {
        // Guardar registro de extracción normal
        await MLModel.createExtraction({
          factura_id: facturaId,
          raw_text: data.text,
          preprocessed_text: data.text.replace(/\n/g, ' ').replace(/\s+/g, ' '),
          extracted_data: extractedData,
          confidence_score: extractedData.confidence,
          ocr_method: 'pdf+ml',
          processing_time_ms: processingTime,
        });
      }

      return {
        text: data.text,
        confidence: 95, // PDFs suelen tener mejor precisión
        data: extractedData,
        usedOpenAI,
      };
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw new Error('No se pudo procesar el PDF');
    }
  }

  /**
   * Detecta si el texto OCR es de mala calidad (basura)
   */
  private static isGarbageOCRText(text: string): boolean {
    if (!text || text.length < 50) return true;

    // Contar patrones de basura más comunes
    const garbagePatterns = [
      /\bNN\b/g,      // "NN" es muy común en OCR malo
      /\bNON\b/g,     // "NON"
      /\bANN\b/g,     // "ANN"
      /\bNANA\b/g,    // "NANA"
      /\bENE\b/g,     // "ENE"
      /\bDNS\b/g,     // "DNS"
      /\bCNA\b/g,     // "CNA"
      /\bECO\b/g,     // "ECO"
      /\bRCN\b/g,     // "RCN"
      /\bNENE\b/g,    // "NENE"
      /\bONU\b/g,     // "ONU"
      /[ÓÑÜ]{3,}/g,   // Caracteres acentuados repetidos
    ];

    let totalGarbageMatches = 0;
    for (const pattern of garbagePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        totalGarbageMatches += matches.length;
      }
    }

    // Si hay más de 10 patrones de basura, es texto corrupto
    if (totalGarbageMatches > 10) {
      console.log(`⚠️ Detectado texto OCR de mala calidad (${totalGarbageMatches} patrones de basura encontrados)`);
      return true;
    }

    // Contar ratio de caracteres raros vs texto normal
    const totalChars = text.length;
    const normalChars = text.match(/[a-zA-Z0-9\s]/g)?.length || 0;
    const ratio = normalChars / totalChars;

    if (ratio < 0.5) {
      console.log(`⚠️ Detectado texto OCR de mala calidad (ratio de caracteres normales: ${(ratio * 100).toFixed(0)}%)`);
      return true;
    }

    return false;
  }

  /**
   * Preprocesa imagen para mejorar calidad de OCR
   */
  private static async preprocessImage(imagePath: string): Promise<string> {
    try {
      const outputPath = imagePath.replace(/\.(jpg|jpeg|png)$/i, '_processed.png');

      // Preprocesamiento mejorado para aumentar legibilidad
      await sharp(imagePath)
        .resize(3000, 3000, {
          fit: 'inside',
          withoutEnlargement: false,
          kernel: sharp.kernel.lanczos3, // Mejor algoritmo de interpolación
        })
        .greyscale()
        .normalize() // Normaliza el contraste
        .linear(1.2, -(128 * 1.2) + 128) // Aumenta el contraste
        .gamma(1.1) // Ajuste de gamma para mejorar texto
        .sharpen({
          sigma: 1.5, // Mayor nitidez para texto
          m1: 1.0,
          m2: 0.5,
        })
        .median(2) // Reduce ruido manteniendo bordes
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error('Error preprocessing image:', error);
      return imagePath; // Retornar imagen original si falla el preprocesamiento
    }
  }

  /**
   * Extrae datos de factura del texto usando expresiones regulares
   */
  private static extractFacturaData(text: string): FacturaExtracted | undefined {
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    console.log('=== DEBUG OCR EXTRACTION ===');
    console.log('Clean text (first 500 chars):', cleanText.substring(0, 500));

    // Patrones para extraer información
    // Múltiples patrones de RFC para capturar variaciones de OCR
    const rfcPatterns = [
      /RFC[:\s]*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i, // Patrón estándar
      /RFC[:\s]*([A-ZÑ&]{3,4}-?\d{6}-?[A-Z0-9]{3})/i, // Con guiones opcionales
      /R\s*[FE]\s*C[:\s]*([A-ZÑ&]{3,4}-?\d{6}-?[A-Z0-9]{3})/i, // Con espacios
      /(?:RFC|R\.?F\.?C\.?)[:\s]*([A-ZÑ&]{3,4}-?\d{6}-?[A-Z0-9]{3})/i, // Con puntos
      /(?:^|\s)([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})(?:\s|$)/i, // RFC solo (sin prefijo)
    ];
    const fechaPatterns = [
      /fecha[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /fecha[:\s]*(\d{1,2}[-\/][A-Z]{3}[-\/]?\d{0,4})/i, // Para formatos como "30-SEP-2025" o "30-SEP"
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/,
    ];
    const totalPatterns = [
      /cargo[\s\.]+a[\s\.]+tarjeta[\s\.]*\([^\)]*\$?\s*([\d,\s]+\.?\d{1,2})/i, // Para "CARGO. A TARJETA. (-) -$ 1,842.0)"
      /(?:gran\s+)?total[:\s]*\$?\s*-?\(?\$?\s*([\d,\s]+\.?\d{0,2})/i,
      /cargo\s+(?:a\s+)?(?:tarjeta)?[:\s]*\(?\-?\$?\s*([\d,\s]+\.?\d{0,2})/i,
      /importe\s+total[:\s]*\$?\s*([\d,\s]+\.?\d{0,2})/i,
      /total[:\s]*\$?\s*([\d,\s]+\.?\d{0,2})/i,
    ];
    const ivaPatterns = [
      /IVA[:\s]*\$?\s*([\d,\s]+\.?\d{0,2})/i,
      /impuesto[:\s]*\$?\s*([\d,\s]+\.?\d{0,2})/i,
    ];
    const subtotalPatterns = [
      /energ[ií]a[\s\.]*\$?\s*([\d,\s]+\.?\d{0,2})/i, // Para "ENERGIA. $ 1,588.0"
      /subtotal[:\s]*\$?\s*([\d,\s]+\.?\d{0,2})/i,
      /sub[\s-]?total[:\s]*\$?\s*([\d,\s]+\.?\d{0,2})/i,
    ];

    // Extraer RFC - probar múltiples patrones
    let rfc = '';
    for (let i = 0; i < rfcPatterns.length; i++) {
      const match = cleanText.match(rfcPatterns[i]);
      console.log(`RFC pattern ${i} match:`, match ? match[0] : 'no match');
      if (match) {
        // Limpiar guiones y convertir a mayúsculas
        rfc = match[1].replace(/-/g, '').toUpperCase();
        console.log(`RFC extracted: ${rfc}`);
        break;
      }
    }

    // Extraer fecha
    let fecha = '';
    for (const pattern of fechaPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        fecha = this.normalizeDate(match[1]);
        break;
      }
    }

    // Extraer total
    let importeTotal = 0;
    for (let i = 0; i < totalPatterns.length; i++) {
      const match = cleanText.match(totalPatterns[i]);
      console.log(`Total pattern ${i} match:`, match ? match[0] : 'no match');
      if (match) {
        // Limpiar espacios, comas y caracteres raros
        const cleanNumber = match[1].replace(/[,\s]/g, '').replace(/[^0-9.]/g, '');
        console.log(`Extracted total number: ${cleanNumber}`);
        importeTotal = parseFloat(cleanNumber);
        if (!isNaN(importeTotal)) {
          console.log(`Final total: ${importeTotal}`);
          break;
        }
      }
    }

    // Extraer IVA
    let iva = 0;
    for (const pattern of ivaPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const cleanNumber = match[1].replace(/[,\s]/g, '').replace(/[^0-9.]/g, '');
        iva = parseFloat(cleanNumber);
        if (!isNaN(iva)) break;
      }
    }

    // Extraer subtotal
    let subtotal = 0;
    for (let i = 0; i < subtotalPatterns.length; i++) {
      const match = cleanText.match(subtotalPatterns[i]);
      console.log(`Subtotal pattern ${i} match:`, match ? match[0] : 'no match');
      if (match) {
        const cleanNumber = match[1].replace(/[,\s]/g, '').replace(/[^0-9.]/g, '');
        console.log(`Extracted subtotal number: ${cleanNumber}`);
        subtotal = parseFloat(cleanNumber);
        if (!isNaN(subtotal)) {
          console.log(`Final subtotal: ${subtotal}`);
          break;
        }
      }
    }

    // Si no se encontró subtotal pero sí total e IVA, calcularlo
    if (!subtotal && importeTotal && iva) {
      subtotal = importeTotal - iva;
    }

    // Si no se encontró IVA pero sí total y subtotal, calcularlo
    if (!iva && importeTotal && subtotal) {
      iva = importeTotal - subtotal;
    }

    // Calcular nivel de confianza basado en datos extraídos
    let confidence = 0;
    if (rfc) confidence += 30;
    if (fecha) confidence += 20;
    if (importeTotal > 0) confidence += 25;
    if (iva > 0) confidence += 15;
    if (subtotal > 0) confidence += 10;

    // Solo retornar datos si hay confianza mínima
    if (confidence < config.ocr.confidenceThreshold) {
      return undefined;
    }

    return {
      rfc,
      fecha,
      importeTotal,
      iva,
      subtotal,
      confidence,
      rawText: text,
    };
  }

  /**
   * Normaliza formato de fecha a YYYY-MM-DD
   */
  private static normalizeDate(dateStr: string): string {
    const parts = dateStr.split(/[-\/]/);

    if (parts.length < 2) {
      return dateStr;
    }

    let [day, month, year] = parts;

    // Mapa de meses en español abreviados
    const monthMap: { [key: string]: string } = {
      'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04',
      'MAY': '05', 'JUN': '06', 'JUL': '07', 'AGO': '08',
      'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
    };

    // Si el mes es texto, convertirlo a número
    if (isNaN(parseInt(month)) && month.length === 3) {
      month = monthMap[month.toUpperCase()] || month;
    }

    // Si no hay año o es incompleto, usar el año actual
    if (!year || year.length === 0) {
      year = String(new Date().getFullYear());
    } else if (year.length === 2) {
      // Si el año es de 2 dígitos, convertirlo a 4
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = String(century + parseInt(year));
    }

    // Detectar formato (DD-MM-YYYY vs MM-DD-YYYY)
    // Asumimos DD-MM-YYYY para México
    if (parseInt(day) > 12) {
      // Es definitivamente día
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (parseInt(month) > 12) {
      // month es en realidad el día
      return `${year}-${day.padStart(2, '0')}-${month.padStart(2, '0')}`;
    }

    // Por defecto, asumir DD-MM-YYYY
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
}
