# Colección de Postman - Bot Facturas API

Esta carpeta contiene todo lo necesario para probar la API con Postman.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `Bot-Facturas-API.postman_collection.json` | Colección completa con todos los endpoints |
| `Bot-Facturas-API.postman_environment.json` | Variables de entorno (base_url, factura_id, etc.) |
| `DATOS_PRUEBA.md` | Datos de prueba: RFCs, facturas ejemplo, queries SQL |
| `README.md` | Este archivo |

## Quick Start

### 1. Importar en Postman

**Opción A: Arrastrar y soltar**
- Arrastra `Bot-Facturas-API.postman_collection.json` a Postman
- Arrastra `Bot-Facturas-API.postman_environment.json` a Postman

**Opción B: Menú Import**
1. Abre Postman
2. Clic en **Import**
3. Selecciona ambos archivos JSON
4. Clic en **Import**

### 2. Seleccionar Entorno

1. En la esquina superior derecha, selecciona el dropdown de entornos
2. Elige "Bot Facturas - Local"

### 3. Iniciar Servidor

```bash
# En la raíz del proyecto
npm run dev
```

### 4. Probar Health Check

1. En la colección, abre "Health Check" → "Health Check"
2. Haz clic en **Send**
3. Deberías ver: `{"status": "ok", ...}`

## Estructura de la Colección

```
Bot Facturas API/
├── Health Check
│   ├── Health Check          (GET /health)
│   └── API Info              (GET /)
│
├── Facturas
│   ├── Crear Factura Manual  (POST /api/facturas)
│   ├── Subir Ticket/PDF      (POST /api/facturas/ticket)
│   ├── Generar Factura       (POST /api/facturas/:id/generar)
│   ├── Obtener Todas         (GET /api/facturas)
│   ├── Obtener por ID        (GET /api/facturas/:id)
│   ├── Obtener por RFC       (GET /api/facturas/rfc/:rfc)
│   └── Actualizar            (PUT /api/facturas/:id)
│
├── Machine Learning
│   ├── Registrar Correcciones     (POST /api/ml/facturas/:id/correcciones)
│   ├── Obtener Métricas           (GET /api/ml/metricas)
│   ├── Historial Correcciones     (GET /api/ml/correcciones)
│   ├── Correcciones por Factura   (GET /api/ml/facturas/:id/correcciones)
│   ├── Obtener Patrones           (GET /api/ml/patrones)
│   ├── Patrones por Campo         (GET /api/ml/patrones?fieldName=rfc)
│   ├── Actualizar Métricas        (POST /api/ml/metricas/actualizar)
│   └── Reinicializar ML           (POST /api/ml/reinicializar)
│
└── WhatsApp
    ├── Webhook (Recibir Mensaje)  (POST /api/whatsapp/webhook)
    └── Verificación Webhook       (GET /api/whatsapp/webhook)
```

## Variables de Entorno

| Variable | Valor Default | Descripción |
|----------|---------------|-------------|
| `base_url` | `http://localhost:3000` | URL del servidor |
| `factura_id` | `1` | ID de factura para requests |
| `rfc` | `XAXX010101000` | RFC de prueba |

### Editar Variables

1. Clic en el ícono de ojo (👁️) arriba a la derecha
2. Clic en **Edit** junto a "Bot Facturas - Local"
3. Modifica valores
4. Guarda

## Flujo Recomendado de Testing

### Flujo Básico (5 minutos)

```
1. Health Check
2. Crear Factura Manual
3. Obtener Todas las Facturas
4. Obtener Factura por ID
```

### Flujo Completo con OCR (15 minutos)

```
1. Health Check
2. Subir Ticket (JPG/PNG/PDF)
3. Ver Factura Creada
4. Registrar Correcciones
5. Ver Métricas de ML
6. Generar Factura Externa
```

### Flujo de ML Testing (30 minutos)

```
1. Ver Métricas Iniciales
2. Subir 5 Tickets
3. Corregir Todos
4. Ver Patrones Aprendidos
5. Subir Ticket Similar
6. Verificar Mejora en Métricas
```

## Ejemplos Rápidos

### Crear Factura

```bash
POST http://localhost:3000/api/facturas

{
  "rfc": "XAXX010101000",
  "fecha": "2024-01-15",
  "importeTotal": 1160.00,
  "iva": 160.00,
  "subtotal": 1000.00,
  "conceptos": "Servicios de consultoría"
}
```

### Subir Ticket

```bash
POST http://localhost:3000/api/facturas/ticket

archivo: [seleccionar archivo]
```

### Corregir Datos

```bash
POST http://localhost:3000/api/ml/facturas/1/correcciones

{
  "corrections": [
    {"fieldName": "rfc", "correctedValue": "XEXX010101000"}
  ]
}
```

## Datos de Prueba

Ver `DATOS_PRUEBA.md` para:
- ✓ RFCs válidos
- ✓ Ejemplos de facturas
- ✓ Texto de tickets
- ✓ Queries SQL útiles
- ✓ Escenarios de testing

## Tips

### 1. Actualizar `factura_id` Automáticamente

En la pestaña **Tests** del request "Subir Ticket":

```javascript
let response = pm.response.json();
if (response.success && response.factura) {
    pm.environment.set("factura_id", response.factura.id);
}
```

### 2. Validar Respuestas

En cualquier request, pestaña **Tests**:

```javascript
pm.test("Status code is 200", () => {
    pm.response.to.have.status(200);
});

pm.test("Response is successful", () => {
    const json = pm.response.json();
    pm.expect(json.success).to.be.true;
});
```

### 3. Ejecutar Toda la Colección

1. Clic derecho en "Bot Facturas API"
2. **Run collection**
3. Selecciona requests
4. **Run**

## Troubleshooting

### No puedo conectarme

✓ Verifica que el servidor esté corriendo: `npm run dev`
✓ Verifica la variable `base_url`: `http://localhost:3000`
✓ Prueba en navegador: `http://localhost:3000/health`

### Error al subir archivo

✓ Campo debe llamarse `archivo` (exacto)
✓ Tipo debe ser `File` (no Text)
✓ Formato válido: JPG, PNG, PDF
✓ Tamaño máximo: 10MB

### OpenAI no se activa

✓ Habilitado en `.env`: `OPENAI_ENABLED=true`
✓ API key válida: `OPENAI_API_KEY=sk-...`
✓ Confianza baja: `< 75%`
✓ Revisa logs del servidor

## Documentación Completa

Para información detallada, revisa:

- [Guía Completa de Testing](../docs/TESTING_POSTMAN.md)
- [README Principal](../README.md)
- [Machine Learning](../docs/MACHINE_LEARNING.md)
- [OpenAI Integration](../docs/OPENAI_INTEGRATION.md)

## Soporte

- GitHub Issues: [Abrir issue](#)
- Documentación: `docs/`
- Logs del servidor: Terminal donde corre `npm run dev`

---

**¡Listo para probar!** 🚀

Empieza con "Health Check" → "Health Check" y sigue el flujo recomendado.
