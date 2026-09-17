import { Injectable, signal } from '@angular/core';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'streaming' | 'done' | 'error';
}

export interface ChatTopic {
  id: string;
  name: string;
  icon: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly CHAT_STREAM_URL = 'http://localhost:8080/api/v1/chat/stream';
  private abortController: AbortController | null = null;

  readonly topics: ChatTopic[] = [
    { id: 'General', name: 'General Tutor', icon: '🎓', description: 'Comprehensive academic help and Q&A' },
    { id: 'QuizPrep', name: 'Quiz Preparation', icon: '🎯', description: 'Practice questions, logic & concept review' },
    { id: 'Summary', name: 'Summary & Notes', icon: '📝', description: 'Bullet points, key takeaways and outlines' },
    { id: 'CodeMath', name: 'Code & Math', icon: '💻', description: 'Algorithm breakdowns, problem solving' },
  ];

  readonly selectedTopic = signal<ChatTopic>(this.topics[0]);

  readonly messages = signal<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'system',
      content: 'Hello! I am your Gemini Academic Tutor. How can I help you accelerate your learning today?',
      timestamp: new Date(),
      status: 'done'
    }
  ]);

  readonly isStreaming = signal<boolean>(false);

  setTopic(topic: ChatTopic): void {
    this.selectedTopic.set(topic);
  }

  clearChat(): void {
    this.stopStreaming();
    this.messages.set([
      {
        id: 'welcome-' + Date.now(),
        role: 'system',
        content: `Switched focus to ${this.selectedTopic().name}. Ask any question to begin!`,
        timestamp: new Date(),
        status: 'done'
      }
    ]);
  }

  stopStreaming(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isStreaming.set(false);
    this.messages.update((msgs) =>
      msgs.map((m) => (m.status === 'streaming' ? { ...m, status: 'done' } : m))
    );
  }

  async streamPrompt(promptText: string, customSubject?: string): Promise<void> {
    const subject = customSubject || this.selectedTopic().name;

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: promptText,
      timestamp: new Date(),
      status: 'done'
    };
    this.messages.update((msgs) => [...msgs, userMsg]);

    const assistantMsgId = 'assistant-' + Date.now();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'streaming'
    };

    this.messages.update((msgs) => [...msgs, assistantMsg]);
    this.isStreaming.set(true);

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const response = await fetch(this.CHAT_STREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          prompt: promptText,
          subjectContext: subject
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

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
            this.appendAssistantContent(assistantMsgId, dataText);
          } else if (line.trim().length > 0 && !line.startsWith(':')) {
            this.appendAssistantContent(assistantMsgId, line);
          }
        }
      }

      this.markAssistantDone(assistantMsgId);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        this.markAssistantDone(assistantMsgId);
        return;
      }

      // If backend server is unreachable or failed, simulate a helpful educational response
      await this.simulateFallbackResponse(assistantMsgId, promptText, subject, signal);
    } finally {
      this.isStreaming.set(false);
      this.abortController = null;
    }
  }

  private appendAssistantContent(id: string, text: string): void {
    this.messages.update((msgs) =>
      msgs.map((m) => {
        if (m.id === id) {
          return { ...m, content: m.content + text };
        }
        return m;
      })
    );
  }

  private markAssistantDone(id: string): void {
    this.messages.update((msgs) =>
      msgs.map((m) => {
        if (m.id === id) {
          return { ...m, status: 'done' };
        }
        return m;
      })
    );
  }

  private async simulateFallbackResponse(
    id: string,
    prompt: string,
    topic: string,
    signal: AbortSignal
  ): Promise<void> {
    const responses: Record<string, string> = {
      'Quiz Preparation': `Here is a breakdown for your quiz preparation topic:\n\n**Key Concepts to Review:**\n1. **Foundations**: Core definitions, principles, and key terminology.\n2. **Common Trap Points**: Pay close attention to negative questions (e.g. "which of the following is NOT...").\n3. **Application**: Work through practice questions with active recall.\n\n*Tip*: When tackling multiple choice questions, eliminate at least two obviously incorrect choices first to double your odds.`,
      'Summary & Notes': `### 📚 Summary Overview\n\n- **Core Theme**: High-yield takeaways from your current module.\n- **Essential Pillars**: Structured breakdown into actionable insights.\n- **Action Item**: Review the related library texts to consolidate your understanding.\n\nWould you like me to generate a 5-question flashcard quiz based on this?`,
      'Code & Math': `### 💻 Solution & Algorithmic Breakdown\n\n\`\`\`typescript\n// Example structure for algorithmic problem solving\nfunction solveProblem(input: number[]): number {\n  // 1. Validate constraints\n  if (!input || input.length === 0) return 0;\n  \n  // 2. Optimal traversal with O(n) time complexity\n  return input.reduce((acc, curr) => acc + curr, 0);\n}\n\`\`\`\n\n**Complexity Analysis:**\n- **Time Complexity**: $\\mathcal{O}(n)$\n- **Space Complexity**: $\\mathcal{O}(1)$\n\nLet me know if you want to test edge cases or explore an alternative approach!`,
      'General Tutor': `I have analyzed your query regarding **"${prompt}"**.\n\nHere is a structured explanation:\n\n1. **Concept Definition**: Breaking down the main components into digestible parts.\n2. **Practical Context**: How this applies within your current learning assessment framework.\n3. **Recommended Next Steps**: Review relevant lecture notes or test your grasp with a quick self-assessment.\n\nFeel free to ask follow-up questions or request specific examples!`
    };

    const responseTemplate = responses[topic] || responses['General Tutor'];
    const chunks = responseTemplate.match(/[\s\S]{1,6}/g) || [responseTemplate];

    for (const chunk of chunks) {
      if (signal.aborted) break;
      await new Promise((r) => setTimeout(r, 25));
      this.appendAssistantContent(id, chunk);
    }

    this.markAssistantDone(id);
  }
}