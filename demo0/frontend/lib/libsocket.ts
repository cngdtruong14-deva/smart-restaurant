import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private static instance: SocketClient;

  private constructor() {}

  static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }
    return SocketClient.instance;
  }

  connect() {
    if (this.socket?.connected) return this.socket;

    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
    
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinTable(tableId: number) {
    this.socket?.emit('join_table', tableId);
  }

  joinKitchen() {
    this.socket?.emit('join_kitchen');
  }

  createOrder(orderData: any) {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('order:create', orderData);
      
      this.socket.once('order:confirmed', (data) => {
        resolve(data);
      });

      this.socket.once('order:error', (error) => {
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Order timeout'));
      }, 10000);
    });
  }

  onOrderStatusUpdate(callback: (data: any) => void) {
    this.socket?.on('order:status_updated', callback);
  }

  onNewOrder(callback: (data: any) => void) {
    this.socket?.on('kitchen:new_order', callback);
  }

  off(event: string) {
    this.socket?.off(event);
  }

  getSocket() {
    return this.socket;
  }
}

export const socketClient = SocketClient.getInstance();
export default socketClient;