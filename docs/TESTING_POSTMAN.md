# Guía de Testing con Postman

Esta guía te ayudará a probar todos los endpoints de la API Bot Facturas usando Postman.

## Tabla de Contenidos

1. [Instalación y Configuración](#instalación-y-configuración)
2. [Importar Colección](#importar-colección)
3. [Configurar Variables](#configurar-variables)
4. [Flujo de Pruebas](#flujo-de-pruebas)
5. [Ejemplos de Requests](#ejemplos-de-requests)
6. [Troubleshooting](#troubleshooting)

## Instalación y Configuración

### 1. Instalar Postman

Si no tienes Postman instalado:

1. Descarga desde [postman.com/downloads](https://www.postman.com/downloads/)
2. Instala la aplicación
3. Crea una cuenta (opcional pero recomendado)

### 2. Iniciar el Servidor

Asegúrate de que el servidor esté corriendo:

```bash
# Terminal 1: Iniciar base de datos
# (Si usas Docker)
docker-compose up -d postgres

# Terminal 2: Iniciar servidor
npm run dev
```

Deberías ver:
```
╔═══════════════════════════════════════════════════════╗
║       Bot Facturas API con Machine Learning           ║
║                                                       ║
║  Servidor iniciado en puerto: 3000                    ║
╚═══════════════════════════════════════════════════════╝
```

### 3. Verificar Servidor

Abre tu navegador y visita: `http://localhost:3000/health`

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Importar Colección

### Opción 1: Importar desde Archivo

1. Abre Postman
2. Haz clic en **Import** (botón en la parte superior izquierda)
3. Selecciona **File**
4. Navega a la carpeta `postman/` del proyecto
5. Selecciona `Bot-Facturas-API.postman_collection.json`
6. Haz clic en **Import**

### Opción 2: Arrastrar y Soltar

1. Abre Postman
2. Arrastra el archivo `Bot-Facturas-API.postman_collection.json` a la ventana de Postman
3. La colección se importará automáticamente

### Importar Variables de Entorno

1. Haz clic en el ícono de engranaje (⚙️) en la parte superior derecha
2. Haz clic en **Import**
3. Selecciona `Bot-Facturas-API.postman_environment.json`
4. Haz clic en **Import**
5. Selecciona el entorno "Bot Facturas - Local" desde el dropdown

## Configurar Variables

Las variables se usan para evitar repetir valores. Por defecto:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `base_url` | `http://localhost:3000` | URL base del servidor |
| `factura_id` | `1` | ID de factura para pruebas |
| `rfc` | `XAXX010101000` | RFC de prueba |

### Editar Variables

1. Haz clic en el ícono de ojo (👁️) en la parte superior derecha
2. Haz clic en **Edit** junto a "Bot Facturas - Local"
3. Modifica los valores según necesites
4. Guarda los cambios

### Variables Útiles Adicionales

Puedes agregar más variables según necesites:

```json
{
  "server_url_produccion": "https://api.tudominio.com",
  "api_key": "tu_api_key_aqui",
  "test_rfc": "XEXX010101000",
  "test_fecha": "2024-01-15"
}
```

## Flujo de Pruebas

### Flujo Completo Recomendado

Sigue este orden para probar todas las funcionalidades:

```
1. Health Check
   ↓
2. Crear Factura Manual
   ↓
3. Obtener Todas las Facturas
   ↓
4. Subir Ticket (OCR + ML + OpenAI)
   ↓
5. Ver Factura Creada
   ↓
6. Registrar Correcciones (ML aprende)
   ↓
7. Ver Métricas de ML
   ↓
8. Ver Patrones Aprendidos
   ↓
9. Generar Factura Externa
```

## Ejemplos de Requests

### 1. Health Check

**Propósito**: Verificar que el servidor esté funcionando

**Request**:
```
GET http://localhost:3000/health
```

**Respuesta Esperada**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 2. Crear Factura Manual

**Propósito**: Crear una factura con datos manuales (sin OCR)

**Request**:
```
POST http://localhost:3000/api/facturas
Content-Type: application/json

{
  "rfc": "XAXX010101000",
  "fecha": "2024-01-15",
  "importeTotal": 1160.00,
  "iva": 160.00,
  "subtotal": 1000.00,
  "conceptos": "Servicios de consultoría",
  "formaPago": "01",
  "metodoPago": "PUE"
}
```

**Respuesta Esperada**:
```json
{
  "success": true,
  "message": "Factura creada y generada exitosamente",
  "factura": {
    "id": 1,
    "rfc": "XAXX010101000",
    "fecha": "2024-01-15T00:00:00.000Z",
    "importe_total": 1160.00,
    "iva": 160.00,
    "subtotal": 1000.00,
    "status": "procesada"
  }
}
```

**Notas**:
- Guarda el `id` de la factura para siguientes requests
- Actualiza la variable `factura_id` en Postman con este valor

---

### 3. Subir Ticket (OCR)

**Propósito**: Subir una imagen o PDF de ticket para extraer datos automáticamente

**Request**:
```
POST http://localhost:3000/api/facturas/ticket
Content-Type: multipart/form-data

archivo: [seleccionar archivo JPG, PNG o PDF]
```

**Pasos en Postman**:

1. Selecciona el request "Subir Ticket/PDF (OCR)"
2. Ve a la pestaña **Body**
3. Selecciona **form-data**
4. Asegúrate que el key sea `archivo` y type sea `File`
5. Haz clic en **Select Files** y elige tu ticket
6. Haz clic en **Send**

**Respuesta Esperada**:
```json
{
  "success": true,
  "message": "Ticket procesado exitosamente",
  "factura": {
    "id": 2,
    "rfc": "XEXX010101000",
    "fecha": "2024-01-15T00:00:00.000Z",
    "importe_total": 1180.00,
    "iva": 180.00,
    "subtotal": 1000.00,
    "archivo_path": "./uploads/ticket-1234567890.jpg",
    "status": "pendiente"
  },
  "extractedData": {
    "rfc": "XEXX010101000",
    "fecha": "2024-01-15",
    "importeTotal": 1180.00,
    "iva": 180.00,
    "subtotal": 1000.00,
    "confidence": 87
  },
  "confidence": 87
}
```

**Notas**:
- Si `confidence < 75` y OpenAI está habilitado, verás en los logs del servidor que se usó ChatGPT
- El método OCR usado se registra en la BD (`tesseract+ml`, `tesseract+openai`, etc.)

---

### 4. Obtener Todas las Facturas

**Propósito**: Listar facturas con paginación

**Request**:
```
GET http://localhost:3000/api/facturas?limit=50&offset=0
```

**Respuesta Esperada**:
```json
{
  "success": true,
  "count": 2,
  "facturas": [
    {
      "id": 2,
      "rfc": "XEXX010101000",
      "fecha": "2024-01-15T00:00:00.000Z",
      "importe_total": 1180.00,
      "status": "pendiente"
    },
    {
      "id": 1,
      "rfc": "XAXX010101000",
      "fecha": "2024-01-15T00:00:00.000Z",
      "importe_total": 1160.00,
      "status": "procesada"
    }
  ]
}
```

---

### 5. Registrar Correcciones (ML Aprende)

**Propósito**: Corregir datos extraídos incorrectamente para que el ML aprenda

**Request**:
```
POST http://localhost:3000/api/ml/facturas/2/correcciones
Content-Type: application/json

{
  "corrections": [
    {
      "fieldName": "rfc",
      "correctedValue": "XEXX010101001"
    },
    {
      "fieldName": "importeTotal",
      "correctedValue": "1200.00"
    },
    {
      "fieldName": "iva",
      "correctedValue": "200.00"
    }
  ],
  "correctedBy": "admin",
  "source": "manual"
}
```

**Respuesta Esperada**:
```json
{
  "success": true,
  "message": "Correcciones registradas y aprendizaje completado",
  "corrections": [
    {
      "id": 1,
      "ocr_extraction_id": 2,
      "field_name": "rfc",
      "extracted_value": "XEXX010101000",
      "corrected_value": "XEXX010101001",
      "corrected_by": "admin",
      "correction_source": "manual"
    }
  ]
}
```

**Nota**: El sistema automáticamente:
- Genera nuevos patrones de extracción
- Actualiza la factura con valores corregidos
- Mejora futuras extracciones

---

### 6. Ver Métricas de ML

**Propósito**: Ver rendimiento del Machine Learning

**Request**:
```
GET http://localhost:3000/api/ml/metricas
```

**Respuesta Esperada**:
```json
{
  "success": true,
  "metrics": [
    {
      "metric_date": "2024-01-15",
      "total_extractions": 10,
      "successful_extractions": 8,
      "corrections_needed": 2,
      "average_confidence": 84.5,
      "accuracy_by_field": {
        "rfc": 95.2,
        "fecha": 87.3,
        "importeTotal": 89.1,
        "iva": 82.5,
        "subtotal": 80.1
      }
    }
  ],
  "accuracy": [
    {
      "field_name": "rfc",
      "total_extractions": 10,
      "corrections_count": 1,
      "accuracy_percentage": 90.00,
      "avg_confidence": 88.5
    }
  ]
}
```

---

### 7. Ver Patrones Aprendidos

**Propósito**: Ver qué patrones ha aprendido el ML

**Request**:
```
GET http://localhost:3000/api/ml/patrones?fieldName=rfc
```

**Respuesta Esperada**:
```json
{
  "success": true,
  "fieldName": "rfc",
  "patterns": [
    {
      "id": 1,
      "field_name": "rfc",
      "pattern_type": "regex",
      "pattern_value": "RFC[:\\s]*([A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3})",
      "confidence_weight": 1.5,
      "success_count": 45,
      "failure_count": 2,
      "accuracy": 95.74
    },
    {
      "id": 8,
      "field_name": "rfc",
      "pattern_type": "regex",
      "pattern_value": "registro[:\\s]*([A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3})",
      "confidence_weight": 1.2,
      "success_count": 3,
      "failure_count": 0,
      "accuracy": 100.00
    }
  ]
}
```

---

### 8. Generar Factura desde Ticket Procesado

**Propósito**: Enviar factura al servicio externo de facturación

**Request**:
```
POST http://localhost:3000/api/facturas/2/generar
```

**Respuesta Esperada**:
```json
{
  "success": true,
  "message": "Factura generada exitosamente",
  "factura": {
    "id": 2,
    "status": "procesada",
    "factura_externa_id": "FAC-2024-001"
  }
}
```

---

### 9. Obtener Factura por RFC

**Propósito**: Buscar facturas de un RFC específico

**Request**:
```
GET http://localhost:3000/api/facturas/rfc/XAXX010101000
```

**Respuesta Esperada**:
```json
{
  "success": true,
  "count": 2,
  "facturas": [
    { "id": 1, "rfc": "XAXX010101000", ... },
    { "id": 3, "rfc": "XAXX010101000", ... }
  ]
}
```

---

### 10. Simular Webhook de WhatsApp

**Propósito**: Probar recepción de mensajes de WhatsApp

**Request**:
```
POST http://localhost:3000/api/whatsapp/webhook
Content-Type: application/x-www-form-urlencoded

From=whatsapp:+525512345678
Body=Hola, quiero facturar
MessageSid=SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Pasos en Postman**:

1. Selecciona el request "Webhook (Recibir Mensaje)"
2. Ve a la pestaña **Body**
3. Selecciona **x-www-form-urlencoded**
4. Los campos ya están pre-configurados
5. Modifica valores si necesitas
6. Haz clic en **Send**

**Respuesta Esperada**:
```
OK
```

**Nota**: El procesamiento es asíncrono. Revisa los logs del servidor para ver el flujo completo.

## Casos de Uso Completos

### Caso 1: Flujo Completo con OCR

**Objetivo**: Procesar un ticket completo desde la foto hasta la factura generada

**Pasos**:

1. **Subir ticket**
   ```
   POST /api/facturas/ticket
   [Subir imagen del ticket]
   ```
   Guarda el `id` de la respuesta (ej: 5)

2. **Revisar datos extraídos**
   ```
   GET /api/facturas/5
   ```
   Revisa si los datos son correctos

3. **Corregir datos si hay errores**
   ```
   POST /api/ml/facturas/5/correcciones
   {
     "corrections": [
       {"fieldName": "rfc", "correctedValue": "VALOR_CORRECTO"}
     ]
   }
   ```

4. **Generar factura**
   ```
   POST /api/facturas/5/generar
   ```

5. **Verificar estado**
   ```
   GET /api/facturas/5
   ```
   Debe mostrar `status: "procesada"`

---

### Caso 2: Testing de ML

**Objetivo**: Probar que el ML está aprendiendo

**Pasos**:

1. **Ver métricas iniciales**
   ```
   GET /api/ml/metricas
   ```
   Anota la precisión actual

2. **Subir 5 tickets con errores similares**
   ```
   POST /api/facturas/ticket
   [Subir tickets]
   ```

3. **Corregir todos los tickets**
   ```
   POST /api/ml/facturas/:id/correcciones
   [Para cada ticket]
   ```

4. **Ver patrones aprendidos**
   ```
   GET /api/ml/patrones
   ```
   Deberías ver nuevos patrones generados

5. **Subir ticket similar**
   ```
   POST /api/facturas/ticket
   [Subir nuevo ticket]
   ```
   Debería extraer mejor los datos

6. **Verificar mejora en métricas**
   ```
   GET /api/ml/metricas
   ```
   La precisión debería haber aumentado

---

### Caso 3: Testing de OpenAI

**Objetivo**: Verificar que OpenAI se activa con baja confianza

**Requisitos**:
- OpenAI habilitado en `.env`
- `OPENAI_CONFIDENCE_THRESHOLD=75`

**Pasos**:

1. **Subir ticket de baja calidad**
   ```
   POST /api/facturas/ticket
   [Subir imagen borrosa o ticket difícil de leer]
   ```

2. **Revisar logs del servidor**
   Deberías ver:
   ```
   Confianza baja (68%), intentando con OpenAI...
   OpenAI mejoró la extracción exitosamente
   ```

3. **Ver método usado en BD**
   ```sql
   SELECT ocr_method, confidence_score
   FROM ocr_extractions
   ORDER BY id DESC LIMIT 1;
   ```
   Debería mostrar `tesseract+openai`

4. **Verificar alta confianza**
   La respuesta debería tener `confidence: 95` o más

## Troubleshooting

### Error: "Cannot connect to server"

**Problema**: Postman no puede conectarse al servidor

**Soluciones**:

1. Verifica que el servidor esté corriendo:
   ```bash
   npm run dev
   ```

2. Verifica la URL base en las variables de entorno

3. Verifica el puerto en `.env`:
   ```env
   PORT=3000
   ```

4. Prueba acceder desde el navegador:
   ```
   http://localhost:3000/health
   ```

---

### Error: "File upload failed"

**Problema**: No se puede subir el archivo

**Soluciones**:

1. Verifica que el campo se llame exactamente `archivo`

2. Verifica que el tipo sea `File` (no `Text`)

3. Verifica el tamaño del archivo (máximo 10MB por defecto)

4. Verifica el formato (solo JPG, PNG, PDF)

5. Revisa logs del servidor para más detalles

---

### Error: "RFC inválido"

**Problema**: El RFC no tiene el formato correcto

**Formato válido**:
- Persona moral: `AAA010101XXX` (3 letras + 6 dígitos + 3 caracteres)
- Persona física: `AAAA010101XXX` (4 letras + 6 dígitos + 3 caracteres)

**Ejemplos válidos**:
- `XAXX010101000`
- `XEXX010101001`
- `ABC1234567ABC`

---

### Baja precisión en extracción

**Problema**: El OCR no extrae bien los datos

**Soluciones**:

1. **Mejorar calidad de imagen**:
   - Buena iluminación
   - Enfoque nítido
   - Sin sombras
   - Resolución adecuada

2. **Habilitar OpenAI**:
   ```env
   OPENAI_ENABLED=true
   OPENAI_API_KEY=sk-tu-key
   ```

3. **Entrenar el ML**:
   - Sube varios tickets
   - Corrige los errores
   - El sistema aprenderá

4. **Usar PDFs en lugar de fotos** (si es posible):
   - Los PDFs tienen mejor precisión

---

### OpenAI no se activa

**Problema**: OpenAI no se usa aunque la confianza es baja

**Verificar**:

1. Está habilitado:
   ```env
   OPENAI_ENABLED=true
   ```

2. API key es válida:
   ```env
   OPENAI_API_KEY=sk-proj-xxxxx
   ```

3. Umbral es correcto:
   ```env
   OPENAI_CONFIDENCE_THRESHOLD=75
   ```

4. Revisa logs del servidor:
   ```
   OpenAI no está habilitado o configurado
   ```

5. Verifica saldo en OpenAI dashboard

## Consejos Pro

### 1. Usar Variables Dinámicas

Actualiza `factura_id` automáticamente después de crear una factura:

**En la pestaña Tests del request "Subir Ticket"**:
```javascript
let response = pm.response.json();
if (response.success && response.factura) {
    pm.environment.set("factura_id", response.factura.id);
}
```

### 2. Validar Respuestas Automáticamente

Agrega tests en la pestaña Tests:

```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.be.true;
});

pm.test("Response time is less than 5000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(5000);
});
```

### 3. Ejecutar Colección Completa

**Collection Runner**:

1. Haz clic derecho en la colección
2. Selecciona **Run collection**
3. Selecciona todos los requests
4. Haz clic en **Run Bot Facturas API**
5. Ver resultados de todos los tests

### 4. Exportar Resultados

Después de ejecutar tests:

1. Haz clic en **Export Results**
2. Guarda el archivo JSON
3. Comparte con tu equipo

## Recursos Adicionales

- [Documentación de Postman](https://learning.postman.com/docs/)
- [Documentación de la API](../README.md)
- [Machine Learning](./MACHINE_LEARNING.md)
- [Integración OpenAI](./OPENAI_INTEGRATION.md)
- [WhatsApp Setup](./WHATSAPP_SETUP.md)

## Soporte

Si encuentras problemas:

1. Revisa los logs del servidor
2. Verifica la configuración en `.env`
3. Consulta esta guía
4. Abre un issue en el repositorio
