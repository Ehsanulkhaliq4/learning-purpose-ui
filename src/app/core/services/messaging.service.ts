import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly http = inject(HttpClient);
  private readonly chatApi = 'http://localhost:8080/api/v1/chat';

  getUserByUsername(username: string): Observable<ChatUser> {
    return this.http.get<ChatUser>(
      `http://localhost:8080/api/v1/users/${encodeURIComponent(username)}`,
    );
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

  private userHeader(userId: number): HttpHeaders {
    return new HttpHeaders({ 'X-User-Id': String(userId) });
  }
}
