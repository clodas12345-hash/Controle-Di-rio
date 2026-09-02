import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

/**
 * Tira uma foto usando a câmera nativa do Android/iOS através do Capacitor.
 * Se estiver no navegador/Web fallback, cria um input capture nativo ou usa Web Camera.
 */
export async function takeNativePhoto(direction: 'FRONT' | 'REAR' = 'FRONT'): Promise<File | null> {
  try {
    // 1. Se estiver rodando dentro do APK Android nativo (Capacitor)
    if (Capacitor.isNativePlatform()) {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        direction: direction === 'FRONT' ? CameraDirection.Front : CameraDirection.Rear,
        promptLabelHeader: 'Câmera',
        promptLabelCancel: 'Cancelar',
        promptLabelPhoto: 'Da Galeria',
        promptLabelPicture: 'Tirar Foto'
      });

      if (image.webPath) {
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const file = new File([blob], `camera_${Date.now()}.${image.format || 'jpg'}`, {
          type: blob.type || 'image/jpeg'
        });
        return file;
      }
    }
  } catch (error) {
    console.warn('Erro ao abrir Camera nativa do Capacitor:', error);
  }

  // 2. Fallback Web / PWA / Navegador: aciona via input HTML com capture nativo do SO
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = direction === 'FRONT' ? 'user' : 'environment';
    
    input.onchange = (e: any) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        resolve(files[0]);
      } else {
        resolve(null);
      }
    };

    // Caso o usuário cancele
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (!input.files || input.files.length === 0) {
            resolve(null);
          }
        }, 800);
      },
      { once: true }
    );

    input.click();
  });
}
