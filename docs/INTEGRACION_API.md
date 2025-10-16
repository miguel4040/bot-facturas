# Guía de Integración con FacturaCFDI.mx

Esta guía explica cómo está integrada la API de facturación con **FacturaCFDI.mx**, un Proveedor Autorizado de Certificación (PAC) que ofrece servicios de timbrado de CFDI 3.3 y 4.0 mediante servicios web SOAP.

## Descripción del Servicio

FacturaCFDI.mx proporciona dos tipos de servicios web SOAP:

1. **WSForcogsaService** (Con Token) - **Recomendado**
   - Mayor seguridad mediante tokens de sesión
   - Control de acceso más robusto
   - Ideal para aplicaciones en producción

2. **WSTimbradoCFDIService** (Sin Token) - Alternativa
   - Autenticación más simple con usuario/contraseña
   - Útil para prototipos o pruebas rápidas

## URLs de Servicio

### Ambiente de Desarrollo (Pruebas)

```
Con Token:    https://dev33.facturacfdi.mx/WSForcogsaService?wsdl
Sin Token:    https://dev33.facturacfdi.mx/WSTimbradoCFDIService?wsdl
```

### Ambiente de Producción

```
Con Token:    https://v33.facturacfdi.mx/WSForcogsaService?wsdl
Sin Token:    https://v33.facturacfdi.mx/WSTimbradoCFDIService?wsdl
```

## Credenciales de Acceso

### Pruebas (Development)

```
Usuario:      pruebasWS
Contraseña:   pruebasWS
```

### Producción

Deberás obtener tus credenciales de producción contactando a FacturaCFDI.mx o registrándote en su plataforma.

## Configuración del Proyecto

### 1. Variables de Entorno

En tu archivo `.env`, configura las siguientes variables:

```env
# Entorno: development o production
FACTURACION_ENVIRONMENT=development

# URLs WSDL - Con Token (recomendado)
FACTURACION_WSDL_DEV_TOKEN=https://dev33.facturacfdi.mx/WSForcogsaService?wsdl
FACTURACION_WSDL_PROD_TOKEN=https://v33.facturacfdi.mx/WSForcogsaService?wsdl

# URLs WSDL - Sin Token (alternativa)
FACTURACION_WSDL_DEV_SIMPLE=https://dev33.facturacfdi.mx/WSTimbradoCFDIService?wsdl
FACTURACION_WSDL_PROD_SIMPLE=https://v33.facturacfdi.mx/WSTimbradoCFDIService?wsdl

# Credenciales de Pruebas
FACTURACION_USER_DEV=pruebasWS
FACTURACION_PASSWORD_DEV=pruebasWS

# Credenciales de Producción
FACTURACION_USER_PROD=tu_usuario_produccion
FACTURACION_PASSWORD_PROD=tu_password_produccion

# Configuración adicional
FACTURACION_USE_TOKEN=true
FACTURACION_TIMEOUT=30000
```

### 2. Configuración en código

El archivo `src/config/env.ts` ya está configurado para leer estas variables:

```typescript
facturacion: {
  environment: process.env.FACTURACION_ENVIRONMENT || 'development',
  wsdl: {
    devToken: process.env.FACTURACION_WSDL_DEV_TOKEN || '...',
    prodToken: process.env.FACTURACION_WSDL_PROD_TOKEN || '...',
    devSimple: process.env.FACTURACION_WSDL_DEV_SIMPLE || '...',
    prodSimple: process.env.FACTURACION_WSDL_PROD_SIMPLE || '...',
  },
  credentials: {
    dev: {
      user: process.env.FACTURACION_USER_DEV || 'pruebasWS',
      password: process.env.FACTURACION_PASSWORD_DEV || 'pruebasWS',
    },
    prod: {
      user: process.env.FACTURACION_USER_PROD || '',
      password: process.env.FACTURACION_PASSWORD_PROD || '',
    },
  },
  useToken: process.env.FACTURACION_USE_TOKEN === 'true',
  timeout: parseInt(process.env.FACTURACION_TIMEOUT || '30000'),
}
```

## Métodos SOAP del Servicio

FacturaCFDI proporciona diferentes métodos según el tipo de servicio y si el comprobante está sellado o no.

### Servicio SIN Token (WSTimbradoCFDIService)

**1. TimbrarCFDI** - Para comprobantes **sellados**
- Parámetros: `accesos` (usuario, password), `comprobante` (XML sellado)
- Respuesta: `acuseCFDI.xmlTimbrado`

