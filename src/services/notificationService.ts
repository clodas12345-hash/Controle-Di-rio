/**
 * Serviço de Notificações para Web, PWA e Android (Capacitor)
 */

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        return true;
      }
      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
    }
  } catch (error) {
    console.warn('Erro ao solicitar permissão de notificação:', error);
  }
  return false;
}

export function sendAppNotification(title: string, options?: { body?: string; icon?: string; tag?: string }) {
  try {
    // 1. Tenta notificação nativa do sistema/Android se permitido
    if ('Notification' in window && Notification.permission === 'granted') {
      const iconUrl = options?.icon || '/icon2.png';
      new Notification(title, {
        body: options?.body || '',
        icon: iconUrl,
        tag: options?.tag || 'gkd-controle-diario',
      });
      return;
    }
  } catch (error) {
    console.warn('Não foi possível disparar notificação de sistema:', error);
  }
}
