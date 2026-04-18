#!/bin/bash

echo "🚀 Ejecutando validación completa del proyecto PM"
echo "=================================================="

# Función para ejecutar tests del backend
run_backend_tests() {
    echo ""
    echo "📊 Ejecutando tests del BACKEND..."
    echo "-----------------------------------"

    cd backend

    # Crear entorno virtual si no existe
    if [ ! -d "venv" ]; then
        echo "Creando entorno virtual..."
        python3 -m venv venv
    fi

    # Activar entorno virtual y instalar dependencias
    source venv/bin/activate
    pip install -r requirements.txt > /dev/null 2>&1

    # Ejecutar tests
    python3 -m pytest tests/ -v --tb=short

    BACKEND_EXIT_CODE=$?

    # Desactivar entorno virtual
    deactivate
    cd ..

    return $BACKEND_EXIT_CODE
}

# Función para ejecutar tests del frontend
run_frontend_tests() {
    echo ""
    echo "🎨 Ejecutando tests del FRONTEND..."
    echo "-----------------------------------"

    cd frontend

    # Instalar dependencias si no están instaladas
    if [ ! -d "node_modules" ]; then
        echo "Instalando dependencias..."
        npm install > /dev/null 2>&1
    fi

    # Ejecutar tests
    npm test

    FRONTEND_EXIT_CODE=$?

    cd ..

    return $FRONTEND_EXIT_CODE
}

# Función para ejecutar tests de integración (contenedor)
run_integration_tests() {
    echo ""
    echo "🔗 Ejecutando tests de INTEGRACIÓN..."
    echo "-------------------------------------"

    echo "Construyendo imagen Docker..."
    docker build -t pm-app . > /dev/null 2>&1

    echo "Iniciando contenedor de prueba..."
    docker run -d --name pm-test -p 8000:8000 pm-app uvicorn main:app --host 0.0.0.0 --port 8000 > /dev/null 2>&1

    # Esperar a que el servidor esté listo
    echo "Esperando que el servidor esté listo..."
    for i in {1..30}; do
        if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    echo "Ejecutando pruebas de integración..."

    # Login
    TOKEN=$(curl -s -X POST http://localhost:8000/api/login \
        -H "Content-Type: application/json" \
        -d '{"username": "user", "password": "password"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$TOKEN" ]; then
        echo "❌ Error: No se pudo obtener token de autenticación"
        docker stop pm-test > /dev/null 2>&1
        docker rm pm-test > /dev/null 2>&1
        return 1
    fi

    # Crear card
    CARD_RESPONSE=$(curl -s -X POST http://localhost:8000/api/cards \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"column_id": 1, "title": "Test Card", "details": "Testing integration"}')

    CARD_ID=$(echo $CARD_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2)

    if [ -z "$CARD_ID" ]; then
        echo "❌ Error: No se pudo crear card de prueba"
        docker stop pm-test > /dev/null 2>&1
        docker rm pm-test > /dev/null 2>&1
        return 1
    fi

    # Mover card
    MOVE_RESPONSE=$(curl -s -X PUT http://localhost:8000/api/board \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"columns\": [], \"cards\": [{\"id\": $CARD_ID, \"column_id\": 2, \"position\": 0}]}")

    SUCCESS=$(echo $MOVE_RESPONSE | grep -o '"success":true')

    if [ -z "$SUCCESS" ]; then
        echo "❌ Error: No se pudo mover la card"
        docker stop pm-test > /dev/null 2>&1
        docker rm pm-test > /dev/null 2>&1
        return 1
    fi

    # Verificar movimiento
    BOARD_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/user/board)
    MOVED_CARD=$(echo $BOARD_RESPONSE | grep -o '"column_id":2' | head -1)

    if [ -z "$MOVED_CARD" ]; then
        echo "❌ Error: La card no se movió correctamente"
        docker stop pm-test > /dev/null 2>&1
        docker rm pm-test > /dev/null 2>&1
        return 1
    fi

    echo "✅ Tests de integración pasaron exitosamente"

    # Limpiar
    docker stop pm-test > /dev/null 2>&1
    docker rm pm-test > /dev/null 2>&1

    return 0
}

# Parsear argumentos
RUN_BACKEND=true
RUN_FRONTEND=true
RUN_INTEGRATION=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-only)
            RUN_FRONTEND=false
            RUN_INTEGRATION=false
            shift
            ;;
        --frontend-only)
            RUN_BACKEND=false
            RUN_INTEGRATION=false
            shift
            ;;
        --integration-only)
            RUN_BACKEND=false
            RUN_FRONTEND=false
            RUN_INTEGRATION=true
            shift
            ;;
        --all)
            RUN_INTEGRATION=true
            shift
            ;;
        *)
            echo "Uso: $0 [--backend-only|--frontend-only|--integration-only|--all]"
            exit 1
            ;;
    esac
done

# Ejecutar tests según las opciones
OVERALL_SUCCESS=true

if [ "$RUN_BACKEND" = true ]; then
    if run_backend_tests; then
        echo "✅ Tests del backend: PASARON"
    else
        echo "❌ Tests del backend: FALLARON"
        OVERALL_SUCCESS=false
    fi
fi

if [ "$RUN_FRONTEND" = true ]; then
    if run_frontend_tests; then
        echo "✅ Tests del frontend: PASARON"
    else
        echo "❌ Tests del frontend: FALLARON"
        OVERALL_SUCCESS=false
    fi
fi

if [ "$RUN_INTEGRATION" = true ]; then
    if run_integration_tests; then
        echo "✅ Tests de integración: PASARON"
    else
        echo "❌ Tests de integración: FALLARON"
        OVERALL_SUCCESS=false
    fi
fi

echo ""
echo "=================================================="
if [ "$OVERALL_SUCCESS" = true ]; then
    echo "🎉 ¡VALIDACIÓN COMPLETA EXITOSA!"
    echo "Todos los tests pasaron correctamente."
else
    echo "⚠️  Algunos tests fallaron. Revisa los errores arriba."
fi
echo "=================================================="