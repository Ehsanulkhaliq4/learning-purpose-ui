import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { PlatformOpsService } from '../../../core/services/platform-ops.service';
import { BucketTelemetry, ColumnDefinition, DdlResult, KafkaMessageRecord, MailStatusReport, ObjectMeta } from '../../../core/models/ops.models';

@Component({
  imports: [DatePipe, DecimalPipe],
  selector: 'app-platform-operations',
  styleUrl: './platform-operations.css',
  templateUrl: './platform-operations.html'
})
export class PlatformOperations implements OnInit {
  readonly auth = inject(AuthService);
  private readonly ops = inject(PlatformOpsService);
  readonly topics = signal<string[]>([]); readonly messages = signal<KafkaMessageRecord[]>([]);
  readonly tables = signal<string[]>([]); readonly schema = signal<ColumnDefinition[]>([]);
  readonly buckets = signal<BucketTelemetry[]>([]); readonly objects = signal<ObjectMeta[]>([]);
  readonly mail = signal<MailStatusReport | null>(null); readonly ddlResult = signal<DdlResult | null>(null);
  readonly selectedTopic = signal(''); readonly selectedTable = signal(''); readonly selectedBucket = signal('');
  readonly ddl = signal(''); readonly recipient = signal(''); readonly loading = signal(true); readonly error = signal('');

  ngOnInit(): void { if (this.auth.isAdmin()) this.refresh(); }
  refresh(): void {
    this.loading.set(true); this.error.set('');
    this.ops.listKafkaTopics().subscribe({ next: value => { this.topics.set(value); if (value[0]) this.selectTopic(value[0]); }, error: () => this.error.set('Kafka topics could not be loaded.') });
    this.ops.listTables().subscribe({ next: value => { this.tables.set(value); if (value[0]) this.selectTable(value[0]); }, error: () => this.error.set('Database tables could not be loaded.') });
    this.ops.getMinioBuckets().subscribe({ next: value => { this.buckets.set(value); if (value[0]) this.selectBucket(value[0].bucketName); }, error: () => this.error.set('MinIO telemetry could not be loaded.') });
    this.ops.probeMail().subscribe({ next: value => this.mail.set(value), error: () => this.error.set('Mail probe could not be loaded.'), complete: () => this.loading.set(false) });
  }
  selectTopic(topic: string): void { this.selectedTopic.set(topic); this.ops.tailKafkaTopic(topic).subscribe({ next: value => this.messages.set(value) }); }
  selectTable(table: string): void { this.selectedTable.set(table); this.ops.getTableSchema(table).subscribe({ next: value => this.schema.set(value) }); }
  selectBucket(bucket: string): void { this.selectedBucket.set(bucket); this.ops.listBucketObjects(bucket).subscribe({ next: value => this.objects.set(value) }); }
  runDdl(): void { if (this.ddl().trim()) this.ops.executeDdl(this.ddl()).subscribe({ next: value => this.ddlResult.set(value) }); }
  sendMail(): void { if (this.recipient().trim()) this.ops.sendTestEmail(this.recipient()).subscribe({ next: value => this.mail.set(value) }); }
  formatBytes(bytes: number): string { return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
}