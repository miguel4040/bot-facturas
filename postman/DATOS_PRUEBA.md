# Datos de Prueba para Testing

Esta guía contiene datos de prueba válidos para usar en Postman.

## RFCs de Prueba (Válidos)

### Personas Morales (3 letras + 6 dígitos + 3 caracteres)

```
XAXX010101000
XEXX010101001
ABC123456789
```

### Personas Físicas (4 letras + 6 dígitos + 3 caracteres)

```
VECJ880326XXX
GOCA920415XX2
AAAA010101AAA
```

### RFCs Genéricos (para pruebas)

```
XAXX010101000  - Público en general
XEXX010101000  - Extranjero
```

## Facturas de Ejemplo

### Ejemplo 1: Factura Básica

```json
{
  "rfc": "XAXX010101000",
  "fecha": "2024-01-15",
  "importeTotal": 1160.00,
  "iva": 160.00,
  "subtotal": 1000.00,
  "conceptos": "Servicios de consultoría empresarial",
  "formaPago": "01",
  "metodoPago": "PUE"
}
```

### Ejemplo 2: Factura con Productos

```json
{
  "rfc": "VECJ880326XXX",
  "fecha": "2024-01-20",
  "importeTotal": 580.00,
  "iva": 80.00,
  "subtotal": 500.00,
  "conceptos": "Venta de productos de oficina: papel, lápices, carpetas",
  "formaPago": "03",
  "metodoPago": "PUE"
}
```

### Ejemplo 3: Factura Grande

```json
{
  "rfc": "ABC123456789",
  "fecha": "2024-01-25",
  "importeTotal": 23200.00,
  "iva": 3200.00,
  "subtotal": 20000.00,
  "conceptos": "Servicios profesionales de desarrollo de software",
  "formaPago": "04",
  "metodoPago": "PPD"
}
```

### Ejemplo 4: Factura Pequeña

```json
{
  "rfc": "XEXX010101001",
  "fecha": "2024-02-01",
  "importeTotal": 116.00,
  "iva": 16.00,
  "subtotal": 100.00,
  "conceptos": "Servicio de café internet",
  "formaPago": "01",
  "metodoPago": "PUE"
}
```

## Códigos de Forma de Pago

```
01 - Efectivo
02 - Cheque nominativo
03 - Transferencia electrónica de fondos
04 - Tarjeta de crédito
28 - Tarjeta de débito
99 - Por definir
```

## Códigos de Método de Pago

```
PUE - Pago en una sola exhibición
PPD - Pago en parcialidades o diferido
```

## Ejemplos de Correcciones para ML

### Corrección Simple

```json
{
  "corrections": [
    {
      "fieldName": "rfc",
      "correctedValue": "XEXX010101000"
    }
  ],
  "correctedBy": "admin",
  "source": "manual"
}
```

### Corrección Múltiple

```json
{
  "corrections": [
    {
      "fieldName": "rfc",
      "correctedValue": "XEXX010101000"
    },
    {
      "fieldName": "importeTotal",
      "correctedValue": "1200.00"
    },
    {
      "fieldName": "iva",
      "correctedValue": "200.00"
    },
    {
      "fieldName": "subtotal",
      "correctedValue": "1000.00"
    }
  ],
  "correctedBy": "sistema",
  "source": "api"
}
```

### Corrección de Fecha

```json
{
  "corrections": [
    {
      "fieldName": "fecha",
      "correctedValue": "2024-01-15"
    }
  ],
  "correctedBy": "operador_01",
  "source": "manual"
}
```

## Texto de Tickets para Testing Manual

Si necesitas crear archivos de texto simulando tickets:

### Ticket Simple

```
====================================
       TIENDA EJEMPLO S.A.
====================================

RFC: XAXX010101000
FECHA: 15/01/2024

PRODUCTOS:
- Laptop Dell           $10,000.00
- Mouse inalámbrico        $300.00

                   SUBTOTAL: $10,300.00
                        IVA:  $1,648.00
                      TOTAL: $11,948.00

FORMA DE PAGO: EFECTIVO
====================================
```

### Ticket con Errores (para probar ML)

```
====================================
       COMERCIAL XYZ
====================================

R.F.C.: XE0X010101000    ← Error: 0 en vez de X
Fech4: 20/01/2024        ← Error: 4 en vez de a

Servicios
- Consulta             $1,000.00

                   Sub total: $1,000.00
                        IV4:    $160.00  ← Error: IV4 en vez de IVA
                      T0TAL: $1,160.00   ← Error: 0 en vez de O

====================================
```

### Ticket Complejo

```
====================================
    RESTAURANT EL BUEN SABOR
====================================

RFC: VECJ880326XXX
FOLIO: A-12345
FECHA Y HORA: 25/01/2024 14:30

MESA: 5
MESERO: Juan

----------------------------------
CONSUMO:

2x Tacos al pastor      $120.00
1x Refresco             $30.00
1x Agua                 $25.00
1x Café                 $35.00

----------------------------------
                   SUBTOTAL: $210.00
      IVA (16%):              $33.60
                      TOTAL: $243.60

PROPINA SUGERIDA (10%):     $24.36

FORMA DE PAGO: TARJETA
====================================
GRACIAS POR SU VISITA
```

