// src/blockchain/blockchainService.ts
import { Server } from 'socket.io';
import { createPublicClient, http, type Log } from 'viem';
import { bscTestnet } from 'viem/chains';
import { parseAbi } from 'viem';
import { setEvents, addEvent } from '../redis/redisClient';

const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS ||
  '0x322AE0BEE905572DE3d1F67E2A560c19fbc76994') as `0x${string}`;

const eventAbis = parseAbi([
  'event BlockConquestStarted(uint256 indexed blockId, uint256 indexed characterId, uint256 conquestEndBlock, uint256 blocksRemaining)',
  'event CharacterCreated(uint256 characterId, uint256 affinity, uint256 velocity)',
  'event BlockChallenged(uint256 indexed blockId, uint256 indexed attackerId, uint256 previousOwner, uint256 conquestEndBlock, uint256 blocksRemaining)',
  'event BlockDefended(uint256 indexed blockId, uint256 indexed characterId)',
  'event BlockVasallo(uint256 indexed blockId, uint256 indexed vasalId, uint256 originalOwner)'
]);

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(process.env.ALCHEMY_API_URL),
});

/**
 * Convierte un log en un objeto serializado.
 * Se utiliza un type assertion para acceder a las propiedades `args` y `eventName`.
 */
function serializeLog(log: Log): any {
  const logAny = log as any; // Permite acceder a propiedades extendidas
  const serializedArgs: Record<string, any> = {};
  if (logAny.args) {
    for (const key in logAny.args) {
      const value = logAny.args[key];
      serializedArgs[key] = typeof value === 'bigint' ? value.toString() : value;
    }
  }
  return {
    eventName: logAny.eventName,
    blockNumber: logAny.blockNumber ? logAny.blockNumber.toString() : null,
    transactionHash: logAny.transactionHash,
    args: serializedArgs,
  };
}

/**
 * Consulta histórica para obtener todos los eventos del contrato.
 */
async function fetchHistoricalEvents(): Promise<any[]> {
  try {
    const logs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      events: eventAbis,
      fromBlock: 0n,
      toBlock: 'latest',
    });
    console.log(`Se han obtenido ${logs.length} eventos históricos`);
    return logs.map(serializeLog);
  } catch (error) {
    console.error('Error al obtener eventos históricos:', error);
    return [];
  }
}

/**
 * Inicializa el servicio de blockchain:
 * - Consulta los eventos históricos, los almacena en Redis y los emite vía Socket.IO.
 * - Se suscribe a nuevos eventos, los agrega a Redis y los emite en tiempo real.
 */
export const initBlockchainService = async (io: Server): Promise<void> => {
  // Obtener eventos históricos
  const historicalEvents = await fetchHistoricalEvents();
  try {
    await setEvents(historicalEvents);
    io.emit('events', historicalEvents);
  } catch (error) {
    console.error('Error al almacenar eventos históricos en Redis:', error);
  }

  // Suscribirse a nuevos eventos
  publicClient.watchEvent({
    address: CONTRACT_ADDRESS,
    events: eventAbis,
    onLogs: (logs) => {
      logs.forEach(async (log) => {
        const serialized = serializeLog(log);
        console.log('Nuevo evento detectado:', serialized);
        try {
          await addEvent(serialized);
          io.emit('newEvent', serialized);
        } catch (error) {
          console.error('Error al agregar nuevo evento en Redis:', error);
        }
      });
    },
    onError: (error) => {
      console.error('Error al escuchar eventos de la blockchain:', error);
    }
  });
};


