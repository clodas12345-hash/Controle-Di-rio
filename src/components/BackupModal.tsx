import React, { useState } from 'react';
import { X, FileSpreadsheet, Calendar as CalendarIcon, Download, ArrowLeft } from 'lucide-react';
import { GkdMobilityLogo } from './GkdMobilityLogo';

export function BackupModal({ 
  isOpen, 
  onClose,
  onBack,
  onExport 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onBack?: () => void;
  onExport: (type: 'total' | 'period', startDate?: string, endDate?: string) => void;
}) {
  const [exportType, setExportType] = useState<'total' | 'period'>('total');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0a0b] w-full max-w-sm rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-zinc-900/30">
          <div className="flex items-center gap-3">
            <div className="p-1 bg-white border border-zinc-700/80 rounded-xl shadow-sm shrink-0">
              <GkdMobilityLogo size="xs" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Exportar Backup</h3>
              <p className="text-[11px] text-zinc-400">Gere uma planilha Excel (.csv)</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onBack && (
              <button 
                onClick={onBack}
                className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg transition-colors cursor-pointer"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          
          <div className="space-y-3">
            <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">Tipo de Exportação</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportType('total')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${exportType === 'total' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span className="text-xs font-bold">Total Geral</span>
              </button>
              <button
                type="button"
                onClick={() => setExportType('period')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${exportType === 'period' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
              >
                <CalendarIcon className="w-5 h-5" />
                <span className="text-xs font-bold">Por Período</span>
              </button>
            </div>
          </div>

          {exportType === 'period' && (
            <div className="space-y-3 pt-2">
              <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">Selecione o Período</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500">Data Inicial</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg text-xs py-2 px-2.5 font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500">Data Final</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg text-xs py-2 px-2.5 font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Download do Ícone icon2.png */}
          <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <img 
                src="/icon2.png" 
                alt="Ícone do App" 
                className="w-10 h-10 rounded-xl object-cover border border-zinc-700 shadow-md"
              />
              <div>
                <span className="text-xs font-bold text-zinc-200 block">Ícone do App</span>
                <span className="text-[10px] text-zinc-400 font-mono">icon2.png</span>
              </div>
            </div>
            <a
              href="/icon2.png"
              download="icon2.png"
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar</span>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/30 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (exportType === 'period' && (!startDate || !endDate)) {
                alert('Selecione as datas inicial e final.');
                return;
              }
              if (exportType === 'period' && (startDate > endDate)) {
                alert('A data inicial não pode ser maior que a data final.');
                return;
              }
              onExport(exportType, startDate, endDate);
              onClose();
            }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>
    </div>
  );
}
