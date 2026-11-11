import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import {
  ChatServerEvent,
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
export class Chat implements OnDestroy, OnInit {
  private readonly messaging = inject(MessagingService);
  private readonly auth = inject(AuthService);
  private readonly searchTerms = new Subject<string>();
  private subscriptions = new Subscription();

  readonly currentUser = this.auth.currentUser;
  readonly currentUserId = computed(() => this.currentUser()?.id ?? null);
  readonly activeTab = signal<ChatListTab>('chats');
  readonly users = signal<ChatUser[]>([]);
  readonly conversations = signal<ConversationWithMeta[]>([]);
  readonly activeConversation = signal<ChatConversation | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly messageSearchOpen = signal(false);
  readonly messageSearchTerm = signal('');
  readonly conversationMenuOpen = signal(false);
  readonly isLoadingUsers = signal(false);
  readonly isLoadingConversations = signal(false);
  readonly isLoadingMessages = signal(false);
  readonly isOpeningConversation = signal(false);
  readonly searchTerm = signal('');
  readonly draft = signal('');
  readonly errorMessage = signal<string | null>(null);
  readonly usersError = signal<string | null>(null);
  readonly conversationError = signal<string | null>(null);
  readonly realtimeUnavailable = computed(() => !this.messaging.isRealtimeConnected());
  readonly filteredMessages = computed(() => {
    const query = this.messageSearchTerm().trim().toLowerCase();
    if (!query) return this.messages();
    return this.messages().filter((message) => message.content.toLowerCase().includes(query));
  });
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
    this.subscriptions.add(this.searchTerms.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((query) => query.length >= 2
        ? this.messaging.searchUsers(query).pipe(
            map((users) => users.filter((user) => !this.isCurrentUser(user))),
            catchError((error: unknown) => {
              this.usersError.set(this.errorText(error, 'Could not search usernames.'));
              this.isLoadingUsers.set(false);
              return of([]);
            }),
          )
        : of([]),
      ),
    ).subscribe((users) => {
      this.users.set(users);
      this.isLoadingUsers.set(false);
    }));
    this.subscriptions.add(this.messaging.serverEvents.subscribe((event) => {
      this.handleRealtimeEvent(event);
    }));
    this.loadConversations();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  setTab(tab: ChatListTab): void {
    this.activeTab.set(tab);
    this.searchTerm.set('');
    this.users.set([]);
    this.usersError.set(null);
    this.isLoadingUsers.set(false);
    this.searchTerms.next('');
  }

  updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
    if (this.activeTab() === 'contacts') {
      this.users.set([]);
      this.usersError.set(null);
      const query = value.trim();
      this.isLoadingUsers.set(query.length >= 2);
      this.searchTerms.next(query);
    }
  }

  loadConversations(): void {
    this.isLoadingConversations.set(true);
    this.conversationError.set(null);
    this.auth.ensureCurrentUserId().pipe(
      switchMap((userId) => this.messaging.listConversations(userId)),
      switchMap((conversations) => this.resolveConversationNames(conversations)),
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
    this.messageSearchTerm.set('');
    this.messageSearchOpen.set(false);
    this.conversationMenuOpen.set(false);
    this.errorMessage.set(null);
    this.isLoadingMessages.set(true);
    this.auth.ensureCurrentUserId().pipe(
      switchMap((userId) => this.messaging.getHistory(userId, conversation.id)),
    ).subscribe({
      next: (messages) => {
        const orderedMessages = [...messages].reverse();
        this.messages.set(orderedMessages);
        const latestMessage = orderedMessages.at(-1);
        if (latestMessage) {
          this.messaging.sendRealtimeMessage({
            type: 'READ',
            conversationId: conversation.id,
            messageId: latestMessage.messageId,
          });
        }
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
    const content = this.draft().trim();
    const conversation = this.activeConversation();
    if (!content || !conversation) return;
    const sent = this.messaging.sendRealtimeMessage({
      type: 'SEND',
      conversationId: conversation.id,
      content,
      contentType: 'text',
    });
    if (!sent) {
      this.errorMessage.set('Live messaging is not connected. Wait for the connection or reload the page to reconnect.');
      return;
    }

    this.draft.set('');
    this.errorMessage.set(null);
  }

  toggleMessageSearch(): void {
    this.messageSearchOpen.update((open) => !open);
    this.messageSearchTerm.set('');
    this.conversationMenuOpen.set(false);
  }

  toggleConversationMenu(): void {
    this.conversationMenuOpen.update((open) => !open);
    this.messageSearchOpen.set(false);
  }

  refreshConversation(): void {
    const conversation = this.activeConversation();
    this.conversationMenuOpen.set(false);
    if (conversation) this.openConversation(conversation);
  }

  closeConversation(): void {
    this.activeConversation.set(null);
    this.messages.set([]);
    this.messageSearchTerm.set('');
    this.messageSearchOpen.set(false);
    this.conversationMenuOpen.set(false);
  }

  userName(user: ChatUser): string {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fullName || user.username;
  }

  isCurrentUser(user: ChatUser): boolean {
    return user.id === this.currentUserId();
  }

  conversationName(conversation: ChatConversation): string {
    const name = conversation.name?.trim();
    if (name && name.toLowerCase() !== 'direct conversation') return name;
    return conversation.type.toLowerCase() === 'group' ? 'Group conversation' : 'Direct conversation';
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

  private handleRealtimeEvent(event: ChatServerEvent): void {
    if (event.type === 'ERROR') {
      this.errorMessage.set(event.content || 'The chat service could not process your message.');
      return;
    }

    if (
      event.type !== 'MESSAGE' ||
      !event.conversationId ||
      !event.messageId ||
      typeof event.senderId !== 'number' ||
      typeof event.content !== 'string' ||
      !event.createdAt
    ) {
      return;
    }

    const message: ChatMessage = {
      conversationId: event.conversationId,
      messageId: event.messageId,
      senderId: event.senderId,
      type: event.contentType || 'text',
      content: event.content,
      createdAt: event.createdAt,
      metadata: event.metadata,
    };
    if (this.activeConversation()?.id !== message.conversationId) return;
    this.messages.update((messages) => {
      if (messages.some((existing) => existing.messageId === message.messageId)) return messages;
      return [...messages, message];
    });

    if (message.senderId !== this.currentUserId()) {
      this.messaging.sendRealtimeMessage({
        type: 'READ',
        conversationId: message.conversationId,
        messageId: message.messageId,
      });
    }
  }

  private resolveConversationNames(conversations: ConversationWithMeta[]) {
    if (!conversations.length) return of([]);

    return forkJoin(conversations.map((item) => {
      if (item.conversation.type.toLowerCase() !== 'dm' || !item.otherParticipantId) {
        return of(item);
      }

      return this.messaging.getUserSummaryById(item.otherParticipantId).pipe(
        map((user) => ({
          ...item,
          conversation: {
            ...item.conversation,
            name: this.userName(user),
          },
        })),
      );
    }));
  }
}
