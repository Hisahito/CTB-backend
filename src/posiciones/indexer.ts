import { createPublicClient, http, parseAbi, webSocket } from 'viem';
import { bscTestnet } from 'viem/chains';
import { client as redis } from '../redis/redisClient';

const abi = parseAbi([
  'event CharacterMoved(uint256 indexed tokenId, uint256 cellId, uint256 x, uint256 y)',
  'event CharacterRemoved(uint256 indexed tokenId)'
]);

const CONTRACTS_TO_INDEX: `0x${string}`[] = [
  '0xd38092C42F7BeEE20c6E7ccA25c058119e49B245'
];

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: webSocket('wss://bnb-testnet.g.alchemy.com/v2/kaxtzlj3wgxoS8rE3rYXomaNfOXOnC4U'),
});

export async function indexCharacterPositions() {
  for (const contract of CONTRACTS_TO_INDEX) {
    const lastIndexed = await redis.get(`positions:lastBlock:${contract}`);
    const fromBlock = lastIndexed ? BigInt(lastIndexed) + 1n : 0n;

    const logs = await publicClient.getLogs({
      address: contract,
      events: abi,
      fromBlock:fromBlock,
      toBlock: 'latest',
    });

    for (const log of logs) {
      const args = (log as any).args;
      const blockNumber = log.blockNumber?.toString() ?? '0';

      if ((log as any).eventName === 'CharacterMoved') {
        await redis.hSet(`character:position:${args.tokenId}`, {
          cellId: args.cellId.toString(),
          x: args.x.toString(),
          y: args.y.toString(),
        });
        await redis.sAdd('characters:active', args.tokenId.toString());
      }

      if ((log as any).eventName === 'CharacterRemoved') {
        await redis.del(`character:position:${args.tokenId}`);
        await redis.sRem('characters:active', args.tokenId.toString());
      }

      await redis.set(`positions:lastBlock:${contract}`, blockNumber);
    }

    console.log(`Se indexaron ${logs.length} eventos para ${contract}`);
  }
}
