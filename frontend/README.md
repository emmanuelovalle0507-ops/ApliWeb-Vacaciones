# VacaControl — Frontend MVP

Sistema de gestión de vacaciones empresariales. Frontend profesional listo para integrarse con un backend FastAPI por API REST.

## Stack

| Tecnología | Versión | Propósito |
|---|---|---|
| Next.js (App Router) | 15.x | Framework React con SSR y file-system routing |
| TypeScript | 5.7 | Tipado estático |
| Tailwind CSS | 4.x | Estilos utility-first |
| TanStack Query | 5.x | Manejo de estado servidor, caché, mutaciones |
| React Hook Form | 7.x | Formularios performantes |
| Zod | 3.x | Validación de esquemas |
| Lucide React | 0.468 | Iconos SVG tree-shakeable |

## Cómo correr

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

## Cómo cambiar mock/real

La app usa una **capa API intercambiable**. Por defecto consume datos mock en memoria.

1. Copia el archivo de ejemplo: `cp .env.example .env.local`
2. Edita `NEXT_PUBLIC_API_MODE`:
   - `mock` (default) — datos simulados, sin backend
   - `real` — llama al backend FastAPI en `NEXT_PUBLIC_API_BASE_URL`

```env
NEXT_PUBLIC_API_MODE=mock
NEXT_PUBLIC_DEMO_BYPASS=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

### Bypass demo de login (sin correo/contraseña)

Si quieres entrar directo sin escribir credenciales:

```env
NEXT_PUBLIC_DEMO_BYPASS=true
```

Con esto, en `/login` aparecen botones de acceso demo por rol (`EMPLOYEE`, `MANAGER`, `ADMIN`).

Los componentes **nunca** importan mocks directamente. Siempre consumen `@/api/client`, que internamente despacha a `mock/handlers` o `real/client` según la variable de entorno.

## Usuarios mock disponibles

| Email | Nombre | Rol | Área |
|---|---|---|---|
| `admin@empresa.com` | Roberto Díaz | ADMIN | RRHH |
| `hr@empresa.com` | Laura Vega | HR | RRHH |
| `maria.garcia@empresa.com` | María García | MANAGER | Ingeniería |
| `pedro.sanchez@empresa.com` | Pedro Sánchez | MANAGER | Marketing |
| `carlos.lopez@empresa.com` | Carlos López | EMPLOYEE | Ingeniería |
| `ana.martinez@empresa.com` | Ana Martínez | EMPLOYEE | Ingeniería |
| `jorge.ramirez@empresa.com` | Jorge Ramírez | EMPLOYEE | Marketing |
| `sofia.hernandez@empresa.com` | Sofía Hernández | EMPLOYEE | Marketing |

**Login:** Usa cualquier email de la tabla con cualquier contraseña. En la pantalla de login hay botones de acceso rápido (solo en modo mock).

## Roles y permisos

| Rol | Puede hacer |
|---|---|
| **EMPLOYEE** | Ver saldo, crear solicitud, cancelar solicitud PENDING, ver historial |
| **MANAGER** | Ver solicitudes pendientes de su equipo, aprobar/rechazar con comentario |
| **ADMIN** | Todo lo de manager + gestión global (usuarios, solicitudes, balances) |
| **HR** | Vista global de solo lectura (mismas tablas que admin, sin botones de acción) |

## Estructura del proyecto

```
src/
├── api/                        ← Capa API intercambiable
│   ├── client.ts               ← Switch mock/real (entry point)
│   ├── mock/
│   │   ├── db.ts               ← Base de datos en memoria
│   │   └── handlers.ts         ← Implementación mock de todos los endpoints
│   └── real/
│       └── client.ts           ← Implementación real (placeholder fetch)
├── app/                        ← Rutas (Next.js App Router)
│   ├── (auth)/login/page.tsx   ← /login
│   ├── (protected)/            ← Layout con sidebar + auth guard
│   │   ├── layout.tsx
│   │   ├── employee/dashboard/ ← /employee/dashboard
│   │   ├── manager/dashboard/  ← /manager/dashboard
│   │   ├── admin/dashboard/    ← /admin/dashboard
│   │   └── hr/dashboard/       ← /hr/dashboard
│   ├── logout/page.tsx         ← /logout
│   ├── forbidden/page.tsx      ← /forbidden (403)
│   ├── layout.tsx              ← Root layout (providers)
│   └── page.tsx                ← / (redirect por rol)
├── components/
│   ├── layout/                 ← Sidebar, Topbar, RoleGuard
│   ├── ui/                     ← Button, Card, Badge, Table, Modal, Input, Select, Textarea, Tabs
│   └── vacations/              ← BalanceCard, RequestForm, RequestsTable, ApprovalModal, Filters, CancelDialog
├── lib/
│   ├── auth.ts                 ← Sesión localStorage, utilidades de rol
│   ├── dates.ts                ← Cálculo de días hábiles
│   └── format.ts               ← Formateo de fechas, labels
├── providers/
│   ├── AuthProvider.tsx        ← Contexto de autenticación
│   └── QueryProvider.tsx       ← TanStack Query client
└── types/
    ├── index.ts                ← Interfaces, enums, constantes
    └── schemas.ts              ← Esquemas Zod (login, createRequest, decision)
```

## Contrato API (para integración con backend)

Todas las funciones están definidas en `src/api/client.ts`:

```
auth.login(email, password)        → AuthResponse
auth.logout()                      → void
me.get(userId)                     → User
balance.getMyBalance(userId, year) → VacationBalance
requests.create(userId, payload)   → VacationRequest
requests.listMine(userId)          → VacationRequest[]
requests.cancel(requestId, userId) → VacationRequest
approvals.listPending(managerId)   → VacationRequest[]
approvals.approve(id, deciderId, comment?) → VacationRequest
approvals.reject(id, deciderId, comment?)  → VacationRequest
admin.users.list(filters?)         → User[]
admin.requests.list(filters?)      → VacationRequest[]
admin.balances.list(year)          → VacationBalance[]
notifications.listMine(userId)     → NotificationEvent[]
```

Para integrar con FastAPI, implementa estos endpoints en `src/api/real/client.ts` y cambia `NEXT_PUBLIC_API_MODE=real`.

## Cálculo de días hábiles

La función `businessDaysBetween(startDate, endDate)` en `src/lib/dates.ts`:
- Cuenta días de lunes a viernes (inclusive)
- Excluye sábados y domingos
- NO considera días festivos
- Se usa tanto en el formulario de solicitud (preview) como en los mock handlers (consistencia)

## Sesión / Auth

- **Estrategia:** localStorage (`vc_token` + `vc_user`)
- **Razón:** Simplicidad para MVP con mocks. En producción con backend real, migrar a cookies httpOnly con JWT.
- **Protección de rutas:** El layout `(protected)` verifica autenticación. `RoleGuard` verifica rol permitido por página.
- **403:** Si un rol no permitido accede a una ruta protegida, se redirige a `/forbidden`.

## Notas de integración futura

1. **Backend FastAPI:** Implementar los endpoints del contrato API. El frontend solo necesita cambiar la variable de entorno.
2. **JWT real:** Reemplazar localStorage por cookies httpOnly. Agregar middleware Next.js para validación server-side.
3. **Notificaciones:** El modelo `NotificationEvent` ya está definido. Solo falta agregar una vista de historial en cada dashboard.
4. **Festivos:** Extender `businessDaysBetween` para recibir un array de fechas festivas desde el backend.
5. **Políticas por área:** El modelo `Area` ya está en el usuario. Se puede agregar `VacationPolicy` por área para configurar días otorgados.