**2. TimbrarCFDIV2** - Para comprobantes **sin sellar**
- Parámetros: `accesos` (usuario, password), `comprobante` (XML sin sellar)
- Respuesta: `acuseCFDI.xmlTimbrado`
- El PAC agrega el certificado y sello automáticamente

### Servicio CON Token (WSForcogsaService) - Recomendado

**0. Autenticar** - Obtener token de sesión
- Parámetros: `usuario`, `contrasena`
- Respuesta: `return.token`, `return.fechaExpiracion`
- El token se guarda en caché automáticamente

**1. Timbrar** - Para comprobantes **sellados**
- Parámetros: `cfd` (XML sellado), `token`
- Respuesta: `return.cfdi` (XML timbrado), `return.codigo` (0 = éxito)

**2. TimbrarV2** - Para comprobantes **sin sellar**
- Parámetros: `cfdi` (XML sin sellar), `token`
- Respuesta: `return.cfdi` (XML timbrado), `return.codigo` (0 = éxito)
- El PAC agrega el certificado y sello automáticamente

## Métodos Disponibles en el Código

### 1. Generar Factura (Timbrar CFDI)

**Método:** `FacturacionService.generarFactura(data: FacturaData, sellado: boolean = false)`

Envía un comprobante CFDI al PAC para su timbrado.

**NOTA:** Por defecto usa `sellado = false`, lo que invoca `TimbrarCFDIV2` (sin token) o `TimbrarV2` (con token). El servicio construye un XML básico sin sello, y el PAC lo completa automáticamente.

**Parámetros de entrada:**

```typescript
{
  rfc: string;               // RFC del receptor
  fecha: string;             // Fecha en formato YYYY-MM-DD
  importeTotal: number;      // Total de la factura
  iva: number;               // IVA (16%)
  subtotal: number;          // Subtotal sin impuestos
  conceptos?: string;        // Descripción de productos/servicios
  formaPago?: string;        // Código SAT (01=Efectivo, 03=Transferencia, etc.)
  metodoPago?: string;       // PUE o PPD
}
```

**Respuesta exitosa:**

```typescript
{
  success: true,
  facturaId: "ABC123-456",        // UUID del CFDI timbrado
  uuid: "ABC123-456",             // UUID del CFDI
  message: "Factura timbrada exitosamente",
  xml: "<cfdi:Comprobante...",    // XML del CFDI timbrado
  pdf: "...",                     // PDF (si el servicio lo proporciona)
  fechaTimbrado: "2024-01-15...", // Fecha y hora del timbrado
  cadenaOriginal: "||3.3|..."    // Cadena original del complemento de certificación
}
```

**Respuesta con error:**

```typescript
{
  success: false,
  error: "Mensaje de error específico"
}
```

### 2. Consultar Factura

**Método:** `FacturacionService.consultarFactura(uuid: string)`

Consulta el estado de una factura previamente timbrada.

**Parámetros:**

```typescript
uuid: string  // UUID del CFDI a consultar
```

**Respuesta:**

```typescript
{
  success: true,
  facturaId: "ABC123-456",
  uuid: "ABC123-456",
  message: "Factura consultada exitosamente",
  xml: "<cfdi:Comprobante...",
  pdf: "...",
  estado: "Vigente" | "Cancelado"
}
```

### 3. Cancelar Factura

**Método:** `FacturacionService.cancelarFactura(uuid: string, motivo?: string)`

Cancela una factura previamente timbrada.

**Parámetros:**

```typescript
uuid: string     // UUID del CFDI a cancelar
motivo?: string  // Código de motivo de cancelación (01-04)
```

**Motivos de cancelación según el SAT:**

```
01 - Comprobante emitido con errores con relación
02 - Comprobante emitido con errores sin relación (default)
03 - No se llevó a cabo la operación
04 - Operación nominativa relacionada en una factura global
```

**Respuesta:**

```typescript
{
  success: true,
  facturaId: "ABC123-456",
  uuid: "ABC123-456",
  message: "Factura cancelada exitosamente",
  acuseCancelacion: "<Acuse..."
}
```

### 4. Validar Credenciales

**Método:** `FacturacionService.validarCredenciales()`

Valida que las credenciales configuradas sean correctas.

**Respuesta:**

```typescript
boolean  // true si las credenciales son válidas
```

### 5. Limpiar Token Cache

**Método:** `FacturacionService.limpiarTokenCache()`

Limpia el token en caché, forzando una nueva autenticación en la próxima llamada (solo para servicio con token).

