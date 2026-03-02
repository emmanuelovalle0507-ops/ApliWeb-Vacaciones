# Arquitectura Técnica — Sistema de Control de Vacaciones

## 1. Objetivo del proyecto

Este proyecto implementa una aplicación web profesional para gestionar vacaciones en una organización.

### Qué resuelve

- Un **empleado** solicita vacaciones por rango de fechas.
- Un **manager** aprueba o rechaza la solicitud.
- Si aprueba, se descuenta saldo automáticamente.
- Un **admin** puede ver todo y ajustar saldos.
- El sistema no permite saldo negativo.
- Las operaciones críticas se ejecutan dentro de transacciones.

---

## 2. Stack tecnológico y por qué se usa

## PostgreSQL

### Qué es
Motor de base de datos relacional robusto y maduro.

### Por qué se usa

- Alta confiabilidad para datos críticos (saldos y aprobaciones).
- Excelente soporte de transacciones ACID.
- Bloqueo de filas (`SELECT ... FOR UPDATE`) para evitar condiciones de carrera.
- Tipos avanzados (UUID, JSONB, ENUM) útiles para este dominio.

### Qué se hace con PostgreSQL en este proyecto

- Persistir usuarios, solicitudes, saldos y auditoría.
- Garantizar integridad con constraints y claves foráneas.
- Asegurar consistencia de negocio en concurrencia.

## FastAPI

### Qué es
Framework moderno de Python para construir APIs REST rápidas y tipadas.

### Por qué se usa

- Alto rendimiento.
- Integración natural con tipado y Pydantic.
- Documentación automática en `/docs`.
- Dependencias (`Depends`) ideales para auth, DB y RBAC.

### Qué se hace con FastAPI en este proyecto

- Exponer endpoints por rol (employee/manager/admin).
- Validar entradas/salidas.
- Enrutar llamadas a la capa de servicios.

## SQLAlchemy

### Qué es
ORM de Python para modelar tablas y consultas de forma estructurada.

### Por qué se usa

- Mapeo claro entre entidades de negocio y tablas.
- Facilita mantenibilidad y testeo.
- Compatible con transacciones finas y locking.

### Qué se hace con SQLAlchemy en este proyecto

- Definir modelos (`users`, `vacation_requests`, etc.).
- Ejecutar consultas y bloqueos por fila en procesos críticos.

## Alembic

### Qué es
Herramienta de migraciones para SQLAlchemy.

### Por qué se usa

- Versiona cambios del esquema en equipo.
- Permite evolucionar DB sin cambios manuales descontrolados.

### Qué se hace con Alembic en este proyecto

- Mantener migración inicial del esquema.
- Agregar cambios futuros de forma trazable.

## Next.js

### Qué es
Framework React para frontend web moderno.

### Por qué se usa

- Estructura sólida para apps productivas.
- Buen soporte responsive y escalabilidad.
- Fácil consumo de API REST del backend.

### Qué se hace con Next.js en este proyecto

- Interfaz por roles.
- Flujos de login, creación de solicitud y aprobación/rechazo.

---

## 3. Arquitectura general del sistema

Monorepo con dos aplicaciones principales:

- `apps/api`: backend FastAPI.
- `apps/web`: frontend Next.js.

El backend usa arquitectura por capas:

1. **API/Routers**: endpoints HTTP.
2. **Schemas**: contratos de entrada/salida.
3. **Services**: reglas de negocio y transacciones.
4. **Repositories**: acceso a datos.
5. **Models**: definición ORM de tablas.
6. **Core/DB**: configuración, seguridad y sesiones.

Beneficio: separa responsabilidades y reduce acoplamiento.

---

## 4. Modelo de dominio (negocio)

## Roles

- `EMPLOYEE`
- `MANAGER`
- `ADMIN`

## Entidades clave

- **User**: usuario del sistema y rol.
- **Team**: equipo/departamento lógico para aislar reglas.
- **TeamPolicy**: política versionable por equipo (capacidad diaria y anticipación mínima).
- **VacationBalance**: saldo por usuario y año.
- **VacationRequest**: solicitud y estado.
- **BalanceAdjustment**: historial de ajustes/debitos/creditos.
- **AuditLog**: trazabilidad de acciones críticas.

## Regla crítica

Nunca permitir `available_days < 0`.

---

## 5. Diseño de base de datos (PostgreSQL)

### Tablas principales

1. `users`
2. `teams`
3. `team_policies`
4. `vacation_balances`
5. `vacation_requests`
6. `balance_adjustments`
7. `audit_logs`

### Reglas de integridad

- `CHECK end_date >= start_date`
- `CHECK requested_days > 0`
- `CHECK available_days >= 0`
- `CHECK max_people_off_per_day > 0`
- `CHECK min_notice_days >= 0`
- `UNIQUE (user_id, year)` para balance anual
- FKs para coherencia entre entidades

### Reglas por equipo (aislamiento)

