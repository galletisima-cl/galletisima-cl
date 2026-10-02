# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Descuentos automáticos

Antes de publicar esta funcionalidad, aplicar la migración
`supabase/migrations/20261001010000_add_order_discounts.sql` en Supabase.
Agrega los campos que conservan el desglose de descuentos de cada pedido.
La migración no crea ni activa promociones.

En **Administración → Descuentos** se pueden crear, editar, activar y eliminar
promociones de envío gratis, monto total, producto o monto mínimo de compra.
Los valores son porcentajes enteros o montos en pesos chilenos; un descuento
fijo por producto se aplica por unidad y a todas sus medidas. Los mínimos
consideran el subtotal original de productos, sin envío.

Se elige el mayor ahorro entre los descuentos por producto y el descuento al
total; el envío gratis se puede combinar. El checkout consulta y recalcula
precios, envío y promociones en el servidor. Si el total cambia antes de pagar,
el cliente debe confirmar el nuevo importe. Los pedidos de total cero no se
envían a Webpay.

`npm test` ejecuta las pruebas del catálogo, descuentos, checkout y avisos de
estado e Instagram (con servicios externos simulados), y compila la aplicación con Next.js.

## Avisos de estado y seguimiento

Antes de desplegar, aplicar también
`supabase/migrations/20261001020000_order_status_notifications.sql` en Supabase.
Agrega los datos de seguimiento y el historial de avisos; no modifica estados
existentes ni envía correos antiguos. Requiere las variables de servidor ya
usadas por la tienda: `SUPABASE_URL` (o `NEXT_PUBLIC_SUPABASE_URL`),
`SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_SECRET_KEY`), `RESEND_API_KEY` y
`RESEND_FROM_EMAIL`. `SELLER_NOTIFICATION_EMAIL` es la dirección de respuesta.

Los cambios de estado desde la tabla o el editor de pedidos pasan por
`POST /api/orders/status`, que verifica el usuario y su rol de administrador.
El estado y su aviso pendiente se guardan juntos en una transacción. Al elegir
**Enviado** se solicitan número y enlace de seguimiento; la empresa es opcional.
Corregir esos datos mientras está Enviado genera un nuevo aviso. Guardar el
mismo estado sin cambios reutiliza el aviso anterior. El cliente también puede
ver el seguimiento en `/seguimiento` usando su número de pedido y correo.

Los avisos se envían inmediatamente al correo guardado en el pedido. Si el
proveedor falla, la lista muestra **Correo sin confirmar** y el detalle permite
**Reintentar correo**, incluso después de recargar. El contenido y la clave de
envío se conservan para el reintento. **Correo enviado** significa que Resend
aceptó el mensaje; no confirma entrega ni lectura. No se instaló un proceso de
reintentos en segundo plano. La confirmación de compra de Webpay conserva su
correo existente; estos avisos cubren los cambios administrativos de estado.

Resend mantiene las [claves de idempotencia durante 24 horas](https://resend.com/docs/dashboard/emails/idempotency-keys).
Por precaución, los intentos sin confirmación se bloquean al cumplir 23 horas
desde el primer intento: un administrador debe revisar en Resend la clave
`order-status-<id del aviso>` antes de resolver manualmente el registro o
reenviar. No borrar `email_payload` ni `first_attempt_at` sin confirmar primero
si el proveedor aceptó el mensaje, porque podría producir duplicados.

## Galería de Instagram

La portada muestra hasta 12 publicaciones, con seis imágenes visibles en
escritorio y dos en móvil. Los reels usan su imagen de portada y cada tarjeta
abre la publicación original. Sin conexión se conserva el enlace al perfil.

Para activar la integración:

1. Aplicar las migraciones `20261002010000_instagram_connection.sql` y
   `20261002020000_instagram_facebook_login.sql`.
2. Configurar una aplicación de Meta con **Instagram API with Instagram Login**
   para una cuenta profesional (empresa o creador), con el permiso de lectura
   `instagram_business_basic`. Preparar el acceso de la cuenta en el panel de
   Meta y completar los requisitos que indique para el modo de la aplicación.
3. Registrar exactamente `https://www.galletisima.cl/api/instagram/callback`
   como URI de redirección. Usar el mismo dominio para entrar a administración
   e iniciar la conexión, porque la autorización se valida con una cookie.
4. Configurar en el servidor `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`,
   `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_GRAPH_API_VERSION` (por defecto `v25.0`)
   y `NEXT_PUBLIC_SITE_URL`. Los dos primeros son los de la aplicación de
   Instagram; nunca llevan el prefijo `NEXT_PUBLIC_`. Se usan también las
   credenciales de servidor de Supabase existentes. Consultar `.env.example`.
5. Publicar y abrir **Administración → Banners → Publicaciones de Instagram →
   Conectar con Instagram**. La autorización se completa en Instagram; la tienda
   no pide la contraseña. El panel permite actualizar, reconectar y desconectar.

También se puede conectar mediante Facebook cuando el administrador gestiona
la página vinculada a Instagram. Crear una configuración de **Facebook Login
for Business** con token de usuario y permisos `instagram_basic` y
`pages_show_list`; seleccionar solo la página y cuenta de la tienda al autorizar.
Registrar la misma URI de callback en Facebook Login y configurar en el servidor
`INSTAGRAM_FACEBOOK_APP_ID`, `INSTAGRAM_FACEBOOK_APP_SECRET`,
`INSTAGRAM_FACEBOOK_CONFIG_ID` e `INSTAGRAM_FACEBOOK_ACCOUNT_ID` (ID de la cuenta
profesional de Instagram). El panel habilita **Conectar con Facebook**. El servidor
comprueba esa cuenta fija y utiliza tokens de usuario de larga duración; no
necesita permisos para mensajes, anuncios ni publicar contenido.

Las credenciales y los estados de autorización se guardan en tablas privadas,
accesibles solo por `service_role`, nunca en `site_settings` ni en la respuesta
pública. Desconectar elimina la conexión local y las autorizaciones pendientes;
los permisos concedidos a la aplicación también se pueden retirar en Instagram.

La galería se actualiza al recibir visitas, como máximo una vez cada 15 minutos.
Con Instagram Login se renueva el acceso cuando le quedan menos de 30 días.
Facebook Login requiere volver a autorizar antes de que caduque su token de
larga duración (habitualmente 60 días); el panel muestra la fecha de vencimiento.
No se intenta renovar un token de Facebook en el endpoint de Instagram.
No hay una tarea programada: si no se visita la tienda antes del vencimiento,
será necesario reconectar. Los fallos temporales conservan la última galería
durante un máximo de 24 horas; un permiso revocado o vencido oculta la galería.
Las imágenes se leen desde la CDN de Meta y no se copian al almacenamiento de
la tienda. Si una imagen deja de estar disponible, se mantiene el enlace a su
publicación.

Las pruebas locales simulan Meta y Supabase. La autorización real y la lectura
de publicaciones deben verificarse al configurar y autorizar la cuenta.
Referencias: [API oficial de Meta](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login),
[Instagram con Facebook Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/get-started)
y [componente de Instagram de Jumpseller](https://es.jumpseller.com/support/component-instagram/).

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