**Uso:**

```typescript
// Forzar nueva autenticación
FacturacionService.limpiarTokenCache();
```

### 6. Obtener Información del Proveedor

**Método:** `FacturacionService.obtenerInfoProveedor()`

Obtiene información sobre los servicios disponibles del WSDL.

**Respuesta:**

```typescript
{
  success: true,
  servicios: ["WSForcogsaService"],
  metodos: ["timbrarCFDI", "consultarCFDI", "cancelarCFDI"],
  endpoint: "https://dev33.facturacfdi.mx/WSForcogsaService"
}
```

## Autenticación y Manejo de Tokens

Cuando `FACTURACION_USE_TOKEN=true`, el servicio usa **WSForcogsaService** que requiere autenticación previa.

### Flujo de Autenticación

1. **Primera llamada**: Se obtiene un token del servidor
2. **Token en caché**: El token se guarda con su fecha de expiración
3. **Siguientes llamadas**: Se reutiliza el token mientras sea válido
4. **Expiración**: Cuando expira, se obtiene uno nuevo automáticamente

### Cache Automático de Tokens

El servicio maneja automáticamente el ciclo de vida del token:

```typescript
// Primera llamada - obtiene token
await FacturacionService.generarFactura(data);
// → Llama a Autenticar, guarda token

// Segunda llamada - reutiliza token
await FacturacionService.generarFactura(data2);
// → Usa token en caché

// Después de expiración - renueva automáticamente
await FacturacionService.generarFactura(data3);
// → Token expirado, llama a Autenticar de nuevo
```

**Ventajas:**
- ✅ Menos llamadas al servidor
- ✅ Mejor rendimiento
- ✅ Manejo automático de expiración
- ✅ No necesitas preocuparte por los tokens

## Uso en la Aplicación

### Desde un Controller

```typescript
import { FacturacionService } from '../services/facturacionService';

// Generar factura
const facturaData = {
  rfc: "XAXX010101000",
  fecha: "2024-01-15",
  importeTotal: 1160.00,
  iva: 160.00,
  subtotal: 1000.00,
  conceptos: "Servicios de consultoría",
  formaPago: "01",
  metodoPago: "PUE"
};

const result = await FacturacionService.generarFactura(facturaData);

if (result.success) {
  console.log(`UUID: ${result.uuid}`);
  console.log(`XML: ${result.xml}`);
} else {
  console.error(`Error: ${result.error}`);
}
```

### Desde un Endpoint

El proyecto ya incluye el endpoint:

```
POST /api/facturas/:id/generar
```

Este endpoint toma una factura existente en la base de datos y la envía a FacturaCFDI para timbrado.

## Estructura del CFDI XML

El servicio construye automáticamente el XML del CFDI según el estándar del SAT (**versión 4.0**).

**IMPORTANTE:** El método `buildCFDIXml()` en `facturacionService.ts` es una versión simplificada para pruebas. Para producción, se recomienda:

1. **Obtener tu Certificado de Sello Digital (CSD)** del SAT
2. **Usar una librería especializada** como:
   - `@sat-cfdi/cfdi-core`
   - `sat-ws-descarga-masiva`
3. **Incluir todos los campos requeridos**:
   - Sello digital del comprobante (si usas método sellado)
   - Certificado del emisor (si usas método sellado)
   - Todos los atributos obligatorios según el esquema XSD del SAT

**NOTA:** El servicio usa por defecto los métodos **sin sellar** (`TimbrarCFDIV2` / `TimbrarV2`), donde el PAC agrega automáticamente el certificado y sello. Esto simplifica mucho la implementación.

### Ejemplo de XML simplificado generado (CFDI 4.0):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante
  xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  Version="4.0"
  Fecha="2024-01-15T10:30:00"
  FormaPago="01"
  SubTotal="1000.00"
  Total="1160.00"
  TipoDeComprobante="I"
  MetodoPago="PUE">

  <cfdi:Emisor
    Rfc="EMISOR010101AAA"
    Nombre="Emisor de Prueba"
    RegimenFiscal="601"/>

  <cfdi:Receptor
    Rfc="XAXX010101000"
    Nombre="Receptor"
    UsoCFDI="G01"/>

  <cfdi:Conceptos>
    <cfdi:Concepto
      ClaveProdServ="01010101"
      Cantidad="1"
      ClaveUnidad="ACT"
      Descripcion="Servicios de consultoría"
      ValorUnitario="1000.00"
      Importe="1000.00">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado
            Base="1000.00"
            Impuesto="002"
            TipoFactor="Tasa"
            TasaOCuota="0.160000"
            Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>

  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado
        Impuesto="002"
        TipoFactor="Tasa"
        TasaOCuota="0.160000"
        Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
