import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, JsonPipe } from '@angular/common';
import { PlatformOpsService } from '../../../core/services/platform-ops.service';
import { AuthService } from '../../../core/services/auth.service';
import { BatchMailReport, MailpitMessageSummary, MailStatusReport } from '../../../core/models/ops.models';

@Component({
  imports: [RouterLink, FormsModule, DatePipe, JsonPipe],
  selector: 'app-mail-operations',
  styleUrl: './mail-operations.css',
  templateUrl: './mail-operations.html'
})
export class MailOperations implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly ops = inject(PlatformOpsService);

  readonly toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly mail = signal<MailStatusReport | null>(null);
  readonly loading = signal(false);
  readonly testingProbe = signal(false);
  readonly broadcasting = signal(false);

  // Diagnostic Single Send
  readonly testRecipient = signal('');

  // Batch Broadcast
  readonly broadcastSubject = signal('');
  readonly broadcastHtmlBody = signal('');
  readonly broadcastBatchSize = signal(50);
  readonly broadcastResult = signal<BatchMailReport | null>(null);

  // Mailpit Inbox
  readonly inboxMessages = signal<MailpitMessageSummary[]>([]);
  readonly selectedMessage = signal<any | null>(null);
  readonly selectedMessageHtml = signal<string>('');
  readonly selectedMessageText = signal<string>('');
  readonly viewBodyMode = signal<'html' | 'text' | 'raw'>('html');
  readonly inboxPage = signal(1);
  readonly inboxSize = signal(20);
  readonly inboxTotal = signal(0);
  readonly inboxLoading = signal(false);
  readonly messageDetailLoading = signal(false);
  readonly purging = signal(false);

  ngOnInit(): void {
    if (this.auth.isAdmin()) {
      this.probeConnection();
      this.loadInbox();
    }
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4500);
  }

  probeConnection(): void {
    this.loading.set(true);
    this.ops.probeMail().subscribe({
      next: (report) => {
        this.mail.set(report);
        if (report.connected) {
          this.showToast('success', `Mail server online (${report.latencyMs} ms)`);
        } else {
          this.showToast('error', 'Mail server reported unavailable.');
        }
      },
      error: () => this.showToast('error', 'Could not connect to mail service.'),
      complete: () => this.loading.set(false)
    });
  }

  sendDiagnostic(): void {
    const recipient = this.testRecipient().trim();
    if (!recipient) {
      this.showToast('error', 'Please enter a test recipient email.');
      return;
    }
    this.testingProbe.set(true);
    this.ops.sendTestEmail(recipient).subscribe({
      next: (res) => {
        this.mail.set(res);
        this.showToast('success', `Diagnostic probe email sent to ${recipient}`);
        this.loadInbox();
      },
      error: () => this.showToast('error', 'Failed to deliver test email.'),
      complete: () => this.testingProbe.set(false)
    });
  }

  sendBroadcast(): void {
    const subject = this.broadcastSubject().trim();
    const body = this.broadcastHtmlBody().trim();
    const batchSize = this.broadcastBatchSize() || 50;

    if (!subject || !body) {
      this.showToast('error', 'Please provide both email subject and HTML body.');
      return;
    }

    this.broadcasting.set(true);
    this.broadcastResult.set(null);

    this.ops.broadcastToAllUsers(subject, body, batchSize).subscribe({
      next: (res) => {
        this.broadcastResult.set(res);
        this.showToast('success', `Broadcast completed! Dispatched to ${res.successful ?? res.totalRecipients ?? 'all'} users.`);
        this.loadInbox();
      },
      error: (err) => this.showToast('error', err?.error?.message || 'Broadcast dispatch encountered an error.'),
      complete: () => this.broadcasting.set(false)
    });
  }

  loadInbox(page: number = this.inboxPage()): void {
    this.inboxPage.set(page);
    this.inboxLoading.set(true);
    this.ops.listInbox(page, this.inboxSize()).subscribe({
      next: (res: any) => {
        const msgs: MailpitMessageSummary[] = res?.messages || res?.content || (Array.isArray(res) ? res : []);
        const normalized = msgs.map(m => ({
          ...m,
          id: m.id || (m as any).ID,
          from: m.from || (m as any).From,
          to: m.to || (m as any).To,
          subject: m.subject || (m as any).Subject,
          created: m.created || (m as any).Created || m.date,
          snippet: m.snippet || (m as any).Snippet
        }));
        this.inboxMessages.set(normalized);
        this.inboxTotal.set(res?.total ?? res?.totalElements ?? normalized.length);
        if (normalized.length > 0 && !this.selectedMessage()) {
          this.selectMessage(normalized[0]);
        }
      },
      error: () => {
        this.inboxMessages.set([]);
      },
      complete: () => this.inboxLoading.set(false)
    });
  }

  selectMessage(msg: MailpitMessageSummary): void {
    const id = msg.id;
    if (!id) return;
    this.selectedMessage.set(msg);
    this.messageDetailLoading.set(true);

    this.ops.getInboxMessage(id).subscribe({
      next: (full) => {
        this.selectedMessage.set({ ...msg, ...full });
      }
    });

    this.ops.getInboxMessageHtml(id).subscribe({
      next: (html) => this.selectedMessageHtml.set(html || ''),
      error: () => this.selectedMessageHtml.set('')
    });

    this.ops.getInboxMessageText(id).subscribe({
      next: (text) => this.selectedMessageText.set(text || ''),
      error: () => this.selectedMessageText.set(''),
      complete: () => this.messageDetailLoading.set(false)
    });
  }

  purgeInboxMessages(): void {
    if (!confirm('Are you sure you want to purge all emails from the Mailpit inbox?')) {
      return;
    }
    this.purging.set(true);
    this.ops.purgeInbox().subscribe({
      next: () => {
        this.inboxMessages.set([]);
        this.selectedMessage.set(null);
        this.selectedMessageHtml.set('');
        this.selectedMessageText.set('');
        this.inboxTotal.set(0);
        this.showToast('success', 'Mailpit inbox purged successfully.');
      },
      error: () => this.showToast('error', 'Failed to purge Mailpit inbox.'),
      complete: () => this.purging.set(false)
    });
  }

  formatAddress(val: any): string {
    if (!val) return '-';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
      return val.map(v => typeof v === 'string' ? v : (v.name ? `${v.name} <${v.address}>` : v.address)).join(', ');
    }
    if (typeof val === 'object') {
      return val.name ? `${val.name} <${val.address}>` : (val.address || '-');
    }
    return String(val);
  }

  formatBytes(bytes: number | undefined): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
}
