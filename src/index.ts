import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env';
import pool from './config/database';
import facturaRoutes from './routes/facturaRoutes';
import whatsappRoutes from './routes/whatsappRoutes';
import mlRoutes from './routes/mlRoutes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { MLService } from './services/mlService';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.get('/', (_req, res) => {
  res.json({
    name: 'Bot Facturas API',
    version: '1.0.0',
    features: ['OCR', 'Machine Learning', 'WhatsApp Integration'],
    endpoints: {
      facturas: '/api/facturas',
      whatsapp: '/api/whatsapp',
      ml: '/api/ml',
      health: '/health',
    },
  });
});

app.use('/api/facturas', facturaRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/ml', mlRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection test
pool.query('SELECT NOW()', (err, _result) => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
  } else {
    console.log('Conectado a PostgreSQL exitosamente');
  }
});

// Inicializar servicio de ML
MLService.initialize().catch((error) => {
  console.error('Error inicializando servicio de ML:', error);
});

// Start server
const PORT = config.server.port;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║       Bot Facturas API con Machine Learning           ║
║                                                       ║
║  Servidor iniciado en puerto: ${PORT}                    ║
║  Ambiente: ${config.server.nodeEnv}                          ║
║                                                       ║
║  Endpoints Facturas:                                  ║
║  - POST /api/facturas                                 ║
║  - POST /api/facturas/ticket                          ║
║  - POST /api/facturas/:id/generar                     ║
║  - GET  /api/facturas                                 ║
║                                                       ║
║  Endpoints Machine Learning:                          ║
║  - POST /api/ml/facturas/:id/correcciones             ║
║  - GET  /api/ml/metricas                              ║
║  - GET  /api/ml/correcciones                          ║
║  - GET  /api/ml/patrones                              ║
║                                                       ║
║  Endpoints WhatsApp:                                  ║
║  - POST /api/whatsapp/webhook                         ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

export default app;
