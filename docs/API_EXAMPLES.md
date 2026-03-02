# API por Rol — Ejemplos explicados (curl)

Este documento muestra cómo consumir la API por tipo de usuario.

Objetivo:
1. Entender qué puede hacer cada rol.
2. Probar flujos completos desde terminal.
3. Alinear backend y frontend con contratos claros.

> Base URL local: `http://localhost:8000/api/v1`

---

## 1) Login (todos los roles)

### ¿Qué hace?

Autentica usuario y devuelve `access_token` JWT para llamadas protegidas.

### Request

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@vacaciones.local",
    "password": "Employee123!"
  }'
```

### Respuesta esperada

- `200 OK` con `access_token`.
- Si credenciales no son válidas: `401`.

---

## 2) Employee — crear solicitud de vacaciones

### ¿Qué hace?

Registra una solicitud en estado `PENDING`.

### Request

```bash
EMP_TOKEN="<pega_aqui_access_token_employee>"

curl -X POST "http://localhost:8000/api/v1/vacation-requests" \
  -H "Authorization: Bearer ${EMP_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2026-03-10",
    "end_date": "2026-03-14",
    "reason": "Viaje familiar"
  }'
```

### Respuesta esperada

- `200` con datos de la solicitud.
- Estado inicial: `PENDING`.
- Si no tiene manager asignado o fecha inválida: `409`.

---

## 3) Employee — ver mis solicitudes

```bash
curl -X GET "http://localhost:8000/api/v1/vacation-requests/me" \
  -H "Authorization: Bearer ${EMP_TOKEN}"
```

### ¿Por qué es útil?

Permite al empleado monitorear sus estados: pendiente/aprobada/rechazada/cancelada.

---

## 4) Manager — ver pendientes de su equipo

```bash
MANAGER_TOKEN="<pega_aqui_access_token_manager>"

curl -X GET "http://localhost:8000/api/v1/manager/vacation-requests/pending" \
  -H "Authorization: Bearer ${MANAGER_TOKEN}"
```

### Regla de negocio

Solo ve solicitudes de empleados asignados a ese manager.

---

## 5) Manager — aprobar solicitud

```bash
REQUEST_ID="<id_solicitud_pendiente>"

curl -X POST "http://localhost:8000/api/v1/manager/vacation-requests/${REQUEST_ID}/approve" \
  -H "Authorization: Bearer ${MANAGER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "decision_comment": "Aprobado por cobertura de equipo"
  }'
```

### ¿Qué ocurre internamente?

1. Se bloquea la solicitud.
2. Se valida que siga en `PENDING`.
3. Se bloquea balance del employee.
4. Si hay saldo, se descuenta y se aprueba.
5. Se registra ajuste y auditoría.

Si saldo insuficiente: `409`.

---

## 6) Manager — rechazar solicitud

```bash
curl -X POST "http://localhost:8000/api/v1/manager/vacation-requests/${REQUEST_ID}/reject" \
  -H "Authorization: Bearer ${MANAGER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "decision_comment": "No hay cobertura en esa fecha"
  }'
```

### Resultado

- Cambia estado a `REJECTED`.
- No altera saldo.
- Registra auditoría.

---

## 7) Admin — ajustar saldo manualmente

```bash
ADMIN_TOKEN="<pega_aqui_access_token_admin>"
EMPLOYEE_ID="<uuid_employee>"

curl -X POST "http://localhost:8000/api/v1/admin/vacation-balances/${EMPLOYEE_ID}/adjust?year=2026" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "days_delta": 2,
    "reason": "Ajuste por política anual"
  }'
```

### Regla importante

El ajuste no puede dejar saldo negativo.

---

## 8) Errores comunes y significado

- `401`: token inválido o ausente.
- `403`: rol sin permiso.
- `404`: recurso no encontrado.
- `409`: conflicto de negocio (ej. saldo insuficiente).
- `422`: payload inválido.

---

## 9) Flujo mínimo recomendado para demo

1. Login employee.
2. Crear solicitud.
3. Login manager.
4. Ver pendientes y aprobar.
5. Login employee y revisar balance.
6. Login admin y ejecutar ajuste manual.

Este flujo demuestra autenticación, RBAC, transacciones y auditoría en una secuencia completa.
