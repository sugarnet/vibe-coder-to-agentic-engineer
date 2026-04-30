# Code Review — Kanban PM MVP

Date: 2026-04-30

---

## Resumen Ejecutivo

Los problemas mas criticos encontrados en el codigo real:

1. **`decode_token` es sobre-ingenieria pura** (`backend/main.py` lineas 49-107): 60 lineas con tres bloques try/except anidados, validacion de caracteres base64 a mano, y mensajes de error con f-strings que filtran informacion interna — todo para decodificar un token que solo contiene `user_id:username:password` en base64 sin firma. El token es trivialmente forgeable: cualquiera que sepa el esquema puede fabricar uno. La longitud del codigo da falsa sensacion de seguridad.

2. **El token encode el password en texto plano** (`backend/main.py` linea 45): `token_data = f"{user_id}:{VALID_USERNAME}:{VALID_PASSWORD}"` — el password "password" viaja en cada request en la cabecera Authorization, decodificable con un `base64 -d`. Para un MVP local esto es aceptable, pero la funcion `generate_token` lleva comentarios que hablan de "XOR-based obfuscation" y "mock, not secure" que inducen a confundirla con algo mas robusto de lo que es.

3. **`get_or_create_user_board` tiene una query N+1 en la creacion de cards** (`backend/app/crud.py` linea 60): dentro del loop de creacion de cards por defecto se ejecuta `db.query(Card).filter(...).count()` por cada card — una query adicional por iteracion durante la inicializacion del board.

4. **`handleAddCard` en el frontend hardcodea un string por defecto** (`frontend/src/components/KanbanBoard.tsx` linea 89): `addCard(columnId, title, details || "No details yet.")` — esto sustituye el string vacio del usuario por texto falso que se almacena en base de datos como si fuera contenido real.

5. **`decode_token` llama `crud.get_or_create_user` en cada request autenticada** (`backend/main.py` linea 98): cada endpoint que use `get_current_user_id` dispara un `SELECT` + potencial `INSERT` a la base de datos como parte de la validacion del token, en lugar de solo validar las credenciales embebidas.

6. **El sidebar de chat carga el historial en `useEffect` al montar pero no refleja mensajes enviados en la sesion actual desde el historial real** (`frontend/src/components/AIChatSidebar.tsx`): los mensajes enviados se agregan al estado local con IDs temporales (`user-${Date.now()}`), pero al reabrir el sidebar se recarga el historial de la API, lo que puede mostrar duplicados o desordenados si los timestamps del servidor difieren del cliente.

---

## Backend

### Alta Prioridad

**`backend/main.py` lineas 49-107 — `decode_token`: exceso de codigo defensivo**

La funcion tiene 60 lineas para hacer lo que podria hacerse en 10. Tiene tres niveles de try/except, valida manualmente los caracteres validos de base64 (algo que `base64.b64decode(validate=True)` ya hace), y el bloque exterior `except Exception` captura lo que los bloques interiores ya capturan. Los mensajes de error son verbosos y filtran detalles internos al cliente (`f"Invalid characters in token: {invalid_chars}"`, `f"User mismatch: token has {user_id}, db has {user.id}"`).

Recomendacion: reducir a lo esencial.

```python
def decode_token(token: str, db: Session) -> int:
    try:
        decoded = base64.b64decode(token, validate=True).decode()
        user_id_str, username, password = decoded.split(":", 2)
        if username != VALID_USERNAME or password != VALID_PASSWORD:
            raise ValueError
        return int(user_id_str)
    except Exception:
        raise ValueError("Invalid token")
```

---

**`backend/main.py` linea 45 — el token codifica el password en texto plano**

`token_data = f"{user_id}:{VALID_USERNAME}:{VALID_PASSWORD}"` pone la password "password" en cada header de cada request. El comentario en linea 47 dice "XOR-based obfuscation" pero no hay XOR; es base64 puro. Para un MVP local con credenciales hardcodeadas esto es tolerable, pero el comentario es incorrecto y genera confusion.

