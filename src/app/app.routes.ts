import { Routes } from '@angular/router';
import { DashboardShell } from './layout/dashboard-shell/dashboard-shell';
import { PublicShell } from './layout/public-shell/public-shell';
import { authGuard, authMatchGuard } from './core/guards/auth.guard';
import { Intro } from './features/intro/intro';

export const routes: Routes = [
  {
    path: 'blog',
    component: DashboardShell,
    canMatch: [authMatchGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/blog/post-feed/post-feed').then((m) => m.PostFeed)
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./features/blog/post-create/post-create').then((m) => m.PostCreate)
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/blog/post-detail/post-detail').then((m) => m.PostDetail)
      }
    ]
  },
  {
    path: 'blog/new',
    component: DashboardShell,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/blog/post-create/post-create').then((m) => m.PostCreate)
      }
    ]
  },
  {
    path: '',
    component: PublicShell,
    children: [
      { path: '', component: Intro, pathMatch: 'full' },
      {
        path: 'blog',
        loadComponent: () =>
          import('./features/blog/post-feed/post-feed').then((m) => m.PostFeed)
      },
      {
        path: 'blog/:id',
        loadComponent: () =>
          import('./features/blog/post-detail/post-detail').then((m) => m.PostDetail)
      }
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
        path: 'admin/quiz/categories',
        data: { section: 'categories' },
        loadComponent: () =>
          import('./features/quizzes/admin-quiz-manager/admin-quiz-manager').then(
            (m) => m.AdminQuizManager
          )
      },
      {
        path: 'admin/quiz/quizzes',
        data: { section: 'quizzes' },
        loadComponent: () =>
          import('./features/quizzes/admin-quiz-manager/admin-quiz-manager').then(
            (m) => m.AdminQuizManager
          )
      },
      {
        path: 'admin/quiz/questions',
        data: { section: 'questions' },
        loadComponent: () =>
          import('./features/quizzes/admin-quiz-manager/admin-quiz-manager').then(
            (m) => m.AdminQuizManager
          )
      },
      {
        path: 'quizzes/:id',
        loadComponent: () =>
          import('./features/quizzes/quiz-take/quiz-take').then(
            (m) => m.QuizTake
          )
      },
      {
        path: 'books',
        loadComponent: () =>
          import('./features/books/book-catalog/book-catalog').then((m) => m.BookCatalog)
      },
      {
        path: 'books/new',
        loadComponent: () =>
          import('./features/books/book-create/book-create').then((m) => m.BookCreate)
      },
      {
        path: 'media',
        loadComponent: () =>
          import('./features/media/video-classroom/video-classroom').then((m) => m.VideoClassroom)
      },
      {
        path: 'blog',
        loadComponent: () =>
          import('./features/blog/post-feed/post-feed').then((m) => m.PostFeed)
      },
      {
        path: 'blog/new',
        loadComponent: () =>
          import('./features/blog/post-create/post-create').then((m) => m.PostCreate)
      },
      {
        path: 'blog/:id',
        loadComponent: () =>
          import('./features/blog/post-detail/post-detail').then((m) => m.PostDetail)
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
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password').then(
            (m) => m.ResetPassword
          )
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '' }
];
