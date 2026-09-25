import { Component, inject, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

export interface NavItem {
  label: string;
  route: string;
  badge?: string;
}

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-sidebar',
  styleUrl: './sidebar.css',
  templateUrl: './sidebar.html',
})
export class Sidebar {
  readonly auth = inject(AuthService);
  readonly isCollapsed = input<boolean>(false);
  readonly toggleAiDrawer = output<void>();
  readonly isMobileMenuOpen = signal(false);

  readonly navItems: NavItem[] = [
    { label: 'Overview', route: '/dashboard' },
    { label: 'Assessments', route: '/quizzes', badge: 'Active' },
    { label: 'Classroom Media', route: '/media' },
    { label: 'Academic Library', route: '/books' },
    { label: 'Community Feed', route: '/blog' }
  ];

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((open) => !open);
  }
}