Recomendacion: eliminar el comentario sobre XOR. Si el token no va a cambiar mientras las credenciales sean identicas, basta con almacenar solo `user_id` en el token y validar contra las constantes, sin necesidad de incluir `VALID_PASSWORD` en el payload.

---

**`backend/main.py` linea 98 — `get_or_create_user` en cada validacion de token**

`decode_token` llama `crud.get_or_create_user(db, VALID_USERNAME)` en cada request autenticada. Esto es una query a la base de datos (y potencialmente un INSERT) como parte de la logica de autenticacion. El user siempre existe despues del primer login, pero el `get_or_create` implica un SELECT en cada llamada.

Recomendacion: dado que el MVP tiene un solo usuario con ID fijo, simplificar a `get_user_by_username` y asumir que existe. Si no existe, el error es apropiado.

---

**`backend/main.py` lineas 127-131 — emojis en codigo**

```python
print(f"✓ Token validated for user_id={user_id}")
print(f"❌ Token validation failed: {e}")
```

El AGENTS.md especifica explicitamente "no emojis ever". Estos prints con emojis estan en produccion, no solo en tests.

Recomendacion: eliminar los `print` o reemplazarlos con `logger.debug/warning` sin emojis.

---

### Media Prioridad

**`backend/app/crud.py` lineas 49-63 — query N+1 en creacion de cards por defecto**

En `get_or_create_user_board`, al crear las cards por defecto se ejecuta:

```python
position=db.query(Card).filter(Card.column_id == column.id).count()
```

dentro de un loop. Como las columnas acaban de ser creadas y no tienen cards, este count siempre retorna 0. La query es redundante.

Recomendacion: usar `position=idx` o un contador local, eliminar la query.

---

**`backend/app/crud.py` linea 92 — `update_column` silencia actualizaciones con titulo vacio**

```python
if title:
    col.title = title
```

Esto impide actualizar un titulo a string vacio, pero tambien ignora silenciosamente el caso en que `title` sea `""`. Dado que el schema `ColumnUpdateInBoard` no tiene validacion `min_length`, un titulo vacio puede llegar aqui y ser ignorado sin error.

---

**`backend/app/crud.py` linea 128 — `update_card` misma inconsistencia para title**

```python
if title:
    card.title = title
if details is not None:
    card.details = details
```

`title` y `details` tienen tratamiento asimetrico: un title vacio se ignora silenciosamente, mientras que `details` puede ser vaciado explicitamente con `None`. El schema `CardUpdate` tiene `min_length=1` para title, pero eso solo aplica si el campo viene en el request; si el codigo llega a `update_card` con `title=""` desde otro punto interno (como el chat), se ignora en silencio.

---

**`backend/app/crud.py` lineas 190-194 — `get_chat_history` hace reverse en Python**

```python
return db.query(ChatHistory)...order_by(desc(ChatHistory.created_at)).limit(limit).all()[::-1]
```

Pide los ultimos N registros en orden descendente y luego los invierte en Python. Esto es correcto en resultado pero involucrado: la query trae los datos en DESC para aplicar LIMIT correctamente, luego los re-ordena. Es un patron conocido con SQLite, pero el comentario en la funcion no explica por que se hace asi. Podria simplificarse con una subquery o aclarado con un comentario.

---

**`backend/main.py` lineas 250-258 — `update_card` no verifica null de `col`**

```python
col = crud.get_column_by_id(db, card.column_id)
board = crud.get_board_by_id(db, col.board_id)
```

Si `col` es `None` (columna borrada entre la obtencion de la card y esta llamada), la linea siguiente lanza `AttributeError: 'NoneType' object has no attribute 'board_id'`, que FastAPI convierte en un 500 sin mensaje util. El mismo patron ocurre en `delete_card` (lineas 271-273).

Recomendacion: agregar una verificacion `if not col: raise HTTPException(404)` antes de acceder a `col.board_id`.

---

**`backend/main.py` lineas 267-279 — double-check de existencia de card en `delete_card`**

