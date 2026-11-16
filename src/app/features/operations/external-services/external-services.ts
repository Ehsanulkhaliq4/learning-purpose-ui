import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface ExternalService {
  id: 'debezium' | 'minio' | 'mailpit' | 'elasticsearch' | 'dozzle' | 'pgadmin';
  name: string;
  description: string;
  url: string;
  destination: string;
  icon: 'data' | 'storage' | 'mail' | 'search' | 'logs' | 'database';
}

@Component({
  imports: [RouterLink],
  selector: 'app-external-services',
  styleUrl: './external-services.css',
  templateUrl: './external-services.html',
})
export class ExternalServices {
  readonly auth = inject(AuthService);

  readonly services: ExternalService[] = [
    {
      id: 'debezium',
      name: 'Debezium UI',
      description: 'Manage CDC connectors and inspect their status.',
      url: 'http://localhost:9095/',
      destination: 'localhost:9095',
      icon: 'data',
    },
    {
      id: 'minio',
      name: 'MinIO Console',
      description: 'Browse object-storage buckets and files.',
      url: 'http://localhost:9001/',
      destination: 'localhost:9001',
      icon: 'storage',
    },
    {
      id: 'mailpit',
      name: 'Mailpit',
      description: 'Inspect emails sent by the development platform.',
      url: 'http://localhost:8025/',
      destination: 'localhost:8025',
      icon: 'mail',
    },
    {
      id: 'elasticsearch',
      name: 'Elasticsearch',
      description: 'Manage Elasticsearch indices and explore your data.',
      url: 'http://localhost:5601/app/management',
      destination: 'localhost:5601/app/management',
      icon: 'search',
    },
    {
      id: 'dozzle',
      name: 'Dozzle',
      description: 'View live logs from running containers.',
      url: 'http://localhost:9999/',
      destination: 'localhost:9999',
      icon: 'logs',
    },
    {
      id: 'pgadmin',
      name: 'pgAdmin',
      description: 'Manage PostgreSQL databases and inspect their schemas.',
      url: 'http://localhost:5050/login?next=/browser/',
      destination: 'localhost:5050/login?next=/browser/',
      icon: 'database',
    },
  ];

  readonly pendingService = signal<ExternalService | null>(null);

  warnBeforeLeaving(service: ExternalService): void {
    this.pendingService.set(service);
  }

  cancelNavigation(): void {
    this.pendingService.set(null);
  }
}
