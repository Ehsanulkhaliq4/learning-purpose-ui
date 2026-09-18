import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PlatformOpsService } from './platform-ops.service';

describe('PlatformOpsService', () => {
  let service: PlatformOpsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(PlatformOpsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should use database-aware API routes', () => {
    service.listDatabases().subscribe();
    const listReq = httpMock.expectOne('http://localhost:8080/api/v1/ops/database/list');
    expect(listReq.request.method).toBe('GET');
    listReq.flush(['app_db', 'audit_db']);

    service.listTables('app_db').subscribe();
    const tablesReq = httpMock.expectOne('http://localhost:8080/api/v1/ops/database/app_db/tables');
    expect(tablesReq.request.method).toBe('GET');
    tablesReq.flush(['users', 'orders']);

    service.getTableSchema('app_db', 'users').subscribe();
    const schemaReq = httpMock.expectOne('http://localhost:8080/api/v1/ops/database/app_db/tables/users/schema');
    expect(schemaReq.request.method).toBe('GET');
    schemaReq.flush([]);

    service.listRows('app_db', 'users', 1, 20, 'id', 'desc').subscribe();
    const rowsReq = httpMock.expectOne(req => req.url === 'http://localhost:8080/api/v1/ops/database/app_db/tables/users/rows');
    expect(rowsReq.request.method).toBe('GET');
    expect(rowsReq.request.params.get('page')).toBe('1');
    expect(rowsReq.request.params.get('size')).toBe('20');
    expect(rowsReq.request.params.get('sortBy')).toBe('id');
    expect(rowsReq.request.params.get('sortDir')).toBe('desc');
    rowsReq.flush({ content: [], totalElements: 0, totalPages: 0, number: 1, size: 20 });

    service.executeDdl('app_db', 'ALTER TABLE users ADD COLUMN active BOOLEAN').subscribe();
    const ddlReq = httpMock.expectOne('http://localhost:8080/api/v1/ops/database/app_db/ddl');
    expect(ddlReq.request.method).toBe('POST');
    expect(ddlReq.request.body).toEqual({ ddl: 'ALTER TABLE users ADD COLUMN active BOOLEAN' });
    ddlReq.flush({ success: true, message: 'OK', executionTimeMs: 42 });

    service.broadcastToAllUsers('Welcome', '<p>Hello</p>', 100).subscribe();
    const broadcastReq = httpMock.expectOne(req => req.url === 'http://localhost:8080/api/v1/ops/mail/broadcast/all-users');
    expect(broadcastReq.request.method).toBe('POST');
    expect(broadcastReq.request.params.get('subject')).toBe('Welcome');
    expect(broadcastReq.request.params.get('htmlBody')).toBe('<p>Hello</p>');
    expect(broadcastReq.request.params.get('batchSize')).toBe('100');
    broadcastReq.flush({ totalRecipients: 100, successful: 100, failed: 0 });

    service.listInbox(1, 20).subscribe();
    const inboxReq = httpMock.expectOne('http://localhost:8080/api/v1/ops/mail/inbox?page=1&size=20');
    expect(inboxReq.request.method).toBe('GET');
    inboxReq.flush({ total: 1, count: 1, messages: [] });

    service.getInboxMessage('msg-123').subscribe();
    const msgReq = httpMock.expectOne('http://localhost:8080/api/v1/ops/mail/inbox/msg-123');
    expect(msgReq.request.method).toBe('GET');
    msgReq.flush({ ID: 'msg-123', Subject: 'Test' });

    service.getInboxMessageHtml('msg-123').subscribe();
    const htmlReq = httpMock.expectOne('http://localhost:8080/api/v1/ops/mail/inbox/msg-123/html');
    expect(htmlReq.request.method).toBe('GET');
    htmlReq.flush('<h1>Test</h1>');

    service.getInboxMessageText('msg-123').subscribe();
    const textReq = httpMock.expectOne('http://localhost:8080/api/v1/ops/mail/inbox/msg-123/text');
    expect(textReq.request.method).toBe('GET');
    textReq.flush('Test plain text');

    service.purgeInbox().subscribe();
    const purgeReq = httpMock.expectOne('http://localhost:8080/api/v1/ops/mail/inbox');
    expect(purgeReq.request.method).toBe('DELETE');
    purgeReq.flush(null);
  });
});
