import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Plus, RefreshCw, CheckCircle, ShieldCheck, ArrowLeft, X } from 'lucide-react';
import { GkdMobilityLogo } from './GkdMobilityLogo';

export interface ConflictItem {
  key: string;
  label: string;
  category: string;
  currentValue: number | string;
  newValue: number | string;
  isNumber: boolean;
  chosenAction: 'replace' | 'sum' | 'keep';
}

interface ConflictResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  targetDate: string;
  conflicts: ConflictItem[];
  onConfirm: (resolvedDecisions: Record<string, 'replace' | 'sum' | 'keep'>) => void;
}

export const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({
  isOpen,
  onClose,
  onBack,
  targetDate,
  conflicts,
  onConfirm
}) => {
  const [decisions, setDecisions] = useState<Record<string, 'replace' | 'sum' | 'keep'>>(() => {
    const initial: Record<string, 'replace' | 'sum' | 'keep'> = {};
    conflicts.forEach(c => {
      initial[c.key] = c.chosenAction || 'replace';
    });
    return initial;
  });

  if (!isOpen || conflicts.length === 0) return null;

  const setDecisionForAll = (action: 'replace' | 'sum' | 'keep') => {
    const updated: Record<string, 'replace' | 'sum' | 'keep'> = {};
    conflicts.forEach(c => {
      // If it's not a number, 'sum' doesn't make sense -> default to 'replace'
      if (action === 'sum' && !c.isNumber) {
        updated[c.key] = 'replace';
      } else {
        updated[c.key] = action;
      }
    });
    setDecisions(updated);
  };

  const handleToggleDecision = (key: string, action: 'replace' | 'sum' | 'keep') => {
    setDecisions(prev => ({
      ...prev,
      [key]: action
    }));
  };

  const handleApply = () => {
    onConfirm(decisions);
  };

  const formatDisplay = (val: number | string, isNumber: boolean) => {
    if (isNumber && typeof val === 'number') {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return String(val);
  };

  const [y, m, d] = targetDate ? targetDate.split('-') : ['', '', ''];
  const formattedDateStr = (d && m && y) ? `${d}/${m}/${y}` : targetDate;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#12141a] border border-amber-500/40 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-950 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-1 bg-white border border-zinc-700/80 rounded-xl shadow-sm shrink-0">
              <GkdMobilityLogo size="xs" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-zinc-100 flex items-center gap-2">
                <span>Conflito de Lançamento</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Dia {formattedDateStr}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Campos com valores diferentes foram detectados para esta data. Escolha se deseja <b>Substituir</b> ou <b>Somar</b>:
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="px-5 py-2.5 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-zinc-400 font-medium">Aplicar a todos os campos:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDecisionForAll('replace')}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border border-zinc-700"
            >
              Substituir Todos
            </button>
            <button
              type="button"
              onClick={() => setDecisionForAll('sum')}
              className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border border-emerald-500/40"
            >
              Somar Todos
            </button>
            <button
              type="button"
              onClick={() => setDecisionForAll('keep')}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border border-zinc-700"
            >
              Manter Atual
            </button>
          </div>
        </div>

        {/* Conflicts List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 max-h-[50vh]">
          {conflicts.map((item) => {
            const currentDec = decisions[item.key] || 'replace';
            const numCurrent = typeof item.currentValue === 'number' ? item.currentValue : parseFloat(String(item.currentValue)) || 0;
            const numNew = typeof item.newValue === 'number' ? item.newValue : parseFloat(String(item.newValue)) || 0;
            const sumVal = item.isNumber ? (numCurrent + numNew) : numNew;

            return (
              <div 
                key={item.key} 
                className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-3 transition-all hover:border-zinc-700"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-200">{item.label}</span>
                    <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md uppercase font-semibold">
                      {item.category}
                    </span>
                  </div>
                </div>

                {/* Values comparison box */}
                <div className="grid grid-cols-3 gap-2 bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800/80 text-center items-center">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-zinc-400 font-medium">No App (Atual)</span>
                    <span className="text-xs font-bold text-zinc-300">
                      {formatDisplay(item.currentValue, item.isNumber)}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center text-zinc-600">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-amber-400 font-medium">Novo Detectado</span>
                    <span className="text-xs font-bold text-amber-300">
                      {formatDisplay(item.newValue, item.isNumber)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons for this item */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleToggleDecision(item.key, 'replace')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer border ${
                      currentDec === 'replace'
                        ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border-zinc-700'
                    }`}
                  >
                    <span>Substituir</span>
                    <span className="text-[9px] font-normal opacity-80">
                      Novo ({formatDisplay(item.newValue, item.isNumber)})
                    </span>
                  </button>

                  {item.isNumber ? (
                    <button
                      type="button"
                      onClick={() => handleToggleDecision(item.key, 'sum')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer border ${
                        currentDec === 'sum'
                          ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                          : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border-zinc-700'
                      }`}
                    >
                      <span className="flex items-center gap-0.5">
                        <Plus className="w-3 h-3" /> Somar
                      </span>
                      <span className="text-[9px] font-normal opacity-80">
                        Total: {formatDisplay(sumVal, item.isNumber)}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-center text-[10px] text-zinc-600 italic">
                      (Não somável)
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleDecision(item.key, 'keep')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer border ${
                      currentDec === 'keep'
                        ? 'bg-zinc-700 text-zinc-100 border-zinc-500 shadow-md'
                        : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border-zinc-700'
                    }`}
                  >
                    <span>Manter Atual</span>
                    <span className="text-[9px] font-normal opacity-80">
                      Não alterar
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Confirmar e Salvar Lançamento</span>
          </button>
        </div>

      </div>
    </div>
  );
};
