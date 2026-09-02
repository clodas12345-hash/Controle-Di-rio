export const CLOUD_SHARED_URL = "https://ais-pre-sno7apz6fxtgjpabxlrnia-473118395752.us-west2.run.app";
export const CLOUD_DEV_URL = "https://ais-dev-sno7apz6fxtgjpabxlrnia-473118395752.us-west2.run.app";

export function isMobileOrNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:' ||
    window.location.protocol === 'ionic:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    Boolean((window as any).Capacitor?.isNativePlatform?.())
  );
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (isMobileOrNativeApp()) {
    return `${CLOUD_SHARED_URL}${cleanPath}`;
  }
  return cleanPath;
}

/**
 * Robust fetch that handles both Web (relative) and Android APK (Capacitor/WebView)
 * with automatic fallback between endpoints if one fails with network error.
 */
export async function fetchApi(path: string, options: RequestInit = {}): Promise<Response> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const isMobile = isMobileOrNativeApp();

  const candidates: string[] = [];

  if (isMobile) {
    // Android APK / Capacitor - Public Shared URL first, then Dev URL
    candidates.push(`${CLOUD_SHARED_URL}${cleanPath}`);
    candidates.push(`${CLOUD_DEV_URL}${cleanPath}`);
    candidates.push(cleanPath);
  } else {
    // Browser - Relative path first, then Public Shared URL
    candidates.push(cleanPath);
    candidates.push(`${CLOUD_SHARED_URL}${cleanPath}`);
    candidates.push(`${CLOUD_DEV_URL}${cleanPath}`);
  }

  let lastError: any = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url, options);
      
      // Se o endpoint retornou HTML (ex: index.html devido ao roteamento SPA ou erro do servidor),
      // ignoramos este candidato pois esperamos uma resposta em formato JSON.
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        console.warn(`[fetchApi] URL ${url} retornou HTML em vez de JSON. Ignorando fallback.`);
        continue;
      }

      if (response.ok || contentType.includes("application/json")) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[fetchApi] Falha ao tentar ${url}:`, err);
    }
  }

  throw lastError || new Error("Falha ao comunicar com o servidor de Inteligência Artificial. Verifique sua conexão com a internet.");
}