- Cada `user` pertenece a un `team`.
- Cada `vacation_request` guarda `team_id`.
- Las validaciones de capacidad se calculan por `team_id` y por día.
- Un manager solo puede aprobar/rechazar solicitudes de su propio equipo.

### Índices

- Búsqueda por manager/status en pendientes.
- Búsqueda por employee y fechas.
- Índices en columnas de auditoría y ajustes.

---

## 6. Flujo funcional principal

## Solicitud de vacaciones (employee)

1. El empleado envía rango de fechas.
2. Se valida que empleado y manager pertenezcan al mismo equipo.
3. Se calcula anticipación mínima según `team_policies`.
4. Si está fuera de anticipación mínima, `reason` es obligatorio.
5. Se valida capacidad diaria por equipo para cada día del rango.
6. Se crea registro en `PENDING` con `team_id`.
7. Se registra evento en auditoría.

## Aprobación (manager)

1. Se abre transacción.
2. Se bloquea la solicitud (`FOR UPDATE`).
3. Se valida ownership del manager y estado `PENDING`.
4. Se bloquea el balance anual del empleado.
5. Se valida saldo suficiente.
6. Se descuenta `available_days` y aumenta `used_days`.
7. Se marca solicitud `APPROVED`.
8. Se inserta ajuste en `balance_adjustments`.
9. Se inserta `audit_log`.
10. Commit.

## Rechazo (manager)

- Mismo patrón transaccional, sin afectar saldo.
- `decision_comment` obligatorio al rechazar.
- Se cambia estado a `REJECTED` y se audita.

## Configuración de política por equipo (manager/admin)

- Se permite versionar políticas por equipo (`effective_from`, `effective_to`).
- El manager solo puede modificar la política de su equipo.
- Admin puede operar sobre cualquier equipo.
- Cada cambio queda auditado (`TEAM_POLICY_UPDATED`).

## Ajuste manual (admin)

- Transaccional.
- Valida que no deje saldo negativo.
- Registra ajuste y auditoría.

---

## 7. Seguridad

## Autenticación

- JWT con expiración corta.
- Password hashing con bcrypt/passlib.

### Flujo de autenticación (paso a paso)

1. El usuario ingresa email y contraseña en el frontend.
2. El frontend llama a `POST /api/v1/auth/login`.
3. El backend valida credenciales (email + password hash).
4. Si son válidas, genera un JWT con:
   - `sub`: id del usuario
   - `role`: rol del usuario
   - `exp`: expiración del token
5. El frontend guarda ese token de forma segura y lo envía en cada request protegida en:
   - `Authorization: Bearer <token>`

Importante: el usuario final no escribe ni copia el JWT; ese manejo es automático del cliente web.

### Validación del token en backend

Para cada endpoint protegido:

1. FastAPI extrae el bearer token.
2. Se valida firma y expiración del JWT.
3. Se recupera el usuario (`sub`) y se confirma que esté activo.
4. Si algo falla, responde `401`.

## Autorización

- RBAC por rol con `Depends`.
- Validaciones contextuales (manager solo su equipo).

### Flujo de autorización por rol

1. Una vez autenticado, se obtiene el rol del usuario (`EMPLOYEE`, `MANAGER`, `ADMIN`).
2. Cada endpoint declara roles permitidos.
3. Si el rol no está autorizado, responde `403`.
4. Además, se aplican reglas de contexto (ej. manager solo aprueba solicitudes de su equipo).

## Buenas prácticas aplicadas

- Secret de JWT por variable de entorno.
- No hardcodear credenciales en código de producción.

---

## 8. Manejo de errores

Se manejan errores por categorías:

- `401`: autenticación inválida.
- `403`: permisos insuficientes.
- `404`: recurso no encontrado.
- `409`: conflictos de negocio (saldo insuficiente o estado inválido).
- `422`: validación de payload o reglas de política (ej: comentario obligatorio).
- `500`: error inesperado.

Objetivo: respuestas consistentes y trazables para frontend y observabilidad.

---

## 9. Transaccionalidad y concurrencia

Aspecto crítico del proyecto.

### Qué problema se evita

Dos aprobaciones simultáneas que descuenten saldo doblemente.

### Cómo se evita

- Transacciones ACID en operaciones críticas.
- Bloqueo de filas de `vacation_requests` y `vacation_balances`.
- Validaciones de estado antes de modificar.
- Registro de operación en ajustes/auditoría.

---

## 10. Frontend y experiencia de usuario

- Aplicación responsive en Next.js.
- Vistas separadas por rol.
- Consumo de API REST tipada.
- Flujo claro de estados: pendiente, aprobada, rechazada, cancelada.

---

## 11. Observabilidad y auditoría

- Toda acción crítica deja rastro en `audit_logs`.
- Ajustes de saldo quedan en `balance_adjustments` (ledger).
- Permite investigar incidentes y cumplir requisitos de trazabilidad.

