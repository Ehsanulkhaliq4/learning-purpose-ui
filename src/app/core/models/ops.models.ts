export interface KafkaMessageRecord {
  topic: string;
  partition: number;
  offset: number;
  key: string | null;
  payload: string;
  timestamp: string;
}

export interface ColumnDefinition {
  columnName: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  maxLength: number | null;
}

export interface DdlResult { success: boolean; message: string; executionTimeMs: number; }
export interface MailStatusReport { connected: boolean; message: string; latencyMs: number; host: string; port: number; }
export interface BucketTelemetry { bucketName: string; createdAt: string; totalObjects: number; totalSizeBytes: number; totalSizeMb: number; }
export interface ObjectMeta { objectName: string; sizeBytes: number; lastModified: string; etag: string; }