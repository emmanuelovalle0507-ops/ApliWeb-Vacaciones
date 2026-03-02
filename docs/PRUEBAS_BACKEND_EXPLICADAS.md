# Pruebas Backend Explicadas (simple)

Este documento explica, en palabras simples:
1. Cómo ejecutar las pruebas.
2. Qué valida cada prueba.
3. Cómo leer el resultado.

---

## 1) ¿Cómo ejecuto todas las pruebas?

Desde `apps/api`:

```bash
python3 -m pytest tests -q
```

Qué significa:
- `python3 -m pytest`: ejecuta pytest con tu Python actual.
- `tests`: carpeta donde están las pruebas.
- `-q`: salida corta (más limpia).

---

## 2) ¿Cómo ejecuto solo un grupo?

## Solo unitarias

```bash
python3 -m pytest tests/unit -q
```

## Solo integración

```bash
python3 -m pytest tests/integration -q
```

## Una prueba puntual

```bash
python3 -m pytest tests/unit/test_security.py::test_create_and_decode_access_token -q
```

---

## 3) ¿Qué valida cada prueba?

## Archivo: `tests/unit/test_security.py`

### `test_hash_and_verify_password`

Qué prueba:
- Que la contraseña se transforma a hash (no se guarda texto plano).
- Que una contraseña correcta valida bien.
- Que una contraseña incorrecta falla.

Por qué importa:
- Seguridad básica de login.

### `test_create_and_decode_access_token`

Qué prueba:
- Que se crea un JWT válido.
- Que el token trae `sub`, `role` y `exp`.

Por qué importa:
- Garantiza que auth y roles tengan información correcta.

---

## Archivo: `tests/unit/test_vacation_service_rules.py`

### `test_calculate_requested_days`

Qué prueba:
- Que el cálculo de días funciona bien en rangos válidos.

Por qué importa:
- Evita descuentos incorrectos de saldo.

### `test_calculate_requested_days_invalid_range`

Qué prueba:
- Que si la fecha final es menor que la inicial, el sistema lanza error.

Por qué importa:
- Evita solicitudes con fechas inválidas.

---

## Archivo: `tests/integration/test_health.py`

### `test_health_check`

Qué prueba:
- Que la API responde en `/api/v1/health` con `200` y `{ "status": "ok" }`.

Por qué importa:
- Verificación rápida de que el backend está vivo.

---

## Archivo: `tests/integration/test_auth_and_rbac.py`

### `test_protected_endpoint_requires_token`

Qué prueba:
- Que endpoint protegido sin token devuelve `401`.

Por qué importa:
- Confirma barrera de autenticación.

### `test_manager_endpoint_forbidden_for_employee`

Qué prueba:
- Que un employee no puede entrar a endpoint de manager (`403`).

Por qué importa:
- Confirma control por rol.

### `test_manager_endpoint_allows_manager`

Qué prueba:
- Que un manager sí puede entrar a su endpoint (`200`).

Por qué importa:
- Verifica permiso correcto para rol autorizado.

### `test_admin_adjust_endpoint_forbidden_for_manager`

Qué prueba:
- Que un manager no puede usar endpoint admin (`403`).

Por qué importa:
- Protege operaciones sensibles.

---

## 4) ¿Cómo leer el resultado de pytest?

- `.` = prueba aprobada
- `F` = prueba falló
- `E` = error de ejecución/import/dependencias

Ejemplo bueno:
- `10 passed`

---

## 5) Resultado actual del proyecto

Resultado más reciente:

- `10 passed`
- warnings no bloqueantes

Eso significa que el set actual de pruebas está en verde.

---

## 6) Nota técnica importante

Se ajustó compatibilidad de dependencias para evitar fallos de passlib+bcrypt:

- En `apps/api/pyproject.toml` se fijó:
  - `bcrypt>=4.1.2,<5`

Esto estabiliza el hashing en el entorno local actual.