```python
card = crud.get_card_by_id(db, card_id)
if not card:
    raise HTTPException(status_code=404, detail="Card not found")
...
success = crud.delete_card(db, card_id)
if not success:
    raise HTTPException(status_code=404, detail="Card not found")
```

La card se busca dos veces: una para verificar autorizacion y otra dentro de `crud.delete_card`. Si se elimina entre las dos llamadas, el segundo 404 tiene el mismo mensaje que el primero, lo que es confuso. El check `if not success` es redundante dado el check previo.

---

**`backend/chat.py` linea 76 — regex demasiado greedy para extraer JSON**

```python
json_match = re.search(r'\{.*\}', ai_text, re.DOTALL)
```

Este regex extrae desde el primer `{` hasta el ultimo `}` del texto. Si el modelo responde con texto antes del JSON que contiene llaves (como nombres de columnas entre llaves), el match puede ser incorrecto o demasiado amplio.

Recomendacion: usar un enfoque de busqueda desde el primer `{` con un parser JSON incremental, o instruir al modelo a responder exclusivamente con JSON (sin texto envolvente) y usar `json.loads(ai_text.strip())` directamente con fallback.

---

**`backend/chat.py` lineas 281-283 — orden incorrecto: el mensaje se guarda antes de que las actualizaciones fallen**

```python
# Apply board updates if present
if structured_response.board_updates:
    try:
        update_counts = apply_board_updates(...)
    except ValueError as e:
        structured_response.response += f"\n\nWarning: Could not apply board updates: {e}"
        structured_response.board_updates = None

# Save messages to chat history
add_chat_message(db, board_id, "user", user_message)
add_chat_message(db, board_id, "assistant", structured_response.response)
```

El guardado en historial ocurre despues del intento de actualizacion. Esto es correcto en orden, pero si `apply_board_updates` hace commit de cambios parciales antes de fallar (algunos `create_card` exitosos antes de un `move_card` fallido), el historial quedara inconsistente con el estado del board.

---

**`backend/ai.py` lineas 82-86 — `print` de debug en produccion**

```python
print(f"DEBUG: AI API error details: {type(e).__name__}: {e}")
print(f"DEBUG: Response status: ...")
print(f"DEBUG: Response body: ...")
```

Prints de debug con el prefijo "DEBUG:" en el handler de excepciones de produccion. Deberian ser `logger.debug` o eliminados.

---

**`backend/ai.py` lineas 56-68 — validacion defensiva excesiva de la respuesta de OpenAI SDK**

```python
if isinstance(response, str):
    raise ValueError(f"AI returned raw string response: {response}")
if not hasattr(response, "choices") or not response.choices:
    ...
first_choice = response.choices[0]
if not hasattr(first_choice, "message") or not hasattr(first_choice.message, "content"):
    ...
```

El SDK de `openai` retorna objetos tipados; `hasattr` checks en `choices`, `message`, y `content` son defensivos contra comportamientos que el SDK no produce en uso normal. El check `isinstance(response, str)` es especialmente innecesario ya que `client.chat.completions.create` nunca retorna un string.

Recomendacion: simplificar a acceder directamente y dejar que el SDK levante sus propias excepciones si algo es inesperado.

---

### Baja Prioridad

**`backend/main.py` lineas 6-7 — imports no usados**

`import secrets` y `import string` (linea 7 del modulo, no el de `decode_token`) se importan al inicio pero `secrets` no se usa en ninguna parte del archivo. La importacion de `string` dentro de `decode_token` (linea 62) duplica el import del modulo.

---

**`backend/main.py` lineas 355-366 — endpoints de test en produccion**

`/api/echo` y `/api/test-math` son endpoints de desarrollo que no tienen utilidad en produccion y amplian la superficie de la API sin necesidad.

---

**`backend/app/models.py` linea 19 — `datetime.utcnow` deprecado en Python 3.12**

