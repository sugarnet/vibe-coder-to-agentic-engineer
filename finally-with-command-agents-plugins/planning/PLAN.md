# FinAlly — Estación de Trading con IA

## Especificación del Proyecto

## 1. Visión

FinAlly (Finance Ally) es una estación de trading impulsada por IA, visualmente impactante, que transmite datos de mercado en vivo, permite a los usuarios operar con un portafolio simulado e integra un asistente de chat LLM capaz de analizar posiciones y ejecutar operaciones en nombre del usuario. Se ve y se siente como un terminal Bloomberg moderno con un copiloto de IA.

Este es el proyecto final de un curso de programación agéntica con IA. Es construido íntegramente por Agentes de Programación, demostrando cómo agentes de IA orquestados pueden producir una aplicación full-stack de calidad productiva. Los agentes se comunican a través de archivos en `planning/`.

## 2. Experiencia de Usuario

### Primer Arranque

El usuario ejecuta un único comando Docker (o un script de inicio provisto). Un navegador se abre en `http://localhost:8000`. Sin login, sin registro. Inmediatamente ve:

- Una watchlist de 10 tickers por defecto con precios actualizándose en vivo en una grilla
- $10,000 en efectivo virtual
- Una estética de terminal de trading oscura y rica en datos
- Un panel de chat de IA listo para asistir

### Qué Puede Hacer el Usuario

- **Ver precios en tiempo real** — los precios parpadean en verde (subida) o rojo (bajada) con sutiles animaciones CSS que se desvanecen
- **Ver mini-gráficos sparkline** — acción de precio junto a cada ticker en la watchlist, acumulada en el frontend desde el stream SSE desde que se cargó la página (los sparklines se completan progresivamente)
- **Hacer clic en un ticker** para ver un gráfico detallado más grande en el área de gráfico principal
- **Comprar y vender acciones** — solo órdenes de mercado, ejecución instantánea al precio actual, sin comisiones, sin diálogo de confirmación
- **Monitorear su portafolio** — un heatmap (treemap) que muestra posiciones dimensionadas por peso y coloreadas por P&L, más un gráfico de P&L que sigue el valor total del portafolio a lo largo del tiempo
- **Ver una tabla de posiciones** — ticker, cantidad, costo promedio, precio actual, P&L no realizado, % de cambio
- **Chatear con el asistente de IA** — preguntar sobre su portafolio, obtener análisis y hacer que la IA ejecute operaciones y gestione la watchlist mediante lenguaje natural
- **Gestionar la watchlist** — agregar/eliminar tickers manualmente o a través del chat de IA

### Diseño Visual

- **Tema oscuro**: fondos alrededor de `#0d1117` o `#1a1a2e`, bordes grises apagados, sin negro puro
- **Animaciones de parpadeo de precio**: breve resaltado de fondo verde/rojo al cambiar el precio, que se desvanece en ~500ms mediante transiciones CSS
- **Indicador de estado de conexión**: un pequeño punto de color (verde = conectado, amarillo = reconectando, rojo = desconectado) visible en el encabezado
- **Diseño profesional y denso en datos**: inspirado en terminales Bloomberg/trading — cada píxel justifica su lugar
- **Responsivo pero orientado a escritorio**: optimizado para pantallas anchas, funcional en tablet

### Paleta de Colores
- Amarillo Acento: `#ecad0a`
- Azul Primario: `#209dd7`
- Morado Secundario: `#753991` (botones de envío)

## 3. Visión General de la Arquitectura

### Contenedor Único, Puerto Único

```
┌─────────────────────────────────────────────────┐
│  Docker Container (port 8000)                   │
│                                                 │
│  FastAPI (Python/uv)                            │
│  ├── /api/*          REST endpoints             │
│  ├── /api/stream/*   SSE streaming              │
│  └── /*              Static file serving         │
│                      (Next.js export)            │
│                                                 │
│  SQLite database (volume-mounted)               │
│  Background task: market data polling/sim        │
└─────────────────────────────────────────────────┘
```

