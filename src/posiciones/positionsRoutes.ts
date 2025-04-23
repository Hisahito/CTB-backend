import express from 'express';
import { client as redis } from '../redis/redisClient';

const router = express.Router();

router.get('/positions', async (_req, res) => {
  try {
    const tokenIds = await redis.sMembers('characters:active');

    const pipeline = tokenIds.map((id) =>
      redis.hGetAll(`character:position:${id}`).then((position) => ({
        tokenId: id,
        ...position,
      }))
    );

    const positions = await Promise.all(pipeline);
    res.json({ positions });
  } catch (error) {
    console.error('Error al obtener posiciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
