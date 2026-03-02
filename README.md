# SEEKOP — Control de Vacaciones

![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-green)

> Sistema integral de gestión de vacaciones para **SEEKOP Consulting**. Permite a empleados solicitar vacaciones, a managers aprobar/rechazar solicitudes de su equipo, a administradores gestionar toda la organización, y a RRHH consultar información de forma global y read-only.

---

## Arquitectura

```
appvacaciones--main/
├── apps/
│   └── api/              # Backend — FastAPI + SQLAlchemy + Alembic
├── frontend/             # Frontend — Next.js 15 + React 18 + TailwindCSS
├── infra/                # Docker Compose (PostgreSQL)
├── docs/                 # Documentación técnica
└── README.md
```

## Tech Stack

| Capa       | Tecnología                                     |
|------------|------------------------------------------------|
| Frontend   | Next.js 15, React 18, TailwindCSS, React Query |
| Backend    | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2    |
| Base datos | PostgreSQL 16                                  |
| Auth       | JWT (HS256)                                    |
| Infra      | Docker Compose                                 |

## Roles del Sistema

| Rol          | Permisos                                                              |
|-------------|-----------------------------------------------------------------------|
| `EMPLOYEE`  | Solicitar vacaciones, cancelar solicitudes pendientes, ver su balance  |
| `MANAGER`   | Todo lo de EMPLOYEE + aprobar/rechazar solicitudes de su equipo        |
| `ADMIN`     | Gestión global: usuarios, solicitudes, balances, equipos              |
| `HR`        | Acceso read-only global: usuarios, solicitudes, balances, equipos     |

## Inicio Rápido

### Prerrequisitos

- **Python** 3.12+
- **Node.js** 20+
- **PostgreSQL** 16+ (o Docker)
- **pnpm** / **npm**

### 1. Base de datos

```bash
cd infra
docker compose up -d
```

### 2. Backend

```bash
cd apps/api
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env          # Ajustar variables si es necesario
alembic upgrade head          # Migraciones
python -m scripts.seed_mvp    # Datos de prueba
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # Ajustar variables si es necesario
npm run dev -- -p 3001
```

### 4. Acceder

- **Frontend:** http://localhost:3001
- **API Docs:** http://localhost:8000/docs

### Credenciales de prueba

| Rol       | Email                          | Password      |
|-----------|--------------------------------|---------------|
| Admin     | admin@vacaciones.local         | Admin123!     |
| Manager   | manager@vacaciones.local       | Manager123!   |
| Employee  | employee@vacaciones.local      | Employee123!  |
| HR        | hr@seekop.com                  | 1234          |

## Scripts Útiles

```bash
# Backend: correr tests
cd apps/api && pytest

# Backend: seed de datos
cd apps/api && python -m scripts.seed_mvp

# Frontend: lint
cd frontend && npm run lint

# Frontend: type check
cd frontend && npx tsc --noEmit
```

## Convención de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

| Prefijo     | Uso                                      |
|-------------|------------------------------------------|
| `feat:`     | Nueva funcionalidad                      |
| `fix:`      | Corrección de bug                        |
| `docs:`     | Documentación                            |
| `chore:`    | Mantenimiento, config, deps              |
| `refactor:` | Refactorización sin cambio de behavior   |
| `style:`    | Formato, espacios, sin cambio de lógica  |
| `test:`     | Tests                                    |

## Estrategia de Ramas

```
main          ← producción, siempre estable
  └── dev     ← integración, aquí se mergean features
       ├── feature/xxx   ← nuevas funcionalidades
       ├── fix/xxx       ← correcciones
       └── chore/xxx     ← mantenimiento
```

- **PRs** siempre van de `feature/*` → `dev`
- Merge de `dev` → `main` solo cuando `dev` es estable (release)

## Documentación Adicional

- [`docs/LOCAL_SETUP.md`](docs/LOCAL_SETUP.md) — Setup local detallado
- [`docs/API_EXAMPLES.md`](docs/API_EXAMPLES.md) — Ejemplos de uso de la API
- [`docs/PRUEBAS_BACKEND_EXPLICADAS.md`](docs/PRUEBAS_BACKEND_EXPLICADAS.md) — Guía de pruebas

## Licencia

MIT — ver [LICENSE](LICENSE) para más detalles.

---

Desarrollado con dedicación para **SEEKOP Consulting**.
