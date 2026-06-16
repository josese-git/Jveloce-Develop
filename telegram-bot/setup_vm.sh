#!/bin/bash
# ============================================================
# setup_vm.sh - Instalación automática del Bot JVeloce en la VM
# Ejecutar una sola vez tras crear la VM.
# ============================================================

set -e  # Detener si hay algún error

echo "============================================"
echo "🚗 JVeloce Bot - Instalación en la nube"
echo "============================================"

# 1. Actualizar sistema e instalar dependencias
echo ""
echo "📦 Instalando Python 3 y dependencias del sistema..."
sudo apt-get update -qq
sudo apt-get install -y -qq python3 python3-pip python3-venv > /dev/null 2>&1

# 2. Crear directorio del bot (si no existe)
BOT_DIR="$HOME/jveloce-bot"
echo "📂 Preparando directorio: $BOT_DIR"
mkdir -p "$BOT_DIR/temp_images"

# 3. Crear entorno virtual de Python
echo "🐍 Creando entorno virtual de Python..."
cd "$BOT_DIR"
python3 -m venv venv
source venv/bin/activate

# 4. Instalar dependencias de Python
echo "📥 Instalando dependencias de Python..."
pip install --upgrade pip -q
pip install -r requirements.txt -q

echo ""
echo "============================================"
echo "✅ Instalación completada con éxito!"
echo "============================================"
echo ""
echo "Siguiente paso: Activar el servicio systemd"
echo "  sudo cp jveloce-bot.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable jveloce-bot"
echo "  sudo systemctl start jveloce-bot"
echo ""
echo "Para ver los logs:"
echo "  sudo journalctl -u jveloce-bot -f"
echo ""