- **Frontend**: Next.js con TypeScript, construido como exportación estática (`output: 'export'`), servido por FastAPI como archivos estáticos
- **Backend**: FastAPI (Python), gestionado como proyecto `uv`
- **Base de datos**: SQLite, archivo único en `db/finally.db`, montado en volumen para persistencia
- **Datos en tiempo real**: Server-Sent Events (SSE) — más simple que WebSockets, push unidireccional servidor→cliente, funciona en todos lados
- **Integración de IA**: LiteLLM → OpenRouter (Cerebras para inferencia rápida), con salidas estructuradas para ejecución de operaciones
- **Datos de mercado**: controlado por variable de entorno — simulador por defecto, datos reales vía Massive API si se provee la clave

### Por Qué Estas Decisiones

| Decisión | Justificación |
|---|---|
| SSE sobre WebSockets | El push unidireccional es todo lo que necesitamos; más simple, sin complejidad bidireccional, soporte universal en navegadores |
| Exportación estática de Next.js | Origen único, sin problemas de CORS, un puerto, un contenedor, despliegue simple |
| SQLite sobre Postgres | Sin auth = sin multi-usuario = sin necesidad de servidor de base de datos; autocontenido, sin configuración |
| Contenedor Docker único | Los estudiantes ejecutan un comando; sin docker-compose en producción, sin orquestación de servicios |
| uv para Python | Gestión de proyectos Python rápida y moderna; lockfile reproducible; lo que los estudiantes deben aprender |
| Solo órdenes de mercado | Elimina el libro de órdenes, lógica de límites, rellenos parciales — matemáticas de portafolio dramáticamente más simples |

---

## 4. Estructura de Directorios

```
finally/
├── frontend/                 # Proyecto Next.js TypeScript (exportación estática)
├── backend/                  # Proyecto FastAPI uv (Python)
│   └── db/                   # Definiciones de esquema, datos semilla, lógica de migración
├── planning/                 # Documentación del proyecto para agentes
│   ├── PLAN.md               # Este documento
│   └── ...                   # Documentos de referencia adicionales para agentes
├── scripts/
│   ├── start_mac.sh          # Lanzar contenedor Docker (macOS/Linux)
│   ├── stop_mac.sh           # Detener contenedor Docker (macOS/Linux)
│   ├── start_windows.ps1     # Lanzar contenedor Docker (Windows PowerShell)
│   └── stop_windows.ps1      # Detener contenedor Docker (Windows PowerShell)
├── test/                     # Tests E2E con Playwright + docker-compose.test.yml
├── db/                       # Punto de montaje del volumen (el archivo SQLite vive aquí en runtime)
│   └── .gitkeep              # El directorio existe en el repo; finally.db está en .gitignore
├── Dockerfile                # Build multi-etapa (Node → Python)
├── docker-compose.yml        # Wrapper de conveniencia opcional
├── .env                      # Variables de entorno (en .gitignore, .env.example commiteado)
└── .gitignore
```

### Límites Clave

- **`frontend/`** es un proyecto Next.js autocontenido. No sabe nada de Python. Se comunica con el backend a través de los endpoints `/api/*` y los endpoints SSE `/api/stream/*`. La estructura interna queda a criterio del agente Frontend Engineer.
- **`backend/`** es un proyecto uv autocontenido con su propio `pyproject.toml`. Posee toda la lógica del servidor, incluyendo inicialización de base de datos, esquema, datos semilla, rutas API, streaming SSE, datos de mercado e integración LLM. La estructura interna queda a criterio de los agentes Backend/Market Data.
- **`backend/db/`** contiene las definiciones SQL del esquema y la lógica de semilla. El backend inicializa la base de datos de forma diferida en la primera solicitud — crea tablas y siembra datos por defecto si el archivo SQLite no existe o está vacío.
- **`db/`** en el nivel raíz es el punto de montaje del volumen en runtime. El archivo SQLite (`db/finally.db`) es creado aquí por el backend y persiste a través de reinicios del contenedor vía volumen Docker.
- **`planning/`** contiene documentación de todo el proyecto, incluyendo este plan. Todos los agentes referencian estos archivos como contrato compartido.
- **`test/`** contiene tests E2E con Playwright e infraestructura de soporte (e.g., `docker-compose.test.yml`). Los tests unitarios viven dentro de `frontend/` y `backend/` respectivamente, siguiendo las convenciones de cada framework.
- **`scripts/`** contiene scripts de inicio/detención que envuelven comandos Docker.

