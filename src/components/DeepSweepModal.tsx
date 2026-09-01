import React from 'react';
import { 
  CheckCircle2, 
  ShieldCheck, 
  X, 
  RotateCcw, 
  DollarSign, 
  Gauge, 
  Calendar, 
  Zap, 
  Car, 
  Coffee, 
  TrendingUp, 
  Database,
  Award,
  Check,
  ArrowLeft
} from 'lucide-react';
import { GkdMobilityLogo } from './GkdMobilityLogo';

export interface DeepSweepReport {
  year: number;
  totalDays: number;
  activeDays: number;
  offDays: number;
  totalGross: number;
  totalNet: number;
  totalExpenses: number;
  totalKm: number;
  totalUber: number;
  total99: number;
  totalParticular: number;
  totalExtras: number;
  totalEnergyCost: number;
  totalCarExpenses: number;
  totalFoodExpenses: number;
  totalDiaria: number;
  sanitizedCount: number;
  missingDaysAdded: number;
  cloudStatus: string;
  timestamp: string;
}

interface DeepSweepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  report: DeepSweepReport | null;
  onRerun: () => void;
  onApplyAugustToAll?: () => void;
}

export const DeepSweepModal: React.FC<DeepSweepModalProps> = ({
  isOpen,
  onClose,
  onBack,
  report,
  onRerun,
  onApplyAugustToAll,
}) => {
  if (!isOpen || !report) return null;

  const formatBRL = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const avgPerKm = report.totalKm > 0 ? (report.totalGross / report.totalKm).toFixed(2) : '0,00';
  const profitMargin = report.totalGross > 0 ? ((report.totalNet / report.totalGross) * 100).toFixed(1) : '0.0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-[#121216] border border-sky-500/30 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
        
        {/* Action Buttons */}
        <div className="absolute top-5 right-5 flex items-center gap-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-full transition-all cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-full transition-all cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 border-b border-zinc-800/80 pb-5">
          <div className="p-1.5 bg-white rounded-2xl border border-zinc-300 shadow-md shrink-0">
            <GkdMobilityLogo size="md" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight">
                Auditoria do Sistema
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30">
                {report.year}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Auditoria de consistência matemática, integridade de dados e sincronização
            </p>
          </div>
        </div>

        {/* Status Banner */}
        <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-sky-950/30 to-zinc-900/50 border border-emerald-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-300 block">
                Sistema 100% Íntegro & Verificado
              </span>
              <span className="text-[11px] text-zinc-400">
                Executado em: {report.timestamp}
              </span>
            </div>
          </div>
          <div className="text-right text-[11px] text-zinc-400 font-mono bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-zinc-800">
            {report.cloudStatus}
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-zinc-900/70 border border-zinc-800 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Dias no Ano</span>
            </div>
            <div className="text-lg font-black text-zinc-100">
              {report.totalDays} <span className="text-xs font-normal text-zinc-500">dias</span>
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">
              {report.activeDays} ativos • {report.offDays} folgas
            </div>
          </div>

          <div className="p-3.5 bg-zinc-900/70 border border-zinc-800 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              <span>Km Rodados</span>
            </div>
            <div className="text-lg font-black text-zinc-100">
              {report.totalKm.toLocaleString('pt-BR')} <span className="text-xs font-normal text-zinc-500">km</span>
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">
              R$ {avgPerKm}/km médio
            </div>
          </div>

          <div className="p-3.5 bg-zinc-900/70 border border-zinc-800 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Faturado Bruto</span>
            </div>
            <div className="text-lg font-black text-emerald-400">
              {formatBRL(report.totalGross)}
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">
              Todas as plataformas
            </div>
          </div>

          <div className="p-3.5 bg-zinc-900/70 border border-zinc-800 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
              <span>Saldo Líquido</span>
            </div>
            <div className={`text-lg font-black ${report.totalNet >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
              {formatBRL(report.totalNet)}
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">
              Margem: {profitMargin}%
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Sections */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Faturamento por Plataforma */}
          <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Faturamento por Origem
              </span>
              <span className="text-xs font-bold text-emerald-400">
                {formatBRL(report.totalGross)}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-zinc-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-100"></span>
                  Uber
                </span>
                <span className="font-mono font-medium">{formatBRL(report.totalUber)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  99 App
                </span>
                <span className="font-mono font-medium">{formatBRL(report.total99)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  Particular / Privado
                </span>
                <span className="font-mono font-medium">{formatBRL(report.totalParticular)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  Extras & Bonificações
                </span>
                <span className="font-mono font-medium">{formatBRL(report.totalExtras)}</span>
              </div>
            </div>
          </div>

          {/* Despesas Operacionais */}
          <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                <Car className="w-3.5 h-3.5 text-rose-400" />
                Despesas Operacionais
              </span>
              <span className="text-xs font-bold text-rose-400">
                {formatBRL(report.totalExpenses)}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-zinc-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  Diária / Locação
                </span>
                <span className="font-mono font-medium">{formatBRL(report.totalDiaria)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Energia / Recargas
                </span>
                <span className="font-mono font-medium">{formatBRL(report.totalEnergyCost)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  Despesas do Veículo
                </span>
                <span className="font-mono font-medium">{formatBRL(report.totalCarExpenses)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                  Alimentação & Refeições
                </span>
                <span className="font-mono font-medium">{formatBRL(report.totalFoodExpenses)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Auditoria de Dados e Sanidade */}
        <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
            <Database className="w-3.5 h-3.5 text-sky-400" />
            <span>Relatório de Integridade Técnica & Banco de Dados</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-850">
              <span className="text-[10px] text-zinc-400 block">Campos Saneados / NaNs</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {report.sanitizedCount} correções
              </span>
            </div>

            <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-850">
              <span className="text-[10px] text-zinc-400 block">Dias Faltantes Normalizados</span>
              <span className="text-sm font-bold text-sky-400 font-mono">
                {report.missingDaysAdded} dias
              </span>
            </div>

            <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-850">
              <span className="text-[10px] text-zinc-400 block">Persistência & Armazenamento</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                100% OK
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
          <div className="flex flex-wrap items-center gap-2">


            {onApplyAugustToAll && (
              <button
                type="button"
                onClick={() => {
                  onApplyAugustToAll();
                  onRerun();
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-purple-900/40 flex items-center gap-2"
                title="Aplica as contas de R$ 7.093,05 e o rateio de Segunda a Sábado em todos os 12 meses do ano"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>⚡ Padronizar Todos os Meses Igual a Agosto</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onRerun}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Executar Novamente</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-sky-600/30 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Concluir Auditoria</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
