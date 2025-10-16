#!/bin/bash

# Script para inicializar la base de datos de Bot Facturas

echo "============================================"
echo "Inicializando Base de Datos - Bot Facturas"
echo "============================================"
echo ""

# Leer variables del .env
if [ -f .env ]; then
  export $(cat .env | grep DB_ | xargs)
else
  echo "❌ Error: Archivo .env no encontrado"
  exit 1
fi

# Valores por defecto si no están en .env
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_NAME=${DB_NAME:-bot_facturas}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo "📋 Configuración:"
echo "  - Usuario: $DB_USER"
echo "  - Base de datos: $DB_NAME"
echo "  - Host: $DB_HOST:$DB_PORT"
echo ""

# Verificar si PostgreSQL está corriendo
echo "🔍 Verificando PostgreSQL..."
if ! nc -z $DB_HOST $DB_PORT 2>/dev/null; then
  echo "❌ Error: PostgreSQL no está corriendo en $DB_HOST:$DB_PORT"
  echo "   Ejecuta: sudo systemctl start postgresql"
  exit 1
fi
echo "✅ PostgreSQL está corriendo"
echo ""

# Crear la base de datos si no existe
echo "🗄️  Creando base de datos '$DB_NAME' (si no existe)..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"

if [ $? -eq 0 ]; then
  echo "✅ Base de datos lista"
else
  echo "⚠️  La base de datos ya existe o hubo un error"
fi
echo ""

# Ejecutar migraciones
echo "📦 Ejecutando migraciones..."
echo ""

for migration in migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "  → Ejecutando: $(basename $migration)"
    sudo -u postgres psql -d $DB_NAME -f "$migration"
    if [ $? -eq 0 ]; then
      echo "    ✅ Completada"
    else
      echo "    ⚠️  Error o ya ejecutada"
    fi
  fi
done

echo ""
echo "============================================"
echo "✅ Inicialización completada"
echo "============================================"
echo ""
echo "Para verificar las tablas creadas:"
echo "  sudo -u postgres psql -d $DB_NAME -c '\dt'"
echo ""
