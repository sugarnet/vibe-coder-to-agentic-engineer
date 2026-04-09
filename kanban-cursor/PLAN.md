# Plan de ejecucion MVP Kanban

## Fase 1: Scaffolding

- [x] Crear app Next.js en `frontend`
- [x] Confirmar `.gitignore` para dependencias, build y env
- [x] Definir estructura base de carpetas (`app`, `components`, `lib`, `types`)

Criterio de exito: el proyecto arranca localmente y tiene estructura limpia para evolucionar.

## Fase 2: MVP funcional

- [x] Implementar una sola pizarra
- [x] Implementar 5 columnas fijas y renombrables
- [x] Implementar tarjetas con titulo y detalle
- [x] Implementar alta y baja de tarjetas
- [x] Implementar drag-and-drop entre columnas
- [x] Cargar datos dummy al iniciar

Criterio de exito: la UI permite gestionar el flujo Kanban simple sin features extra.

## Fase 3: Pruebas unitarias

- [x] Configurar Jest
- [x] Cubrir logica de tablero: crear, renombrar, agregar, borrar y mover

Criterio de exito: las pruebas unitarias pasan y cubren el flujo core del estado.

## Fase 4: Pruebas de integracion

- [x] Configurar Playwright
- [x] Escribir prueba de smoke para render + alta de tarjeta

Criterio de exito: la prueba e2e valida el camino principal de uso.

## Fase 5: Validacion final

- [x] Ejecutar lint
- [x] Ejecutar pruebas unitarias
- [x] Ejecutar pruebas e2e
- [x] Dejar servidor en ejecucion listo para usar

Criterio de exito: proyecto estable, probado y corriendo.
