import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
import { CopilotDrawer } from '../../features/ai-chat/copilot-drawer/copilot-drawer';

@Component({
  imports: [RouterOutlet, Sidebar, Topbar, CopilotDrawer],
  selector: 'app-dashboard-shell',
  styleUrl: './dashboard-shell.css',
  templateUrl: './dashboard-shell.html',
})
export class DashboardShell {
  readonly isAiDrawerOpen = signal<boolean>(false);

  toggleDrawer(): void {
    this.isAiDrawerOpen.update((open) => !open);
  }
}
