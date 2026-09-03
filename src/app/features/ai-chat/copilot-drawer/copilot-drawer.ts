import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiChatService } from '../../../core/services/ai-chat.service';

@Component({
  imports: [FormsModule],
  selector: 'app-copilot-drawer',
  styleUrl: './copilot-drawer.css',
  templateUrl: './copilot-drawer.html',
})
export class CopilotDrawer {
  readonly chatService = inject(AiChatService);
  readonly closeDrawer = output<void>();

  userInput = signal<string>('');

  sendPrompt(): void {
    const text = this.userInput().trim();
    if (!text || this.chatService.isStreaming()) return;

    this.userInput.set('');
    this.chatService.streamPrompt(text, 'Learning Purpose Assessment Platform');
  }
}
