import { Component, inject, output } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  imports: [],
  selector: 'app-topbar',
  styleUrl: './topbar.css',
  templateUrl: './topbar.html',
})
export class Topbar {
  readonly auth = inject(AuthService);
  readonly toggleAiDrawer = output<void>();
}
