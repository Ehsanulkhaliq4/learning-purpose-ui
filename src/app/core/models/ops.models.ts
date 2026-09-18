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
export interface BatchMailReport {
  totalRecipients?: number;
  successful?: number;
  failed?: number;
  failures?: string[];
  executionTimeMs?: number;
  message?: string;
}

export interface MailpitAddress {
  name?: string;
  address?: string;
}

export interface MailpitMessageSummary {
  id: string;
  from?: MailpitAddress | string;
  to?: (MailpitAddress | string)[] | string;
  subject?: string;
  created?: string;
  date?: string;
  size?: number;
  snippet?: string;
  read?: boolean;
}

export interface MailpitInboxPage {
  total?: number;
  unread?: number;
  count?: number;
  messages?: MailpitMessageSummary[];
  content?: MailpitMessageSummary[];
  page?: number;
  size?: number;
  start?: number;
}
export interface BucketTelemetry { bucketName: string; createdAt: string; totalObjects: number; totalSizeBytes: number; totalSizeMb: number; }
export interface ObjectMeta { objectName: string; sizeBytes: number; lastModified: string; etag: string; }

export interface TablePage {
  content?: Record<string, any>[];
  rows?: Record<string, any>[];
  columns?: string[];
  totalElements?: number;
  totalRows?: number;
  totalPages?: number;
  number?: number;
  page?: number;
  size?: number;
}