import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BucketTelemetry, ColumnDefinition, DdlResult, KafkaMessageRecord, MailStatusReport, ObjectMeta } from '../models/ops.models';

@Injectable({ providedIn: 'root' })
export class PlatformOpsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/v1/ops';

  listKafkaTopics() { return this.http.get<string[]>(`${this.apiUrl}/kafka/topics`); }
  tailKafkaTopic(topic: string, limit = 50) { return this.http.get<KafkaMessageRecord[]>(`${this.apiUrl}/kafka/topics/${encodeURIComponent(topic)}/tail`, { params: new HttpParams().set('limit', limit) }); }
  listTables() { return this.http.get<string[]>(`${this.apiUrl}/database/tables`); }
  getTableSchema(tableName: string) { return this.http.get<ColumnDefinition[]>(`${this.apiUrl}/database/tables/${encodeURIComponent(tableName)}/schema`); }
  executeDdl(ddl: string) { return this.http.post<DdlResult>(`${this.apiUrl}/database/ddl`, { ddl }); }
  getMinioBuckets() { return this.http.get<BucketTelemetry[]>(`${this.apiUrl}/minio/buckets`); }
  listBucketObjects(bucketName: string) { return this.http.get<ObjectMeta[]>(`${this.apiUrl}/minio/buckets/${encodeURIComponent(bucketName)}/objects`); }
  probeMail() { return this.http.get<MailStatusReport>(`${this.apiUrl}/mail/probe`); }
  sendTestEmail(recipient: string) { return this.http.post<MailStatusReport>(`${this.apiUrl}/mail/probe/send`, null, { params: new HttpParams().set('recipient', recipient) }); }
}