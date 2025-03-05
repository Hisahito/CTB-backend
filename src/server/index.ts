// src/server/index.ts
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors'; // Importa el middleware de CORS
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initSocket } from '../socket/socketService';
import { initBlockchainService } from '../blockchain/blockchainService';
import { getCharacters } from '../redis/redisClient';

const app = express();

// Habilita CORS para todas las rutas
app.use(cors());

// Middleware para parsear JSON
app.use(express.json());

// Ruta para obtener el listado de personajes desde Redis
app.get('/characters', async (req, res) => {
  try {
    const characters = await getCharacters();
    res.json({ characters });
  } catch (error) {
    console.error('Error al obtener personajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear servidor HTTP y asociarlo a Socket.IO
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*', // Configura según sea necesario
    methods: ['GET', 'POST']
  }
});

// Inicializa Socket.IO
initSocket(io);

// Inicia el servicio de blockchain
initBlockchainService(io).catch((err) => {
  console.error('Error al inicializar el servicio de blockchain:', err);
});

// Inicia el servidor en el puerto definido en .env o 3000 por defecto
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
