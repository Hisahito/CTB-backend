import { Server } from 'socket.io';
import { createPublicClient, webSocket, parseAbi, Log } from 'viem';
import { bscTestnet } from 'viem/chains';
import { client as redis } from '../redis/redisClient';

const abi = parseAbi([
  'event CharacterMoved(uint256 indexed tokenId, uint256 cellId, uint256 x, uint256 y)',
  'event CharacterRemoved(uint256 indexed tokenId)'
]);

const CONTRACTS_TO_WATCH: `0x${string}`[] = [
  '0xd38092C42F7BeEE20c6E7ccA25c058119e49B245'
];

const client = createPublicClient({
  chain: bscTestnet,
  transport: webSocket('wss://bnb-testnet.g.alchemy.com/v2/kaxtzlj3wgxoS8rE3rYXomaNfOXOnC4U'),
});

export function initPositionListener(io: Server) {
  for (const address of CONTRACTS_TO_WATCH) {
    client.watchEvent({
      address:address,
      events: abi,
      onLogs: async (logs) => {
        for (const log of logs) {
          const args = (log as any).args;

          if ((log as any).eventName === 'CharacterMoved') {
            const key = `character:position:${args.tokenId}`;
            const data = {
              cellId: args.cellId.toString(),
              x: args.x.toString(),
              y: args.y.toString(),
            };
            await redis.hSet(key, data);
            await redis.sAdd('characters:active', args.tokenId.toString());
            io.emit('characterMoved', { tokenId: args.tokenId.toString(), ...data });
          }

          if ((log as any).eventName === 'CharacterRemoved') {
            const key = `character:position:${args.tokenId}`;
            await redis.del(key);
            await redis.sRem('characters:active', args.tokenId.toString());
            io.emit('characterRemoved', { tokenId: args.tokenId.toString() });
          }
        }
      },
      onError: (err) => {
        console.error(`Error escuchando posiciones en contrato ${address}:`, err);
      }
    });
  }
}
