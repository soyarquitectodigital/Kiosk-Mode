#!/bin/bash

# Script de inicio para modo kiosko en Debian
# Uso: ./start-kiosko.sh [URL_DEL_SERVIDOR] [NOMBRE_CLIENTE]

SERVER_URL="${1:-http://localhost:3000}"
CLIENT_NAME="${2:-kiosko}"
CLIENT_URL="${SERVER_URL}/client/?name=${CLIENT_NAME}"

# Matar instancias previas de chromium
pkill -f "chromium.*kiosko" 2>/dev/null
pkill -f "chrome.*kiosko" 2>/dev/null

# Esperar un momento
sleep 2

# Lanzar Chromium en modo kiosko
chromium-browser \
  --kiosk \
  --app="${CLIENT_URL}" \
  --no-first-run \
  --no-sandbox \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --disable-translate \
  --disable-features=TranslateUI \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=1 \
  --simulate-critical-update \
  --disable-component-extensions-with-background-pages \
  --disable-background-networking \
  --disable-default-apps \
  --disable-sync \
  --disable-web-security \
  --password-store=basic \
  --use-mock-keychain \
  --incognito \
  --start-fullscreen \
  --hide-scrollbars \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  2>/dev/null &

# Ocultar cursor (requiere unclutter)
if command -v unclutter &> /dev/null; then
    unclutter -idle 0.1 -root &
fi

# Deshabilitar apagado de pantalla
xset s off
xset -dpms
xset s noblank

echo "Kiosko iniciado: ${CLIENT_URL}"
echo "Para detener: pkill -f chromium"
