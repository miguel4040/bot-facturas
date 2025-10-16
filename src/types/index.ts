export interface FacturaData {
  rfc: string;
  fecha: string;
  importeTotal: number;
  iva: number;
  subtotal: number;
  emisor?: string;  // Nombre del proveedor/empresa emisora
  conceptos?: string;
  formaPago?: string;
  metodoPago?: string;
}

export interface FacturaExtracted extends FacturaData {
  confidence: number;
  rawText?: string;
}

export interface Factura {
  id?: number;
  rfc: string;
  fecha: Date;
  importe_total: number;
  iva: number;
  subtotal: number;
  emisor?: string;  // Nombre del proveedor/empresa emisora
  conceptos?: string;
  forma_pago?: string;
  metodo_pago?: string;
  archivo_path?: string;
  archivo_tipo?: string;
  status: 'pendiente' | 'procesada' | 'error' | 'enviada';
  factura_externa_id?: string;
  error_message?: string;
  whatsapp_from?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface OCRResult {
  text: string;
  confidence: number;
  data?: FacturaExtracted;
  usedOpenAI?: boolean;  // Indica si se usó OpenAI para mejorar la extracción
}

export interface FacturacionAPIResponse {
  success: boolean;
  facturaId?: string;
  message?: string;
  error?: string;
  xml?: string;
  pdf?: string;
  uuid?: string;
  fechaTimbrado?: string;
  cadenaOriginal?: string;
  acuseCancelacion?: string;
  estado?: string;
}

export interface WhatsAppMessage {
  from: string;
  body: string;
  mediaUrl?: string;
  mediaContentType?: string;
}
