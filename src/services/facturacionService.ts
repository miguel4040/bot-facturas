import * as soap from 'soap';
import { FacturaData, FacturacionAPIResponse } from '../types';
import { config } from '../config/env';

/**
 * Servicio para integración con FacturaCFDI.mx (SOAP)
 * Documentación: https://facturacfdi.mx/
 *
 * Soporta dos tipos de servicios:
 * - WSForcogsaService (con token) - Mayor seguridad, requiere autenticación previa
 * - WSTimbradoCFDIService (sin token) - Autenticación directa con usuario/password
 */

interface TokenCache {
  token: string;
  fechaExpiracion: Date;
}

export class FacturacionService {
  private static soapClient: any = null;
  private static tokenCache: TokenCache | null = null;

  /**
   * Obtiene o crea el cliente SOAP
   */
  private static async getClient(): Promise<any> {
    if (this.soapClient) {
      return this.soapClient;
    }

    try {
      const isDev = config.facturacion.environment === 'development';
      const useToken = config.facturacion.useToken;

      // Seleccionar WSDL según entorno y tipo
      let wsdlUrl: string;
      if (isDev) {
        wsdlUrl = useToken ? config.facturacion.wsdl.devToken : config.facturacion.wsdl.devSimple;
      } else {
        wsdlUrl = useToken ? config.facturacion.wsdl.prodToken : config.facturacion.wsdl.prodSimple;
      }

      console.log(`Conectando a FacturaCFDI [${isDev ? 'DEV' : 'PROD'}] [${useToken ? 'CON TOKEN' : 'SIN TOKEN'}]: ${wsdlUrl}`);

      this.soapClient = await soap.createClientAsync(wsdlUrl, {
        disableCache: true,
        endpoint: wsdlUrl.replace('?wsdl', ''),
      });

      return this.soapClient;
    } catch (error: any) {
      console.error('Error creando cliente SOAP:', error.message);
      throw new Error(`No se pudo conectar con FacturaCFDI: ${error.message}`);
    }
  }

  /**
   * Obtiene las credenciales según el entorno
   */
  private static getCredentials(): { user: string; password: string } {
    const isDev = config.facturacion.environment === 'development';
    return isDev ? config.facturacion.credentials.dev : config.facturacion.credentials.prod;
  }

  /**
   * Autentica y obtiene un token (solo para servicio con token)
   */
  private static async autenticar(): Promise<string> {
    // Si ya tenemos un token válido, usarlo
    if (this.tokenCache && this.tokenCache.fechaExpiracion > new Date()) {
      console.log('Usando token en caché');
      return this.tokenCache.token;
    }

    const client = await this.getClient();
    const credentials = this.getCredentials();

    console.log('Solicitando nuevo token...');

    const response = await client.AutenticarAsync({
      usuario: credentials.user,
      contrasena: credentials.password,
    });

    const result = response[0]?.return;

    if (!result || !result.token) {
      throw new Error('No se pudo obtener el token de autenticación');
    }

    // Guardar token en caché
    this.tokenCache = {
      token: result.token,
      fechaExpiracion: new Date(result.fechaExpiracion),
    };

    console.log(`Token obtenido, expira: ${result.fechaExpiracion}`);

    return result.token;
  }

  /**
   * Genera una factura (timbrado CFDI) usando FacturaCFDI
   *
   * @param data Datos de la factura
   * @param sellado Si el comprobante ya está sellado (true) o no (false)
   */
  static async generarFactura(data: FacturaData, sellado: boolean = false): Promise<FacturacionAPIResponse> {
    try {
      const client = await this.getClient();
      const credentials = this.getCredentials();

      // Validar credenciales
      if (!credentials.user || !credentials.password) {
        throw new Error('Credenciales de facturación no configuradas');
      }

      // Construir XML del comprobante (CFDI 4.0)
      const cfdiXml = this.buildCFDIXml(data, credentials);

      console.log('Enviando factura a FacturaCFDI para timbrado...');

      let response;
      let result;

      if (config.facturacion.useToken) {
        // ========== SERVICIO CON TOKEN (WSForcogsaService) ==========
        const token = await this.autenticar();

        if (sellado) {
          // Método 1: Timbrar (comprobante sellado)
          response = await client.TimbrarAsync({
            cfd: cfdiXml,
            token: token,
          });
        } else {
          // Método 2: TimbrarV2 (comprobante sin sellar)
          response = await client.TimbrarV2Async({
            cfdi: cfdiXml,
            token: token,
          });
        }

        result = response[0]?.return;

        // Verificar código de respuesta (0 = éxito)
        if (result && result.codigo === '0') {
          return this.parseSuccessResponse(result.cfdi);
        } else {
          throw new Error(`Error en timbrado: ${result?.mensaje || 'Error desconocido'}`);
        }
      } else {
        // ========== SERVICIO SIN TOKEN (WSTimbradoCFDIService) ==========
        const accesos = {
          usuario: credentials.user,
          password: credentials.password,
        };

        if (sellado) {
          // Método 1: TimbrarCFDI (comprobante sellado)
          response = await client.TimbrarCFDIAsync({
            accesos: accesos,
            comprobante: cfdiXml,
          });
        } else {
          // Método 2: TimbrarCFDIV2 (comprobante sin sellar)
          response = await client.TimbrarCFDIV2Async({
            accesos: accesos,
            comprobante: cfdiXml,
          });
        }

        result = response[0]?.acuseCFDI;

        // Verificar si hay xmlTimbrado en la respuesta
        if (result && result.xmlTimbrado) {
          return this.parseSuccessResponse(result.xmlTimbrado);
        } else {
          throw new Error(`Error en timbrado: ${result?.mensaje || 'No se recibió XML timbrado'}`);
        }
      }
    } catch (error: any) {
      console.error('Error al generar factura:', error.message);

      return {
        success: false,
        error: error.message || 'Error al generar factura',
      };
    }
  }

