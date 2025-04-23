// src/NFT/subscribeToTransfers.ts
import { createPublicClient, type Log, webSocket, parseAbi,parseAbiItem,http} from 'viem';
import { bscTestnet } from 'viem/chains';
import { saveTransfer } from './transferStorage';

const abi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http('https://bnb-testnet.g.alchemy.com/v2/kaxtzlj3wgxoS8rE3rYXomaNfOXOnC4U'),
});


export function subscribeToTransfers(addresses: `0x${string}`[], io: any) {
  for (const address of addresses) {
    publicClient.watchEvent({
      address: address,
      events: abi,
      onLogs: async (logs) => {
        for (const log of logs) {
          
          const args = (log as any).args;
          console.log(`📦 Transferencia detectada para ${address}: ${args.tokenId} de ${args.from} a ${args.to}`);
          await saveTransfer({
            contract: address,
            tokenId: args.tokenId.toString(),
            from: args.from,
            to: args.to,
            blockNumber: log.blockNumber.toString(),
            transactionHash: log.transactionHash.toString(),
          });
          io.emit('nftTransfer', {
            contract: address,
            tokenId: args.tokenId.toString(),
            from: args.from,
            to: args.to,
          });
        }
      },
      onError: (err) => {
        console.error(`Error escuchando contrato ${address}:`, err);
      },
    });
  }
}
