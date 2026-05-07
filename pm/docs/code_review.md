# Code Review

**Fecha:** 2026-05-07
**Rama:** main
**Alcance:** Backend completo + Frontend (lib, hooks, api client)

---

## Resumen ejecutivo

El codigo es claro, bien organizado y cumple con los objetivos del MVP. Las separaciones de responsabilidades son adecuadas: `crud.py` solo habla con la BD, `chat.py` orquesta la IA, `main.py` expone las rutas. En el frontend, el patron de actualizaciones optimistas esta bien implementado con rollback correcto en la mayoria de operaciones.

Se identificaron **4 problemas altos**, **6 medios** y **5 bajos**.

---

## Problemas Altos

### A1 — `ai.py`: cliente sincrono dentro de funcion `async`

**Archivo:** `backend/ai.py:47`

```python
response = client.chat.completions.create(...)  # bloqueante
```

`OpenAI` (sin `AsyncOpenAI`) hace la llamada HTTP de forma sincrona. Dentro de una funcion `async def`, esto bloquea el event loop de FastAPI durante toda la duracion del request al modelo (puede ser 5-15 segundos), haciendo que el servidor no pueda atender otras peticiones en ese tiempo.

**Correccion:** Usar `AsyncOpenAI` y `await`:

```python
from openai import AsyncOpenAI

async def call_ai(prompt: str, timeout: int = 15) -> str:
    client = AsyncOpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
    response = await client.chat.completions.create(...)
```

---

### A2 — `crud.py`: N+1 queries en `get_or_create_user_board`

**Archivo:** `backend/app/crud.py:60`

```python
position=db.query(Card).filter(Card.column_id == column.id).count()
```

Esta linea se ejecuta dentro de un loop por cada tarjeta por defecto. Con 5 columnas y 5 tarjetas, genera 5 queries adicionales innecesarias. Como `position` siempre sera 0 (es la primera tarjeta de cada columna), se puede reemplazar directamente:

```python
card = Card(column_id=column.id, title=title, details=details, position=0)
```

---

### A3 — `main.py`: `generate_token` importa `base64` dentro de la funcion

**Archivo:** `backend/main.py:35`

```python
def generate_token(user_id: int) -> str:
    import base64  # import dentro de funcion
```

Lo mismo en `decode_token` (linea 43). Los imports dentro de funciones se ejecutan en cada llamada y son un anti-patron en Python. Mover ambos al nivel del modulo.

---

### A4 — `chat.py`: mensaje de error interno expuesto al usuario

**Archivo:** `backend/chat.py:257`

```python
structured_response = ChatResponse(
    response=f"I encountered an error processing your request: {e}\n\nRaw response: {ai_response_text}",
    ...
)
```

Cuando el parsing de la respuesta de la IA falla, se le devuelve al usuario el texto completo de la respuesta cruda del modelo. Esto puede filtrar informacion interna del prompt o detalles del sistema. El error interno debe loggearse y al usuario mostrarle un mensaje generico:

```python
logger.warning(f"AI response parse error: {e}. Raw: {ai_response_text[:200]}")
structured_response = ChatResponse(
    response="No pude procesar la solicitud. Intentalo de nuevo.",
    board_updates=None
)
```

---

## Problemas Medios

### M1 — `crud.py`: `update_column` ignora titulos vacios silenciosamente

**Archivo:** `backend/app/crud.py:96`

```python
if title:
    col.title = title
```

La condicion `if title` es falsy para strings vacios `""`. Si alguien llama `update_column(db, id, title="")`, la actualizacion se ignora sin error ni aviso. Para `update_card` ocurre lo mismo (linea 132). Usar `if title is not None` para ser explicito:

```python
if title is not None:
    col.title = title
```

---

### M2 — `main.py`: endpoint `/api/ai/test` sin autenticacion

**Archivo:** `backend/main.py:222-230`

```python
@app.post("/api/ai/test", response_model=AITestResponse)
async def test_ai(request: AITestRequest):
```

Este endpoint llama al modelo de IA sin requerir `Depends(get_current_user_id)`. Cualquier persona puede consumir la cuota de OpenRouter sin autenticarse. Agregar la dependencia de autenticacion.

---

### M3 — `useBoard.ts`: `renameColumn` usa estado desactualizado (stale closure)

**Archivo:** `frontend/src/lib/useBoard.ts:291-303`

```typescript
const updates: api.BoardUpdate = {
  columns: board.columns.map((col, idx) => ({ ... })),
  cards: board.columns.flatMap((col) => col.cardIds.map(...))
};
```

`board` en el closure del `try` se captura antes del `setBoard` optimista. Si hay otras actualizaciones en vuelo, se enviara al backend el estado anterior. Usar la misma tecnica que `moveCard` (linea 332: `const backupBoard = board`) y construir `updates` desde ese snapshot, o recalcular desde `expectedColumns` como hace `moveCard`.

---

### M4 — `chat.py`: `get_chat_history` con `limit=10` pero `crud` tiene default `50`

**Archivo:** `backend/chat.py:243` y `backend/app/crud.py:190`

```python
# chat.py
chat_history = get_chat_history(db, board_id, limit=10)

# pero el prompt tambien hace:
for msg in chat_history[-10:]:  # Last 10 messages
```

Se piden 10 mensajes y luego se hace un slice de los ultimos 10 de esos 10 — redundante. Ademas, en `get_chat_history` (crud.py:194), se hace `ORDER BY DESC LIMIT 50` y luego `[::-1]` en Python. Es mas eficiente usar una subquery o simplemente `ORDER BY ASC LIMIT N`. La doble inversion es confusa.

