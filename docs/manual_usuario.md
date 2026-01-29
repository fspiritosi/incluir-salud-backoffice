# Manual de Usuario - Backoffice Incluir Salud

---

## Índice

1. [Introducción](#introducción)
2. [Inicio de Sesión](#inicio-de-sesión)
3. [Navegación Principal](#navegación-principal)
4. [Gestión de Beneficiarios](#gestión-de-beneficiarios)
   - [Ver listado de beneficiarios](#ver-listado-de-beneficiarios)
   - [Crear un nuevo beneficiario](#crear-un-nuevo-beneficiario)
   - [Editar un beneficiario](#editar-un-beneficiario)
   - [Importar padrón mensual](#importar-padrón-mensual)
5. [Gestión de Prestaciones](#gestión-de-prestaciones)
   - [Ver listado de prestaciones](#ver-listado-de-prestaciones)
   - [Crear una nueva prestación](#crear-una-nueva-prestación)
   - [Crear prestaciones en bulk (por centro)](#crear-prestaciones-en-bulk-por-centro)
   - [Reasignar prestaciones](#reasignar-prestaciones)
6. [Gestión de Centros](#gestión-de-centros)
   - [Ver listado de centros](#ver-listado-de-centros)
   - [Crear un nuevo centro](#crear-un-nuevo-centro)
   - [Editar un centro](#editar-un-centro)
7. [Gestión de Transporte](#gestión-de-transporte)
   - [Ver prestaciones de transporte](#ver-prestaciones-de-transporte)
   - [Crear prestación de transporte](#crear-prestación-de-transporte)
8. [Gestión de Prestadores](#gestión-de-prestadores)
9. [Administración de Usuarios y Roles](#administración-de-usuarios-y-roles)
10. [Roles y Permisos](#roles-y-permisos)

---

## Introducción

Bienvenido al **Backoffice de Incluir Salud Mendoza**. Este sistema permite gestionar de forma integral:

- **Beneficiarios**: Pacientes que reciben prestaciones de salud
- **Prestaciones**: Servicios asignados a los beneficiarios
- **Centros**: Lugares donde se brindan las prestaciones (geriátricos, centros de día, etc.)
- **Transporte**: Prestaciones de traslado de beneficiarios
- **Prestadores**: Profesionales que brindan los servicios
- **Usuarios del sistema**: Administración de roles y permisos

![Captura: Pantalla principal del backoffice]
<!-- INSERTAR CAPTURA: Vista general del dashboard principal -->

---

## Inicio de Sesión

Para acceder al backoffice:

1. Ingrese a la URL del sistema
2. Introduzca su **correo electrónico** registrado
3. Introduzca su **contraseña**
4. Haga clic en el botón **"Iniciar sesión"**

> **Nota:** Si no tiene credenciales, contacte al administrador del sistema para que le cree una cuenta y asigne los roles correspondientes.

![Captura: Pantalla de login]
<!-- INSERTAR CAPTURA: Formulario de inicio de sesión -->

---

## Navegación Principal

El sistema cuenta con una **barra lateral (sidebar)** que permite acceder a todas las secciones:

| Sección | Descripción |
|---------|-------------|
| **Beneficiarios** | Gestión de pacientes |
| **Prestaciones** | Gestión de servicios asignados |
| **Centros** | Administración de centros de atención |
| **Transporte** | Prestaciones de traslado |
| **Prestadores** | Gestión de profesionales |
| **Administración** | Gestión de usuarios y roles (solo Super Admin) |

![Captura: Sidebar de navegación]
<!-- INSERTAR CAPTURA: Menú lateral con todas las opciones -->

---

## Gestión de Beneficiarios

### Ver listado de beneficiarios

1. En el menú lateral, haga clic en **"Beneficiarios"**
2. Se mostrará una tabla con todos los beneficiarios registrados
3. Puede **filtrar** por:
   - Búsqueda de texto (nombre, documento, etc.)
   - Ciudad
   - Estado activo/inactivo
4. Use la **paginación** en la parte inferior para navegar entre páginas

![Captura: Listado de beneficiarios]
<!-- INSERTAR CAPTURA: Tabla de beneficiarios con filtros -->

---

### Crear un nuevo beneficiario

**Roles requeridos:** Administrativo, Auditor o Super Admin

1. Desde la página de Beneficiarios, haga clic en el botón **"Nuevo Beneficiario"**
2. Complete el formulario con los datos del paciente:
   - **Datos personales**: Nombre, apellido, documento, fecha de nacimiento
   - **Datos de contacto**: Teléfono, email
   - **Ubicación**: Dirección, ciudad, provincia
   - **Datos de obra social**: Número de afiliado, obra social
3. Haga clic en **"Guardar"** para registrar el beneficiario

![Captura: Formulario de nuevo beneficiario]
<!-- INSERTAR CAPTURA: Formulario completo de creación de beneficiario -->

---

### Editar un beneficiario

1. En el listado de beneficiarios, localice el paciente a editar
2. Haga clic en el **ícono de editar** o en el nombre del beneficiario
3. Modifique los campos necesarios
4. Haga clic en **"Guardar cambios"**

![Captura: Edición de beneficiario]
<!-- INSERTAR CAPTURA: Formulario de edición con datos cargados -->

---

### Importar padrón mensual

**Roles requeridos:** Administrativo, Auditor o Super Admin

Esta funcionalidad permite cargar masivamente beneficiarios desde el padrón oficial mensual (archivo Excel).

#### Pasos para importar:

1. Desde la página de Beneficiarios, haga clic en **"Importar padrón"**
2. Prepare el archivo Excel:
   - Use el padrón oficial sin modificar columnas
   - Asegúrese de que la hoja **"PROFE"** contenga los datos
   - No deje filas vacías entre los registros
3. Haga clic en **"Seleccionar archivo"** y elija el archivo .xlsx
4. Haga clic en **"Importar"**
5. Espere mientras el sistema procesa el archivo (verá una barra de progreso)

#### Resultados de la importación:

El sistema mostrará un resumen con:

| Métrica | Descripción |
|---------|-------------|
| **Procesadas** | Total de filas leídas |
| **Altas (nuevas)** | Beneficiarios nuevos agregados |
| **Actualizadas** | Beneficiarios existentes actualizados |
| **Bajas** | Beneficiarios que ya no aparecen en el padrón |
| **Prestaciones canceladas** | Prestaciones canceladas por baja del beneficiario |
| **Geolocalizados** | Direcciones procesadas para geolocalización |
| **Errores** | Filas con problemas (se detallan en una tabla) |

![Captura: Pantalla de importación]
<!-- INSERTAR CAPTURA: Formulario de importación con archivo seleccionado -->

![Captura: Resultado de importación]
<!-- INSERTAR CAPTURA: Resumen de resultados post-importación -->

---

## Gestión de Prestaciones

### Ver listado de prestaciones

1. En el menú lateral, haga clic en **"Prestaciones"**
2. Se mostrarán dos pestañas:
   - **Todas**: Listado completo de prestaciones
   - **Reasignar**: Prestaciones pendientes de reasignación
3. Puede filtrar por:
   - Fecha desde/hasta
   - Beneficiario

![Captura: Listado de prestaciones]
<!-- INSERTAR CAPTURA: Tabla de prestaciones con filtros -->

---

### Crear una nueva prestación

**Roles requeridos:** Auditor o Super Admin

1. Desde la página de Prestaciones, haga clic en **"Nueva Prestación"**
2. Complete el formulario:
   - **Beneficiario**: Seleccione el paciente
   - **Tipo de prestación**: Elija el tipo de servicio
   - **Prestador**: Seleccione el profesional que brindará el servicio
   - **Centro** (opcional): Si aplica, seleccione el centro de atención
   - **Obra social**: Seleccione la cobertura
   - **Fechas**: Fecha de inicio y fin de la prestación
   - **Observaciones**: Notas adicionales
3. Haga clic en **"Guardar"**

![Captura: Formulario de nueva prestación]
<!-- INSERTAR CAPTURA: Formulario completo de creación de prestación -->

---

### Crear prestaciones en bulk (por centro)

**Roles requeridos:** Auditor o Super Admin

Esta funcionalidad permite crear prestaciones de **Acompañante Terapéutico** para todos los pacientes asignados a un geriátrico de forma masiva.

1. Desde la página de Prestaciones, haga clic en **"Crear por Centro"**
2. Seleccione el **Centro geriátrico**
3. Seleccione el **Prestador** (Acompañante Terapéutico)
4. Configure las fechas de la prestación
5. Haga clic en **"Crear prestaciones"**

El sistema creará automáticamente una prestación para cada paciente asignado a ese centro.

![Captura: Crear prestaciones por centro]
<!-- INSERTAR CAPTURA: Formulario de creación bulk por centro -->

---

### Reasignar prestaciones

Cuando un prestador cancela o no puede continuar con sus servicios, las prestaciones quedan pendientes de reasignación.

1. Vaya a **Prestaciones** > pestaña **"Reasignar"**
2. Verá las prestaciones que requieren nuevo prestador
3. Para cada prestación:
   - Haga clic en **"Reasignar"**
   - Seleccione el nuevo prestador de la lista
   - Confirme la reasignación

![Captura: Reasignación de prestaciones]
<!-- INSERTAR CAPTURA: Tabla de prestaciones a reasignar con opciones -->

---

## Gestión de Centros

### Ver listado de centros

**Roles requeridos:** Transporte, Administrativo, Auditor o Super Admin

1. En el menú lateral, haga clic en **"Centros"**
2. Se mostrará una tabla con todos los centros registrados
3. Puede filtrar por:
   - Búsqueda de texto (nombre)
   - Tipo de centro
   - Estado activo/inactivo

![Captura: Listado de centros]
<!-- INSERTAR CAPTURA: Tabla de centros con filtros -->

---

### Crear un nuevo centro

1. Desde la página de Centros, haga clic en **"Nuevo Centro"**
2. Complete el formulario:
   - **Nombre del centro**
   - **Tipo**: Geriátrico, Centro de día, Hospital, etc.
   - **Dirección completa**: Calle, número, ciudad, provincia
   - **Contacto**: Teléfono, email
   - **Ubicación**: Se geolocalizará automáticamente
3. Haga clic en **"Guardar"**

![Captura: Formulario de nuevo centro]
<!-- INSERTAR CAPTURA: Formulario completo de creación de centro -->

---

### Editar un centro

1. En el listado de centros, haga clic en el centro a editar
2. Modifique los campos necesarios
3. Haga clic en **"Guardar cambios"**

![Captura: Edición de centro]
<!-- INSERTAR CAPTURA: Formulario de edición de centro -->

---

## Gestión de Transporte

### Ver prestaciones de transporte

**Roles requeridos:** Transporte, Auditor o Super Admin

1. En el menú lateral, haga clic en **"Transporte"**
2. Se mostrarán las prestaciones de tipo transporte
3. Dos pestañas disponibles:
   - **Prestaciones**: Listado de traslados programados
   - **Reasignar**: Traslados pendientes de reasignación
4. Puede filtrar por:
   - Búsqueda de texto
   - Ciudad
   - Fechas
   - Estado

![Captura: Listado de transporte]
<!-- INSERTAR CAPTURA: Tabla de prestaciones de transporte -->

---

### Crear prestación de transporte

1. Desde la página de Transporte, haga clic en **"Nueva Prestación de Transporte"**
2. Complete el formulario:
   - **Beneficiario**: Seleccione el paciente a trasladar
   - **Prestador de transporte**: Seleccione el proveedor del servicio
   - **Centro de destino**: Lugar donde se llevará al paciente
   - **Sentido del transporte**:
     - **Ida**: Del domicilio del beneficiario al centro
     - **Vuelta**: Del centro al domicilio del beneficiario
     - **Ida y vuelta**: Ambos trayectos (crea 2 prestaciones)
   - **Fechas**: Período de la prestación

> **Nota sobre orígenes y destinos:**
> - En viajes de **ida**: El origen es el domicilio del beneficiario
> - En viajes de **vuelta**: El origen es el centro de tratamiento

3. Haga clic en **"Guardar"**

![Captura: Formulario de transporte]
<!-- INSERTAR CAPTURA: Formulario de creación de prestación de transporte -->

---

## Gestión de Prestadores

1. En el menú lateral, haga clic en **"Prestadores"**
2. Se mostrará una tabla con todos los profesionales registrados
3. Puede ver información de cada prestador:
   - Nombre y apellido
   - Documento
   - Especialidad
   - Estado (activo/inactivo)

**Funciones disponibles:**
- **Activar/Desactivar** un prestador (roles Auditor o Super Admin)
- Ver detalles del prestador

![Captura: Listado de prestadores]
<!-- INSERTAR CAPTURA: Tabla de prestadores -->

---

## Administración de Usuarios y Roles

**Acceso exclusivo:** Super Admin

### Acceder a la administración

1. En el menú lateral, vaya a **"Administración"** > **"Usuarios"**
2. Se mostrará una tabla con todos los usuarios del backoffice

### Ver información de usuarios

Para cada usuario se muestra:
- Nombre completo
- Email
- Documento
- Roles asignados
- Fecha de creación
- Último acceso

![Captura: Administración de usuarios]
<!-- INSERTAR CAPTURA: Tabla de usuarios del backoffice -->

### Asignar un rol a un usuario

1. Localice el usuario en la tabla
2. Haga clic en el botón **"Agregar rol"**
3. Seleccione el rol del menú desplegable:
   - Administrativo
   - Auditor
   - Transporte
   - Super Admin
4. El rol se asignará inmediatamente

### Quitar un rol a un usuario

1. Localice el usuario en la tabla
2. En la columna de roles, verá los roles actuales con una **"X"**
3. Haga clic en la **"X"** del rol que desea quitar
4. El rol se eliminará inmediatamente

> **Importante:** Debe haber al menos un Super Admin activo en el sistema. No podrá quitar el rol de Super Admin si es el único.

![Captura: Asignación de roles]
<!-- INSERTAR CAPTURA: Menú de asignación de roles -->

---

## Roles y Permisos

El sistema cuenta con los siguientes roles:

| Rol | Permisos |
|-----|----------|
| **Usuario** | Acceso básico de lectura |
| **Administrativo** | Crear/editar beneficiarios, importar padrón, gestionar centros |
| **Auditor** | Todo lo de Administrativo + crear/editar prestaciones, activar/desactivar prestadores |
| **Transporte** | Gestión de prestaciones de transporte y centros |
| **Super Admin** | Acceso completo + administración de usuarios y roles |

### Resumen de permisos por funcionalidad

| Funcionalidad | Administrativo | Auditor | Transporte | Super Admin |
|---------------|----------------|---------|------------|-------------|
| Ver beneficiarios | ✅ | ✅ | ✅ | ✅ |
| Crear/editar beneficiarios | ✅ | ✅ | ❌ | ✅ |
| Importar padrón | ✅ | ✅ | ❌ | ✅ |
| Ver prestaciones | ✅ | ✅ | ✅ | ✅ |
| Crear/editar prestaciones | ❌ | ✅ | ❌ | ✅ |
| Gestionar centros | ✅ | ✅ | ✅ | ✅ |
| Gestionar transporte | ❌ | ✅ | ✅ | ✅ |
| Activar/desactivar prestadores | ❌ | ✅ | ❌ | ✅ |
| Administrar usuarios | ❌ | ❌ | ❌ | ✅ |

---

## Soporte

Para consultas o problemas técnicos, contacte al administrador del sistema.

---

**Incluir Salud Mendoza** - Manual de Usuario v1.0
