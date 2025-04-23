// src/NFT/index.ts
import { Server } from 'socket.io';
import { indexHistoricalTransfers } from './indexer';
import { subscribeToTransfers } from './subscribeToTransfers';

const NFT_CONTRACTS: `0x${string}`[] = [
  '0x75F550d3C06961411aDAAAbd4a352218B9f4eeD9',
  '0x8BA348B66Db64A58C8809eC613Fa9961e67f66d5',
];

export async function initNftListener(io: Server) {
  await indexHistoricalTransfers(NFT_CONTRACTS);
  subscribeToTransfers(NFT_CONTRACTS, io);
}