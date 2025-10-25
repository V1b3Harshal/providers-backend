import { Server } from 'socket.io';
import { WatchTogetherRoom } from '../types';
export declare class WatchTogetherService {
    private io;
    private rooms;
    constructor(io: Server);
    private setupSocketHandlers;
    getRoom(roomId: string): Promise<WatchTogetherRoom | null>;
    getRoomParticipants(roomId: string): Promise<string[]>;
    getRoomState(roomId: string): Promise<any>;
    getAllRooms(): Promise<WatchTogetherRoom[]>;
    cleanupEmptyRooms(): Promise<number>;
    broadcastToRoom(roomId: string, event: string, data: any): Promise<void>;
    getRoomStats(): Promise<any>;
}
export declare const watchTogetherService: (io: Server) => WatchTogetherService;
//# sourceMappingURL=watchTogetherService.d.ts.map