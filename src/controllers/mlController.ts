import { Request, Response } from 'express';
import { MLModel } from '../models/mlModel';
import { FacturaModel } from '../models/facturaModel';
import { MLService } from '../services/mlService';

export class MLController {
  /**
   * Registrar corrección manual de datos extraídos
   */
  static async registrarCorreccion(req: Request, res: Response) {
    try {
      const { facturaId } = req.params;
      const corrections = req.body.corrections; // Array de correcciones

      if (!Array.isArray(corrections) || corrections.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere un array de correcciones',
        });
      }

      const factura = await FacturaModel.findById(parseInt(facturaId));
      if (!factura) {
        return res.status(404).json({ success: false, error: 'Factura no encontrada' });
      }

      // Obtener la extracción OCR asociada
      const extractions = await MLModel.getExtractionsByFactura(parseInt(facturaId));
      if (extractions.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No se encontró extracción OCR para esta factura',
        });
      }

      const extraction = extractions[0]; // Usar la más reciente

      const savedCorrections = [];

      // Guardar cada corrección y aprender de ella
      for (const correction of corrections) {
        const { fieldName, correctedValue } = correction;

        if (!fieldName || correctedValue === undefined) {
          continue;
        }

        // Obtener valor extraído original
        const extractedValue = extraction.extracted_data?.[fieldName] || '';

        // Guardar corrección
        const savedCorrection = await MLModel.createCorrection({
          ocr_extraction_id: extraction.id!,
          field_name: fieldName,
          extracted_value: String(extractedValue),
          corrected_value: String(correctedValue),
          corrected_by: req.body.correctedBy || 'api',
          correction_source: req.body.source || 'manual',
        });

        savedCorrections.push(savedCorrection);

        // Aprender de la corrección
        await MLService.learnFromCorrection(
          extraction.id!,
          fieldName,
          String(extractedValue),
          String(correctedValue)
        );
      }

      // Actualizar factura con valores corregidos
      const updates: any = {};
      corrections.forEach((c: any) => {
        const fieldMap: any = {
          rfc: 'rfc',
          fecha: 'fecha',
          importeTotal: 'importe_total',
          iva: 'iva',
          subtotal: 'subtotal',
        };

        const dbField = fieldMap[c.fieldName];
        if (dbField) {
          updates[dbField] = c.correctedValue;
        }
      });

      if (Object.keys(updates).length > 0) {
        await FacturaModel.update(parseInt(facturaId), updates);
      }

      return res.status(200).json({
        success: true,
        message: 'Correcciones registradas y aprendizaje completado',
        corrections: savedCorrections,
      });
    } catch (error: any) {
      console.error('Error registrando corrección:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtener métricas de precisión del sistema
   */
  static async obtenerMetricas(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      let metrics;

      if (startDate && endDate) {
        metrics = await MLModel.getMetricsByDateRange(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        // Métricas de los últimos 30 días
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        metrics = await MLModel.getMetricsByDateRange(start, end);
      }

      // Obtener precisión por campo
      const accuracy = await MLModel.getExtractionAccuracy();

      // Obtener extracciones recientes
      const recentExtractions = await MLModel.getRecentExtractions(20);

      return res.status(200).json({
        success: true,
        metrics,
        accuracy,
        recentExtractions,
      });
    } catch (error: any) {
      console.error('Error obteniendo métricas:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtener historial de correcciones
   */
  static async obtenerCorrecciones(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const corrections = await MLModel.getAllCorrections(limit);

      return res.status(200).json({
        success: true,
        count: corrections.length,
        corrections,
      });
    } catch (error: any) {
      console.error('Error obteniendo correcciones:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtener correcciones de una factura específica
   */
  static async obtenerCorreccionesPorFactura(req: Request, res: Response) {
    try {
      const { facturaId } = req.params;

      // Obtener extracciones de la factura
      const extractions = await MLModel.getExtractionsByFactura(parseInt(facturaId));

      if (extractions.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No se encontraron extracciones para esta factura',
        });
      }

      // Obtener correcciones de todas las extracciones
      const allCorrections = [];
      for (const extraction of extractions) {
        const corrections = await MLModel.getCorrectionsByExtraction(extraction.id!);
        allCorrections.push(...corrections);
      }

      return res.status(200).json({
        success: true,
        facturaId: parseInt(facturaId),
        extractions,
        corrections: allCorrections,
      });
    } catch (error: any) {
      console.error('Error obteniendo correcciones de factura:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtener patrones aprendidos
   */
  static async obtenerPatrones(req: Request, res: Response) {
    try {
      const { fieldName } = req.query;

      if (fieldName) {
        const patterns = await MLModel.getPatternsByField(fieldName as string);
        return res.status(200).json({
          success: true,
          fieldName,
          patterns,
        });
      }

      // Obtener patrones de todos los campos
      const fields = ['rfc', 'fecha', 'importeTotal', 'iva', 'subtotal'];
      const allPatterns: any = {};

      for (const field of fields) {
        allPatterns[field] = await MLModel.getPatternsByField(field);
      }

      return res.status(200).json({
        success: true,
        patterns: allPatterns,
      });
    } catch (error: any) {
      console.error('Error obteniendo patrones:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Actualizar métricas diarias (puede ser llamado por un cron job)
   */
  static async actualizarMetricasDiarias(_req: Request, res: Response) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Obtener estadísticas del día
      const extracciones = await MLModel.getRecentExtractions(1000);

      const todayExtractions = extracciones.filter((e: any) => {
        const extractionDate = new Date(e.created_at);
        extractionDate.setHours(0, 0, 0, 0);
        return extractionDate.getTime() === today.getTime();
      });

      const totalExtractions = todayExtractions.length;
      const extractionsWithCorrections = todayExtractions.filter(
        (e: any) => e.corrections_count > 0
      ).length;
      const successfulExtractions = totalExtractions - extractionsWithCorrections;

      // Calcular confianza promedio
      const avgConfidence =
        todayExtractions.reduce((sum: number, e: any) => sum + (e.confidence_score || 0), 0) /
        (totalExtractions || 1);

      // Calcular precisión por campo
      const accuracy = await MLModel.getExtractionAccuracy();
      const accuracyByField: any = {};
      accuracy.forEach((a: any) => {
        accuracyByField[a.field_name] = parseFloat(a.accuracy_percentage);
      });

      // Guardar métricas
      await MLModel.createOrUpdateMetric(today, {
        metric_date: today,
        total_extractions: totalExtractions,
        successful_extractions: successfulExtractions,
        corrections_needed: extractionsWithCorrections,
        average_confidence: parseFloat(avgConfidence.toFixed(2)),
        accuracy_by_field: accuracyByField,
      });

      return res.status(200).json({
        success: true,
        message: 'Métricas actualizadas',
        metrics: {
          date: today,
          totalExtractions,
          successfulExtractions,
          correctionsNeeded: extractionsWithCorrections,
          avgConfidence: avgConfidence.toFixed(2),
          accuracyByField,
        },
      });
    } catch (error: any) {
      console.error('Error actualizando métricas:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Reinicializar servicio de ML (recargar patrones)
   */
  static async reinicializarML(_req: Request, res: Response) {
    try {
      await MLService.initialize();

      return res.status(200).json({
        success: true,
        message: 'Servicio de ML reinicializado correctamente',
      });
    } catch (error: any) {
      console.error('Error reinicializando ML:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
