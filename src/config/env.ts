import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'facturas_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
  facturacion: {
    environment: process.env.FACTURACION_ENVIRONMENT || 'development',
    wsdl: {
      devToken: process.env.FACTURACION_WSDL_DEV_TOKEN || 'https://dev33.facturacfdi.mx/WSForcogsaService?wsdl',
      prodToken: process.env.FACTURACION_WSDL_PROD_TOKEN || 'https://v33.facturacfdi.mx/WSForcogsaService?wsdl',
      devSimple: process.env.FACTURACION_WSDL_DEV_SIMPLE || 'https://dev33.facturacfdi.mx/WSTimbradoCFDIService?wsdl',
      prodSimple: process.env.FACTURACION_WSDL_PROD_SIMPLE || 'https://v33.facturacfdi.mx/WSTimbradoCFDIService?wsdl',
    },
    credentials: {
      dev: {
        user: process.env.FACTURACION_USER_DEV || 'pruebasWS',
        password: process.env.FACTURACION_PASSWORD_DEV || 'pruebasWS',
      },
      prod: {
        user: process.env.FACTURACION_USER_PROD || '',
        password: process.env.FACTURACION_PASSWORD_PROD || '',
      },
    },
    useToken: process.env.FACTURACION_USE_TOKEN === 'true',
    timeout: parseInt(process.env.FACTURACION_TIMEOUT || '30000'),
  },
  whatsapp: {
    enabled: process.env.WHATSAPP_ENABLED === 'true',
    provider: process.env.WHATSAPP_PROVIDER || 'twilio',
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
    },
  },
  ocr: {
    language: process.env.OCR_LANGUAGE || 'spa',
    confidenceThreshold: parseInt(process.env.OCR_CONFIDENCE_THRESHOLD || '60'),
  },
  openai: {
    enabled: process.env.OPENAI_ENABLED === 'true',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    confidenceThreshold: parseInt(process.env.OPENAI_CONFIDENCE_THRESHOLD || '75'),
  },
};
