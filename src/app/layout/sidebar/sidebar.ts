import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

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
  readonly isCollapsed = input<boolean>(false);

  readonly navItems: NavItem[] = [
    { label: 'Overview', route: '/dashboard' },
    { label: 'Assessments', route: '/quizzes', badge: 'Active' },
    { label: 'Classroom Media', route: '/media' },
    { label: 'Academic Library', route: '/books' },
    { label: 'Community Feed', route: '/blog' }
  ];
}
