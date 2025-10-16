import axios from 'axios';
import { config } from '../config/env';
import { WhatsAppMessage } from '../types';

/**
 * Servicio para integración con WhatsApp
 * Actualmente configurado para Twilio, pero puede adaptarse a otros proveedores
 */
export class WhatsAppService {
  /**
   * Envía un mensaje de WhatsApp
   */
  static async sendMessage(to: string, body: string): Promise<boolean> {
    if (!config.whatsapp.enabled) {
      console.log('WhatsApp está deshabilitado');
      return false;
    }

    try {
      if (config.whatsapp.provider === 'twilio') {
        return await this.sendMessageTwilio(to, body);
      }

      console.error('Proveedor de WhatsApp no soportado:', config.whatsapp.provider);
      return false;
    } catch (error) {
      console.error('Error enviando mensaje de WhatsApp:', error);
      return false;
    }
  }

  /**
   * Envía mensaje usando Twilio
   */
  private static async sendMessageTwilio(to: string, body: string): Promise<boolean> {
    const accountSid = config.whatsapp.twilio.accountSid;
    const authToken = config.whatsapp.twilio.authToken;
    const from = config.whatsapp.twilio.whatsappNumber;

    if (!accountSid || !authToken || !from) {
      throw new Error('Credenciales de Twilio no configuradas');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append('From', from);
    params.append('To', `whatsapp:${to}`);
    params.append('Body', body);

    const response = await axios.post(url, params, {
      auth: {
        username: accountSid,
        password: authToken,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.status === 201;
  }

  /**
   * Procesa un mensaje entrante de WhatsApp (webhook)
   */
  static parseIncomingMessage(body: any): WhatsAppMessage | null {
    if (config.whatsapp.provider === 'twilio') {
      return this.parseTwilioMessage(body);
    }

    return null;
  }

  /**
   * Parsea mensaje de Twilio
   */
  private static parseTwilioMessage(body: any): WhatsAppMessage | null {
    try {
      return {
        from: body.From?.replace('whatsapp:', '') || '',
        body: body.Body || '',
        mediaUrl: body.MediaUrl0,
        mediaContentType: body.MediaContentType0,
      };
    } catch (error) {
      console.error('Error parseando mensaje de Twilio:', error);
      return null;
    }
  }

  /**
   * Envía notificación de factura generada
   */
  static async notificarFacturaGenerada(
    telefono: string,
    facturaId: number,
    total: number
  ): Promise<boolean> {
    const mensaje = `✅ Tu factura #${facturaId} ha sido generada exitosamente.\n\nTotal: $${total.toFixed(2)}\n\nPuedes descargarla desde nuestro portal.`;

    return await this.sendMessage(telefono, mensaje);
  }

  /**
   * Envía notificación de error
   */
  static async notificarError(telefono: string, error: string): Promise<boolean> {
    const mensaje = `❌ Hubo un error procesando tu solicitud:\n\n${error}\n\nPor favor, intenta de nuevo o contacta a soporte.`;

    return await this.sendMessage(telefono, mensaje);
  }

  /**
   * Envía mensaje de confirmación de recepción
   */
  static async confirmarRecepcion(telefono: string): Promise<boolean> {
    const mensaje = `📄 Hemos recibido tu ticket. Estamos procesándolo para generar tu factura. Te notificaremos cuando esté lista.`;

    return await this.sendMessage(telefono, mensaje);
  }
}
