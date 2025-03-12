// src/blockchain/blockchainService.ts
import { Server } from 'socket.io';
import { createPublicClient, http, type Log ,webSocket} from 'viem';
import { bscTestnet } from 'viem/chains';
import { parseAbi } from 'viem';
import { setEvents, addEvent } from '../redis/redisClient';
import { updateBlockState } from './blockStateService';


const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS ||
  '0x322AE0BEE905572DE3d1F67E2A560c19fbc76994') as `0x${string}`;

const eventAbis = parseAbi([
  'event BlockConquestStarted(uint256 indexed blockId, uint256 indexed characterId, uint256 conquestEndBlock, uint256 blocksRemaining, uint256 defended)',
  'event CharacterCreated(address indexed owner,uint256 characterId, uint256 affinity, uint256 velocity)',
  'event BlockChallenged(uint256 indexed blockId, uint256 indexed attackerId, uint256 previousOwner, uint256 conquestEndBlock, uint256 blocksRemaining)',
  'event BlockDefended(uint256 indexed blockId, uint256 indexed characterId)',
  'event BlockVasallo(uint256 indexed blockId, uint256 indexed vasalId, uint256 originalOwner)'
]);

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(process.env.ALCHEMY_API_URL),
});

const publicClientwss = createPublicClient({
  chain: bscTestnet,
  transport: webSocket('wss://bnb-testnet.g.alchemy.com/v2/QPfxbvXMQB4R4OVfa8u1qVp49_cNVHhh'),
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

// Modificamos processHistoricalEvents para aceptar un array de eventos
async function processHistoricalEvents(events: any[]): Promise<void> {
  for (const event of events) {
    try {
      await updateBlockState(event);
    } catch (error) {
      console.error('Error actualizando estado para evento histórico:', error);
    }
  }
}


/**
 * Inicia el contador global de bloques.
 * Utiliza watchBlockNumber para emitir el último bloque a través de Socket.IO.
 */
export const initBlockCounter = (io: Server): void => {
  const unwatch = publicClientwss.watchBlockNumber({
    emitOnBegin: true,
    // Si usas transporte HTTP, se activa el polling
    onBlockNumber: (blockNumber: bigint) => {
      console.log('Nuevo bloque detectado:', blockNumber);
      // Emite el bloque a todos los clientes conectados.
      io.emit('blockNumber', blockNumber.toString());
    },
  });
  // Puedes guardar la función unwatch si en algún momento deseas detener la suscripción.
};

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
    // Actualizamos el estado de los bloques con los eventos históricos
    await processHistoricalEvents(historicalEvents);

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
          await updateBlockState(serialized,io); // Actualizar el estado del bloque
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

  // Iniciar el contador global de bloques
  initBlockCounter(io);
};


