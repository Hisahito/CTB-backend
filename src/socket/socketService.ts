/**
 * Módulo para la configuración de Socket.IO.
 * Se encarga de gestionar las conexiones de los clientes y emitir eventos en tiempo real.
 */
import { Server, Socket } from 'socket.io';

export const initSocket = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Cliente desconectado: ${socket.id}`);
    });
  });
};
