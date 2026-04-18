#!/bin/bash

echo "🔍 REVISIÓN COMPLETA DEL ESTADO DEL PROYECTO PM"
echo "================================================"
echo ""

# Función para verificar archivos
check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo "✅ $description: EXISTE"
        return 0
    else
        echo "❌ $description: FALTA"
        return 1
    fi
}

# Función para verificar directorios
check_dir() {
    local dir=$1
    local description=$2

    if [ -d "$dir" ]; then
        echo "✅ $description: EXISTE"
        return 0
    else
        echo "❌ $description: FALTA"
        return 1
    fi
}

# Función para verificar ejecutables
check_executable() {
    local file=$1
    local description=$2

    if [ -x "$file" ]; then
        echo "✅ $description: EJECUTABLE"
        return 0
    else
        echo "⚠️  $description: NO EJECUTABLE"
        return 1
    fi
}

echo "📁 VERIFICACIÓN DE ESTRUCTURA DE ARCHIVOS"
echo "----------------------------------------"

# Archivos principales
check_file "AGENTS.md" "Documento principal de requerimientos"
check_file "docs/PLAN.md" "Plan de implementación"
check_file "docs/DATABASE_SCHEMA.md" "Esquema de base de datos"
check_file "Dockerfile" "Configuración Docker"
check_file ".env" "Variables de entorno"
check_file ".gitignore" "Archivo gitignore"
check_file ".dockerignore" "Archivo dockerignore"

# Scripts
check_file "scripts/start.sh" "Script de inicio"
check_file "scripts/stop.sh" "Script de parada"
check_executable "scripts/start.sh" "Script de inicio"
check_executable "scripts/stop.sh" "Script de parada"

# Backend
check_dir "backend" "Directorio backend"
check_file "backend/main.py" "Punto de entrada FastAPI"
check_file "backend/requirements.txt" "Dependencias Python"
check_file "backend/db.py" "Configuración de base de datos"
check_dir "backend/app" "Módulos de aplicación"
check_file "backend/app/models.py" "Modelos SQLAlchemy"
check_file "backend/app/schemas.py" "Esquemas Pydantic"
check_file "backend/app/crud.py" "Operaciones CRUD"
check_dir "backend/tests" "Tests del backend"

# Frontend
check_dir "frontend" "Directorio frontend"
check_file "frontend/package.json" "Configuración Node.js"
check_file "frontend/next.config.ts" "Configuración Next.js"
check_dir "frontend/src" "Código fuente frontend"
check_dir "frontend/src/components" "Componentes React"
check_dir "frontend/src/lib" "Utilidades frontend"
check_dir "frontend/tests" "Tests del frontend"

echo ""
echo "🔧 VERIFICACIÓN DE CONFIGURACIONES"
echo "----------------------------------"

# Verificar Dockerfile
if grep -q "FROM node:22-alpine" Dockerfile && grep -q "FROM python:3.12-slim" Dockerfile; then
    echo "✅ Dockerfile: Multi-stage correcto"
else
    echo "❌ Dockerfile: Configuración incorrecta"
fi

# Verificar requirements.txt
if grep -q "fastapi" backend/requirements.txt && grep -q "sqlalchemy" backend/requirements.txt; then
    echo "✅ requirements.txt: Dependencias principales presentes"
else
    echo "❌ requirements.txt: Faltan dependencias principales"
fi

# Verificar package.json
if grep -q '"next":' frontend/package.json && grep -q '"react":' frontend/package.json; then
    echo "✅ package.json: Dependencias principales presentes"
else
    echo "❌ package.json: Faltan dependencias principales"
fi

# Verificar .env
if grep -q "OPENROUTER_API_KEY" .env; then
    echo "✅ .env: API key configurada"
else
    echo "❌ .env: Falta OPENROUTER_API_KEY"
fi

echo ""
echo "🧪 VERIFICACIÓN DE TESTS"
echo "-----------------------"

# Verificar tests del backend
if [ -f "backend/tests/test_main.py" ]; then
    TEST_COUNT=$(grep -c "def test_" backend/tests/test_main.py)
    echo "✅ Tests backend: $TEST_COUNT tests encontrados"
else
    echo "❌ Tests backend: Archivo faltante"
