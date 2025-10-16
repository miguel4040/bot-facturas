/**
 * Script para probar validación de RFC mexicano
 * Uso: npx ts-node scripts/test-rfc-validation.ts
 */

import { isValidRFC } from '../src/utils/validation';

// RFCs de prueba
const testCases = [
  // RFCs válidos - Persona Moral (3 letras)
  { rfc: 'CFE370814QI0', expected: true, description: 'CFE - Comisión Federal de Electricidad' },
  { rfc: 'OMA830818IW1', expected: true, description: 'OXXO - Persona Moral' },
  { rfc: 'ABC010101ABC', expected: true, description: 'Persona Moral genérica' },
  
  // RFCs válidos - Persona Física (4 letras)
  { rfc: 'BAZX060710BSA', expected: true, description: 'Persona Física - 4 letras' },
  { rfc: 'ABCD991231XYZ', expected: true, description: 'Persona Física - fecha válida' },
  { rfc: 'JUAN850312AB5', expected: true, description: 'Persona Física con número al final' },
  
  // RFCs inválidos - Mes inválido
  { rfc: 'ABC001301ABC', expected: false, description: 'Mes 13 (inválido)' },
  { rfc: 'ABC000001ABC', expected: false, description: 'Mes 00 (inválido)' },
  
  // RFCs inválidos - Día inválido
  { rfc: 'ABC010100ABC', expected: false, description: 'Día 00 (inválido)' },
  { rfc: 'ABC010132ABC', expected: false, description: 'Día 32 (inválido)' },
  
  // RFCs inválidos - Formato incorrecto
  { rfc: 'AB010101ABC', expected: false, description: 'Solo 2 letras (inválido)' },
  { rfc: 'ABCDE010101ABC', expected: false, description: '5 letras (inválido)' },
  { rfc: 'ABC0101ABCD', expected: false, description: 'Solo 4 dígitos en fecha (inválido)' },
  { rfc: 'ABC010101AB', expected: false, description: 'Solo 2 homoclaves (inválido)' },
  
  // RFCs con caracteres especiales permitidos
  { rfc: 'Ñ&Ñ010101ABC', expected: true, description: 'Con Ñ y & (válido)' },
  
  // Casos extremos de fechas válidas
  { rfc: 'ABC000101ABC', expected: true, description: 'Año 00, mes 01, día 01 (válido)' },
  { rfc: 'ABC991231ABC', expected: true, description: 'Año 99, mes 12, día 31 (válido)' },
  { rfc: 'ABC500229ABC', expected: true, description: 'Febrero 29 (posible año bisiesto)' },
];

console.log('🧪 Probando validación de RFC mexicano\n');
console.log('Expresión regular:');
console.log('/^([A-Z,Ñ,&]{3,4}([0-9]{2})(0[1-9]|1[0-2])(0[1-9]|1[0-9]|2[0-9]|3[0-1])[A-Z|\\d]{3})$/\n');

let passed = 0;
let failed = 0;

testCases.forEach(({ rfc, expected, description }) => {
  const result = isValidRFC(rfc);
  const status = result === expected ? '✅' : '❌';
  
  if (result === expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${status} ${rfc.padEnd(15)} - ${description}`);
  
  if (result !== expected) {
    console.log(`   Expected: ${expected}, Got: ${result}`);
  }
});

console.log(`\n📊 Resultados: ${passed} passed, ${failed} failed, ${testCases.length} total`);

if (failed === 0) {
  console.log('✅ ¡Todos los tests pasaron!');
  process.exit(0);
} else {
  console.log('❌ Algunos tests fallaron');
  process.exit(1);
}


