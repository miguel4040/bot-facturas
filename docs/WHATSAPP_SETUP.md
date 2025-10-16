# Configuración de WhatsApp

Esta guía te ayudará a configurar la integración con WhatsApp usando Twilio.

## Opción 1: WhatsApp Sandbox de Twilio (Pruebas)

### Paso 1: Crear cuenta en Twilio

1. Visita [Twilio](https://www.twilio.com/try-twilio)
2. Regístrate y verifica tu cuenta
3. Obtén tus credenciales en el dashboard

### Paso 2: Activar WhatsApp Sandbox

1. En el dashboard de Twilio, ve a **Messaging** > **Try it out** > **Send a WhatsApp message**
2. Sigue las instrucciones para unirte al sandbox enviando un mensaje desde tu WhatsApp
3. Típicamente debes enviar algo como: `join <palabra-clave>` al número de sandbox

### Paso 3: Configurar webhook

1. En la configuración del sandbox, configura:
   - **When a message comes in**: `https://tu-dominio.com/api/whatsapp/webhook`
   - Método: **HTTP POST**

2. Guarda la configuración

### Paso 4: Configurar variables de entorno

En tu archivo `.env`:

```env
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

Puedes encontrar estas credenciales en:
- **Account SID** y **Auth Token**: Dashboard de Twilio
- **WhatsApp Number**: En la configuración del sandbox

## Opción 2: WhatsApp Business API con Twilio (Producción)

### Requisitos

1. Cuenta de negocio verificada
2. Número de teléfono dedicado para WhatsApp
3. Perfil de WhatsApp Business aprobado

### Proceso

1. Solicita acceso a WhatsApp Business API en Twilio
2. Completa el proceso de verificación (puede tomar varios días)
3. Configura tu perfil de negocio
4. Obtén tu número de WhatsApp Business aprobado
5. Configura el webhook igual que en el sandbox

## Opción 3: Otros proveedores

### Meta Cloud API (Directo)

Si prefieres usar la API oficial de Meta:

1. Crear cuenta en [Meta for Developers](https://developers.facebook.com/)
2. Configurar WhatsApp Business Platform
3. Modificar `src/services/whatsappService.ts`:

```typescript
private static async sendMessageMeta(to: string, body: string): Promise<boolean> {
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

  const response = await axios.post(url, {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body }
  }, {
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    }
  });

  return response.status === 200;
}
```

## Exponer tu servidor local (Para pruebas)

### Usando ngrok

1. Instalar ngrok:
```bash
npm install -g ngrok
```

2. Iniciar túnel:
```bash
ngrok http 3000
```

3. Usar la URL generada (ej: `https://abc123.ngrok.io`) como webhook en Twilio

### Usando localtunnel

```bash
npx localtunnel --port 3000
```

## Flujo de trabajo completo

1. **Usuario envía mensaje**
   - Usuario envía foto de ticket a tu número de WhatsApp

2. **Webhook recibe mensaje**
   - POST a `/api/whatsapp/webhook`
   - Se parsea el mensaje y extrae la imagen

3. **Confirmación inmediata**
   - API responde "OK" a Twilio
   - Envía mensaje de confirmación al usuario

4. **Procesamiento asíncrono**
   - Descarga la imagen
   - Procesa con OCR
   - Extrae datos de factura
   - Guarda en base de datos

5. **Generación de factura**
   - Envía datos al servicio de facturación
   - Actualiza estado en BD

6. **Notificación al usuario**
   - Envía mensaje con confirmación
   - Incluye ID de factura y total

## Mensajes de ejemplo

### Confirmación de recepción

```
📄 Hemos recibido tu ticket. Estamos procesándolo para generar tu factura. Te notificaremos cuando esté lista.
```

### Factura generada

```
✅ Tu factura #123 ha sido generada exitosamente.

Total: $1,160.00

Puedes descargarla desde nuestro portal.
```

### Error

```
❌ Hubo un error procesando tu solicitud:

No pudimos extraer los datos de tu ticket. Por favor, envía una imagen más clara.

Por favor, intenta de nuevo o contacta a soporte.
```

## Testing

### Probar envío de mensajes

```bash
curl -X POST http://localhost:3000/api/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+52XXXXXXXXXX",
    "message": "Hola desde la API"
  }'
```

### Simular webhook entrante

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+52XXXXXXXXXX" \
  -d "Body=Hola" \
  -d "MessageSid=SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

## Seguridad

### Validar firma de Twilio

Agrega validación de firma en el webhook:

```typescript
import { validateRequest } from 'twilio';

const isValid = validateRequest(
  process.env.TWILIO_AUTH_TOKEN!,
  req.headers['x-twilio-signature'] as string,
  `https://tu-dominio.com${req.url}`,
  req.body
);

if (!isValid) {
  return res.status(403).send('Forbidden');
}
```

### Rate limiting

Limita mensajes por usuario:

```typescript
const rateLimitMap = new Map();

// Máximo 5 mensajes por hora
const MAX_MESSAGES = 5;
const TIME_WINDOW = 3600000; // 1 hora

if (rateLimitMap.get(telefono) >= MAX_MESSAGES) {
  await WhatsAppService.sendMessage(
    telefono,
    'Has excedido el límite de mensajes. Por favor, intenta más tarde.'
  );
  return;
}
```

## Costos

### Sandbox (Gratis)
- Ilimitado para pruebas
- Solo números autorizados pueden enviar mensajes

### Producción
- Costo por conversación iniciada
- Varía según el país
- Ver pricing en [Twilio Pricing](https://www.twilio.com/whatsapp/pricing)

## Troubleshooting

### No recibo mensajes en el webhook

- Verifica que el webhook esté configurado correctamente
- Revisa que tu servidor sea accesible públicamente
- Revisa los logs de Twilio en el dashboard

### Error enviando mensajes

- Verifica credenciales en `.env`
- Asegúrate de que el número destino tenga el prefijo correcto
- Revisa el formato del número: `whatsapp:+52XXXXXXXXXX`

### Imágenes no se descargan

- Verifica permisos del directorio `uploads/`
- Revisa que MediaUrl esté presente en el webhook
- Verifica conectividad de red

## Recursos

- [Twilio WhatsApp Quickstart](https://www.twilio.com/docs/whatsapp/quickstart)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Twilio Console](https://console.twilio.com/)
