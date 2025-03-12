import { Server } from 'socket.io';
import { client } from '../redis/redisClient';

export const updateBlockState = async (event: any, io?: Server): Promise<void> => {
    // Solo procesar eventos relacionados a bloques.
    const allowedEvents = ['BlockConquestStarted', 'BlockChallenged', 'BlockDefended', 'BlockVasallo'];
    if (!allowedEvents.includes(event.eventName)) {
      console.warn(`El evento ${event.eventName} no es relevante para actualizar el estado de bloques, se omite.`);
      return;
    }
  
    const blockId = event.args?.blockId;
    if (!blockId) {
      console.warn(`El evento ${event.eventName} no contiene blockId, se omite su procesamiento.`);
      return;
    }
  
    const blockKey = `block:${blockId}`;
    let blockState: any;
    const blockStateString = await client.get(blockKey);
    if (blockStateString) {
      blockState = JSON.parse(blockStateString);
    } else {
      blockState = {
        blockId,
        status: 'default',
        owner: null,
        conquestEnd: null,
        defended: null,
        futureOwner: null,
        lastOwner: null,
        ally: null,
        originalOwner: null
      };
    }
  
    // Actualización según tipo de evento.
    switch (event.eventName) {
      case 'BlockConquestStarted':
        const defendedVal = event.args.defended;
        if(defendedVal == 1){
            blockState.status = 'defendido';
        }
        else{
            blockState.status = 'dominio';
        }
        blockState.owner = event.args.characterId;
        blockState.conquestEnd = event.args.conquestEndBlock;
        blockState.defended = event.args.defended;
        break;
      case 'BlockChallenged':
        blockState.status = 'redominio';
        blockState.futureOwner = event.args.attackerId;
        blockState.lastOwner = event.args.previousOwner;
        blockState.conquestEnd = event.args.conquestEndBlock;
        break;
      case 'BlockDefended':
        if (blockState.owner === event.args.characterId) {
          blockState.status = 'defendido';
        }
        break;
      case 'BlockVasallo':
        blockState.status = 'vasallo';
        blockState.ally = event.args.vasalId;
        blockState.originalOwner = event.args.originalOwner;
        break;
      default:
        break;
    }
  
    // Guardar el estado individual y actualizar el hash global.
    await client.set(blockKey, JSON.stringify(blockState));
    await client.hSet('ctb_blocks', blockId, JSON.stringify(blockState));
  
    // Emitir el evento directamente si se proporcionó la instancia de Socket.IO.
    if (io) {
      io.emit('blockUpdated', blockState);
    }
  };
  

export const getBlocks = async (): Promise<any[]> => {
    try {
      const globalState = await client.hGetAll('ctb_blocks');
      // globalState es un objeto donde cada propiedad es un bloque.
      return Object.values(globalState).map(value => JSON.parse(value));
    } catch (error) {
      console.error('Error al obtener los bloques desde la clave global en Redis:', error);
      throw error;
    }
  };
  
  