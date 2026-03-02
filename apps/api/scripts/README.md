# Scripts operativos (API)

## seed_mvp.py

Script para crear datos iniciales de trabajo local.

### ¿Qué crea?

1. Usuario `ADMIN`
2. Usuario `MANAGER`
3. Usuario `EMPLOYEE` asignado al manager
4. Balance anual inicial del employee

### ¿Por qué existe este script?

- Evita cargar datos manualmente cada vez.
- Acelera pruebas de login y flujos por rol.
- Facilita demos técnicas del sistema.

### Idempotencia

Si el script se ejecuta varias veces:
- No duplica usuarios por email.
- No duplica balance del mismo usuario/año.

### Ejecución

Desde `apps/api`:

```bash
python -m scripts.seed_mvp
```

### Requisito previo

Haber aplicado migraciones:

```bash
alembic upgrade head
```
