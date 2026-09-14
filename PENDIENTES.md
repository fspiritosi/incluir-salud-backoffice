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

### Datos que faltan definir antes de implementar

- [ ] Lista de subtipos de Kinesiología que se necesitan y su monto de cada uno.
- [ ] Si el subtipo se puede editar después de creada la prestación, o solo se define al crearla.
- [ ] Si el selector de subtipo debe ser obligatorio u opcional cuando el tipo tiene subtipos configurados.

---

## Corrección de importación de pacientes (ubicación)

**Estado:** Ya implementado (no pendiente), documentado acá como referencia.

- `app/api/pacientes/import/step/route.ts`: ahora solo se geocodifica si el paciente es nuevo o si `ubicacion` es `null` en la base. Si ya tiene `ubicacion` guardada, no se toca (aunque cambie la dirección en el Excel), evitando pisarla con `null` cuando Mapbox no geocodifica.
- Quedan **14.574 pacientes** con `ubicacion = null` de antes de este fix. No se re-geocodificaron todavía (pendiente decidir si se hace un proceso de backfill).
