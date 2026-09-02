import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getApiUrl, fetchApi } from '../lib/api';
import { 
  FileText, 
  UploadCloud, 
  Camera, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Calendar, 
  Car, 
  DollarSign, 
  Zap, 
  Utensils, 
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  ArrowLeft
} from 'lucide-react';
import { GkdMobilityLogo } from './GkdMobilityLogo';
import { takeNativePhoto } from '../services/nativeCameraService';

interface ExtractedData {
  detectedType?: string;
  detectedDate?: string;
  documentSummary?: string;
  kmRodado?: number;
  custoEnergia?: number;
  sobrouBateria?: number;
  app99_rides?: number;
  app99_earnings?: number;
  app99_bonus?: number;
  appUber_rides?: number;
  appUber_earnings?: number;
  appUber_bonus?: number;
  appParticular_rides?: number;
  appParticular_earnings?: number;
  carExpenses_wash?: number;
  carExpenses_toll?: number;
  carExpenses_maintenance?: number;
  carExpenses_parking?: number;
  carExpenses_other?: number;
  foodExpenses_lunch?: number;
  foodExpenses_dinner?: number;
  foodExpenses_snacks?: number;
  foodExpenses_coffee?: number;
  diariaCarro?: number;
  recompensasExtra?: number;
  outrasFontes?: number;
}

export interface ExtractedFixedExpense {
  id?: string;
  month?: number;
  year?: number;
  monthName?: string;
  description: string;
  value: number;
  installments?: string;
}

interface DocumentFeederModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onApplyExtractedData: (data: ExtractedData, targetDate: string) => void;
  onApplyFixedExpenses?: (month: number, year: number, expenses: { id: string; name: string; value: number; installments?: string }[]) => void;
  onOpenExcelImport?: () => void;
  carProfile?: {
    vehicleType: 'eletrico' | 'combustao';
    batteryCapacityKwh: number;
    kwhCostRate: number;
    monthlyCarExpense?: number;
  };
  defaultDate?: string;
}