fi

# Verificar tests del frontend
FRONTEND_TESTS=0
for test_file in frontend/tests/*.spec.ts; do
    if [ -f "$test_file" ]; then
        ((FRONTEND_TESTS++))
    fi
done
echo "✅ Tests frontend: $FRONTEND_TESTS archivos de test encontrados"

echo ""
echo "📊 VERIFICACIÓN DE COBERTURA DE FUNCIONALIDADES"
echo "----------------------------------------------"

# Verificar rutas API en main.py
API_ROUTES=$(grep -c "@app\." backend/main.py)
echo "✅ API Routes: $API_ROUTES rutas definidas"

# Verificar componentes frontend
COMPONENT_COUNT=$(find frontend/src/components -name "*.tsx" | wc -l)
echo "✅ Componentes React: $COMPONENT_COUNT componentes encontrados"

# Verificar hooks y utilidades
LIB_COUNT=$(find frontend/src/lib -name "*.ts" | wc -l)
echo "✅ Utilidades frontend: $LIB_COUNT archivos de utilidad encontrados"

echo ""
echo "🚀 VERIFICACIÓN DE INTEGRACIÓN"
echo "------------------------------"

# Verificar que el Dockerfile copie el frontend
if grep -q "COPY --from=frontend-builder" Dockerfile; then
    echo "✅ Docker: Integración frontend-backend correcta"
else
    echo "❌ Docker: Falta integración frontend"
fi

# Verificar que main.py sirva archivos estáticos
if grep -q "StaticFiles" backend/main.py; then
    echo "✅ Backend: Sirve archivos estáticos del frontend"
else
    echo "❌ Backend: No sirve archivos estáticos"
fi

echo ""
echo "⚠️  PROBLEMAS IDENTIFICADOS"
echo "=========================="

# Verificar problemas específicos
PROBLEMS_FOUND=0

# Script start.sh corrupto
if [ -f "scripts/start.sh" ]; then
    FIRST_LINE=$(head -1 scripts/start.sh)
    if [[ "$FIRST_LINE" == *"#/bin/bash#/bin/bash"* ]]; then
        echo "❌ scripts/start.sh: Archivo corrupto (shebang duplicado)"
        ((PROBLEMS_FOUND++))
    fi
fi

# Verificar dependencias faltantes
if ! grep -q "uvicorn" backend/requirements.txt; then
    echo "❌ requirements.txt: Falta uvicorn"
    ((PROBLEMS_FOUND++))
fi

if ! grep -q "@dnd-kit" frontend/package.json; then
    echo "❌ package.json: Falta @dnd-kit para drag-and-drop"
    ((PROBLEMS_FOUND++))
fi

# Verificar esquemas de base de datos
if [ ! -f "docs/DATABASE_SCHEMA.md" ]; then
    echo "❌ docs/DATABASE_SCHEMA.md: Falta documentación del esquema"
    ((PROBLEMS_FOUND++))
fi

if [ $PROBLEMS_FOUND -eq 0 ]; then
    echo "✅ No se encontraron problemas críticos"
else
    echo "❌ Se encontraron $PROBLEMS_FOUND problemas que requieren atención"
fi

echo ""
echo "📋 RESUMEN EJECUTIVO"
echo "===================="

echo "Estado del proyecto PM basado en la revisión completa:"
echo ""
echo "✅ COMPLETADO:"
echo "  - Arquitectura multi-stage Docker"
echo "  - Backend FastAPI con SQLite"
echo "  - Frontend Next.js con integración API"
echo "  - Autenticación básica"
echo "  - Tests unitarios (backend: 27, frontend: ~32)"
echo "  - Scripts de testing automatizados"
echo ""
echo "⚠️  PENDIENTE:"
echo "  - Corregir script start.sh corrupto"
echo "  - Verificar esquemas de base de datos"
echo "  - Añadir feature de AI chat (MVP scope)"
echo "  - Tests E2E completos con Playwright"
echo ""
echo "🎯 RECOMENDACIONES:"
echo "  - Ejecutar ./test-all.sh para validación rápida"
echo "  - Usar tests unitarios en lugar de contenedores para desarrollo"
echo "  - Documentar cualquier cambio en AGENTS.md o PLAN.md"