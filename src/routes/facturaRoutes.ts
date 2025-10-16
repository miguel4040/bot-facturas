import { Router } from 'express';
import { FacturaController } from '../controllers/facturaController';
import { upload } from '../middlewares/upload';
import { body } from 'express-validator';

const router = Router();

/**
 * @route   POST /api/facturas
 * @desc    Crear factura manualmente con datos
 * @access  Public
 */
router.post(
  '/',
  [
    body('rfc').notEmpty().withMessage('RFC es requerido'),
    body('fecha').notEmpty().withMessage('Fecha es requerida'),
    body('importeTotal').isNumeric().withMessage('Importe total debe ser numérico'),
  ],
  FacturaController.crearFactura
);

/**
 * @route   POST /api/facturas/ticket
 * @desc    Subir ticket/PDF y extraer datos
 * @access  Public
 */
router.post('/ticket', upload.single('archivo'), FacturaController.procesarTicket);

/**
 * @route   POST /api/facturas/:id/generar
 * @desc    Generar factura desde datos extraídos
 * @access  Public
 */
router.post('/:id/generar', FacturaController.generarDesdeTicket);

/**
 * @route   GET /api/facturas
 * @desc    Obtener todas las facturas
 * @access  Public
 */
router.get('/', FacturaController.obtenerFacturas);

/**
 * @route   GET /api/facturas/:id
 * @desc    Obtener una factura por ID
 * @access  Public
 */
router.get('/:id', FacturaController.obtenerFactura);

/**
 * @route   GET /api/facturas/rfc/:rfc
 * @desc    Obtener facturas por RFC
 * @access  Public
 */
router.get('/rfc/:rfc', FacturaController.obtenerFacturasPorRFC);

/**
 * @route   PUT /api/facturas/:id
 * @desc    Actualizar factura
 * @access  Public
 */
router.put('/:id', FacturaController.actualizarFactura);

export default router;
