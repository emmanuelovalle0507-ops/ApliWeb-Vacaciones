# Implementación de los puntos 1, 2 y 3 (explicado)

Este documento resume qué se implementó y por qué.

## Punto 1 — Seed inicial

Archivo:
- `apps/api/scripts/seed_mvp.py`

Qué aporta:
- Datos iniciales listos para probar el MVP.
- Crea usuarios por rol y saldo base del empleado.
- Es idempotente para no duplicar datos.

Por qué es importante:
- Reduce tiempo de setup local.
- Acelera pruebas funcionales.

## Punto 2 — Pruebas de integración

Archivo:
- `apps/api/tests/integration/test_auth_and_rbac.py`

Qué cubre:
- Endpoints protegidos exigen token (`401`).
- Endpoints de manager rechazan employee (`403`).
- Endpoints de manager aceptan manager (`200`).
- Endpoint admin rechaza manager (`403`).

Por qué es importante:
- Valida frontera de seguridad antes de avanzar frontend.
- Reduce regresiones en RBAC.

## Punto 3 — API por rol documentada

Archivo:
- `docs/API_EXAMPLES.md`

Qué cubre:
- Ejemplos curl por rol.
- Flujo técnico de aprobación y reglas de negocio.
- Errores esperados y demo sugerida.

Por qué es importante:
- Sirve de guía operativa para backend, frontend y QA.
- Evita ambigüedades de uso del API.
