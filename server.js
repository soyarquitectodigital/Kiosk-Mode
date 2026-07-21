const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|mp4|webm|ogg|mov|avi|mkv/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (allowed.test(ext) || allowed.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no soportado. Usa imagen o video.'));
    }
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const clients = new Map();
const clientErrors = [];
const MAX_ERRORS_STORED = 50;

function addClientError(data) {
  clientErrors.unshift({
    ...data,
    receivedAt: new Date().toISOString()
  });
  if (clientErrors.length > MAX_ERRORS_STORED) {
    clientErrors.pop();
  }
}

function pruneInactiveClients() {
  const now = Date.now();
  const timeout = 90000; // 90 seconds without heartbeat = offline
  for (const [socketId, client] of clients.entries()) {
    if (client.lastHeartbeat && (now - new Date(client.lastHeartbeat).getTime() > timeout)) {
      console.log(`Cliente inactivo eliminado: ${client.name}`);
      clients.delete(socketId);
      io.emit('clients-updated', Array.from(clients.values()));
    }
  }
}

setInterval(pruneInactiveClients, 30000);

io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on('register', (data) => {
    const clientInfo = {
      id: socket.id,
      clientId: data.clientId || socket.id,
      name: data.name || `Cliente ${socket.id.substr(0, 6)}`,
      connectedAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      currentContent: null,
      status: 'online'
    };
    clients.set(socket.id, clientInfo);
    console.log(`Cliente registrado: ${clientInfo.name} (${clientInfo.clientId})`);
    io.emit('clients-updated', Array.from(clients.values()));
  });

  socket.on('heartbeat', (data) => {
    const client = clients.get(socket.id);
    if (client) {
      client.lastHeartbeat = data.timestamp || new Date().toISOString();
      client.status = 'online';
      io.emit('clients-updated', Array.from(clients.values()));
    }
  });

  socket.on('client-error', (data) => {
    console.error(`Error de cliente ${data.clientName}: ${data.error}`);
    addClientError(data);
    io.emit('client-error', data);
  });

  socket.on('content-changed', (data) => {
    const client = clients.get(socket.id);
    if (client) {
      client.currentContent = data;
      io.emit('clients-updated', Array.from(clients.values()));
    }
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
    clients.delete(socket.id);
    io.emit('clients-updated', Array.from(clients.values()));
  });
});

app.get('/api/clients', (req, res) => {
  res.json(Array.from(clients.values()));
});

app.get('/api/client-errors', (req, res) => {
  res.json(clientErrors);
});

app.get('/api/uploads', (req, res) => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Error leyendo archivos' });
    const items = files.map(f => {
      const ext = path.extname(f).toLowerCase();
      const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(ext);
      const isVideo = /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(ext);
      return {
        name: f,
        url: `/uploads/${f}`,
        type: isImage ? 'image' : isVideo ? 'video' : 'file',
        size: fs.statSync(path.join(UPLOAD_DIR, f)).size
      };
    });
    res.json(items);
  });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subio ningun archivo' });
  }
  const ext = path.extname(req.file.filename).toLowerCase();
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(ext);
  const isVideo = /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(ext);
  res.json({
    success: true,
    file: {
      name: req.file.filename,
      originalName: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      type: isImage ? 'image' : isVideo ? 'video' : 'file',
      size: req.file.size
    }
  });
});

app.delete('/api/uploads/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!filePath.startsWith(UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  fs.unlink(filePath, (err) => {
    if (err) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.json({ success: true });
  });
});

app.post('/api/clients/:clientId/show', express.json(), (req, res) => {
  const { clientId } = req.params;
  const payload = req.body;
  
  const targetClient = Array.from(clients.values()).find(c => c.clientId === clientId);
  
  if (!targetClient) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  io.to(targetClient.id).emit('show', payload);
  res.json({ success: true });
});

app.post('/api/clients/:clientId/command', express.json(), (req, res) => {
  const { clientId } = req.params;
  const { command, params } = req.body;
  
  const targetClient = Array.from(clients.values()).find(c => c.clientId === clientId);
  
  if (!targetClient) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  io.to(targetClient.id).emit('command', { command, params });
  res.json({ success: true });
});

app.post('/api/broadcast', express.json(), (req, res) => {
  const payload = req.body;
  io.emit('show', payload);
  res.json({ success: true, clientsAffected: clients.size });
});

server.listen(PORT, () => {
  console.log(`Servidor Kiosko corriendo en http://localhost:${PORT}`);
  console.log(`Panel Admin: http://localhost:${PORT}/admin/`);
  console.log(`Cliente Kiosko: http://localhost:${PORT}/client/`);
});
