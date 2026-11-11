import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ChatUser {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface ChatConversation {
  id: string;
  type: string;
  name?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  lastMessageAt?: string | null;
}

export interface ConversationWithMeta {
  conversation: ChatConversation;
  unreadCount: number | null;
  lastReadMessageId: string | null;
  otherParticipantId?: number | null;
}

export interface ChatMessage {
  conversationId: string;
  messageId: string;
  senderId: number;
  type: string;
  content: string;
  replyToId?: string | null;
  createdAt: string;
  metadata?: string | null;
}

export interface ChatServerEvent {
  type: 'MESSAGE' | 'ERROR' | 'READ_RECEIPT' | 'MEMBER_REQUEST' | 'PONG';
  conversationId?: string;
  messageId?: string;
  senderId?: number;
  content?: string;
  contentType?: string;
  metadata?: string | null;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly http = inject(HttpClient);
  private readonly chatApi = 'http://localhost:8080/api/v1/chat';
  private socket: WebSocket | null = null;
  private connectedUserId: number | null = null;
  private readonly unreadByConversation = new Map<string, number>();
  private readonly pendingReads = new Map<string, string>();

  readonly serverEvents = new Subject<ChatServerEvent>();
  readonly unreadMessageCount = signal(0);
  readonly isNotificationRinging = signal(false);
  readonly isRealtimeConnected = signal(false);
  readonly notificationError = signal<string | null>(null);

  getUserByUsername(username: string): Observable<ChatUser> {
    return this.http.get<ChatUser>(
      `http://localhost:8080/api/v1/users/${encodeURIComponent(username)}`,
    );
  }

  searchUsers(query: string): Observable<ChatUser[]> {
    return this.http.get<ChatUser[]>('http://localhost:8080/api/v1/users/search', {
      params: { query },
    });
  }

  getUserSummaryById(userId: number): Observable<ChatUser> {
    return this.http.get<ChatUser>(`http://localhost:8080/api/v1/users/by-id/${userId}`);
  }

  listConversations(userId: number): Observable<ConversationWithMeta[]> {
    return this.http.get<ConversationWithMeta[]>(`${this.chatApi}/ws/conversations`, {
      headers: this.userHeader(userId),
    });
  }

  getOrCreateDirectMessage(userId: number, otherUserId: number): Observable<ChatConversation> {
    return this.http.get<ChatConversation>(`${this.chatApi}/dm/${otherUserId}`, {
      headers: this.userHeader(userId),
    });
  }

  getHistory(userId: number, conversationId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.chatApi}/ws/${conversationId}/messages`, {
      headers: this.userHeader(userId),
      params: { limit: 100 },
    });
  }

  openRealtimeConnection(userId: number): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = new URL(`${protocol}//${window.location.hostname}:8087/ws/chat`);
    url.searchParams.set('userId', String(userId));
    return new WebSocket(url);
  }

  connectRealtime(userId: number): void {
    if (
      this.connectedUserId === userId &&
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.socket?.close();
    this.connectedUserId = userId;
    this.refreshUnreadCount(userId);

    try {
      const socket = this.openRealtimeConnection(userId);
      this.socket = socket;
      socket.onopen = () => {
        this.isRealtimeConnected.set(true);
        this.notificationError.set(null);
        for (const [conversationId, messageId] of this.pendingReads) {
          this.sendRead(socket, conversationId, messageId);
        }
        this.pendingReads.clear();
      };
      socket.onmessage = (event: MessageEvent<string>) => this.handleServerEvent(event.data, userId);
      socket.onclose = () => {
        if (this.socket === socket) {
          this.socket = null;
          this.isRealtimeConnected.set(false);
          this.notificationError.set('The live messaging connection closed.');
        }
      };
      socket.onerror = () => {
        if (this.socket === socket) {
          this.socket = null;
          this.isRealtimeConnected.set(false);
          this.notificationError.set('Live message notifications are unavailable.');
        }
      };
    } catch {
      this.socket = null;
      this.isRealtimeConnected.set(false);
      this.notificationError.set('Could not connect to live message notifications.');
    }
  }

  sendRealtimeMessage(message: {
    type: 'SEND' | 'READ';
    conversationId: string;
    content?: string;
    contentType?: string;
    messageId?: string;
  }): boolean {
    if (message.type === 'READ' && this.socket?.readyState === WebSocket.CONNECTING && message.messageId) {
      this.pendingReads.set(message.conversationId, message.messageId);
      this.unreadByConversation.set(message.conversationId, 0);
      this.updateUnreadTotal();
      return true;
    }
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    try {
      if (message.type === 'READ') {
        if (!message.messageId) return false;
        this.sendRead(this.socket, message.conversationId, message.messageId);
        this.unreadByConversation.set(message.conversationId, 0);
        this.updateUnreadTotal();
      } else {
        this.socket.send(JSON.stringify(message));
      }
      return true;
    } catch {
      return false;
    }
  }

  private refreshUnreadCount(userId: number): void {
    this.listConversations(userId).subscribe({
      next: (conversations) => {
        this.unreadByConversation.clear();
        for (const item of conversations) {
          this.unreadByConversation.set(item.conversation.id, item.unreadCount ?? 0);
        }
        this.updateUnreadTotal();
      },
      error: () => this.notificationError.set('Could not load unread message notifications.'),
    });
  }

  private handleServerEvent(data: string, userId: number): void {
    let event: unknown;
    try {
      event = JSON.parse(data);
    } catch {
      this.notificationError.set('The chat service returned an invalid notification.');
      return;
    }

    if (!this.isChatServerEvent(event)) {
      this.notificationError.set('The chat service returned an unsupported notification.');
      return;
    }
    this.serverEvents.next(event);

    if (event.type === 'MESSAGE' && event.senderId !== userId && event.conversationId) {
      const unread = this.unreadByConversation.get(event.conversationId) ?? 0;
      this.unreadByConversation.set(event.conversationId, unread + 1);
      this.updateUnreadTotal();
    }
  }

  private isChatServerEvent(event: unknown): event is ChatServerEvent {
    return typeof event === 'object' && event !== null &&
      'type' in event &&
      ['MESSAGE', 'ERROR', 'READ_RECEIPT', 'MEMBER_REQUEST', 'PONG'].includes(String(event.type));
  }

  private updateUnreadTotal(): void {
    const unreadCount = [...this.unreadByConversation.values()]
      .reduce((total, count) => total + count, 0);
    this.unreadMessageCount.set(unreadCount);
    this.isNotificationRinging.set(unreadCount > 0);
  }

  private sendRead(socket: WebSocket, conversationId: string, messageId: string): void {
    socket.send(JSON.stringify({ type: 'READ', conversationId, messageId }));
  }

  private userHeader(userId: number): HttpHeaders {
    return new HttpHeaders({ 'X-User-Id': String(userId) });
  }
}
