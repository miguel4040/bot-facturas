#!/usr/bin/env ts-node
/**
 * Script simplificado para probar la conexión con FacturaCFDI.mx
 * Solo valida autenticación y métodos disponibles (sin timbrar)
 */

import { FacturacionService } from '../src/services/facturacionService';
import { config } from '../src/config/env';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function main() {
  const ambiente = process.argv[2] || config.facturacion.environment;
  
  // Cambiar temporalmente el ambiente si se especifica
  if (ambiente === 'production' || ambiente === 'prod') {
    config.facturacion.environment = 'production';
  } else {
    config.facturacion.environment = 'development';
  }

  log('\n╔════════════════════════════════════════════╗', colors.cyan);
  log('║  TEST RÁPIDO - FacturaCFDI.mx API         ║', colors.cyan);
  log('╚════════════════════════════════════════════╝\n', colors.cyan);

  // Mostrar configuración
  const isDev = config.facturacion.environment === 'development';
  const creds = isDev ? config.facturacion.credentials.dev : config.facturacion.credentials.prod;

  log('📋 CONFIGURACIÓN:', colors.yellow);
  log(`   Ambiente: ${config.facturacion.environment.toUpperCase()}`, isDev ? colors.yellow : colors.green);
  log(`   Usuario: ${creds.user}`, colors.bright);
  log(`   Usa Token: ${config.facturacion.useToken ? 'Sí' : 'No'}`);
  log('');

  try {
    // Test 1: Validar credenciales
    log('🔐 Test 1: Validando credenciales...', colors.blue);
    const credencialesValidas = await FacturacionService.validarCredenciales();

    if (credencialesValidas) {
      log('   ✅ Autenticación exitosa\n', colors.green);
    } else {
      log('   ❌ Error en autenticación\n', colors.red);
      return;
    }

    // Test 2: Obtener información del servicio
    log('📡 Test 2: Obteniendo métodos del servicio...', colors.blue);
    const info = await FacturacionService.obtenerInfoProveedor();

    if (info.success) {
      log('   ✅ Servicio SOAP conectado', colors.green);
      log(`   📍 Endpoint: ${info.endpoint}`, colors.cyan);
      log(`   🔧 Métodos disponibles: ${info.metodos.length}`, colors.cyan);
      log('');
      
      info.metodos.forEach((metodo: string, index: number) => {
        log(`      ${index + 1}. ${metodo}`, colors.magenta);
      });
      log('');
    } else {
      log(`   ❌ Error: ${info.error}\n`, colors.red);
    }

    // Resumen
    log('╔════════════════════════════════════════════╗', colors.green);
    log('║  ✅ CONEXIÓN EXITOSA CON FACTURACFDI.MX  ║', colors.green);
    log('╚════════════════════════════════════════════╝\n', colors.green);

    if (isDev) {
      log('💡 NOTA: Estás en modo DESARROLLO (pruebas)', colors.yellow);
      log('   Para usar producción: npm run test:facturacion prod', colors.yellow);
      log('');
      log('⚠️  IMPORTANTE: Para timbrar facturas reales necesitas:', colors.yellow);
      log('   1. Certificado CSD (.cer y .key) del SAT', colors.yellow);
      log('   2. Registrar el CSD en facturacfdi.mx', colors.yellow);
      log('   3. Cambiar a modo producción', colors.yellow);
    } else {
      log('✅ Estás en modo PRODUCCIÓN', colors.green);
      log('');
      log('⚠️  Para timbrar facturas necesitas:', colors.yellow);
      log('   1. Subir tu Certificado CSD en facturacfdi.mx', colors.yellow);
      log('   2. Asegurarte que el RFC coincida con el del CSD', colors.yellow);
    }

  } catch (error: any) {
    log('\n╔════════════════════════════════════════════╗', colors.red);
    log('║  ❌ ERROR EN LA PRUEBA                     ║', colors.red);
    log('╚════════════════════════════════════════════╝\n', colors.red);
    log(`Error: ${error.message}`, colors.red);
  }
  
  log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`Error fatal: ${error.message}`);
    process.exit(1);
  });

