// src/NFT/indexer.ts
import { createPublicClient, http, parseAbi } from 'viem';
import { bscTestnet } from 'viem/chains';
import { saveTransfer } from './transferStorage';
import { client as redis } from '../redis/redisClient';

const abi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);

const CONTRACT_DEPLOY_BLOCKS: Record<`0x${string}`, bigint> = {
    '0x75F550d3C06961411aDAAAbd4a352218B9f4eeD9': 50428009n,
    '0x8BA348B66Db64A58C8809eC613Fa9961e67f66d5': 50429163n,
  };
  

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http('https://bnb-testnet.g.alchemy.com/v2/kaxtzlj3wgxoS8rE3rYXomaNfOXOnC4U'),
});

export async function indexHistoricalTransfers(contracts: `0x${string}`[]) {
    const latest = await publicClient.getBlockNumber();
  
    for (const contract of contracts) {
      const last = await redis.get(`nft:lastBlock:${contract}`);
      const fromBlock = last
        ? BigInt(last) + 1n
        : CONTRACT_DEPLOY_BLOCKS[contract] ?? (latest > 1000000n ? latest - 1000000n : 0n);
  
      const logs = await publicClient.getLogs({
        address: contract,
        events: abi,
        fromBlock:fromBlock,
        toBlock: 'latest',
      });
  
      for (const log of logs) {
        const args = (log as any).args;
        await saveTransfer({
          contract,
          tokenId: args.tokenId.toString(),
          from: args.from,
          to: args.to,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber.toString(),
        });
      }
    }
  }