```python
created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

`datetime.utcnow` esta deprecado desde Python 3.12. El reemplazo idiomatico es `datetime.now(UTC)` con `from datetime import UTC`.

---

**`backend/db.py` linea 21 — `expire_on_commit=False` puede enmascarar bugs**

`SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)` evita que los objetos se expiren despues de un commit, lo que es util para evitar lazy-loading errors despues de cerrar la sesion. Sin embargo, significa que los objetos pueden tener datos stale si se reutilizan despues de multiples operaciones. Para este MVP es aceptable, pero merece un comentario explicando por que esta configurado asi.

---

## Frontend

### Alta Prioridad

**`frontend/src/components/KanbanBoard.tsx` linea 89 — hardcoded fallback string en `handleAddCard`**

```javascript
addCard(columnId, title, details || "No details yet.")
```

Cuando el usuario no escribe detalles, se almacena el texto "No details yet." en base de datos como si fuera contenido real. Este string aparecera en la AI como contexto de board y en el UI como si el usuario lo hubiera escrito. El campo `details` ya es opcional en el schema del backend.

Recomendacion: pasar `details || ""` o simplemente `details`.

---

**`frontend/src/lib/api.ts` lineas 197-204 — funcion `updateColumn` exportada que siempre lanza error**

```typescript
export async function updateColumn(columnId: number, input: ColumnUpdate): Promise<Column> {
  throw new Error("Individual column updates not supported - use updateBoard");
}
```

Esta funcion esta exportada y aparece en el modulo publico de la API, pero nunca puede usarse. Cualquier consumidor que la llame obtiene un error en runtime sin advertencia en tiempo de compilacion.

Recomendacion: eliminar la funcion. Si se necesita documentar la limitacion, un comentario en `updateBoard` es suficiente.

---

**`frontend/src/components/AIChatSidebar.tsx` linea 37 — defensive check innecesario**

```typescript
const historyList = Array.isArray(history) ? history : [];
```

`fetchChatHistory` retorna `Promise<ChatHistoryItem[]>` y el backend retorna siempre un array. Este check defensivo viola el coding standard del proyecto ("NO unnecessary defensive programming").

---

**`frontend/src/components/KanbanBoard.tsx` lineas 26-27 — estado `delayedError` redundante con `error`**

El hook `useBoard` ya expone un `error` de estado. El componente introduce un segundo estado `delayedError` para errores de acciones (mover, renombrar, etc.). Esto resulta en dos variables de error distintas combinadas en linea 39: `const displayedError = delayedError || error`. Si ambas estan activas simultáneamente, solo se muestra una.

Recomendacion: unificar en un solo estado de error con auto-clear por timeout, o que el hook `useBoard` maneje el auto-clear internamente.

---

### Media Prioridad

**`frontend/src/lib/useBoard.ts` lineas 62-69 — funciones `toApiCardId` / `toApiColumnId` son triviales y aumentan el ruido**

```typescript
function toApiCardId(cardId: string): number {
  return parseInt(cardId, 10);
}
function toApiColumnId(columnId: string): number {
  return parseInt(columnId, 10);
}
```

Son wrappers de una sola linea alrededor de `parseInt`. La abstraccion no aporta nada que no aporte nombrar bien el sitio de llamada. Se usan 8 veces en el archivo.

Recomendacion: inline `parseInt(cardId, 10)` en los sitios de uso o, si se quiere documentar la conversion, un comentario unico basta.

---

**`frontend/src/lib/useBoard.ts` linea 332 — `backupBoard` captura una referencia al objeto, no una copia profunda**

```typescript
const backupBoard = board;
```

`board` es un objeto de estado de React. En el mismo closure, `board` es inmutable (no cambia), por lo que esto funciona correctamente para el rollback. Sin embargo, el nombre `backupBoard` sugiere una copia independiente cuando en realidad es la misma referencia. En `deleteCard` se usa el patron opuesto (llamar `loadBoard()` para revertir), lo que es inconsistente.

---

**`frontend/src/lib/useBoard.ts` lineas 290-305 — `renameColumn` envia todas las posiciones de todas las cards solo para renombrar una columna**

Para cambiar el titulo de una columna, se serializa el estado completo del board (todas las columnas con sus posiciones, todas las cards con sus posiciones) y se envia al endpoint `/api/board`. Esto es funcional pero sobrecargado para una operacion de rename.

El backend tiene la misma logica en `update_board` iterando sobre todos los items. Para un MVP local esto es aceptable, pero la raiz del problema es que el endpoint `/api/board` es el unico punto de actualizacion de columnas, forzando este patron batch para operaciones simples.

---

**`frontend/src/lib/kanban.ts` lineas 18-72 — `initialData` no se usa en produccion**

El archivo `kanban.ts` exporta `initialData` con datos de demo hardcodeados. En produccion, el board se carga siempre desde la API via `useBoard`. Este dato no se referencia en ningun componente o hook de produccion (solo podria usarse en tests). Si no se usa en tests actuales, es codigo muerto.

---

**`frontend/src/lib/kanban.ts` lineas 84-168 — `moveCard` y `createId` exportados sin uso en produccion**

La funcion `moveCard` (la version pura de `kanban.ts`) y `createId` son reliquias del frontend-only demo mencionado en AGENTS.md. En produccion, `useBoard.ts` implementa su propio moveCard con optimistic update. La funcion `kanban.ts/moveCard` no se llama desde ningun componente o hook de produccion.

Recomendacion: si no se usan en tests significativos, eliminar. Mantener solo los tipos (`Card`, `Column`, `BoardData`).

---

**`frontend/src/components/KanbanColumn.tsx` linea 44 — cada keystroke en el titulo de columna dispara `onRename`**

```typescript
onChange={(event) => onRename(column.id, event.target.value)}
```

`onRename` en `KanbanBoard` llama `renameColumn` en `useBoard`, que hace un API call. Cada caracter escrito en el titulo de columna dispara una llamada al backend. En `useBoard.renameColumn`, esto ademas serializa el board completo. En la practica, el usuario ve lag y se generan N requests al backend por cada rename.

Recomendacion: usar `onBlur` o debounce para disparar el API call solo cuando el usuario termina de escribir.

---

**`frontend/src/components/AIChatSidebar.tsx` lineas 154 — overlay click cierra el sidebar pero el layout es un panel lateral**

```typescript
<div className="fixed inset-0 z-50 flex items-end justify-end p-4 lg:items-end lg:justify-end" onClick={onToggle}>
```

El sidebar usa `fixed inset-0` (cubre toda la pantalla) con un `onClick` en el overlay para cerrar. Esto bloquea la interaccion con el Kanban board cuando el chat esta abierto. El diseno en `KanbanBoard.tsx` sugiere que debia ser un panel lateral fijo (`flex h-screen` con el sidebar a la derecha), no un modal flotante.

---

**`frontend/src/components/AIChatSidebar.tsx` linea 132 — `onKeyPress` esta deprecado en React 19**

```typescript
onKeyPress={handleKeyPress}
```

`onKeyPress` esta deprecado en el DOM y en React. El reemplazo es `onKeyDown`.

---

**`frontend/src/lib/api.ts` lineas 209-215 — tipo `ChatMessage` declarado pero no usado**

```typescript
export type ChatMessage = {
  id: number;
  user_id: number;
  message: string;
  response: string;
  created_at: string;
};
```

Este tipo no corresponde a ningun endpoint real del backend (el historial usa `ChatHistoryItem`). Es un tipo fantasma que nunca se usa y no coincide con el schema del backend (`ChatHistoryResponse` tiene `id`, `role`, `content`, `created_at`).

---

**`frontend/src/lib/api.ts` lineas 231-238 — tipo `ChatResponse.board_updates` usa `string` para IDs en vez de `number`**

```typescript
board_updates?: Array<{
  action: "create_card" | "move_card" | "delete_card";
  card_id?: string;
  column_id?: string;
  ...
}>
```

El backend retorna `card_id` y `column_id` como `int` en `BoardUpdateAction`. El tipo del frontend los declara como `string`, lo que es incorrecto. En `AIChatSidebar.tsx` se usan solo para generar strings descriptivos, por lo que el bug no produce un error en runtime hoy, pero el tipo es incorrecto respecto al contrato real de la API.

---

### Baja Prioridad

**`frontend/src/lib/auth.ts` linea 52 — `user_id` del login response se descarta**

El backend retorna `{ username, token, user_id }` en el login. El frontend solo guarda `{ username, token }` y descarta `user_id`. Esto es correcto para el MVP (el user_id no se necesita en el frontend), pero el tipo `User` en `auth.ts` podria documentar que `user_id` existe en el response aunque no se use.

---

**`frontend/src/components/LoginForm.tsx` linea 1 — `isLoading` prop no se usa internamente**

```typescript
type LoginFormProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  isLoading?: boolean;
  ...
};
```

`isLoading` esta en el tipo de props y se usa en el JSX para deshabilitar campos y mostrar "Signing in...". Pero en `page.tsx` (linea 24) `LoginForm` se renderiza sin pasar `isLoading`:

```typescript
<LoginForm onLogin={async (username, password) => { await login(username, password); }} error={error || undefined} />
```

El estado de carga del `useAuth` hook (`isLoading`) no se pasa al `LoginForm`. El boton nunca muestra "Signing in..." en la implementacion actual.

---

## AI / Chat

### Alta Prioridad

**`backend/chat.py` lineas 28-41 — el prompt mezcla system instructions con user content en un solo string**

El sistema de prompt usa un unico string concatenado que incluye instrucciones del sistema, estado del board, historial de chat y el mensaje del usuario. El cliente OpenAI soporta el array `messages` con roles `system` y `user` separados, lo que mejora el seguimiento de instrucciones del modelo. Con el prompt actual, el modelo puede confundir instrucciones con contenido.

Recomendacion: separar en `[{"role": "system", "content": instrucciones}, {"role": "user", "content": f"Board: ...\n\nMessage: {user_message}"}]` dentro de `call_ai`.

---

**`backend/chat.py` linea 243 — el historial se pide dos veces para el mismo board**

En `process_chat_message`, se llama `get_chat_history(db, board_id, limit=10)`. Pero `build_ai_prompt` ya corta el historial a los ultimos 10 con `chat_history[-10:]`. Si `get_chat_history` retorna 50 items (el limite por defecto), se traen 50 de la DB y se usan 10 en el prompt.

Recomendacion: pasar `limit=10` al llamar `get_chat_history` en `process_chat_message` y eliminar el slicing redundante en `build_ai_prompt`.

---

**`backend/chat.py` lineas 262-279 — `apply_board_updates` no es transaccional**

Si hay multiples acciones (por ejemplo, crear dos cards y mover una), y la segunda falla, la primera ya fue committed a la base de datos. El `except ValueError` solo agrega un warning al response pero las acciones exitosas previas quedan persistidas. Para el usuario esto genera un estado inconsistente con lo que el AI decia que iba a hacer.

---

### Media Prioridad

**`backend/chat.py` linea 173 — `move_card` usa position 999 como placeholder**

```python
crud.move_card(db, update.card_id, update.target_column_id, 999)
```

El valor 999 como posicion "al final" es un magic number. Si una columna tiene mas de 999 cards, fallaria. Mas importante: `move_card` en crud.py shifts las posiciones de otras cards `>= position`, por lo que position 999 puede causar que otras cards sean shifted innecesariamente si hay menos de 999.

Recomendacion: calcular la posicion real como `db.query(Card).filter(Card.column_id == target_column_id).count()`.

---

**`backend/ai.py` linea 49 — modelo hardcodeado como string**

```python
model="openai/gpt-oss-120b"
```

El nombre del modelo esta hardcodeado en el cuerpo de la funcion. Si se necesita cambiar, hay que buscar en el codigo. Podria ser una constante a nivel de modulo o una variable de entorno.

---

**`frontend/src/components/AIChatSidebar.tsx` lineas 87-100 — el resumen de `board_updates` en el frontend es siempre generico**

```typescript
case "move_card":
    boardUpdates.push(`Moved card to different column`);
