import { Component, ElementRef, ViewChild, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AiChatService, ChatTopic } from '../../../core/services/ai-chat.service';

interface StarterPrompt {
  label: string;
  icon: string;
  prompt: string;
}

@Component({
  imports: [FormsModule, DatePipe],
  selector: 'app-copilot-drawer',
  styleUrl: './copilot-drawer.css',
  templateUrl: './copilot-drawer.html',
})
export class CopilotDrawer {
  readonly chatService = inject(AiChatService);
  readonly closeDrawer = output<void>();

  @ViewChild('messageFeed') private messageFeedRef?: ElementRef<HTMLDivElement>;

  userInput = signal<string>('');
  copiedMsgId = signal<string | null>(null);

  readonly starterPrompts: StarterPrompt[] = [
    {
      label: 'Quiz Mastery',
      icon: '🎯',
      prompt: 'What are the most effective strategies to prepare for my upcoming assessments?'
    },
    {
      label: 'Concept Explainer',
      icon: '💡',
      prompt: 'Explain the core architectural principles of modern web applications in simple terms.'
    },
    {
      label: 'Study Roadmap',
      icon: '📝',
      prompt: 'Create a focused 5-day study plan for reviewing academic course modules.'
    },
    {
      label: 'Code & Math Help',
      icon: '💻',
      prompt: 'How do I analyze time and space complexity of recursive algorithms?'
    }
  ];

  constructor() {
    effect(() => {
      // Trigger scroll whenever messages change or streaming updates
      const _ = this.chatService.messages();
      const __ = this.chatService.isStreaming();
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  sendPrompt(customText?: string): void {
    const text = (customText ?? this.userInput()).trim();
    if (!text || this.chatService.isStreaming()) return;

    this.userInput.set('');
    this.chatService.streamPrompt(text);
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendPrompt();
    }
  }

  selectTopic(topic: ChatTopic): void {
    this.chatService.setTopic(topic);
  }

  clearChat(): void {
    this.chatService.clearChat();
  }

  stopGeneration(): void {
    this.chatService.stopStreaming();
  }

  async copyMessage(id: string, content: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      this.copiedMsgId.set(id);
      setTimeout(() => {
        if (this.copiedMsgId() === id) {
          this.copiedMsgId.set(null);
        }
      }, 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  }

  private scrollToBottom(): void {
    if (this.messageFeedRef?.nativeElement) {
      const el = this.messageFeedRef.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
