import { Injectable, signal } from '@angular/core';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly CHAT_STREAM_URL = 'http://localhost:8080/api/v1/chat/stream';

  readonly messages = signal<ChatMessage[]>([
    {
      role: 'system',
      content: 'Hello! I am your Gemini Academic Tutor. Ask me any question regarding your quizzes or lessons.',
      timestamp: new Date()
    }
  ]);
  readonly isStreaming = signal<boolean>(false);

  async streamPrompt(promptText: string, subjectContext: string = 'General'): Promise<void> {
    const userMsg: ChatMessage = {
      role: 'user',
      content: promptText,
      timestamp: new Date()
    };
    this.messages.update((msgs) => [...msgs, userMsg]);

    const assistantMsgIndex = this.messages().length;
    this.messages.update((msgs) => [
      ...msgs,
      { role: 'assistant', content: '', timestamp: new Date() }
    ]);

    this.isStreaming.set(true);

    try {
      const response = await fetch(this.CHAT_STREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          prompt: promptText,
          subjectContext: subjectContext
        })
      });

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value, { stream: true });
        const lines = rawChunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const dataText = line.substring(5).trim();
            this.messages.update((msgs) => {
              const updated = [...msgs];
              updated[assistantMsgIndex].content += dataText;
              return updated;
            });
          } else if (line.trim().length > 0 && !line.startsWith(':')) {
            this.messages.update((msgs) => {
              const updated = [...msgs];
              updated[assistantMsgIndex].content += line;
              return updated;
            });
          }
        }
      }
    } catch (err: any) {
      this.messages.update((msgs) => {
        const updated = [...msgs];
        updated[assistantMsgIndex].content += `\n[Streaming Error: ${err.message || 'Interrupted'}]`;
        return updated;
      });
    } finally {
      this.isStreaming.set(false);
    }
  }
}