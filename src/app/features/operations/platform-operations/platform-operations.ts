import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PlatformOpsService } from '../../../core/services/platform-ops.service';
import { BucketTelemetry, ColumnDefinition, DdlResult, KafkaMessageRecord, MailStatusReport, ObjectMeta, TablePage } from '../../../core/models/ops.models';

@Component({
  imports: [DatePipe, DecimalPipe, RouterLink],
  selector: 'app-platform-operations',
  styleUrl: './platform-operations.css',
  templateUrl: './platform-operations.html'
})
export class PlatformOperations implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly ops = inject(PlatformOpsService);

  readonly toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly topics = signal<string[]>([]); readonly messages = signal<KafkaMessageRecord[]>([]);
  readonly databases = signal<string[]>([]); readonly tables = signal<string[]>([]); readonly schema = signal<ColumnDefinition[]>([]);
  readonly tableData = signal<TablePage | null>(null); readonly tableDataLoading = signal(false);
  readonly buckets = signal<BucketTelemetry[]>([]); readonly objects = signal<ObjectMeta[]>([]);
  readonly mail = signal<MailStatusReport | null>(null); readonly ddlResult = signal<DdlResult | null>(null);
  readonly selectedTopic = signal(''); readonly selectedDatabase = signal(''); readonly selectedTable = signal(''); readonly selectedBucket = signal('');
  readonly ddl = signal(''); readonly recipient = signal(''); readonly loading = signal(true); readonly error = signal('');

  ngOnInit(): void { if (this.auth.isAdmin()) this.refresh(); }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4500);
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    
    this.ops.listKafkaTopics().subscribe({
      next: value => {
        this.topics.set(value || []);
        if (value && value[0]) this.selectTopic(value[0]);
      },
      error: () => this.showToast('error', 'Kafka topics could not be loaded.')
    });

    this.ops.listDatabases().subscribe({
      next: value => {
        this.databases.set(value || []);
        if (value && value[0]) {
          this.selectDatabase(value[0]);
        } else {
          this.tables.set([]);
          this.schema.set([]);
          this.selectedTable.set('');
          this.tableData.set(null);
        }
      },
      error: () => this.showToast('error', 'Database list could not be loaded.')
    });

    this.ops.getMinioBuckets().subscribe({
      next: value => {
        this.buckets.set(value || []);
        if (value && value[0]) this.selectBucket(value[0].bucketName);
      },
      error: () => this.showToast('error', 'MinIO telemetry could not be loaded.')
    });

    this.ops.probeMail().subscribe({
      next: value => this.mail.set(value),
      error: () => this.showToast('error', 'Mail server is currently unreachable.'),
      complete: () => this.loading.set(false)
    });

    // Safeguard to ensure loading spinner stops even if probeMail fails
    setTimeout(() => this.loading.set(false), 2000);
  }

  selectTopic(topic: string): void {
    this.selectedTopic.set(topic);
    this.ops.tailKafkaTopic(topic).subscribe({
      next: value => this.messages.set(value || [])
    });
  }

  selectDatabase(database: string): void {
    this.selectedDatabase.set(database);
    this.selectedTable.set('');
    this.schema.set([]);
    this.tableData.set(null);
    this.ops.listTables(database).subscribe({
      next: value => {
        this.tables.set(value || []);
        if (value && value[0]) this.selectTable(value[0]);
      },
      error: () => this.showToast('error', `Tables for database "${database}" could not be loaded.`)
    });
  }

  selectTable(table: string): void {
    this.selectedTable.set(table);
    const database = this.selectedDatabase();
    if (!database) return;
    this.ops.getTableSchema(database, table).subscribe({
      next: value => this.schema.set(value || [])
    });
    this.loadTableData();
  }

  loadTableData(page = 0): void {
    const database = this.selectedDatabase();
    const table = this.selectedTable();
    if (!database || !table) return;
    this.tableDataLoading.set(true);
    this.ops.listRows(database, table, page).subscribe({
      next: value => this.tableData.set(value),
      error: () => this.showToast('error', `Rows for table "${table}" could not be loaded.`),
      complete: () => this.tableDataLoading.set(false)
    });
  }

  getTableRowItems(): Record<string, any>[] {
    const data: any = this.tableData();
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.rows)) return data.rows;
    if (Array.isArray(data.content)) return data.content;
    return [];
  }

  getTableColumns(): string[] {
    const schemaCols = this.schema().map(s => s.columnName);
    if (schemaCols.length > 0) return schemaCols;
    const data: any = this.tableData();
    if (data?.columns && Array.isArray(data.columns)) return data.columns;
    const rows = this.getTableRowItems();
    if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
      return Object.keys(rows[0]);
    }
    return [];
  }

  getCurrentPageNumber(): number {
    const data: any = this.tableData();
    if (!data) return 0;
    return data.page ?? data.number ?? 0;
  }

  getTotalPagesCount(): number {
    const data: any = this.tableData();
    if (!data) return 0;
    return data.totalPages ?? (data.totalRows ? Math.ceil(data.totalRows / (data.size || 50)) : (this.getTableRowItems().length > 0 ? 1 : 0));
  }

  selectBucket(bucket: string): void {
    this.selectedBucket.set(bucket);
    this.ops.listBucketObjects(bucket).subscribe({
      next: value => this.objects.set(value || [])
    });
  }

  runDdl(): void {
    const database = this.selectedDatabase();
    if (!database) {
      this.showToast('error', 'Please choose a target database first.');
      return;
    }
    if (!this.ddl().trim()) {
      this.showToast('error', 'DDL statement cannot be empty.');
      return;
    }
    this.ops.executeDdl(database, this.ddl()).subscribe({
      next: value => {
        this.ddlResult.set(value);
        if (value.success) {
          this.showToast('success', value.message || 'DDL executed successfully.');
          // Refresh tables & schema
          this.selectDatabase(database);
        } else {
          this.showToast('error', value.message || 'DDL execution failed.');
        }
      },
      error: err => this.showToast('error', err?.error?.message || 'Error executing DDL statement.')
    });
  }

  sendMail(): void {
    const recipient = this.recipient().trim();
    if (!recipient) {
      this.showToast('error', 'Please enter a test recipient email.');
      return;
    }
    this.ops.sendTestEmail(recipient).subscribe({
      next: value => {
        this.mail.set(value);
        this.showToast('success', `Test email sent to ${recipient}`);
      },
      error: () => this.showToast('error', 'Failed to dispatch test email.')
    });
  }

  formatBytes(bytes: number): string { return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
}