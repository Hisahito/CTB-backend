// src/blockchain/blockchainService.ts
import { Server } from 'socket.io';
import { createPublicClient, http, type Log } from 'viem';
import { bscTestnet } from 'viem/chains';
import { parseAbiItem } from 'viem';
import { setCharacters, addCharacter } from '../redis/redisClient';

// Aseguramos que CONTRACT_ADDRESS sea del tipo requerido (0x${string})
const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS || '0x322AE0BEE905572DE3d1F67E2A560c19fbc76994') as `0x${string}`;

// Define la estructura del evento "CharacterCreated"
interface Character {
  characterId: string;
  affinity: string;
  velocity: string;
}

// Definición extendida de Log para incluir los argumentos del evento
interface LogWithArgs extends Log {
  args: {
    characterId: bigint;
    affinity: bigint;
    velocity: bigint;
  }
}

// Evento: CharacterCreated(uint256 characterId, uint256 affinity, uint256 velocity)
const characterCreatedEvent = parseAbiItem('event CharacterCreated(uint256 characterId, uint256 affinity, uint256 velocity)');

// Crea un cliente público usando la URL de Alchemy definida en el .env
const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(process.env.ALCHEMY_API_URL),
});

/**
 * Realiza una consulta histórica a la blockchain para obtener el listado de personajes creados.
 * @returns Array de personajes
 */
async function fetchHistoricalCharacters(): Promise<Character[]> {
  try {
    const logs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: characterCreatedEvent,
      fromBlock: 0n,
      toBlock: 'latest',
    });
    // Convertimos los logs al tipo que incluye args
    const logsWithArgs = logs as LogWithArgs[];
    const characters: Character[] = logsWithArgs.map((log) => ({
      characterId: log.args.characterId.toString(),
      affinity: log.args.affinity.toString(),
      velocity: log.args.velocity.toString(),
    }));
    console.log(`Se han obtenido ${characters.length} personajes históricos`);
    return characters;
  } catch (error) {
    console.error('Error al obtener personajes históricos:', error);
    return [];
  }
}

/**
 * Inicializa el servicio de blockchain: obtiene datos históricos y se suscribe a nuevos eventos.
 * @param io Instancia de Socket.IO para emitir eventos en tiempo real
 */
export const initBlockchainService = async (io: Server): Promise<void> => {
  const historicalCharacters = await fetchHistoricalCharacters();
  await setCharacters(historicalCharacters);
  io.emit('characters', historicalCharacters);

  publicClient.watchEvent({
    address: CONTRACT_ADDRESS,
    event: characterCreatedEvent,
    onLogs: (logs) => {
      const logsWithArgs = logs as LogWithArgs[];
      logsWithArgs.forEach(async (log) => {
        const newCharacter: Character = {
          characterId: log.args.characterId.toString(),
          affinity: log.args.affinity.toString(),
          velocity: log.args.velocity.toString(),
        };
        console.log('Nuevo personaje detectado:', newCharacter);
        await addCharacter(newCharacter);
        io.emit('newCharacter', newCharacter);
      });
    },
    onError: (error) => {
      console.error('Error al escuchar eventos de la blockchain:', error);
    }
    // Se omite la propiedad "poll" para evitar el error de tipo.
  });
};