---

## 5. Variables de Entorno

```bash
# Requerida: clave de API de OpenRouter para la funcionalidad de chat LLM
OPENROUTER_API_KEY=your-openrouter-api-key-here

# Opcional: clave de API de Massive (Polygon.io) para datos de mercado reales
# Si no se configura, se usa el simulador de mercado integrado (recomendado para la mayoría de usuarios)
MASSIVE_API_KEY=

# Opcional: configurar en "true" para respuestas LLM mock deterministas (testing)
LLM_MOCK=false
```

### Comportamiento

- Si `MASSIVE_API_KEY` está configurado y no está vacío → el backend usa la REST API de Massive para datos de mercado
- Si `MASSIVE_API_KEY` está ausente o vacío → el backend usa el simulador de mercado integrado
- Si `LLM_MOCK=true` → el backend devuelve respuestas LLM mock deterministas (para tests E2E)
- El backend lee `.env` desde la raíz del proyecto (montado en el contenedor o leído vía docker `--env-file`)

---

## 6. Datos de Mercado

### Dos Implementaciones, Una Interfaz

Tanto el simulador como el cliente de Massive implementan la misma interfaz abstracta. El backend selecciona cuál usar según la variable de entorno. Todo el código downstream (streaming SSE, caché de precios, frontend) es agnóstico a la fuente.

### Simulador (Por Defecto)

- Genera precios usando movimiento browniano geométrico (GBM) con deriva y volatilidad configurables por ticker
- Se actualiza a intervalos de ~500ms
- Movimientos correlacionados entre tickers (e.g., las acciones tech se mueven juntas)
- "Eventos" aleatorios ocasionales — movimientos repentinos del 2-5% en un ticker para mayor dramatismo
- Comienza desde precios semilla realistas (e.g., AAPL ~$190, GOOGL ~$175, etc.)
- Corre como tarea de fondo en proceso — sin dependencias externas

### API de Massive (Opcional)

- Polling de REST API (no WebSocket) — más simple, funciona en todos los niveles
- Consulta la unión de todos los tickers observados en un intervalo configurable
- Nivel gratuito (5 llamadas/min): consulta cada 15 segundos
- Niveles pagos: consulta cada 2-15 segundos según el nivel
- Parsea la respuesta REST al mismo formato que el simulador

### Caché de Precios Compartida

- Una única tarea de fondo (simulador o poller de Massive) escribe en una caché de precios en memoria
- La caché almacena el precio más reciente, el precio anterior y la marca de tiempo para cada ticker
- Los streams SSE leen de esta caché y envían actualizaciones a los clientes conectados
- Esta arquitectura soporta escenarios futuros multi-usuario sin cambios en la capa de datos

### Streaming SSE

- Endpoint: `GET /api/stream/prices`
- Conexión SSE de larga duración; el cliente usa la API nativa `EventSource`
- El servidor envía actualizaciones de precios para todos los tickers conocidos por el sistema a una cadencia regular (~500ms) — en el modelo de usuario único esto equivale a la watchlist del usuario
- Cada evento SSE contiene ticker, precio, precio anterior, marca de tiempo y dirección de cambio
- El cliente maneja la reconexión automáticamente (EventSource tiene reintento integrado)

---

## 7. Base de Datos

### SQLite con Inicialización Diferida

El backend verifica la base de datos SQLite al arrancar (o en la primera solicitud). Si el archivo no existe o faltan tablas, crea el esquema y siembra los datos por defecto. Esto significa:

- Sin paso de migración separado
- Sin configuración manual de la base de datos
- Los volúmenes Docker nuevos arrancan con una base de datos limpia y sembrada automáticamente

### Esquema

