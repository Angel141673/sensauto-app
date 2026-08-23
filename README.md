# SENSAUTO — Panel interno

Aplicación interna para SENSAUTO Motor y SUNAUTO. Este repositorio corresponde
al **Bloque 1** del plan de traspaso: persistencia real, autenticación y
separación de datos entre empresas.

## Estado (honesto, según reglas del proyecto)

| Bloque | Estado |
|---|---|
| 1. Persistencia / base de datos real | **IMPLEMENTADO** |
| 2. Autenticación y usuarios | **IMPLEMENTADO** |
| 3. Separación SENSAUTO / SUNAUTO | **IMPLEMENTADO** (esquema + RLS) |
| 4. CRUD de vehículos | **IMPLEMENTADO** |
| 5. Buscador marca/modelo/VIN | **IMPLEMENTADO** |
| 6. Clientes | **IMPLEMENTADO** |
| 7. Documentos | **IMPLEMENTADO** |
| 8. Facturas/gastos + OCR + duplicados | **IMPLEMENTADO** |
| 9. Contratos y firma en tablet | **IMPLEMENTADO** |
| 10. WhatsApp | **IMPLEMENTADO** |
| 11. Cuadros de inversión/margen/previsión | **IMPLEMENTADO** |
| 12. Pulido, seguridad, copias y despliegue | **PARCIAL** — ver `DEPLOY_SEGURIDAD.md` |

## Stack (coste cero para empezar)

- **Next.js** (App Router) — frontend, responsive para móvil/tablet
- **Supabase** — Postgres + Auth + Storage, plan gratuito
- Hosting sugerido: **Vercel** (frontend, gratis) + Supabase (backend, gratis)

## Puesta en marcha

