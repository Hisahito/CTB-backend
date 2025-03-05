/**
 * Módulo para la conexión y operaciones con Redis.
 * Se encarga de almacenar y recuperar el listado de personajes.
 */
import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const client = createClient({ url: redisUrl });

client.on('error', (err) => console.error('Error en Redis:', err));

client.connect().then(() => {
  console.log('Conectado a Redis');
}).catch((err) => {
  console.error('No se pudo conectar a Redis:', err);
});

const CHARACTERS_KEY = 'ctb_characters';

export const setCharacters = async (characters: any[]): Promise<void> => {
  try {
    await client.set(CHARACTERS_KEY, JSON.stringify(characters));
  } catch (error) {
    console.error('Error al guardar personajes en Redis:', error);
    throw error;
  }
};

export const getCharacters = async (): Promise<any[]> => {
  try {
    const data = await client.get(CHARACTERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error al obtener personajes de Redis:', error);
    throw error;
  }
};

export const addCharacter = async (character: any): Promise<void> => {
  try {
    const characters = await getCharacters();
    characters.push(character);
    await setCharacters(characters);
  } catch (error) {
    console.error('Error al agregar un personaje a Redis:', error);
    throw error;
  }
};
