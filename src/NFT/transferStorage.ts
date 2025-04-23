// src/NFT/transferStorage.ts
import { client as redis } from '../redis/redisClient';

export async function saveTransfer(data: {
  contract: string;
  tokenId: string;
  from: string;
  to: string;
  blockNumber: string;
  transactionHash: string;
}) {
  const key = `nft:owner:${data.contract.toLowerCase()}:${data.tokenId}`;
  await redis.set(key, data.to);
  await redis.sAdd(`nft:owned:${data.to.toLowerCase()}`, `${data.contract.toLowerCase()}:${data.tokenId}`);

  if (data.from !== '0x0000000000000000000000000000000000000000') {
    await redis.sRem(`nft:owned:${data.from.toLowerCase()}`, `${data.contract.toLowerCase()}:${data.tokenId}`);
  }

  await redis.set(`nft:lastBlock:${data.contract}`, data.blockNumber);

}

