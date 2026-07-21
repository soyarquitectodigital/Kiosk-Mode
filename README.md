# Modo Kiosko

Sistema de gestión remota de contenido multimedia para múltiples equipos. Permite controlar desde un panel central qué se muestra en cada pantalla (web, imágenes, videos, YouTube).

## Arquitectura

- **Servidor (Windows)**: Corre Node.js, sirve el panel admin y gestiona conexiones
- **Clientes (Debian)**: Navegador en modo kiosko que recibe comandos del servidor
- **Comunicación**: WebSockets (Socket.IO) en tiempo real

## Instalación

### Servidor (Render.com - Internet, siempre activo)

El servidor se despliega en Render para que esté disponible 24/7 sin que nadie tenga que levantarlo. Los clientes se conectan directamente a la URL pública.

1. Crear cuenta gratis en [render.com](https://render.com) (iniciar sesión con GitHub)
2. Subir este proyecto a un repositorio de GitHub
3. En Render, click en **"New +"** → **"Web Service"**
4. Conectar el repositorio de GitHub
5. Render detecta la configuración automáticamente gracias al archivo `render.yaml`
6. Click en **"Create Web Service"** y listo

Tu servidor estará disponible en una URL tipo `https://modo-kiosko.onrender.com`:
- **Panel Admin**: `https://modo-kiosko.onrender.com/admin/`
- **Cliente Kiosko**: `https://modo-kiosko.onrender.com/client/?name=nombre`

El servidor se mantiene activo automáticamente gracias a los heartbeats de los clientes conectados.

### Clientes (Debian)

1. Instalar Chromium y unclutter:

```bash
sudo apt update
sudo apt install chromium unclutter
```

2. Copiar el proyecto o solo el script `scripts/start-kiosko.sh`

3. Dar permisos al script:

```bash
chmod +x scripts/start-kiosko.sh
```

4. Iniciar kiosko apuntando al servidor:

```bash
./scripts/start-kiosko.sh https://TU_APP.onrender.com nombre-del-cliente
```

Ejemplo:
```bash
./scripts/start-kiosko.sh https://modo-kiosko.onrender.com kiosko-entrada
```

## Uso

### Panel de Administración

1. Accede a `https://TU_APP.onrender.com/admin/`
2. Verás los clientes conectados en tiempo real
3. Selecciona un cliente haciendo clic
4. Elige el tipo de contenido:
   - **Web**: Cualquier página web
   - **Imagen**: URL directa a imagen
   - **Video**: URL directa a archivo de video
   - **YouTube**: URL completa o ID del video
5. Ingresa la URL y presiona "Enviar a seleccionado" o "Enviar a TODOS"

### Acciones rápidas por cliente

- **Recargar**: Refresca el navegador del cliente
- **Apagar**: Pantalla negra (blackout)
- **Identificar**: Muestra el nombre del cliente en pantalla (útil para ubicar físicamente)
- **Pantalla Completa**: Fuerza fullscreen

### Auto-inicio en Debian

Para que el kiosko inicie automáticamente:

1. Editar `~/.config/lxsession/LXDE-pi/autostart` (o el gestor de sesiones que uses):

```
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0.1 -root
@/ruta/al/proyecto/scripts/start-kiosko.sh https://TU_APP.onrender.com nombre-cliente
```

## Estructura

```
modo-kiosko/
├── server.js              # Servidor principal
├── package.json           # Dependencias
├── render.yaml            # Configuración de Render
├── .gitignore
├── public/
│   ├── admin/
│   │   └── index.html     # Panel de control
│   └── client/
│       └── index.html     # Cliente kiosko
├── scripts/
│   └── start-kiosko.sh    # Script de inicio Debian
└── README.md
```

## Notas

- Cada cliente genera un ID único persistente en localStorage
- Puedes identificar cada máquina pasando `?name=xxx` en la URL
- YouTube usa embed con autoplay (silenciado por políticas del navegador)
- Las URLs locales de `public/uploads/` se pierden al redeployar (disco efímero en Render). Para contenido fijo, usa URLs externas.