Todas las tablas incluyen una columna `user_id` con valor por defecto `"default"`. Esto está codificado de forma fija por ahora (usuario único) pero permite soporte futuro multi-usuario sin migración de esquema.

**users_profile** — Estado del usuario (saldo en efectivo)
- `id` TEXT PRIMARY KEY (por defecto: `"default"`)
- `cash_balance` REAL (por defecto: `10000.0`)
- `created_at` TEXT (marca de tiempo ISO)

**watchlist** — Tickers que el usuario está siguiendo
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (por defecto: `"default"`)
- `ticker` TEXT
- `added_at` TEXT (marca de tiempo ISO)
- Restricción UNIQUE en `(user_id, ticker)`

**positions** — Tenencias actuales (una fila por ticker por usuario)
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (por defecto: `"default"`)
- `ticker` TEXT
- `quantity` REAL (fracciones de acciones soportadas)
- `avg_cost` REAL
- `updated_at` TEXT (marca de tiempo ISO)
- Restricción UNIQUE en `(user_id, ticker)`

**trades** — Historial de operaciones (log de solo escritura)
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (por defecto: `"default"`)
- `ticker` TEXT
- `side` TEXT (`"buy"` o `"sell"`)
- `quantity` REAL (fracciones de acciones soportadas)
- `price` REAL
- `executed_at` TEXT (marca de tiempo ISO)

**portfolio_snapshots** — Valor del portafolio a lo largo del tiempo (para el gráfico de P&L). Registrado cada 30 segundos por una tarea de fondo, e inmediatamente después de cada ejecución de operación.
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (por defecto: `"default"`)
- `total_value` REAL
- `recorded_at` TEXT (marca de tiempo ISO)

**chat_messages** — Historial de conversación con el LLM
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (por defecto: `"default"`)
- `role` TEXT (`"user"` o `"assistant"`)
- `content` TEXT
- `actions` TEXT (JSON — operaciones ejecutadas, cambios en watchlist realizados; null para mensajes del usuario)
- `created_at` TEXT (marca de tiempo ISO)

### Datos Semilla por Defecto

- Un perfil de usuario: `id="default"`, `cash_balance=10000.0`
- Diez entradas en la watchlist: AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX

---

## 8. Endpoints de la API

### Datos de Mercado
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/stream/prices` | Stream SSE de actualizaciones de precios en vivo |

### Portafolio
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/portfolio` | Posiciones actuales, saldo en efectivo, valor total, P&L no realizado |
| POST | `/api/portfolio/trade` | Ejecutar una operación: `{ticker, quantity, side}` |
| GET | `/api/portfolio/history` | Snapshots del valor del portafolio a lo largo del tiempo (para el gráfico de P&L) |

### Watchlist
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/watchlist` | Tickers de la watchlist actual con los precios más recientes |
| POST | `/api/watchlist` | Agregar un ticker: `{ticker}` |
| DELETE | `/api/watchlist/{ticker}` | Eliminar un ticker |

### Chat
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/chat` | Enviar un mensaje, recibir respuesta JSON completa (mensaje + acciones ejecutadas) |

### Sistema
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check (para Docker/despliegue) |

---

## 9. Integración LLM

Al escribir código para hacer llamadas a LLMs, usar el skill cerebras-inference para usar LiteLLM vía OpenRouter al modelo `openrouter/openai/gpt-oss-120b` con Cerebras como proveedor de inferencia. Se deben usar Structured Outputs para interpretar los resultados.

Hay una `OPENROUTER_API_KEY` en el archivo `.env` en la raíz del proyecto.

### Cómo Funciona

Cuando el usuario envía un mensaje de chat, el backend:

1. Carga el contexto actual del portafolio del usuario (efectivo, posiciones con P&L, watchlist con precios en vivo, valor total del portafolio)
2. Carga el historial de conversación reciente de la tabla `chat_messages`
3. Construye un prompt con un mensaje del sistema, contexto del portafolio, historial de conversación y el nuevo mensaje del usuario
4. Llama al LLM vía LiteLLM → OpenRouter, solicitando salida estructurada, usando el skill cerebras-inference
5. Parsea la respuesta JSON estructurada completa
6. Auto-ejecuta cualquier operación o cambio en la watchlist especificado en la respuesta
7. Almacena el mensaje y las acciones ejecutadas en `chat_messages`
8. Devuelve la respuesta JSON completa al frontend (sin streaming token a token — la inferencia de Cerebras es suficientemente rápida; un indicador de carga es suficiente)

