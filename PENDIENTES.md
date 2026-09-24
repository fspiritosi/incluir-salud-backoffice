# Pendientes

## Subtipos de prestación (con monto asociado por subtipo)

**Objetivo:** Poder crear subtipos dentro de un `tipo_prestacion` (por ejemplo, subtipos de Kinesiología como "Kinesiología respiratoria", "Kinesiología motora"), cada uno con su propio monto. El sistema debe ser genérico para poder usarse a futuro también en `Acompañante Terapeutico` y `Transporte`, gestionable 100% desde el backoffice (sin tocar código).

**Confirmado con el usuario:** los cambios son aditivos (tabla nueva + columna nullable) y **no rompen la app móvil** (`/home/diego/Documentos/GitHub/incluir-salud-movil`), porque esa app siempre usa `select` con columnas explícitas o RPCs, nunca `select *`, y los `insert`/`update` también son explícitos.

### 1. Migración SQL

- Crear tabla `subtipos_prestacion`:
  ```sql
  create table subtipos_prestacion (
    id uuid primary key default gen_random_uuid(),
    tipo_prestacion tipo_prestacion not null,  -- mismo enum ya usado en prestaciones.tipo_prestacion
    nombre text not null,
    valor numeric not null,
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tipo_prestacion, nombre)
  );
  ```
- Agregar columna en `prestaciones`:
  ```sql
  alter table prestaciones
    add column subtipo_prestacion_id uuid references subtipos_prestacion(id);
  ```
- (Opcional) RLS policies en `subtipos_prestacion` siguiendo el mismo patrón que `obras_sociales` / `centros`.

### 2. Pantalla CRUD de administración en el backoffice

- Nueva sección "Subtipos de prestación" (similar a como se gestionan `obras_sociales` o `centros`).
- Permite: crear, editar, activar/desactivar un subtipo.
- Al crear/editar: elegir `tipo_prestacion` (dropdown con los 3 valores del enum), definir `nombre` y `valor`.

### 3. Cambios en `PrestacionForm.tsx`

Archivo: `@/home/diego/Documentos/GitHub/incluir-BackOffiece/incluir-backoffice/components/prestaciones/PrestacionForm.tsx`

- Al elegir `tipo_prestacion`, consultar `subtipos_prestacion` filtrando por `tipo_prestacion = <valor elegido>` y `activo = true`.
- Si hay subtipos para ese tipo → mostrar selector de subtipo.
- Si no hay subtipos para ese tipo (ej. hoy no hay para AT/Transporte) → no mostrar el selector, comportamiento actual sin cambios.
- Al elegir un subtipo → autocompletar el campo `monto` con el `valor` del subtipo (el usuario puede seguir editándolo a mano si quiere ajustar).
- Guardar `subtipo_prestacion_id` en la prestación al crear/editar.

### 4. Ajustes opcionales en listados/reportes

- Evaluar si conviene mostrar el subtipo en `app/protected/prestaciones/actions.ts` (listPrestaciones) y en las tablas/reportes relacionados (`app/protected/reportes/actions.ts`).
- No es bloqueante para la primera versión.

### Alcance de la autogestión (confirmado con el usuario)

- Los subtipos los **crean los usuarios administrativos** desde el backoffice, sin intervención de desarrollo.
- **Habilitar/deshabilitar**: el flag `activo` es el mecanismo. `activo = false` solo lo oculta del selector al crear/editar prestaciones (`activo = true` en el filtro); no desasigna prestaciones existentes.
- Las prestaciones ya creadas con un subtipo deshabilitado **conservan** su `subtipo_prestacion_id`.
- **Borrado:** decidir si se permite. Recomendado: no permitir borrado, solo deshabilitar; o permitir borrar solo si no tiene prestaciones asociadas (la FK igual protegería el caso).
- Los `tipo_prestacion` siguen siendo el enum fijo de 3 valores: los subtipos son libres, los tipos no.

### Datos que faltan definir antes de implementar

- [ ] Lista de subtipos de Kinesiología que se necesitan y su monto de cada uno.
- [ ] Si el subtipo se puede editar después de creada la prestación, o solo se define al crearla.
- [ ] Si el selector de subtipo debe ser obligatorio u opcional cuando el tipo tiene subtipos configurados.

### Impacto en la app móvil (revisado — no requiere cambios)

La app (`incluir-salud-movil`) **no necesita ningún cambio** para que el feature funcione:

- La columna `subtipo_prestacion_id` es nullable y la app nunca hace `select *` ni inserta en `prestaciones` — todas las lecturas son por RPC o `select` con columnas explícitas.
- Las RPC que usa la app (`obtener_prestaciones_con_coordenadas_v2`, `obtener_prestaciones_pendientes_centro`, `validar_prestaciones_centro`, `cerrar_prestacion_con_validacion`, las de transporte, `sugerir_ubicacion_*`) usan columnas explícitas o `SELECT *` sobre CTEs internas — ninguna se rompe con la columna nueva.
- El flujo de validación/completado no toca `tipo_prestacion` ni `monto`, solo `estado`/timestamps/ubicación.

**Mejoras opcionales a futuro (no bloqueantes):**

- Si se quiere que el AT vea el nombre del subtipo en la app (ej. "Kinesiología respiratoria"), habría que devolverlo en `obtener_prestaciones_con_coordenadas_v2` / `obtener_prestaciones_pendientes_centro` y mostrarlo en el card.
- `programar_prestaciones_cronicas` (cron mensual) copia columnas explícitas — si una prestación crónica tiene subtipo, el mes siguiente se crearía sin él. Si aplica, agregar `subtipo_prestacion_id` a esa función.

---

## Corrección de importación de pacientes (ubicación)

**Estado:** Ya implementado (no pendiente), documentado acá como referencia.

- `app/api/pacientes/import/step/route.ts`: ahora solo se geocodifica si el paciente es nuevo o si `ubicacion` es `null` en la base. Si ya tiene `ubicacion` guardada, no se toca (aunque cambie la dirección en el Excel), evitando pisarla con `null` cuando Mapbox no geocodifica.
- Quedan **14.574 pacientes** con `ubicacion = null` de antes de este fix. No se re-geocodificaron todavía (pendiente decidir si se hace un proceso de backfill).

---

## Filtro/auditoría de cierres excepcionales de prestaciones

**Estado:** ⏳ Pendiente — depende de la tarea 6 de la app (`incluir-salud-movil/PENDIENTES.md`).

Cuando la app implemente "cerrar fuera de rango con motivo", esas prestaciones quedan `completada` con:
- `notas` con prefijo `[CIERRE FUERA DE RANGO] {motivo}` (y ya existe `[CIERRE ANTICIPADO]` por duración)
- `ubicacion_cierre` real y `distancia_validacion` con la distancia real (>50 m)

**Trabajo en backoffice:**
- Agregar en el listado de prestaciones un filtro o badge para detectarlas: `notas LIKE '[CIERRE FUERA DE RANGO]%'` / `'[CIERRE ANTICIPADO]%'` y/o `distancia_validacion > 50`.
- El admin revisa cada una y decide si queda `completada` o se revierte (reabrir/cancelar).
- Opcional: incluir en el mismo filtro las `auto_cerrada = true` (cierres automáticos del cron 23:59) para auditarlas también.
- Las columnas ya existen en `prestaciones` — solo falta el filtro/vista.

---

## Sistema de tickets de soporte (contraparte de la tarea 11 de la app)

**Estado:** ⏳ Pendiente. Diseño completo en `incluir-salud-movil/PENDIENTES.md` (tarea 11) — reemplaza el botón "Llamar a soporte" de la app por un sistema de tickets propio.

**Trabajo en backoffice:**
- Tabla `tickets_soporte` (nueva, ver diseño en el PENDIENTES de la app) — `user_id`, `categoria`, `mensaje`, `estado`, `leido`, `prestacion_id`/`jornada_id` opcional, timestamps.
- Nueva sección "Tickets de soporte": listado con filtro por estado/usuario/fecha, vista de detalle, cambio de estado, marcar como leído.
- **Notificación al equipo (decidido con el usuario):**
  1. **Email automático** al crearse un ticket — vía Supabase database webhook/trigger que dispara una función (Edge Function) con un proveedor de email (verificar si ya hay uno integrado en el proyecto, sino elegir uno).
  2. **Contador de no leídos**: al entrar al backoffice, mostrar un badge/apartado con la cantidad de tickets `leido = false` (o `estado = 'abierto'`) — visible en el layout principal o dashboard, mismo patrón que un contador de notificaciones.
- RLS: los profesionales solo ven/crean sus propios tickets desde la app; el backoffice (admin) ve y gestiona todos.

**Depende de:** que se implemente primero la tarea 11 en la app (formulario + tabla + envío offline).
