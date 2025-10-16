import { Router } from 'express';
import { MLController } from '../controllers/mlController';
import { body } from 'express-validator';

const router = Router();

/**
 * @route   POST /api/ml/facturas/:facturaId/correcciones
 * @desc    Registrar correcciones para mejorar el modelo
 * @access  Public
 */
router.post(
  '/facturas/:facturaId/correcciones',
  [
    body('corrections').isArray().withMessage('corrections debe ser un array'),
  ],
  MLController.registrarCorreccion
);

/**
 * @route   GET /api/ml/metricas
 * @desc    Obtener métricas de rendimiento del ML
 * @access  Public
 */
router.get('/metricas', MLController.obtenerMetricas);

/**
 * @route   GET /api/ml/correcciones
 * @desc    Obtener historial de correcciones
 * @access  Public
 */
router.get('/correcciones', MLController.obtenerCorrecciones);

/**
 * @route   GET /api/ml/facturas/:facturaId/correcciones
 * @desc    Obtener correcciones de una factura específica
 * @access  Public
 */
router.get('/facturas/:facturaId/correcciones', MLController.obtenerCorreccionesPorFactura);

/**
 * @route   GET /api/ml/patrones
 * @desc    Obtener patrones de extracción aprendidos
 * @access  Public
 */
router.get('/patrones', MLController.obtenerPatrones);

/**
 * @route   POST /api/ml/metricas/actualizar
 * @desc    Actualizar métricas diarias (para cron jobs)
 * @access  Public
 */
router.post('/metricas/actualizar', MLController.actualizarMetricasDiarias);

/**
 * @route   POST /api/ml/reinicializar
 * @desc    Reinicializar servicio de ML
 * @access  Public
 */
router.post('/reinicializar', MLController.reinicializarML);

export default router;