### Esquema de Salida Estructurada

El LLM recibe instrucciones de responder con JSON que coincida con este esquema:

```json
{
  "message": "Tu respuesta conversacional al usuario",
  "trades": [
    {"ticker": "AAPL", "side": "buy", "quantity": 10}
  ],
  "watchlist_changes": [
    {"ticker": "PYPL", "action": "add"}
  ]
}
```

- `message` (requerido): El texto conversacional mostrado al usuario
- `trades` (opcional): Array de operaciones a auto-ejecutar. Cada operación pasa por la misma validación que las operaciones manuales (suficiente efectivo para compras, suficientes acciones para ventas)
- `watchlist_changes` (opcional): Array de modificaciones a la watchlist

### Auto-Ejecución

Las operaciones especificadas por el LLM se ejecutan automáticamente — sin diálogo de confirmación. Esta es una decisión de diseño deliberada:
- Es un entorno simulado con dinero ficticio, por lo que el riesgo es cero
- Crea una experiencia de demo impresionante y fluida
- Demuestra capacidades de IA agéntica — el tema central del curso

Si una operación falla la validación (e.g., efectivo insuficiente), el error se incluye en la respuesta del chat para que el LLM pueda informar al usuario.

### Guía del System Prompt

El LLM debe ser prompteado como "FinAlly, un asistente de trading de IA" con instrucciones para:
- Analizar la composición del portafolio, concentración de riesgo y P&L
- Sugerir operaciones con razonamiento
- Ejecutar operaciones cuando el usuario lo pide o acepta
- Gestionar la watchlist proactivamente
- Ser conciso y orientado a datos en las respuestas
- Siempre responder con JSON estructurado válido

### Modo Mock del LLM

Cuando `LLM_MOCK=true`, el backend devuelve respuestas mock deterministas en lugar de llamar a OpenRouter. Esto permite:
- Tests E2E rápidos, gratuitos y reproducibles
- Desarrollo sin una clave de API
- Pipelines CI/CD

---

## 10. Diseño del Frontend

### Layout

El frontend es una aplicación de página única con un layout denso e inspirado en terminales. La arquitectura de componentes específica y el sistema de layout quedan a criterio del Frontend Engineer, pero la UI debe incluir estos elementos:

- **Panel watchlist** — grilla/tabla de tickers observados con: símbolo del ticker, precio actual (parpadeando verde/rojo al cambiar), % de cambio diario y un mini-gráfico sparkline (acumulado desde SSE desde que se cargó la página)
- **Área de gráfico principal** — gráfico más grande para el ticker actualmente seleccionado, con al menos precio a lo largo del tiempo. Hacer clic en un ticker de la watchlist lo selecciona aquí.
- **Heatmap del portafolio** — visualización treemap donde cada rectángulo es una posición, dimensionado por peso en el portafolio, coloreado por P&L (verde = ganancia, rojo = pérdida)
- **Gráfico de P&L** — gráfico de línea que muestra el valor total del portafolio a lo largo del tiempo, usando datos de `portfolio_snapshots`
- **Tabla de posiciones** — vista tabular de todas las posiciones: ticker, cantidad, costo promedio, precio actual, P&L no realizado, % de cambio
- **Barra de operaciones** — área de entrada simple: campo de ticker, campo de cantidad, botón comprar, botón vender. Órdenes de mercado, ejecución instantánea.
- **Panel de chat de IA** — sidebar anclado/colapsable. Input de mensaje, historial de conversación con scroll, indicador de carga mientras se espera la respuesta del LLM. Ejecuciones de operaciones y cambios en watchlist mostrados inline como confirmaciones.
- **Encabezado** — valor total del portafolio (actualizándose en vivo), indicador de estado de conexión, saldo en efectivo

### Notas Técnicas

