import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApplicationLogsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/v1/ops/logs';

  getLogs(date: string, logLevel: string, serviceName: string) {
    let params = new HttpParams().set('date', date);
    if (logLevel !== 'ALL') {
      params = params.set('logLevel', logLevel);
    }
    if (serviceName !== 'ALL') {
      params = params.set('serviceName', serviceName);
    }
    return this.http.get<unknown>(this.apiUrl, { params });
  }
}