</cfdi:Comprobante>
```

## Códigos de Respuesta del PAC

### Códigos de éxito

```
000 - Operación exitosa
```

### Códigos de error comunes

```
301 - XML mal formado
302 - Sello mal formado o inválido
303 - Certificado inválido
304 - Certificado no vigente
305 - Emisor no válido
401 - Fecha de generación fuera de rango
501 - RFC del receptor no válido
701 - CFDI previamente timbrado
```

## Códigos SAT - Forma de Pago

```
01 - Efectivo
02 - Cheque nominativo
03 - Transferencia electrónica de fondos
04 - Tarjeta de crédito
28 - Tarjeta de débito
99 - Por definir
```

## Códigos SAT - Método de Pago

```
PUE - Pago en una sola exhibición
PPD - Pago en parcialidades o diferido
```

## Códigos SAT - Uso de CFDI

```
G01 - Adquisición de mercancías
G02 - Devoluciones, descuentos o bonificaciones
G03 - Gastos en general
I01 - Construcciones
I02 - Mobiliario y equipo de oficina por inversiones
I03 - Equipo de transporte
I04 - Equipo de cómputo y accesorios
I05 - Dados, troqueles, moldes, matrices y herramental
I06 - Comunicaciones telefónicas
I07 - Comunicaciones satelitales
I08 - Otra maquinaria y equipo
P01 - Por definir
```

## Testing con Postman

El proyecto incluye requests de Postman preconfigurados para probar la integración:

1. **Generar Factura** - `POST /api/facturas/:id/generar`
2. **Consultar Factura** - Se puede agregar al usar el UUID retornado
3. **Cancelar Factura** - Se puede agregar al usar el UUID retornado

Ver `postman/Bot-Facturas-API.postman_collection.json` para más detalles.

## Migración a Producción

### Pasos para usar en producción:

1. **Obtener credenciales de producción** de FacturaCFDI.mx
2. **Obtener tu Certificado de Sello Digital (CSD)** del SAT
3. **Actualizar `.env`**:
   ```env
   FACTURACION_ENVIRONMENT=production
   FACTURACION_USER_PROD=tu_usuario_real
   FACTURACION_PASSWORD_PROD=tu_password_real
   ```
4. **Implementar construcción completa de CFDI**:
   - Incluir certificado y sello digital
   - Validar contra esquema XSD del SAT
   - Usar librería especializada
5. **Probar en ambiente de pruebas primero**
6. **Implementar logging y monitoreo** de transacciones
7. **Configurar respaldos** de XMLs timbrados

## Manejo de Errores

### Error: "No se pudo conectar con FacturaCFDI"

**Causa:** No se puede acceder al WSDL

**Solución:**
- Verificar conectividad a internet
- Verificar que la URL del WSDL sea correcta
- Revisar firewall o proxy que pueda estar bloqueando

### Error: "Credenciales de facturación no configuradas"

**Causa:** Falta configurar usuario/contraseña en `.env`

**Solución:**
- Agregar `FACTURACION_USER_DEV` y `FACTURACION_PASSWORD_DEV` en `.env`

### Error: "XML mal formado"

**Causa:** El XML del CFDI no cumple con el esquema del SAT

**Solución:**
- Revisar el método `buildCFDIXml()`
- Validar contra esquema XSD del SAT
- Usar librería especializada para construcción de CFDI

### Error: "Certificado inválido"

**Causa:** El CSD no es válido o ha expirado

**Solución:**
- Obtener nuevo CSD del SAT
- Verificar vigencia del certificado

## Recursos Adicionales

- **Documentación FacturaCFDI.mx:** https://facturacfdi.mx/
- **Portal SAT:** https://www.sat.gob.mx/
- **Estándar CFDI 3.3:** http://www.sat.gob.mx/informacion_fiscal/factura_electronica/Paginas/cfdi_version3-3.aspx
- **Catálogos SAT:** http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/catCFDI_V_33.xls
- **Librería SOAP Node.js:** https://github.com/vpulim/node-soap

## Soporte

Para problemas con FacturaCFDI.mx, contacta directamente con su soporte técnico.

Para problemas con la integración en este proyecto, revisa:
- Logs del servidor: `npm run dev`
- Código en `src/services/facturacionService.ts`
- Configuración en `src/config/env.ts`