- Usar `EventSource` para la conexión SSE a `/api/stream/prices`
- Se prefiere una librería de gráficos basada en Canvas (Lightweight Charts o Recharts) por rendimiento
- Efecto de parpadeo de precio: al recibir un nuevo precio, aplicar brevemente una clase CSS con transición de color de fondo, luego eliminarla
- Todas las llamadas API van al mismo origen (`/api/*`) — no se necesita configuración de CORS
- Tailwind CSS para estilos con un tema oscuro personalizado

---

## 11. Docker y Despliegue

### Dockerfile Multi-Etapa

```
Etapa 1: Node 20 slim
  - Copiar frontend/
  - npm install && npm run build (produce exportación estática)

Etapa 2: Python 3.12 slim
  - Instalar uv
  - Copiar backend/
  - uv sync (instalar dependencias Python desde lockfile)
  - Copiar salida del build del frontend en un directorio static/
  - Exponer puerto 8000
  - CMD: uvicorn sirviendo la app FastAPI
```

FastAPI sirve los archivos estáticos del frontend y todas las rutas API en el puerto 8000.

### Volumen Docker

La base de datos SQLite persiste vía un volumen Docker con nombre:

```bash
docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally
```

El directorio `db/` en la raíz del proyecto se mapea a `/app/db` en el contenedor. El backend escribe `finally.db` en esta ruta.

### Scripts de Inicio/Detención

**`scripts/start_mac.sh`** (macOS/Linux):
- Construye la imagen Docker si aún no fue construida (o si se pasa el flag `--build`)
- Ejecuta el contenedor con el montaje de volumen, mapeo de puerto y archivo `.env`
- Imprime la URL para acceder a la app
- Opcionalmente abre el navegador

**`scripts/stop_mac.sh`** (macOS/Linux):
- Detiene y elimina el contenedor en ejecución
- NO elimina el volumen (los datos persisten)

**`scripts/start_windows.ps1`** / **`scripts/stop_windows.ps1`**: Equivalentes en PowerShell para Windows.

Todos los scripts deben ser idempotentes — seguros de ejecutar múltiples veces.

### Despliegue en la Nube (Opcional)

El contenedor está diseñado para desplegarse en AWS App Runner, Render o cualquier plataforma de contenedores. Una configuración de Terraform para App Runner puede proveerse en un directorio `deploy/` como objetivo adicional, pero no es parte del build principal.

---

## 12. Estrategia de Testing

### Tests Unitarios (dentro de `frontend/` y `backend/`)

**Backend (pytest)**:
- Datos de mercado: el simulador genera precios válidos, la matemática GBM es correcta, el parseo de respuestas de la API de Massive funciona, ambas implementaciones conforman la interfaz abstracta
- Portafolio: lógica de ejecución de operaciones, cálculos de P&L, casos límite (vender más de lo que se posee, comprar con efectivo insuficiente, vender con pérdida)
- LLM: el parseo de salida estructurada maneja todos los esquemas válidos, manejo elegante de respuestas malformadas, validación de operaciones dentro del flujo de chat
- Rutas API: códigos de estado correctos, formas de respuesta, manejo de errores

**Frontend (React Testing Library o similar)**:
- Renderizado de componentes con datos mock
- La animación de parpadeo de precio se activa correctamente en cambios de precio
- Operaciones CRUD de watchlist
- Cálculos de visualización del portafolio
- Renderizado de mensajes de chat y estado de carga

### Tests E2E (en `test/`)

**Infraestructura**: Un `docker-compose.test.yml` separado en `test/` que levanta el contenedor de la app más un contenedor de Playwright. Esto mantiene las dependencias del navegador fuera de la imagen de producción.

**Entorno**: Los tests corren con `LLM_MOCK=true` por defecto para velocidad y determinismo.

