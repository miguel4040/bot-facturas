# Machine Learning en Bot Facturas API

La API incluye un sistema avanzado de Machine Learning que mejora continuamente la precisión de extracción de datos de tickets y facturas.

## Características del Sistema ML

### 1. Extracción Mejorada con NLP
- Usa Natural Language Processing para comprender el contexto
- Múltiples técnicas de extracción:
  - **Patrones Regex aprendidos**: Basados en correcciones históricas
  - **Extracción por contexto**: Busca valores cerca de palabras clave
  - **Extracción por posición**: Basado en ubicación típica en documentos
- Validación de coherencia numérica (subtotal + IVA = total)
- Sistema de confianza ponderada

### 2. Aprendizaje Automático
- **Feedback Loop**: Aprende de cada corrección manual
- **Patrones dinámicos**: Genera nuevos patrones desde correcciones
- **Mejora continua**: Actualiza automáticamente la precisión
- **Métricas en tiempo real**: Tracking de rendimiento del modelo

### 3. Base de Datos de Entrenamiento
- Almacena todas las extracciones OCR
- Registra correcciones humanas
- Mantiene patrones aprendidos con estadísticas de éxito
- Calcula métricas diarias de rendimiento

## Arquitectura del Sistema

```
┌─────────────────┐
│   Ticket/PDF    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  OCR Service    │  ← Tesseract.js / pdf-parse
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   ML Service    │  ← Natural, TF.js, String Similarity
└────────┬────────┘
         │
         ├─► Extracción por Patrones
         ├─► Extracción por Contexto (NLP)
         ├─► Extracción por Posición
         └─► Validación de Coherencia
         │
         ▼
┌─────────────────┐
│ Datos Extraídos │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Base de Datos  │
│  - ocr_extractions
│  - ocr_corrections
│  - extraction_patterns
│  - ml_metrics
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Corrección      │ ← Usuario corrige datos
│ Manual          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Aprendizaje     │ ← Genera nuevos patrones
└─────────────────┘
```

## Uso de la API

### 1. Procesamiento Automático con ML

El ML se activa automáticamente al procesar tickets:

```bash
curl -X POST http://localhost:3000/api/facturas/ticket \
  -F "archivo=@ticket.jpg"
```

Respuesta con confianza del ML:
```json
{
  "success": true,
  "factura": {
    "id": 1,
    "rfc": "XAXX010101000",
    "importe_total": 1160.00,
    ...
  },
  "extractedData": {
    "rfc": "XAXX010101000",
    "fecha": "2024-01-15",
    "importeTotal": 1160.00,
    "iva": 160.00,
    "subtotal": 1000.00,
    "confidence": 85
  },
  "confidence": 85
}
```

### 2. Registrar Correcciones (Aprendizaje)

Cuando detectas errores en la extracción, envía correcciones:

```bash
curl -X POST http://localhost:3000/api/ml/facturas/1/correcciones \
  -H "Content-Type: application/json" \
  -d '{
    "corrections": [
      {
        "fieldName": "rfc",
        "correctedValue": "XEXX010101000"
      },
      {
        "fieldName": "importeTotal",
        "correctedValue": "1180.00"
      }
    ],
    "correctedBy": "admin",
    "source": "manual"
  }'
```

El sistema automáticamente:
1. Guarda las correcciones
2. Analiza el texto original para encontrar el valor correcto
3. Genera nuevos patrones de extracción
4. Actualiza la factura con los valores corregidos
5. Mejora la precisión para futuros tickets similares

### 3. Consultar Métricas de Rendimiento

```bash
curl http://localhost:3000/api/ml/metricas
```

Respuesta:
```json
{
  "success": true,
  "metrics": [
    {
      "metric_date": "2024-01-15",
      "total_extractions": 50,
      "successful_extractions": 42,
      "corrections_needed": 8,
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
      "total_extractions": 50,
      "corrections_count": 2,
      "accuracy_percentage": 96.00,
      "avg_confidence": 88.5
    },
    ...
  ]
}
```

### 4. Ver Patrones Aprendidos

```bash
# Ver todos los patrones
curl http://localhost:3000/api/ml/patrones

# Ver patrones de un campo específico
curl http://localhost:3000/api/ml/patrones?fieldName=rfc
```

Respuesta:
```json
{
  "success": true,
  "patterns": {
    "rfc": [
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
      ...
    ],
    "fecha": [...],
    "importeTotal": [...]
  }
}
```

### 5. Historial de Correcciones

```bash
# Todas las correcciones
curl http://localhost:3000/api/ml/correcciones

# Correcciones de una factura específica
curl http://localhost:3000/api/ml/facturas/1/correcciones
```

## Técnicas de ML Implementadas

### 1. Extracción Multi-Método

El sistema prueba múltiples métodos y selecciona el mejor:

```typescript
// Ejemplo interno del algoritmo
const candidates = [
  { value: "XAXX010101000", confidence: 85, method: "pattern" },
  { value: "XAXX010101000", confidence: 75, method: "context" },
  { value: "XAXX010101000", confidence: 65, method: "position" }
];

// Si múltiples métodos coinciden, aumenta la confianza
if (sameval_count > 1) {
  confidence *= 1.2;
}
```

