import React, { useState } from 'react';
import { getApiUrl, fetchApi } from '../lib/api';
import { 
  ClipboardPaste, 
  Sparkles, 
  Trash2, 
  Plus, 
  Check, 
  Calendar, 
  Info,
  X,
  ArrowLeft,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { GkdMobilityLogo } from './GkdMobilityLogo';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface PasteFixedExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  selectedMonth: number;
  selectedYear: number;
  onApplyFixedExpenses: (month: number, year: number, expenses: { id: string; name: string; value: number; installments?: string }[]) => void;
  existingExpensesCount?: number;
}

export const PasteFixedExpensesModal: React.FC<PasteFixedExpensesModalProps> = ({
  isOpen,
  onClose,
  onBack,
  selectedMonth,
  selectedYear,
  onApplyFixedExpenses,
  existingExpensesCount = 0,
}) => {
  const [pastedText, setPastedText] = useState('');
  const [targetMonth, setTargetMonth] = useState(selectedMonth);
  const [targetYear, setTargetYear] = useState(selectedYear);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<Array<{ id: string; name: string; value: number; installments?: string }>>([]);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  if (!isOpen) return null;

  const handleQuickPasteSample = () => {
    const sample = `Financiamento BYD Dolphin Mini\t2.450,00\t15/60
Seguro Auto Completo / Cooperativa\t480,00\t
DAS MEI Mensal\t75,00\t
IPVA & Licenciamento Anual\t320,00\t3/5
WashPass Lavagem Ilimitada\t129,90\t
ConectCar / Sem Parar Tag\t45,00\t
Rastreador Ituran / Tracker\t89,90\t
Plano Celular 5G Motorista\t69,90\t
Reserva Manutenção Preventiva\t500,00\t
Troca de Pneus Parcelado\t250,00\t2/4`;
    setPastedText(sample);
    setErrorMsg(null);
  };

  const handleProcessText = async () => {
    if (!pastedText.trim()) {
      setErrorMsg('Cole o texto, tabela do Excel ou lista de contas antes de analisar.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const response = await fetchApi('/api/extract-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          textData: pastedText.trim(),
          text: pastedText.trim()
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao processar o texto com o assistente.');
      }

      const payload = await response.json();
      
      let items: Array<{ id: string; name: string; value: number; installments?: string }> = [];

      if (payload.fixedExpenses && Array.isArray(payload.fixedExpenses) && payload.fixedExpenses.length > 0) {
        items = payload.fixedExpenses.map((fe: any, idx: number) => ({
          id: `pfe-${Date.now()}-${idx}`,
          name: fe.description || fe.name || 'Despesa',
          value: typeof fe.value === 'number' ? fe.value : parseFloat(fe.value) || 0,
          installments: fe.installments || undefined
        }));

        if (payload.fixedExpensesMonth && payload.fixedExpensesMonth >= 1 && payload.fixedExpensesMonth <= 12) {
          setTargetMonth(payload.fixedExpensesMonth);
        }
        if (payload.fixedExpensesYear && payload.fixedExpensesYear >= 2020) {
          setTargetYear(payload.fixedExpensesYear);
        }
      } else {
        // Fallback: parse lines locally if AI didn't return fixedExpenses array
        const lines = pastedText.split('\n').map(l => l.trim()).filter(Boolean);
        lines.forEach((line, idx) => {
          // Check for tab or semicolon or colon separation
          const parts = line.includes('\t') ? line.split('\t') : line.includes(';') ? line.split(';') : line.split(/:\s*|\s*-\s*|\s*R\$\s*/);
          if (parts.length >= 2) {
            const desc = parts[0].trim();
            const valStr = parts[1].replace(/[R$\s.]/g, '').replace(',', '.');
            const val = parseFloat(valStr);
            const inst = parts[2]?.trim();
            if (desc && !isNaN(val) && val > 0) {
              items.push({
                id: `pfe-loc-${Date.now()}-${idx}`,
                name: desc,
                value: val,
                installments: inst || undefined
              });
            }
          }
        });
      }

      if (items.length === 0) {
        setErrorMsg('Nenhuma conta ou valor monetário foi identificado no texto. Verifique o formato e tente novamente.');
      } else {
        setParsedItems(items);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        setErrorMsg('Não foi possível conectar ao servidor de Inteligência Artificial GKD. Verifique se seu celular está conectado à internet e tente novamente.');
      } else {
        setErrorMsg(msg || 'Erro ao processar as informações.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateItem = (index: number, field: 'name' | 'value' | 'installments', val: any) => {
    setParsedItems(prev => {
      const copy = [...prev];
      if (field === 'value') {
        copy[index] = { ...copy[index], value: parseFloat(val) || 0 };
      } else {
        copy[index] = { ...copy[index], [field]: val };
      }
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddNewItem = () => {
    setParsedItems(prev => [
      ...prev,
      {
        id: `pfe-new-${Date.now()}`,
        name: 'Nova Conta',
        value: 0,
        installments: ''
      }
    ]);
  };

  const totalCalculated = parsedItems.reduce((acc, i) => acc + (i.value || 0), 0);

  const handleConfirmApply = () => {
    if (parsedItems.length === 0) return;
    onApplyFixedExpenses(targetMonth, targetYear, parsedItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="p-1 bg-white border border-zinc-700/80 rounded-xl shadow-sm shrink-0">
              <GkdMobilityLogo size="xs" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Copiar e Colar Contas & Despesas Fixas</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">
                  IA Automática
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Cole tabelas do Excel, mensagens do WhatsApp ou recibos para importar todas as contas de uma só vez.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Target Month & Year Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-950/60 border border-zinc-850 rounded-xl">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-zinc-300">Mês de Destino das Contas:</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(Number(e.target.value))}
                className="bg-zinc-900 border border-zinc-800 text-xs font-bold text-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(Number(e.target.value))}
                className="w-16 bg-zinc-900 border border-zinc-800 text-xs font-bold text-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Paste Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                <span>Cole aqui o texto ou tabela:</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickPasteSample}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  Exemplo de Tabela
                </button>
                {pastedText && (
                  <button
                    type="button"
                    onClick={() => { setPastedText(''); setParsedItems([]); setErrorMsg(null); }}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={5}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Exemplo de texto que você pode colar:&#10;Financiamento BYD: R$ 2.450,00 (15/60)&#10;Seguro Auto: R$ 480,00&#10;MEI / DAS: R$ 75,00&#10;IPVA: R$ 320,00&#10;Washpass: R$ 129,90"
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none font-mono resize-none transition-colors"
            />
          </div>

          {/* Process Button */}
          <div>
            <button
              type="button"
              onClick={handleProcessText}
              disabled={isProcessing || !pastedText.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Analisando e extraindo dados com IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Identificar e Estruturar Contas</span>
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Items Preview Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-zinc-800 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    <span>{parsedItems.length} Conta(s) Identificada(s)</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddNewItem}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Linha
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {parsedItems.map((item, idx) => (
                  <div key={item.id || idx} className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                        className="w-full bg-transparent text-xs font-bold text-zinc-100 focus:outline-none focus:border-b focus:border-indigo-500"
                        placeholder="Nome da despesa..."
                      />
                    </div>
                    <div className="w-24">
                      <input
                        type="text"
                        value={item.installments || ''}
                        onChange={(e) => handleUpdateItem(idx, 'installments', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500"
                        placeholder="Parcela (15/60)"
                      />
                    </div>
                    <div className="flex items-center gap-1 w-28">
                      <span className="text-xs text-zinc-500 font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.value || ''}
                        onChange={(e) => handleUpdateItem(idx, 'value', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-xs font-bold text-emerald-400 rounded px-1.5 py-0.5 font-mono text-right focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Remover linha"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-zinc-400 uppercase font-bold block">Total Somado das Contas</span>
                  <span className="text-lg font-black font-mono text-emerald-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCalculated)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-zinc-400 uppercase font-bold block">Rateio Diário (Seg-Sáb)</span>
                  <span className="text-xs font-extrabold font-mono text-purple-300">
                    ~ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCalculated / 26)} /dia útil
                  </span>
                </div>
              </div>

              {/* Import mode options */}
              {existingExpensesCount > 0 && (
                <div className="flex items-center gap-4 text-xs text-zinc-300 px-1 pt-1">
                  <span className="font-bold text-zinc-400">Modo de Importação:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Substituir as {existingExpensesCount} contas atuais de {MONTH_NAMES[targetMonth - 1]}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Adicionar às existentes</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmApply}
            disabled={parsedItems.length === 0}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-black rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Salvar {parsedItems.length} Contas em {MONTH_NAMES[targetMonth - 1]}/{targetYear}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
