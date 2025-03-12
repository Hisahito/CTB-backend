// src/server/index.ts
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors'; // Middleware de CORS
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initSocket } from '../socket/socketService';
import { initBlockchainService } from '../blockchain/blockchainService';
import { getCharacters, getBlockConquestStartedEvents } from '../redis/redisClient';
import { getBlocks } from '../blockchain/blockStateService'; // Importa la función getBlocks

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

/**
 * Ruta para obtener la posición actual de cada personaje.
 * Se filtran los eventos BlockConquestStarted y, para cada personaje,
 * se obtiene el evento con el bloque mayor (última posición conocida).
 */
app.get('/positions', async (req, res) => {
  try {
    const blockEvents = await getBlockConquestStartedEvents();
    // Objeto para agrupar por characterId
    const positions: { [characterId: string]: any } = {};
    blockEvents.forEach((event: any) => {
      const characterId = event.args.characterId;
      // Se asume que event.blockNumber es un string. Convertimos a BigInt para comparar.
      if (
        !positions[characterId] ||
        BigInt(event.blockNumber) > BigInt(positions[characterId].blockNumber)
      ) {
        positions[characterId] = event;
      }
    });
    res.json({ positions });
  } catch (error) {
    console.error('Error al obtener posiciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Ruta para obtener el estado actual de los bloques.
 * Se utiliza la función getBlocks, que lee el estado precomputado
 * almacenado en el hash global de Redis (por ejemplo, 'ctb_blocks').
 */
app.get('/blocks', async (req, res) => {
  try {
    const blocks = await getBlocks();
    res.json({ blocks });
  } catch (error) {
    console.error('Error al obtener bloques:', error);
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

