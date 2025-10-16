import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsappController';

const router = Router();

/**
 * @route   POST /api/whatsapp/webhook
 * @desc    Webhook para recibir mensajes de WhatsApp
 * @access  Public (pero debe ser validado por el proveedor)
 */
router.post('/webhook', WhatsAppController.webhook);

/**
 * @route   GET /api/whatsapp/webhook
 * @desc    Verificación del webhook (usado por algunos proveedores)
 * @access  Public
 */
router.get('/webhook', WhatsAppController.verify);

export default router;
