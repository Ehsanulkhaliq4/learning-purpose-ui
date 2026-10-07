import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { KafkaMessageRecord } from '../../../core/models/ops.models';
import { AuthService } from '../../../core/services/auth.service';
import { PlatformOpsService } from '../../../core/services/platform-ops.service';

@Component({
  imports: [DatePipe, RouterLink],
  selector: 'app-kafka-log-detail',
  styleUrl: './kafka-log-detail.css',
  templateUrl: './kafka-log-detail.html'
})
export class KafkaLogDetail implements OnInit {
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly ops = inject(PlatformOpsService);

  readonly message = signal<KafkaMessageRecord | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    if (!this.auth.isAdmin()) {
      this.loading.set(false);
      return;
    }

    const params = this.route.snapshot.queryParamMap;
    const topic = params.get('topic');
    const partition = Number(params.get('partition'));
    const offset = Number(params.get('offset'));

    if (!topic || !Number.isInteger(partition) || !Number.isInteger(offset)) {
      this.error.set('Choose a log entry from the operations console to view its details.');
      this.loading.set(false);
      return;
    }

    this.ops.tailKafkaTopic(topic).subscribe({
      next: messages => {
        const selected = (messages || []).find(message =>
          message.partition === partition && message.offset === offset
        );
        if (selected) {
          this.message.set(selected);
        } else {
          this.error.set('This log entry is no longer available in the latest topic results.');
        }
      },
      error: () => this.error.set('The log entry could not be loaded. Please return to operations and try again.'),
      complete: () => this.loading.set(false)
    });
  }

  getPayloadFormat(): string {
    const payload = this.message()?.payload ?? '';
    try {
      JSON.parse(payload);
      return 'JSON';
    } catch {
      return 'Text';
    }
  }

  formatPayload(payload: string): string {
    try {
      return JSON.stringify(JSON.parse(payload), null, 2) ?? payload;
    } catch {
      return payload;
    }
  }
}