import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import {
  ChatConversation,
  ChatMessage,
  ChatUser,
  ConversationWithMeta,
  MessagingService,
} from '../../core/services/messaging.service';

type ChatListTab = 'chats' | 'contacts';

@Component({
  selector: 'app-chat',
  imports: [DatePipe, FormsModule],
  styleUrl: './chat.css',
  templateUrl: './chat.html',
})
export class Chat implements OnInit {
  private readonly messaging = inject(MessagingService);
  private readonly auth = inject(AuthService);

  readonly currentUser = this.auth.currentUser;
  readonly currentUserId = computed(() => this.currentUser()?.id ?? null);
  readonly activeTab = signal<ChatListTab>('chats');
  readonly users = signal<ChatUser[]>([]);
  readonly conversations = signal<ConversationWithMeta[]>([]);
  readonly activeConversation = signal<ChatConversation | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly isLoadingUsers = signal(false);
  readonly isLoadingConversations = signal(false);
  readonly isLoadingMessages = signal(false);
  readonly isOpeningConversation = signal(false);
  readonly searchTerm = signal('');
  readonly draft = signal('');
  readonly errorMessage = signal<string | null>(null);
  readonly usersError = signal<string | null>(null);
  readonly conversationError = signal<string | null>(null);
  readonly realtimeUnavailable = signal(true);
  readonly filteredUsers = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) return this.users();
    return this.users().filter((user) =>
      user.username.toLowerCase().includes(query) || this.userName(user).toLowerCase().includes(query),
    );
  });
  readonly filteredConversations = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) return this.conversations();
    return this.conversations().filter((item) =>
      this.conversationName(item.conversation).toLowerCase().includes(query),
    );
  });

  ngOnInit(): void {
    this.loadConversations();
  }

  setTab(tab: ChatListTab): void {
    this.activeTab.set(tab);
    this.searchTerm.set('');
    this.users.set([]);
    this.usersError.set(null);
  }

  updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
    if (this.activeTab() === 'contacts') {
      this.users.set([]);
      this.usersError.set(null);
    }
  }

  findUser(): void {
    const username = this.searchTerm().trim();
    if (!username) {
      this.users.set([]);
      this.usersError.set('Enter an exact username to find someone.');
      return;
    }

    this.isLoadingUsers.set(true);
    this.usersError.set(null);
    this.messaging.getUserByUsername(username).subscribe({
      next: (user) => {
        this.users.set([user]);
        this.isLoadingUsers.set(false);
      },
      error: (error: unknown) => {
        this.users.set([]);
        this.usersError.set(this.errorText(error, 'Could not find that username.'));
        this.isLoadingUsers.set(false);
      },
    });
  }

  loadConversations(): void {
    this.isLoadingConversations.set(true);
    this.conversationError.set(null);
    this.auth.ensureCurrentUserId().pipe(
      switchMap((userId) => this.messaging.listConversations(userId)),
    ).subscribe({
      next: (conversations) => {
        this.conversations.set(
          conversations.sort((a, b) =>
            (b.conversation.lastMessageAt ?? '').localeCompare(a.conversation.lastMessageAt ?? ''),
          ),
        );
        this.isLoadingConversations.set(false);
      },
      error: (error: unknown) => {
        this.conversationError.set(this.errorText(error, 'Could not load your conversations.'));
        this.isLoadingConversations.set(false);
      },
    });
  }

  openConversation(conversation: ChatConversation): void {
    this.activeConversation.set(conversation);
    this.messages.set([]);
    this.errorMessage.set(null);
    this.isLoadingMessages.set(true);
    this.auth.ensureCurrentUserId().pipe(
      switchMap((userId) => this.messaging.getHistory(userId, conversation.id)),
    ).subscribe({
      next: (messages) => {
        this.messages.set([...messages].reverse());
        this.isLoadingMessages.set(false);
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 403) {
          this.activeConversation.set(null);
          this.errorMessage.set(
            'This conversation is no longer available to your account. Your inbox was refreshed; start a new conversation if it is missing.',
          );
          this.loadConversations();
        } else {
          this.errorMessage.set(this.errorText(error, 'Could not load this conversation.'));
        }
        this.isLoadingMessages.set(false);
      },
    });
  }

  startDirectMessage(user: ChatUser): void {
    this.isOpeningConversation.set(true);
    this.errorMessage.set(null);
    this.auth.ensureCurrentUserId().pipe(
      switchMap((userId) => this.messaging.getOrCreateDirectMessage(userId, user.id)),
    ).subscribe({
      next: (conversation) => {
        this.isOpeningConversation.set(false);
        this.activeTab.set('chats');
        const directConversation = {
          ...conversation,
          name: conversation.name || this.userName(user),
          avatarUrl: conversation.avatarUrl || user.avatarUrl,
        };
        this.activeConversation.set(directConversation);
        this.loadConversations();
        this.openConversation(directConversation);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.errorText(error, 'Could not start this conversation.'));
        this.isOpeningConversation.set(false);
      },
    });
  }

  sendMessage(): void {
    if (this.draft().trim()) {
      this.errorMessage.set(
        'Live messaging is not connected yet. Configure the WebSocket URL and message contract to send messages.',
      );
    }
  }

  userName(user: ChatUser): string {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fullName || user.username;
  }

  isCurrentUser(user: ChatUser): boolean {
    return user.id === this.currentUserId();
  }

  conversationName(conversation: ChatConversation): string {
    return conversation.name?.trim() || 'Direct conversation';
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  trackById(_index: number, item: ChatUser): number {
    return item.id;
  }

  trackByConversation(_index: number, item: ConversationWithMeta): string {
    return item.conversation.id;
  }

  trackByMessage(_index: number, item: ChatMessage): string {
    return item.messageId;
  }

  private errorText(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error;
      if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string') {
        return body.message;
      }
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
      if (error.status === 403) {
        return 'The chat API denied access to this conversation (403). Check the signed-in account’s chat permissions.';
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const body = error.error;
      if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string') {
        return body.message;
      }
    }
    return fallback;
  }
}