## Queries SQL Útiles para Testing

### Ver últimas facturas creadas

```sql
SELECT
  id,
  rfc,
  fecha,
  importe_total,
  status,
  created_at
FROM facturas
ORDER BY created_at DESC
LIMIT 10;
```

### Ver extracciones con OpenAI

```sql
SELECT
  f.id as factura_id,
  oe.ocr_method,
  oe.confidence_score,
  oe.processing_time_ms
FROM ocr_extractions oe
JOIN facturas f ON oe.factura_id = f.id
WHERE oe.ocr_method LIKE '%openai%'
ORDER BY oe.created_at DESC;
```

### Ver correcciones recientes

```sql
SELECT
  oc.field_name,
  oc.extracted_value,
  oc.corrected_value,
  oc.corrected_by,
  oc.created_at
FROM ocr_corrections oc
ORDER BY oc.created_at DESC
LIMIT 20;
```

### Ver precisión por campo

```sql
SELECT * FROM extraction_accuracy_view;
```

### Ver patrones más exitosos

```sql
SELECT
  field_name,
  pattern_value,
  accuracy,
  success_count,
  failure_count
FROM extraction_patterns
WHERE accuracy > 80
ORDER BY accuracy DESC, success_count DESC
LIMIT 10;
```

## Escenarios de Testing

### Escenario 1: Happy Path

**Objetivo**: Todo funciona perfectamente

**Datos**:
- RFC: `XAXX010101000` (válido)
- Fecha: `2024-01-15` (formato correcto)
- Total: `1160.00`
- IVA: `160.00`
- Subtotal: `1000.00`
- Coherencia numérica: ✓ (1000 + 160 = 1160)

**Resultado esperado**: Factura creada sin errores, confianza alta

---

### Escenario 2: RFC Inválido

**Objetivo**: Probar validación de RFC

**Datos**:
- RFC: `INVALIDO` (formato incorrecto)
- Otros campos correctos

**Resultado esperado**: Error 400 "RFC inválido"

---

### Escenario 3: Fecha Inválida

**Objetivo**: Probar validación de fecha

**Datos**:
- Fecha: `2024-13-45` (mes y día inválidos)
- Otros campos correctos

**Resultado esperado**: Error 400 "Fecha inválida"

---

### Escenario 4: Incoherencia Numérica

**Objetivo**: Probar validación de cálculos

**Datos**:
- Subtotal: `1000.00`
- IVA: `160.00`
- Total: `2000.00` (incorrecto, debería ser 1160)

**Resultado esperado**: Factura se crea pero con advertencia

---

### Escenario 5: Aprendizaje ML

**Objetivo**: Probar que el ML aprende de correcciones

**Pasos**:
1. Subir 5 tickets con el mismo error
2. Corregir todos
3. Subir ticket similar
4. Verificar que se extrajo correctamente

**Resultado esperado**: Precisión mejorada, menos errores

---

### Escenario 6: OpenAI Fallback

**Objetivo**: Probar activación de OpenAI

**Datos**:
- Usar imagen de baja calidad o con errores OCR
- Confianza < 75%
- OpenAI habilitado

**Resultado esperado**: OpenAI se activa y mejora extracción

## Herramientas Útiles

### Generador de RFC de Prueba

Puedes usar este formato para crear RFCs de prueba:

**Persona Moral**:
```
[AAA][YYMMDD][XXX]
Ejemplo: ABC240115001
```

**Persona Física**:
```
[AAAA][YYMMDD][XXX]
Ejemplo: VECJ880326XX2
```

### Calculadora de IVA

Para México, IVA = 16% del subtotal:

```
Subtotal: $1,000.00
IVA (16%): $1,000.00 × 0.16 = $160.00
Total: $1,000.00 + $160.00 = $1,160.00
```

### Fórmulas

```javascript
// JavaScript
const subtotal = 1000;
const iva = subtotal * 0.16;
const total = subtotal + iva;

console.log(`Subtotal: $${subtotal.toFixed(2)}`);
console.log(`IVA: $${iva.toFixed(2)}`);
console.log(`Total: $${total.toFixed(2)}`);
```

## Checklist de Testing

Usa esta lista para asegurarte de probar todo:

- [ ] Health check funciona
- [ ] Crear factura manual
- [ ] Subir imagen JPG
- [ ] Subir imagen PNG
- [ ] Subir PDF
- [ ] Obtener todas las facturas
- [ ] Obtener factura por ID
- [ ] Obtener facturas por RFC
- [ ] Actualizar factura
- [ ] Registrar correcciones
- [ ] Ver métricas de ML
- [ ] Ver patrones aprendidos
- [ ] Ver historial de correcciones
- [ ] Generar factura externa
- [ ] Simular webhook WhatsApp
- [ ] Probar con RFC inválido (debe fallar)
- [ ] Probar con fecha inválida (debe fallar)
- [ ] Probar con archivo muy grande (debe fallar)
- [ ] Probar con formato de archivo inválido (debe fallar)
- [ ] Verificar que OpenAI se activa con baja confianza
- [ ] Verificar logs del servidor durante procesamiento

## Contacto

Si necesitas más datos de prueba o tienes dudas, revisa la documentación o abre un issue.