### 1. Crear el proyecto en Supabase
1. Crea una cuenta gratuita en [supabase.com](https://supabase.com) y un proyecto nuevo.
2. En el **SQL Editor** del proyecto, pega y ejecuta el contenido de `supabase/schema.sql`.
   Esto crea las tablas `companies`, `profiles`, `user_companies`, la seguridad
   por fila (RLS) y las dos empresas (SENSAUTO, SUNAUTO) ya sembradas.

### 2. Crear los usuarios reales (Ángel y Vanessa)
1. En Supabase → **Authentication → Users → Add user**, crea un usuario para
   Ángel y otro para Vanessa (email + contraseña provisional).
2. Al crearse, el trigger `handle_new_user` genera automáticamente su fila en
   `profiles`. Si quieres fijar el nombre exacto que se mostrará
   ("Hola Ángel" / "Hola Vanessa"), edita la columna `full_name` de su fila en
   `profiles` desde el **Table Editor** — no hace falta tocar código.
3. Asigna cada usuario a su empresa (o a ambas) insertando filas en
   `user_companies`, por ejemplo:
   ```sql
   insert into user_companies (user_id, company_id)
   values (
     '<uuid-del-usuario>',
     (select id from companies where code = 'SENSAUTO')
   );
   ```

### 3. Ejecutar el esquema de vehículos
En el mismo **SQL Editor**, ejecuta también `supabase/02_vehiculos.sql`.
Crea la tabla `vehicles` con RLS, VIN único por empresa y el índice de
búsqueda por marca/modelo/VIN.

### 4. Ejecutar el esquema de clientes
Ejecuta `supabase/03_clientes.sql`. Crea `clients` y `operations` (el
vínculo cliente-vehículo con su estado: contacto/reserva/compraventa/
entrega/posventa), con un trigger que impide mezclar vehículo y cliente
de empresas distintas en la misma operación.

### 5. Ejecutar el esquema de documentos
Ejecuta `supabase/04_documentos.sql`. Crea el bucket privado `documentos`
en Supabase Storage, sus políticas de acceso por empresa, y la tabla
`documents` con detección de duplicados exactos por hash.

### 6. Ejecutar el resto de esquemas (gastos, firmas, fecha de venta)
En orden: `supabase/05_gastos.sql`, `supabase/06_firmas.sql` (crea también
el bucket `firmas`), `supabase/07_fecha_venta.sql`.

### 7. Configurar variables de entorno
```bash
cp .env.example .env.local
```
Rellena `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los
valores de **Project Settings → API** en Supabase, y `ANTHROPIC_API_KEY`
con una clave de [console.anthropic.com](https://console.anthropic.com) si
quieres activar el análisis de facturas con IA (opcional; sin ella la app
funciona igual, solo sin ese botón).

### 8. Instalar y arrancar
```bash
npm install
npm run dev
```
Abre `http://localhost:3000`. Sin sesión, redirige a `/login`. Al entrar con
las credenciales de Ángel o Vanessa, el dashboard muestra su saludo real y
el selector de empresa según sus membresías.

## Vehículos (Bloque 4)

- `/dashboard/vehiculos` — listado con buscador por marca, modelo o VIN.
  Respeta la empresa activa del selector; con "Resumen conjunto" se ven los
  vehículos de todas las empresas del usuario (solo lectura, sin alta).
- `/dashboard/vehiculos/nuevo` — alta de vehículo.
- `/dashboard/vehiculos/[id]` — ficha del vehículo, con inversión y margen
  calculados a partir del precio de compra/venta. La inversión sumará los
  gastos asociados en el Bloque 8; por ahora se indica explícitamente en
  pantalla que es un cálculo parcial.
- Estados del ciclo de vida: entrada → preparación → disponible → reservado
  → vendido → entregado → posventa (sección 6 del paquete de traspaso).
- Cliente/reserva/venta y documentación aparecen en la ficha como
  "pendiente" hasta que se implementen los Bloques 6 y 7 — no se inventa
  que ya existen.

## Clientes (Bloque 6)

- `/dashboard/clientes` — listado con buscador por nombre, teléfono o DNI/NIF.
- `/dashboard/clientes/nuevo` — alta de cliente.
- `/dashboard/clientes/[id]` — ficha con datos del cliente y sus vehículos
  vinculados (uno o varios), cada uno con su estado de operación: contacto,
  reserva, compraventa, entrega o posventa.
- La ficha de vehículo ahora muestra también los clientes vinculados,
  reemplazando el aviso de "pendiente" del Bloque 4.
- Un trigger en base de datos (`operations_check_consistency`) impide
  vincular un vehículo y un cliente de empresas distintas, incluso si el
  usuario tiene acceso a ambas.
- Documentos, contratos con firma y WhatsApp siguen marcados como
  pendientes en la ficha del cliente hasta sus bloques correspondientes.

## Documentos (Bloque 7)

- `/dashboard/documentos` — subida y listado, filtrable por empresa y tipo
  (documentación del vehículo, factura/gasto, contrato de reserva, contrato
  de compraventa, trámite, otro).
- Cada documento puede vincularse opcionalmente a un vehículo y/o un
  cliente. Un trigger en base de datos impide vincular vehículo/cliente de
  otra empresa.
- **Duplicados**: antes de guardar, se calcula el hash SHA-256 del archivo
  y se compara con lo ya subido en esa empresa. Si coincide, no se sube en
  silencio — se avisa y pide confirmación explícita, igual que hará el OCR
  de facturas en el Bloque 8. (Esto detecta el mismo archivo subido dos
  veces; la detección de facturas duplicadas por contenido —mismo importe,
  mismo proveedor— se añadirá en el Bloque 8 junto al OCR.)
- Almacenamiento en un bucket privado de Supabase Storage
  (`documentos`), con enlaces de descarga firmados y temporales (5 min) —
  nunca URLs públicas permanentes.
- Las fichas de vehículo y cliente muestran ahora sus documentos
  vinculados, con acceso directo a subir uno nuevo ya preseleccionado.

### Próxima extensión ya acordada (Bloque 8)
Al fotografiar una factura o una pieza con el VIN visible, el OCR intentará
reconocer el bastidor en el texto extraído y, si coincide con un vehículo
existente, propondrá vincularlo automáticamente — siempre pidiendo
confirmación antes de guardarlo, nunca de forma silenciosa.

## Gastos / facturas + IA (Bloque 8)

- `/dashboard/gastos` — formulario de alta con foto de factura y listado
  con total acumulado por empresa.
- **Análisis con IA (Claude Haiku 4.5, de pago)**: al pulsar "Analizar con
  IA", la foto se envía a la API de Claude, que devuelve proveedor, fecha,
  base, IVA, total y, si aparece en la imagen, el bastidor/VIN — con mucha
  más fiabilidad que un OCR por patrones de texto. Coste aproximado:
  **menos de un céntimo de euro por factura**. Requiere configurar
  `ANTHROPIC_API_KEY` en `.env.local` (clave de
  [console.anthropic.com](https://console.anthropic.com)). Sin esa clave,
  el botón de análisis muestra un aviso claro, pero el resto de la app
  sigue funcionando con normalidad (se puede rellenar todo a mano).
- Nada se guarda automáticamente: la IA solo *propone* los datos en un
  aviso ("Usar estos datos en el formulario"); el usuario los revisa,
  puede editarlos, y solo se guardan al pulsar "Guardar gasto". Esto es
  exactamente lo que pedía el paquete de traspaso ("no aceptar
  silenciosamente una lectura dudosa").
- **VIN automático**: si la IA detecta un bastidor en la foto (por
  ejemplo, en facturas de piezas) y coincide con un vehículo ya dado de
  alta en la misma empresa, se propone vincularlo — de nuevo, solo tras
  confirmación explícita.

- **Duplicados**, dos niveles:
  - Mismo archivo (hash SHA-256) ya subido en la empresa.
  - Mismo proveedor + fecha + total ya registrado (aunque la foto sea
    distinta) — cubre el caso de subir la misma factura dos veces con
    fotos diferentes.
  - En ambos casos se avisa y se pide confirmación explícita antes de
    guardar; nunca se descarta ni se guarda en silencio.
- La ficha de vehículo ahora calcula la inversión total real: precio de
  compra + suma de gastos vinculados a ese vehículo.

## Contratos y firma en tablet (Bloque 9)

- Desde cada operación (vehículo vinculado a un cliente) en la ficha del
  cliente, botón "Firmar contrato" → `/dashboard/firmas/[operationId]`.
- Panel de firma con canvas HTML5 (dedo o lápiz), sin librería de pago.
- Se elige tipo de contrato (reserva / compraventa), se muestra el texto
  de aceptación correspondiente y una referencia de sello corporativo
  (texto por ahora — sustituible por el sello real cuando esté
  disponible como imagen).
- La firma se archiva como imagen PNG en un bucket privado (`firmas`)
  junto con la fecha de firma (sin hora, según la decisión ya tomada) y
  queda asociada a la operación y al cliente.
- La ficha de cliente lista los contratos ya firmados con enlace para
  ver la firma.

## WhatsApp (Bloque 10)

- En la ficha de cliente, selector de plantilla (contacto, información,
  reserva, documentación, preparación, entrega, posventa) y botón que
  abre WhatsApp con el mensaje predefinido ya escrito, vía enlace
  `wa.me` — sin coste, sin API de pago.
- El teléfono se normaliza automáticamente asumiendo España (+34) si
  el cliente lo introdujo sin prefijo.

## Inversión, márgenes y previsión (Bloque 11)

- `/dashboard/informes` — resumen por empresa (o conjunto): inversión
  acumulada, gastos totales, margen realizado en vehículos vendidos y
  previsión de margen en el resto según el precio de venta previsto.
- Desglose de margen realizado por mes (usando la fecha de venta, campo
  nuevo en la ficha de vehículo) para apoyar el cierre mensual/trimestral.
- Deliberadamente **no** calcula impuestos ni hace previsión fiscal
  automática: es una herramienta de control basada en los datos
  introducidos, tal como pedía el paquete de traspaso. Para REBU y
  cierre fiscal, estos números son el punto de partida para la gestoría,
  no un sustituto.

## Pulido, seguridad, copias y despliegue (Bloque 12)

Ver `DEPLOY_SEGURIDAD.md` para el detalle completo. Resumen: página de
error y 404 añadidas; RLS, triggers de consistencia entre empresas y
enlaces firmados de Storage ya estaban implementados en bloques
anteriores. **Autenticación biométrica y copias de seguridad
automatizadas quedan pendientes** — son decisiones que dependen del
plan de Supabase y de vuestra prioridad, documentadas pero no
implementadas en código para no simular que ya existen.

## Logo corporativo

`public/logo-sensauto.png` ya es el logo real de SENSAUTO Motor (escudo SM
en negro/plata/dorado). Si en algún momento se sustituye, basta con
reemplazar ese archivo manteniendo el mismo nombre — no hace falta tocar
código.

## Reglas de diseño que se mantienen para todos los bloques siguientes

- Ninguna tabla nueva se crea sin `company_id` + RLS siguiendo la plantilla
  documentada al final de `supabase/schema.sql`.
- Ningún nombre de usuario se escribe en el frontend: siempre sale de
  `profiles.full_name` del usuario autenticado.
- Antes de cualquier cambio estructural grande, se revisa este README y el
  estado de bloques para no reinterpretar decisiones ya tomadas.
