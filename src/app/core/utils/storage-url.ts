export function getBrowserStorageUrl(storageUrl: string): string {
  try {
    const url = new URL(storageUrl);
    if (url.hostname === 'minio' && url.port === '9000') {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return storageUrl;
  }
  return storageUrl;
}
