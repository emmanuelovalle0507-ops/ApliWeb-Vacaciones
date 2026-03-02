# Documentación Técnica del Frontend — VacaControl

## Índice

1. [¿Por qué Next.js?](#1-por-qué-nextjs)
2. [¿Por qué TypeScript?](#2-por-qué-typescript)
3. [¿Por qué Tailwind CSS v4?](#3-por-qué-tailwind-css-v4)
4. [¿Por qué Lucide React para iconos?](#4-por-qué-lucide-react-para-iconos)
5. [Arquitectura de carpetas](#5-arquitectura-de-carpetas)
6. [App Router y sistema de rutas](#6-app-router-y-sistema-de-rutas)
7. [Componentes reutilizables](#7-componentes-reutilizables)
8. [Sistema de autenticación simulada](#8-sistema-de-autenticación-simulada)
9. [Datos mock y capa de datos](#9-datos-mock-y-capa-de-datos)
10. [Diseño responsive (mobile-first)](#10-diseño-responsive-mobile-first)
11. [Decisiones de diseño visual](#11-decisiones-de-diseño-visual)

---

## 1. ¿Por qué Next.js?

**Framework elegido:** Next.js 15 con App Router

### Razones principales:

- **App Router (nueva arquitectura):** Next.js 13+ introdujo el App Router basado en el sistema de archivos. Esto significa que cada carpeta dentro de `src/app/` se convierte automáticamente en una ruta. Por ejemplo, `src/app/dashboard/employee/page.tsx` se traduce a la URL `/dashboard/employee`. No necesitamos configurar un router manualmente como en React puro.

- **Server Components por defecto:** Next.js renderiza los componentes en el servidor por defecto, lo que mejora el rendimiento inicial (menos JavaScript enviado al navegador). Solo marcamos como `"use client"` los componentes que necesitan interactividad del navegador (estados, eventos, hooks).

- **Layouts anidados:** El archivo `layout.tsx` en cada carpeta permite definir layouts que envuelven automáticamente todas las páginas hijas. Esto es perfecto para nuestro caso: el layout del dashboard (Sidebar + Header) se define una sola vez en `src/app/dashboard/layout.tsx` y aplica a Employee, Manager y Admin sin repetir código.

- **Optimizaciones automáticas:** Next.js optimiza imágenes, fuentes, code splitting (divide el JS en chunks pequeños) y prefetching de rutas. Todo esto viene gratis sin configuración adicional.

- **Escalabilidad:** Cuando conectemos el backend real (FastAPI), Next.js permite crear API routes internas o usar Server Actions para llamadas al backend. También soporta middleware para proteger rutas por autenticación.

### ¿Por qué no React puro (Create React App o Vite)?

React puro requiere configurar manualmente: router (react-router-dom), sistema de layouts, SSR si se necesita, y optimizaciones de build. Next.js lo trae todo integrado y probado en producción por empresas como Vercel, Netflix, Twitch, etc.

---

## 2. ¿Por qué TypeScript?

**Lenguaje elegido:** TypeScript 5.7

### Razones principales:

- **Detección de errores en tiempo de desarrollo:** TypeScript nos avisa antes de ejecutar el código si estamos pasando un tipo incorrecto. Por ejemplo, si una función espera un `VacationRequest` y le pasamos un `User`, el editor marca el error inmediatamente. Esto es crítico en un proyecto con múltiples roles y tipos de datos.

- **Autocompletado inteligente:** Al definir interfaces como `User`, `VacationBalance` y `VacationRequest` en `src/types/index.ts`, cualquier archivo que importe esos tipos obtiene autocompletado completo en el IDE. Esto acelera el desarrollo y reduce errores.

- **Documentación viva:** Los tipos actúan como documentación. Cualquier desarrollador nuevo puede abrir `src/types/index.ts` y entender inmediatamente la estructura de datos del sistema sin leer documentación externa.

- **Refactoring seguro:** Si mañana cambiamos el nombre de un campo (por ejemplo, `fullName` a `displayName`), TypeScript marcará todos los archivos que usan ese campo. En JavaScript puro, esos errores solo se descubren en runtime.

### Ejemplo concreto en el proyecto:

```typescript
// src/types/index.ts
export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
```

Estos tipos union (`|`) garantizan que nunca se pueda asignar un rol o estado inválido en ninguna parte del código. Si alguien escribe `"SUPERADMIN"`, TypeScript lo rechaza inmediatamente.

---

## 3. ¿Por qué Tailwind CSS v4?

**Framework de estilos elegido:** Tailwind CSS 4.0

### Razones principales:

- **Utility-first (clases utilitarias):** En lugar de escribir archivos CSS separados con nombres de clases inventados (`.card-container`, `.btn-primary`), Tailwind permite estilizar directamente en el JSX con clases como `bg-white rounded-xl border border-gray-200 shadow-sm p-6`. Esto elimina la necesidad de alternar entre archivos CSS y componentes.

- **Consistencia de diseño:** Tailwind usa un sistema de diseño preconfigurado con escalas de colores (`gray-100` a `gray-900`), espaciados (`p-1` a `p-12`), tipografías y breakpoints. Esto asegura que todos los componentes se vean coherentes sin necesidad de un diseñador definiendo cada pixel.

- **Tamaño final mínimo:** Tailwind v4 usa un motor CSS que solo incluye las clases que realmente se usan en el proyecto. Si nunca usamos `bg-pink-500`, esa clase no existe en el CSS final. El resultado es un archivo CSS extremadamente pequeño.

- **Responsive sin media queries manuales:** Para hacer responsive usamos prefijos como `sm:`, `lg:`, etc. Por ejemplo:
  ```html
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  ```
  Esto significa: 1 columna en móvil, 2 en tablets, 4 en desktop. Sin escribir ni una sola media query.

- **Tailwind v4 específicamente:** La versión 4 simplifica la configuración. Ya no necesita un `tailwind.config.js` complejo. Se importa directamente con `@import "tailwindcss"` en el CSS y funciona. Usa el nuevo motor Oxide que es significativamente más rápido.

### ¿Por qué no CSS Modules, Styled Components o Sass?

- **CSS Modules:** Requieren archivos separados por componente, lo que fragmenta el código.
- **Styled Components:** Añaden runtime JavaScript para generar CSS, lo que impacta el rendimiento.
- **Sass:** Requiere compilación adicional y no ofrece el sistema de diseño integrado de Tailwind.

---

## 4. ¿Por qué Lucide React para iconos?

**Librería de iconos elegida:** Lucide React

### Razones principales:

- **Tree-shakeable:** Solo se incluyen en el bundle final los iconos que importamos. Si usamos 8 iconos de los 1400+ disponibles, solo esos 8 se incluyen. Esto mantiene el bundle pequeño.

- **Consistencia visual:** Todos los iconos de Lucide siguen el mismo estilo visual (stroke width, proporciones, esquinas redondeadas). Esto da un aspecto profesional uniforme.

- **Componentes React nativos:** Cada icono es un componente React que acepta props como `size`, `color` y `className`. Se integra perfectamente con Tailwind:
  ```tsx
  <Calendar size={22} className="text-indigo-600" />
  ```

- **Fork activo de Feather Icons:** Lucide es un fork mantenido activamente de Feather Icons con más iconos y mejor soporte para React.

### Iconos que usamos en el proyecto:

| Icono | Uso |
|-------|-----|
| `Palmtree` | Logo de VacaControl |
| `LayoutDashboard` | Navegación al dashboard |
| `FileText` | Solicitudes |
| `ClipboardList` | Solicitudes pendientes |
| `Users` | Lista de usuarios |
| `Calculator` | Saldos |
| `Calendar` | Días disponibles |
| `Clock` | Días usados / pendientes |
| `CheckCircle` | Aprobadas / Aprobar |
| `XCircle` | Rechazar |
| `LogOut` | Cerrar sesión |
| `Menu` | Menú hamburguesa (mobile) |
| `X` | Cerrar sidebar |

---

## 5. Arquitectura de carpetas

```
frontend/src/
├── app/                    → Rutas (App Router de Next.js)
│   ├── globals.css         → Estilos globales (import de Tailwind)
│   ├── layout.tsx          → Layout raíz (HTML, AuthProvider)
│   ├── page.tsx            → Página raíz (redirect según auth)
│   ├── login/
│   │   └── page.tsx        → Página de login
│   └── dashboard/
│       ├── layout.tsx      → Layout del dashboard (Sidebar + Header)
│       ├── employee/
│       │   └── page.tsx    → Dashboard del empleado
│       ├── manager/
│       │   └── page.tsx    → Dashboard del manager
│       └── admin/
│           └── page.tsx    → Dashboard del admin
├── components/             → Componentes reutilizables
│   ├── ui/                 → Componentes de UI genéricos
│   │   ├── Button.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── DataTable.tsx
│   │   └── StatCard.tsx
│   └── layout/             → Componentes de layout
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       └── DashboardLayout.tsx
├── context/                → Contextos de React (estado global)
│   └── AuthContext.tsx
├── lib/                    → Utilidades y datos
│   ├── mock-data.ts        → Datos simulados
│   └── navigation.ts       → Configuración de navegación por rol
└── types/                  → Definiciones de TypeScript
    └── index.ts
```

### ¿Por qué esta estructura?

- **`app/`** contiene exclusivamente las rutas. Cada `page.tsx` es una página. Cada `layout.tsx` envuelve a sus hijos. Esta es la convención del App Router de Next.js.

- **`components/ui/`** contiene componentes genéricos que no tienen lógica de negocio. Un `Button` o un `DataTable` pueden usarse en cualquier parte de la app sin importar el contexto.

- **`components/layout/`** contiene los componentes estructurales (Sidebar, Header). Están separados de `ui/` porque tienen conocimiento del contexto de autenticación y navegación.

- **`context/`** contiene los Context Providers de React. Actualmente solo `AuthContext`, pero en el futuro podríamos tener `ThemeContext`, `NotificationContext`, etc.

- **`lib/`** contiene funciones utilitarias y datos. Aquí es donde eventualmente vivirá la capa `api.ts` que hará las llamadas reales al backend FastAPI. Los mock-data se reemplazarán por llamadas HTTP.

- **`types/`** centraliza todas las interfaces TypeScript. Esto permite que cualquier archivo importe tipos desde un solo lugar (`@/types`) en lugar de definirlos localmente.

---

## 6. App Router y sistema de rutas

### ¿Cómo funciona el enrutamiento?

Next.js App Router usa **file-system routing**: la estructura de carpetas define las URLs.

| Archivo | URL resultante |
|---------|---------------|
| `src/app/page.tsx` | `/` |
| `src/app/login/page.tsx` | `/login` |
| `src/app/dashboard/employee/page.tsx` | `/dashboard/employee` |
| `src/app/dashboard/manager/page.tsx` | `/dashboard/manager` |
| `src/app/dashboard/admin/page.tsx` | `/dashboard/admin` |

### ¿Cómo funcionan los layouts anidados?

```
src/app/layout.tsx              → Envuelve TODA la app (HTML + AuthProvider)
  └── src/app/dashboard/layout.tsx  → Envuelve solo las rutas /dashboard/* (Sidebar + Header)
        ├── employee/page.tsx
        ├── manager/page.tsx
        └── admin/page.tsx
```

Cuando un usuario navega a `/dashboard/employee`, Next.js renderiza:
1. El layout raíz (`app/layout.tsx`) — que provee HTML y AuthProvider
2. El layout del dashboard (`app/dashboard/layout.tsx`) — que provee Sidebar y Header
3. La página del empleado (`app/dashboard/employee/page.tsx`) — el contenido

Los layouts **no se re-renderizan** al cambiar de página dentro del mismo segmento. Si el usuario pasa de `/dashboard/employee` a `/dashboard/manager`, solo cambia el contenido; el Sidebar y Header persisten sin recargar.

### Protección de rutas

`DashboardLayout.tsx` contiene un `useEffect` que verifica si el usuario está autenticado. Si no lo está, redirige a `/login`. Esta es una protección client-side. En producción, se complementaría con middleware de Next.js para protección server-side.

---

## 7. Componentes reutilizables

### Button (`components/ui/Button.tsx`)

**¿Por qué un componente Button personalizado?**

En lugar de usar `<button>` directamente en cada lugar con estilos repetidos, centralizamos la apariencia en un solo componente. Esto permite:
- Cambiar el estilo de todos los botones del sistema editando un solo archivo.
- Garantizar consistencia visual (mismo padding, border-radius, transiciones).
- Soportar variantes (`primary`, `secondary`, `danger`, `ghost`) y tamaños (`sm`, `md`, `lg`).

El componente extiende `React.ButtonHTMLAttributes<HTMLButtonElement>`, lo que significa que acepta cualquier prop nativa de un botón HTML (como `onClick`, `disabled`, `type`).

### StatusBadge (`components/ui/StatusBadge.tsx`)

**¿Por qué un componente de badge de estado?**

Los estados de solicitud (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`) se muestran en múltiples tablas (Employee, Manager, Admin). Cada estado tiene un color distinto. Centralizar esto evita repetir la lógica de mapeo estado→color en cada página.

El componente recibe un `RequestStatus` y retorna automáticamente el badge con el color y texto correctos en español.

### DataTable (`components/ui/DataTable.tsx`)

**¿Por qué un componente de tabla genérico?**

El sistema muestra tablas en las 3 vistas (solicitudes del empleado, solicitudes pendientes del manager, y usuarios/saldos/solicitudes del admin). En lugar de crear 5 tablas diferentes, creamos una sola tabla genérica que recibe:
- `columns`: array de definiciones de columnas (key, header, render opcional)
- `data`: array de datos de cualquier tipo
- `emptyMessage`: mensaje cuando no hay datos

Usa **TypeScript Generics** (`DataTable<T>`) para que el tipo de las columnas coincida con el tipo de los datos. Si defines columnas para `VacationRequest`, el render function recibirá un `VacationRequest` con autocompletado completo.

### StatCard (`components/ui/StatCard.tsx`)

**¿Por qué tarjetas de estadísticas?**

Los dashboards muestran métricas numéricas (días disponibles, solicitudes pendientes, etc.). Las stat cards proporcionan un formato visual consistente con icono, título, valor y subtítulo. Soportan 5 colores temáticos.

---

## 8. Sistema de autenticación simulada

### AuthContext (`context/AuthContext.tsx`)

**¿Por qué React Context para auth?**

La información del usuario autenticado se necesita en múltiples componentes: Sidebar (para mostrar el menú correcto), Header (para mostrar el nombre), DashboardLayout (para proteger rutas), y cada página de dashboard (para cargar datos del usuario correcto).

React Context permite compartir este estado globalmente sin pasar props manualmente por cada nivel del árbol de componentes (prop drilling).

### ¿Qué expone el AuthContext?

| Propiedad/Método | Descripción |
|-------------------|-------------|
| `user` | El usuario actualmente autenticado (o `null`) |
| `isAuthenticated` | Booleano derivado de si `user` existe |
| `login(email, password)` | Busca al usuario por email en los mock data |
| `logout()` | Establece `user` en `null` |
| `switchRole(role)` | **Helper de desarrollo.** Permite cambiar de rol sin hacer logout/login |

### ¿Por qué un Role Switcher en el Header?

Durante el desarrollo, necesitamos probar constantemente las 3 vistas (Employee, Manager, Admin). El role switcher permite cambiar de rol con un solo clic, sin tener que hacer logout → login → seleccionar usuario. Esto se eliminará en producción.

### ¿Cómo se reemplazará por auth real?

Cuando el backend FastAPI esté listo:
1. `login()` hará un `POST /api/auth/login` y almacenará el JWT en una cookie httpOnly.
2. `logout()` eliminará la cookie.
3. Se agregará un `useEffect` que valide el token al cargar la app.
4. Se eliminará `switchRole()`.

---

## 9. Datos mock y capa de datos

### mock-data.ts (`lib/mock-data.ts`)

**¿Por qué datos mock?**

El backend aún está en desarrollo. Los datos mock permiten:
- Desarrollar y probar el frontend de forma independiente.
- Validar que la UI maneja correctamente todos los estados posibles (pendiente, aprobada, rechazada).
- Demostrar el flujo completo al equipo antes de implementar el backend.

### Estructura de los mock data:

| Array | Descripción | Registros |
|-------|-------------|-----------|
| `mockUsers` | 5 usuarios (2 empleados, 1 manager, 1 admin, 1 empleado extra) | 5 |
| `mockBalances` | Saldo de vacaciones de cada usuario | 5 |
| `mockRequests` | Solicitudes con diferentes estados | 6 |

### Funciones helper:

| Función | Descripción |
|---------|-------------|
| `getBalanceByUserId(id)` | Obtiene el saldo de un usuario específico |
| `getRequestsByUserId(id)` | Obtiene todas las solicitudes de un usuario |
| `getPendingRequestsForManager(id)` | Obtiene solicitudes pendientes de empleados bajo un manager |
| `getAllRequests()` | Retorna todas las solicitudes (vista admin) |
| `getAllBalances()` | Retorna todos los saldos con nombre de usuario (vista admin) |
| `getAllUsers()` | Retorna todos los usuarios (vista admin) |

### ¿Cómo se reemplazarán por llamadas API reales?

Se creará un archivo `lib/api.ts` con las mismas funciones pero que harán `fetch()` al backend:

```typescript
// Futuro: lib/api.ts
export async function getBalanceByUserId(id: string): Promise<VacationBalance> {
  const res = await fetch(`${API_URL}/balances/${id}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
}
```

Las páginas no cambiarán; solo se modificará el import de `@/lib/mock-data` a `@/lib/api`.

---

## 10. Diseño responsive (mobile-first)

### ¿Qué significa mobile-first?

Significa que los estilos base están diseñados para pantallas pequeñas (móviles), y usamos breakpoints para adaptar a pantallas más grandes. En Tailwind:

- Sin prefijo = móvil (< 640px)
- `sm:` = tablets (≥ 640px)
- `lg:` = desktop (≥ 1024px)

### Implementación en el proyecto:

**Sidebar:**
- En **mobile**: oculto por defecto (`-translate-x-full`), se abre como drawer con overlay oscuro al tocar el botón de menú hamburguesa.
- En **desktop** (`lg:`): siempre visible como columna fija a la izquierda (`lg:translate-x-0 lg:static`).

**Grids de StatCards:**
```html
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```
- 1 columna en móvil
- 2 columnas en tablet
- 4 columnas en desktop

**Tablas:**
Las tablas usan `overflow-x-auto` para permitir scroll horizontal en pantallas pequeñas sin romper el layout.

**Header:**
- El botón de menú hamburguesa solo se muestra en mobile (`lg:hidden`).
- El texto de bienvenida solo se muestra en desktop (`hidden lg:block`).

---

## 11. Decisiones de diseño visual

### Paleta de colores

Se eligió **indigo** como color primario porque:
- Es profesional y corporativo, adecuado para una herramienta empresarial.
- Tiene suficiente contraste con blanco para accesibilidad.
- La escala de Tailwind ofrece 10 tonos (50-950) para variaciones sutiles.

### Colores semánticos para estados:

| Estado | Color | Razón |
|--------|-------|-------|
| Pendiente | Amarillo (`yellow-100/800`) | Convención universal de "en espera" |
| Aprobada | Verde (`green-100/800`) | Convención universal de "éxito" |
| Rechazada | Rojo (`red-100/800`) | Convención universal de "error/negativo" |
| Cancelada | Gris (`gray-100/800`) | Estado inactivo/neutral |

### Estilo de componentes:

- **Border radius `rounded-xl`**: Bordes más redondeados dan un aspecto moderno y amigable.
- **Sombras sutiles `shadow-sm`**: Profundidad mínima para separar elementos sin sobrecargar visualmente.
- **Bordes suaves `border-gray-200`**: Delimitación clara pero no agresiva entre componentes.
- **Transiciones `transition-colors`**: Feedback visual suave al interactuar con elementos (hover, focus).

---

## Próximos pasos

1. **Conectar al backend FastAPI** — Reemplazar `mock-data.ts` por `api.ts` con `fetch()` real.
2. **Formulario de nueva solicitud** — Modal o página para que el empleado cree solicitudes con selector de fechas.
3. **Acciones de Manager** — Conectar botones Aprobar/Rechazar a la API.
4. **Ajuste de saldos (Admin)** — Formulario para modificar saldo manualmente.
5. **Middleware de autenticación** — Protección server-side con JWT en Next.js middleware.
6. **Tests** — Unit tests con Jest/Vitest y tests de integración con Playwright.
