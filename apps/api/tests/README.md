# Tests API

Estructura inicial de pruebas:

- `unit/`: reglas puras y helpers de seguridad.
- `integration/`: endpoints FastAPI sin depender de frontend.

## Ejecución

Desde `apps/api`:

```bash
python -m pytest tests -q
```

## Próximas pruebas recomendadas

1. Flujo de aprobación con transacción y saldo suficiente.
2. Error `INSUFFICIENT_BALANCE` al aprobar con saldo insuficiente.
3. Reglas de autorización por rol y por manager asignado.
