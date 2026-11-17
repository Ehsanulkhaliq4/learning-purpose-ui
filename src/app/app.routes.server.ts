import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'quizzes/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'blog/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'explore/:id',
    renderMode: RenderMode.Client
  },
  {
    // Conference rooms are guarded by the auth guard, which cannot run during
    // prerendering. Rendering on the client keeps invite links such as
    // /conference?room=meet-abc123 working instead of redirecting to the home page.
    path: 'conference',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
