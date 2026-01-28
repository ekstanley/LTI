/**
 * Room-based subscription manager for WebSocket pub/sub
 *
 * Manages bidirectional mapping between clients and rooms for efficient
 * subscription management and cleanup on disconnect.
 */

import type { WebSocket } from 'ws';
import { logger } from '../lib/logger.js';

export class RoomManager {
  /** Room name → subscribed clients */
  private rooms = new Map<string, Set<WebSocket>>();

  /** Client → subscribed rooms (for disconnect cleanup) */
  private clientRooms = new Map<WebSocket, Set<string>>();

  /**
   * Subscribe a client to a room
   * @returns true if subscription was new, false if already subscribed
   */
  subscribe(client: WebSocket, room: string): boolean {
    // Validate room format
    if (!this.isValidRoom(room)) {
      logger.warn({ room }, 'Invalid room format');
      return false;
    }

    // Get or create room set
    let roomClients = this.rooms.get(room);
    if (!roomClients) {
      roomClients = new Set();
      this.rooms.set(room, roomClients);
    }

    // Check if already subscribed
    if (roomClients.has(client)) {
      return false;
    }

    // Add client to room
    roomClients.add(client);

    // Track room for client (for cleanup)
    let clientRoomSet = this.clientRooms.get(client);
    if (!clientRoomSet) {
      clientRoomSet = new Set();
      this.clientRooms.set(client, clientRoomSet);
    }
    clientRoomSet.add(room);

    logger.debug({ room, roomSize: roomClients.size }, 'Client subscribed to room');
    return true;
  }

  /**
   * Unsubscribe a client from a room
   * @returns true if client was subscribed, false otherwise
   */
  unsubscribe(client: WebSocket, room: string): boolean {
    const roomClients = this.rooms.get(room);
    if (!roomClients || !roomClients.has(client)) {
      return false;
    }

    // Remove client from room
    roomClients.delete(client);

    // Clean up empty room
    if (roomClients.size === 0) {
      this.rooms.delete(room);
    }

    // Remove room from client tracking
    const clientRoomSet = this.clientRooms.get(client);
    if (clientRoomSet) {
      clientRoomSet.delete(room);
      if (clientRoomSet.size === 0) {
        this.clientRooms.delete(client);
      }
    }

    logger.debug({ room, roomSize: roomClients.size }, 'Client unsubscribed from room');
    return true;
  }

  /**
   * Remove a client from all rooms (called on disconnect)
   */
  removeClient(client: WebSocket): string[] {
    const clientRoomSet = this.clientRooms.get(client);
    if (!clientRoomSet) {
      return [];
    }

    const removedRooms: string[] = [];

    for (const room of clientRoomSet) {
      const roomClients = this.rooms.get(room);
      if (roomClients) {
        roomClients.delete(client);
        if (roomClients.size === 0) {
          this.rooms.delete(room);
        }
        removedRooms.push(room);
      }
    }

    this.clientRooms.delete(client);

    logger.debug({ roomCount: removedRooms.length }, 'Client removed from all rooms');
    return removedRooms;
  }

  /**
   * Get all clients subscribed to a room
   */
  getClients(room: string): Set<WebSocket> {
    return this.rooms.get(room) ?? new Set();
  }

  /**
   * Get all rooms a client is subscribed to
   */
  getClientRooms(client: WebSocket): Set<string> {
    return this.clientRooms.get(client) ?? new Set();
  }

  /**
   * Get statistics about room usage
   */
  getStats(): { roomCount: number; totalSubscriptions: number; rooms: Record<string, number> } {
    const rooms: Record<string, number> = {};
    let totalSubscriptions = 0;

    for (const [room, clients] of this.rooms) {
      rooms[room] = clients.size;
      totalSubscriptions += clients.size;
    }

    return {
      roomCount: this.rooms.size,
      totalSubscriptions,
      rooms,
    };
  }

  /**
   * Validate room name format
   * Allowed formats: bill:{id}, vote:{id}
   */
  private isValidRoom(room: string): boolean {
    return /^(bill|vote):[a-z0-9-]+$/i.test(room);
  }
}

// Singleton instance
export const roomManager = new RoomManager();