### 2. Validación de Coherencia Numérica

```typescript
// Valida: subtotal + iva ≈ total
const expectedTotal = subtotal + iva;
const tolerance = total * 0.01; // 1%

if (Math.abs(expectedTotal - total) <= tolerance) {
  // Aumentar confianza en todos los valores
  confidence *= 1.15;
}

// Valida: IVA ≈ 16% del subtotal (México)
const expectedIVA = subtotal * 0.16;
if (Math.abs(expectedIVA - iva) <= tolerance) {
  confidence *= 1.1;
}
```

### 3. Extracción por Contexto (NLP)

Busca valores cerca de palabras clave:

```typescript
const keywords = {
  rfc: ['rfc', 'r.f.c', 'registro federal'],
  fecha: ['fecha', 'date', 'día', 'emitida'],
  importeTotal: ['total', 'importe total', 'monto total']
};

// Busca en los 50 caracteres después de la palabra clave
const afterKeyword = text.substring(keywordIndex, keywordIndex + 50);
const value = extractPattern(afterKeyword);
```

### 4. Extracción por Posición

Basado en ubicación típica en tickets:

```typescript
const positions = {
  rfc: 0.1,         // 10% desde el inicio (header)
  fecha: 0.15,      // 15% desde el inicio
  subtotal: 0.8,    // 80% hacia el final
  iva: 0.85,        // 85% hacia el final
  importeTotal: 0.9 // 90% hacia el final (footer)
};
```

### 5. Generación Automática de Patrones

Cuando registras una corrección, el sistema:

1. Busca el valor correcto en el texto original
2. Extrae 30 caracteres antes y después
3. Identifica palabras clave contextuales
4. Genera un nuevo patrón regex:

```typescript
// Ejemplo: Si encuentra "TOTAL: $1,160.00"
// Genera patrón: total[:\s]*\$?\s*([\d,]+\.?\d{0,2})
const pattern = `${keyword}[:\\s]*${valuePattern}`;
```

## Mejora Continua

### Ciclo de Mejora

1. **Extracción inicial**: Sistema procesa ticket con ML
2. **Uso**: Usuario usa los datos extraídos
3. **Detección de errores**: Usuario encuentra errores
4. **Corrección**: Usuario envía correcciones vía API
5. **Aprendizaje**: Sistema genera nuevos patrones
6. **Validación**: Patrones se prueban en nuevas extracciones
7. **Actualización**: Estadísticas de éxito/falla actualizan precisión

### Métricas Automáticas

Ejecuta diariamente (puede configurarse con cron):

```bash
curl -X POST http://localhost:3000/api/ml/metricas/actualizar
```

Esto calcula y guarda:
- Total de extracciones del día
- Extracciones exitosas (sin correcciones)
- Extracciones que necesitaron correcciones
- Confianza promedio
- Precisión por campo

## Configuración Avanzada

### Variables de Entorno

```env
# Umbral mínimo de confianza para aceptar extracción
OCR_CONFIDENCE_THRESHOLD=60

# Idioma del OCR (para Tesseract)
OCR_LANGUAGE=spa
```

### Reinicializar Servicio ML

Después de hacer correcciones masivas, recarga los patrones:

```bash
curl -X POST http://localhost:3000/api/ml/reinicializar
```

## Casos de Uso

### Caso 1: Mejorar Extracción de RFC

Si el sistema tiene problemas con RFCs:

1. Procesa varios tickets
2. Corrige todos los RFCs incorrectos vía API
3. El sistema aprende los patrones comunes
4. La precisión mejora automáticamente

### Caso 2: Nuevos Formatos de Tickets

Cuando recibes tickets de un nuevo proveedor:

1. Primera extracción puede tener baja confianza
2. Corriges manualmente los primeros 5-10 tickets
3. Sistema aprende el formato específico
4. Siguientes tickets del mismo proveedor se extraen correctamente

### Caso 3: Monitoreo de Calidad

1. Revisa métricas diarias
2. Identifica campos con baja precisión
3. Enfoca correcciones en esos campos
4. Observa mejora en métricas

## Roadmap Futuro

- [ ] Modelo de Deep Learning con TensorFlow.js
- [ ] Clasificación automática de tipos de tickets
- [ ] Detección de layout con Computer Vision
- [ ] Entrenamiento activo (solicitar validación de extracciones dudosas)
- [ ] A/B testing de diferentes modelos
- [ ] Exportar/importar modelos entrenados
- [ ] Dashboard web para métricas ML

## Limitaciones Actuales

- Requiere al menos 50-100 correcciones para aprendizaje significativo
- Patrones son específicos por idioma (actualmente español/México)
- No detecta automáticamente diferentes layouts de tickets
- Modelo TensorFlow.js aún no implementado (solo patrones y NLP)

## Contribuir al Modelo

Para mejorar el modelo global:

1. Usa la API regularmente
2. Corrige todos los errores que encuentres
3. Las métricas te mostrarán la mejora
4. Los patrones se vuelven más robustos con el tiempo

## Soporte

Para preguntas sobre ML:
- Revisa las métricas: `/api/ml/metricas`
- Inspecciona patrones: `/api/ml/patrones`
- Consulta correcciones: `/api/ml/correcciones`
