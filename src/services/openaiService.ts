import OpenAI from 'openai';
import { config } from '../config/env';
import { FacturaExtracted } from '../types';

export class OpenAIService {
  private static client: OpenAI | null = null;

  /**
   * Inicializa el cliente de OpenAI
   */
  private static getClient(): OpenAI | null {
    if (!config.openai.enabled || !config.openai.apiKey) {
      return null;
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: config.openai.apiKey,
      });
    }

    return this.client;
  }

  /**
   * Verifica si OpenAI está habilitado y configurado
   */
  static isEnabled(): boolean {
    return config.openai.enabled && !!config.openai.apiKey;
  }

  /**
   * Extrae datos de factura usando ChatGPT
   * Se usa como fallback cuando OCR/ML tiene baja confianza
   */
  static async extractFacturaData(text: string): Promise<FacturaExtracted | null> {
    const client = this.getClient();

    if (!client) {
      console.log('OpenAI no está habilitado o configurado');
      return null;
    }

    try {
      console.log('Usando ChatGPT para mejorar extracción de datos...');

      const prompt = this.buildExtractionPrompt(text);

      const completion = await client.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en extracción de datos de tickets y facturas mexicanas. Tu trabajo es extraer información estructurada de tickets de compra. Siempre respondes en formato JSON válido.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1, // Baja temperatura para respuestas más deterministas
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        console.error('No se recibió respuesta de OpenAI');
        return null;
      }

      // Parsear respuesta JSON
      const extractedData = JSON.parse(responseContent);

      // Validar y normalizar datos
      const normalized = this.normalizeExtractedData(extractedData);

      if (!normalized) {
        console.error('Datos extraídos por OpenAI no son válidos');
        return null;
      }

      console.log('Extracción con ChatGPT exitosa:', normalized);

      return {
        ...normalized,
        confidence: 95, // Alta confianza en ChatGPT
        rawText: text,
      };
    } catch (error: any) {
      console.error('Error al usar OpenAI para extracción:', error.message);
      return null;
    }
  }

  /**
   * Extrae datos de factura usando GPT-4 Vision (analiza la imagen directamente)
   * Útil cuando el OCR falla o produce texto de mala calidad
   */
  static async extractFromImage(imagePath: string): Promise<FacturaExtracted | null> {
    const client = this.getClient();

    if (!client) {
      console.log('OpenAI no está habilitado o configurado');
      return null;
    }

    try {
      console.log('Usando GPT-4 Vision para analizar imagen directamente...');

      // Leer imagen y convertirla a base64
      const fs = await import('fs/promises');
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Determinar tipo de imagen
      const ext = imagePath.toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext.endsWith('.png')) mimeType = 'image/png';
      else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (ext.endsWith('.webp')) mimeType = 'image/webp';

      const completion = await client.chat.completions.create({
        model: 'gpt-4o',  // Usar GPT-4o que tiene Vision
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en extracción de datos de tickets y facturas mexicanas. Analizas imágenes de tickets y extraes información estructurada. Siempre respondes en formato JSON válido.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.buildVisionExtractionPrompt(),
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high', // Alta resolución para mejor lectura
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
        max_tokens: 1000,
      });

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        console.error('No se recibió respuesta de OpenAI Vision');
        return null;
      }

      // Parsear respuesta JSON
      const extractedData = JSON.parse(responseContent);

      // Validar y normalizar datos
      const normalized = this.normalizeExtractedData(extractedData);

      if (!normalized) {
        console.error('Datos extraídos por OpenAI Vision no son válidos');
        return null;
      }

      console.log('Extracción con GPT-4 Vision exitosa:', normalized);

      return {
        ...normalized,
        confidence: 98, // Muy alta confianza en Vision
        rawText: 'Extraído directamente de imagen con GPT-4 Vision',
      };
    } catch (error: any) {
      console.error('Error al usar OpenAI Vision para extracción:', error.message);
      return null;
    }
  }

  /**
   * Construye el prompt para extracción con Vision API
   */
  private static buildVisionExtractionPrompt(): string {
    return `
Analiza esta imagen de un ticket o factura mexicana y extrae la siguiente información:

1. **RFC**: Registro Federal de Contribuyentes del EMISOR (empresa que emite el ticket)
   - Formato: 3-4 letras + FECHA(AAMMDD) + 3 caracteres alfanuméricos
   - Los 6 dígitos del medio DEBEN ser una fecha válida (Año/Mes/Día)
   - Ejemplo: BAZX060710BSA (BAZX + 060710 + BSA, fecha: 10/Jul/2006)
   - Ejemplo: CFE370814QI0 (CFE + 370814 + QI0, fecha: 14/Ago/1937)
   - Busca cerca de: "RFC:", "R.F.C.", etc.
   - IMPORTANTE: Valida que el mes esté entre 01-12 y el día entre 01-31
   
2. **Emisor**: Nombre completo de la empresa o comercio que emite el ticket
   - Ejemplo: "Helados Dolphy", "OXXO", "Comisión Federal de Electricidad"
   - Generalmente aparece en la parte superior del ticket
   
3. **Fecha**: Fecha de emisión del ticket
   - Convierte a formato YYYY-MM-DD
   - Ejemplo: si ves "17/10/2025" devuelve "2025-10-17"
   
4. **Número de Ticket**: Número de folio o ticket (si existe)
   
5. **Conceptos/Productos**: Lista de productos o servicios (descripción breve)
   - Si hay múltiples productos, separa con comas
   
6. **Importe Total**: El total a pagar (número decimal)
   - Busca cerca de: "TOTAL", "TOTAL A PAGAR", "IMPORTE TOTAL"
   
7. **IVA**: Impuesto al Valor Agregado (número decimal)
   - Si no aparece explícitamente y el total es 38, calcula: IVA = Total - Subtotal
   - Si no hay IVA, deja en 0
   
8. **Subtotal**: Subtotal antes de impuestos (número decimal)
   - Si no aparece explícitamente pero tienes Total e IVA, calcula: Subtotal = Total - IVA
   
9. **Forma de Pago**: Cómo se pagó (EFECTIVO, TARJETA, etc.)

10. **Dirección del Emisor**: Dirección completa si está visible

IMPORTANTE:
- Lee con MUCHO cuidado todos los números
- El RFC DEBE ser del EMISOR (quien emite el ticket), NO del cliente
- Si el ticket es de helados, comida, o productos sin IVA, el IVA puede ser 0
- Algunos tickets pequeños no tienen RFC visible, en ese caso déjalo como null

Responde SOLO con un objeto JSON con esta estructura exacta:
{
  "rfc": "string o null",
  "emisor": "string o null",
  "fecha": "string en formato YYYY-MM-DD o null",
  "numeroTicket": "string o null",
  "conceptos": "string describiendo productos/servicios o null",
  "importeTotal": número o 0,
  "iva": número o 0,
  "subtotal": número o 0,
  "formaPago": "string o null",
  "direccionEmisor": "string o null"
}
`.trim();
  }

  /**
   * Construye el prompt para extracción de datos
   */
  private static buildExtractionPrompt(text: string): string {
    return `
Analiza el siguiente texto extraído de un ticket o factura mexicana y extrae la siguiente información.
Si no encuentras algún dato, déjalo como null o cadena vacía.

TEXTO DEL TICKET:
"""
${text}
"""

Debes extraer:
1. RFC: Registro Federal de Contribuyentes (formato mexicano: AAA010101XXX o AAAA010101XXX)
   - Busca específicamente después de la palabra "RFC" o "RFC:" (puede aparecer como "R F C", "R.F.C.", "REC", etc. por errores de OCR)
   - Formato exacto: 3-4 letras mayúsculas + FECHA (AAMMDD) + 3 caracteres alfanuméricos
   - Los 6 dígitos del medio DEBEN ser una fecha válida en formato AAMMDD (Año/Mes/Día)
   - Ejemplo correcto: CFE370814QI0 (CFE + 370814 + QI0, fecha: 14/Ago/1937)
   - Ejemplo correcto: BAZX060710BSA (BAZX + 060710 + BSA, fecha: 10/Jul/2006)
   - IMPORTANTE: El OCR puede tener errores comunes:
     * Letras confundidas con números: Q↔0, I↔1, O↔0, S↔5, B↔8
     * Si encuentras "CFE-370814-010" o "CFE370814010", el correcto es CFE370814QI0
     * Si encuentras "NE JUAR" o texto incoherente después de RFC, busca en todo el texto
     * Los últimos 3 caracteres de CFE deben ser "QI0" (Q-I-cero), no "010" (cero-uno-cero)
   - Para COMISION FEDERAL DE ELECTRICIDAD o CFE, el RFC correcto es: CFE370814QI0
2. Emisor: Nombre de la empresa o proveedor que emite el ticket/factura
   - Busca nombres de empresas como "COMISION FEDERAL DE ELECTRICIDAD", "CFE", "OXXO", "WALMART", etc.
   - Generalmente aparece en la parte superior del ticket
   - Si encuentras siglas o abreviaturas comunes (CFE = Comisión Federal de Electricidad), usa el nombre completo si está en el texto
3. Fecha: Fecha de emisión (formato YYYY-MM-DD)
   - Busca cerca de palabras como "FECHA:", "FECHA DE PAGO", "COMPROBANTE", etc.
   - Formatos comunes: DD-MMM-YYYY (ejemplo: 30-SEP-2025), DD/MM/YYYY, DD-MM-YYYY
4. Importe Total: Monto total a pagar (solo número)
   - Busca cerca de: "TOTAL", "GRAN TOTAL", "CARGO A TARJETA", "IMPORTE TOTAL", "TOTAL A PAGAR"
   - Puede aparecer como: $1,842.0, 1842.00, -$1,842.0, etc.
5. IVA: Impuesto al Valor Agregado (solo número)
   - Busca cerca de "IVA", "I.V.A.", "IMPUESTO"
6. Subtotal: Subtotal antes de impuestos (solo número)
   - Busca cerca de "SUBTOTAL", "ENERGIA", "IMPORTE"

IMPORTANTE:
- El RFC DEBE estar en el texto explícitamente después de "RFC" o "RFC:"
- El Emisor es el NOMBRE DE LA EMPRESA que emite el comprobante, NO el nombre del cliente
- Las fechas deben convertirse a formato YYYY-MM-DD (si encuentras 30-SEP-2025, devuelve "2025-09-30")
- Los montos deben ser números decimales positivos (ejemplo: 1842.0, no -1842.0)
- Ignora paréntesis, signos negativos o símbolos de moneda en los importes
- Si el subtotal + IVA no es igual al total, intenta calcular el valor faltante
- IVA en México es típicamente 16% del subtotal

Responde SOLO con un objeto JSON con esta estructura exacta:
{
  "rfc": "string o null",
  "emisor": "string o null",
  "fecha": "string en formato YYYY-MM-DD o null",
  "importeTotal": número o 0,
  "iva": número o 0,
  "subtotal": número o 0,
  "encontrado": {
    "rfc": boolean,
    "emisor": boolean,
    "fecha": boolean,
    "importeTotal": boolean,
    "iva": boolean,
    "subtotal": boolean
  }
}
`.trim();
  }

  /**
   * Diccionario de RFCs conocidos por emisor
   */
  private static readonly KNOWN_RFCS: { [key: string]: string } = {
    'CFE': 'CFE370814QI0',
    'COMISION FEDERAL DE ELECTRICIDAD': 'CFE370814QI0',
    'OXXO': 'OMA830818IW1',
    'WALMART': 'WNM9709244W4',
    'SORIANA': 'SON040729U82',
    'TELCEL': 'RTC9201074Y1',
    'TELMEX': 'TTE150812JNA',
  };

  /**
   * Busca el RFC conocido según el emisor
   */
  private static getRFCByEmisor(emisor: string): string {
    if (!emisor) return '';

    const emisorUpper = emisor.toUpperCase();

    // Buscar coincidencia exacta
    if (this.KNOWN_RFCS[emisorUpper]) {
      return this.KNOWN_RFCS[emisorUpper];
    }

    // Buscar coincidencia parcial
    for (const [key, rfc] of Object.entries(this.KNOWN_RFCS)) {
      if (emisorUpper.includes(key)) {
        return rfc;
      }
    }

    return '';
  }

  /**
   * Corrige errores comunes de OCR en RFCs
   */
  private static fixCommonRFCErrors(rfc: string, emisor: string): string {
    if (!rfc) return '';

    // Para CFE, corregir errores comunes
    if (emisor && emisor.toUpperCase().includes('CFE')) {
      // Si el RFC comienza con CFE370814 pero tiene errores al final
      if (rfc.match(/^CFE370814[0-9]{3}$/i)) {
        // Casos comunes de confusión:
        // 010 → QI0 (cero-uno-cero se confunde con Q-I-cero)
        // 0I0 → QI0
        // Q10 → QI0
        // etc.
        const lastThree = rfc.substring(9, 12);
        if (['010', '0I0', 'Q10', 'OI0', 'O1O', '01O'].includes(lastThree.toUpperCase())) {
          console.log(`Corrigiendo RFC de CFE: ${rfc} → CFE370814QI0`);
          return 'CFE370814QI0';
        }
      }
    }

    return rfc;
  }

  /**
   * Normaliza y valida datos extraídos por OpenAI
   */
  private static normalizeExtractedData(data: any): FacturaExtracted | null {
    try {
      // Validar que tengamos al menos RFC o total o emisor
      if (!data.rfc && !data.importeTotal && !data.emisor) {
        return null;
      }

      let rfc = data.rfc || '';
      const emisor = data.emisor || '';
      const fecha = data.fecha || '';
      let importeTotal = parseFloat(data.importeTotal) || 0;
      let iva = parseFloat(data.iva) || 0;
      let subtotal = parseFloat(data.subtotal) || 0;

      // Corregir errores comunes de OCR en el RFC
      if (rfc) {
        rfc = this.fixCommonRFCErrors(rfc, emisor);
      }

      // Si no hay RFC pero tenemos emisor, buscar en diccionario de RFCs conocidos
      if (!rfc && emisor) {
        const knownRFC = this.getRFCByEmisor(emisor);
        if (knownRFC) {
          console.log(`RFC no encontrado, usando RFC conocido para ${emisor}: ${knownRFC}`);
          rfc = knownRFC;
        }
      }

      // Validar RFC formato mexicano (con fecha válida AAMMDD)
      const rfcRegex = /^([A-Z,Ñ,&]{3,4}([0-9]{2})(0[1-9]|1[0-2])(0[1-9]|1[0-9]|2[0-9]|3[0-1])[A-Z|\d]{3})$/;
      if (rfc && !rfcRegex.test(rfc.toUpperCase())) {
        console.warn('RFC con formato inválido detectado por OpenAI:', rfc);
      }

      // Calcular valores faltantes si es posible
      if (importeTotal > 0 && subtotal > 0 && iva === 0) {
        iva = importeTotal - subtotal;
      }

      if (importeTotal > 0 && iva > 0 && subtotal === 0) {
        subtotal = importeTotal - iva;
      }

      if (subtotal > 0 && iva > 0 && importeTotal === 0) {
        importeTotal = subtotal + iva;
      }

      // Si solo tenemos total sin subtotal/IVA, asumir que no hay IVA
      if (importeTotal > 0 && subtotal === 0 && iva === 0) {
        subtotal = importeTotal;
        iva = 0;
      }

      // Validar coherencia numérica
      if (importeTotal > 0 && subtotal > 0 && iva >= 0) {
        const diff = Math.abs((subtotal + iva) - importeTotal);
        if (diff > importeTotal * 0.01) {
          // Más del 1% de diferencia
          console.warn('Inconsistencia numérica detectada por OpenAI:', {
            subtotal,
            iva,
            importeTotal,
            diff,
          });
        }
      }

      console.log('Datos extraídos por OpenAI:', {
        rfc: rfc.toUpperCase(),
        emisor,
        fecha,
        importeTotal,
        iva,
        subtotal,
      });

      return {
        rfc: rfc.toUpperCase(),
        emisor: emisor,
        fecha: fecha,
        importeTotal,
        iva,
        subtotal,
        confidence: 95,
      };
    } catch (error) {
      console.error('Error normalizando datos de OpenAI:', error);
      return null;
    }
  }

  /**
   * Mejora datos extraídos por OCR/ML usando OpenAI
   * Útil cuando algunos campos tienen baja confianza
   */
  static async improveExtraction(
    originalText: string,
    extractedData: FacturaExtracted
  ): Promise<FacturaExtracted | null> {
    const client = this.getClient();

    if (!client) {
      return null;
    }

    try {
      console.log('Usando ChatGPT para mejorar datos extraídos...');

      const prompt = `
Analiza el siguiente texto de un ticket y verifica/corrige los datos que ya fueron extraídos.

TEXTO ORIGINAL:
"""
${originalText}
"""

DATOS EXTRAÍDOS (posiblemente con errores):
${JSON.stringify(extractedData, null, 2)}

Tu tarea:
1. Verifica si el RFC extraído es correcto según el formato mexicano
2. Verifica si la fecha tiene sentido
3. Verifica si los montos (total, IVA, subtotal) son coherentes
4. Corrige cualquier error que encuentres

Responde con un objeto JSON con los datos corregidos:
{
  "rfc": "RFC corregido",
  "fecha": "fecha en formato YYYY-MM-DD",
  "importeTotal": número,
  "iva": número,
  "subtotal": número,
  "cambiosRealizados": ["lista de campos que corregiste"]
}
`.trim();

      const completion = await client.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en validación y corrección de datos de facturas mexicanas.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        return null;
      }

      const improvedData = JSON.parse(responseContent);

      console.log('Mejoras realizadas por ChatGPT:', improvedData.cambiosRealizados);

      return {
        rfc: improvedData.rfc || extractedData.rfc,
        fecha: improvedData.fecha || extractedData.fecha,
        importeTotal: parseFloat(improvedData.importeTotal) || extractedData.importeTotal,
        iva: parseFloat(improvedData.iva) || extractedData.iva,
        subtotal: parseFloat(improvedData.subtotal) || extractedData.subtotal,
        confidence: 95,
        rawText: originalText,
      };
    } catch (error: any) {
      console.error('Error al mejorar extracción con OpenAI:', error.message);
      return null;
    }
  }

  /**
   * Valida si un texto parece ser un ticket o factura
   */
  static async validateTicket(text: string): Promise<{ isValid: boolean; reason: string }> {
    const client = this.getClient();

    if (!client) {
      return { isValid: true, reason: 'OpenAI no disponible' };
    }

    try {
      const completion = await client.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'Determina si un texto parece ser un ticket o factura válida.',
          },
          {
            role: 'user',
            content: `¿Este texto parece ser un ticket o factura? Responde en JSON:\n\n${text.substring(0, 500)}`,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return {
        isValid: result.isValid !== false,
        reason: result.reason || 'Validado por OpenAI',
      };
    } catch (error) {
      return { isValid: true, reason: 'Error en validación' };
    }
  }
}