---

## 12. Mantenibilidad y trabajo en equipo

Con 2 desarrolladores, esta arquitectura busca:

- Separación clara de capas.
- Código fácil de testear.
- Migraciones versionadas.
- Convenciones estables para crecer sin reescribir.

### Prácticas recomendadas

- PRs pequeñas.
- Tests de reglas críticas.
- Revisión de migraciones antes de ejecutar en entornos compartidos.
- Documentación técnica viva.

---

## 13. Estrategia de pruebas (qué se probó y por qué)

El objetivo de pruebas en este proyecto es validar tres capas:

1. Seguridad (auth + RBAC).
2. Reglas de negocio (fechas, saldo, estados).
3. Contrato mínimo de endpoints.

### Pruebas unitarias implementadas

1. `test_hash_and_verify_password`
   - Verifica que el password no se almacena plano y que la validación de hash funciona.
2. `test_create_and_decode_access_token`
   - Verifica creación y lectura de JWT (`sub`, `role`, `exp`).
3. `test_calculate_requested_days`
   - Verifica cálculo correcto de días solicitados.
4. `test_calculate_requested_days_invalid_range`
   - Verifica rechazo de rango de fechas inválido.

### Pruebas de integración implementadas

1. `test_health_check`
   - Valida que la API esté viva y responda correctamente.
2. `test_protected_endpoint_requires_token`
   - Valida que endpoints protegidos exijan token (`401`).
3. `test_manager_endpoint_forbidden_for_employee`
   - Valida bloqueo de rol incorrecto (`403`).
4. `test_manager_endpoint_allows_manager`
   - Valida acceso correcto para rol autorizado (`200`).
5. `test_admin_adjust_endpoint_forbidden_for_manager`
   - Valida que endpoint admin no acepte manager (`403`).

### Por qué este set de pruebas es útil ahora

- Detecta regresiones tempranas en seguridad.
- Da confianza al equipo frontend sobre contratos básicos.
- Permite iterar rápido sin romper reglas críticas del dominio.

### Próximas pruebas recomendadas

1. Aprobar solicitud con saldo suficiente.
2. Intento de aprobación con saldo insuficiente (`409`).
3. Rechazo y cancelación con validación de ownership.
4. Escenario de concurrencia para evitar doble descuento.

---

## 14. Módulo IA (LLM real + políticas)

El sistema integra un proveedor LLM real de forma **opcional** (feature flag), manteniendo control de dominio, RBAC y alcance por equipo.

### Alcance por rol

- `MANAGER`: alcance de datos solo su `team_id`.
- `ADMIN`: alcance global.
- `EMPLOYEE`: sin acceso al módulo IA.

### Chat único (consulta + configuración)

En frontend se unificó la experiencia en un solo panel de IA:

1. Responder preguntas operativas del dominio de vacaciones.
2. Proponer y aplicar cambios de política del equipo por lenguaje natural.
3. Mostrar preguntas guiadas de onboarding para primer setup de manager.

### Restricción de dominio (regla dura)

La IA responde únicamente sobre la aplicación de vacaciones (estado de equipo, disponibilidad, políticas, solicitudes, aprobaciones/rechazos y contexto operativo interno). Si la consulta está fuera de dominio, responde con rechazo de alcance.

### Endpoints IA/políticas

1. `POST /api/v1/ai/chat`
2. `GET /api/v1/ai/chat/history`
3. `POST /api/v1/team-policies/agent`
4. `GET /api/v1/team-policies/onboarding/questions`
5. `GET /api/v1/team-policies/me`

### Auditoría IA

Cada interacción de chat se persiste en `ai_chat_interactions` con actor, alcance (`TEAM|GLOBAL`), pregunta, respuesta y timestamp.

### Configuración de entorno (backend)

Variables principales:

- `LLM_ENABLED=true|false`
- `OPENAI_API_KEY=<secret>`
- `OPENAI_MODEL=gpt-4o-mini`
- `OPENAI_TIMEOUT_SECONDS=20`

Buenas prácticas:

- Nunca commitear `.env`.
- API key solo en entorno local/seguro.

### Consideraciones operativas relevantes

- CORS habilitado para pruebas locales frontend↔backend.
- En modo `real`, el frontend debe usar JWT emitido por backend (no tokens demo sintéticos).
- Si el token es inválido/expirado, el cliente limpia sesión y solicita nuevo login.
- Para entorno local, PostgreSQL debe estar disponible antes de probar autenticación/chat.

---

## 15. Resumen ejecutivo

Se usa esta arquitectura porque prioriza:

1. **Consistencia de negocio** (no saldo negativo).
2. **Seguridad** (JWT + RBAC).
3. **Concurrencia correcta** (transacciones + locks).
4. **Mantenibilidad** (capas y migraciones).
5. **Escalabilidad funcional** para agregar políticas nuevas sin romper el núcleo.