case "delete_card":
    boardUpdates.push(`Deleted a card`);
```

El AI response incluye `card_id` y `target_column_id` en los updates, pero el frontend no los usa para dar informacion util. "Moved card to different column" y "Deleted a card" son mensajes que no ayudan al usuario a saber que cambio.

---

## Seguridad

### Alta Prioridad

**`backend/main.py` lineas 44-47 — el token es trivialmente forgeable**

Cualquiera que conozca el esquema (`base64("{user_id}:{username}:{password}")`) puede fabricar un token valido sin haber pasado por el login. Para un MVP local con un solo usuario, esto es tolerable, pero el codigo tiene comentarios que sugieren que es "self-validating" como si tuviera integridad criptografica, cuando no la tiene. El riesgo real en el contexto declarado (Docker local) es bajo.

---

**`backend/main.py` lineas 94-95 — el password viaja en cada request**

El header `Authorization: Bearer <token>` contiene el password en base64 en cada request autenticada. Si alguien intercepta el header, obtiene las credenciales directamente. Para HTTPS local esto no es un problema practico, pero merece ser documentado.

---

**`backend/main.py` lineas 104-107 — mensajes de error verbosos en auth**

```python
raise ValueError(f"Invalid characters in token: {invalid_chars}")
raise ValueError(f"Invalid token format: expected 3 parts, got {len(parts)}")
raise ValueError(f"User mismatch: token has {user_id}, db has {user.id}")
```

Estos mensajes de error (que se exponen al cliente via el HTTPException en linea 131) revelan detalles internos del esquema del token, facilitando ataques de enumeracion. Todos deberian ser "Invalid token" sin detalle.

---

**`backend/main.py` — ausencia de CORS configuration**

El backend no configura `CORSMiddleware`. Para el uso en Docker con el frontend servido desde el mismo origen esto no es problema, pero si el frontend corre en dev (`:3000`) y el backend en (`:8000`), los requests fallan o requieren configuracion adicional no documentada.

---

### Baja Prioridad

**`backend/main.py` linea 37 — `valid_tokens: dict[str, int] = {}` declarado pero no usado**

El diccionario `valid_tokens` se declara como si fuera para almacenar tokens en memoria, pero nunca se usa. El sistema es stateless (como indica el comentario), pero la variable fantasma puede confundir a quien lea el codigo.

Recomendacion: eliminar la declaracion.

---

## General / Inconsistencias Frontend-Backend

### Alta Prioridad

**`frontend/src/lib/kanban.ts` referencia a columnas con IDs string (`col-backlog`) vs backend con IDs numericos**

El archivo `kanban.ts` tiene `initialData` con IDs como `"col-backlog"`, `"card-1"`. El backend usa IDs numericos autoincrement. La conversion se hace en `useBoard.ts` via `parseInt`. Esto funciona, pero el tipo `Column.id: string` del frontend tiene semantica dual: en `initialData` son slugs descriptivos, en produccion son strings de numeros. El tipo no distingue ambos casos.

---

**`frontend/src/lib/api.ts` lineas 22-28 — tipo `Column` no incluye `cards`**

```typescript
export type Column = {
  id: number;
  board_id: number;
  title: string;
  position: number;
};
```

El endpoint `GET /api/user/board` retorna columnas con `cards` anidadas (segun `ColumnResponse` en el schema del backend). El tipo `Column` del frontend no incluye `cards`. En su lugar, el tipo `Board` del frontend tiene `cards: Card[]` al nivel raiz (el campo `cards` flattened del `BoardResponse`).

Esto funciona porque `convertApiToLocal` en `useBoard.ts` usa `apiBoardData.cards` (el array flattened), pero el tipo `Board.columns` tiene tipo `Column[]` sin cards, cuando la API real retorna columnas con cards anidadas. La deserializacion funciona por accidente del campo `cards` en `BoardResponse` (el `@computed_field` de Pydantic), no por diseño explicito.

---

**`backend/app/schemas.py` linea 66-73 — `BoardResponse.cards` es un `@computed_field` que duplica informacion**

```python
@computed_field
@property
def cards(self) -> List[CardResponse]:
    all_cards: List[CardResponse] = []
    for column in self.columns:
        all_cards.extend(column.cards)
    return all_cards
