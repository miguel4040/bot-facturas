#!/usr/bin/env ts-node
/**
 * Script de prueba para la API de FacturaCFDI.mx
 * 
 * Este script valida:
 * 1. Conexión al servicio SOAP
 * 2. Autenticación (si usa token)
 * 3. Métodos disponibles
 * 4. Timbrado de una factura de prueba
 */

import { FacturacionService } from '../src/services/facturacionService';
import { FacturaData } from '../src/types';
import { config } from '../src/config/env';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function main() {
  log('\n==============================================', colors.cyan);
  log('  PRUEBA DE API - FacturaCFDI.mx', colors.bright);
  log('==============================================\n', colors.cyan);

  // Mostrar configuración actual
  log('📋 CONFIGURACIÓN ACTUAL:', colors.yellow);
  log(`   Ambiente: ${config.facturacion.environment}`);
  log(`   Usa Token: ${config.facturacion.useToken ? 'Sí' : 'No'}`);
  log(`   Usuario (${config.facturacion.environment}): ${
    config.facturacion.environment === 'development'
      ? config.facturacion.credentials.dev.user
      : config.facturacion.credentials.prod.user
  }`);
  log('');

  try {
    // ========== PASO 1: Validar Credenciales ==========
    log('🔐 PASO 1: Validando credenciales...', colors.blue);
    const credencialesValidas = await FacturacionService.validarCredenciales();

    if (credencialesValidas) {
      log('✅ Credenciales válidas - Autenticación exitosa', colors.green);
    } else {
      log('❌ Credenciales inválidas - Verifica tus datos', colors.red);
      return;
    }
    log('');

    // ========== PASO 2: Obtener Información del Proveedor ==========
    log('📡 PASO 2: Obteniendo información del servicio...', colors.blue);
    const infoProveedor = await FacturacionService.obtenerInfoProveedor();

    if (infoProveedor.success) {
      log('✅ Información obtenida exitosamente', colors.green);
      log(`   Endpoint: ${infoProveedor.endpoint}`);
      log(`   Servicios disponibles: ${infoProveedor.servicios.join(', ')}`);
      log(`   Métodos disponibles:`);
      infoProveedor.metodos.forEach((metodo: string) => {
        log(`      - ${metodo}`);
      });
    } else {
      log(`❌ Error obteniendo información: ${infoProveedor.error}`, colors.red);
    }
    log('');

    // ========== PASO 3: Timbrar Factura de Prueba ==========
    log('🧾 PASO 3: Timbrando factura de prueba...', colors.blue);

    // Datos de prueba para factura
    const facturaData: FacturaData = {
      rfc: 'XAXX010101000', // RFC genérico para público en general
      fecha: new Date().toISOString().split('T')[0], // Fecha actual en formato YYYY-MM-DD
      subtotal: 100.00,
      iva: 16.00,
      importeTotal: 116.00,
      formaPago: '01', // Efectivo
      metodoPago: 'PUE', // Pago en una sola exhibición
      conceptos: 'Servicio de prueba - Bot de Facturas',
    };

    log(`   RFC: ${facturaData.rfc}`);
    log(`   Subtotal: $${facturaData.subtotal.toFixed(2)}`);
    log(`   IVA: $${facturaData.iva.toFixed(2)}`);
    log(`   Total: $${facturaData.importeTotal.toFixed(2)}`);
    log('');

    const resultado = await FacturacionService.generarFactura(facturaData, false);

    if (resultado.success) {
      log('✅ ¡FACTURA TIMBRADA EXITOSAMENTE!', colors.green);
      log(`   UUID: ${resultado.uuid}`, colors.bright);
      log(`   Fecha de Timbrado: ${resultado.fechaTimbrado || 'N/A'}`);
      log(`   Mensaje: ${resultado.message}`);
      
      // Guardar el XML si existe
      if (resultado.xml) {
        const fs = require('fs');
        const path = require('path');
        const outputDir = path.join(__dirname, '../test-output');
        
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const filename = `factura-${resultado.uuid || Date.now()}.xml`;
        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, resultado.xml, 'utf8');
        
        log(`   XML guardado en: ${filepath}`, colors.cyan);
      }
    } else {
      log('❌ Error al timbrar factura:', colors.red);
      log(`   ${resultado.error}`, colors.red);
    }
    log('');

    // ========== PASO 4: Consultar Factura (opcional) ==========
    if (resultado.success && resultado.uuid) {
      log('🔍 PASO 4: Consultando factura timbrada...', colors.blue);
      
      const consulta = await FacturacionService.consultarFactura(resultado.uuid);
      
      if (consulta.success) {
        log('✅ Factura consultada exitosamente', colors.green);
        log(`   Estado: ${consulta.estado || 'Vigente'}`);
      } else {
        log(`⚠️  No se pudo consultar la factura: ${consulta.error}`, colors.yellow);
        log('   (Este método puede no estar disponible en el servicio)', colors.yellow);
      }
    }

    log('\n==============================================', colors.cyan);
    log('  ✅ PRUEBA COMPLETADA', colors.green);
    log('==============================================\n', colors.cyan);

  } catch (error: any) {
    log('\n==============================================', colors.red);
    log('  ❌ ERROR EN LA PRUEBA', colors.red);
    log('==============================================\n', colors.red);
    log(`Error: ${error.message}`, colors.red);
    
    if (error.stack) {
      log('\nStack trace:', colors.yellow);
      log(error.stack, colors.yellow);
    }
  }
}

// Ejecutar el script
main()
  .then(() => {
    log('\n✅ Script finalizado correctamente\n', colors.green);
    process.exit(0);
  })
  .catch((error) => {
    log(`\n❌ Error fatal: ${error.message}\n`, colors.red);
    process.exit(1);
  });

