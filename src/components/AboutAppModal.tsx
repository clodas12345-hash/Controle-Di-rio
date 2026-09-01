import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Copy, 
  Car, 
  Zap, 
  PieChart, 
  Receipt, 
  Mic, 
  Sparkles,
  ShieldCheck,
  Cpu,
  FileText,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';
import { GkdMobilityLogo } from './GkdMobilityLogo';

interface AboutAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
}

export const AboutAppModal: React.FC<AboutAppModalProps> = ({ isOpen, onClose, onBack }) => {
  const [copied, setCopied] = useState(false);
  const appVersion = 'GKD_CD_V.1.0.0';
  const appDescription = 'Sistema completo de gestão operacional e financeira para motoristas de aplicativo. Acompanhamento diário de faturamento (Uber, 99, Particular), cálculo de custos por KM/energia/combustível, gestão de despesas fixas, projeção de metas e relatórios analíticos integrados.';

  if (!isOpen) return null;

  const handleCopyVersion = () => {
    navigator.clipboard.writeText(appVersion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+24px)] bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#0e1117] border border-emerald-500/30 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header with gradient banner */}
        <div className="relative px-6 py-6 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-900 via-zinc-950 to-emerald-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1 bg-white rounded-xl shadow-md">
              <GkdMobilityLogo size="sm" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-zinc-100 flex items-center gap-2">
                GKD Controle Diário
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                  OFICIAL
                </span>
              </h2>
              <p className="text-xs text-zinc-400">GKD Mobility Solutions • Sistema de Gestão para Motoristas</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-xl transition-all cursor-pointer"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-xl transition-all cursor-pointer"
              title="Fechar Janela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 bg-zinc-950/50">
          
          {/* Hero Branding Section */}
          <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800/80 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 shadow-inner text-center sm:text-left">
            <div className="p-3 bg-white rounded-2xl shadow-xl border border-zinc-300/40 shrink-0">
              <GkdMobilityLogo size="hero" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-base font-bold text-zinc-100">GKD Controle Diário</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Sistema completo de gestão operacional e financeira para motoristas de aplicativo.
              </p>
              <div className="pt-1">
                <span className="text-xs text-zinc-400 font-medium">Versão: <strong className="text-zinc-200 font-mono">{appVersion}</strong></span>
              </div>
            </div>
          </div>

          {/* Official Description Card */}
          <div className="bg-zinc-900/60 border border-zinc-850 rounded-2xl p-5 space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Descrição do Aplicativo
            </h3>
            <p className="text-sm text-zinc-200 leading-relaxed font-normal">
              {appDescription}
            </p>
          </div>

          {/* Functional Modules Overview */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-zinc-400" />
              Módulos e Recursos Integrados
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
                  <Car className="w-4 h-4 text-emerald-400" />
                  Corridas & Faturamento
                </div>
                <p className="text-[11px] text-zinc-400">
                  Gestão multi-app integrada com Uber, 99 Pop/Comfort, InDrive e corridas particulares.
                </p>
              </div>

              <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Eficiência Energética & KM
                </div>
                <p className="text-[11px] text-zinc-400">
                  Cálculo automático de consumo elétrico (kWh) ou combustível, custo por KM e rendimento real.
                </p>
              </div>

              <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
                  <Receipt className="w-4 h-4 text-rose-400" />
                  Despesas & Contas Fixas
                </div>
                <p className="text-[11px] text-zinc-400">
                  Rateio proporcional diário de IPVA, seguro, aluguel, lavagens, manutenção e despesas mensais.
                </p>
              </div>

              <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
                  <PieChart className="w-4 h-4 text-cyan-400" />
                  Relatórios & Indicadores
                </div>
                <p className="text-[11px] text-zinc-400">
                  Gráficos de tendência diária, distribuição de receita por aplicativo e margem de lucro líquida.
                </p>
              </div>

              <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-1 sm:col-span-2">
                <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
                  <Mic className="w-4 h-4 text-purple-400" />
                  Assistente de Busca por Voz
                </div>
                <p className="text-[11px] text-zinc-400">
                  Consulte ganhos de dias específicos, melhores semanas e faça buscas instantâneas por comando de voz ou texto.
                </p>
              </div>
            </div>
          </div>

          {/* Local Storage Card */}
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Armazenamento 100% Local & Privado
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                100% Offline
              </span>
            </div>
            
            <p className="text-xs text-zinc-300 leading-relaxed">
              Todos os seus registros, ganhos e despesas ficam armazenados com total segurança e privacidade na memória local do seu aparelho (LocalStorage). Funciona perfeitamente offline sem consumir sua franquia de dados móveis.
            </p>
          </div>

          {/* Architecture Specs */}
          <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 text-[11px] text-zinc-400 space-y-2">
            <div className="flex items-center justify-between">
              <span>Modo de Operação:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Local / Offline Completo
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-900 pt-1.5">
              <span>Banco de Dados:</span>
              <span className="font-mono text-zinc-300">LocalStorage Interno</span>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-900 pt-1.5">
              <span>Modo Mobile:</span>
              <span className="font-mono text-zinc-300">PWA / APK Standalone</span>
            </div>
          </div>

          {/* Relatório Técnico PDF */}
          <div className="p-4 bg-gradient-to-r from-emerald-950/30 to-zinc-900 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-zinc-200 block">Relatório Técnico do Sistema</span>
                <span className="text-[11px] text-zinc-400">Visualizar documento de auditoria e conformidade (PDF)</span>
              </div>
            </div>
            <a
              href="/relatorio_reclamacao_desempenho.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-md shadow-emerald-500/20"
            >
              <span>Abrir PDF</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3">
          <div className="text-[11px] text-zinc-500 font-mono">
            Build: {appVersion}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black rounded-xl text-xs transition-all shadow-md hover:shadow-emerald-500/20 cursor-pointer"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
