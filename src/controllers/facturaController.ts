import { Request, Response } from 'express';
import { FacturaModel } from '../models/facturaModel';
import { OCRService } from '../services/ocrService';
import { FacturacionService } from '../services/facturacionService';
import { FacturaData } from '../types';
import { isValidRFC, isValidDate } from '../utils/validation';

export class FacturaController {
  /**
   * Crear factura manualmente con datos
   */
  static async crearFactura(req: Request, res: Response) {
    try {
      const { rfc, fecha, importeTotal, iva, subtotal, conceptos, formaPago, metodoPago } = req.body;

      // Validaciones
      if (!rfc || !isValidRFC(rfc)) {
        return res.status(400).json({ success: false, error: 'RFC inválido' });
      }

      if (!fecha || !isValidDate(fecha)) {
        return res.status(400).json({ success: false, error: 'Fecha inválida' });
      }

      if (!importeTotal || importeTotal <= 0) {
        return res.status(400).json({ success: false, error: 'Importe total inválido' });
      }

      // Crear factura en la base de datos
      const factura = await FacturaModel.create({
        rfc: rfc.toUpperCase(),
        fecha: new Date(fecha),
        importe_total: parseFloat(importeTotal),
        iva: parseFloat(iva || 0),
        subtotal: parseFloat(subtotal || 0),
        conceptos,
        forma_pago: formaPago,
        metodo_pago: metodoPago,
        status: 'pendiente',
      });

      // Intentar generar factura con el servicio externo
      const facturaData: FacturaData = {
        rfc: factura.rfc,
        fecha: factura.fecha.toISOString().split('T')[0],
        importeTotal: factura.importe_total,
        iva: factura.iva,
        subtotal: factura.subtotal,
        conceptos: factura.conceptos,
        formaPago: factura.forma_pago,
        metodoPago: factura.metodo_pago,
      };

      const result = await FacturacionService.generarFactura(facturaData);

      if (result.success && result.facturaId) {
        await FacturaModel.update(factura.id!, {
          status: 'procesada',
          factura_externa_id: result.facturaId,
        });

        return res.status(201).json({
          success: true,
          message: 'Factura creada y generada exitosamente',
          factura: { ...factura, factura_externa_id: result.facturaId, status: 'procesada' },
        });
      } else {
        await FacturaModel.updateStatus(factura.id!, 'error', result.error);

        return res.status(500).json({
          success: false,
          error: 'Factura guardada pero no se pudo generar en el sistema externo',
          details: result.error,
          factura,
        });
      }
    } catch (error: any) {
      console.error('Error creando factura:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Procesar ticket/PDF subido y extraer datos
   */
  static async procesarTicket(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No se proporcionó archivo' });
      }

      const filePath = req.file.path;
      const fileType = req.file.mimetype;

      console.log(`Procesando archivo: ${filePath} (${fileType})`);

      // Procesar según el tipo de archivo
      let ocrResult;
      if (fileType === 'application/pdf') {
        ocrResult = await OCRService.processPDF(filePath);
      } else {
        ocrResult = await OCRService.processImage(filePath);
      }

      if (!ocrResult.data) {
        return res.status(400).json({
          success: false,
          error: 'No se pudieron extraer datos de factura del archivo',
          text: ocrResult.text,
        });
      }

      // Validar fecha
      let fecha: Date;
      if (ocrResult.data.fecha && ocrResult.data.fecha !== '') {
        fecha = new Date(ocrResult.data.fecha);
        // Verificar que la fecha sea válida
        if (isNaN(fecha.getTime())) {
          fecha = new Date(); // Usar fecha actual como fallback
        }
      } else {
        fecha = new Date(); // Usar fecha actual si no se detectó
      }

      // Guardar en base de datos
      const factura = await FacturaModel.create({
        rfc: ocrResult.data.rfc || 'XAXX010101000',
        emisor: ocrResult.data.emisor || '',
        fecha: fecha,
        importe_total: ocrResult.data.importeTotal || 0,
        iva: ocrResult.data.iva || 0,
        subtotal: ocrResult.data.subtotal || 0,
        archivo_path: filePath,
        archivo_tipo: fileType,
        status: 'pendiente',
      });

      return res.status(201).json({
        success: true,
        message: 'Ticket procesado exitosamente',
        factura,
        extractedData: ocrResult.data,
        confidence: ocrResult.confidence,
        usedOpenAI: ocrResult.usedOpenAI || false,
      });
    } catch (error: any) {
      console.error('Error procesando ticket:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Generar factura desde datos extraídos
   */
  static async generarDesdeTicket(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const factura = await FacturaModel.findById(parseInt(id));

      if (!factura) {
        return res.status(404).json({ success: false, error: 'Factura no encontrada' });
      }

      if (factura.status === 'procesada') {
        return res.status(400).json({
          success: false,
          error: 'La factura ya fue procesada',
        });
      }

      const facturaData: FacturaData = {
        rfc: factura.rfc,
        fecha: factura.fecha.toISOString().split('T')[0],
        importeTotal: factura.importe_total,
        iva: factura.iva,
        subtotal: factura.subtotal,
        conceptos: factura.conceptos,
        formaPago: factura.forma_pago,
        metodoPago: factura.metodo_pago,
      };

      const result = await FacturacionService.generarFactura(facturaData);

      if (result.success && result.facturaId) {
        const updatedFactura = await FacturaModel.update(factura.id!, {
          status: 'procesada',
          factura_externa_id: result.facturaId,
        });

        return res.status(200).json({
          success: true,
          message: 'Factura generada exitosamente',
          factura: updatedFactura,
        });
      } else {
        await FacturaModel.updateStatus(factura.id!, 'error', result.error);

        return res.status(500).json({
          success: false,
          error: result.error || 'Error al generar factura',
        });
      }
    } catch (error: any) {
      console.error('Error generando factura:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtener todas las facturas
   */
  static async obtenerFacturas(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const facturas = await FacturaModel.findAll(limit, offset);

      return res.status(200).json({
        success: true,
        count: facturas.length,
        facturas,
      });
    } catch (error: any) {
      console.error('Error obteniendo facturas:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtener una factura por ID
   */
  static async obtenerFactura(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const factura = await FacturaModel.findById(parseInt(id));

      if (!factura) {
        return res.status(404).json({ success: false, error: 'Factura no encontrada' });
      }

      return res.status(200).json({ success: true, factura });
    } catch (error: any) {
      console.error('Error obteniendo factura:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtener facturas por RFC
   */
  static async obtenerFacturasPorRFC(req: Request, res: Response) {
    try {
      const { rfc } = req.params;

      if (!isValidRFC(rfc)) {
        return res.status(400).json({ success: false, error: 'RFC inválido' });
      }

      const facturas = await FacturaModel.findByRFC(rfc.toUpperCase());

      return res.status(200).json({
        success: true,
        count: facturas.length,
        facturas,
      });
    } catch (error: any) {
      console.error('Error obteniendo facturas por RFC:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Actualizar datos de factura
   */
  static async actualizarFactura(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const factura = await FacturaModel.update(parseInt(id), updates);

      if (!factura) {
        return res.status(404).json({ success: false, error: 'Factura no encontrada' });
      }

      return res.status(200).json({
        success: true,
        message: 'Factura actualizada exitosamente',
        factura,
      });
    } catch (error: any) {
      console.error('Error actualizando factura:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
