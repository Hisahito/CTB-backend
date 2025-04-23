// src/routes/nftRoutes.ts
import express from 'express';
import { client as redis } from '../redis/redisClient';

const router = express.Router();

router.get('/wallet/:address/nfts', async (req, res) => {
  const address = req.params.address.toLowerCase();
  const keys = await redis.sMembers(`nft:owned:${address}`);

  const result = keys.map((k) => {
    const [contract, tokenId] = k.split(':');
    return { contract, tokenId };
  });

  res.json({ address, nfts: result });
});

router.get('/nft/:contract/:tokenId/owner', async (req, res) => {
  const contract = req.params.contract.toLowerCase();
  const tokenId = req.params.tokenId;

  const owner = await redis.get(`nft:owner:${contract}:${tokenId}`);

  if (owner) {
    res.json({ contract, tokenId, owner });
  } else {
    res.status(404).json({ error: 'Owner not found for specified NFT' });
  }
});

export default router;
