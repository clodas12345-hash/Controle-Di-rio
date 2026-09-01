import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Table,
  Calendar,
  DollarSign,
  TrendingUp,
  Search,
  Database,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { GkdMobilityLogo } from './GkdMobilityLogo';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onImportData: (logs: any[]) => void;
}

interface ParsedResult {
  sheetName: string;
  data: any[];
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onBack,
  onImportData
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ParsedResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{ datesFound: number; totalEarnings: number } | null>(null);
  const [mappingInfo, setMappingInfo] = useState<{[key: string]: any}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const parseExcel = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setResults([]);
    setImportSummary(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const allResults: ParsedResult[] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        // Use raw: true to get Date objects if cellDates: true is used
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null });
        if (jsonData.length > 0) {
          allResults.push({ sheetName, data: jsonData });
        }
      });

      setResults(allResults);
      processData(allResults);
    } catch (err) {
      console.error(err);
      setError('Erro ao ler o arquivo Excel. Verifique se o arquivo não está corrompido.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processData = (allResults: ParsedResult[]) => {
    const dailyLogsMap: { [date: string]: any } = {};
    let datesFound = 0;
    let totalEarnings = 0;
    const mappingInfo: {[key: string]: any} = {};

    allResults.forEach(sheet => {
      // Find the best header row (checking first 20 rows)
      let headerIdx = -1;
      let headerRow: any[] = [];
      
      for (let i = 0; i < Math.min(sheet.data.length, 20); i++) {
        const row = sheet.data[i];
        if (!row || !Array.isArray(row)) continue;
        // Search for at least two keywords to be sure it's a header
        const keywords = row.filter(cell => /data|date|dia|uber|99|total|ganho|km|período|valor|receita/i.test(String(cell)));
        if (keywords.length >= 2) {
          headerIdx = i;
          headerRow = row;
          break;
        }
      }

      // If no header found, use the first row as a fallback
      if (headerIdx === -1 && sheet.data.length > 0) {
        headerRow = sheet.data[0];
        headerIdx = 0;
      }
      
      // Find column indices with more robust patterns
      let dateIdx = headerRow.findIndex(h => /data|date|dia|período|periodo|vencimento|tempo/i.test(String(h)));
      const uberIdx = headerRow.findIndex(h => /uber|app1/i.test(String(h)));
      const app99Idx = headerRow.findIndex(h => /99|poup|pop|app2/i.test(String(h)));
      const totalIdx = headerRow.findIndex(h => /total|ganho|fatur|valor|receita|líquido|liquido|bruto|faturamento/i.test(String(h)));
      const kmIdx = headerRow.findIndex(h => /km|rodado|dist|quilom|odo|percorrido|distância|distancia/i.test(String(h)));

      // Fallback date detection
      if (dateIdx === -1) {
        for (let col = 0; col < headerRow.length; col++) {
          for (let r = headerIdx + 1; r < Math.min(sheet.data.length, headerIdx + 10); r++) {
            const cell = sheet.data[r]?.[col];
            if (cell && normalizeDate(cell)) {
              dateIdx = col;
              break;
            }
          }
          if (dateIdx !== -1) break;
        }
      }

      mappingInfo[sheet.sheetName] = {
        date: dateIdx !== -1 ? headerRow[dateIdx] : 'Não encontrada',
        uber: uberIdx !== -1 ? headerRow[uberIdx] : 'Não encontrada',
        app99: app99Idx !== -1 ? headerRow[app99Idx] : 'Não encontrada',
        total: totalIdx !== -1 ? headerRow[totalIdx] : 'Não encontrada',
        km: kmIdx !== -1 ? headerRow[kmIdx] : 'Não encontrada'
      };

      // Process rows (skipping header)
      for (let i = headerIdx + 1; i < sheet.data.length; i++) {
        const row = sheet.data[i] as any[];
        if (!row || row.length === 0 || row.every(c => c === null || c === undefined || String(c).trim() === '')) continue;

        let dateStr = '';
        if (dateIdx !== -1 && row[dateIdx] !== null && row[dateIdx] !== undefined) {
          dateStr = normalizeDate(row[dateIdx]);
        } else {
          // If no date column, try to find a date in any cell of the row
          const foundDate = row.find(cell => {
            if (cell instanceof Date) return true;
            if (typeof cell === 'number' && cell > 40000 && cell < 60000) return true; // Excel date serial number range
            const s = String(cell);
            return /^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{4}-\d{2}-\d{2}$|^\d{1,2}-\d{1,2}-\d{2,4}$/.test(s);
          });
          if (foundDate) dateStr = normalizeDate(foundDate);
        }

        if (dateStr) {
          if (!dailyLogsMap[dateStr]) {
            dailyLogsMap[dateStr] = {
              id: dateStr,
              date: dateStr,
              appUber: { earnings: 0, rides: 0, bonus: 0 },
              app99: { earnings: 0, rides: 0, bonus: 0 },
              appParticular: { earnings: 0, rides: 0 },
              kmRodado: 0,
              exibirNoGeral: true
            };
            datesFound++;
          }

          const log = dailyLogsMap[dateStr];

          // Extract earnings - prioritize specific apps
          let rowHasSpecificEarnings = false;

          if (uberIdx !== -1 && row[uberIdx] !== null) {
            const val = parseCurrency(row[uberIdx]);
            log.appUber.earnings += val;
            totalEarnings += val;
            if (val > 0) rowHasSpecificEarnings = true;
          }
          if (app99Idx !== -1 && row[app99Idx] !== null) {
            const val = parseCurrency(row[app99Idx]);
            log.app99.earnings += val;
            totalEarnings += val;
            if (val > 0) rowHasSpecificEarnings = true;
          }
          
          // If no specific app earnings found but a total is present, use the total
          if (totalIdx !== -1 && row[totalIdx] !== null && !rowHasSpecificEarnings) {
            const val = parseCurrency(row[totalIdx]);
            log.appUber.earnings += val;
            totalEarnings += val;
          }

          // Extract KM
          if (kmIdx !== -1 && row[kmIdx] !== null) {
            const kmVal = Math.round(parseCurrency(row[kmIdx]));
            log.kmRodado = Math.max(log.kmRodado, kmVal);
          }
        }
      }
    });

    if (datesFound === 0) {
      setError('Não foi possível identificar colunas de "Data" ou registros válidos nesta planilha. Verifique se o cabeçalho contém termos como "Data", "Uber", "Total" ou "KM".');
    }

    setMappingInfo(mappingInfo);
    setImportSummary({ datesFound, totalEarnings });
  };

  const normalizeDate = (val: any): string => {
    if (val === null || val === undefined) return '';
    
    // Handle JS Date object (from XLSX cellDates: true)
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return '';
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // Handle Excel Serial Number (e.g. 45170)
    if (typeof val === 'number') {
      try {
        const date = XLSX.SSF.parse_date_code(val);
        const y = date.y;
        const m = String(date.m).padStart(2, '0');
        const d = String(date.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      } catch (e) {
        return '';
      }
    }

    const str = String(val).trim();
    if (!str) return '';
    
    // Try DD/MM/YYYY or DD-MM-YYYY (or with spaces)
    const dmy = str.match(/(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2,4})/);
    if (dmy) {
      let y = dmy[3];
      if (y.length === 2) {
        const yearNum = parseInt(y, 10);
        y = (yearNum > 80 ? '19' : '20') + y;
      }
      const m = dmy[2].padStart(2, '0');
      const d = dmy[1].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // Try YYYY-MM-DD
    const ymd = str.match(/(\d{4})[\/\-\s](\d{2})[\/\-\s](\d{2})/);
    if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
    
    return '';
  };

  const parseCurrency = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    
    const str = String(val).trim();
    if (!str) return 0;
    
    // If it has a comma and no dots, or comma is after the last dot, it's likely PT-BR format
    const hasComma = str.includes(',');
    const hasDot = str.includes('.');
    
    if (hasComma && (!hasDot || str.indexOf(',') > str.lastIndexOf('.'))) {
      // PT-BR: 1.234,56 -> 1234.56
      const clean = str.replace(/[R$\s.]/g, '').replace(',', '.');
      return parseFloat(clean) || 0;
    } else {
      // EN or Clean: 1,234.56 or 1234.56 -> 1234.56
      const clean = str.replace(/[R$\s,]/g, '');
      return parseFloat(clean) || 0;
    }
  };

  const handleApply = () => {
    const dailyLogsMap: { [date: string]: any } = {};

    results.forEach(sheet => {
      // Find the best header row (checking first 20 rows)
      let headerIdx = -1;
      let headerRow: any[] = [];
      
      for (let i = 0; i < Math.min(sheet.data.length, 20); i++) {
        const row = sheet.data[i];
        if (!row || !Array.isArray(row)) continue;
        const keywords = row.filter(cell => /data|date|dia|uber|99|total|ganho|km|período|valor|receita/i.test(String(cell)));
        if (keywords.length >= 2) {
          headerIdx = i;
          headerRow = row;
          break;
        }
      }

      if (headerIdx === -1 && sheet.data.length > 0) {
        headerRow = sheet.data[0];
        headerIdx = 0;
      }

      // Use the same robust patterns as processData
      let dateIdx = headerRow.findIndex(h => /data|date|dia|período|periodo|vencimento|tempo/i.test(String(h)));
      const uberIdx = headerRow.findIndex(h => /uber|app1/i.test(String(h)));
      const app99Idx = headerRow.findIndex(h => /99|poup|pop|app2/i.test(String(h)));
      const totalIdx = headerRow.findIndex(h => /total|ganho|fatur|valor|receita|líquido|liquido|bruto|faturamento/i.test(String(h)));
      const kmIdx = headerRow.findIndex(h => /km|rodado|dist|quilom|odo|percorrido|distância|distancia/i.test(String(h)));

      // Fallback date detection
      if (dateIdx === -1) {
        for (let col = 0; col < headerRow.length; col++) {
          for (let r = headerIdx + 1; r < Math.min(sheet.data.length, headerIdx + 10); r++) {
            const cell = sheet.data[r]?.[col];
            if (cell && normalizeDate(cell)) {
              dateIdx = col;
              break;
            }
          }
          if (dateIdx !== -1) break;
        }
      }

      for (let i = headerIdx + 1; i < sheet.data.length; i++) {
        const row = sheet.data[i] as any[];
        if (!row || row.length === 0) continue;
        let dateStr = '';
        if (dateIdx !== -1 && row[dateIdx] !== null) {
          dateStr = normalizeDate(row[dateIdx]);
        } else {
          const foundDate = row.find(cell => {
            if (cell instanceof Date) return true;
            if (typeof cell === 'number' && cell > 40000 && cell < 60000) return true;
            const s = String(cell);
            return /^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{4}-\d{2}-\d{2}$|^\d{1,2}-\d{1,2}-\d{2,4}$/.test(s);
          });
          if (foundDate) dateStr = normalizeDate(foundDate);
        }

        if (dateStr) {
          if (!dailyLogsMap[dateStr]) {
            dailyLogsMap[dateStr] = {
              id: dateStr,
              date: dateStr,
              isDayOff: false,
              sobrouBateria: 0,
              valorKwh: 0,
              capacidadeBateria: 0,
              kmRodado: 0,
              custoEnergia: 0,
              diariaCarro: 0,
              carExpenses: { wash: 0, toll: 0, maintenance: 0, parking: 0, other: 0 },
              foodExpenses: { lunch: 0, dinner: 0, snacks: 0, coffee: 0 },
              app99: { rides: 0, earnings: 0, bonus: 0 },
              appUber: { rides: 0, earnings: 0, bonus: 0 },
              appParticular: { rides: 0, earnings: 0 },
              recompensasExtra: 0,
              outrasFontes: 0,
              exibirNoGeral: true
            };
          }
          const log = dailyLogsMap[dateStr];
          
          let rowHasSpecificEarnings = false;
          if (uberIdx !== -1 && row[uberIdx] !== null) {
            const val = parseCurrency(row[uberIdx]);
            log.appUber.earnings += val;
            if (val > 0) rowHasSpecificEarnings = true;
          }
          if (app99Idx !== -1 && row[app99Idx] !== null) {
            const val = parseCurrency(row[app99Idx]);
            log.app99.earnings += val;
            if (val > 0) rowHasSpecificEarnings = true;
          }
          if (totalIdx !== -1 && row[totalIdx] !== null && !rowHasSpecificEarnings) {
            log.appUber.earnings += parseCurrency(row[totalIdx]);
          }
          if (kmIdx !== -1 && row[kmIdx] !== null) {
            log.kmRodado = Math.max(log.kmRodado, Math.round(parseCurrency(row[kmIdx])));
          }
        }
      }
    });

    onImportData(Object.values(dailyLogsMap));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0f1115] border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1 bg-white border border-zinc-700/80 rounded-xl shadow-sm shrink-0">
              <GkdMobilityLogo size="xs" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Importação de Dados Excel</h2>
              <p className="text-[10px] text-zinc-400">Reconhecimento inteligente de planilhas e abas</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onBack && (
              <button onClick={onBack} className="p-2 text-zinc-400 hover:text-white rounded-lg transition-colors" title="Voltar">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-lg transition-colors" title="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {!results.length && !isProcessing ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-10 text-center transition-all cursor-pointer bg-zinc-900/20 group"
            >
              <div className="bg-emerald-500/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/10 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-emerald-500/80" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200 mb-2">Selecione sua planilha de controle</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                O sistema irá escanear todas as abas buscando datas, faturamento e quilometragem automaticamente.
              </p>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) parseExcel(file);
                }}
              />
            </div>
          ) : isProcessing ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-bold text-zinc-200">Processando Planilha...</p>
                <p className="text-[10px] text-zinc-500">Mapeando abas e analisando colunas de dados</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              {importSummary && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">Datas Encontradas</span>
                      <span className="text-lg font-black text-zinc-100">{importSummary.datesFound} dias</span>
                    </div>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">Total Mapeado</span>
                      <span className="text-lg font-black text-zinc-100">R$ {importSummary.totalEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs Found */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <Table className="w-3 h-3" /> Abas Detectadas ({results.length})
                </h3>
                
                <div className="space-y-3">
                  {results.map((res, idx) => (
                    <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span className="text-xs font-bold text-zinc-200">{res.sheetName}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">{res.data.length - 1} linhas</span>
                      </div>
                      
                      {mappingInfo[res.sheetName] && (
                        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                            <span className="text-[8px] text-zinc-500 uppercase block mb-1">Coluna Data</span>
                            <span className={`text-[10px] truncate block ${mappingInfo[res.sheetName].date === 'Não encontrada' ? 'text-rose-400' : 'text-zinc-300'}`}>
                              {mappingInfo[res.sheetName].date}
                            </span>
                          </div>
                          <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                            <span className="text-[8px] text-zinc-500 uppercase block mb-1">Coluna Uber</span>
                            <span className={`text-[10px] truncate block ${mappingInfo[res.sheetName].uber === 'Não encontrada' ? 'text-zinc-500' : 'text-zinc-300'}`}>
                              {mappingInfo[res.sheetName].uber}
                            </span>
                          </div>
                          <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                            <span className="text-[8px] text-zinc-500 uppercase block mb-1">Coluna 99</span>
                            <span className={`text-[10px] truncate block ${mappingInfo[res.sheetName].app99 === 'Não encontrada' ? 'text-zinc-500' : 'text-zinc-300'}`}>
                              {mappingInfo[res.sheetName].app99}
                            </span>
                          </div>
                          <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                            <span className="text-[8px] text-zinc-500 uppercase block mb-1">Coluna Total</span>
                            <span className={`text-[10px] truncate block ${mappingInfo[res.sheetName].total === 'Não encontrada' ? 'text-zinc-500' : 'text-zinc-300'}`}>
                              {mappingInfo[res.sheetName].total}
                            </span>
                          </div>
                          <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                            <span className="text-[8px] text-zinc-500 uppercase block mb-1">Coluna KM</span>
                            <span className={`text-[10px] truncate block ${mappingInfo[res.sheetName].km === 'Não encontrada' ? 'text-zinc-500' : 'text-zinc-300'}`}>
                              {mappingInfo[res.sheetName].km}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-200">Revisão de Importação</p>
                  <p className="text-[10px] text-amber-500/80 mt-0.5">
                    Se houver registros nas mesmas datas, os dados da planilha serão mesclados ou substituirão os existentes. 
                    Recomendamos conferir o histórico após a aplicação.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              <p className="text-xs text-rose-300 font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button 
            disabled={!results.length || isProcessing}
            onClick={handleApply}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
          >
            <ArrowRight className="w-4 h-4" />
            Aplicar Importação
          </button>
        </div>
      </div>
    </div>
  );
};
