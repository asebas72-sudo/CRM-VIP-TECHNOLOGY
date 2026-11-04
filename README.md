# CRM VIP TECHNOLOGY

Software web multiempresa de **inventario, compras y ventas**.

- Las compras se cargan desde la **factura electrónica DIAN (XML)** del proveedor: productos, costos, IVA y seriales entran solos al inventario.
- Precios de venta, **etiquetas QR por producto** y venta escaneando el código.
- Tirilla de venta para impresora térmica (58 / 80 mm).
- Varias empresas y varios usuarios a la vez, cada uno con su rol (admin, bodega, vendedor).

## Stack

| Capa | Tecnología |
|---|---|
| Aplicación | Next.js 16 + TypeScript + Tailwind CSS |
| Base de datos, login y archivos | Supabase (PostgreSQL + Auth + Storage) |
| Seguridad multiempresa | Row Level Security de PostgreSQL |
| Hosting | Render (plan gratis) |
| Mantener despierto | cron-job.org → `/api/salud` cada 10 min |

## Puesta en marcha

### 1. Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com) (región **South America - São Paulo**).
2. Ir a **SQL Editor**, pegar todo el contenido de `supabase/migrations/0001_esquema_inicial.sql` y ejecutar.
3. En **Authentication → Sign In / Providers → Email**, desactivar *Confirm email* mientras se hacen pruebas (opcional).
4. En **Project Settings → API Keys** copiar la *Project URL* y la *Publishable key*.

### 2. Local

```bash
cp .env.example .env.local   # completar con los datos de Supabase
npm install
npm run dev                  # http://localhost:3000
```

Probar el lector de facturas con un XML sin necesidad de base de datos:

```bash
npm run probar-factura -- ruta/a/factura.xml
```

### 3. Render

1. En [render.com](https://render.com) → **New → Blueprint** → elegir este repositorio (usa `render.yaml`).
2. Completar las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Cada `push` a `main` se publica automáticamente.

### Lectura de facturas en foto (opcional)

La pantalla **Compras → Desde foto o manual** lee recibos de caja, facturas de papel y cuentas de
cobro con IA (Claude). Requiere `ANTHROPIC_API_KEY` en `.env.local` y en Render. Sin la clave,
la misma pantalla permite registrar la compra a mano adjuntando la foto como soporte.

### 4. cron-job.org

Crear una tarea que visite `https://<su-app>.onrender.com/api/salud` **cada 10 minutos**.
Así Render no apaga el servidor y Supabase no pausa la base de datos.

## Estructura

```
src/
  app/
    login/            Inicio de sesión y registro
    (app)/            Pantallas internas (requieren sesión)
    api/salud/        Ruta para el cron
  lib/
    facturas/dian.ts  Lector de facturas electrónicas DIAN (UBL 2.1)
    supabase/         Clientes de Supabase (servidor y navegador)
    empresa.ts        Empresa activa y rol del usuario
  proxy.ts            Protege las rutas y refresca la sesión
supabase/migrations/  Esquema SQL de la base de datos
scripts/              Utilidades de línea de comandos
```

> Las facturas reales **no** se suben al repositorio (contienen datos de terceros).

## Procesar facturas de compra (correo)

Lee la cuenta de Gmail configurada y registra las facturas electrónicas (.zip con XML) y los
correos de pago ("Pago de:"). Solo la ve el superadmin, en Ventas > Procesar facturas de compra.

1. En la cuenta de Gmail: activar la verificación en 2 pasos y crear una **contraseña de
   aplicación** (myaccount.google.com/apppasswords).
2. Variables en Render y en `.env.local`: `GMAIL_USUARIO`, `GMAIL_CLAVE_APP` y `CORREO_CRON_TOKEN`.
3. cron-job.org cada 15 minutos: `https://<su-app>.onrender.com/api/correo/procesar?token=<CORREO_CRON_TOKEN>`.
4. Ejecutar la migración `0012_buzon_correo.sql`.