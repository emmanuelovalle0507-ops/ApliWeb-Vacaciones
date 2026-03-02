# Pruebas de integración — API

## Objetivo

Validar comportamiento real de endpoints y reglas de seguridad (RBAC/auth) con TestClient.

## Archivos

- `test_health.py`: sanity check de disponibilidad.
- `test_auth_and_rbac.py`: pruebas de autorización por rol y protección de endpoints.

## Ejecución

Desde `apps/api`:

```bash
python -m pytest tests/integration -q
```

## Enfoque adoptado

Algunas pruebas usan `dependency_overrides` y `monkeypatch` para aislar reglas de acceso.

¿Por qué?
- Permite validar auth/RBAC incluso sin montar todo el estado de base de datos.
- Aporta feedback rápido y estable para el equipo.

Más adelante se recomienda complementar con pruebas end-to-end con base PostgreSQL real.
