# SENSAUTO — Seguridad, copias y despliegue (Bloque 12)

## Estado real de este bloque

Este bloque es en parte código y en parte decisiones operativas que
dependen de vosotros (plan de pago, dominio, política de copias). Se
marca honestamente qué es cada cosa:

| Elemento | Estado |
|---|---|
| Autenticación por email/contraseña | **IMPLEMENTADO** (Bloque 2) |
| Segregación de datos por empresa (RLS) | **IMPLEMENTADO** (Bloques 1–9) |
| Página de error y 404 | **IMPLEMENTADO** |
| Autenticación biométrica del dispositivo | **PENDIENTE** — ver nota abajo |
| Copias de seguridad automatizadas | **PENDIENTE** — depende del plan de Supabase, ver guía |
| Despliegue en producción (dominio, hosting real) | **PENDIENTE** — pasos documentados abajo, requiere que lo ejecutéis vosotros o me deis acceso |

No se marca nada como implementado si no hay código que lo haga.

## Autenticación biométrica

El paquete de traspaso planteaba "aprovechar autenticación biométrica
del dispositivo cuando la tecnología elegida lo permita". Esto es
técnicamente viable con Supabase Auth + WebAuthn (huella/Face ID del
móvil o tablet), pero es una pieza no trivial: requiere registrar una
credencial por dispositivo y un flujo de alta específico.

**No está implementado.** Para no inventar que existe, queda como
pendiente explícito. Si lo priorizáis, es la siguiente extensión
razonable del Bloque 2 (autenticación).

## Seguridad ya cubierta por el código

- Toda tabla tiene Row Level Security: un usuario solo ve datos de las
  empresas a las que pertenece (`user_has_company_access`).
- Los buckets de Storage (`documentos`, `firmas`) son privados; el
  acceso a archivos usa enlaces firmados y temporales (5 minutos), no
  URLs públicas permanentes.
- Triggers en base de datos impiden mezclar vehículo/cliente/operación
  de empresas distintas, incluso si un usuario tuviera acceso a ambas
  (capa extra sobre RLS, no solo confianza en el frontend).
- Las variables de conexión a Supabase salen de `.env.local`, nunca
  hardcodeadas ni versionadas (`.gitignore` ya las excluye).

## Copias de seguridad

Con el **plan gratuito de Supabase** no hay copias de seguridad
automáticas con recuperación a un punto en el tiempo. Dos opciones,
sin coste o de coste mínimo:

1. **Manual, gratis**: exportar la base de datos periódicamente con
   `pg_dump` (Supabase da la cadena de conexión en Project Settings →
   Database) y guardar el `.sql` resultante en un sitio seguro (Google
   Drive, etc.). Recomendado al menos semanal mientras la app esté en
   uso real.
2. **Automática, de pago**: el plan Pro de Supabase (~25 $/mes)
   incluye copias diarias automáticas. Si el volumen de datos empieza
   a importar de verdad (facturas, contratos firmados), es el primer
   gasto que tendría sentido asumir.

Los documentos y firmas (Storage) no están cubiertos por `pg_dump`;
si se hace copia manual, hay que exportarlos aparte desde el panel de
Storage o vía API.

## Despliegue en producción

1. **Backend**: el proyecto de Supabase ya creado en los bloques
   anteriores sirve tal cual para producción; no hace falta uno nuevo.
2. **Frontend**: desplegar en [Vercel](https://vercel.com) (plan
   gratuito):
   - Sube este proyecto a un repositorio de GitHub/GitLab.
   - En Vercel, "Import Project" desde ese repositorio.
   - Añade las variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y
     `NEXT_PUBLIC_SUPABASE_ANON_KEY` en la configuración del proyecto
     de Vercel (Settings → Environment Variables).
   - Despliega. Vercel da un dominio `*.vercel.app` gratis; se puede
     apuntar un dominio propio (p. ej. `panel.sensauto.es`) desde ahí.
3. **Acceso desde móvil/tablet**: al ser una web responsive, "Añadir a
   pantalla de inicio" desde el navegador del móvil/tablet da una
   experiencia casi de app nativa, sin coste ni tienda de aplicaciones.

## Pendiente real de decidir con vosotros

- Si queréis autenticación biométrica, cuándo priorizarla.
- Qué política de copias de seguridad manual seguir hasta que, si
  procede, se pase a un plan de pago.
- Dominio propio para el despliegue final.
