import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BatchMailReport, BucketTelemetry, ColumnDefinition, DdlResult, KafkaMessageRecord, MailpitInboxPage, MailStatusReport, ObjectMeta, TablePage } from '../models/ops.models';

@Injectable({ providedIn: 'root' })
export class PlatformOpsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/v1/ops';

  listKafkaTopics() { return this.http.get<string[]>(`${this.apiUrl}/kafka/topics`); }
  tailKafkaTopic(topic: string, limit = 50) { return this.http.get<KafkaMessageRecord[]>(`${this.apiUrl}/kafka/topics/${encodeURIComponent(topic)}/tail`, { params: new HttpParams().set('limit', limit) }); }
  listDatabases() { return this.http.get<string[]>(`${this.apiUrl}/database/list`); }
  listTables(database: string) { return this.http.get<string[]>(`${this.apiUrl}/database/${encodeURIComponent(database)}/tables`); }
  getTableSchema(database: string, tableName: string) { return this.http.get<ColumnDefinition[]>(`${this.apiUrl}/database/${encodeURIComponent(database)}/tables/${encodeURIComponent(tableName)}/schema`); }
  
  listRows(database: string, tableName: string, page = 0, size = 50, sortBy?: string, sortDir = 'asc') {
    let params = new HttpParams().set('page', page).set('size', size).set('sortDir', sortDir);
    if (sortBy) {
      params = params.set('sortBy', sortBy);
    }
    return this.http.get<TablePage>(`${this.apiUrl}/database/${encodeURIComponent(database)}/tables/${encodeURIComponent(tableName)}/rows`, { params });
  }

  executeDdl(database: string, ddl: string) { return this.http.post<DdlResult>(`${this.apiUrl}/database/${encodeURIComponent(database)}/ddl`, { ddl }); }
  getMinioBuckets() { return this.http.get<BucketTelemetry[]>(`${this.apiUrl}/minio/buckets`); }
  listBucketObjects(bucketName: string) { return this.http.get<ObjectMeta[]>(`${this.apiUrl}/minio/buckets/${encodeURIComponent(bucketName)}/objects`); }
  probeMail() { return this.http.get<MailStatusReport>(`${this.apiUrl}/mail/probe`); }
  sendTestEmail(recipient: string) { return this.http.post<MailStatusReport>(`${this.apiUrl}/mail/probe/send`, null, { params: new HttpParams().set('recipient', recipient) }); }
  broadcastToAllUsers(subject: string, htmlBody: string, batchSize = 50) {
    const params = new HttpParams()
      .set('subject', subject)
      .set('htmlBody', htmlBody)
      .set('batchSize', batchSize);
    return this.http.post<BatchMailReport>(`${this.apiUrl}/mail/broadcast/all-users`, null, { params });
  }

  listInbox(page = 1, size = 20) {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<MailpitInboxPage>(`${this.apiUrl}/mail/inbox`, { params });
  }

  getInboxMessage(id: string) {
    return this.http.get<Record<string, any>>(`${this.apiUrl}/mail/inbox/${encodeURIComponent(id)}`);
  }

  getInboxMessageHtml(id: string) {
    return this.http.get(`${this.apiUrl}/mail/inbox/${encodeURIComponent(id)}/html`, { responseType: 'text' });
  }

  getInboxMessageText(id: string) {
    return this.http.get(`${this.apiUrl}/mail/inbox/${encodeURIComponent(id)}/text`, { responseType: 'text' });
  }

  purgeInbox() {
    return this.http.delete<void>(`${this.apiUrl}/mail/inbox`);
  }
}