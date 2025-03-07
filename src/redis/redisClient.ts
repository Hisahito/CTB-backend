// src/redis/redisClient.ts
import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const client = createClient({ url: redisUrl });

client.on('error', (err) => console.error('Error en Redis:', err));

client.connect()
  .then(() => console.log('Conectado a Redis'))
  .catch((err) => console.error('No se pudo conectar a Redis:', err));

const EVENTS_KEY = 'ctb_events';

export const setEvents = async (events: any[]): Promise<void> => {
  try {
    await client.set(EVENTS_KEY, JSON.stringify(events));
  } catch (error) {
    console.error('Error al guardar eventos en Redis:', error);
    throw error;
  }
};

export const getEvents = async (): Promise<any[]> => {
  try {
    const data = await client.get(EVENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error al obtener eventos de Redis:', error);
    throw error;
  }
};

export const addEvent = async (event: any): Promise<void> => {
  try {
    const events = await getEvents();
    events.push(event);
    await setEvents(events);
  } catch (error) {
    console.error('Error al agregar un evento a Redis:', error);
    throw error;
  }
};



export const getCharacters = async (): Promise<any[]> => {
  try {
    const events = await getEvents();
    // Filtra solo los eventos cuyo eventName es "CharacterCreated"
    const characterEvents = events.filter((event: any) => event.eventName === 'CharacterCreated');
    return characterEvents;
  } catch (error) {
    console.error('Error al obtener eventos de personajes:', error);
    throw error;
  }
};

/**
 * Retorna solo los eventos de tipo "BlockConquestStarted"
 */
export const getBlockConquestStartedEvents = async (): Promise<any[]> => {
  try {
    const events = await getEvents();
    const blockConquestEvents = events.filter((event: any) => event.eventName === 'BlockConquestStarted');
    return blockConquestEvents;
  } catch (error) {
    console.error('Error al obtener eventos BlockConquestStarted:', error);
    throw error;
  }
};