```

El response del board incluye las cards anidadas en cada columna (via `ColumnResponse.cards`) Y las cards en un array flat al nivel del board. El frontend usa el array flat e ignora las cards anidadas en columnas. Esto duplica los datos en cada respuesta del board.

Recomendacion: el frontend deberia usar las cards anidadas en columnas (que ya vienen ordenadas), o el backend deberia eliminar la redundancia. La inconsistencia actual hace que `ColumnResponse` tenga un campo `cards` que el cliente ignora.

---

### Media Prioridad

**`frontend/src/lib/api.ts` linea 226 — `board_state` tipado como `Record<string, any>`**

```typescript
export type ChatRequest = {
  message: string;
  board_state?: Record<string, any>;
};
```

El tipo `any` pierde toda la seguridad de tipos para el estado del board enviado al chat. El backend espera un formato especifico (columnas con cards anidadas). Deberia ser un tipo explici to o al menos `Record<string, unknown>`.

---

**`backend/chat.py` lineas 215-240 — el board_data se construye en `process_chat_message` pero el frontend ya lo envia**

Si `board_data` es `None`, la funcion construye el estado del board desde la DB. Pero el frontend siempre envia `board_state` en el request (linea 248-264 de `api.ts`). El codigo de fallback (lineas 215-240) nunca se ejecuta en la practica. Es codigo muerto con 25 lineas.

---

**`frontend/src/components/KanbanBoard.tsx` linea 216 — el grid esta hardcodeado a 5 columnas**

```typescript
<section className="grid gap-6 lg:grid-cols-5">
```

El numero de columnas del grid esta hardcodeado en 5 (`lg:grid-cols-5`). Si el backend retorna un numero diferente de columnas (el backend crea 5 por defecto, pero el schema no lo garantiza), el layout se rompe. La clase deberia ser dinamica o calculada en funcion de `board.columns.length`.

---

**`backend/app/models.py` linea 104 — `ChatHistory.board_id` podria ser `user_id`**

El MVP tiene un board por usuario. La relacion de historial de chat es con el board, no con el usuario directamente. Esto es correcto segun el schema, pero el endpoint `GET /api/chat/history` consulta por `board_id` obtenido via `get_or_create_user_board`. Si en el futuro hay multiples boards por usuario, el historial quedara mezclado o debera refactorizarse. Para el MVP actual es aceptable.

---

### Baja Prioridad

**`frontend/src/components/KanbanBoard.tsx` linea 98 — `handleDeleteCard` recibe `columnId` pero no lo usa**

```typescript
const handleDeleteCard = useCallback(
    (columnId: string, cardId: string) => {
      deleteCard(cardId).catch(...)
    },
    [deleteCard]
);
```

El parametro `columnId` se recibe pero nunca se usa. El `deleteCard` del hook no lo necesita porque busca la columna internamente. La firma puede simplificarse para eliminar el parametro innecesario (tambien en `KanbanColumn.onDeleteCard`).

---

**`frontend/src/components/AIChatSidebar.tsx` lineas 56-61 — check de `window` innecesario en componente `"use client"`**

```typescript
if (typeof window !== "undefined" && messagesEndRef.current) {
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
}
```

El componente tiene `"use client"` en linea 1. En componentes client-side de Next.js, `useEffect` solo corre en el browser; `window` siempre esta definido dentro de `useEffect`. El check es codigo defensivo innecesario.

---

**`frontend/src/components/AIChatSidebar.tsx` linea 154 — clase CSS duplicada**

```typescript
className="fixed inset-0 z-50 flex items-end justify-end p-4 lg:items-end lg:justify-end"
```

`items-end justify-end` y `lg:items-end lg:justify-end` son identicos — las versiones `lg:` no cambian nada respecto al default. Son cuatro clases redundantes.
