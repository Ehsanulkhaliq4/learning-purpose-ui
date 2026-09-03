import { Routes } from '@angular/router';
import { DashboardShell } from './layout/dashboard-shell/dashboard-shell';
import { PublicShell } from './layout/public-shell/public-shell';
import { authGuard } from './core/guards/auth.guard';
import { Intro } from './features/intro/intro';

export const routes: Routes = [
  {
    path: '',
    component: PublicShell,
    children: [
      { path: '', component: Intro, pathMatch: 'full' }
    ]
  },
  {
    path: '',
    component: DashboardShell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/overview-metrics/overview-metrics').then(
            (m) => m.OverviewMetrics
          )
      },
      {
        path: 'quizzes',
        loadComponent: () =>
          import('./features/quizzes/quiz-table/quiz-table').then(
            (m) => m.QuizTable
          )
      },
      {
        path: 'quizzes/:id',
        loadComponent: () =>
          import('./features/quizzes/quiz-take/quiz-take').then(
            (m) => m.QuizTake
          )
      },
    ]
  },
  {
    path: 'auth',
    component: PublicShell,
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login').then((m) => m.Login)
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register-applicant/register-applicant').then(
            (m) => m.RegisterApplicant
          )
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '' }
];
