import { Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsappService';
import { OCRService } from '../services/ocrService';
import { FacturaModel } from '../models/facturaModel';
import { FacturacionService } from '../services/facturacionService';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env';
import { FacturaData } from '../types';

export class WhatsAppController {
  /**
   * Webhook para recibir mensajes de WhatsApp
   */
  static async webhook(req: Request, res: Response) {
    try {
      console.log('Mensaje de WhatsApp recibido:', req.body);

      const message = WhatsAppService.parseIncomingMessage(req.body);

      if (!message) {
        return res.status(400).json({ success: false, error: 'Formato de mensaje inválido' });
      }

      // Confirmar recepción immediately
      res.status(200).send('OK');

      // Procesar mensaje de forma asíncrona (no esperar respuesta)
      WhatsAppController.procesarMensaje(message).catch(error => {
        console.error('Error procesando mensaje:', error);
      });

      return; // Explicit return after async fire-and-forget
    } catch (error: any) {
      console.error('Error en webhook de WhatsApp:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Procesa mensaje de WhatsApp de forma asíncrona
   */
  private static async procesarMensaje(message: any) {
    try {
      const telefono = message.from;

      // Enviar confirmación de recepción
      await WhatsAppService.confirmarRecepcion(telefono);

      // Si hay imagen o PDF adjunto
      if (message.mediaUrl) {
        await WhatsAppController.procesarArchivo(message);
      } else {
        // Mensaje de texto - enviar instrucciones
        await WhatsAppService.sendMessage(
          telefono,
          'Para generar tu factura, por favor envía una foto de tu ticket o PDF.'
        );
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  }

  /**
   * Descarga y procesa archivo enviado por WhatsApp
   */
  private static async procesarArchivo(message: any) {
    const telefono = message.from;
    let filePath = '';

    try {
      // Descargar archivo
      const response = await axios.get(message.mediaUrl, {
        responseType: 'arraybuffer',
      });

      const extension = message.mediaContentType === 'application/pdf' ? 'pdf' : 'jpg';
      const filename = `whatsapp-${Date.now()}.${extension}`;
      filePath = path.join(config.upload.dir, filename);

      await fs.writeFile(filePath, response.data);

      // Procesar con OCR
      let ocrResult;
      if (extension === 'pdf') {
        ocrResult = await OCRService.processPDF(filePath);
      } else {
        ocrResult = await OCRService.processImage(filePath);
      }

      if (!ocrResult.data) {
        await WhatsAppService.notificarError(
          telefono,
          'No pudimos extraer los datos de tu ticket. Por favor, envía una imagen más clara.'
        );
        return;
      }

      // Guardar en base de datos
      const factura = await FacturaModel.create({
        rfc: ocrResult.data.rfc,
        fecha: new Date(ocrResult.data.fecha),
        importe_total: ocrResult.data.importeTotal,
        iva: ocrResult.data.iva,
        subtotal: ocrResult.data.subtotal,
        archivo_path: filePath,
        archivo_tipo: message.mediaContentType,
        status: 'pendiente',
        whatsapp_from: telefono,
      });

      // Generar factura automáticamente
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

        await WhatsAppService.notificarFacturaGenerada(
          telefono,
          factura.id!,
          factura.importe_total
        );
      } else {
        await FacturaModel.updateStatus(factura.id!, 'error', result.error);
        await WhatsAppService.notificarError(telefono, result.error || 'Error al generar factura');
      }
    } catch (error: any) {
      console.error('Error procesando archivo de WhatsApp:', error);
      await WhatsAppService.notificarError(telefono, 'Error procesando tu archivo');

      // Limpiar archivo si existe
      if (filePath) {
        await fs.unlink(filePath).catch(() => {});
      }
    }
  }

  /**
   * Endpoint de verificación para WhatsApp (usado por algunos proveedores)
   */
  static async verify(req: Request, res: Response) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      // Token de verificación - configurar en variables de entorno
      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto';

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('Webhook de WhatsApp verificado');
        return res.status(200).send(challenge);
      } else {
        return res.status(403).send('Token de verificación inválido');
      }
    } catch (error: any) {
      console.error('Error verificando webhook:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
