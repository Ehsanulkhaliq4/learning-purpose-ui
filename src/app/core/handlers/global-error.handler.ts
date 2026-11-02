import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const message = error?.message || (typeof error === 'string' ? error : '');

    // Check if error is due to chunk hash mismatch after a new build/deployment
    const isChunkFailed =
      /Failed to fetch dynamically imported module/i.test(message) ||
      /Loading chunk [\d]+ failed/i.test(message) ||
      /Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text\/html"/i.test(message);

    if (isChunkFailed) {
      const storageKey = 'last_chunk_reload_ts';
      const lastReload = Number(sessionStorage.getItem(storageKey) || '0');
      const now = Date.now();

      // Prevent reload loops if it happens within 10 seconds
      if (now - lastReload > 10000) {
        sessionStorage.setItem(storageKey, String(now));
        console.warn('Stale dynamic chunk detected. Reloading page to fetch latest application build...');
        window.location.reload();
        return;
      }
    }

    console.error('Unhandled Application Error:', error);
  }
}