export const DocumentFeederModal: React.FC<DocumentFeederModalProps> = ({
  isOpen,
  onClose,
  onBack,
  onApplyExtractedData,
  onApplyFixedExpenses,
  onOpenExcelImport,
  carProfile,
  defaultDate
}) => {
  const [selectedFiles, setSelectedFiles] = useState<{ id: string; file: File; preview: string; base64: string; mimeType: string }[]>([]);
  const [pastedText, setPastedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedDataList, setExtractedDataList] = useState<ExtractedData[] | null>(null);
  const [extractedFixedExpenses, setExtractedFixedExpenses] = useState<ExtractedFixedExpense[]>([]);
  const [fixedExpensesMonth, setFixedExpensesMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [fixedExpensesYear, setFixedExpensesYear] = useState<number>(() => new Date().getFullYear());
  const [fixedExpensesTotal, setFixedExpensesTotal] = useState<number>(0);
  const [isFixedExpensesSaved, setIsFixedExpensesSaved] = useState<boolean>(false);
  const [targetDate, setTargetDate] = useState<string>(() => {
    if (defaultDate) return defaultDate;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [previewModalFile, setPreviewModalFile] = useState<{ name: string; url: string; mimeType: string } | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  const startCamera = async (facing: 'environment' | 'user' = cameraFacingMode) => {
    setErrorMsg(null);
    stopCamera();

    // Se estiver rodando dentro do aplicativo nativo (APK / Capacitor), usa exclusivamente a câmera nativa do SO
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      try {
        const photo = await takeNativePhoto(facing === 'environment' ? 'REAR' : 'FRONT');
        if (photo) {
          handleFileSelect([photo] as any);
        }
      } catch (err) {
        console.error("Erro ao usar câmera nativa:", err);
        setErrorMsg("Não foi possível acessar a câmera nativa.");
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg("API de câmera não disponível ou bloqueada neste navegador/dispositivo.");
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facing } 
        });
      }
      setCameraStream(stream);
      setCameraActive(true);
      setCameraFacingMode(facing);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => console.error(err));
        }
      }, 100);
    } catch (err) {
      console.error(err);
      const photo = await takeNativePhoto(facing === 'environment' ? 'REAR' : 'FRONT');
      if (photo) {
        handleFileSelect([photo] as any);
      }
    }
  };

  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    await startCamera(nextFacing);
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
            stopCamera();
            handleFileSelect([file] as any);
          }
        }, 'image/jpeg', 0.95);
      }
    } catch (err) {
      console.error(err);
      stopCamera();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in a specific input (except our own maybe)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Only allow if it's our textarea, actually we don't need to prevent default, just let the textarea handle it natively,
        // or we can catch it here if we want to handle images pasted into textarea.
      }

      const items = e.clipboardData?.items;
      if (items) {
        const files: File[] = [];
        let hasText = false;
        
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file') {
            const file = items[i].getAsFile();
            if (file) files.push(file);
          } else if (items[i].kind === 'string' && items[i].type === 'text/plain') {
            hasText = true;
            items[i].getAsString((text) => {
              if (text.trim()) {
                setPastedText(prev => prev ? prev + '\n' + text : text);
              }
            });
          }
        }
        
        if (files.length > 0) {
          const dt = new DataTransfer();
          files.forEach(f => dt.items.add(f));
          handleFileSelect(dt.files);
        }
      }
    };
    
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const compressAndConvertFile = async (file: File): Promise<{ base64: string; preview: string; mimeType: string }> => {
    return new Promise((resolve) => {
      // Non-image files like PDFs
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          resolve({
            base64: reader.result as string,
            preview: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="10" y="50" font-size="12">Document</text></svg>`,
            mimeType: file.type || 'application/octet-stream'
          });
        };
        reader.onerror = () => {
          resolve({
            base64: '',
            preview: '',
            mimeType: file.type || 'application/octet-stream'
          });
        };
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve({
            base64: compressedDataUrl,
            preview: compressedDataUrl,
            mimeType: 'image/jpeg'
          });
        } else {
          // Fallback to standard reader
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve({
            base64: reader.result as string,
            preview: reader.result as string,
            mimeType: file.type || 'image/jpeg'
          });
        }
      };
      img.onerror = () => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({
          base64: reader.result as string,
          preview: reader.result as string,
          mimeType: file.type || 'image/jpeg'
        });
      };
    });
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setIsSavedSuccess(false);

    const newFilesList: { id: string; file: File; preview: string; base64: string; mimeType: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Special handling for Excel files
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv') || fileName.endsWith('.ods')) {
        if (onOpenExcelImport) {
          setErrorMsg('Arquivo Excel detectado! O Assistente de IA processa apenas imagens/prints. Redirecionando para o Importador de Planilhas especializado...');
          setTimeout(() => {
            onOpenExcelImport();
            onClose();
          }, 2000);
          return;
        } else {
          setErrorMsg('Arquivos Excel devem ser importados pelo botão de "Planilha" no cabeçalho.');
          continue;
        }
      }

      const { base64, preview, mimeType } = await compressAndConvertFile(file);
      if (base64) {
        newFilesList.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          preview,
          base64,
          mimeType
        });
      }
    }

    setSelectedFiles(prev => [...prev, ...newFilesList]);
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      return filtered;
    });
  };

  const handleProcessDocuments = async () => {
    if (selectedFiles.length === 0 && !pastedText.trim()) {
      setErrorMsg('Adicione pelo menos uma foto, print ou cole dados de texto para processar.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setIsSavedSuccess(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 90000); // 90 seconds timeout

    try {
      const imagesPayload = selectedFiles.map(f => ({
        imageBase64: f.base64,
        mimeType: f.mimeType
      }));

      const response = await fetchApi('/api/extract-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ 
          images: imagesPayload,
          textData: pastedText.trim() ? pastedText : undefined
        })
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao processar imagens com a Inteligência Artificial.');
      }

      const payload = await response.json();
      const dataList: ExtractedData[] = payload.results || (payload.detectedType ? [payload] : []);
      
      setExtractedDataList(dataList);

      // Extract fixed expenses if present
      if (payload.fixedExpenses && Array.isArray(payload.fixedExpenses) && payload.fixedExpenses.length > 0) {
        const mappedFixed = payload.fixedExpenses.map((fe: any, idx: number) => ({
          id: fe.id || `fe-${Date.now()}-${idx}`,
          month: fe.month || payload.fixedExpensesMonth || (new Date().getMonth() + 1),
          year: fe.year || payload.fixedExpensesYear || (new Date().getFullYear()),
          monthName: fe.monthName,
          description: fe.description || 'Despesa do Veículo',
          value: typeof fe.value === 'number' ? fe.value : (parseFloat(fe.value) || 0),
          installments: fe.installments || ''
        }));
        setExtractedFixedExpenses(mappedFixed);
        const m = payload.fixedExpensesMonth || mappedFixed[0]?.month || (new Date().getMonth() + 1);
        const y = payload.fixedExpensesYear || mappedFixed[0]?.year || (new Date().getFullYear());
        setFixedExpensesMonth(m);
        setFixedExpensesYear(y);
        const total = payload.fixedExpensesTotal || mappedFixed.reduce((acc: number, item: any) => acc + (item.value || 0), 0);
        setFixedExpensesTotal(total);
      } else {
        setExtractedFixedExpenses([]);
      }

      // If AI detected a specific date for the first item, set target date
      if (dataList.length > 0 && dataList[0].detectedDate && /^\d{4}-\d{2}-\d{2}$/.test(dataList[0].detectedDate)) {
        setTargetDate(dataList[0].detectedDate);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || '';
      if (err.name === 'AbortError') {
        setErrorMsg('Tempo limite de 90 segundos excedido ao processar os documentos. Tente enviar menos fotos por vez.');
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        setErrorMsg('Não foi possível conectar ao servidor de Inteligência Artificial GKD. Verifique se seu celular está conectado à internet e tente novamente.');
      } else {
        setErrorMsg(msg || 'Falha ao conectar com o serviço de Inteligência Artificial.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyFixedExpensesToApp = () => {
    if (!extractedFixedExpenses || extractedFixedExpenses.length === 0 || !onApplyFixedExpenses) return;

    const formatted = extractedFixedExpenses.map((fe, idx) => ({
      id: fe.id || `fe-${Date.now()}-${idx}`,
      name: fe.description,
      value: fe.value,
      installments: fe.installments
    }));

    onApplyFixedExpenses(fixedExpensesMonth, fixedExpensesYear, formatted);
    setIsFixedExpensesSaved(true);
  };

  const handleRemoveFixedExpenseItem = (index: number) => {
    const updated = extractedFixedExpenses.filter((_, idx) => idx !== index);
    setExtractedFixedExpenses(updated);
    const newTotal = updated.reduce((acc, item) => acc + (item.value || 0), 0);
    setFixedExpensesTotal(newTotal);
  };

  const handleUpdateFixedExpenseItem = (index: number, field: 'description' | 'value' | 'installments', val: any) => {
    const updated = [...extractedFixedExpenses];
    if (field === 'value') {
      updated[index].value = parseFloat(val) || 0;
    } else if (field === 'description') {
      updated[index].description = val;
    } else if (field === 'installments') {
      updated[index].installments = val;
    }
    setExtractedFixedExpenses(updated);
    const newTotal = updated.reduce((acc, item) => acc + (item.value || 0), 0);
    setFixedExpensesTotal(newTotal);
  };

  const handleSaveToApp = () => {
    if (extractedDataList && extractedDataList.length > 0) {
      extractedDataList.forEach((data) => {
        const dateToUse = (data.detectedDate && /^\d{4}-\d{2}-\d{2}$/.test(data.detectedDate)) 
          ? data.detectedDate 
          : targetDate;
        onApplyExtractedData(data, dateToUse);
      });
    }

    if (extractedFixedExpenses && extractedFixedExpenses.length > 0 && !isFixedExpensesSaved && onApplyFixedExpenses) {
      handleApplyFixedExpensesToApp();
    }
    
    setIsSavedSuccess(true);

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const calculateTotalEarnings = (data: ExtractedData) => {
    return (data.appUber_earnings || 0) + (data.app99_earnings || 0) + (data.appParticular_earnings || 0) + (data.recompensasExtra || 0) + (data.outrasFontes || 0);
  };

  const calculateTotalExpenses = (data: ExtractedData) => {
    const food = (data.foodExpenses_lunch || 0) + (data.foodExpenses_dinner || 0) + (data.foodExpenses_snacks || 0) + (data.foodExpenses_coffee || 0);
    const car = (data.carExpenses_wash || 0) + (data.carExpenses_toll || 0) + (data.carExpenses_maintenance || 0) + (data.carExpenses_parking || 0) + (data.carExpenses_other || 0);
    return (data.custoEnergia || 0) + (data.diariaCarro || 0) + food + car;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+24px)] bg-black/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-[#101014] border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1 bg-white border border-zinc-700/80 rounded-xl shadow-sm shrink-0">
              <GkdMobilityLogo size="xs" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100">
                  Assistente de Documentos & IA
                </h2>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                  OCR Automático
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Envie prints de faturamento ou fotos de comprovantes para alimentar o aplicativo automaticamente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* Upload Area */}
          {(!extractedDataList || extractedDataList.length === 0) && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-zinc-700/80 hover:border-indigo-500/60 bg-zinc-900/40 hover:bg-zinc-900/60 rounded-2xl p-6 sm:p-8 text-center transition-all">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
                    <UploadCloud className="w-7 h-7" />
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-zinc-200">
                      Reconhecimento Inteligente por Câmera & Galeria
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-lg mx-auto">
                      Tire fotos de <b>comprovantes de recarga</b>, <b>prints do Uber/99</b>, <b>painel com odômetro/bateria</b>, <b>notas de refeição</b> ou <b>tabelas do Excel</b>. Suporta múltiplos arquivos simultâneos.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                        📷 Câmera com OCR Alta Precisão
                      </span>
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                        ⚡ Otimização & Compressão Automática
                      </span>
                      <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                        📂 Várias Fotos em Lote
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 w-full max-w-md mx-auto pt-2 pb-2">
                    <div className="relative">
                      <div className="absolute -top-2.5 left-3 bg-zinc-900 px-2 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                        Copiar e Colar (Excel/Tabelas/Texto)
                      </div>
                      <textarea 
                        className="w-full h-24 bg-zinc-950/80 border-2 border-indigo-500/30 hover:border-indigo-500/60 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/80 resize-none transition-colors shadow-inner"
                        placeholder="Cole aqui textos copiados de planilhas Excel, tabelas ou relatórios financeiros..."
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                      ></textarea>
                    </div>

                    <div className="flex items-center gap-4 py-1">
                      <div className="h-px bg-zinc-800/80 flex-1"></div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">OU TIRE FOTOS / ENVIE ARQUIVOS</span>
                      <div className="h-px bg-zinc-800/80 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => startCamera('environment')}
                        className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center justify-center gap-2 border border-emerald-400/40"
                      >
                        <Camera className="w-5 h-5 text-emerald-100" />
                        <span>Abrir Câmera Tela Cheia</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold rounded-xl text-xs transition-all border border-zinc-700 hover:border-indigo-500/50 cursor-pointer flex items-center justify-center gap-2 shadow-md"
                      >
                        <FileText className="w-5 h-5 text-indigo-400" />
                        <span>Galeria / Várias Fotos</span>
                      </button>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                </div>
              </div>

              {/* Selected Files Preview List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">
                      Documentos Anexados ({selectedFiles.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-xs text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      Limpar todos
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {selectedFiles.map((fileItem) => (
                      <div 
                        key={fileItem.id} 
                        onClick={() => {
                          const isPdf = fileItem.mimeType === 'application/pdf' || fileItem.file.name.toLowerCase().endsWith('.pdf');
                          setPreviewModalFile({
                            name: fileItem.file.name,
                            url: fileItem.base64 || fileItem.preview,
                            mimeType: isPdf ? 'application/pdf' : (fileItem.mimeType || 'image/jpeg')
                          });
                        }}
                        className="relative group rounded-xl overflow-hidden border border-zinc-800 hover:border-emerald-500/50 bg-zinc-900 aspect-video sm:aspect-square flex items-center justify-center p-1 cursor-pointer transition-all hover:scale-[1.02]"
                      >
                        {fileItem.mimeType === 'application/pdf' || fileItem.file.name.toLowerCase().endsWith('.pdf') ? (
                          <div className="flex flex-col items-center justify-center text-center p-2">
                            <FileText className="w-8 h-8 text-rose-400 mb-1 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-semibold text-zinc-300 truncate max-w-[100px]">{fileItem.file.name}</span>
                            <span className="text-[9px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                              <Eye className="w-2.5 h-2.5 text-rose-400" /> Ver PDF
                            </span>
                          </div>
                        ) : (
                          <img 
                            src={fileItem.preview} 
                            alt={fileItem.file.name || "Pré-visualização do documento"} 
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              // If image fails to render preview, show a fallback icon
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-zinc-200 truncate font-medium flex items-center justify-between">
                            <span className="truncate">{fileItem.file.name}</span>
                            <Eye className="w-3 h-3 text-emerald-400 shrink-0 ml-1" />
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(fileItem.id);
                          }}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/75 hover:bg-rose-600 text-zinc-200 hover:text-white rounded-lg transition-all cursor-pointer shadow-md z-10"
                          title="Remover este anexo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Extracted Fixed Expenses Panel */}
          {extractedFixedExpenses && extractedFixedExpenses.length > 0 && (
            <div className="space-y-4 p-4 sm:p-5 bg-gradient-to-r from-sky-950/40 via-zinc-900 to-zinc-900 border border-sky-500/30 rounded-2xl animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                      <span>Despesas Fixas do Veículo Reconhecidas</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono">
                        {extractedFixedExpenses.length} item(ns)
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-400">
                      Identificamos custos mensais do carro (financiamento, seguro, taxas, etc.).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 shrink-0">
                  <Calendar className="w-4 h-4 text-sky-400" />
                  <span className="text-[10px] text-zinc-400 font-medium">Mês:</span>
                  <select
                    value={fixedExpensesMonth}
                    onChange={(e) => setFixedExpensesMonth(Number(e.target.value))}
                    className="bg-transparent text-xs font-bold text-sky-300 focus:outline-none cursor-pointer"
                  >
                    {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((mName, mIdx) => (
                      <option key={mIdx + 1} value={mIdx + 1} className="bg-zinc-900 text-zinc-200">
                        {mName}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={fixedExpensesYear}
                    onChange={(e) => setFixedExpensesYear(Number(e.target.value))}
                    className="w-14 bg-transparent text-xs font-bold text-sky-300 focus:outline-none"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {extractedFixedExpenses.map((expense, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2.5 bg-zinc-950/70 border border-zinc-800/80 rounded-xl">
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <input
                        type="text"
                        value={expense.description}
                        onChange={(e) => handleUpdateFixedExpenseItem(idx, 'description', e.target.value)}
                        className="bg-transparent text-xs font-semibold text-zinc-200 focus:outline-none focus:border-b focus:border-sky-500 w-full"
                        placeholder="Nome da despesa..."
                      />
                      {expense.installments && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono shrink-0">
                          {expense.installments}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-400 font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={expense.value}
                        onChange={(e) => handleUpdateFixedExpenseItem(idx, 'value', e.target.value)}
                        className="w-24 bg-zinc-900 border border-zinc-800 focus:border-sky-500 rounded-lg px-2 py-1 text-xs font-mono font-bold text-sky-300 text-right focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFixedExpenseItem(idx)}
                        className="p-1 hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        title="Remover despesa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Fixed Expenses Footer & Totals */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800 bg-zinc-950/40 p-3 rounded-xl">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Total das Contas do Mês:</span>
                    <span className="font-mono font-black text-sky-400 text-sm">{formatMoney(fixedExpensesTotal)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Diária Estimada (Seg-Sáb):</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">{formatMoney(fixedExpensesTotal / 26)}/dia</span>
                  </div>
                </div>

                {onApplyFixedExpenses && (
                  <button
                    type="button"
                    onClick={handleApplyFixedExpensesToApp}
                    disabled={isFixedExpensesSaved}
                    className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                      isFixedExpensesSaved
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20'
                    }`}
                  >
                    {isFixedExpensesSaved ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Despesas Fixas Aplicadas!</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Aplicar no Mês de {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][fixedExpensesMonth - 1]}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Extracted Results Panel */}
          {extractedDataList && extractedDataList.length > 0 && (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100">
                      Processamento Concluído!
                    </h4>
                    <p className="text-xs text-zinc-400">
                      {extractedDataList.length} registro(s) encontrado(s). Revise antes de salvar.
                    </p>
                  </div>
                </div>
                
                {/* Fallback Target Date Selector for entries without a detected date */}
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 shrink-0">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] text-zinc-400 font-medium leading-tight">
                    Data Padrão:<br/>(se não detectada)
                  </span>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-emerald-300 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {extractedDataList.map((extractedData, index) => (
                <div key={index} className="space-y-4 pt-4 border-t-2 border-zinc-800/80 first:border-0 first:pt-0">
                  {/* Summary Header of Extracted Data */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-400">
                          Data do Registro:
                        </span>
                        <input
                          type="date"
                          value={extractedData.detectedDate || targetDate}
                          onChange={(e) => {
                            const newList = [...extractedDataList];
                            newList[index].detectedDate = e.target.value;
                            setExtractedDataList(newList);
                          }}
                          className="bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 rounded-lg px-2 py-1 text-xs font-bold text-indigo-300 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-300 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                      {extractedData.documentSummary || 'Sem resumo disponível.'}
                    </p>
                  </div>

                  {/* KPI Overview Pills */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-zinc-900/80 p-2 rounded-xl text-center border border-zinc-800/50">
                      <span className="text-[10px] text-zinc-400 block font-medium">Faturamento Total</span>
                      <span className="text-xs sm:text-sm font-bold text-emerald-400">
                        {formatMoney(calculateTotalEarnings(extractedData))}
                      </span>
                    </div>
                    <div className="bg-zinc-900/80 p-2 rounded-xl text-center border border-zinc-800/50">
                      <span className="text-[10px] text-zinc-400 block font-medium">Custos & Despesas</span>
                      <span className="text-xs sm:text-sm font-bold text-rose-400">
                        {formatMoney(calculateTotalExpenses(extractedData))}
                      </span>
                    </div>
                    <div className="bg-zinc-900/80 p-2 rounded-xl text-center border border-zinc-800/50">
                      <span className="text-[10px] text-zinc-400 block font-medium">Lucro Líquido Estimado</span>
                      <span className="text-xs sm:text-sm font-bold text-indigo-400">
                        {formatMoney(calculateTotalEarnings(extractedData) - calculateTotalExpenses(extractedData))}
                      </span>
                    </div>
                  </div>

              {/* Detailed Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Apps Earnings */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    Faturamento por Aplicativo
                  </span>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Uber ({extractedData.appUber_rides || 0} viagens):</span>
                      <span className="font-bold text-zinc-200">{formatMoney(extractedData.appUber_earnings)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">99 ({extractedData.app99_rides || 0} viagens):</span>
                      <span className="font-bold text-zinc-200">{formatMoney(extractedData.app99_earnings)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-zinc-400">Particular ({extractedData.appParticular_rides || 0} viagens):</span>
                      <span className="font-bold text-zinc-200">{formatMoney(extractedData.appParticular_earnings)}</span>
                    </div>
                  </div>
                </div>

                {/* Energy & Vehicle Operations */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Energia & Operacional
                  </span>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">KM Rodado detectado:</span>
                      <span className="font-bold text-zinc-200">{extractedData.kmRodado ? `${extractedData.kmRodado} KM` : 'Não informado'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Recarga / Combustível:</span>
                      <span className="font-bold text-zinc-200">{formatMoney(extractedData.custoEnergia)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-zinc-400">Bateria Restante (%):</span>
                      <span className="font-bold text-zinc-200">{extractedData.sobrouBateria ? `${extractedData.sobrouBateria}%` : 'Não informado'}</span>
                    </div>
                  </div>
                </div>

                {/* Food Expenses */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5" />
                    Alimentação
                  </span>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Almoço / Lanches unificados:</span>
                      <span className="font-bold text-zinc-200">{formatMoney(extractedData.foodExpenses_lunch)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Jantar:</span>
                      <span className="font-bold text-zinc-200">{formatMoney(extractedData.foodExpenses_dinner)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-zinc-400">Outros (Café/Lanches soltos):</span>
                      <span className="font-bold text-zinc-200">
                        {formatMoney((extractedData.foodExpenses_coffee || 0) + (extractedData.foodExpenses_snacks || 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Car Expenses */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5" />
                    Despesas do Carro & Diária
                  </span>

                  <div className="space-y-2 text-xs">
                    {(extractedData.diariaCarro !== undefined && extractedData.diariaCarro > 0) && (
                      <div className="flex justify-between items-center py-1 border-b border-zinc-800/60 bg-amber-500/10 px-2 rounded-lg -mx-1">
                        <span className="text-amber-300 font-semibold">Diária do Carro (Rateio):</span>
                        <span className="font-black text-amber-400 font-mono">{formatMoney(extractedData.diariaCarro)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Lavagem:</span>
                      <span className="font-bold text-zinc-200">{formatMoney(extractedData.carExpenses_wash)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Pedágios:</span>
                      <span className="font-bold text-zinc-200">{formatMoney(extractedData.carExpenses_toll)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-zinc-400">Outras Despesas:</span>
                      <span className="font-bold text-zinc-200">
                        {formatMoney((extractedData.carExpenses_maintenance || 0) + (extractedData.carExpenses_parking || 0) + (extractedData.carExpenses_other || 0))}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ))}
          </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSavedSuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Dados salvos e sincronizados com sucesso no aplicativo para o dia {targetDate}!</span>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div>
            {(!extractedDataList || extractedDataList.length === 0) ? (
              <span className="text-xs text-zinc-500">
                {selectedFiles.length > 0 ? `${selectedFiles.length} documento(s) pronto(s) para análise.` : 'Nenhum documento carregado.'}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setExtractedDataList(null);
                  setSelectedFiles([]);
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Escanear Outro Documento</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Cancelar
            </button>

            {(!extractedDataList || extractedDataList.length === 0) ? (
              <button
                type="button"
                onClick={handleProcessDocuments}
                disabled={(selectedFiles.length === 0 && !pastedText.trim()) || isProcessing}
                className={`px-5 py-2.5 font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer ${
                  (selectedFiles.length === 0 && !pastedText.trim()) || isProcessing
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processando Imagens com IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-indigo-200" />
                    <span>Analisar e Extrair Dados</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveToApp}
                disabled={isSavedSuccess}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Salvar e Alimentar Aplicativo</span>
              </button>
            )}
          </div>

        </div>

        {/* CAMERA MODE - TELA CHEIA */}
        {cameraActive && createPortal(
          <div className="fixed inset-0 z-[100000] bg-black flex flex-col justify-between overflow-hidden select-none">
            {/* Vídeo em Tela Cheia */}
            <video 
              ref={videoRef} 
              className="absolute inset-0 w-full h-full object-cover" 
              playsInline 
              muted 
              autoPlay
            />

            {/* Gradiente Superior para Controles */}
            <div className="relative z-10 w-full bg-gradient-to-b from-black/90 via-black/50 to-transparent p-4 sm:p-6 flex items-center justify-between">
              <button
                type="button"
                onClick={stopCamera}
                className="bg-black/60 hover:bg-black/80 backdrop-blur-md text-white font-bold px-4 py-2.5 rounded-full text-xs flex items-center gap-2 border border-white/20 transition-all cursor-pointer shadow-lg active:scale-95"
              >
                <X className="w-4 h-4 text-red-400" />
                <span>Fechar</span>
              </button>

              <div className="bg-emerald-950/80 backdrop-blur-md border border-emerald-500/40 px-3.5 py-1.5 rounded-full text-xs text-emerald-300 font-bold flex items-center gap-2 shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Câmera Ao Vivo ({cameraFacingMode === 'environment' ? 'Traseira' : 'Frontal'})</span>
              </div>

              <button
                type="button"
                onClick={toggleCameraFacing}
                className="bg-black/60 hover:bg-black/80 backdrop-blur-md text-white font-bold px-4 py-2.5 rounded-full text-xs flex items-center gap-2 border border-white/20 transition-all cursor-pointer shadow-lg active:scale-95"
                title="Virar Câmera"
              >
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Virar Câmera</span>
              </button>
            </div>

            {/* Moldura Guia de Enquadramento no Centro */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pointer-events-none">
              <div className="relative w-full max-w-sm aspect-[3/4] sm:aspect-[4/3] rounded-3xl border-2 border-dashed border-emerald-400/60 flex flex-col items-center justify-between p-4 shadow-2xl shadow-emerald-500/10">
                {/* Cantoneiras Brilhantes */}
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl"></div>
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl"></div>
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl"></div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl"></div>

                {/* Linha Laser de Scanner */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse shadow-lg shadow-emerald-400/80 my-auto"></div>

                <div className="bg-black/75 backdrop-blur-md px-4 py-2 rounded-2xl border border-emerald-500/30 text-center">
                  <p className="text-white text-xs font-bold">Enquadre o documento, recibo ou comprovante</p>
                  <p className="text-emerald-300 text-[11px] mt-0.5">A foto será adicionada e analisada automaticamente</p>
                </div>
              </div>
            </div>

            {/* Gradiente Inferior com Botão de Disparo */}
            <div className="relative z-10 w-full bg-gradient-to-t from-black/95 via-black/70 to-transparent p-6 sm:p-8 flex flex-col items-center gap-4">
              <div className="flex items-center justify-center gap-6 sm:gap-10 w-full max-w-md">
                {/* Botão Galeria */}
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    fileInputRef.current?.click();
                  }}
                  className="w-12 h-12 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95"
                  title="Abrir da Galeria"
                >
                  <UploadCloud className="w-5 h-5 text-emerald-400" />
                </button>

                {/* Botão Shutter Principal de Captura */}
                <button
                  type="button"
                  onClick={takePhoto}
                  className="w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex flex-col items-center justify-center gap-1 shadow-2xl shadow-emerald-500/50 border-4 border-white/90 transition-all cursor-pointer transform active:scale-90 hover:scale-105"
                  title="Tirar Foto e Anexar"
                >
                  <Camera className="w-8 h-8 text-zinc-950" />
                </button>

                {/* Botão Virar Câmera */}
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="w-12 h-12 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95"
                  title="Alternar Câmera"
                >
                  <RefreshCw className="w-5 h-5 text-emerald-400" />
                </button>
              </div>

              <span className="text-white text-xs font-black tracking-wide uppercase drop-shadow-md">
                Toque no botão para Tirar a Foto em Alta Definição
              </span>
            </div>
          </div>,
          document.body
        )}

        {/* Full Document / PDF Preview Modal */}
        {previewModalFile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#0e1117] border border-emerald-500/40 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5 truncate">
                  <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-sm font-bold text-zinc-100 truncate">{previewModalFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewModalFile(null)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 rounded-lg transition-all cursor-pointer"
                  title="Fechar Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 p-4 bg-zinc-950/80 overflow-auto flex items-center justify-center min-h-[400px]">
                {previewModalFile.mimeType === 'application/pdf' || previewModalFile.name.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewModalFile.url}
                    title={previewModalFile.name}
                    className="w-full h-[70vh] rounded-xl border border-zinc-800 bg-white"
                  />
                ) : (
                  <img
                    src={previewModalFile.url}
                    alt={previewModalFile.name}
                    className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg"
                  />
                )}
              </div>
              <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewModalFile(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
