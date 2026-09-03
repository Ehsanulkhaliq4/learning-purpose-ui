import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const isPublicAuthEndpoint = req.url.includes('/api/v1/auth/');

  let modifiedReq = req;
  if (token && !isPublicAuthEndpoint) {
    modifiedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isPostRead = req.method === 'GET' && req.url.includes('/api/v1/posts');
      if (error.status === 401 && !isPostRead) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};