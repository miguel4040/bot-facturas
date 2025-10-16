# Configuración de la API de Facturación - FacturaCFDI.mx

## ✅ Estado Actual

Tu proyecto está correctamente configurado y conectado con la API de **FacturaCFDI.mx**.

### Pruebas Realizadas

✅ **Modo Desarrollo (Pruebas)**
- Usuario: `pruebasWS`
- Autenticación: ✅ Exitosa
- Token obtenido: ✅ Válido

✅ **Modo Producción**
- Usuario: `DDJAR141218` (tu RFC)
- Autenticación: ✅ Exitosa
- Token obtenido: ✅ Válido

---

## 🚀 Comandos Disponibles

### Pruebas de API

```bash
# Prueba rápida (solo autenticación) - DESARROLLO
npm run test:facturacion

# Prueba rápida (solo autenticación) - PRODUCCIÓN
npm run test:facturacion:prod

# Prueba completa (incluye intento de timbrado) - DESARROLLO
npm run test:facturacion:full

# Validación de RFC
npm run test:rfc
```

---

## 📋 Próximos Pasos para Timbrar Facturas Reales

Para poder timbrar facturas en producción, necesitas completar los siguientes pasos:

### 1. Obtener tu Certificado de Sello Digital (CSD)

El **CSD** es un certificado emitido por el **SAT** (Sistema de Administración Tributaria de México) que te permite sellar digitalmente tus facturas electrónicas.

#### ¿Cómo obtenerlo?

1. Ingresa al portal del SAT: https://www.sat.gob.mx/
2. Ve a **"Trámites"** → **"Certificado de Sello Digital"**
3. Descarga tu certificado (recibirás 2 archivos):
   - `CSD.cer` - Certificado público
   - `CSD.key` - Clave privada

**Nota:** Necesitas tu **e.firma** (Firma Electrónica Avanzada) para realizar este trámite.

### 2. Registrar el CSD en FacturaCFDI.mx

1. Ingresa a tu cuenta en: https://facturacfdi.mx/
2. Ve a **"Configuración"** o **"Administrador Digital"**
3. Sube tu certificado CSD:
   - Archivo `.cer`
   - Archivo `.key`
   - Contraseña de la clave privada (la que te dio el SAT)

### 3. Verificar que el RFC coincida

Asegúrate de que el RFC en tu cuenta de FacturaCFDI.mx sea el mismo que el del certificado CSD:
- RFC del CSD: `DDJAR141218` (debe coincidir)

### 4. Configurar el entorno de producción

En tu archivo `.env`, asegúrate de tener:

```env
# Cambiar a producción cuando estés listo para timbrar
FACTURACION_ENVIRONMENT=production

# Tus credenciales de producción (ya configuradas)
FACTURACION_USER_PROD=DDJAR141218
FACTURACION_PASSWORD_PROD=34r30oOFa
```

---

## 🔧 Configuración Actual

### Variables de Entorno

Tu archivo `.env` está configurado con:

```env
# Ambiente actual
FACTURACION_ENVIRONMENT=development  # Cambiar a "production" cuando estés listo

# Credenciales de Desarrollo (Pruebas)
FACTURACION_USER_DEV=pruebasWS
FACTURACION_PASSWORD_DEV=pruebasWS

# Credenciales de Producción (Reales)
FACTURACION_USER_PROD=DDJAR141218
FACTURACION_PASSWORD_PROD=34r30oOFa

# Configuración del servicio
FACTURACION_USE_TOKEN=true  # Recomendado para mayor seguridad
```

### Endpoints

**Desarrollo (Pruebas):**
- Con token: `https://dev33.facturacfdi.mx/WSForcogsaService?wsdl`
- Sin token: `https://dev33.facturacfdi.mx/WSTimbradoCFDIService?wsdl`

**Producción (Real):**
- Con token: `https://v33.facturacfdi.mx/WSForcogsaService?wsdl`
- Sin token: `https://v33.facturacfdi.mx/WSTimbradoCFDIService?wsdl`

---

## 💡 Métodos Disponibles

Tu servicio `FacturacionService` incluye los siguientes métodos:

### 1. `generarFactura(data, sellado?)`
Timbra una factura (genera el CFDI).

```typescript
const resultado = await FacturacionService.generarFactura({
  rfc: 'XAXX010101000',
  fecha: '2024-10-16',
  subtotal: 100.00,
  iva: 16.00,
  importeTotal: 116.00,
  formaPago: '01',
  metodoPago: 'PUE',
  conceptos: 'Servicio de prueba'
}, false);
```

### 2. `consultarFactura(uuid)`
Consulta el estado de una factura ya timbrada.

```typescript
const consulta = await FacturacionService.consultarFactura('UUID-DE-LA-FACTURA');
```

### 3. `cancelarFactura(uuid, motivo?)`
Cancela una factura timbrada.

```typescript
const cancelacion = await FacturacionService.cancelarFactura('UUID-DE-LA-FACTURA', '02');
```

Motivos de cancelación:
- `01` - Comprobante emitido con errores con relación
- `02` - Comprobante emitido con errores sin relación (default)
- `03` - No se llevó a cabo la operación
- `04` - Operación nominativa relacionada en una factura global

### 4. `validarCredenciales()`
Valida que las credenciales sean correctas.

```typescript
const validas = await FacturacionService.validarCredenciales();
```

### 5. `obtenerInfoProveedor()`
Obtiene información sobre el servicio SOAP y métodos disponibles.

```typescript
const info = await FacturacionService.obtenerInfoProveedor();
```

---

## ⚠️ Errores Comunes

### "El CSD no se encuentra registrado"

**Causa:** No has registrado tu Certificado de Sello Digital en FacturaCFDI.mx.

**Solución:** 
1. Obtén tu CSD del SAT
2. Regístralo en tu cuenta de FacturaCFDI.mx

### "RFC no válido"

**Causa:** El RFC en el XML no coincide con el certificado CSD.

**Solución:** Verifica que uses el RFC correcto (el del CSD).

### "Error de autenticación"

**Causa:** Usuario o contraseña incorrectos.

**Solución:** Verifica tus credenciales en el archivo `.env`.

---

## 📚 Recursos Adicionales

- **Portal SAT:** https://www.sat.gob.mx/
- **FacturaCFDI.mx:** https://facturacfdi.mx/
- **Documentación CFDI 4.0:** http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/Anexo_20_Guia_de_llenado_CFDI.pdf
- **Catálogos del SAT:** http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/catCFDI.xls

---

## 🔐 Seguridad

**⚠️ IMPORTANTE:** 

1. **NUNCA** subas tu archivo `.env` a Git (ya está en `.gitignore`)
2. **NUNCA** compartas tus credenciales de producción
3. **NUNCA** expongas tu API key de OpenAI
4. Guarda tus archivos CSD (`.cer` y `.key`) en un lugar seguro
5. Usa variables de entorno en producción

---

## 📞 Soporte

Para soporte técnico de FacturaCFDI.mx:
- Sitio web: https://facturacfdi.mx/soporte
- Documentación API: https://facturacfdi.mx/docs

---

**Última actualización:** 16 de octubre de 2025