  /**
   * Parsea la respuesta exitosa del timbrado
   */
  private static parseSuccessResponse(xmlTimbrado: string): FacturacionAPIResponse {
    try {
      // Extraer UUID del TimbreFiscalDigital
      const uuidMatch = xmlTimbrado.match(/UUID="([^"]+)"/);
      const uuid = uuidMatch ? uuidMatch[1] : undefined;

      // Extraer FechaTimbrado
      const fechaMatch = xmlTimbrado.match(/FechaTimbrado="([^"]+)"/);
      const fechaTimbrado = fechaMatch ? fechaMatch[1] : undefined;

      // Extraer SelloCFD (cadena original del sello)
      const selloMatch = xmlTimbrado.match(/SelloCFD="([^"]+)"/);
      const cadenaOriginal = selloMatch ? selloMatch[1] : undefined;

      return {
        success: true,
        facturaId: uuid,
        uuid: uuid,
        message: 'Factura timbrada exitosamente',
        xml: xmlTimbrado,
        fechaTimbrado: fechaTimbrado,
        cadenaOriginal: cadenaOriginal,
      };
    } catch (error: any) {
      console.error('Error parseando respuesta:', error.message);
      return {
        success: true,
        message: 'Factura timbrada exitosamente',
        xml: xmlTimbrado,
      };
    }
  }

  /**
   * Consulta el estado de una factura timbrada
   * NOTA: Este método puede no estar disponible en todos los servicios
   */
  static async consultarFactura(uuid: string): Promise<FacturacionAPIResponse> {
    try {
      const client = await this.getClient();
      const credentials = this.getCredentials();

      let response;

      if (config.facturacion.useToken) {
        const token = await this.autenticar();
        response = await client.ConsultarCFDIAsync({
          uuid: uuid,
          token: token,
        });
      } else {
        response = await client.ConsultarCFDIAsync({
          accesos: {
            usuario: credentials.user,
            password: credentials.password,
          },
          uuid: uuid,
        });
      }

      const result = response[0]?.return || response[0];

      if (result && (result.codigo === '0' || result.xmlTimbrado)) {
        return {
          success: true,
          facturaId: uuid,
          uuid: uuid,
          message: 'Factura consultada exitosamente',
          xml: result.cfdi || result.xmlTimbrado,
          estado: result.estado || 'Vigente',
        };
      } else {
        throw new Error(`Error en consulta: ${result?.mensaje || 'Error desconocido'}`);
      }
    } catch (error: any) {
      console.error('Error al consultar factura:', error.message);

      return {
        success: false,
        error: error.message || 'Error al consultar factura',
      };
    }
  }

  /**
   * Cancela una factura timbrada
   * NOTA: Este método puede no estar disponible en todos los servicios
   */
  static async cancelarFactura(uuid: string, motivo?: string): Promise<FacturacionAPIResponse> {
    try {
      const client = await this.getClient();
      const credentials = this.getCredentials();

      // Motivos de cancelación según el SAT:
      // 01 - Comprobante emitido con errores con relación
      // 02 - Comprobante emitido con errores sin relación (default)
      // 03 - No se llevó a cabo la operación
      // 04 - Operación nominativa relacionada en una factura global
      const motivoCancelacion = motivo || '02';

      let response;

      if (config.facturacion.useToken) {
        const token = await this.autenticar();
        response = await client.CancelarCFDIAsync({
          uuid: uuid,
          motivo: motivoCancelacion,
          token: token,
        });
      } else {
        response = await client.CancelarCFDIAsync({
          accesos: {
            usuario: credentials.user,
            password: credentials.password,
          },
          uuid: uuid,
          motivo: motivoCancelacion,
        });
      }

      const result = response[0]?.return || response[0];

      if (result && result.codigo === '0') {
        return {
          success: true,
          facturaId: uuid,
          uuid: uuid,
          message: 'Factura cancelada exitosamente',
          acuseCancelacion: result.acuse,
        };
      } else {
        throw new Error(`Error en cancelación: ${result?.mensaje || 'Error desconocido'}`);
      }
    } catch (error: any) {
      console.error('Error al cancelar factura:', error.message);

      return {
        success: false,
        error: error.message || 'Error al cancelar factura',
      };
    }
  }

  /**
   * Construye el XML del CFDI (Comprobante Fiscal Digital por Internet)
   *
   * IMPORTANTE: Esta es una versión simplificada para CFDI 4.0
   * En producción, deberías:
   * 1. Obtener tu Certificado de Sello Digital (CSD) del SAT
   * 2. Usar una librería especializada como @sat-cfdi/cfdi-core
   * 3. Incluir el sello digital del comprobante (Certificado y Sello)
   * 4. Validar contra el esquema XSD del SAT
   */
  private static buildCFDIXml(data: FacturaData, credentials: { user: string; password: string }): string {
    const fecha = new Date().toISOString().split('.')[0]; // Formato: 2024-01-15T10:30:00

    // IMPORTANTE: Este es un ejemplo básico para CFDI 4.0
    // Para producción necesitas incluir Certificado y Sello
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante
  xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"
  Version="4.0"
  Fecha="${fecha}"
  FormaPago="${data.formaPago || '99'}"
  SubTotal="${data.subtotal.toFixed(2)}"
  Total="${data.importeTotal.toFixed(2)}"
  TipoDeComprobante="I"
  MetodoPago="${data.metodoPago || 'PUE'}"
  LugarExpedicion="00000"
  Exportacion="01"
  Moneda="MXN">

  <cfdi:Emisor
    Rfc="${credentials.user}"
    Nombre="Emisor de Prueba"
    RegimenFiscal="601"/>

  <cfdi:Receptor
    Rfc="${data.rfc}"
    Nombre="Receptor"
    DomicilioFiscalReceptor="00000"
    RegimenFiscalReceptor="616"
    UsoCFDI="G01"/>

  <cfdi:Conceptos>
    <cfdi:Concepto
      ClaveProdServ="01010101"
      Cantidad="1"
      ClaveUnidad="ACT"
      Descripcion="${data.conceptos || 'Producto o servicio'}"
      ValorUnitario="${data.subtotal.toFixed(2)}"
      Importe="${data.subtotal.toFixed(2)}"
      ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado
            Base="${data.subtotal.toFixed(2)}"
            Impuesto="002"
            TipoFactor="Tasa"
            TasaOCuota="0.160000"
            Importe="${data.iva.toFixed(2)}"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>

  <cfdi:Impuestos TotalImpuestosTrasladados="${data.iva.toFixed(2)}">
    <cfdi:Traslados>
      <cfdi:Traslado
        Base="${data.subtotal.toFixed(2)}"
        Impuesto="002"
        TipoFactor="Tasa"
        TasaOCuota="0.160000"
        Importe="${data.iva.toFixed(2)}"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
</cfdi:Comprobante>`;

    return xml;
  }

  /**
   * Valida las credenciales de la API
   */
  static async validarCredenciales(): Promise<boolean> {
    try {
      await this.getClient(); // Validate SOAP connection
      const credentials = this.getCredentials();

      if (!credentials.user || !credentials.password) {
        return false;
      }

      // Si usa token, intentar autenticar
      if (config.facturacion.useToken) {
        await this.autenticar();
      }

      return true;
    } catch (error) {
      console.error('Error validando credenciales:', error);
      return false;
    }
  }

  /**
   * Obtiene información del proveedor de timbrado
   */
  static async obtenerInfoProveedor(): Promise<any> {
    try {
      const client = await this.getClient();

      // Obtener métodos disponibles del servicio SOAP
      const descripcion = client.describe();
      const servicios = Object.keys(descripcion);
      const primerServicio = servicios[0];
      const metodos = descripcion[primerServicio]
        ? Object.keys(descripcion[primerServicio])
        : [];

      return {
        success: true,
        servicios: servicios,
        metodos: metodos,
        endpoint: client.wsdl.uri,
        usaToken: config.facturacion.useToken,
        ambiente: config.facturacion.environment,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Limpia el token en caché (forzar nueva autenticación)
   */
  static limpiarTokenCache(): void {
    this.tokenCache = null;
    console.log('Token cache limpiado');
  }
}
