import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calculator, Check, ArrowLeft } from 'lucide-react';
import { GkdMobilityLogo } from './GkdMobilityLogo';

interface TollCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onApply: (total: number) => void;
  initialTotal: number;
}

export const TollCalculator: React.FC<TollCalculatorProps> = ({
  isOpen,
  onClose,
  onBack,
  onApply,
  initialTotal
}) => {
  const [values, setValues] = useState<string[]>([]);
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    if (isOpen && initialTotal > 0 && values.length === 0) {
      setValues([String(initialTotal)]);
    }
  }, [isOpen, initialTotal]);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!newValue) return;
    const val = newValue.replace(',', '.');
    if (!isNaN(parseFloat(val))) {
      setValues([...values, val]);
      setNewValue('');
    }
  };

  const handleRemove = (index: number) => {
    setValues(values.filter((_, i) => i !== index));
  };

  const total = values.reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);

  const handleApply = () => {
    onApply(total);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#11141a] border border-zinc-800 rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1 bg-white border border-zinc-700 rounded-lg shadow-sm shrink-0">
              <GkdMobilityLogo size="xs" />
            </div>
            <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Calculadora de Pedágios</h3>
          </div>
          <div className="flex items-center gap-1">
            {onBack && (
              <button onClick={onBack} className="p-1 text-zinc-500 hover:text-white transition-colors" title="Voltar">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors" title="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Valor (ex: 7,50)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl text-xs py-2 px-3 font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {values.length === 0 ? (
              <p className="text-[10px] text-zinc-500 text-center py-4 italic">Nenhum valor adicionado</p>
            ) : (
              values.map((val, idx) => (
                <div key={idx} className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/50 p-2 rounded-lg group">
                  <span className="text-xs font-mono text-zinc-300">R$ {parseFloat(val).toFixed(2).replace('.', ',')}</span>
                  <button 
                    onClick={() => handleRemove(idx)}
                    className="p-1 text-zinc-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Total</span>
            <span className="text-lg font-black text-emerald-400 font-mono">R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        <div className="p-4 bg-zinc-900/30 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
          >
            <Check className="w-3.5 h-3.5" />
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