**Escenarios Clave**:
- Arranque limpio: aparece la watchlist por defecto, se muestra el saldo de $10k, los precios están en streaming
- Agregar y eliminar un ticker de la watchlist
- Comprar acciones: el efectivo disminuye, aparece la posición, el portafolio se actualiza
- Vender acciones: el efectivo aumenta, la posición se actualiza o desaparece
- Visualización del portafolio: el heatmap renderiza con los colores correctos, el gráfico de P&L tiene puntos de datos
- Chat de IA (con mock): enviar un mensaje, recibir una respuesta, la ejecución de la operación aparece inline
- Resiliencia SSE: desconectar y verificar la reconexión

---

## 13. Revisión: Preguntas, Aclaraciones y Oportunidades de Simplificación

*Agregado durante revisión del documento — 2026-06-05*

### Preguntas y Aclaraciones

**LLM / Chat**
1. **Inconsistencia en el nombre del modelo**: La sección 9 indica usar `openrouter/openai/gpt-oss-120b` vía Cerebras, pero el skill de cerebras usa un model ID específico de Cerebras. ¿Qué model ID deben usar los agentes, y hay un fallback si el modelo no está disponible? El skill debe considerarse canónico.
2. **Streaming vs. no-streaming**: El plan dice "sin streaming token a token — la inferencia de Cerebras es suficientemente rápida." ¿Es esto una restricción firme, o es aceptable el streaming vía SSE si la latencia resulta alta? Aclarar esto evita que un agente agregue streaming innecesariamente.
3. **Alcance del manejo de errores del LLM**: El plan lista "manejo elegante de respuestas malformadas" como objetivo de testing pero no da orientación sobre qué significa elegante — ¿devolver un mensaje de error al usuario, reintentar una vez, o saltear la ejecución de acciones? Una política de una oración evitaría que los agentes diverjan.
4. **Profundidad del historial de chat**: No se especifica límite para cuántas filas de `chat_messages` se cargan como contexto. Sin un límite, sesiones muy largas inflarán el prompt del LLM. ¿Deben los agentes implementar una ventana deslizante (e.g., últimos 20 mensajes)?

**Portafolio y Trading**
5. **UI de fracciones de acciones**: La columna `quantity` soporta REAL (fracciones de acciones), pero la descripción de la barra de operaciones solo menciona un "campo de cantidad." ¿Debe la UI aceptar decimales, o se intenta solo enteros por simplicidad?
6. **Posiciones con cantidad cero**: Cuando todas las acciones de una posición son vendidas, ¿debe eliminarse la fila de `positions` o mantenerse con `quantity=0`? El plan implica eliminación (la posición "desaparece"), pero esto debe ser explícito para evitar divergencia entre las expectativas del backend y el frontend.
7. **Snapshot del portafolio al arrancar**: La tarea de fondo registra un snapshot cada 30 segundos y después de cada operación. ¿Cuál es el estado inicial cuando la base de datos está recién sembrada — se escribe un snapshot en el momento de la siembra para que el gráfico de P&L tenga al menos un punto en la primera carga?

**Datos de Mercado / SSE**
8. **Validación de ticker al agregar**: Cuando un usuario agrega un ticker vía la API de watchlist o el chat de IA, ¿hay alguna validación de que el ticker existe? Con el simulador, cualquier string podría agregarse. Una aclaración sobre si aceptar todos los strings o solo tickers conocidos evita que diferentes agentes implementen comportamientos conflictivos.
9. **Forma del evento SSE**: La sección 6 describe el payload del evento SSE informalmente ("ticker, precio, precio anterior, marca de tiempo y dirección de cambio"). Un esquema JSON concreto (o tipo TypeScript) eliminaría la ambigüedad entre los agentes de backend y frontend.
10. **Universo de tickers del simulador**: El simulador se siembra con 10 tickers por defecto. Si el usuario agrega un ticker que no está en el conjunto semilla, ¿el simulador genera precios para él? El plan debe indicar si el universo de tickers del simulador es estático o dinámico.

