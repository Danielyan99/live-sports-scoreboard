import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/** Applies runtime CORS settings to the Socket.io server (decorator options are static). */
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigins },
      // Detect dead connections quickly so the client's "Reconnecting" state is honest.
      pingInterval: 10_000,
      pingTimeout: 8_000,
    });
  }
}
