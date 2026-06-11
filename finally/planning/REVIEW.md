# Revision de planning/PLAN.md

## Resumen

El plan es suficientemente completo para orientar una implementacion full-stack y acierta en decisiones pragmaticas: un solo contenedor, un solo puerto, SQLite, SSE y simulador de mercado por defecto. La mayor debilidad no esta en la vision sino en los contratos entre agentes: varias formas de datos, politicas de error y detalles operativos quedan descritos en prosa, lo que aumenta el riesgo de que frontend, backend, testing y LLM implementen piezas incompatibles.

## Feedback Principal

### 1. Faltan contratos exactos de API y SSE

La seccion de endpoints enumera rutas, pero no define los schemas completos de request/response, codigos de error ni ejemplos canonicos. Esto es especialmente importante para:

- `GET /api/portfolio`
- `POST /api/portfolio/trade`
- `GET /api/watchlist`
- `POST /api/chat`
- `GET /api/stream/prices`

Recomendacion: agregar una subseccion "Contratos de API" con JSON de ejemplo para cada endpoint. Para SSE, definir si cada evento contiene un solo ticker o un batch, el nombre del evento si se usa `event:`, y el payload exacto. Por ejemplo:

```json
{
  "ticker": "AAPL",
  "price": 190.42,
  "previous_price": 190.11,
  "change": 0.31,
  "change_percent": 0.16,
  "direction": "up",
  "timestamp": "2026-06-11T12:00:00Z"
}
```

Sin esto, el frontend puede esperar arrays mientras el backend emite eventos individuales, o puede calcular campos que el backend ya intenta proveer.

### 2. La integracion LLM necesita una politica de seguridad y fallos mas explicita

La auto-ejecucion sin confirmacion es coherente para una demo con dinero ficticio, pero el plan deberia especificar limites duros para evitar comportamientos sorprendentes:

- cantidad maxima por operacion o por respuesta del LLM
- numero maximo de operaciones en una respuesta
- tickers permitidos o normalizacion de simbolos
- politica cuando el JSON estructurado es invalido
- politica cuando una accion falla despues de que otras acciones ya se ejecutaron

Recomendacion: tratar las acciones del LLM como una lista validada por el backend, no como instrucciones confiables. El plan ya lo sugiere, pero conviene convertirlo en contrato: "parsear, validar todo lo posible, ejecutar solo acciones validas, devolver resultados por accion".

### 3. Hay ambiguedad entre estado persistido y estado calculado

El plan mezcla estado mutable (`cash_balance`, `positions`, `portfolio_snapshots`) con datos derivables desde `trades` y precios actuales. Esto no es necesariamente incorrecto, pero falta definir la fuente de verdad.

Preguntas que deberian resolverse antes de implementar:

- El efectivo se calcula desde `trades` o se persiste en `users_profile.cash_balance`?
- Si una operacion se registra en `trades` pero falla actualizar `positions`, como se recupera consistencia?
- `portfolio_snapshots.total_value` usa precios del cache en memoria o precios guardados en algun lado?
- Que pasa con snapshots historicos cuando el simulador genera precios distintos despues de reiniciar?

Recomendacion: declarar explicitamente que `users_profile.cash_balance` y `positions` son la fuente de verdad operacional, mientras `trades` es log de auditoria. Luego exigir que trade execution ocurra en una transaccion SQLite.

### 4. El modelo de datos necesita restricciones y reglas de normalizacion

El esquema es claro, pero faltan restricciones que evitarian errores silenciosos:

- `ticker` deberia guardarse uppercase y sin espacios.
- `quantity` debe ser positiva en trades.
- `side` deberia tener `CHECK (side in ('buy', 'sell'))`.
- `cash_balance` no deberia quedar negativo.
- `positions.quantity` no deberia quedar negativa.
- vender toda una posicion deberia eliminar la fila o dejar `quantity=0`, pero debe elegirse una sola regla.

Recomendacion: agregar estas reglas al plan para que backend, tests y UI coincidan. Mi preferencia seria eliminar posiciones con cantidad cero y mantener el historial solo en `trades`.

### 5. El simulador de mercado necesita definir el universo dinamico

El plan dice que hay 10 tickers semilla y que el usuario puede agregar tickers. No queda cerrado si el simulador acepta cualquier ticker nuevo, si usa precios semilla genericos, o si rechaza simbolos desconocidos.

Recomendacion: definir una politica simple:

- aceptar tickers que matcheen `^[A-Z.]{1,8}$`
- si el ticker no tiene semilla, inicializarlo con un precio pseudoaleatorio determinista basado en el simbolo
- desde ese momento incluirlo en el cache y en SSE

Esto mantiene la demo flexible sin requerir una base externa de simbolos.

### 6. Docker y entorno tienen un riesgo de secretos

La seccion de Docker menciona que el backend lee `.env` desde la raiz del proyecto, pero no debe copiarse `.env` dentro de la imagen. El plan deberia decir explicitamente que `.env` se pasa solo en runtime con `--env-file` o variables de entorno del host.

Recomendacion: agregar `.env.example` como archivo requerido en la estructura y aclarar:

- `.env` esta en `.gitignore`
- Dockerfile no copia `.env`
- scripts usan `--env-file .env` si existe
- `OPENROUTER_API_KEY` puede faltar cuando `LLM_MOCK=true`

### 7. El plan de testing es bueno, pero necesita entrypoints concretos

La estrategia de testing cubre los escenarios correctos, pero no define comandos canonicos. Esto importa porque los agentes pueden crear infraestructuras distintas y no conectadas.

Recomendacion: agregar una tabla de comandos esperados:

```bash
cd backend && uv run pytest
cd frontend && npm test
cd frontend && npm run build
docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit
```

Tambien conviene definir fixtures canonicos para `LLM_MOCK=true`, especialmente una respuesta que ejecuta una compra y otra que modifica la watchlist.

## Oportunidades de Ajuste

1. Agregar `DB_PATH` y `LLM_MODEL` como variables opcionales. Reducen hardcoding y facilitan tests.
2. Definir un limite de historial de chat, por ejemplo ultimos 20 mensajes.
3. Especificar que todo endpoint de escritura devuelve el estado actualizado que el frontend necesita renderizar, para evitar refetch ambiguo.
4. Decidir si `portfolio_snapshots` se escribe cada 30 segundos o solo en eventos significativos. Si se mantiene el timer, aclarar lifecycle y cierre limpio de la tarea de fondo.
5. Mover la seccion 13 del propio `PLAN.md` a este archivo o convertirla en issues resueltos. Tener preguntas abiertas dentro del plan puede confundir a agentes que lo usan como contrato.

## Recomendacion Final

Antes de dividir el trabajo entre agentes, cerraria primero tres contratos: API JSON, SSE payload y ejecucion de trades en transaccion. Con eso, el plan queda en buen estado para implementacion paralela. Sin esos contratos, el riesgo principal es integracion tardia: piezas individualmente correctas que no encajan entre si.