**Docker / Despliegue**
11. **Ruta del archivo `.env` en el contenedor**: La sección 11 dice que el backend lee `.env` desde la raíz del proyecto, pero en el build Docker multi-etapa la raíz es `/app`. ¿El archivo `.env` se copia en la imagen, o siempre se espera que sea pasado vía `--env-file` en runtime? Hornear secretos en la imagen sería un problema de seguridad.
12. **Ruta del volumen vs. DATABASE_URL**: El backend escribe en `/app/db/finally.db` por convención, pero no se define ninguna variable de entorno `DATABASE_URL`. Si la ruta necesita cambiar (e.g., para tests), los agentes deben buscar el string hardcodeado. Considerar agregar `DB_PATH` a la tabla de variables de entorno.

**Testing**
13. **Runner de tests E2E**: El plan especifica un contenedor de Playwright en `docker-compose.test.yml` pero no especifica cómo invocar los tests (e.g., `npx playwright test`, un target de Make, o un script de CI). Los agentes que construyan la infraestructura de tests necesitan esto para conectar el punto de entrada.
14. **Forma de respuesta del LLM mock**: Para `LLM_MOCK=true`, ¿cuál es exactamente el JSON que devuelve el mock? Sin un fixture canónico, los tests E2E y la implementación del mock pueden divergir.

---

### Oportunidades de Simplificación

1. **Tarea de fondo para snapshots del portafolio**: Registrar cada 30 segundos más después de cada operación cubre los casos importantes. Considerar eliminar completamente el intervalo de 30 segundos y solo hacer snapshot en operaciones — el gráfico de P&L seguirá teniendo puntos de datos significativos y elimina la necesidad de un segundo temporizador de fondo. Si se desea seguimiento del valor del portafolio en tiempo real, el frontend puede calcularlo en vivo desde posiciones + precios SSE actuales.

2. **Columna `chat_messages.actions`**: Almacenar acciones ejecutadas como blob JSON en la columna `actions` agrega complejidad — el frontend debe parsearlo y el esquema es implícito. Como las operaciones ya están en la tabla `trades` y los cambios de watchlist en `watchlist`, esta columna es en gran medida redundante para reconstruir el estado. Podría eliminarse y el frontend podría inferir acciones recientes de IA desde el log de operaciones, simplificando tanto el esquema como el formato de respuesta del chat.

3. **Tabla `users_profile`**: Con un único usuario hardcodeado (`id="default"`), esta tabla es una consulta de una sola fila. El `cash_balance` podría vivir como columna en una tabla key-value de `state`, o incluso calcularse on-the-fly como `10000 - sum(valor_compras) + sum(valor_ventas)` desde la tabla `trades`, eliminando estado mutable y haciendo que el saldo siempre sea consistente con el historial de operaciones.

4. **Tabla `portfolio_snapshots`**: Si el frontend calcula el valor del portafolio en vivo desde `positions` + precios SSE, el gráfico de P&L solo necesita datos históricos — que es exactamente lo que provee `portfolio_snapshots`. Pero si los snapshots solo se escriben en operaciones, el gráfico sería escaso para un usuario que no ha operado. Un enfoque más simple: escribir un snapshot en la carga de página (i.e., cuando se llama por primera vez a `/api/portfolio`) y en cada operación, y omitir el temporizador de fondo completamente.

5. **Duplicación de scripts de inicio**: `start_mac.sh` y `start_windows.ps1` duplican la misma lógica en dos lenguajes. Un único `Makefile` con `make start` / `make stop` funcionaría en macOS y Linux (donde corre la mayoría de los desarrolladores) y reduciría la carga de mantenimiento. El soporte para Windows podría ser un objetivo adicional.

6. **SSE para todos los tickers vs. por ticker**: El plan envía actualizaciones para todos los tickers observados en cada tick SSE (~500ms). Para 10 tickers esto es trivial, pero enmarcar esto como "todos los tickers que el sistema conoce" podría simplificarse a "la watchlist del usuario" ya que solo hay un usuario — eliminando ambigüedad sobre qué significa "conocido por el sistema."

7. **Model ID en la sección del system prompt**: La sección 9 menciona el modelo en prosa, y la sección de `.env` lista `OPENROUTER_API_KEY`. Considerar agregar `LLM_MODEL` como variable de entorno (con el modelo Cerebras como valor por defecto) para que los agentes no hardcodeen el string del modelo y pueda ser sobreescrito en tests.