---

### M5 — `api.ts`: `Record<string, any>` en tipo publico

**Archivo:** `frontend/src/lib/api.ts:199`

```typescript
export type ChatRequest = {
  message: string;
  board_state?: Record<string, any>;
};
```

El uso de `any` elimina la seguridad de tipos. El `board_state` tiene una estructura conocida (la misma que construye `sendChatMessage`). Definir un tipo explicito o usar `unknown`.

---

### M6 — `main.py`: la nota del fallback del root es obsoleta

**Archivo:** `backend/main.py:318`

```python
"note": "Frontend will be served here once Part 3 is complete"
```

Esta nota hace referencia a una etapa de desarrollo que ya termino. Es codigo muerto con informacion incorrecta. Eliminar o actualizar.

---

## Problemas Bajos

### B1 — `crud.py`: `get_chat_history` devuelve hasta 50 pero el endpoint de historial devuelve todos

**Archivo:** `backend/main.py:279` y `backend/app/crud.py:190`

El endpoint `/api/chat/history` llama a `get_chat_history` sin `limit`, usando el default de 50. Para boards con mucho uso, esto puede devolver datos de mas sin paginacion. No es un problema ahora dado el MVP, pero deberia documentarse como limitacion conocida.

---

### B2 — `ai.py`: cliente de OpenAI re-instanciado en cada llamada

**Archivo:** `backend/ai.py:38`

```python
client = get_ai_client()  # dentro de call_ai, ejecutado en cada request
```

El cliente de OpenAI se crea de nuevo en cada llamada a `call_ai`. Para un MVP con poco trafico no es problema, pero es innecesario. Se podria cachear a nivel de modulo con un singleton simple.

---

### B3 — `useBoard.ts`: `deleteCard` hace `loadBoard()` completo en caso de error

**Archivo:** `frontend/src/lib/useBoard.ts:260`

```typescript
} catch (err) {
    await loadBoard();  // refetch completo
```

En caso de error al borrar, se hace un refetch completo del board. El resto de operaciones revierten el estado optimista sin refetch. Inconsistencia menor que podria causar parpadeos de UI innecesarios. Considerar revertir el estado optimista guardando `backupBoard` como hace `moveCard`.

---

### B4 — `main.py`: endpoints de demo innecesarios en produccion

**Archivo:** `backend/main.py:291-302`

```python
@app.post("/api/echo")
@app.get("/api/test-math")
```

Estos endpoints son artefactos del desarrollo inicial. No tienen uso funcional en el MVP final y amplian la superficie de la API innecesariamente.

---

### B5 — `chat.py`: prompt incluye seccion `=== YOUR RESPONSE ===` redundante

**Archivo:** `backend/chat.py:56-57`

```python
prompt_parts.append("\n=== YOUR RESPONSE ===")
prompt_parts.append("Respond in JSON format with 'response' and optional 'board_updates' fields.")
```

Esta instruccion repite lo que ya se explica al inicio del prompt (lineas 28-41). El prompt es mas largo de lo necesario. Eliminar la seccion final o consolidar con las instrucciones del inicio.

---

## Aspectos positivos destacados

- **Actualizaciones optimistas con rollback** bien implementadas en `moveCard` y `addCard`.
- **Validacion de ownership** consistente en todos los endpoints que modifican datos (columna pertenece al board del usuario).
- **Separacion de responsabilidades** clara: `crud.py` solo BD, `chat.py` solo logica de IA, `main.py` solo routing.
- **Cascada de deletes** configurada correctamente en los modelos ORM.
- **`parse_ai_response`** maneja el caso donde la IA no devuelve JSON puro (fallback a texto plano).
- **Indices de BD** definidos en `models.py` para las queries mas comunes (`board_id`, `column_id`, `created_at`).

---

## Tabla resumen

| ID  | Severidad | Archivo              | Descripcion breve                                    |
|-----|-----------|----------------------|------------------------------------------------------|
| A1  | Alta      | `ai.py:47`           | Cliente sincrono bloquea el event loop               |
| A2  | Alta      | `crud.py:60`         | N+1 queries en creacion de board                     |
| A3  | Alta      | `main.py:35,43`      | Imports de `base64` dentro de funciones              |
| A4  | Alta      | `chat.py:257`        | Respuesta cruda de IA expuesta al usuario            |
| M1  | Media     | `crud.py:96,132`     | `if title` ignora strings vacios silenciosamente     |
| M2  | Media     | `main.py:222`        | Endpoint `/api/ai/test` sin autenticacion            |
| M3  | Media     | `useBoard.ts:291`    | Stale closure en `renameColumn`                      |
| M4  | Media     | `chat.py:243`        | Doble limitacion redundante en historial de chat     |
| M5  | Media     | `api.ts:199`         | `any` en tipo publico `ChatRequest`                  |
| M6  | Media     | `main.py:318`        | Nota obsoleta en fallback del root                   |
| B1  | Baja      | `main.py:279`        | Sin paginacion en endpoint de historial              |
| B2  | Baja      | `ai.py:38`           | Cliente de OpenAI re-instanciado por request         |
| B3  | Baja      | `useBoard.ts:260`    | `deleteCard` hace refetch completo en error          |
| B4  | Baja      | `main.py:291`        | Endpoints de demo expuestos en produccion            |
| B5  | Baja      | `chat.py:56`         | Instruccion redundante al final del prompt           |
