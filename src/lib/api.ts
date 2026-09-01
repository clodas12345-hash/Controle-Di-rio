export const CLOUD_BACKEND_URL = "https://ais-dev-sno7apz6fxtgjpabxlrnia-473118395752.us-west2.run.app";

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  // Always use the absolute deployed backend URL so WebView APKs (file://) can reach cloud APIs
  return `${CLOUD_BACKEND_URL}${cleanPath}`;
}
