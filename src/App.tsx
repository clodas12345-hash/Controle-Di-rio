import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getApiUrl, fetchApi } from './lib/api';
import { BackupModal } from "./components/BackupModal";
import { ExcelImportModal } from './components/ExcelImportModal';
import { TollCalculator } from './components/TollCalculator';
import { GkdMobilityLogo } from './components/GkdMobilityLogo';
import { AboutAppModal } from './components/AboutAppModal';
import { DocumentFeederModal } from './components/DocumentFeederModal';
import { DeepSweepModal, DeepSweepReport } from './components/DeepSweepModal';
import { PasteFixedExpensesModal } from './components/PasteFixedExpensesModal';
import { requestNotificationPermission, sendAppNotification } from './services/notificationService';
import { takeNativePhoto } from './services/nativeCameraService';
import { ConflictResolverModal, ConflictItem } from './components/ConflictResolverModal';
import { 
  Car, 
  Gauge,
  Calendar,
  Calendar as CalendarIcon, 
  Coins, 
  Plus, 
  Trash2, 
  Pencil,
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  Info,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Clock,
  MapPin,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Award,
  Zap,
  Coffee,
  PieChart,
  LayoutGrid,
  Receipt,
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Mic,
  MicOff,
  Search,
  Volume2,
  VolumeX,
  Send,
  Bot,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  PlusCircle,
  FileText,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  Settings,
  FileSpreadsheet,
  Download,
  Utensils,
  Target,
  Clipboard,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend
} from 'recharts';

// Types and Interfaces
interface CarExpenseDetail {
  wash: number;
  toll: number;
  maintenance: number;
  parking: number;
  publicCharging?: number;
  other: number;
}

interface FoodExpenseDetail {
  lunch: number;
  dinner: number;
  snacks: number;
  coffee: number;
}

interface AppEarning {
  rides: number;
  earnings: number;
  bonus: number;
}

interface DailyLog {
  id: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  isDayOff: boolean;
  
  // Rodagem & Bateria
  sobrouBateria: number; // %
  valorKwh: number; // R$/kWh
  capacidadeBateria: number; // kWh
  kmRodado: number;
  custoEnergia: number; // R$
  diariaCarro: number; // R$
  
  // Accordion details
  carExpenses: CarExpenseDetail;
  foodExpenses: FoodExpenseDetail;
  
  // App Earnings
  app99: AppEarning;
  appUber: AppEarning;
  appParticular: {
    rides: number;
    earnings: number;
  };
  
  recompensasExtra: number;
  outrasFontes: number;
  
  exibirNoGeral: boolean;
}

interface FixedExpense {
  id: string;
  name: string;
  value: number;
  installments?: string;
}

interface CarProfile {
  vehicleType: 'eletrico' | 'combustao';
  modelName: string;
  licensePlate: string;
  manufactureYear: string;
  color: string;
  ownershipType: 'alugado' | 'proprio' | 'financiado';
  currentKm: number;
  batteryCapacityKwh: number;
  estimatedAutonomyKm: number;
  kwhCostRate: number;
  rentalOrWeeklyRate: number;
  monthlyCarExpense: number; // Despesa total com o carro no mês (padrão: R$ 7.000,00)
  workScheduleType: 'mon_to_sat_sundays_off' | 'custom_calendar'; 
  customWorkDays?: { [monthKey: string]: number[] }; // monthKey like '2024-08', value is array of day numbers
  insurerName: string;
  insurancePolicyNumber: string;
  nextMaintenanceKm: string;
  notes: string;
}

const INITIAL_CAR_PROFILE: CarProfile = {
  vehicleType: 'eletrico',
  modelName: 'BYD Dolphin EV',
  licensePlate: 'ABC-1D23',
  manufactureYear: '2024',
  color: 'Cinza',
  ownershipType: 'alugado',
  currentKm: 0,
  batteryCapacityKwh: 53.6,
  estimatedAutonomyKm: 300,
  kwhCostRate: 1.05,
  rentalOrWeeklyRate: 0,
  monthlyCarExpense: 7093.05,
  workScheduleType: 'mon_to_sat_sundays_off',
  customWorkDays: {},
  insurerName: '',
  insurancePolicyNumber: '',
  nextMaintenanceKm: '10.000 KM',
  notes: ''
};

export const BLANK_CAR_PROFILE: CarProfile = {
  vehicleType: 'eletrico',
  modelName: '',
  licensePlate: '',
  manufactureYear: '',
  color: '',
  ownershipType: 'alugado',
  currentKm: 0,
  batteryCapacityKwh: 0,
  estimatedAutonomyKm: 0,
  kwhCostRate: 0,
  rentalOrWeeklyRate: 0,
  monthlyCarExpense: 0,
  workScheduleType: 'mon_to_sat_sundays_off',
  customWorkDays: {},
  insurerName: '',
  insurancePolicyNumber: '',
  nextMaintenanceKm: '',
  notes: ''
};

// Helper to calculate working days and daily car rate
export const getMonthWorkDaysAndRate = (year: number, month: number, monthlyTotalCost: number = 0, customWorkDays?: number[]) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workDaysCount = 0;

  if (customWorkDays && customWorkDays.length > 0) {
    workDaysCount = customWorkDays.length;
  } else {
    // Default: Monday to Saturday
    for (let day = 1; day <= daysInMonth; day++) {
      const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 = Domingo
      if (dayOfWeek !== 0) {
        workDaysCount++;
      }
    }
  }

  const cost = typeof monthlyTotalCost === 'number' && !isNaN(monthlyTotalCost) && monthlyTotalCost > 0 ? monthlyTotalCost : 0;
  const dailyRateExact = workDaysCount > 0 ? cost / workDaysCount : 0;
  const dailyRate = Math.round(dailyRateExact * 100) / 100;

  return {
    daysInMonth,
    workDaysCount,
    offDaysCount: daysInMonth - workDaysCount,
    monthlyTotalCost: cost,
    dailyRate,
    dailyRateExact
  };
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEK_DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Preloaded fixed expenses generator by month (standardized to August configuration: R$ 7.093,05)
const getPreloadedFixedExpenses = (month: number): FixedExpense[] => {
  const pad = (n: number) => String(n).padStart(2, '0');
  
  return [
    { id: '1', name: 'Financiamento', value: 4000.00, installments: `${pad(month + 6)}/60` },
    { id: '2', name: 'Seguro', value: 698.00 },
    { id: '3', name: 'MEI', value: 87.05 },
    { id: '4', name: 'IPVA', value: 750.00 },
    { id: '6', name: 'Estacionamento', value: 260.00 },
    { id: '7', name: 'Preventiva', value: 700.00 },
    { id: '8', name: 'Film', value: 50.00, installments: `${pad(month)}/12` },
    { id: '9', name: 'Pneu', value: 126.00, installments: `${pad(Math.min(month, 10))}/10` },
    { id: '10', name: 'Suspensão', value: 259.00, installments: '06/06' },
    { id: '11', name: 'Mão de obra Susp', value: 163.00, installments: '06/06' },
  ];
};

// Clean empty daily logs generator for all 12 months
export const generateCleanEmptyYearLogs = (year: number = 2026): DailyLog[] => {
  const cleanLogs: DailyLog[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');

  for (let m = 1; m <= 12; m++) {
    const daysInMonth = new Date(year, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(m)}-${pad(d)}`;
      const dayOfWeek = new Date(year, m - 1, d).getDay(); // 0 = Sunday
      const isOff = dayOfWeek === 0;

      cleanLogs.push({
        id: dateStr,
        date: dateStr,
        isDayOff: isOff,
        sobrouBateria: 0,
        valorKwh: 1.05,
        capacidadeBateria: 53.6,
        kmRodado: 0,
        custoEnergia: 0,
        diariaCarro: 0,
        carExpenses: {
          wash: 0,
          toll: 0,
          maintenance: 0,
          parking: 0,
          publicCharging: 0,
          other: 0
        },
        foodExpenses: {
          lunch: 0,
          dinner: 0,
          snacks: 0,
          coffee: 0
        },
        app99: {
          rides: 0,
          earnings: 0,
          bonus: 0
        },
        appUber: {
          rides: 0,
          earnings: 0,
          bonus: 0
        },
        appParticular: {
          rides: 0,
          earnings: 0
        },
        recompensasExtra: 0,
        outrasFontes: 0,
        exibirNoGeral: true
      });
    }
  }

  return cleanLogs.sort((a, b) => a.date.localeCompare(b.date));
};

const getPreloadedLogs = (year: number, month: number): DailyLog[] => {
  return generateCleanEmptyYearLogs(year).filter(l => {
    const m = parseInt(l.date.split('-')[1], 10);
    return m === month;
  });
};

const sanitizeDailyLog = (l: DailyLog): DailyLog => {
  const sanitizeNum = (v: any) => (typeof v === 'number' && !Number.isNaN(v) ? Math.round(v * 100) / 100 : 0);
  return {
    ...l,
    sobrouBateria: sanitizeNum(l.sobrouBateria),
    valorKwh: sanitizeNum(l.valorKwh),
    capacidadeBateria: sanitizeNum(l.capacidadeBateria),
    kmRodado: sanitizeNum(l.kmRodado),
    custoEnergia: sanitizeNum(l.custoEnergia),
    diariaCarro: sanitizeNum(l.diariaCarro),
    carExpenses: {
      wash: sanitizeNum(l.carExpenses?.wash),
      toll: sanitizeNum(l.carExpenses?.toll),
      maintenance: sanitizeNum(l.carExpenses?.maintenance),
      parking: sanitizeNum(l.carExpenses?.parking),
      publicCharging: sanitizeNum(l.carExpenses?.publicCharging),
      other: sanitizeNum(l.carExpenses?.other)
    },
    foodExpenses: {
      lunch: sanitizeNum(l.foodExpenses?.lunch),
      dinner: sanitizeNum(l.foodExpenses?.dinner),
      snacks: sanitizeNum(l.foodExpenses?.snacks),
      coffee: sanitizeNum(l.foodExpenses?.coffee)
    },
    appUber: {
      rides: sanitizeNum(l.appUber?.rides),
      earnings: sanitizeNum(l.appUber?.earnings),
      bonus: sanitizeNum(l.appUber?.bonus)
    },
    app99: {
      rides: sanitizeNum(l.app99?.rides),
      earnings: sanitizeNum(l.app99?.earnings),
      bonus: sanitizeNum(l.app99?.bonus)
    },
    appParticular: {
      rides: sanitizeNum(l.appParticular?.rides),
      earnings: sanitizeNum(l.appParticular?.earnings)
    },
    recompensasExtra: sanitizeNum(l.recompensasExtra),
    outrasFontes: sanitizeNum(l.outrasFontes)
  };
};

const performCalendarSweep = (currentLogs: DailyLog[], targetYear: number = 2026): DailyLog[] => {
  const currMonth = new Date().getMonth() + 1;
  const prevMonth = currMonth === 1 ? 12 : currMonth - 1;

  const sanitized = currentLogs.map(l => {
    const sanitizedLog = sanitizeDailyLog(l);
    const [y, mo, da] = sanitizedLog.date.split('-').map(Number);
    const isRecent = (mo === currMonth || mo === prevMonth || mo === 7 || mo === 8);
    const dayOfWeek = (y && mo && da) ? new Date(y, mo - 1, da).getDay() : -1;

    if (!sanitizedLog.valorKwh || sanitizedLog.valorKwh <= 0) {
      sanitizedLog.valorKwh = isRecent ? 1.05 : (mo === 1 ? 1.42 : 0.97);
    }
    if (!sanitizedLog.capacidadeBateria || sanitizedLog.capacidadeBateria <= 0) {
      sanitizedLog.capacidadeBateria = 53.6;
    }

    if (sanitizedLog.kmRodado > 0) {
      if (sanitizedLog.custoEnergia <= 0 || Number.isNaN(sanitizedLog.custoEnergia)) {
        const batteryLeft = sanitizedLog.sobrouBateria > 0 && sanitizedLog.sobrouBateria < 100 ? sanitizedLog.sobrouBateria : Math.max(10, Math.round(100 - (sanitizedLog.kmRodado / 300) * 100));
        const energyUsed = ((100 - batteryLeft) / 100) * sanitizedLog.capacidadeBateria;
        sanitizedLog.custoEnergia = parseFloat((energyUsed * sanitizedLog.valorKwh).toFixed(2));
      }
    }

    // Ensure all Sundays are marked as Day Off (Folga) with zero daily rental
    if (dayOfWeek === 0) {
      sanitizedLog.isDayOff = true;
      sanitizedLog.diariaCarro = 0;
    } else {
      // Clean empty weekdays must NOT be marked as Folga
      if (
        sanitizedLog.kmRodado === 0 &&
        (sanitizedLog.appUber?.earnings || 0) === 0 &&
        (sanitizedLog.app99?.earnings || 0) === 0 &&
        (sanitizedLog.appParticular?.earnings || 0) === 0 &&
        (sanitizedLog.diariaCarro || 0) === 0
      ) {
        sanitizedLog.isDayOff = false;
      }
    }

    return sanitizedLog;
  });

  const existingSet = new Set(sanitized.map(l => l.date));
  const newLogs: DailyLog[] = [];

  for (let m = 1; m <= 12; m++) {
    const daysInMonth = new Date(targetYear, m, 0).getDate();
    const isRecent = (m === currMonth || m === prevMonth || m === 7 || m === 8);
    const valorKwh = isRecent ? 1.05 : (m === 1 ? 1.42 : 0.97);

    for (let d = 1; d <= daysInMonth; d++) {
      const padM = String(m).padStart(2, '0');
      const padD = String(d).padStart(2, '0');
      const dateStr = `${targetYear}-${padM}-${padD}`;

      if (!existingSet.has(dateStr)) {
        const dayOfWeek = new Date(targetYear, m - 1, d).getDay(); // 0 = Sunday
        const isOff = dayOfWeek === 0;

        newLogs.push({
          id: dateStr,
          date: dateStr,
          isDayOff: isOff,
          sobrouBateria: 0,
          valorKwh: valorKwh,
          capacidadeBateria: 53.6,
          kmRodado: 0,
          custoEnergia: 0,
          diariaCarro: 0,
          carExpenses: { wash: 0, toll: 0, maintenance: 0, parking: 0, publicCharging: 0, other: 0 },
          foodExpenses: { lunch: 0, dinner: 0, snacks: 0, coffee: 0 },
          app99: { rides: 0, earnings: 0, bonus: 0 },
          appUber: { rides: 0, earnings: 0, bonus: 0 },
          appParticular: { rides: 0, earnings: 0 },
          recompensasExtra: 0,
          outrasFontes: 0,
          exibirNoGeral: true
        });
      }
    }
  }

  const all = newLogs.length === 0 ? sanitized : [...sanitized, ...newLogs];
  return all.sort((a, b) => a.date.localeCompare(b.date));
};

export default function App() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [isAllYear, setIsAllYear] = useState<boolean>(false);
  const [sweepNotification, setSweepNotification] = useState<string | null>(null);

  // Store all daily logs - initialized with clean empty logs or saved data
  const [logs, setLogs] = useState<DailyLog[]>(() => {
    let allStoredLogs: DailyLog[] = [];
    
    // Check if user has explicit saved logs in the clean key
    const cleanSaved = localStorage.getItem('driver_daily_tracker_logs_v_clean');
    if (cleanSaved) {
      try {
        const parsed = JSON.parse(cleanSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return performCalendarSweep(parsed, 2026);
        }
      } catch (e) {
        // ignore
      }
    }

    // Default: completely clean and empty year logs
    return generateCleanEmptyYearLogs(2026);
  });

  // Modal Open/Close States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isProjectionModalOpen, setIsProjectionModalOpen] = useState(false);
  const [isDocumentFeederOpen, setIsDocumentFeederOpen] = useState(false);
  const [isConfirmClearAllModalOpen, setIsConfirmClearAllModalOpen] = useState(false);
  const [isDeepSweepModalOpen, setIsDeepSweepModalOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isTollCalculatorOpen, setIsTollCalculatorOpen] = useState(false);
  const [deepSweepReport, setDeepSweepReport] = useState<DeepSweepReport | null>(null);
  const [selectedWeekModalData, setSelectedWeekModalData] = useState<any | null>(null);
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState(false);
  const [projectionPaceMode, setProjectionPaceMode] = useState<'all_year' | 'selected_month'>('all_year');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Solicitar permissão de notificação automaticamente na inicialização
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Disparar notificação nativa sempre que houver aviso importante
  useEffect(() => {
    if (sweepNotification) {
      sendAppNotification('Controle Diário', {
        body: sweepNotification,
        tag: 'controle-diario-status'
      });
    }
  }, [sweepNotification]);

  // Handle Excel Data Import
  const handleExcelImport = (importedLogs: DailyLog[]) => {
    setLogs(prev => {
      const logsMap: { [date: string]: DailyLog } = {};
      prev.forEach(l => { logsMap[l.date] = l; });
      
      importedLogs.forEach(newLog => {
        if (logsMap[newLog.date]) {
          // Merge logic: prioritize imported data for earnings and KM if they are higher
          const existing = logsMap[newLog.date];
          logsMap[newLog.date] = {
            ...existing,
            kmRodado: Math.max(existing.kmRodado, newLog.kmRodado),
            appUber: {
              ...existing.appUber,
              earnings: Math.max(existing.appUber.earnings, newLog.appUber.earnings)
            },
            app99: {
              ...existing.app99,
              earnings: Math.max(existing.app99.earnings, newLog.app99.earnings)
            }
          };
        } else {
          logsMap[newLog.date] = newLog;
        }
      });

      const updated = Object.values(logsMap).sort((a, b) => a.date.localeCompare(b.date));
      localStorage.setItem('driver_daily_tracker_logs_v_clean', JSON.stringify(updated));
      return updated;
    });
    setSweepNotification(`Importação concluída: ${importedLogs.length} registros processados!`);
    setTimeout(() => setSweepNotification(null), 5000);
  };

  // Data Entry Conflict Resolution State
  const [pendingConflictData, setPendingConflictData] = useState<{
    targetDate: string;
    extractedData: any;
    conflicts: ConflictItem[];
  } | null>(null);

  // Helper to detect conflicting fields between existing day log and incoming extracted data
  const detectConflicts = (existingLog: DailyLog | undefined, data: any): ConflictItem[] => {
    if (!existingLog) return [];
    const conflicts: ConflictItem[] = [];

    const checkField = (
      key: string,
      label: string,
      category: string,
      currentVal: number | undefined,
      newVal: number | undefined
    ) => {
      if (newVal !== undefined && newVal !== null && newVal > 0) {
        if (currentVal !== undefined && currentVal > 0 && Math.abs(currentVal - newVal) > 0.001) {
          conflicts.push({
            key,
            label,
            category,
            currentValue: currentVal,
            newValue: newVal,
            isNumber: true,
            chosenAction: 'replace',
          });
        }
      }
    };

    // Rodagem & Operação
    checkField('kmRodado', 'KM Rodado', 'Rodagem', existingLog.kmRodado, data.kmRodado);
    checkField('sobrouBateria', 'Bateria Restante (%)', 'Rodagem', existingLog.sobrouBateria, data.sobrouBateria);
    checkField('custoEnergia', 'Custo Energia/Combustível', 'Gastos Carro', existingLog.custoEnergia, data.custoEnergia);
    checkField('diariaCarro', 'Diária do Carro', 'Gastos Carro', existingLog.diariaCarro, data.diariaCarro);

    // Ganhos
    checkField('appUber_earnings', 'Ganhos Uber', 'Ganhos Apps', existingLog.appUber?.earnings, data.appUber_earnings);
    checkField('appUber_rides', 'Viagens Uber', 'Ganhos Apps', existingLog.appUber?.rides, data.appUber_rides);
    checkField('appUber_bonus', 'Bônus Uber', 'Ganhos Apps', existingLog.appUber?.bonus, data.appUber_bonus);

    checkField('app99_earnings', 'Ganhos 99', 'Ganhos Apps', existingLog.app99?.earnings, data.app99_earnings);
    checkField('app99_rides', 'Viagens 99', 'Ganhos Apps', existingLog.app99?.rides, data.app99_rides);
    checkField('app99_bonus', 'Bônus 99', 'Ganhos Apps', existingLog.app99?.bonus, data.app99_bonus);

    checkField('appParticular_earnings', 'Ganhos Particular', 'Ganhos Apps', existingLog.appParticular?.earnings, data.appParticular_earnings);
    checkField('appParticular_rides', 'Viagens Particular', 'Ganhos Apps', existingLog.appParticular?.rides, data.appParticular_rides);

    checkField('recompensasExtra', 'Outras Recompensas', 'Ganhos Extras', existingLog.recompensasExtra, data.recompensasExtra);
    checkField('outrasFontes', 'Outras Fontes', 'Ganhos Extras', existingLog.outrasFontes, data.outrasFontes);

    // Despesas do Carro
    checkField('carExpenses_wash', 'Lavagem', 'Despesas Carro', existingLog.carExpenses?.wash, data.carExpenses_wash);
    checkField('carExpenses_toll', 'Pedágio', 'Despesas Carro', existingLog.carExpenses?.toll, data.carExpenses_toll);
    checkField('carExpenses_maintenance', 'Manutenção', 'Despesas Carro', existingLog.carExpenses?.maintenance, data.carExpenses_maintenance);
    checkField('carExpenses_parking', 'Estacionamento', 'Despesas Carro', existingLog.carExpenses?.parking, data.carExpenses_parking);
    checkField('carExpenses_publicCharging', 'Recarga Rua', 'Despesas Carro', existingLog.carExpenses?.publicCharging, data.carExpenses_publicCharging);
    checkField('carExpenses_other', 'Outras Despesas Carro', 'Despesas Carro', existingLog.carExpenses?.other, data.carExpenses_other);

    // Alimentação
    checkField('foodExpenses_lunch', 'Almoço/Refeição', 'Alimentação', existingLog.foodExpenses?.lunch, data.foodExpenses_lunch);
    checkField('foodExpenses_dinner', 'Jantar', 'Alimentação', existingLog.foodExpenses?.dinner, data.foodExpenses_dinner);
    checkField('foodExpenses_snacks', 'Café da Manhã', 'Alimentação', existingLog.foodExpenses?.snacks, data.foodExpenses_snacks);
    checkField('foodExpenses_coffee', 'Café/Lanche', 'Alimentação', existingLog.foodExpenses?.coffee, data.foodExpenses_coffee);

    return conflicts;
  };

  // Directly apply data with resolved decisions for conflicts
  const applyExtractedDataDirect = (
    data: any,
    targetDateStr: string,
    decisions?: Record<string, 'replace' | 'sum' | 'keep'>
  ) => {
    setLogs(prevLogs => {
      const existingLog = prevLogs.find(l => l.date === targetDateStr);

      const resolveNum = (
        key: string,
        newVal: number | undefined,
        currentVal: number | undefined,
        defaultFallback: number = 0
      ): number => {
        if (newVal === undefined || newVal === null || newVal <= 0) {
          return currentVal !== undefined ? currentVal : defaultFallback;
        }
        if (currentVal === undefined || currentVal <= 0) {
          return newVal;
        }
        // If values are the same, replace/keep the value directly
        if (Math.abs(currentVal - newVal) < 0.001) {
          return newVal;
        }
        // If there is a conflict and decisions exist
        const decision = decisions ? decisions[key] : 'replace';
        if (decision === 'sum') {
          return parseFloat((currentVal + newVal).toFixed(2));
        } else if (decision === 'keep') {
          return currentVal;
        } else {
          return newVal;
        }
      };

      const parsedKm = resolveNum('kmRodado', data.kmRodado, existingLog?.kmRodado, 0);
      const parsedSobrou = resolveNum('sobrouBateria', data.sobrouBateria, existingLog?.sobrouBateria, 20);
      const parsedValKwh = existingLog?.valorKwh || (carProfile.vehicleType === 'eletrico' ? (carProfile.kwhCostRate || 1.05) : 5.80);
      const parsedCap = existingLog?.capacidadeBateria || (carProfile.vehicleType === 'eletrico' ? (carProfile.batteryCapacityKwh || 53.6) : 50);

      let finalCustoEnergia = resolveNum('custoEnergia', data.custoEnergia, existingLog?.custoEnergia, 0);

      // Auto calculate energy/fuel cost if KM was detected but cost was not explicitly given
      if (parsedKm > 0 && finalCustoEnergia <= 0) {
        const estimatedAutonomy = carProfile.estimatedAutonomyKm || (carProfile.vehicleType === 'eletrico' ? 300 : 500);
        const consumedPercent = (parsedSobrou > 0 && parsedSobrou < 100) 
          ? (100 - parsedSobrou) 
          : Math.min(100, (parsedKm / estimatedAutonomy) * 100);
        const energyConsumed = (consumedPercent / 100) * parsedCap;
        finalCustoEnergia = parseFloat((energyConsumed * parsedValKwh).toFixed(2));
      }

      const [ty, tm] = targetDateStr.split('-').map(Number);
      const { dailyRate } = getMonthWorkDaysAndRate(ty, tm, getEffectiveMonthlyCost(ty, tm));
      const finalDiariaCarro = resolveNum('diariaCarro', data.diariaCarro, existingLog?.diariaCarro, dailyRate);

      const newLog: DailyLog = {
        id: targetDateStr,
        date: targetDateStr,
        isDayOff: false,
        sobrouBateria: parsedSobrou,
        valorKwh: parsedValKwh,
        capacidadeBateria: parsedCap,
        kmRodado: parsedKm,
        custoEnergia: finalCustoEnergia,
        diariaCarro: finalDiariaCarro,
        
        carExpenses: {
          wash: resolveNum('carExpenses_wash', data.carExpenses_wash, existingLog?.carExpenses?.wash, 0),
          toll: resolveNum('carExpenses_toll', data.carExpenses_toll, existingLog?.carExpenses?.toll, 0),
          maintenance: resolveNum('carExpenses_maintenance', data.carExpenses_maintenance, existingLog?.carExpenses?.maintenance, 0),
          parking: resolveNum('carExpenses_parking', data.carExpenses_parking, existingLog?.carExpenses?.parking, 0),
          publicCharging: resolveNum('carExpenses_publicCharging', data.carExpenses_publicCharging, existingLog?.carExpenses?.publicCharging, 0),
          other: resolveNum('carExpenses_other', data.carExpenses_other, existingLog?.carExpenses?.other, 0),
        },
        foodExpenses: {
          lunch: resolveNum('foodExpenses_lunch', data.foodExpenses_lunch, existingLog?.foodExpenses?.lunch, 0),
          dinner: resolveNum('foodExpenses_dinner', data.foodExpenses_dinner, existingLog?.foodExpenses?.dinner, 0),
          snacks: resolveNum('foodExpenses_snacks', data.foodExpenses_snacks, existingLog?.foodExpenses?.snacks, 0),
          coffee: resolveNum('foodExpenses_coffee', data.foodExpenses_coffee, existingLog?.foodExpenses?.coffee, 0),
        },
        app99: {
          rides: resolveNum('app99_rides', data.app99_rides, existingLog?.app99?.rides, 0),
          earnings: resolveNum('app99_earnings', data.app99_earnings, existingLog?.app99?.earnings, 0),
          bonus: resolveNum('app99_bonus', data.app99_bonus, existingLog?.app99?.bonus, 0),
        },
        appUber: {
          rides: resolveNum('appUber_rides', data.appUber_rides, existingLog?.appUber?.rides, 0),
          earnings: resolveNum('appUber_earnings', data.appUber_earnings, existingLog?.appUber?.earnings, 0),
          bonus: resolveNum('appUber_bonus', data.appUber_bonus, existingLog?.appUber?.bonus, 0),
        },
        appParticular: {
          rides: resolveNum('appParticular_rides', data.appParticular_rides, existingLog?.appParticular?.rides, 0),
          earnings: resolveNum('appParticular_earnings', data.appParticular_earnings, existingLog?.appParticular?.earnings, 0),
        },
        recompensasExtra: resolveNum('recompensasExtra', data.recompensasExtra, existingLog?.recompensasExtra, 0),
        outrasFontes: resolveNum('outrasFontes', data.outrasFontes, existingLog?.outrasFontes, 0),
        exibirNoGeral: existingLog?.exibirNoGeral !== undefined ? existingLog.exibirNoGeral : true,
      };

      const updated = prevLogs.filter(l => l.date !== targetDateStr);
      updated.push(newLog);
      return updated;
    });
  };

  // Document Feeder Handler with interactive conflict confrontation
  const handleApplyExtractedDocumentData = (data: any, targetDateStr: string) => {
    const existingLog = logs.find(l => l.date === targetDateStr);
    const conflicts = detectConflicts(existingLog, data);

    if (conflicts.length > 0) {
      // Prompt the user to choose replace or sum
      setPendingConflictData({
        targetDate: targetDateStr,
        extractedData: data,
        conflicts,
      });
    } else {
      // When fields match or there are no collisions, substitute/merge cleanly without blocking
      applyExtractedDataDirect(data, targetDateStr);
    }
  };

  const handleConfirmConflictResolution = (decisions: Record<string, 'replace' | 'sum' | 'keep'>) => {
    if (pendingConflictData) {
      applyExtractedDataDirect(
        pendingConflictData.extractedData,
        pendingConflictData.targetDate,
        decisions
      );
      setPendingConflictData(null);
    }
  };

  // Voice & Text Data Search Assistant States
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantQuery, setAssistantQuery] = useState('');
  const [isAssistantSearching, setIsAssistantSearching] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantResult, setAssistantResult] = useState<{
    textAnswer: string;
    speechText: string;
    matchingDates?: string[];
    highlightMetric?: string;
    suggestedAction?: string;
  } | null>(null);
  const [isAssistantListening, setIsAssistantListening] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [highlightedAssistantDates, setHighlightedAssistantDates] = useState<Set<string>>(new Set());

  const assistantRecognitionRef = React.useRef<any>(null);
  const assistantLastQueryRef = React.useRef<string>('');

  // Form Field States
  const [formDate, setFormDate] = useState('');
  const [isDayOff, setIsDayOff] = useState(false);
  const [confirmPrevDayPrompt, setConfirmPrevDayPrompt] = useState(false);
  const [prevDayPromptInfo, setPrevDayPromptInfo] = useState<{ prevDateStr: string; formDate: string } | null>(null);
  const [confirmHighKmPrompt, setConfirmHighKmPrompt] = useState(false);
  const [highKmTargetDate, setHighKmTargetDate] = useState<string>('');
  
  // Rodagem & Bateria States
  const [sobrouBateria, setSobrouBateria] = useState('');
  const [valorKwh, setValorKwh] = useState('');
  const [capacidadeBateria, setCapacidadeBateria] = useState('');
  const [kmRodado, setKmRodado] = useState('');
  const [custoEnergia, setCustoEnergia] = useState('');
  const [showRechargeInput, setShowRechargeInput] = useState(false);
  const [rechargeCost, setRechargeCost] = useState('');
  const [rechargeKm, setRechargeKm] = useState('');

  const handleAddRecharge = () => {
    const cost = parseFloat(String(rechargeCost).replace(',', '.')) || 0;
    const km = parseFloat(String(rechargeKm).replace(',', '.')) || 0;
    
    if (cost > 0) {
      const currentCost = parseFloat(String(custoEnergia).replace(',', '.')) || 0;
      setCustoEnergia((currentCost + cost).toFixed(2));
      setIsEnergyCostOverridden(true);
    }
    
    if (km > 0) {
      const currentKm = parseFloat(String(kmRodado).replace(',', '.')) || 0;
      setKmRodado(Math.round(currentKm + km).toString());
    }
    
    setShowRechargeInput(false);
    setRechargeCost('');
    setRechargeKm('');
  };

  const [diariaCarro, setDiariaCarro] = useState('0');

  // Accordion Expand States inside Modal
  const [isCarExpensesOpen, setIsCarExpensesOpen] = useState(false);
  const [isFoodExpensesOpen, setIsFoodExpensesOpen] = useState(false);

  // Car Expenses detail inputs
  const [wash, setWash] = useState('');
  const [toll, setToll] = useState('');
  const [maintenance, setMaintenance] = useState('');
  const [parking, setParking] = useState('');
  const [publicCharging, setPublicCharging] = useState('');
  const [carOther, setCarOther] = useState('');

  // Food Expenses detail inputs (empty without zero by default)
  const [lunch, setLunch] = useState('');
  const [dinner, setDinner] = useState('');
  const [snacks, setSnacks] = useState('');
  const [coffee, setCoffee] = useState('');

  // Earnings States
  const [uRides, setURides] = useState('');
  const [uEarnings, setUEarnings] = useState('');
  const [uBonus, setUBonus] = useState('');

  const [nRides, setNRides] = useState('');
  const [nEarnings, setNEarnings] = useState('');
  const [nBonus, setNBonus] = useState('');

  const [pRides, setPRides] = useState('');
  const [pEarnings, setPEarnings] = useState('');

  const [recompensasExtra, setRecompensasExtra] = useState('');
  const [outrasFontes, setOutrasFontes] = useState('');
  const [exibirNoGeral, setExibirNoGeral] = useState(true);

  // Auto-calculated state flags
  const [isEnergyCostOverridden, setIsEnergyCostOverridden] = useState(false);
  const [lastEditedEnergyField, setLastEditedEnergyField] = useState<'bateria' | 'km'>('bateria');

  // Highlighted row inside the table
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  // Fixed Monthly Expenses State
  const [fixedExpensesByMonth, setFixedExpensesByMonth] = useState<Record<string, FixedExpense[]>>(() => {
    const saved = localStorage.getItem('driver_fixed_expenses_v6_by_month');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return {};
  });

  const currentMonthKey = `${selectedYear}-${selectedMonth}`;
  const fixedExpenses = fixedExpensesByMonth[currentMonthKey] || [];

  const currentMonthFixedTotal = useMemo(() => {
    return fixedExpenses.reduce((acc, curr) => acc + (curr.value || 0), 0);
  }, [fixedExpenses]);

  const getEffectiveMonthlyCost = (year: number, month: number): number => {
    return carProfile.monthlyCarExpense || 0;
  };

  const setFixedExpensesForCurrentMonth = (updater: FixedExpense[] | ((prev: FixedExpense[]) => FixedExpense[])) => {
    let newList: FixedExpense[] = [];
    
    setFixedExpensesByMonth(prev => {
      const currentList = prev[currentMonthKey] || [];
      newList = typeof updater === 'function' ? updater(currentList) : updater;
      return {
        ...prev,
        [currentMonthKey]: newList
      };
    });

    // We use setTimeout to ensure this runs after state update, or just use the newList directly to update others.
    setTimeout(() => {
      const total = newList.reduce((acc, curr) => acc + (curr.value || 0), 0);
      const { dailyRate } = getMonthWorkDaysAndRate(selectedYear, selectedMonth, total);

      setCarProfile(prev => ({
        ...prev,
        monthlyCarExpense: total
      }));

      setLogs(prev => prev.map(log => {
        const [ly, lm, ld] = log.date.split('-').map(Number);
        if (ly === selectedYear && lm === selectedMonth) {
          const isSunday = new Date(ly, lm - 1, ld).getDay() === 0;
          if (!log.isDayOff && !isSunday) {
            return {
              ...log,
              diariaCarro: dailyRate
            };
          }
        }
        return log;
      }));
    }, 0);
  };

  // Car Profile State & Modal
  const [carProfile, setCarProfile] = useState<CarProfile>(() => {
    const saved = localStorage.getItem('driver_car_profile_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            vehicleType: parsed.vehicleType || 'eletrico',
            modelName: parsed.modelName ?? '',
            licensePlate: parsed.licensePlate ?? '',
            manufactureYear: parsed.manufactureYear ?? '',
            color: parsed.color ?? '',
            ownershipType: parsed.ownershipType || 'alugado',
            currentKm: Math.round(parsed.currentKm ?? 0),
            batteryCapacityKwh: parsed.batteryCapacityKwh ?? 0,
            estimatedAutonomyKm: parsed.estimatedAutonomyKm ?? 0,
            kwhCostRate: parsed.kwhCostRate ?? 0,
            rentalOrWeeklyRate: parsed.rentalOrWeeklyRate ?? 0,
            monthlyCarExpense: parsed.monthlyCarExpense ?? 0,
            workScheduleType: parsed.workScheduleType || 'mon_to_sat_sundays_off',
            customWorkDays: parsed.customWorkDays ?? {},
            insurerName: parsed.insurerName ?? '',
            insurancePolicyNumber: parsed.insurancePolicyNumber ?? '',
            nextMaintenanceKm: parsed.nextMaintenanceKm ?? '',
            notes: parsed.notes ?? ''
          };
        }
      } catch (e) {
        console.error(e);
      }
    }
    return BLANK_CAR_PROFILE;
  });

  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [helpActiveTab, setHelpActiveTab] = useState<'geral' | 'guia' | 'scanner' | 'energia' | 'diaria' | 'kpis' | 'ia' | 'faq'>('geral');
  const [helpSearchQuery, setHelpSearchQuery] = useState('');

  useEffect(() => {
    localStorage.setItem('driver_car_profile_v2', JSON.stringify(carProfile));
  }, [carProfile]);

  const [isAddingFixed, setIsAddingFixed] = useState(false);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedValue, setNewFixedValue] = useState('');
  const [newFixedInstallments, setNewFixedInstallments] = useState('');
  const [confirmingDeleteFixedId, setConfirmingDeleteFixedId] = useState<string | null>(null);
  const [confirmingDeleteLogDate, setConfirmingDeleteLogDate] = useState<string | null>(null);
  const [modalDeleteStage, setModalDeleteStage] = useState<number>(0);
  const [tableDeleteStage, setTableDeleteStage] = useState<{ date: string; stage: number } | null>(null);
  const [fixedDeleteStage, setFixedDeleteStage] = useState<{ id: string; stage: number } | null>(null);
  const [isControlPanelRetracted, setIsControlPanelRetracted] = useState(true);
  const [isKpisSectionOpen, setIsKpisSectionOpen] = useState(false);
  const [isProjectionSectionOpen, setIsProjectionSectionOpen] = useState(false);
  const [isEfficiencySectionOpen, setIsEfficiencySectionOpen] = useState(false);
  const [isCalendarSectionOpen, setIsCalendarSectionOpen] = useState(false);
  const [isAppShareSectionOpen, setIsAppShareSectionOpen] = useState(false);
  const [isFixedExpensesSectionOpen, setIsFixedExpensesSectionOpen] = useState(false);
  const [isChartSectionOpen, setIsChartSectionOpen] = useState(false);
  const [isHistorySectionOpen, setIsHistorySectionOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'visao-geral' | 'entradas' | 'contas' | 'relatorios'>('visao-geral');

  const [isKpisModalOpen, setIsKpisModalOpen] = useState(false);
  const [isEfficiencyModalOpen, setIsEfficiencyModalOpen] = useState(false);
  const [isAppShareModalOpen, setIsAppShareModalOpen] = useState(false);
  const [isPasteFixedExpensesModalOpen, setIsPasteFixedExpensesModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Date / Agenda Picker Modal States (Day, Month, Year selector)
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState(false);
  const [datePickerYear, setDatePickerYear] = useState<number>(selectedYear);
  const [datePickerMonth, setDatePickerMonth] = useState<number>(selectedMonth);
  const [datePickerDay, setDatePickerDay] = useState<number>(() => {
    const today = new Date();
    return today.getDate();
  });

  const fixedExpenseFormRef = React.useRef<HTMLFormElement | null>(null);
  const fixedExpenseInputRef = React.useRef<HTMLInputElement | null>(null);

  // Pure Local Storage Persistence (100% Offline & Private)
  useEffect(() => {
    localStorage.setItem('driver_fixed_expenses_v6_by_month', JSON.stringify(fixedExpensesByMonth));
  }, [fixedExpensesByMonth]);

  const handleApplyExtractedFixedExpenses = (
    month: number, 
    year: number, 
    expenses: { id: string; name: string; value: number; installments?: string }[]
  ) => {
    const monthKey = `${year}-${month}`;
    const cleanExpenses: FixedExpense[] = expenses.map((e, idx) => ({
      id: e.id || `fe-${Date.now()}-${idx}`,
      name: e.name,
      value: typeof e.value === 'number' ? e.value : parseFloat(String(e.value)) || 0,
      installments: e.installments
    }));

    setFixedExpensesByMonth(prev => ({
      ...prev,
      [monthKey]: cleanExpenses
    }));

    const total = cleanExpenses.reduce((acc, curr) => acc + (curr.value || 0), 0);
    const { dailyRate } = getMonthWorkDaysAndRate(year, month, total);

    // Update car profile monthlyCarExpense if this is the current active month
    if (month === selectedMonth && year === selectedYear) {
      setCarProfile(prev => ({
        ...prev,
        monthlyCarExpense: total
      }));
    }

    // Recalculate dailyRate for all working days of that month in existing logs
    setLogs(prev => prev.map(log => {
      const [ly, lm, ld] = log.date.split('-').map(Number);
      if (ly === year && lm === month) {
        const isSunday = new Date(ly, lm - 1, ld).getDay() === 0;
        if (!log.isDayOff && !isSunday) {
          return {
            ...log,
            diariaCarro: dailyRate
          };
        }
      }
      return log;
    }));

    setSweepNotification(`${cleanExpenses.length} contas aplicadas em ${MONTH_NAMES[month - 1]}/${year}! Total: ${formatBRL(total)} (Diária recalculada: ${formatBRL(dailyRate)}/dia)`);
    setTimeout(() => setSweepNotification(null), 5000);
  };

  const handleSaveFixedExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFixedName || !newFixedValue) return;
    const val = parseFloat(newFixedValue);
    if (isNaN(val)) return;

    if (editingFixedId) {
      setFixedExpensesForCurrentMonth(prev => prev.map(item => item.id === editingFixedId ? {
        ...item,
        name: newFixedName,
        value: val,
        installments: newFixedInstallments.trim() || undefined
      } : item));
      setSweepNotification(`Despesa "${newFixedName}" atualizada com sucesso!`);
    } else {
      const newExpense: FixedExpense = {
        id: String(Date.now()),
        name: newFixedName,
        value: val,
        installments: newFixedInstallments.trim() || undefined
      };
      setFixedExpensesForCurrentMonth(prev => [...prev, newExpense]);
      setSweepNotification(`Despesa "${newFixedName}" adicionada com sucesso!`);
    }

    setNewFixedName('');
    setNewFixedValue('');
    setNewFixedInstallments('');
    setEditingFixedId(null);
    setIsAddingFixed(false);
    setTimeout(() => setSweepNotification(null), 4000);
  };

  const handleStartEditFixedExpense = (item: FixedExpense) => {
    setEditingFixedId(item.id);
    setNewFixedName(item.name);
    setNewFixedValue(String(item.value));
    setNewFixedInstallments(item.installments || '');
    setIsAddingFixed(true);
    setTimeout(() => {
      fixedExpenseFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fixedExpenseInputRef.current?.focus();
    }, 80);
  };

  const handleCancelFixedExpenseForm = () => {
    setIsAddingFixed(false);
    setEditingFixedId(null);
    setNewFixedName('');
    setNewFixedValue('');
    setNewFixedInstallments('');
  };

  const handleDeleteFixedExpense = (id: string) => {
    const itemToDelete = fixedExpenses.find(i => i.id === id);
    setFixedExpensesForCurrentMonth(prev => prev.filter(item => item.id !== id));
    if (editingFixedId === id) {
      handleCancelFixedExpenseForm();
    }
    setConfirmingDeleteFixedId(null);
    setSweepNotification(`Despesa "${itemToDelete?.name || 'fixa'}" excluída com sucesso!`);
    setTimeout(() => setSweepNotification(null), 4000);
  };

  // AI Extraction States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [aiTabMode, setAiTabMode] = useState<'camera' | 'upload' | 'paste'>('upload');
  const [aiPastedText, setAiPastedText] = useState('');

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  const startCamera = async (facing: 'environment' | 'user' = cameraFacingMode) => {
    setAiErrorMsg(null);
    setAiSuccessMsg(null);
    stopCamera();

    // Se estiver rodando dentro do aplicativo nativo (APK / Capacitor), usa exclusivamente a câmera nativa do SO
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      await handleNativeCameraCapture();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setAiErrorMsg("API de câmera não disponível ou bloqueada neste navegador/dispositivo.");
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
          videoRef.current.play().catch(err => {
            console.error("Erro ao iniciar reprodução do vídeo", err);
          });
        }
      }, 100);
    } catch (err: any) {
      console.error(err);
      setAiErrorMsg("Não foi possível acessar a câmera. Verifique as permissões do dispositivo.");
    }
  };

  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    await startCamera(nextFacing);
  };

  const handleNativeCameraCapture = async () => {
    try {
      const { Camera: CapacitorCamera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const image = await CapacitorCamera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });
      if (image.base64String) {
        setAiLoading(true);
        setAiErrorMsg(null);
        setAiSuccessMsg(null);
        const mimeType = `image/${image.format || 'jpeg'}`;
        const base64Data = `data:${mimeType};base64,${image.base64String}`;
        await handleExtractReceipt(base64Data, mimeType);
      }
    } catch (err: any) {
      console.error("Erro ao capturar foto nativa:", err);
      if (err?.message?.includes('cancelled') || err?.message?.includes('cancelou') || String(err).includes('cancel')) {
        return;
      }
      setAiErrorMsg("Não foi possível abrir a câmera nativa. Verifique as permissões do aplicativo.");
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        stopCamera();
        await handleExtractReceipt(base64, 'image/jpeg');
      }
    } catch (err: any) {
      console.error(err);
      setAiErrorMsg("Erro ao capturar imagem da câmera.");
      stopCamera();
    }
  };

  const compressImageFile = async (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({
          base64: reader.result as string,
          mimeType: file.type
        });
        reader.onerror = () => resolve({ base64: '', mimeType: file.type });
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve({
            base64: compressedDataUrl,
            mimeType: 'image/jpeg'
          });
        } else {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve({
            base64: reader.result as string,
            mimeType: file.type
          });
        }
      };
      img.onerror = () => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({
          base64: reader.result as string,
          mimeType: file.type
        });
      };
    });
  };

  const processUploadedFiles = async (files: FileList | File[]) => {
    setAiErrorMsg(null);
    setAiSuccessMsg(null);
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setAiErrorMsg("Por favor, selecione imagens válidas (PNG, JPG, JPEG).");
      return;
    }

    setAiLoading(true);
    try {
      const imageDataArray: Array<{ imageBase64: string; mimeType: string }> = [];
      for (const file of validFiles) {
        const compressed = await compressImageFile(file);
        if (compressed.base64) {
          imageDataArray.push({ imageBase64: compressed.base64, mimeType: compressed.mimeType });
        }
      }
      if (imageDataArray.length > 0) {
        await handleExtractReceiptMulti(imageDataArray);
      } else {
        throw new Error("Não foi possível processar as imagens selecionadas.");
      }
    } catch (err: any) {
      console.error(err);
      setAiErrorMsg(err?.message || "Erro ao processar as imagens.");
      setAiLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleExtractReceipt = async (imageBase64: string, mimeType: string) => {
    await handleExtractReceiptMulti([{ imageBase64, mimeType }]);
  };

  const handleExtractPastedText = async () => {
    if (!aiPastedText.trim()) {
      setAiErrorMsg("Cole o texto, tabela ou comprovante antes de processar.");
      return;
    }
    await handleExtractReceiptMulti([], aiPastedText);
  };

  const handleExtractReceiptMulti = async (
    images: Array<{ imageBase64: string; mimeType: string }> = [],
    textSnippet?: string
  ) => {
    setAiLoading(true);
    setAiSuccessMsg(null);
    setAiErrorMsg(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 90000); // 90 seconds timeout

    try {
      const res = await fetchApi("/api/extract-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ 
          images: images || [],
          textData: textSnippet || "",
          text: textSnippet || ""
        }),
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Erro ao processar imagem ou texto.");
      }
      const data = await res.json();
      
      const item = (data.results && Array.isArray(data.results) && data.results.length > 0)
        ? data.results[0]
        : data;

      const extracted: string[] = [];

      // Multi-day table import handling (e.g. from Excel or multiple reports)
      if (data.results && Array.isArray(data.results) && data.results.length > 1) {
        let importedDaysCount = 0;
        setLogs(prevLogs => {
          let updated = [...prevLogs];
          data.results.forEach((rItem: any) => {
            if (rItem.detectedDate && /^\d{4}-\d{2}-\d{2}$/.test(rItem.detectedDate)) {
              const targetDate = rItem.detectedDate;
              const existing = updated.find(l => l.date === targetDate);
              const [y, m, d] = targetDate.split('-').map(Number);
              const isSunday = new Date(y, m - 1, d).getDay() === 0;
              const { dailyRate } = getMonthWorkDaysAndRate(y, m, getEffectiveMonthlyCost(y, m));

              const capNum = rItem.capacidadeBateria || (carProfile.vehicleType === 'eletrico' ? 53.6 : 50);
              const valKwhNum = rItem.valorKwh || (carProfile.vehicleType === 'eletrico' ? 1.05 : 5.80);
              let finalEnergy = rItem.custoEnergia || 0;
              if (finalEnergy <= 0 && rItem.kmRodado > 0) {
                const estimatedAutonomy = carProfile.estimatedAutonomyKm || (carProfile.vehicleType === 'eletrico' ? 300 : 500);
                const consumedPercent = (rItem.sobrouBateria > 0 && rItem.sobrouBateria < 100)
                  ? (100 - rItem.sobrouBateria)
                  : Math.min(100, (rItem.kmRodado / estimatedAutonomy) * 100);
                finalEnergy = parseFloat(((consumedPercent / 100) * capNum * valKwhNum).toFixed(2));
              }

              const newLog: DailyLog = {
                id: existing?.id || `log-${targetDate}-${Date.now()}`,
                date: targetDate,
                isDayOff: rItem.isDayOff ?? (existing?.isDayOff ?? isSunday),
                kmRodado: rItem.kmRodado || existing?.kmRodado || 0,
                sobrouBateria: rItem.sobrouBateria || existing?.sobrouBateria || 0,
                valorKwh: valKwhNum,
                capacidadeBateria: capNum,
                custoEnergia: finalEnergy || existing?.custoEnergia || 0,
                diariaCarro: rItem.diariaCarro || existing?.diariaCarro || (isSunday ? 0 : dailyRate),
                carExpenses: {
                  wash: rItem.carExpenses_wash || existing?.carExpenses?.wash || 0,
                  toll: rItem.carExpenses_toll || existing?.carExpenses?.toll || 0,
                  maintenance: rItem.carExpenses_maintenance || existing?.carExpenses?.maintenance || 0,
                  parking: rItem.carExpenses_parking || existing?.carExpenses?.parking || 0,
                  publicCharging: rItem.carExpenses_publicCharging || existing?.carExpenses?.publicCharging || 0,
                  other: rItem.carExpenses_other || existing?.carExpenses?.other || 0,
                },
                foodExpenses: {
                  lunch: rItem.foodExpenses_lunch || existing?.foodExpenses?.lunch || 0,
                  dinner: rItem.foodExpenses_dinner || existing?.foodExpenses?.dinner || 0,
                  snacks: rItem.foodExpenses_snacks || existing?.foodExpenses?.snacks || 0,
                  coffee: rItem.foodExpenses_coffee || existing?.foodExpenses?.coffee || 0,
                },
                app99: {
                  rides: rItem.app99_rides || existing?.app99?.rides || 0,
                  earnings: rItem.app99_earnings || existing?.app99?.earnings || 0,
                  bonus: 0,
                },
                appUber: {
                  rides: rItem.appUber_rides || existing?.appUber?.rides || 0,
                  earnings: rItem.appUber_earnings || existing?.appUber?.earnings || 0,
                  bonus: 0,
                },
                appParticular: {
                  rides: rItem.appParticular_rides || existing?.appParticular?.rides || 0,
                  earnings: rItem.appParticular_earnings || existing?.appParticular?.earnings || 0,
                },
                recompensasExtra: rItem.recompensasExtra || existing?.recompensasExtra || 0,
                outrasFontes: rItem.outrasFontes || existing?.outrasFontes || 0,
                exibirNoGeral: true,
              };

              updated = updated.filter(l => l.date !== targetDate);
              updated.push(newLog);
              importedDaysCount++;
            }
          });
          return updated;
        });

        if (importedDaysCount > 0) {
          extracted.push(`⚡ ${importedDaysCount} dias de lançamentos importados da tabela`);
        }
      }

      if (item.detectedDate && typeof item.detectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.detectedDate)) {
        setFormDate(item.detectedDate);
        extracted.push(`Data: ${item.detectedDate}`);
      } else if (item.date && typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
        setFormDate(item.date);
        extracted.push(`Data: ${item.date}`);
      }

      if (item.kmRodado !== undefined && item.kmRodado !== null && item.kmRodado > 0) {
        setKmRodado(String(item.kmRodado));
        extracted.push(`KM: ${item.kmRodado}`);
      }
      if (item.sobrouBateria !== undefined && item.sobrouBateria !== null) {
        setSobrouBateria(item.sobrouBateria > 0 ? String(item.sobrouBateria) : '');
        if (item.sobrouBateria > 0) extracted.push(`Bateria: ${item.sobrouBateria}%`);
      }

      // Auto-calculate or set energy cost
      let finalCustoEnergia = item.custoEnergia;
      if ((!finalCustoEnergia || finalCustoEnergia <= 0) && item.kmRodado > 0) {
        const capNum = parseFloat(String(capacidadeBateria).replace(',', '.')) || (carProfile.vehicleType === 'eletrico' ? 53.6 : 50);
        const valKwhNum = parseFloat(String(valorKwh).replace(',', '.')) || (carProfile.vehicleType === 'eletrico' ? 1.05 : 5.80);
        const estimatedAutonomy = carProfile.estimatedAutonomyKm || (carProfile.vehicleType === 'eletrico' ? 300 : 500);
        const consumedPercent = (item.sobrouBateria > 0 && item.sobrouBateria < 100)
          ? (100 - item.sobrouBateria)
          : Math.min(100, (item.kmRodado / estimatedAutonomy) * 100);
        finalCustoEnergia = parseFloat(((consumedPercent / 100) * capNum * valKwhNum).toFixed(2));
      }

      if (finalCustoEnergia !== undefined && finalCustoEnergia !== null && finalCustoEnergia > 0) {
        setCustoEnergia(String(finalCustoEnergia));
        setIsEnergyCostOverridden(true);
        extracted.push(`Energia/Combustível: ${formatBRL(finalCustoEnergia)}`);
      }

      if (item.diariaCarro !== undefined && item.diariaCarro !== null && item.diariaCarro > 0) {
        setDiariaCarro(String(item.diariaCarro));
        extracted.push(`Diária Carro: ${formatBRL(item.diariaCarro)}`);
      }

      // Uber
      if (item.appUber_rides !== undefined && item.appUber_rides !== null && item.appUber_rides > 0) {
        setURides(String(item.appUber_rides));
        extracted.push(`Viagens Uber: ${item.appUber_rides}`);
      }
      if (item.appUber_earnings !== undefined && item.appUber_earnings !== null && item.appUber_earnings > 0) {
        setUEarnings(String(item.appUber_earnings));
        extracted.push(`Ganhos Uber: ${formatBRL(item.appUber_earnings)}`);
      }
      if (item.appUber_bonus !== undefined && item.appUber_bonus !== null && item.appUber_bonus > 0) {
        setUBonus(String(item.appUber_bonus));
        extracted.push(`Bônus Uber: ${formatBRL(item.appUber_bonus)}`);
      }

      // 99
      if (item.app99_rides !== undefined && item.app99_rides !== null && item.app99_rides > 0) {
        setNRides(String(item.app99_rides));
        extracted.push(`Viagens 99: ${item.app99_rides}`);
      }
      if (item.app99_earnings !== undefined && item.app99_earnings !== null && item.app99_earnings > 0) {
        setNEarnings(String(item.app99_earnings));
        extracted.push(`Ganhos 99: ${formatBRL(item.app99_earnings)}`);
      }
      if (item.app99_bonus !== undefined && item.app99_bonus !== null && item.app99_bonus > 0) {
        setNBonus(String(item.app99_bonus));
        extracted.push(`Bônus 99: ${formatBRL(item.app99_bonus)}`);
      }

      // Particular
      if (item.appParticular_rides !== undefined && item.appParticular_rides !== null && item.appParticular_rides > 0) {
        setPRides(String(item.appParticular_rides));
        extracted.push(`Viagens Particular: ${item.appParticular_rides}`);
      }
      if (item.appParticular_earnings !== undefined && item.appParticular_earnings !== null && item.appParticular_earnings > 0) {
        setPEarnings(String(item.appParticular_earnings));
        extracted.push(`Ganhos Particular: ${formatBRL(item.appParticular_earnings)}`);
      }

      // Car Expenses
      if (item.carExpenses_wash !== undefined && item.carExpenses_wash !== null && item.carExpenses_wash > 0) {
        setWash(String(item.carExpenses_wash));
        setIsCarExpensesOpen(true);
        extracted.push(`Lavagem: ${formatBRL(item.carExpenses_wash)}`);
      }
      if (item.carExpenses_toll !== undefined && item.carExpenses_toll !== null && item.carExpenses_toll > 0) {
        setToll(String(item.carExpenses_toll));
        setIsCarExpensesOpen(true);
        extracted.push(`Pedágio: ${formatBRL(item.carExpenses_toll)}`);
      }
      if (item.carExpenses_maintenance !== undefined && item.carExpenses_maintenance !== null && item.carExpenses_maintenance > 0) {
        setMaintenance(String(item.carExpenses_maintenance));
        setIsCarExpensesOpen(true);
        extracted.push(`Manutenção: ${formatBRL(item.carExpenses_maintenance)}`);
      }
      if (item.carExpenses_parking !== undefined && item.carExpenses_parking !== null && item.carExpenses_parking > 0) {
        setParking(String(item.carExpenses_parking));
        setIsCarExpensesOpen(true);
        extracted.push(`Estacionamento: ${formatBRL(item.carExpenses_parking)}`);
      }
      if (item.carExpenses_publicCharging !== undefined && item.carExpenses_publicCharging !== null && item.carExpenses_publicCharging > 0) {
        setPublicCharging(String(item.carExpenses_publicCharging));
        setIsCarExpensesOpen(true);
        extracted.push(`Recarga Rua: ${formatBRL(item.carExpenses_publicCharging)}`);
      }
      if (item.carExpenses_other !== undefined && item.carExpenses_other !== null && item.carExpenses_other > 0) {
        setCarOther(String(item.carExpenses_other));
        setIsCarExpensesOpen(true);
        extracted.push(`Outras Despesas: ${formatBRL(item.carExpenses_other)}`);
      }

      // Food Expenses
      if (item.foodExpenses_lunch !== undefined && item.foodExpenses_lunch !== null && item.foodExpenses_lunch > 0) {
        setLunch(String(item.foodExpenses_lunch));
        setIsFoodExpensesOpen(true);
        extracted.push(`Almoço: ${formatBRL(item.foodExpenses_lunch)}`);
      }
      if (item.foodExpenses_dinner !== undefined && item.foodExpenses_dinner !== null && item.foodExpenses_dinner > 0) {
        setDinner(String(item.foodExpenses_dinner));
        setIsFoodExpensesOpen(true);
        extracted.push(`Jantar: ${formatBRL(item.foodExpenses_dinner)}`);
      }
      if (item.foodExpenses_snacks !== undefined && item.foodExpenses_snacks !== null && item.foodExpenses_snacks > 0) {
        setSnacks(String(item.foodExpenses_snacks));
        setIsFoodExpensesOpen(true);
        extracted.push(`Café da manhã: ${formatBRL(item.foodExpenses_snacks)}`);
      }
      if (item.foodExpenses_coffee !== undefined && item.foodExpenses_coffee !== null && item.foodExpenses_coffee > 0) {
        setCoffee(String(item.foodExpenses_coffee));
        setIsFoodExpensesOpen(true);
        extracted.push(`Café da tarde: ${formatBRL(item.foodExpenses_coffee)}`);
      }

      // Other general
      if (item.recompensasExtra !== undefined && item.recompensasExtra !== null && item.recompensasExtra > 0) {
        setRecompensasExtra(String(item.recompensasExtra));
        extracted.push(`Outras Recompensas: ${formatBRL(item.recompensasExtra)}`);
      }
      if (item.outrasFontes !== undefined && item.outrasFontes !== null && item.outrasFontes > 0) {
        setOutrasFontes(String(item.outrasFontes));
        extracted.push(`Outras Fontes: ${formatBRL(item.outrasFontes)}`);
      }

      // Fixed expenses detected
      if (data.fixedExpenses && Array.isArray(data.fixedExpenses) && data.fixedExpenses.length > 0) {
        const fMonth = data.fixedExpensesMonth || selectedMonth;
        const fYear = data.fixedExpensesYear || selectedYear;
        handleApplyExtractedFixedExpenses(
          fMonth, 
          fYear, 
          data.fixedExpenses.map((fe: any, idx: number) => ({
            id: `fe-ai-${Date.now()}-${idx}`,
            name: fe.description,
            value: fe.value,
            installments: fe.installments
          }))
        );
        extracted.push(`${data.fixedExpenses.length} Despesas Fixas salvas no mês ${fMonth}/${fYear}`);
      }

      if (extracted.length > 0) {
        setAiSuccessMsg(`Preenchido automaticamente: ${extracted.join(" • ")}`);
      } else {
        setAiSuccessMsg("Documento analisado com sucesso, mas nenhum valor financeiro ou operacional foi reconhecido.");
      }
    } catch (error: any) {
      console.error(error);
      const msg = error?.message || '';
      if (error.name === 'AbortError') {
        setAiErrorMsg("Tempo limite de 90 segundos excedido ao processar as fotos. Verifique sua conexão e tente novamente.");
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        setAiErrorMsg("Erro de conexão com o servidor de Inteligência Artificial. Verifique se o celular está conectado à internet e tente novamente.");
      } else {
        setAiErrorMsg(msg || "Erro ao tentar extrair dados do comprovante.");
      }
    } finally {
      setAiLoading(false);
    }
  };

  // Voice Recognition States
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceSuccessMsg, setVoiceSuccessMsg] = useState<string | null>(null);
  const [voiceErrorMsg, setVoiceErrorMsg] = useState<string | null>(null);
  const [voiceTranscribedText, setVoiceTranscribedText] = useState<string | null>(null);
  const recognitionRef = React.useRef<any>(null);
  const accumulatedTranscriptRef = React.useRef<string>("");
  const userStoppedVoiceRef = React.useRef<boolean>(false);
  const hasVoiceErrorRef = React.useRef<boolean>(false);

  const startVoiceRecognition = () => {
    setVoiceErrorMsg(null);
    setVoiceSuccessMsg(null);
    setVoiceTranscribedText(null);
    accumulatedTranscriptRef.current = "";
    userStoppedVoiceRef.current = false;
    hasVoiceErrorRef.current = false;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceErrorMsg("Reconhecimento de voz não é suportado neste navegador. Tente usar o Google Chrome ou Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.lang = 'pt-BR';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setVoiceRecording(true);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          setVoiceErrorMsg("Permissão do microfone negada. Verifique as configurações de áudio do seu navegador.");
          hasVoiceErrorRef.current = true;
        } else if (event.error === 'no-speech') {
          console.warn("Nenhuma fala detectada.");
          // No-speech is transient and doesn't block processing already captured speech
        } else if (event.error === 'aborted') {
          console.warn("Reconhecimento de voz abortado.");
          hasVoiceErrorRef.current = true;
        } else {
          setVoiceErrorMsg(`Erro no reconhecimento de voz: ${event.error}`);
          hasVoiceErrorRef.current = true;
        }
      };

      recognition.onend = () => {
        setVoiceRecording(false);
        
        // Brief timeout ensures any final onresult callback is processed
        setTimeout(() => {
          if (hasVoiceErrorRef.current) {
            return;
          }

          const textToProcess = accumulatedTranscriptRef.current.trim();
          if (userStoppedVoiceRef.current) {
            if (textToProcess) {
              handleProcessVoiceText(textToProcess);
            } else {
              setVoiceErrorMsg("Nenhuma fala foi capturada. Tente falar de forma clara após iniciar a gravação.");
            }
          } else {
            // Auto-stopped due to long silence
            if (textToProcess) {
              handleProcessVoiceText(textToProcess);
            }
          }
        }, 200);
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
        const text = fullTranscript.trim();
        setVoiceTranscribedText(text);
        accumulatedTranscriptRef.current = text;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error(err);
      setVoiceErrorMsg("Não foi possível iniciar o microfone.");
      setVoiceRecording(false);
    }
  };

  const stopVoiceRecognition = () => {
    userStoppedVoiceRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setVoiceRecording(false);
  };

  const handleProcessVoiceText = async (transcript: string) => {
    setVoiceLoading(true);
    setVoiceSuccessMsg(null);
    setVoiceErrorMsg(null);
    try {
      const res = await fetchApi("/api/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao interpretar fala.");
      }
      const data = await res.json();
      
      const extracted: string[] = [];

      if (data.kmRodado !== undefined && data.kmRodado !== null && data.kmRodado > 0) {
        setKmRodado(String(data.kmRodado));
        extracted.push(`KM: ${data.kmRodado}`);
      }
      if (data.custoEnergia !== undefined && data.custoEnergia !== null && data.custoEnergia > 0) {
        setCustoEnergia(String(data.custoEnergia));
        setIsEnergyCostOverridden(true);
        extracted.push(`Energia: ${formatBRL(data.custoEnergia)}`);
      }
      if (data.sobrouBateria !== undefined && data.sobrouBateria !== null) {
        setSobrouBateria(data.sobrouBateria > 0 ? String(data.sobrouBateria) : '');
        if (data.sobrouBateria > 0) extracted.push(`Bateria restante: ${data.sobrouBateria}%`);
      }
      if (data.diariaCarro !== undefined && data.diariaCarro !== null && data.diariaCarro > 0) {
        setDiariaCarro(String(data.diariaCarro));
        extracted.push(`Diária Carro: ${formatBRL(data.diariaCarro)}`);
      }

      // Uber
      if (data.appUber_rides !== undefined && data.appUber_rides !== null && data.appUber_rides > 0) {
        setURides(String(data.appUber_rides));
        extracted.push(`Viagens Uber: ${data.appUber_rides}`);
      }
      if (data.appUber_earnings !== undefined && data.appUber_earnings !== null && data.appUber_earnings > 0) {
        setUEarnings(String(data.appUber_earnings));
        extracted.push(`Ganhos Uber: ${formatBRL(data.appUber_earnings)}`);
      }
      if (data.appUber_bonus !== undefined && data.appUber_bonus !== null && data.appUber_bonus > 0) {
        setUBonus(String(data.appUber_bonus));
        extracted.push(`Bônus Uber: ${formatBRL(data.appUber_bonus)}`);
      }

      // 99
      if (data.app99_rides !== undefined && data.app99_rides !== null && data.app99_rides > 0) {
        setNRides(String(data.app99_rides));
        extracted.push(`Viagens 99: ${data.app99_rides}`);
      }
      if (data.app99_earnings !== undefined && data.app99_earnings !== null && data.app99_earnings > 0) {
        setNEarnings(String(data.app99_earnings));
        extracted.push(`Ganhos 99: ${formatBRL(data.app99_earnings)}`);
      }
      if (data.app99_bonus !== undefined && data.app99_bonus !== null && data.app99_bonus > 0) {
        setNBonus(String(data.app99_bonus));
        extracted.push(`Bônus 99: ${formatBRL(data.app99_bonus)}`);
      }

      // Particular
      if (data.appParticular_rides !== undefined && data.appParticular_rides !== null && data.appParticular_rides > 0) {
        setPRides(String(data.appParticular_rides));
        extracted.push(`Viagens Particular: ${data.appParticular_rides}`);
      }
      if (data.appParticular_earnings !== undefined && data.appParticular_earnings !== null && data.appParticular_earnings > 0) {
        setPEarnings(String(data.appParticular_earnings));
        extracted.push(`Ganhos Particular: ${formatBRL(data.appParticular_earnings)}`);
      }

      // Car Expenses
      if (data.carExpenses_wash !== undefined && data.carExpenses_wash !== null && data.carExpenses_wash > 0) {
        setWash(String(data.carExpenses_wash));
        setIsCarExpensesOpen(true);
        extracted.push(`Lavagem: ${formatBRL(data.carExpenses_wash)}`);
      }
      if (data.carExpenses_toll !== undefined && data.carExpenses_toll !== null && data.carExpenses_toll > 0) {
        setToll(String(data.carExpenses_toll));
        setIsCarExpensesOpen(true);
        extracted.push(`Pedágio: ${formatBRL(data.carExpenses_toll)}`);
      }
      if (data.carExpenses_maintenance !== undefined && data.carExpenses_maintenance !== null && data.carExpenses_maintenance > 0) {
        setMaintenance(String(data.carExpenses_maintenance));
        setIsCarExpensesOpen(true);
        extracted.push(`Manutenção: ${formatBRL(data.carExpenses_maintenance)}`);
      }
      if (data.carExpenses_parking !== undefined && data.carExpenses_parking !== null && data.carExpenses_parking > 0) {
        setParking(String(data.carExpenses_parking));
        setIsCarExpensesOpen(true);
        extracted.push(`Estacionamento: ${formatBRL(data.carExpenses_parking)}`);
      }
      if (data.carExpenses_publicCharging !== undefined && data.carExpenses_publicCharging !== null && data.carExpenses_publicCharging > 0) {
        setPublicCharging(String(data.carExpenses_publicCharging));
        setIsCarExpensesOpen(true);
        extracted.push(`Recarga Rua: ${formatBRL(data.carExpenses_publicCharging)}`);
      }
      if (data.carExpenses_other !== undefined && data.carExpenses_other !== null && data.carExpenses_other > 0) {
        setCarOther(String(data.carExpenses_other));
        setIsCarExpensesOpen(true);
        extracted.push(`Outras Despesas: ${formatBRL(data.carExpenses_other)}`);
      }

      // Food Expenses
      if (data.foodExpenses_lunch !== undefined && data.foodExpenses_lunch !== null && data.foodExpenses_lunch > 0) {
        setLunch(String(data.foodExpenses_lunch));
        setIsFoodExpensesOpen(true);
        extracted.push(`Almoço: ${formatBRL(data.foodExpenses_lunch)}`);
      }
      if (data.foodExpenses_dinner !== undefined && data.foodExpenses_dinner !== null && data.foodExpenses_dinner > 0) {
        setDinner(String(data.foodExpenses_dinner));
        setIsFoodExpensesOpen(true);
        extracted.push(`Jantar: ${formatBRL(data.foodExpenses_dinner)}`);
      }
      if (data.foodExpenses_snacks !== undefined && data.foodExpenses_snacks !== null && data.foodExpenses_snacks > 0) {
        setSnacks(String(data.foodExpenses_snacks));
        setIsFoodExpensesOpen(true);
        extracted.push(`Café da manhã: ${formatBRL(data.foodExpenses_snacks)}`);
      }
      if (data.foodExpenses_coffee !== undefined && data.foodExpenses_coffee !== null && data.foodExpenses_coffee > 0) {
        setCoffee(String(data.foodExpenses_coffee));
        setIsFoodExpensesOpen(true);
        extracted.push(`Café da tarde: ${formatBRL(data.foodExpenses_coffee)}`);
      }

      // Other general
      if (data.recompensasExtra !== undefined && data.recompensasExtra !== null && data.recompensasExtra > 0) {
        setRecompensasExtra(String(data.recompensasExtra));
        extracted.push(`Outras Recompensas: ${formatBRL(data.recompensasExtra)}`);
      }
      if (data.outrasFontes !== undefined && data.outrasFontes !== null && data.outrasFontes > 0) {
        setOutrasFontes(String(data.outrasFontes));
        extracted.push(`Outras Fontes: ${formatBRL(data.outrasFontes)}`);
      }

      if (extracted.length > 0) {
        setVoiceSuccessMsg(`Entendido via Voz: ${extracted.join(", ")}`);
      } else {
        setVoiceSuccessMsg("Foz processada pela IA, mas nenhum valor correspondente foi identificado. Tente falar de forma mais direta (ex: 'Rodei 100 km, gastei 20 de almoço').");
      }
    } catch (error: any) {
      console.error(error);
      setVoiceErrorMsg(error.message || "Erro ao processar fala.");
    } finally {
      setVoiceLoading(false);
    }
  };

  // Data Search Assistant Logic
  const speakAssistantAnswer = (textToSpeak: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (!textToSpeak) return;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsAssistantSpeaking(true);
    utterance.onend = () => setIsAssistantSpeaking(false);
    utterance.onerror = () => setIsAssistantSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopAssistantSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsAssistantSpeaking(false);
  };

  const handleAssistantSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : assistantQuery).trim();
    if (!q) return;

    setIsAssistantSearching(true);
    setAssistantError(null);
    stopAssistantSpeaking();

    try {
      const res = await fetchApi("/api/assistant-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          logs,
          selectedYear,
          selectedMonth,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Erro ao consultar o assistente de busca.");
      }

      const data = await res.json();
      setAssistantResult(data);

      if (data.matchingDates && Array.isArray(data.matchingDates) && data.matchingDates.length > 0) {
        setHighlightedAssistantDates(new Set(data.matchingDates));
      }

      if (data.speechText) {
        speakAssistantAnswer(data.speechText);
      }
    } catch (err: any) {
      console.error("Erro assistente:", err);
      setAssistantError(err.message || "Não foi possível conectar ao assistente de busca.");
    } finally {
      setIsAssistantSearching(false);
    }
  };

  const startAssistantListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setAssistantError("Reconhecimento de voz não suportado neste navegador. Digite sua busca no campo de texto.");
      return;
    }

    try {
      if (assistantRecognitionRef.current) {
        try { assistantRecognitionRef.current.stop(); } catch(e){}
      }

      stopAssistantSpeaking();
      const rec = new SpeechRecognition();
      assistantRecognitionRef.current = rec;
      rec.lang = 'pt-BR';
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsAssistantListening(true);
        setAssistantError(null);
      };

      rec.onresult = (e: any) => {
        let transcript = '';
        for (let i = 0; i < e.results.length; ++i) {
          transcript += e.results[i][0].transcript + ' ';
        }
        const text = transcript.trim();
        setAssistantQuery(text);
        assistantLastQueryRef.current = text;
      };

      rec.onerror = (e: any) => {
        console.warn("Erro no microfone:", e.error);
        setIsAssistantListening(false);
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          setAssistantError(`Erro no microfone: ${e.error}`);
        }
      };

      rec.onend = () => {
        setIsAssistantListening(false);
        if (assistantLastQueryRef.current && assistantLastQueryRef.current.trim().length > 1) {
          handleAssistantSearch(assistantLastQueryRef.current);
        }
      };

      rec.start();
    } catch (err: any) {
      console.error("Erro ao iniciar microfone do assistente:", err);
      setIsAssistantListening(false);
      setAssistantError("Erro ao acessar o microfone.");
    }
  };

  const stopAssistantListening = () => {
    if (assistantRecognitionRef.current) {
      try { assistantRecognitionRef.current.stop(); } catch(e){}
    }
    setIsAssistantListening(false);
  };

  // Feedback Messages
  const [errorMessage, setErrorMessage] = useState('');

  // Persist to local storage
  useEffect(() => {
    localStorage.setItem('driver_daily_tracker_logs_v_clean', JSON.stringify(logs));
  }, [logs]);

  // (Automatic override of monthlyCarExpense by fixed expenses removed per user request)

  const handleClearAllData = async () => {
    // 1. Clear all localStorage keys related to this app
    const keysToRemove = [
      'driver_daily_tracker_logs_v_clean',
      'driver_car_profile_v2',
      'driver_fixed_expenses_v6_by_month'
    ];

    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Also clear any other keys that might be related to previous versions
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.includes('driver_') || k.includes('tracker'))) {
        localStorage.removeItem(k);
      }
    }

    // 2. Reset states to initial/clean values
    const cleanLogs = generateCleanEmptyYearLogs(selectedYear);
    setLogs(cleanLogs);
    setCarProfile(BLANK_CAR_PROFILE);
    setFixedExpensesByMonth({});

    // Explicitly persist blank clean states into localStorage
    try {
      localStorage.setItem('driver_daily_tracker_logs_v_clean', JSON.stringify(cleanLogs));
      localStorage.setItem('driver_car_profile_v2', JSON.stringify(BLANK_CAR_PROFILE));
      localStorage.setItem('driver_fixed_expenses_v6_by_month', JSON.stringify({}));
    } catch (e) {
      console.error(e);
    }

    setIsConfirmClearAllModalOpen(false);
    setIsHelpModalOpen(false);
    setSweepNotification('Todos os dados foram apagados com sucesso! Veículo, contas fixas e lançamentos zerados.');
    setTimeout(() => setSweepNotification(null), 8000);
  };

  const handleDeepSweep = async () => {
    const totalBefore = logs.length;
    let sanitizedCount = 0;

    // 1. Audit existing logs for consistency and sanitize NaNs
    const auditedLogs = logs.map(l => {
      const sanitized = sanitizeDailyLog(l);
      if (
        isNaN(l.kmRodado) || 
        isNaN(l.custoEnergia) || 
        isNaN(l.diariaCarro) || 
        isNaN(l.appUber?.earnings) || 
        isNaN(l.app99?.earnings) || 
        isNaN(l.appParticular?.earnings) ||
        isNaN(l.foodExpenses?.lunch) ||
        isNaN(l.carExpenses?.wash)
      ) {
        sanitizedCount++;
      }
      return sanitized;
    });

    // 2. Perform deep calendar sweep across the entire year
    const swept = performCalendarSweep(auditedLogs, selectedYear);
    const added = Math.max(0, swept.length - totalBefore);
    setLogs(swept);

    // 3. Compute detailed audit totals
    let totalGross = 0;
    let totalExpenses = 0;
    let totalKm = 0;
    let totalUber = 0;
    let total99 = 0;
    let totalParticular = 0;
    let totalExtras = 0;
    let totalEnergyCost = 0;
    let totalCarExpenses = 0;
    let totalFoodExpenses = 0;
    let totalDiaria = 0;
    let activeDays = 0;
    let offDays = 0;

    swept.forEach(l => {
      const uber = (l.appUber?.earnings || 0) + (l.appUber?.bonus || 0);
      const app99 = (l.app99?.earnings || 0) + (l.app99?.bonus || 0);
      const part = l.appParticular?.earnings || 0;
      const extras = (l.recompensasExtra || 0) + (l.outrasFontes || 0);
      const dayGross = uber + app99 + part + extras;
      const km = l.kmRodado || 0;

      const carExp = (l.carExpenses?.wash || 0) + (l.carExpenses?.toll || 0) + (l.carExpenses?.maintenance || 0) + (l.carExpenses?.parking || 0) + (l.carExpenses?.other || 0);
      const foodExp = (l.foodExpenses?.lunch || 0) + (l.foodExpenses?.dinner || 0) + (l.foodExpenses?.snacks || 0) + (l.foodExpenses?.coffee || 0);
      const energy = l.custoEnergia || 0;
      const diaria = l.diariaCarro || 0;
      const dayExpenses = carExp + foodExp + energy + diaria;

      totalGross += dayGross;
      totalUber += uber;
      total99 += app99;
      totalParticular += part;
      totalExtras += extras;
      totalKm += km;
      totalCarExpenses += carExp;
      totalFoodExpenses += foodExp;
      totalEnergyCost += energy;
      totalDiaria += diaria;
      totalExpenses += dayExpenses;

      if (dayGross > 0 || km > 0) {
        activeDays++;
      }
      if (l.isDayOff) {
        offDays++;
      }
    });

    const totalNet = totalGross - totalExpenses;

    // 4. Update Local Storage
    localStorage.setItem('driver_daily_tracker_logs_v_clean', JSON.stringify(swept));

    const cloudResult = 'Armazenamento Local 100% íntegro (Offline)';

    const report: DeepSweepReport = {
      year: selectedYear,
      totalDays: swept.length,
      activeDays,
      offDays,
      totalGross,
      totalNet,
      totalExpenses,
      totalKm,
      totalUber,
      total99,
      totalParticular,
      totalExtras,
      totalEnergyCost,
      totalCarExpenses,
      totalFoodExpenses,
      totalDiaria,
      sanitizedCount,
      missingDaysAdded: added,
      cloudStatus: cloudResult,
      timestamp: new Date().toLocaleString('pt-BR')
    };

    setDeepSweepReport(report);
    setIsDeepSweepModalOpen(true);
    setSweepNotification(`Varredura Profunda concluída! Auditados ${swept.length} dias de ${selectedYear}. Integridade e consistência 100% verificadas.`);
    setTimeout(() => setSweepNotification(null), 8000);
  };

  const handleManualSweep = () => {
    handleDeepSweep();
  };

  const handleConsolidateData = () => {
    const auditedLogs = logs.map(sanitizeDailyLog);

    const swept = performCalendarSweep(auditedLogs, selectedYear);
    setLogs(swept);
    setIsAllYear(true);

    const activeDays = swept.filter(l => l.kmRodado > 0 || l.appUber.earnings > 0 || l.app99.earnings > 0 || l.appParticular.earnings > 0).length;

    setSweepNotification(`Dados consolidados com sucesso! Auditados ${swept.length} dias do ano ${selectedYear} (${activeDays} dias com atividade). Exibindo totais acumulados e consolidados no painel.`);
    setTimeout(() => setSweepNotification(null), 8000);
  };

  // Handle auto-calculation of Energy Cost
  useEffect(() => {
    const sobrouNum = parseFloat(String(sobrouBateria).replace(',', '.'));
    const capNum = parseFloat(String(capacidadeBateria).replace(',', '.')) || parseFloat(carProfile.batteryCapacityKwh) || (carProfile.vehicleType === 'eletrico' ? 53.6 : 50);
    const valKwhNum = parseFloat(String(valorKwh).replace(',', '.')) || parseFloat(carProfile.kwhCostRate) || (carProfile.vehicleType === 'eletrico' ? 1.05 : 5.80);
    const kmNum = parseFloat(String(kmRodado).replace(',', '.'));

    if (!isEnergyCostOverridden) {
      const calcByBattery = () => {
        if (!isNaN(sobrouNum) && sobrouNum >= 0 && sobrouNum <= 100 && !isNaN(capNum) && !isNaN(valKwhNum) && capNum > 0) {
          const consumedPercent = Math.max(0, 100 - sobrouNum);
          const energyConsumed = (consumedPercent / 100) * capNum;
          return (energyConsumed * valKwhNum).toFixed(2);
        }
        return null;
      };

      const calcByKm = () => {
        if (!isNaN(kmNum) && kmNum > 0 && !isNaN(capNum) && !isNaN(valKwhNum) && capNum > 0) {
          const estimatedAutonomy = carProfile.estimatedAutonomyKm || (carProfile.vehicleType === 'eletrico' ? 300 : 500);
          const consumedPercent = Math.min(100, (kmNum / estimatedAutonomy) * 100);
          const energyConsumed = (consumedPercent / 100) * capNum;
          return (energyConsumed * valKwhNum).toFixed(2);
        }
        return null;
      };

      let newCost = null;
      if (lastEditedEnergyField === 'km') {
        newCost = calcByKm() || calcByBattery();
      } else {
        newCost = calcByBattery() || calcByKm();
      }

      if (newCost !== null) {
        setCustoEnergia(newCost);
      }
    }
  }, [sobrouBateria, capacidadeBateria, valorKwh, kmRodado, isEnergyCostOverridden, carProfile, lastEditedEnergyField]);

  // Form drop down sync helper when date changes
  const handleDateChange = (newDateStr: string) => {
    setFormDate(newDateStr);
    
    const [y, m, d] = newDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay(); // 0 = Domingo
    const isSunday = dayOfWeek === 0;

    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    const customDays = carProfile.customWorkDays?.[monthKey] || [];
    const isCustomWorkingDay = customDays.includes(d);

    const mExpenses = fixedExpensesByMonth[monthKey] || [];
    const mTotal = mExpenses.reduce((acc, curr) => acc + (curr.value || 0), 0);
    const effectiveCost = carProfile.monthlyCarExpense || 0;

    const { dailyRate } = getMonthWorkDaysAndRate(y, m, effectiveCost, customDays);
    const defaultValKwh = String(carProfile.kwhCostRate || (carProfile.vehicleType === 'eletrico' ? 1.05 : 5.50)).replace('.', ',');
    const defaultCap = String(carProfile.batteryCapacityKwh || (carProfile.vehicleType === 'eletrico' ? 53.6 : 50)).replace('.', ',');

    // Check if there is already a log for this date to edit
    const existing = logs.find(l => l.date === newDateStr);
    if (existing) {
      setEditingLogId(existing.id);
      setIsDayOff(existing.isDayOff);
      setSobrouBateria(existing.sobrouBateria !== undefined && existing.sobrouBateria !== null && existing.sobrouBateria > 0 ? String(existing.sobrouBateria).replace('.', ',') : '');
      // Harmonize energy fields with profile by default
      setValorKwh(defaultValKwh);
      setCapacidadeBateria(defaultCap);
      setKmRodado(existing.kmRodado && existing.kmRodado > 0 ? String(existing.kmRodado).replace('.', ',') : '');
      setCustoEnergia(existing.custoEnergia && existing.custoEnergia > 0 ? String(existing.custoEnergia).replace('.', ',') : '');
      
      // If we have custom days for this month, use them to decide daily rate
      let resolvedDailyRate = dailyRate;
      if (customDays.length > 0) {
        resolvedDailyRate = isCustomWorkingDay ? dailyRate : 0;
      } else {
        // Fallback to Sunday logic if no custom days defined
        resolvedDailyRate = isSunday ? 0 : dailyRate;
      }

      setDiariaCarro(existing.diariaCarro && existing.diariaCarro > 0 ? String(existing.diariaCarro) : String(resolvedDailyRate));
      
      setWash(existing.carExpenses?.wash && existing.carExpenses.wash > 0 ? String(existing.carExpenses.wash) : '');
      setToll(existing.carExpenses?.toll && existing.carExpenses.toll > 0 ? String(existing.carExpenses.toll) : '');
      setMaintenance(existing.carExpenses?.maintenance && existing.carExpenses.maintenance > 0 ? String(existing.carExpenses.maintenance) : '');
      setParking(existing.carExpenses?.parking && existing.carExpenses.parking > 0 ? String(existing.carExpenses.parking) : '');
      setCarOther(existing.carExpenses?.other && existing.carExpenses.other > 0 ? String(existing.carExpenses.other) : '');

      setLunch(existing.foodExpenses?.lunch && existing.foodExpenses.lunch > 0 ? String(existing.foodExpenses.lunch) : '');
      setDinner(existing.foodExpenses?.dinner && existing.foodExpenses.dinner > 0 ? String(existing.foodExpenses.dinner) : '');
      setSnacks(existing.foodExpenses?.snacks && existing.foodExpenses.snacks > 0 ? String(existing.foodExpenses.snacks) : '');
      setCoffee(existing.foodExpenses?.coffee && existing.foodExpenses.coffee > 0 ? String(existing.foodExpenses.coffee) : '');

      setURides(existing.appUber.rides && existing.appUber.rides > 0 ? String(existing.appUber.rides) : '');
      setUEarnings(existing.appUber.earnings && existing.appUber.earnings > 0 ? String(existing.appUber.earnings) : '');
      setUBonus(existing.appUber.bonus && existing.appUber.bonus > 0 ? String(existing.appUber.bonus) : '');

      setNRides(existing.app99.rides && existing.app99.rides > 0 ? String(existing.app99.rides) : '');
      setNEarnings(existing.app99.earnings && existing.app99.earnings > 0 ? String(existing.app99.earnings) : '');
      setNBonus(existing.app99.bonus && existing.app99.bonus > 0 ? String(existing.app99.bonus) : '');

      setPRides(existing.appParticular.rides && existing.appParticular.rides > 0 ? String(existing.appParticular.rides) : '');
      setPEarnings(existing.appParticular.earnings && existing.appParticular.earnings > 0 ? String(existing.appParticular.earnings) : '');

      setRecompensasExtra(existing.recompensasExtra && existing.recompensasExtra > 0 ? String(existing.recompensasExtra) : '');
      setOutrasFontes(existing.outrasFontes && existing.outrasFontes > 0 ? String(existing.outrasFontes) : '');
      setExibirNoGeral(existing.exibirNoGeral);
      setIsEnergyCostOverridden(true); // Treat as manual load
    } else {
      // It's a new entry for this date - pre-fill based on work routine
      setEditingLogId(null);
      
      let resolvedDailyRate = dailyRate;
      let resolvedIsDayOff = isSunday;

      if (customDays.length > 0) {
        resolvedIsDayOff = !isCustomWorkingDay;
        resolvedDailyRate = isCustomWorkingDay ? dailyRate : 0;
      } else {
        resolvedDailyRate = isSunday ? 0 : dailyRate;
      }

      setIsDayOff(resolvedIsDayOff);
      setSobrouBateria('');
      setValorKwh(defaultValKwh);
      setCapacidadeBateria(defaultCap);
      setKmRodado('');
      setDiariaCarro(resolvedDailyRate > 0 ? String(resolvedDailyRate) : '');
      setCustoEnergia('');
      
      setWash('');
      setToll('');
      setMaintenance('');
      setParking('');
      setPublicCharging('');
      setCarOther('');

      // Leave food expenses clean and empty (no zero pre-fills)
      setLunch('');
      setDinner('');
      setSnacks('');
      setCoffee('');

      setURides('');
      setUEarnings('');
      setUBonus('');
      setNRides('');
      setNEarnings('');
      setNBonus('');
      setPRides('');
      setPEarnings('');
      setRecompensasExtra('');
      setOutrasFontes('');
      setExibirNoGeral(true);
      setIsEnergyCostOverridden(false);
    }
  };

  // Explicitly load / reload vehicle profile data into the current entry form
  const handleLoadCarDataIntoEntry = () => {
    const defaultValKwh = String(carProfile.kwhCostRate || (carProfile.vehicleType === 'eletrico' ? 1.05 : 5.50)).replace('.', ',');
    const defaultCap = String(carProfile.batteryCapacityKwh || (carProfile.vehicleType === 'eletrico' ? 53.6 : 50)).replace('.', ',');
    
    setValorKwh(defaultValKwh);
    setCapacidadeBateria(defaultCap);
    
    const [y, m, d] = (formDate || '').split('-').map(Number);
    if (y && m) {
      const dateObj = new Date(y, m - 1, d || 1);
      const dayOfWeek = dateObj.getDay();
      const isSunday = dayOfWeek === 0;
      
      const { dailyRate } = getMonthWorkDaysAndRate(y, m, getEffectiveMonthlyCost(y, m));
      if (!isDayOff && !isSunday) {
        setDiariaCarro(String(dailyRate));
      }
    }

    const capNum = parseFloat(defaultCap);
    const valKwhNum = parseFloat(defaultValKwh);
    const sobrouNum = parseFloat(String(sobrouBateria).replace(',', '.'));
    const kmNum = parseFloat(String(kmRodado).replace(',', '.'));

    if (!isNaN(sobrouNum) && sobrouNum >= 0 && sobrouNum <= 100 && capNum > 0) {
      const consumedPercent = Math.max(0, 100 - sobrouNum);
      const energyConsumed = (consumedPercent / 100) * capNum;
      setCustoEnergia((energyConsumed * valKwhNum).toFixed(2));
      setIsEnergyCostOverridden(false);
    } else if (!isNaN(kmNum) && kmNum > 0 && capNum > 0) {
      const estimatedAutonomy = carProfile.estimatedAutonomyKm || (carProfile.vehicleType === 'eletrico' ? 300 : 500);
      const consumedPercent = Math.min(100, (kmNum / estimatedAutonomy) * 100);
      const energyConsumed = (consumedPercent / 100) * capNum;
      setCustoEnergia((energyConsumed * valKwhNum).toFixed(2));
      setIsEnergyCostOverridden(false);
    }

    setSweepNotification(`🚗 Dados do veículo (${carProfile.modelName || 'Cadastrado'}) carregados com sucesso no lançamento!`);
    setTimeout(() => setSweepNotification(null), 4000);
  };

  // Batch apply calculated daily rate to all working days of a specific month
  const handleApplyMonthlyCarRateToAllDays = (monthToApply: number, yearToApply: number, customMonthlyTotal?: number) => {
    // If customMonthlyTotal not passed, check if there are fixed expenses in that month
    const mKey = `${yearToApply}-${monthToApply}`;
    const monthExpenses = fixedExpensesByMonth[mKey] || [];
    const monthFixedSum = monthExpenses.reduce((sum, item) => sum + item.value, 0);

    const costToUse = (typeof customMonthlyTotal === 'number' && customMonthlyTotal >= 0)
      ? customMonthlyTotal
      : (monthFixedSum > 0 ? monthFixedSum : (carProfile.monthlyCarExpense || 0));

    const monthKey = `${yearToApply}-${String(monthToApply).padStart(2, '0')}`;
    const customDays = carProfile.customWorkDays?.[monthKey] || [];

    const { dailyRate, workDaysCount, monthlyTotalCost } = getMonthWorkDaysAndRate(yearToApply, monthToApply, costToUse, customDays);

    // Update car profile monthly expense to match if synced
    if (costToUse > 0) {
      setCarProfile(prev => ({
        ...prev,
        monthlyCarExpense: costToUse
      }));
    }

    setLogs(prevLogs => {
      return prevLogs.map(log => {
        const [y, m, d] = log.date.split('-').map(Number);
        if (y === yearToApply && m === monthToApply) {
          let isWorkingDay;
          if (customDays.length > 0) {
            isWorkingDay = customDays.includes(d);
          } else {
            isWorkingDay = new Date(y, m - 1, d).getDay() !== 0; // Default Mon-Sat
          }

          return {
            ...log,
            isDayOff: !isWorkingDay,
            diariaCarro: isWorkingDay ? dailyRate : 0,
            valorKwh: carProfile.kwhCostRate || (carProfile.vehicleType === 'eletrico' ? 1.05 : 5.50),
            capacidadeBateria: carProfile.batteryCapacityKwh || (carProfile.vehicleType === 'eletrico' ? 53.6 : 50),
            veiculoNome: carProfile.modelName || ''
          };
        }
        return log;
      });
    });

    setSweepNotification(`Rateio de ${formatBRL(monthlyTotalCost)} dividido em ${workDaysCount} dias selecionados: diária de ${formatBRL(dailyRate)} sincronizada em ${MONTH_NAMES[monthToApply - 1]}/${yearToApply}!`);
    setTimeout(() => setSweepNotification(null), 5000);
  };

  // Replicate August standard structure (R$ 7.093,05 fixed expenses, Seg-Sáb rateio, Sundays off) across ALL 12 months
  const handleApplyAugustToAllMonths = () => {
    const augustExpenses: FixedExpense[] = [
      { id: '1', name: 'Financiamento', value: 4000.00, installments: '14/60' },
      { id: '2', name: 'Seguro', value: 698.00 },
      { id: '3', name: 'MEI', value: 87.05 },
      { id: '4', name: 'IPVA', value: 750.00 },
      { id: '6', name: 'Estacionamento', value: 260.00 },
      { id: '7', name: 'Preventiva', value: 700.00 },
      { id: '8', name: 'Film', value: 50.00, installments: '06/12' },
      { id: '9', name: 'Pneu', value: 126.00, installments: '06/10' },
      { id: '10', name: 'Suspensão', value: 259.00, installments: '06/06' },
      { id: '11', name: 'Mão de obra Susp', value: 163.00, installments: '06/06' },
    ];
    const augustTotalCost = augustExpenses.reduce((acc, item) => acc + item.value, 0); // 7093.05

    // 1. Update fixed expenses for all 12 months
    const updatedFixed: Record<string, FixedExpense[]> = {};
    for (let m = 1; m <= 12; m++) {
      const pad = (n: number) => String(n).padStart(2, '0');
      updatedFixed[`${selectedYear}-${m}`] = [
        { id: '1', name: 'Financiamento', value: 4000.00, installments: `${pad(m + 6)}/60` },
        { id: '2', name: 'Seguro', value: 698.00 },
        { id: '3', name: 'MEI', value: 87.05 },
        { id: '4', name: 'IPVA', value: 750.00 },
        { id: '6', name: 'Estacionamento', value: 260.00 },
        { id: '7', name: 'Preventiva', value: 700.00 },
        { id: '8', name: 'Film', value: 50.00, installments: `${pad(m)}/12` },
        { id: '9', name: 'Pneu', value: 126.00, installments: `${pad(Math.min(m, 10))}/10` },
        { id: '10', name: 'Suspensão', value: 259.00, installments: '06/06' },
        { id: '11', name: 'Mão de obra Susp', value: 163.00, installments: '06/06' },
      ];
    }
    setFixedExpensesByMonth(updatedFixed);
    try {
      localStorage.setItem('driver_fixed_expenses_v6_by_month', JSON.stringify(updatedFixed));
    } catch (e) {
      console.error(e);
    }

    // 2. Recalculate daily rate for each month & apply to all days
    setLogs(prevLogs => {
      return prevLogs.map(log => {
        const [y, m, d] = log.date.split('-').map(Number);
        if (y === selectedYear) {
          const dayOfWeek = new Date(y, m - 1, d).getDay();
          const { dailyRate } = getMonthWorkDaysAndRate(y, m, augustTotalCost);

          if (dayOfWeek === 0) {
            // Sunday is always Day Off with R$ 0 diaria
            return {
              ...log,
              isDayOff: true,
              diariaCarro: 0,
              valorKwh: 1.05,
            };
          } else {
            // Monday to Saturday working day
            return {
              ...log,
              isDayOff: false,
              diariaCarro: dailyRate,
              valorKwh: 1.05,
            };
          }
        }
        return log;
      });
    });

    setCarProfile(prev => ({
      ...prev,
      monthlyCarExpense: augustTotalCost
    }));

    setSweepNotification(`✨ Todos os 12 meses foram padronizados igual a Agosto! Contas de ${formatBRL(augustTotalCost)} e diárias sincronizadas conforme calendário de trabalho.`);
    setTimeout(() => setSweepNotification(null), 6000);
  };

  // Open modal for a specific date
  const openModalForDate = (dateStr: string) => {
    handleDateChange(dateStr);
    setIsModalOpen(true);
    setModalDeleteStage(0);
    setConfirmPrevDayPrompt(false);
    setPrevDayPromptInfo(null);
    setErrorMessage('');
    setAiLoading(false);
    setAiSuccessMsg(null);
    setAiErrorMsg(null);
    setCameraActive(false);
    if (cameraStream) {
      try {
        cameraStream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.error(e);
      }
      setCameraStream(null);
    }
    setVoiceRecording(false);
    setVoiceLoading(false);
    setVoiceSuccessMsg(null);
    setVoiceErrorMsg(null);
    setVoiceTranscribedText(null);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        console.error(e);
      }
    }
    setTimeout(() => {
      handleLoadCarDataIntoEntry();
    }, 0);
  };

  // Export Excel / CSV backup matching table data exactly
  const handleExportExcelBackup = (type: 'total' | 'period', startDate?: string, endDate?: string) => {
    let logsToExport = logs;

    if (type === 'period' && startDate && endDate) {
      logsToExport = logs.filter(log => log.date >= startDate && log.date <= endDate);
    }

    if (logsToExport.length === 0) {
      alert("Não há registros para exportar no período selecionado.");
      return;
    }

    const carProfileHeaders = [
      "DADOS DO VEÍCULO",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ];

    const carProfileData = [
      ["Modelo", carProfile.modelName],
      ["Placa", carProfile.licensePlate],
      ["Tipo", carProfile.vehicleType === 'eletrico' ? 'Elétrico' : 'Combustão'],
      ["Ano", carProfile.manufactureYear],
      ["Cor", carProfile.color],
      ["Propriedade", carProfile.ownershipType === 'proprio' ? 'Próprio' : 'Alugado'],
      ["KM Atual", carProfile.currentKm],
      ["Capacidade Bateria/Tanque", carProfile.batteryCapacityKwh],
      ["Autonomia Estimada", carProfile.estimatedAutonomyKm],
      ["Custo Energia/Litro", carProfile.kwhCostRate],
      ["Custo Semanal/Aluguel", carProfile.rentalOrWeeklyRate],
      ["Gasto Mensal Estimado", carProfile.monthlyCarExpense],
      ["Próxima Manutenção", carProfile.nextMaintenanceKm],
      ["Seguradora", carProfile.insurerName],
      ["Apólice", carProfile.insurancePolicyNumber],
      ["Notas", carProfile.notes],
      ["", ""], // Empty row for separation
    ];

    const fixedExpensesData: string[][] = [];
    const monthsInLogs = new Set(logsToExport.map(l => l.date.substring(0, 7)));
    const relevantFixedExpenses = Object.entries(fixedExpensesByMonth)
      .filter(([mKey]) => monthsInLogs.has(mKey))
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (relevantFixedExpenses.length > 0) {
      fixedExpensesData.push(["DESPESAS FIXAS REGISTRADAS NO PERÍODO", "", "", ""]);
      fixedExpensesData.push(["Mês/Ano", "Nome da Despesa", "Valor", "Parcelas"]);
      relevantFixedExpenses.forEach(([mKey, expenses]) => {
        const [y, m] = mKey.split('-');
        (expenses as any[]).forEach(exp => {
          fixedExpensesData.push([`${m}/${y}`, exp.name, String(exp.value), exp.installments || "-"]);
        });
      });
      fixedExpensesData.push(["", "", "", ""]);
    }

    fixedExpensesData.push(["RELATÓRIO DE LANÇAMENTOS DIÁRIOS", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);

    const headers = [
      "Data",
      "Dia da Semana",
      "Status",
      "KM Rodados",
      carProfile.vehicleType === 'eletrico' ? "Custo Bateria" : "Custo Combustível",
      "Diária Carro",
      "Lava-jato",
      "Pedágio",
      "Estacionamento",
      "Recarga Externa",
      "Manutenção",
      "Outros Carro",
      "Almoço",
      "Jantar",
      "Lanches",
      "Café",
      "Qtd 99",
      "Ganhos 99",
      "Bônus 99",
      "Qtd Uber",
      "Ganhos Uber",
      "Bônus Uber",
      "Qtd Part.",
      "Ganhos Part.",
      "Recompensas",
      "Outras Fontes (Anjo)",
      "Faturamento Bruto",
      "Resultado Líquido"
    ];

    const rows = logsToExport.sort((a, b) => a.date.localeCompare(b.date)).map(log => {
      const uTotal = log.appUber.earnings + log.appUber.bonus;
      const nTotal = log.app99.earnings + log.app99.bonus;
      const pTotal = log.appParticular.earnings;
      const recomp = log.recompensasExtra || 0;
      const anjo = log.outrasFontes || 0;
      const gross = uTotal + nTotal + pTotal + recomp + anjo;

      const carWash = log.carExpenses?.wash || 0;
      const carToll = log.carExpenses?.toll || 0;
      const carPark = log.carExpenses?.parking || 0;
      const carCharge = log.carExpenses?.publicCharging || 0;
      const carMaint = log.carExpenses?.maintenance || 0;
      const carOther = log.carExpenses?.other || 0;
      const carExpensesSum = carWash + carToll + carPark + carCharge + carMaint + carOther;

      const fLunch = log.foodExpenses?.lunch || 0;
      const fDinner = log.foodExpenses?.dinner || 0;
      const fSnacks = log.foodExpenses?.snacks || 0;
      const fCoffee = log.foodExpenses?.coffee || 0;
      const foodExpensesSum = fLunch + fDinner + fSnacks + fCoffee;

      const otherCosts = (log.diariaCarro || 0) + carExpensesSum + foodExpensesSum;
      const net = gross - ((log.custoEnergia || 0) + otherCosts);
      const isOff = Boolean(log.isDayOff);
      const workedOnOffDay = isOff && (gross > 0 || (log.kmRodado || 0) > 0);
      const statusText = workedOnOffDay ? "Folga Trabalhada" : isOff ? "Folga" : "Trabalhado";
      const dayOfWeek = WEEK_DAYS[new Date(log.date + 'T00:00:00').getDay()];

      return [
        log.date.split('-').reverse().join('/'),
        dayOfWeek,
        statusText,
        log.kmRodado || 0,
        log.custoEnergia || 0,
        log.diariaCarro || 0,
        carWash,
        carToll,
        carPark,
        carCharge,
        carMaint,
        carOther,
        fLunch,
        fDinner,
        fSnacks,
        fCoffee,
        log.app99.rides || 0,
        log.app99.earnings || 0,
        log.app99.bonus || 0,
        log.appUber.rides || 0,
        log.appUber.earnings || 0,
        log.appUber.bonus || 0,
        log.appParticular.rides || 0,
        pTotal,
        recomp,
        anjo,
        gross,
        net
      ];
    });

    const csvContent = "\uFEFF" + [
      ...carProfileData.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")),
      ...fixedExpensesData.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")),
      headers.join(";"),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GKD_Controle_Diario_Backup_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open modal for today
  const handleOpenNewLog = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const realY = today.getFullYear();
    const realM = today.getMonth() + 1;
    const realD = today.getDate();
    setSelectedYear(realY);
    setSelectedMonth(realM);
    setIsAllYear(false);
    const todayStr = `${realY}-${pad(realM)}-${pad(realD)}`;
    openModalForDate(todayStr);
  };

  const handleDeleteLog = () => {
    if (!formDate) return;
    const logToDelete = logs.find(l => l.date === formDate);
    if (logToDelete && logToDelete.kmRodado > 0) {
      setCarProfile(prev => ({
        ...prev,
        currentKm: Math.max(0, Math.round((prev.currentKm || 0) - logToDelete.kmRodado))
      }));
    }
    const dateFormatted = formDate.split('-').reverse().join('/');
    
    const [y, m] = formDate.split('-').map(Number);
    const { dailyRate } = getMonthWorkDaysAndRate(y, m, getEffectiveMonthlyCost(y, m));
    const defValKwh = carProfile.vehicleType === 'eletrico' ? (carProfile.kwhCostRate || 1.05) : 5.80;
    const defCap = carProfile.vehicleType === 'eletrico' ? (carProfile.batteryCapacityKwh || 53.6) : 50;

    const zeroedLog: DailyLog = {
      id: formDate,
      date: formDate,
      isDayOff: false,
      sobrouBateria: 0,
      valorKwh: defValKwh,
      capacidadeBateria: defCap,
      kmRodado: 0,
      custoEnergia: 0,
      diariaCarro: dailyRate || 0,
      carExpenses: { wash: 0, toll: 0, maintenance: 0, parking: 0, publicCharging: 0, other: 0 },
      foodExpenses: { lunch: 0, dinner: 0, snacks: 0, coffee: 0 },
      app99: { rides: 0, earnings: 0, bonus: 0 },
      appUber: { rides: 0, earnings: 0, bonus: 0 },
      appParticular: { rides: 0, earnings: 0 },
      recompensasExtra: 0,
      outrasFontes: 0,
      exibirNoGeral: true
    };

    setLogs(prev => {
      const filtered = prev.filter(l => l.date !== formDate);
      return [...filtered, zeroedLog].sort((a, b) => a.date.localeCompare(b.date));
    });

    setIsModalOpen(false);
    setConfirmingDeleteLogDate(null);
    setSweepNotification(`Dados do dia ${dateFormatted} foram limpos com sucesso!`);
    setTimeout(() => setSweepNotification(null), 4000);
  };

  // Form Submit / Save
  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate) {
      setErrorMessage('Por favor, defina a data do lançamento.');
      return;
    }

    if (!confirmPrevDayPrompt) {
      const [y, m, d] = formDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() - 1);
      const pad = (n: number) => String(n).padStart(2, '0');
      const prevDateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;

      const prevLog = logs.find(l => l.date === prevDateStr);
      const hasPrevData = prevLog && (
        prevLog.kmRodado > 0 ||
        prevLog.isDayOff ||
        prevLog.appUber.earnings > 0 ||
        prevLog.app99.earnings > 0 ||
        prevLog.appParticular.earnings > 0 ||
        (Object.values(prevLog.carExpenses) as number[]).some(v => v > 0) ||
        (Object.values(prevLog.foodExpenses) as number[]).some(v => v > 0) ||
        prevLog.diariaCarro > 0 ||
        prevLog.recompensasExtra > 0 ||
        prevLog.outrasFontes > 0
      );

      if (!hasPrevData && (!editingLogId || editingLogId === formDate)) {
        setPrevDayPromptInfo({ prevDateStr, formDate });
        setConfirmPrevDayPrompt(true);
        return;
      }
    }

    executeSaveLog(formDate);
  };

  const executeSaveLog = (targetDate: string, skipHighKmCheck: boolean = false, customKm?: number) => {
    setConfirmPrevDayPrompt(false);
    setPrevDayPromptInfo(null);

    const parseNum = (val: any) => {
      if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * 100) / 100;
      if (!val) return 0;
      const cleaned = String(val).replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
    };

    const parsedKm = customKm !== undefined ? Math.round(customKm) : Math.round(parseNum(kmRodado));
    if (customKm !== undefined) {
      setKmRodado(String(Math.round(customKm)));
    }

    if (!skipHighKmCheck && parsedKm > 300) {
      setConfirmHighKmPrompt(true);
      setHighKmTargetDate(targetDate);
      return;
    }

    setConfirmHighKmPrompt(false);
    setHighKmTargetDate('');

    const parseI = (val: string) => {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 0 : parsed;
    };

    const parsedSobrou = parseNum(sobrouBateria);
    const parsedValKwh = parseNum(valorKwh) || parseFloat(carProfile.kwhCostRate) || 1.05;
    const parsedCap = parseNum(capacidadeBateria) || parseFloat(carProfile.batteryCapacityKwh) || 53.6;
    let finalCustoEnergia = parseNum(custoEnergia);

    if (parsedKm > 0 && finalCustoEnergia <= 0) {
      const consumedPercent = parsedSobrou > 0 && parsedSobrou < 100 ? (100 - parsedSobrou) : Math.min(95, (parsedKm / (carProfile.estimatedAutonomyKm || 300)) * 100);
      const energyConsumed = (consumedPercent / 100) * parsedCap;
      finalCustoEnergia = parseFloat((energyConsumed * parsedValKwh).toFixed(2));
    }

    const newLog: DailyLog = {
      id: targetDate,
      date: targetDate,
      isDayOff,
      sobrouBateria: parsedSobrou,
      valorKwh: parsedValKwh,
      capacidadeBateria: parsedCap,
      kmRodado: parsedKm,
      custoEnergia: finalCustoEnergia,
      diariaCarro: isDayOff ? 0 : parseNum(diariaCarro),
      carExpenses: {
        wash: parseNum(wash),
        toll: parseNum(toll),
        maintenance: parseNum(maintenance),
        parking: parseNum(parking),
        publicCharging: parseNum(publicCharging),
        other: parseNum(carOther),
      },
      foodExpenses: {
        lunch: parseNum(lunch),
        dinner: parseNum(dinner),
        snacks: parseNum(snacks),
        coffee: parseNum(coffee),
      },
      app99: {
        rides: parseI(nRides),
        earnings: parseNum(nEarnings),
        bonus: parseNum(nBonus)
      },
      appUber: {
        rides: parseI(uRides),
        earnings: parseNum(uEarnings),
        bonus: parseNum(uBonus)
      },
      appParticular: {
        rides: parseI(pRides),
        earnings: parseNum(pEarnings)
      },
      recompensasExtra: parseNum(recompensasExtra),
      outrasFontes: parseNum(outrasFontes),
      exibirNoGeral
    };

    // Automatically update car's current KM by the difference in kmRodado
    const previousLog = logs.find(l => l.date === targetDate);
    const previousKm = previousLog ? (previousLog.kmRodado || 0) : 0;
    const kmDiff = newLog.kmRodado - previousKm;

    if (kmDiff !== 0) {
      setCarProfile(prev => ({
        ...prev,
        currentKm: Math.max(0, Math.round((prev.currentKm || 0) + kmDiff))
      }));
    }

    setLogs(prev => {
      const filtered = prev.filter(l => l.date !== targetDate);
      return [...filtered, newLog].sort((a, b) => a.date.localeCompare(b.date));
    });

    setIsHistorySectionOpen(true);
    setHighlightedRowId(targetDate);
    setIsModalOpen(false);
  };

  // Calculations for current selected month/year or whole year
  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      const [y, m] = log.date.split('-').map(Number);
      if (isAllYear) {
        return y === selectedYear;
      }
      return y === selectedYear && m === selectedMonth;
    });
  }, [logs, isAllYear, selectedYear, selectedMonth]);

  // Fast map lookup by date
  const logsByDate = React.useMemo(() => {
    const map = new Map<string, DailyLog>();
    filteredLogs.forEach(l => map.set(l.date, l));
    return map;
  }, [filteredLogs]);

  // Calculate totals memoized
  const totals = React.useMemo(() => {
    let totalGrossEarnings = 0;
    let totalEnergyCost = 0;
    let totalCarRental = 0;
    let totalCarExpenses = 0;
    let totalFoodExpenses = 0;
    let totalKM = 0;
    let totalRides = 0;

    // App specific totals
    let uberTotal = 0;
    let uberRides = 0;
    let app99Total = 0;
    let app99Rides = 0;
    let particularTotal = 0;
    let particularRides = 0;
    let totalRecompensas = 0;
    let totalAnjo = 0;
    let totalOperationalEarnings = 0;

    let totalWorkingDays = 0;
    let totalOffDays = 0;
    let elapsedWorkingDays = 0;

    const todayStr = new Date().toISOString().slice(0, 10);

    filteredLogs.forEach(log => {
      const isOff = Boolean(log.isDayOff);
      if (isOff) {
        totalOffDays++;
      } else {
        totalWorkingDays++;
      }

      const dayCarExpenses = (Object.values(log.carExpenses || {}) as number[]).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
      const dayFoodExpenses = (Object.values(log.foodExpenses || {}) as number[]).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);

      const uTotal = (log.appUber?.earnings || 0) + (log.appUber?.bonus || 0);
      const nTotal = (log.app99?.earnings || 0) + (log.app99?.bonus || 0);
      const pTotal = (log.appParticular?.earnings || 0);
      const recomp = log.recompensasExtra || 0;
      const anjo = log.outrasFontes || 0;
      const gross = uTotal + nTotal + pTotal + recomp + anjo;
      const otherCosts = log.diariaCarro + dayCarExpenses + dayFoodExpenses;
      const net = gross - (log.custoEnergia + otherCosts);

      const hasActivity = (log.kmRodado > 0) ||
        (gross > 0) ||
        (dayFoodExpenses > 0) ||
        (dayCarExpenses > 0);

      if (!isOff && (hasActivity || log.date <= todayStr)) {
        elapsedWorkingDays++;
      }

      if (log.exibirNoGeral !== false) {
        // Gross App Earnings
        const uTotal = (log.appUber?.earnings || 0) + (log.appUber?.bonus || 0);
        const nTotal = (log.app99?.earnings || 0) + (log.app99?.bonus || 0);
        const pTotal = (log.appParticular?.earnings || 0);
        const recomp = log.recompensasExtra || 0;
        const anjo = log.outrasFontes || 0;
        
        uberTotal += uTotal;
        uberRides += (log.appUber?.rides || 0);

        app99Total += nTotal;
        app99Rides += (log.app99?.rides || 0);

        particularTotal += pTotal;
        particularRides += (log.appParticular?.rides || 0);

        totalRecompensas += recomp;
        totalAnjo += anjo;

        const dayOp = uTotal + nTotal + pTotal + recomp;
        totalOperationalEarnings += dayOp;
        totalGrossEarnings += (dayOp + anjo);
        totalRides += ((log.appUber?.rides || 0) + (log.app99?.rides || 0) + (log.appParticular?.rides || 0));
      }

      // Costs
      totalEnergyCost += (log.custoEnergia || 0);
      totalCarRental += (log.diariaCarro || 0);
      
      totalCarExpenses += dayCarExpenses;
      totalFoodExpenses += dayFoodExpenses;

      totalKM += (log.kmRodado || 0);
    });

    const totalVariableCosts = totalEnergyCost + totalCarExpenses + totalFoodExpenses;

    const totalFixedExpenses = isAllYear 
      ? Array.from(new Set(filteredLogs.map(l => l.date.slice(0, 7)))).reduce((acc: number, monthStr: string) => {
          const [y, m] = monthStr.split('-').map(Number);
          const mKey = `${y}-${m}`;
          const mList = fixedExpensesByMonth[mKey] || [];
          return acc + mList.reduce((sum, item) => sum + item.value, 0);
        }, 0)
      : fixedExpenses.reduce((sum, item) => sum + item.value, 0);

    const effectiveFixedCosts = totalCarRental + totalFixedExpenses;
    const totalCosts = totalVariableCosts + effectiveFixedCosts;

    // Total daily operational net (exact sum of all table row nets)
    const totalDailyNet = totalGrossEarnings - totalVariableCosts - totalCarRental;
    const netOperational = totalGrossEarnings - totalVariableCosts;
    const realNetEarnings = totalGrossEarnings - totalCosts;

    const profitMargin = totalGrossEarnings > 0 ? (netOperational / totalGrossEarnings) * 100 : 0;
    const realProfitMargin = totalGrossEarnings > 0 ? (realNetEarnings / totalGrossEarnings) * 100 : 0;

    // Efficiency metrics
    const earningsPerKM = totalKM > 0 ? (totalGrossEarnings - totalAnjo) / totalKM : 0;
    const energyCostPerKM = totalKM > 0 ? totalEnergyCost / totalKM : 0;
    const netEarningsPerKM = totalKM > 0 ? realNetEarnings / totalKM : 0;
    const dailyFoodAverage = elapsedWorkingDays > 0 ? totalFoodExpenses / elapsedWorkingDays : (totalWorkingDays > 0 ? totalFoodExpenses / totalWorkingDays : 0);

    return {
      totalGrossEarnings,
      totalEnergyCost,
      totalCarRental,
      totalCarExpenses,
      totalFoodExpenses,
      totalKM: Math.round(totalKM * 100) / 100,
      totalRides,
      uberTotal,
      uberRides,
      app99Total,
      app99Rides,
      particularTotal,
      particularRides,
      totalRecompensas,
      totalAnjo,
      totalOperationalEarnings,
      totalWorkingDays,
      totalOffDays,
      elapsedWorkingDays,
      dailyFoodAverage,
      totalVariableCosts,
      totalFixedExpenses,
      effectiveFixedCosts,
      totalCosts,
      totalDailyNet,
      netOperational,
      realNetEarnings,
      profitMargin,
      realProfitMargin,
      earningsPerKM,
      energyCostPerKM,
      netEarningsPerKM
    };
  }, [filteredLogs, isAllYear, fixedExpensesByMonth, fixedExpenses]);

  const {
    totalGrossEarnings,
    totalEnergyCost,
    totalCarRental,
    totalCarExpenses,
    totalFoodExpenses,
    totalKM,
    totalRides,
    uberTotal,
    uberRides,
    app99Total,
    app99Rides,
    particularTotal,
    particularRides,
    totalRecompensas,
    totalAnjo,
    totalOperationalEarnings,
    totalWorkingDays,
    totalOffDays,
    elapsedWorkingDays,
    dailyFoodAverage,
    totalVariableCosts,
    totalFixedExpenses,
    effectiveFixedCosts,
    totalCosts,
    totalDailyNet,
    netOperational,
    realNetEarnings,
    profitMargin,
    realProfitMargin,
    earningsPerKM,
    energyCostPerKM,
    netEarningsPerKM
  } = totals;

  // Helper formatting BRL
  const formatBRL = React.useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }, []);

  const formatKM = React.useCallback((value: number | string | undefined | null) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value || 0).replace(',', '.'));
    if (isNaN(num) || num === 0) return '0 KM';
    const rounded = Math.round(num);
    return `${rounded.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KM`;
  }, []);

  // Month navigation
  const handlePrevMonth = () => {
    if (isAllYear) {
      setIsAllYear(false);
      return;
    }
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (isAllYear) {
      setIsAllYear(false);
      return;
    }
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  // Helper to construct dates for the monthly calendar view
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const firstDayIndex = new Date(selectedYear, selectedMonth - 1, 1).getDay(); // Day of week index 0-6

  // Generate complete days list memoized
  const calendarDays = React.useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const days = [];
    for (let d = 1; d <= daysInSelectedMonth; d++) {
      const dateStr = `${selectedYear}-${pad(selectedMonth)}-${pad(d)}`;
      const log = logsByDate.get(dateStr);
      days.push({
        day: d,
        dateStr,
        log,
        isSunday: new Date(selectedYear, selectedMonth - 1, d).getDay() === 0
      });
    }
    return days;
  }, [selectedYear, selectedMonth, daysInSelectedMonth, logsByDate]);

  // Prep Chart Data memoized (Chronological daily or monthly profits)
  const chartData = React.useMemo(() => {
    if (isAllYear) {
      return Array.from({ length: 12 }, (_, i) => {
        const mNum = i + 1;
        const mLogs = logs.filter(l => {
          const [y, m] = l.date.split('-').map(Number);
          return y === selectedYear && m === mNum;
        });
        let gross = 0;
        let cost = 0;
        mLogs.forEach(log => {
          if (log.exibirNoGeral) {
            const uTotal = log.appUber.earnings + log.appUber.bonus;
            const nTotal = log.app99.earnings + log.app99.bonus;
            const pTotal = log.appParticular.earnings;
            gross += uTotal + nTotal + pTotal + (log.recompensasExtra || 0) + (log.outrasFontes || 0);
          }
          const carExpensesSum = (Object.values(log.carExpenses) as number[]).reduce((a, b) => a + b, 0);
          const foodExpensesSum = (Object.values(log.foodExpenses) as number[]).reduce((a, b) => a + b, 0);
          cost += log.custoEnergia + log.diariaCarro + carExpensesSum + foodExpensesSum;
        });
        return {
          name: MONTH_NAMES[i].slice(0, 3),
          Faturamento: gross,
          Custos: cost,
          Lucro: gross - cost
        };
      });
    }

    return calendarDays.map(({ day, log }) => {
      if (!log) {
        return {
          name: `Dia ${day}`,
          Faturamento: 0,
          Custos: 0,
          Lucro: 0
        };
      }
      const uTotal = log.appUber.earnings + log.appUber.bonus;
      const nTotal = log.app99.earnings + log.app99.bonus;
      const pTotal = log.appParticular.earnings;
      const gross = log.exibirNoGeral ? (uTotal + nTotal + pTotal + log.recompensasExtra + log.outrasFontes) : 0;

      const carExpensesSum = (Object.values(log.carExpenses) as number[]).reduce((a, b) => a + b, 0);
      const foodExpensesSum = (Object.values(log.foodExpenses) as number[]).reduce((a, b) => a + b, 0);
      const cost = log.custoEnergia + log.diariaCarro + carExpensesSum + foodExpensesSum;

      return {
        name: `Dia ${day}`,
        Faturamento: gross,
        Custos: cost,
        Lucro: gross - cost
      };
    });
  }, [isAllYear, logs, selectedYear, calendarDays]);

  // Projection Calculations for 2026
  const projectionData = React.useMemo(() => {
    const monthsData = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const monthKey = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
      const monthLogs = logs.filter(l => l.date.startsWith(monthKey));
      const hasLogs = monthLogs.length > 0;
      
      const opGross = monthLogs.reduce((acc, l) => acc + (l.appUber.earnings || 0) + (l.appUber.bonus || 0) + (l.app99.earnings || 0) + (l.app99.bonus || 0) + (l.appParticular.earnings || 0) + (l.recompensasExtra || 0), 0);
      const anjoTotal = monthLogs.reduce((acc, l) => acc + (l.outrasFontes || 0), 0);
      const gross = opGross + anjoTotal;
      const varCosts = monthLogs.reduce((acc, l) => acc + (l.custoEnergia || 0) + (l.diariaCarro || 0) + (l.carExpenses.wash + l.carExpenses.toll + l.carExpenses.maintenance + l.carExpenses.parking + l.carExpenses.other) + (l.foodExpenses.lunch + l.foodExpenses.dinner + l.foodExpenses.snacks + l.foodExpenses.coffee), 0);
      const mFixedList = fixedExpensesByMonth[`${selectedYear}-${monthNum}`] || [];
      const fixedVal = mFixedList.reduce((acc, f) => acc + f.value, 0);
      const km = monthLogs.reduce((acc, l) => acc + (l.kmRodado || 0), 0);
      const rides = monthLogs.reduce((acc, l) => acc + (l.appUber.rides || 0) + (l.app99.rides || 0) + (l.appParticular.rides || 0), 0);
      const workDays = monthLogs.filter(l => !l.isDayOff && ((l.kmRodado || 0) > 0 || (l.appUber.earnings || 0) > 0 || (l.app99.earnings || 0) > 0)).length;

      return {
        monthNum,
        monthName: MONTH_NAMES[i],
        hasLogs,
        gross,
        opGross,
        anjoTotal,
        varCosts,
        fixedVal,
        net: gross - varCosts - fixedVal,
        km,
        rides,
        workDays
      };
    });

    // Fully completed months have at least 20 working days logged
    const fullyCompletedMonths = monthsData.filter(m => m.workDays >= 20);
    const benchmarkMonths = fullyCompletedMonths.length > 0 ? fullyCompletedMonths : monthsData.filter(m => m.hasLogs);
    const benchmarkCount = benchmarkMonths.length || 1;

    const avgMonthlyGrossAll = benchmarkMonths.reduce((a, b) => a + b.gross, 0) / benchmarkCount;
    const avgMonthlyVarCostsAll = benchmarkMonths.reduce((a, b) => a + b.varCosts, 0) / benchmarkCount;
    const avgMonthlyKmAll = benchmarkMonths.reduce((a, b) => a + b.km, 0) / benchmarkCount;
    const avgMonthlyRidesAll = benchmarkMonths.reduce((a, b) => a + b.rides, 0) / benchmarkCount;

    const selectedMonthData = monthsData[selectedMonth - 1];
    const selGross = selectedMonthData.hasLogs 
      ? (selectedMonthData.workDays >= 20 ? selectedMonthData.gross : (selectedMonthData.workDays > 0 ? Math.max(selectedMonthData.gross, (selectedMonthData.opGross / selectedMonthData.workDays) * 26 + selectedMonthData.anjoTotal) : avgMonthlyGrossAll)) 
      : avgMonthlyGrossAll;
    const selVarCosts = selectedMonthData.hasLogs ? (selectedMonthData.workDays >= 20 ? selectedMonthData.varCosts : (selectedMonthData.workDays > 0 ? (selectedMonthData.varCosts / selectedMonthData.workDays) * 26 : avgMonthlyVarCostsAll)) : avgMonthlyVarCostsAll;
    const selKm = selectedMonthData.hasLogs ? (selectedMonthData.workDays >= 20 ? selectedMonthData.km : (selectedMonthData.workDays > 0 ? (selectedMonthData.km / selectedMonthData.workDays) * 26 : avgMonthlyKmAll)) : avgMonthlyKmAll;
    const selRides = selectedMonthData.hasLogs ? (selectedMonthData.workDays >= 20 ? selectedMonthData.rides : (selectedMonthData.workDays > 0 ? (selectedMonthData.rides / selectedMonthData.workDays) * 26 : avgMonthlyRidesAll)) : avgMonthlyRidesAll;

    const baseGrossPace = projectionPaceMode === 'all_year' ? avgMonthlyGrossAll : selGross;
    const baseVarCostsPace = projectionPaceMode === 'all_year' ? avgMonthlyVarCostsAll : selVarCosts;
    const baseKmPace = projectionPaceMode === 'all_year' ? avgMonthlyKmAll : selKm;
    const baseRidesPace = projectionPaceMode === 'all_year' ? avgMonthlyRidesAll : selRides;

    let projectedGrossTotal = 0;
    let projectedVarCostsTotal = 0;
    let projectedFixedTotal = 0;
    let projectedKmTotal = 0;
    let projectedRidesTotal = 0;

    const fullYearBreakdown = monthsData.map(m => {
      if (m.hasLogs && m.workDays >= 20) {
        // Complete Month
        projectedGrossTotal += m.gross;
        projectedVarCostsTotal += m.varCosts;
        projectedFixedTotal += m.fixedVal;
        projectedKmTotal += m.km;
        projectedRidesTotal += m.rides;
        return {
          ...m,
          isProjected: false,
          projGross: m.gross,
          projVarCosts: m.varCosts,
          projFixed: m.fixedVal,
          projNet: m.net,
          projKm: m.km,
          projRides: m.rides
        };
      } else if (m.hasLogs && m.workDays > 0) {
        // Month in progress - extrapolate operational pace, add actual Anjo lump sum
        const estimatedOpGross = (m.opGross / m.workDays) * 26;
        const estimatedGross = Math.max(m.gross, estimatedOpGross + m.anjoTotal);
        const estimatedVarCosts = Math.max(m.varCosts, (m.varCosts / m.workDays) * 26);
        const estimatedKm = Math.max(m.km, (m.km / m.workDays) * 26);
        const estimatedRides = Math.max(m.rides, (m.rides / m.workDays) * 26);
        const estimatedNet = estimatedGross - estimatedVarCosts - m.fixedVal;

        projectedGrossTotal += estimatedGross;
        projectedVarCostsTotal += estimatedVarCosts;
        projectedFixedTotal += m.fixedVal;
        projectedKmTotal += estimatedKm;
        projectedRidesTotal += estimatedRides;

        return {
          ...m,
          isProjected: true,
          projGross: estimatedGross,
          projVarCosts: estimatedVarCosts,
          projFixed: m.fixedVal,
          projNet: estimatedNet,
          projKm: estimatedKm,
          projRides: estimatedRides
        };
      } else {
        // Unlogged future month
        const pGross = baseGrossPace;
        const pVarCosts = baseVarCostsPace;
        const pFixed = m.fixedVal;
        const pNet = pGross - pVarCosts - pFixed;
        const pKm = baseKmPace;
        const pRides = baseRidesPace;

        projectedGrossTotal += pGross;
        projectedVarCostsTotal += pVarCosts;
        projectedFixedTotal += pFixed;
        projectedKmTotal += pKm;
        projectedRidesTotal += pRides;

        return {
          ...m,
          isProjected: true,
          projGross: pGross,
          projVarCosts: pVarCosts,
          projFixed: pFixed,
          projNet: pNet,
          projKm: pKm,
          projRides: pRides
        };
      }
    });

    const projectedNetTotal = projectedGrossTotal - projectedVarCostsTotal - projectedFixedTotal;
    const monthlyNetAvg = projectedNetTotal / 12;
    const monthlyGrossAvg = projectedGrossTotal / 12;

    const loggedMonths = monthsData.filter(m => m.hasLogs);
    const completedMonthsCount = loggedMonths.length || 1;
    const totalRealizedNetSoFar = loggedMonths.reduce((acc, m) => acc + m.net, 0);
    const totalRealizedGrossSoFar = loggedMonths.reduce((acc, m) => acc + m.gross, 0);

    return {
      completedMonthsCount,
      remainingMonthsCount: 12 - completedMonthsCount,
      totalRealizedGrossSoFar,
      totalRealizedNetSoFar,
      projectedGrossTotal,
      projectedVarCostsTotal,
      projectedFixedTotal,
      projectedNetTotal,
      monthlyGrossAvg,
      monthlyNetAvg,
      projectedKmTotal,
      projectedRidesTotal,
      fullYearBreakdown,
      baseGrossPace,
      baseVarCostsPace
    };
  }, [logs, fixedExpensesByMonth, selectedMonth, selectedYear, projectionPaceMode]);

  const currentMonthProj = projectionData.fullYearBreakdown[selectedMonth - 1];

  const weekPassesMap = React.useMemo(() => {
    if (isAllYear) return new Map<string, boolean>();

    const map = new Map<string, boolean>();
    let currentWeekDays: typeof calendarDays = [];

    calendarDays.forEach((d) => {
      currentWeekDays.push(d);
      const dayOfWeek = new Date(selectedYear, selectedMonth - 1, d.day).getDay();

      if (dayOfWeek === 6 || d.day === daysInSelectedMonth) {
        let totalWeekGross = 0;
        let weekWorkDays = 0;

        currentWeekDays.forEach(wd => {
          const g = wd.log ? (wd.log.appUber.earnings + wd.log.appUber.bonus + wd.log.app99.earnings + wd.log.app99.bonus + wd.log.appParticular.earnings + (wd.log.recompensasExtra || 0) + (wd.log.outrasFontes || 0)) : 0;
          totalWeekGross += g;

          const isOff = wd.log ? Boolean(wd.log.isDayOff) : wd.isSunday;
          if (wd.log && (!isOff || wd.log.kmRodado > 0 || g > 0)) {
            weekWorkDays++;
          }
        });

        const divisor = weekWorkDays > 0 ? weekWorkDays : 1;
        const weekAvg = totalWeekGross / divisor;
        const weekPasses = weekAvg >= 500;

        currentWeekDays.forEach(wd => {
          map.set(wd.dateStr, weekPasses);
        });

        currentWeekDays = [];
      }
    });

    return map;
  }, [calendarDays, isAllYear, selectedYear, selectedMonth, daysInSelectedMonth]);

  const weeklySummaryData = React.useMemo(() => {
    if (isAllYear) return [];

    const weeks: Array<{
      weekIndex: number;
      label: string;
      segSabGross: number;
      sundayGross: number;
      totalGross: number;
      weekWorkDays: number;
      weeklyAvg: number;
      passesAvg: boolean;
      status: 'hit' | 'recovered' | 'below';
      days: typeof calendarDays;
    }> = [];

    let currentWeekDays: typeof calendarDays = [];
    let wIdx = 1;

    calendarDays.forEach((d) => {
      currentWeekDays.push(d);
      const dayOfWeek = new Date(selectedYear, selectedMonth - 1, d.day).getDay();

      if (dayOfWeek === 6 || d.day === daysInSelectedMonth) {
        let segSabGross = 0;
        let sundayGross = 0;
        let weekWorkDays = 0;

        currentWeekDays.forEach(wd => {
          const g = wd.log ? (wd.log.appUber.earnings + wd.log.appUber.bonus + wd.log.app99.earnings + wd.log.app99.bonus + wd.log.appParticular.earnings + (wd.log.recompensasExtra || 0) + (wd.log.outrasFontes || 0)) : 0;
          if (wd.isSunday) {
            sundayGross += g;
          } else {
            segSabGross += g;
          }

          const isOff = wd.log ? Boolean(wd.log.isDayOff) : wd.isSunday;
          if (wd.log && (!isOff || wd.log.kmRodado > 0 || g > 0)) {
            weekWorkDays++;
          }
        });

        const totalGross = segSabGross + sundayGross;
        const divisor = weekWorkDays > 0 ? weekWorkDays : 1;
        const weeklyAvg = totalGross / divisor;
        const passesAvg = weeklyAvg >= 500;

        let status: 'hit' | 'recovered' | 'below' = 'below';
        if (segSabGross >= 3000) {
          status = 'hit';
        } else if (passesAvg) {
          status = 'recovered';
        }

        weeks.push({
          weekIndex: wIdx,
          label: `Semana ${wIdx}`,
          segSabGross,
          sundayGross,
          totalGross,
          weekWorkDays,
          weeklyAvg,
          passesAvg,
          status,
          days: [...currentWeekDays],
        });

        wIdx++;
        currentWeekDays = [];
      }
    });

    return weeks;
  }, [calendarDays, isAllYear, selectedYear, selectedMonth, daysInSelectedMonth]);

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 selection:bg-emerald-500/20 selection:text-emerald-300 font-sans antialiased overscroll-y-none">
      
      {/* Dynamic Header */}
      <header id="main-app-header" className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 px-3 sm:px-6 py-3 transition-all relative overflow-x-hidden">
        <div className="max-w-7xl mx-auto flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4">
          
          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            {/* GKD Mobility App Icon Button */}
            <button
              id="btn-gkd-app-logo"
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              className="p-1 bg-white hover:bg-zinc-100 border border-zinc-700/80 hover:border-emerald-500/60 rounded-xl transition-all shadow-md hover:shadow-emerald-500/20 group cursor-pointer shrink-0"
              title="Clique para ver Detalhes e Versão do Aplicativo (GKD Mobility)"
            >
              <GkdMobilityLogo size="sm" />
            </button>

            {(() => {
              const effectiveCost = getEffectiveMonthlyCost(selectedYear, selectedMonth);
              const customDays = carProfile.customWorkDays?.[`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`];
              const monthCarRate = getMonthWorkDaysAndRate(selectedYear, selectedMonth, effectiveCost, customDays);
              return (
                <React.Fragment>
                  <button
                    type="button"
                    onClick={() => setIsCarModalOpen(true)}
                    className="text-xs bg-emerald-950/50 hover:bg-emerald-900/60 border-2 border-emerald-500/40 hover:border-emerald-400 text-emerald-300 px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-2 shadow-md shadow-emerald-950/40 group flex-1 sm:flex-none"
                    title={`Veículo: ${carProfile.modelName} | Rateio ${formatBRL(monthCarRate.monthlyTotalCost)} / ${monthCarRate.workDaysCount} dias = ${formatBRL(monthCarRate.dailyRate)}/dia`}
                  >
                    <div className="p-1 bg-emerald-500/20 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform">
                      <Car className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="font-extrabold text-xs text-zinc-100 group-hover:text-emerald-300 transition-colors">
                        {carProfile.modelName || 'Dados do Veículo'}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium -mt-0.5">
                        {carProfile.vehicleType === 'eletrico' ? '⚡ Elétrico' : '⛽ Combustão'} {carProfile.licensePlate ? `• ${carProfile.licensePlate}` : ''}
                      </span>
                    </div>
                    <Pencil className="w-3 h-3 text-emerald-400/80 ml-0.5 opacity-70 group-hover:opacity-100" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCarModalOpen(true)}
                    className="text-xs bg-[#1f162c] hover:bg-[#281c3a] border-2 border-purple-500/40 hover:border-purple-400 text-purple-200 px-3 py-1 rounded-xl font-bold cursor-pointer transition-all flex flex-col items-center justify-center shadow-md shadow-purple-950/40 group shrink-0"
                    title="Rateio Diário"
                  >
                    <span className="text-[9px] text-purple-300 font-medium tracking-tight">Rateio Diário</span>
                    <span className="font-mono font-extrabold text-xs text-purple-100">{formatBRL(monthCarRate.dailyRate)} / dia</span>
                  </button>
                </React.Fragment>
              );
            })()}
          </div>

          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3">
            {/* Elegant Month Navigator */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
              <button 
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => {
                  setDatePickerYear(selectedYear);
                  setDatePickerMonth(selectedMonth);
                  const daysInCurrentMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                  setDatePickerDay(prev => Math.min(prev || 1, daysInCurrentMonth));
                  setIsDatePickerModalOpen(true);
                }}
                className="px-3 py-1 text-xs font-bold text-zinc-200 hover:text-emerald-300 hover:bg-zinc-800 rounded-lg select-none min-w-[125px] text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 group border border-transparent hover:border-zinc-700/60"
                title="Clique para abrir a Agenda e selecionar Dia, Mês ou Ano"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>{isAllYear ? `Ano ${selectedYear} (Acumulado)` : `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}</span>
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {(selectedMonth !== currentMonth || selectedYear !== currentYear || isAllYear) && (
                <button
                  onClick={() => {
                    setSelectedYear(currentYear);
                    setSelectedMonth(currentMonth);
                    setIsAllYear(false);
                  }}
                  className="px-2 py-1 text-[11px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg transition-all cursor-pointer ml-1"
                  title="Ir para o Mês Atual"
                >
                  Mês Atual
                </button>
              )}
            </div>

            {/* Settings Gear Button */}
            <button
              id="btn-header-settings-gear"
              type="button"
              onClick={() => setIsHelpModalOpen(true)}
              className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 border border-zinc-700/80 hover:border-emerald-500/50 rounded-xl transition-all shadow-md cursor-pointer group flex items-center justify-center"
              title="Menu de Ajuda, Configurações, IA, Suporte e Opções"
            >
              <Settings className="w-5 h-5 text-zinc-400 group-hover:text-emerald-400 group-hover:rotate-45 transition-all" />
            </button>
          </div>

        </div>
      </header>

      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)} onBack={() => { setIsExcelImportOpen(false); setIsHelpModalOpen(true); }}
        onImportData={handleExcelImport}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 pb-32">

        {/* Sweep Notification Banner */}
        {sweepNotification && (
          <div className="bg-sky-950/80 border border-sky-500/50 p-4 rounded-2xl flex items-center justify-between text-sky-200 text-xs shadow-xl shadow-sky-500/10 animate-fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0" />
              <span className="font-semibold leading-relaxed">{sweepNotification}</span>
            </div>
            <button
              onClick={() => setSweepNotification(null)}
              className="p-1.5 hover:bg-sky-900/60 rounded-lg text-sky-400 hover:text-sky-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB: ENTRADAS (Histórico de Atividades e Lançamentos Dia a Dia) */}
        {activeTab === 'entradas' && (
          <section className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg transition-all">
            <button
              type="button"
              onClick={() => setIsHistorySectionOpen(!isHistorySectionOpen)}
              className="w-full flex items-center justify-between p-5 bg-zinc-900 hover:bg-zinc-850 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    Histórico de Atividades & Entradas
                  </h3>
                  <p className="text-xs text-zinc-400 font-sans">
                    {isAllYear 
                      ? `Detalhamento de todos os ${filteredLogs.length} lançamentos do ano de ${selectedYear}.` 
                      : `Detalhamento dia a dia dos lançamentos de ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-zinc-400">
                  {filteredLogs.length} registros
                </span>
                <div className="p-1.5 bg-zinc-800 rounded-lg text-zinc-400">
                  {isHistorySectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </button>

          {isHistorySectionOpen && (
            <div className="p-6 border-t border-zinc-800/80 space-y-4">
              {/* Quick Sync Notice if Contas differs from table */}
              {(() => {
                const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
                const customDays = carProfile.customWorkDays?.[monthKey] || [];
                const rateInfo = getMonthWorkDaysAndRate(selectedYear, selectedMonth, getEffectiveMonthlyCost(selectedYear, selectedMonth), customDays);
                const isDiscrepancy = Math.abs(totals.totalCarRental - (rateInfo.dailyRate * rateInfo.workDaysCount)) > 3.0;

                if (!isDiscrepancy || isAllYear) return null;

                return (
                  <div className="bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-zinc-950 border border-purple-800/50 p-3.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md">
                    <div className="flex items-center gap-2.5">
                      <Zap className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-zinc-100 block">
                          Sincronizar Rateio de Contas: {formatBRL(rateInfo.monthlyTotalCost)} ÷ {rateInfo.workDaysCount} dias = {formatBRL(rateInfo.dailyRate)}/dia
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          A coluna de Diária Carro na tabela está somando {formatBRL(totals.totalCarRental)}. Clique para calibrar com o total de Contas ({formatBRL(rateInfo.monthlyTotalCost)}).
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyMonthlyCarRateToAllDays(selectedMonth, selectedYear, totalFixedExpenses > 0 ? totalFixedExpenses : undefined)}
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-[11px] transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-amber-300" />
                      <span>Calibrar para {formatBRL(rateInfo.dailyRate)}/dia</span>
                    </button>
                  </div>
                );
              })()}

              <div className="overflow-x-auto overflow-y-auto max-h-[550px] relative rounded-xl scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent outline-none focus:outline-none">
            <table className="w-full text-left border-collapse text-xs min-w-[1200px] outline-none">
              <thead>
                <tr className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider outline-none">
                  <th className="py-3 px-3 sticky top-0 left-0 z-30 bg-[#121215] border-b border-r border-zinc-800">Data</th>
                  <th className="py-3 px-3 text-center sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Status</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">KM Rodados</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">{carProfile.vehicleType === 'eletrico' ? 'Custo Bateria' : 'Custo Combustível'}</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Diária Carro</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Desp. Extras Carro</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Alimentação</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Qtd 99</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Lucro 99</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Qtd Uber</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Lucro Uber</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Qtd Part.</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Lucro Part.</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800 text-emerald-400">Recompensas</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800 text-amber-400">Anjo</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Fat. Bruto</th>
                  <th className="py-3 px-3 text-right sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Resultado Líquido</th>
                  <th className="py-3 px-3 text-center sticky top-0 z-20 bg-[#121215] border-b border-zinc-800">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850 text-zinc-300">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="py-12 text-center text-zinc-500">
                      Nenhum dia lançado neste mês. Clique em "Registrar Dia" para começar.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const uTotal = log.appUber.earnings + log.appUber.bonus;
                    const nTotal = log.app99.earnings + log.app99.bonus;
                    const pTotal = log.appParticular.earnings;
                    const recomp = log.recompensasExtra || 0;
                    const anjo = log.outrasFontes || 0;
                    const gross = uTotal + nTotal + pTotal + recomp + anjo;

                    const carExpensesSum = (Object.values(log.carExpenses || {}) as number[]).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
                    const foodExpensesSum = (Object.values(log.foodExpenses || {}) as number[]).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
                    const otherCosts = (log.diariaCarro || 0) + carExpensesSum + foodExpensesSum;

                    const net = gross - ((log.custoEnergia || 0) + otherCosts);
                    const isHighlighted = highlightedRowId === log.id;
                    const isOff = Boolean(log.isDayOff);
                    const workedOnOffDay = isOff && (gross > 0 || (log.kmRodado || 0) > 0);
                    
                    return (
                      <tr 
                        key={log.id} 
                        onClick={() => setHighlightedRowId(isHighlighted ? null : log.id)}
                        onDoubleClick={() => openModalForDate(log.date)}
                        className={`group transition-all duration-150 cursor-pointer select-none outline-none ${
                          isHighlighted 
                            ? 'bg-[#0d2c20] text-white font-semibold' 
                            : 'hover:bg-zinc-850/35 text-zinc-300'
                        }`}
                      >
                        <td className={`py-3 px-3 sticky left-0 z-10 border-r border-zinc-800 transition-all duration-150 ${
                          isHighlighted 
                            ? 'bg-[#0e3b2b] text-emerald-300 font-bold border-l-4 border-l-emerald-400' 
                            : 'bg-[#121215] group-hover:bg-zinc-850/40 text-zinc-300'
                        }`}>
                          <div className={`font-bold ${isHighlighted ? 'text-emerald-300' : 'text-zinc-100'}`}>
                            {log.date.split('-').reverse().slice(0, 2).join('/')}
                          </div>
                          <div className={`text-[10px] ${isHighlighted ? 'text-emerald-400 font-semibold' : 'text-zinc-550'}`}>
                            {WEEK_DAYS[new Date(log.date + 'T00:00:00').getDay()]}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {workedOnOffDay ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                              Folga Trabalhada
                            </span>
                          ) : isOff ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/50 uppercase">
                              Folga
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 uppercase">
                              Trabalhado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-300">
                          {formatKM(log.kmRodado)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-amber-500/90">
                          {formatBRL(log.custoEnergia)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-400">
                          {formatBRL(log.diariaCarro)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-400">
                          {formatBRL(carExpensesSum)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-400">
                          {formatBRL(foodExpensesSum)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-400">
                          {log.app99.rides}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-400">
                          {formatBRL(nTotal)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-400">
                          {log.appUber.rides}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-400">
                          {formatBRL(uTotal)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-400">
                          {log.appParticular.rides}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-400">
                          {formatBRL(pTotal)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400/90 font-medium">
                          {recomp ? formatBRL(recomp) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-amber-400 font-medium">
                          {anjo ? formatBRL(anjo) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">
                          {formatBRL(gross)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold ${net >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                          {formatBRL(net)}
                        </td>
                        <td className="py-3 px-3 text-center min-w-[130px]">
                          {tableDeleteStage?.date === log.date ? (
                            <div className="flex items-center justify-center gap-1 bg-red-950/90 border border-red-500/60 p-1 rounded-lg animate-fadeIn">
                              {tableDeleteStage.stage === 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (log.kmRodado > 0) {
                                      setCarProfile(prev => ({
                                        ...prev,
                                        currentKm: Math.max(0, Math.round((prev.currentKm || 0) - log.kmRodado))
                                      }));
                                    }
                                    const [y, m] = log.date.split('-').map(Number);
                                    const { dailyRate } = getMonthWorkDaysAndRate(y, m, getEffectiveMonthlyCost(y, m));
                                    const defValKwh = carProfile.vehicleType === 'eletrico' ? (carProfile.kwhCostRate || 1.05) : 5.80;
                                    const defCap = carProfile.vehicleType === 'eletrico' ? (carProfile.batteryCapacityKwh || 53.6) : 50;

                                    const zeroedLog: DailyLog = {
                                      id: log.date,
                                      date: log.date,
                                      isDayOff: false,
                                      sobrouBateria: 0,
                                      valorKwh: defValKwh,
                                      capacidadeBateria: defCap,
                                      kmRodado: 0,
                                      custoEnergia: 0,
                                      diariaCarro: dailyRate || 0,
                                      carExpenses: { wash: 0, toll: 0, maintenance: 0, parking: 0, publicCharging: 0, other: 0 },
                                      foodExpenses: { lunch: 0, dinner: 0, snacks: 0, coffee: 0 },
                                      app99: { rides: 0, earnings: 0, bonus: 0 },
                                      appUber: { rides: 0, earnings: 0, bonus: 0 },
                                      appParticular: { rides: 0, earnings: 0 },
                                      recompensasExtra: 0,
                                      outrasFontes: 0,
                                      exibirNoGeral: true
                                    };
                                    setLogs(prev => {
                                      const filtered = prev.filter(l => l.date !== log.date);
                                      return [...filtered, zeroedLog].sort((a, b) => a.date.localeCompare(b.date));
                                    });
                                    setTableDeleteStage(null);
                                    const dateFormatted = log.date.split('-').reverse().join('/');
                                    setSweepNotification(`Dados do dia ${dateFormatted} foram limpos com sucesso!`);
                                    setTimeout(() => setSweepNotification(null), 4000);
                                  }}
                                  className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black rounded cursor-pointer transition-all animate-pulse"
                                  title="Confirmar Exclusão"
                                >
                                  Tem certeza?
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTableDeleteStage(null);
                                }}
                                className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[9px] font-bold rounded cursor-pointer transition-all"
                                title="Cancelar"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModalForDate(log.date);
                                }}
                                className="px-2 py-1 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                title="Editar lançamento"
                              >
                                <Pencil className="w-3 h-3 text-emerald-400" />
                                <span>Editar</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTableDeleteStage({ date: log.date, stage: 1 });
                                }}
                                className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Excluir Lançamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredLogs.length > 0 && (
                <tfoot className="bg-[#101114] border-t-2 border-zinc-750 font-mono text-[11px] font-extrabold text-zinc-200">
                  <tr>
                    <td className="py-3 px-3 sticky left-0 z-10 bg-[#101114] border-r border-zinc-800 text-emerald-400 uppercase">
                      TOTAL MÊS
                    </td>
                    <td className="py-3 px-3 text-center text-zinc-400 font-sans text-[10px]">
                      {totalWorkingDays}d Trab / {totalOffDays}d Folga
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-200">
                      {formatKM(totalKM)}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-400">
                      {formatBRL(totalEnergyCost)}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-300">
                      {formatBRL(totalCarRental)}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-300">
                      {formatBRL(totalCarExpenses)}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-300">
                      {formatBRL(totalFoodExpenses)}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-400">
                      {app99Rides}
                    </td>
                    <td className="py-3 px-3 text-right text-blue-400">
                      {formatBRL(app99Total)}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-400">
                      {uberRides}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400">
                      {formatBRL(uberTotal)}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-400">
                      {particularRides}
                    </td>
                    <td className="py-3 px-3 text-right text-purple-400">
                      {formatBRL(particularTotal)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-300">
                      {formatBRL(totalRecompensas)}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-400">
                      {formatBRL(totalAnjo)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 font-black text-xs">
                      {formatBRL(totalGrossEarnings)}
                    </td>
                    <td className={`py-3 px-3 text-right font-black text-xs ${totalDailyNet >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                      <div title="Soma exata das linhas da tabela">{formatBRL(totalDailyNet)}</div>
                      {totalFixedExpenses > 0 && (
                        <div className={`text-[9px] font-sans font-normal ${realNetEarnings >= 0 ? 'text-emerald-400/80' : 'text-rose-400'}`} title="Lucro líquido no bolso após deduzir despesas fixas do mês">
                          Líq. Real: {formatBRL(realNetEarnings)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-zinc-600">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </section>
  )}

  {/* TAB: VISÃO GERAL */}
  {activeTab === 'visao-geral' && (
    <>


        {/* Dashboard Analytics Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Calendar Heatmap/Overview Grid (Span 8/12) */}
          <div className="lg:col-span-8 bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg transition-all">
            <div className="w-full flex items-center justify-between p-5 bg-zinc-900 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    {isAllYear ? `Resumo Mês a Mês (${selectedYear})` : 'Agenda e Ganhos Diários'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {isAllYear 
                      ? 'Clique em qualquer mês para ver os detalhes diários ou alterar o período.' 
                      : 'Calendário completo do mês. Clique em qualquer dia para adicionar ou editar o registro.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
                <div className="flex justify-between items-center">
                  {!isAllYear && (
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full inline-block shadow-sm shadow-emerald-400" /> ≥ R$500 (Meta Atingida)
                      </span>
                      <span className="flex items-center gap-1.5 text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                        <span className="w-2 h-2 bg-rose-400 rounded-full inline-block shadow-sm shadow-rose-400" /> &lt; R$500 (Abaixo da Meta)
                      </span>
                      <span className="flex items-center gap-1.5 text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                        <span className="w-2 h-2 bg-amber-400 rounded-full inline-block shadow-sm shadow-amber-400" /> Domingo (Folga/Recuperação)
                      </span>
                    </div>
                  )}
                </div>

                {isAllYear ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {Array.from({ length: 12 }, (_, i) => {
                      const mNum = i + 1;
                      const mLogs = logs.filter(l => {
                        const [y, m] = l.date.split('-').map(Number);
                        return y === selectedYear && m === mNum;
                      });
                      if (mLogs.length === 0) return null;

                      let mGross = 0;
                      let mCosts = 0;
                      let mRides = 0;
                      mLogs.forEach(l => {
                        if (l.exibirNoGeral) {
                          const uTotal = l.appUber.earnings + l.appUber.bonus;
                          const nTotal = l.app99.earnings + l.app99.bonus;
                          const pTotal = l.appParticular.earnings;
                          mGross += uTotal + nTotal + pTotal + (l.recompensasExtra || 0) + (l.outrasFontes || 0);
                          mRides += l.appUber.rides + l.app99.rides + l.appParticular.rides;
                        }
                        const dayCarExp = (Object.values(l.carExpenses) as number[]).reduce((a, b) => a + b, 0);
                        const dayFoodExp = (Object.values(l.foodExpenses) as number[]).reduce((a, b) => a + b, 0);
                        mCosts += l.custoEnergia + l.diariaCarro + dayCarExp + dayFoodExp;
                      });
                      const mNet = mGross - mCosts;

                      return (
                        <div 
                          key={mNum}
                          onClick={() => {
                            setSelectedMonth(mNum);
                            setIsAllYear(false);
                          }}
                          className="bg-zinc-950/70 border border-zinc-800 hover:border-emerald-500/50 p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.02] space-y-1.5 group"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-emerald-400 group-hover:text-emerald-300">{MONTH_NAMES[i]}</span>
                            <span className="text-[10px] bg-zinc-850 px-2 py-0.5 rounded-md text-zinc-400 font-mono">{mLogs.length} dias</span>
                          </div>
                          <div className="space-y-0.5 font-mono text-[11px]">
                            <div className="flex justify-between text-zinc-300">
                              <span className="text-zinc-500 text-[10px] font-sans">Faturamento:</span>
                              <span className="font-bold text-emerald-400">{formatBRL(mGross)}</span>
                            </div>
                            <div className="flex justify-between text-zinc-300">
                              <span className="text-zinc-500 text-[10px] font-sans">Custos Ops:</span>
                              <span className="text-amber-400">{formatBRL(mCosts)}</span>
                            </div>
                            <div className="flex justify-between border-t border-zinc-850 pt-1 text-[11px] font-bold">
                              <span className="text-zinc-400 text-[10px] font-sans">Lucro:</span>
                              <span className={mNet >= 0 ? 'text-blue-400' : 'text-red-400'}>{formatBRL(mNet)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Calendar grid */
                  <div className="space-y-5">
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2 font-mono text-xs text-center pt-2">
                      {/* Day names */}
                      {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((wd, i) => (
                        <div key={wd} className={`py-1.5 font-black text-[11px] sm:text-xs tracking-wider ${i === 0 ? 'text-amber-400 font-extrabold' : 'text-zinc-400'}`}>
                          {wd}
                        </div>
                      ))}

                      {/* Offset days */}
                      {Array.from({ length: firstDayIndex }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="min-h-[64px] sm:min-h-[76px] bg-transparent rounded-xl" />
                      ))}

                      {/* Real Month days */}
                      {calendarDays.map(({ day, dateStr, log, isSunday }) => {
                        const isOff = log ? Boolean(log.isDayOff) : isSunday;
                        const gross = log ? (log.appUber.earnings + log.appUber.bonus + log.app99.earnings + log.app99.bonus + log.appParticular.earnings + (log.recompensasExtra || 0) + (log.outrasFontes || 0)) : 0;
                        const carExpensesSum = log ? ((log.carExpenses?.wash || 0) + (log.carExpenses?.toll || 0) + (log.carExpenses?.maintenance || 0) + (log.carExpenses?.parking || 0) + (log.carExpenses?.other || 0)) : 0;
                        const foodExpensesSum = log ? ((log.foodExpenses?.lunch || 0) + (log.foodExpenses?.dinner || 0) + (log.foodExpenses?.snacks || 0) + (log.foodExpenses?.coffee || 0)) : 0;
                        const hasActivity = log ? (gross > 0 || (log.kmRodado || 0) > 0 || (log.diariaCarro || 0) > 0 || (log.custoEnergia || 0) > 0 || carExpensesSum > 0 || foodExpensesSum > 0) : false;
                        const isTargetHit = gross >= 500;
                        const weekAvgPasses = weekPassesMap.get(dateStr) || false;

                        let dayCardStyle = "";
                        let dayDotColor = "";
                        let dayTextElement = null;
                        let dayNumColor = "text-zinc-400";

                        if (isSunday) {
                          if (gross >= 500 || (weekAvgPasses && gross > 0)) {
                            dayCardStyle = "bg-emerald-950/40 border-emerald-500/80 hover:bg-emerald-900/50 hover:border-emerald-400 shadow-sm shadow-emerald-500/10";
                            dayDotColor = "bg-emerald-400";
                            dayTextElement = <span className="text-emerald-400 font-black font-mono whitespace-nowrap">{formatBRL(gross).replace('R$', '').trim()}</span>;
                            dayNumColor = "text-emerald-300";
                          } else if (gross > 0) {
                            dayCardStyle = "bg-amber-950/30 border-amber-500/70 hover:bg-amber-900/40 hover:border-amber-400 shadow-sm shadow-amber-500/10";
                            dayDotColor = "bg-amber-400";
                            dayTextElement = <span className="text-amber-400 font-black font-mono whitespace-nowrap">{formatBRL(gross).replace('R$', '').trim()}</span>;
                            dayNumColor = "text-amber-300";
                          } else {
                            // Standard Sunday (Folga)
                            dayCardStyle = "bg-zinc-900/60 border-amber-500/30 hover:bg-zinc-850 hover:border-amber-400/50 text-zinc-400";
                            dayDotColor = "bg-amber-400";
                            dayTextElement = <span className="text-amber-400/90 font-medium text-[9px] sm:text-[10px] uppercase">Folga</span>;
                            dayNumColor = "text-amber-400/90 font-bold";
                          }
                        } else {
                          // Segunda a Sábado (Dias de Trabalho)
                          if (isOff) {
                            // Driver explicitly toggled day off on a weekday
                            dayCardStyle = "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-400";
                            dayDotColor = "bg-zinc-500";
                            dayTextElement = <span className="text-zinc-500 font-medium text-[9px] sm:text-[10px] uppercase">Folga</span>;
                            dayNumColor = "text-zinc-400";
                          } else if (gross >= 500 || weekAvgPasses) {
                            // Target hit or recovered by week average
                            dayCardStyle = "bg-emerald-950/40 border-emerald-500/80 hover:bg-emerald-900/50 hover:border-emerald-400 shadow-sm shadow-emerald-500/10";
                            dayDotColor = "bg-emerald-400";
                            dayTextElement = <span className="text-emerald-400 font-black font-mono whitespace-nowrap">{formatBRL(gross).replace('R$', '').trim()}</span>;
                            dayNumColor = "text-emerald-300";
                          } else {
                            // Standard Workday: Below target (< R$500), displaying 0,00 or current gross - exactly like Agosto!
                            dayCardStyle = "bg-rose-950/40 border-rose-500/80 hover:bg-rose-900/50 hover:border-rose-400 shadow-sm shadow-rose-500/10";
                            dayDotColor = "bg-rose-400";
                            dayTextElement = <span className="text-rose-400 font-black font-mono whitespace-nowrap">{gross > 0 ? formatBRL(gross).replace('R$', '').trim() : '0,00'}</span>;
                            dayNumColor = "text-rose-300";
                          }
                        }

                        const isHighlightedByAssistant = highlightedAssistantDates.has(dateStr);
                        if (isHighlightedByAssistant) {
                          dayCardStyle += " ring-2 ring-indigo-400 ring-offset-2 ring-offset-zinc-950 shadow-lg shadow-indigo-500/40 border-indigo-400";
                        }

                        return (
                          <button
                            key={day}
                            onClick={() => openModalForDate(dateStr)}
                            className={`min-h-[64px] sm:min-h-[76px] p-1.5 sm:p-2.5 flex flex-col justify-between items-stretch rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${dayCardStyle}`}
                          >
                            <div className="flex justify-between items-center">
                              <span className={`text-[11px] sm:text-xs font-black ${dayNumColor}`}>{day}</span>
                              {isHighlightedByAssistant ? (
                                <span className="bg-indigo-500 text-white text-[8px] font-black px-1 rounded animate-bounce">
                                  IA
                                </span>
                              ) : dayDotColor ? (
                                <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${dayDotColor}`} />
                              ) : null}
                            </div>

                            <div className="text-[10px] sm:text-[11px] font-black text-right tracking-tight leading-tight">
                              {dayTextElement}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Somatória das Semanas breakdown */}
                    {weeklySummaryData.length > 0 && (
                      <div className="pt-4 border-t border-zinc-800 space-y-3">
                        <button
                          type="button"
                          onClick={() => setIsWeeklySummaryOpen(prev => !prev)}
                          className="w-full flex items-center justify-between text-left p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                              Somatória das Semanas (Média por Dias Trabalhados)
                            </span>
                          </div>
                          {isWeeklySummaryOpen ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          )}
                        </button>

                        {isWeeklySummaryOpen && (
                          <div className="space-y-3 animate-in fade-in duration-200">
                            <p className="text-[11px] text-zinc-400 px-1">
                              Cálculo: <strong>Soma Total ÷ Dias Trabalhados</strong>. Se a média for ≥ R$ 500, todas as cédulas da semana ficam verdes. Clique em qualquer semana para ver os detalhes completos.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                              {weeklySummaryData.map((w) => {
                                return (
                                  <div 
                                    key={w.weekIndex}
                                    onClick={() => setSelectedWeekModalData(w)}
                                    className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all cursor-pointer hover:scale-[1.01] hover:border-emerald-500/60 shadow-sm ${
                                      w.passesAvg
                                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-300'
                                    }`}
                                    title="Clique para ver os detalhes completos desta semana"
                                  >
                                    <div className="flex justify-between items-center font-bold">
                                      <span className="text-zinc-200">{w.label}</span>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                                        w.passesAvg 
                                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                      }`}>
                                        {w.passesAvg ? 'Média ≥ R$500/dia ✅' : 'Média < R$500/dia 🔴'}
                                      </span>
                                    </div>

                                    <div className="space-y-1 font-mono text-[11px]">
                                      <div className="flex justify-between text-zinc-400">
                                        <span>Seg - Sáb:</span>
                                        <span className="font-bold text-zinc-200">{formatBRL(w.segSabGross)}</span>
                                      </div>
                                      
                                      {w.sundayGross > 0 && (
                                        <div className="flex justify-between text-amber-400 font-bold">
                                          <span>+ Domingo:</span>
                                          <span>+{formatBRL(w.sundayGross)}</span>
                                        </div>
                                      )}

                                      <div className="flex justify-between text-zinc-300 border-t border-zinc-850 pt-1">
                                        <span>Soma Total:</span>
                                        <span className="font-bold">{formatBRL(w.totalGross)}</span>
                                      </div>

                                      <div className="flex justify-between border-t border-zinc-800/80 pt-1.5 font-bold">
                                        <span className="text-zinc-300">Média (÷ {w.weekWorkDays}):</span>
                                        <span className={w.passesAvg ? 'text-emerald-400 font-extrabold text-xs' : 'text-rose-400 font-bold'}>
                                          {formatBRL(w.weeklyAvg)} / dia
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
          </div>

          {/* Right Column Stack (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Recharts Analytics Trends */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg transition-all">
              <div
                onClick={() => setIsAppShareSectionOpen(!isAppShareSectionOpen)}
                className="w-full flex items-center justify-between p-5 bg-zinc-900 hover:bg-zinc-850 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                    <PieChart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                      Distribuição de Receitas & Custos
                    </h3>
                    <p className="text-xs text-zinc-400 font-sans">Visualização acumulada da operação do mês selecionado.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAppShareModalOpen(true);
                    }}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30 transition-all cursor-pointer hidden sm:flex items-center gap-1"
                  >
                    <span>Ver em Modal</span>
                  </button>
                  <div className="p-1.5 bg-zinc-800 rounded-lg text-zinc-400">
                    {isAppShareSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {isAppShareSectionOpen && (
                <div className="p-6 border-t border-zinc-800/80 space-y-4">
                  {/* Micro app revenue share */}
                  <div className="space-y-4 pt-2">
                    
                    {/* App Share Bars */}
                    <div className="space-y-3">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">Faturamento por Canal</span>
                      
                      {/* Uber Share */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-zinc-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Uber
                          </span>
                          <span className="font-mono">{formatBRL(uberTotal)} <span className="text-zinc-500 font-normal">({uberRides} corr.)</span></span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-400 rounded-full" 
                            style={{ width: `${totalGrossEarnings > 0 ? (uberTotal / totalGrossEarnings) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>

                      {/* 99 App Share */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-zinc-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400" /> 99 App
                          </span>
                          <span className="font-mono">{formatBRL(app99Total)} <span className="text-zinc-500 font-normal">({app99Rides} corr.)</span></span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-400 rounded-full" 
                            style={{ width: `${totalGrossEarnings > 0 ? (app99Total / totalGrossEarnings) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>

                      {/* Particular / InDrive Share */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-zinc-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-400" /> InDrive / Outros
                          </span>
                          <span className="font-mono">{formatBRL(particularTotal)} <span className="text-zinc-500 font-normal">({particularRides} corr.)</span></span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-400 rounded-full" 
                            style={{ width: `${totalGrossEarnings > 0 ? (particularTotal / totalGrossEarnings) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>

                      {/* Recompensas Extras Share (Junto do Trabalho do Dia) */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-emerald-300 flex items-center gap-1.5 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-300" /> Recompensas / Bônus do Dia
                          </span>
                          <span className="font-mono text-emerald-300">{formatBRL(totalRecompensas)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-300 rounded-full" 
                            style={{ width: `${totalGrossEarnings > 0 ? (totalRecompensas / totalGrossEarnings) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>

                      {/* Anjo / Outras Fontes Share */}
                      <div className="space-y-1 pt-2 border-t border-zinc-800/80">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-amber-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400" /> Anjo (Aporte Externo)
                          </span>
                          <span className="font-mono text-amber-400">{formatBRL(totalAnjo)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-400 rounded-full" 
                            style={{ width: `${totalGrossEarnings > 0 ? (totalAnjo / totalGrossEarnings) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>

                    </div>

                    {/* Expense breakdown block */}
                    <div className="border-t border-zinc-800 pt-4 space-y-3">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">Composição de Gastos</span>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                        <div className="bg-zinc-950/60 border border-zinc-850 p-2.5 rounded-xl space-y-0.5">
                          <span className="text-[9px] text-zinc-500 block font-sans">{carProfile.vehicleType === 'eletrico' ? 'ENERGIA (EV)' : 'COMBUSTÍVEL'}</span>
                          <span className="text-zinc-200 font-bold">{formatBRL(totalEnergyCost)}</span>
                        </div>
                        <div className="bg-zinc-950/60 border border-zinc-850 p-2.5 rounded-xl space-y-0.5">
                          <span className="text-[9px] text-zinc-500 block font-sans">DIÁRIAS DO CARRO</span>
                          <span className="text-zinc-200 font-bold">{formatBRL(totalCarRental)}</span>
                        </div>
                        <div className="bg-zinc-950/60 border border-zinc-850 p-2.5 rounded-xl space-y-0.5">
                          <span className="text-[9px] text-zinc-500 block font-sans">DESP. EXTRAS CARRO</span>
                          <span className="text-zinc-200 font-bold">{formatBRL(totalCarExpenses)}</span>
                        </div>
                        <div className="bg-zinc-950/60 border border-zinc-850 p-2.5 rounded-xl space-y-0.5">
                          <span className="text-[9px] text-zinc-500 block font-sans">ALIMENTAÇÃO</span>
                          <span className="text-zinc-200 font-bold">{formatBRL(totalFoodExpenses)}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>

            {/* NEW CARD: Despesas Fixas Mensais */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg transition-all">
              <button
                type="button"
                onClick={() => setIsFixedExpensesSectionOpen(!isFixedExpensesSectionOpen)}
                className="w-full flex items-center justify-between p-5 bg-zinc-900 hover:bg-zinc-850 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                      Despesas Fixas Mensais
                    </h3>
                    <p className="text-xs text-zinc-400 font-sans">Gastos recorrentes, parcelas e tributação do seu negócio.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!isFixedExpensesSectionOpen && (
                    <span className="text-xs font-mono font-bold text-zinc-300">
                      {formatBRL(totalFixedExpenses)}
                    </span>
                  )}
                  <div className="p-1.5 bg-zinc-800 rounded-lg text-zinc-400">
                    {isFixedExpensesSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {isFixedExpensesSectionOpen && (
                <div className="p-6 border-t border-zinc-800/80 space-y-4">
                  <div className="flex justify-end">
                    {!isAddingFixed && (
                      <button
                        onClick={() => {
                          setEditingFixedId(null);
                          setNewFixedName('');
                          setNewFixedValue('');
                          setNewFixedInstallments('');
                          setIsAddingFixed(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 rounded-xl text-[11px] font-bold text-zinc-200 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-400" /> Add
                      </button>
                    )}
                  </div>

                  {/* Add/Edit form */}
                  {isAddingFixed && (
                    <form 
                      ref={fixedExpenseFormRef}
                      onSubmit={handleSaveFixedExpense} 
                      className={`border p-3.5 rounded-xl space-y-3 transition-all ${
                        editingFixedId 
                          ? 'bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-500/10' 
                          : 'bg-zinc-950/60 border-zinc-850'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Pencil className="w-3 h-3" />
                          {editingFixedId ? `Editando: ${newFixedName || 'Despesa'}` : 'Nova Despesa Fixa'}
                        </div>
                        {editingFixedId && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/40">
                            Modo Edição Ativo
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 block uppercase">Nome</label>
                          <input
                            ref={fixedExpenseInputRef}
                            type="text"
                            placeholder="Ex: IPVA"
                            value={newFixedName}
                            onChange={e => setNewFixedName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-500 font-sans text-zinc-100"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 block uppercase">Valor (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={newFixedValue}
                            onChange={e => setNewFixedValue(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-500 font-mono text-zinc-100"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-zinc-500 block uppercase">Parcelas / Info (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Ex: 09/12 ou Mensal"
                          value={newFixedInstallments}
                          onChange={e => setNewFixedInstallments(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-500 font-sans text-zinc-100"
                        />
                      </div>
                      <div className="flex gap-2 pt-1 justify-end">
                        <button
                          type="button"
                          onClick={handleCancelFixedExpenseForm}
                          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-zinc-400 text-[10px] font-bold rounded-lg cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[10px] font-black rounded-lg cursor-pointer transition-all shadow-md"
                        >
                          {editingFixedId ? 'Salvar Alterações' : 'Adicionar Despesa'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Fixed Expenses List Table-like UI */}
                  <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 pr-1">
                    {fixedExpenses.length === 0 ? (
                      <p className="text-zinc-500 text-center py-6 text-xs">Nenhuma despesa cadastrada.</p>
                    ) : (
                      fixedExpenses.map(item => (
                        <div 
                          key={item.id} 
                          className={`flex items-center justify-between p-2.5 bg-zinc-950/40 hover:bg-zinc-950/80 border rounded-xl transition-all group ${
                            editingFixedId === item.id ? 'border-emerald-500/80 bg-emerald-950/20 shadow-md shadow-emerald-500/10' : 'border-zinc-850/60'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-200">{item.name}</span>
                              {item.installments && (
                                <span className="bg-zinc-800/80 text-zinc-400 border border-zinc-700/30 text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold">
                                  {item.installments}
                                </span>
                              )}
                              {editingFixedId === item.id && (
                                <span className="text-[9px] font-extrabold text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  Em edição
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold font-mono text-zinc-200 mr-1">
                              {formatBRL(item.value)}
                            </span>
                            
                            {fixedDeleteStage?.id === item.id ? (
                              <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/60 p-1 rounded-lg animate-fadeIn">
                                {fixedDeleteStage.stage === 1 && (
                                  <button
                                    onClick={() => {
                                      handleDeleteFixedExpense(item.id);
                                      setFixedDeleteStage(null);
                                    }}
                                    className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black rounded cursor-pointer animate-pulse"
                                    title="Confirmar Exclusão"
                                  >
                                    Tem certeza?
                                  </button>
                                )}
                                <button
                                  onClick={() => setFixedDeleteStage(null)}
                                  className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold rounded cursor-pointer"
                                  title="Cancelar"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEditFixedExpense(item)}
                                  className="text-zinc-400 hover:text-emerald-400 p-1.5 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Editar despesa"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setFixedDeleteStage({ id: item.id, stage: 1 })}
                                  className="text-zinc-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir Despesa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Total Block */}
                  <div className="border-t border-zinc-850 pt-4 space-y-3">
                    <div className="flex justify-between items-center bg-zinc-950/60 border border-zinc-850 p-3 rounded-xl">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Total Despesas Fixas</span>
                        <span className="text-base font-extrabold text-zinc-100 font-mono">{formatBRL(totalFixedExpenses)}</span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Comprometimento</span>
                        <span className={`text-xs font-extrabold font-mono ${totalGrossEarnings > 0 && (totalFixedExpenses / totalGrossEarnings) > 0.5 ? 'text-amber-500' : 'text-zinc-300'}`}>
                          {totalGrossEarnings > 0 ? `${((totalFixedExpenses / totalGrossEarnings) * 100).toFixed(1)}% do faturamento` : '0%'}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

          </div>

        </section>
      </>
    )}

    {/* TAB: CONTAS (Gestão Completa de Contas e Despesas Fixas) */}
    {activeTab === 'contas' && (
      <section id="contas-section" className="space-y-6">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg transition-all p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  Contas & Despesas Fixas
                  <span className="text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                    {fixedExpenses.length} cadastradas
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Gastos recorrentes, parcelas, IPVA, seguro, MEI e compromissos mensais
                </p>
              </div>
            </div>

            {!isAddingFixed && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasteFixedExpensesModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-indigo-950/70 hover:bg-indigo-900/90 border border-indigo-500/50 text-indigo-200 font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                  title="Copiar e colar contas do Excel, WhatsApp, extrato bancário ou relatório"
                >
                  <Clipboard className="w-3.5 h-3.5 text-indigo-400" /> Colar Contas (Excel/WhatsApp)
                </button>
                <button
                  type="button"
                  onClick={handleApplyAugustToAllMonths}
                  className="flex items-center gap-2 px-3.5 py-2 bg-purple-900/60 hover:bg-purple-800/80 border border-purple-500/50 text-purple-200 font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                  title="Replicar contas do mês selecionado para todos os 12 meses"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse" /> Replicar Padrão de Agosto (12 Meses)
                </button>
                <button
                  onClick={() => {
                    setEditingFixedId(null);
                    setNewFixedName('');
                    setNewFixedValue('');
                    setNewFixedInstallments('');
                    setIsAddingFixed(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> Nova Despesa
                </button>
              </div>
            )}
          </div>

          {/* Form & List */}
          <div className="pt-5 space-y-5">
            {/* Form if isAddingFixed */}
            {isAddingFixed && (
              <form 
                ref={fixedExpenseFormRef}
                onSubmit={handleSaveFixedExpense} 
                className={`border p-4 rounded-xl space-y-3 transition-all ${
                  editingFixedId 
                    ? 'bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-500/10' 
                    : 'bg-zinc-950/60 border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" />
                    {editingFixedId ? `Editando: ${newFixedName || 'Despesa'}` : 'Cadastrar Nova Despesa Fixa'}
                  </div>
                  {editingFixedId && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                      Modo Edição Ativo
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 block uppercase font-bold">Nome da Conta / Despesa</label>
                    <input
                      ref={fixedExpenseInputRef}
                      type="text"
                      placeholder="Ex: IPVA, Internet Claro, MEI, Seguro"
                      value={newFixedName}
                      onChange={e => setNewFixedName(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 font-sans text-zinc-100"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 block uppercase font-bold">Valor Mensal (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newFixedValue}
                      onChange={e => setNewFixedValue(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 font-mono text-zinc-100"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 block uppercase font-bold">Parcelas / Vencimento (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: 09/12 ou Vence dia 10"
                      value={newFixedInstallments}
                      onChange={e => setNewFixedInstallments(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 font-sans text-zinc-100"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2 justify-end">
                  <button
                    type="button"
                    onClick={handleCancelFixedExpenseForm}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black rounded-lg cursor-pointer transition-all shadow-md"
                  >
                    {editingFixedId ? 'Salvar Alterações' : 'Salvar Despesa'}
                  </button>
                </div>
              </form>
            )}

            {/* List of expenses */}
            <div className="space-y-2.5">
              {fixedExpenses.length === 0 ? (
                <div className="text-center py-12 bg-zinc-950/40 rounded-xl border border-zinc-800/60 space-y-3">
                  <Receipt className="w-10 h-10 text-zinc-600 mx-auto" />
                  <p className="text-zinc-400 text-sm font-medium">Nenhuma despesa fixa cadastrada no mês de {MONTH_NAMES[selectedMonth - 1]}.</p>
                  <button
                    onClick={() => {
                      setEditingFixedId(null);
                      setNewFixedName('');
                      setNewFixedValue('');
                      setNewFixedInstallments('');
                      setIsAddingFixed(true);
                    }}
                    className="text-xs text-emerald-400 font-bold bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-1.5 rounded-lg border border-emerald-500/30 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Primeira Conta
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {fixedExpenses.map(item => (
                    <div 
                      key={item.id} 
                      className={`flex items-center justify-between p-3.5 bg-zinc-950/60 hover:bg-zinc-950/90 border rounded-xl transition-all group ${
                        editingFixedId === item.id ? 'border-emerald-500/80 bg-emerald-950/20 shadow-md shadow-emerald-500/10' : 'border-zinc-800'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-100">{item.name}</span>
                          {item.installments && (
                            <span className="bg-zinc-800 text-zinc-400 border border-zinc-700/50 text-[10px] px-2 py-0.5 rounded-md font-mono font-bold">
                              {item.installments}
                            </span>
                          )}
                          {editingFixedId === item.id && (
                            <span className="text-[9px] font-extrabold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded">
                              Em edição
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {MONTH_NAMES[selectedMonth - 1]} / {selectedYear}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-extrabold font-mono text-zinc-100">
                          {formatBRL(item.value)}
                        </span>
                        
                        {fixedDeleteStage?.id === item.id ? (
                          <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/60 p-1 rounded-lg animate-fadeIn">
                            {fixedDeleteStage.stage === 1 && (
                              <button
                                onClick={() => {
                                  handleDeleteFixedExpense(item.id);
                                  setFixedDeleteStage(null);
                                }}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black rounded cursor-pointer animate-pulse"
                                title="Confirmar Exclusão"
                              >
                                Tem certeza?
                              </button>
                            )}
                            <button
                              onClick={() => setFixedDeleteStage(null)}
                              className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold rounded cursor-pointer"
                              title="Cancelar"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartEditFixedExpense(item)}
                              className="text-zinc-400 hover:text-emerald-400 p-1.5 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Editar despesa"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setFixedDeleteStage({ id: item.id, stage: 1 })}
                              className="text-zinc-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Excluir despesa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total Summary Banner */}
            <div className="border-t border-zinc-800 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-950/60 p-4 rounded-xl border border-zinc-850">
              <div className="space-y-0.5">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Total de Despesas Fixas no Mês</span>
                <span className="text-xl font-black text-emerald-400 font-mono">{formatBRL(totalFixedExpenses)}</span>
              </div>
              <div className="text-left sm:text-right space-y-0.5">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Comprometimento do Faturamento</span>
                <span className={`text-sm font-extrabold font-mono ${totalGrossEarnings > 0 && (totalFixedExpenses / totalGrossEarnings) > 0.5 ? 'text-amber-400' : 'text-zinc-200'}`}>
                  {totalGrossEarnings > 0 ? `${((totalFixedExpenses / totalGrossEarnings) * 100).toFixed(1)}% do faturamento realizado` : '0%'}
                </span>
              </div>
            </div>

            {/* Smart Rateio & Sync with Entradas Box */}
            {(() => {
              const rateInfo = getMonthWorkDaysAndRate(selectedYear, selectedMonth, getEffectiveMonthlyCost(selectedYear, selectedMonth));
              const isAlreadySynced = Math.abs(totals.totalCarRental - (rateInfo.dailyRate * rateInfo.workDaysCount)) < 2.0;

              return (
                <div className="bg-gradient-to-r from-purple-950/40 via-blue-950/30 to-zinc-950 border border-purple-900/50 p-4 rounded-2xl space-y-3 shadow-lg">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-purple-900/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider block">
                          Rateio Automático das Contas do Mês ({MONTH_NAMES[selectedMonth - 1]}/{selectedYear})
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Jornada: Período Selecionado ({rateInfo.workDaysCount} dias) • Folgas ({rateInfo.offDaysCount} dias a R$ 0,00)
                        </span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-purple-300 uppercase font-bold block">Diária Calculada</span>
                      <span className="text-base font-black font-mono text-purple-300">
                        {formatBRL(rateInfo.dailyRate)} <span className="text-[10px] text-zinc-400 font-normal">/dia útil</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-zinc-900/70 p-2 rounded-xl border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 uppercase block font-medium">Contas do Mês</span>
                      <span className="text-xs font-bold text-zinc-100 font-mono">{formatBRL(rateInfo.monthlyTotalCost)}</span>
                    </div>
                    <div className="bg-zinc-900/70 p-2 rounded-xl border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 uppercase block font-medium">Dias de Trabalho</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono">{rateInfo.workDaysCount} dias (Seg-Sáb)</span>
                    </div>
                    <div className="bg-zinc-900/70 p-2 rounded-xl border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 uppercase block font-medium">Dias de Folga</span>
                      <span className="text-xs font-bold text-amber-400 font-mono">{rateInfo.offDaysCount} dias (R$ 0,00)</span>
                    </div>
                    <div className="bg-purple-950/40 p-2 rounded-xl border border-purple-900/50">
                      <span className="text-[9px] text-purple-300 uppercase block font-medium">Soma no Mês</span>
                      <span className="text-xs font-bold text-purple-300 font-mono">{formatBRL(rateInfo.dailyRate * rateInfo.workDaysCount)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                    <div className="text-[10px] text-zinc-400 text-center sm:text-left">
                      Fórmula exata: <strong className="text-zinc-200">{formatBRL(rateInfo.monthlyTotalCost)} ÷ {rateInfo.workDaysCount} dias</strong> = <strong className="text-emerald-400">{formatBRL(rateInfo.dailyRate)}/dia</strong> nos 26 dias úteis.
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyMonthlyCarRateToAllDays(selectedMonth, selectedYear, totalFixedExpenses > 0 ? totalFixedExpenses : undefined)}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-purple-950/50 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
                      <span>{isAlreadySynced ? `Sincronizado: Aplicar ${formatBRL(rateInfo.dailyRate)}/dia nas Entradas` : `⚡ Sincronizar e Aplicar ${formatBRL(rateInfo.dailyRate)}/dia nas Entradas`}</span>
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      </section>
    )}

    {/* TAB: RELATÓRIOS (Gráficos, Tendências e Análises) */}
    {activeTab === 'relatorios' && (
      <div className="space-y-6">
        {/* Header Summary for Reports */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                Relatórios & Análises Financeiras
              </h2>
              <p className="text-xs text-zinc-400">
                {isAllYear ? `Consolidado anual de ${selectedYear}` : `Mês de ${MONTH_NAMES[selectedMonth - 1]} de ${selectedYear}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="bg-zinc-950/80 border border-zinc-800 px-4 py-2 rounded-xl flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
              <span className="text-[11px] text-zinc-400 font-bold uppercase">Margem Líquida</span>
              <span className="text-sm font-black font-mono text-emerald-400">
                {totalGrossEarnings > 0 ? `${((realNetEarnings / totalGrossEarnings) * 100).toFixed(1)}%` : '0.0%'}
              </span>
            </div>
          </div>
        </div>

        {/* Core KPIs Metrics Grid */}
        <section id="kpi-dashboard" className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg transition-all">
            <div
              onClick={() => setIsKpisSectionOpen(!isKpisSectionOpen)}
              className="w-full flex items-center justify-between p-4 sm:p-5 bg-zinc-900 hover:bg-zinc-850 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                    Indicadores Financeiros (KPIs)
                  </h3>
                  <p className="text-xs text-zinc-400">Faturamento Bruto, Custos Variáveis e Lucro Líquido</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsKpisModalOpen(true);
                  }}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30 transition-all cursor-pointer hidden sm:flex items-center gap-1"
                >
                  <span>Ver em Modal</span>
                </button>
                {!isKpisSectionOpen && (
                  <div className="hidden sm:flex items-center gap-2 text-xs font-mono font-bold">
                    <span className="text-emerald-400">{formatBRL(totalGrossEarnings)}</span>
                    <span className="text-zinc-600">|</span>
                    <span className={realNetEarnings >= 0 ? 'text-blue-400' : 'text-red-400'}>{formatBRL(realNetEarnings)}</span>
                  </div>
                )}
                <div className="p-1.5 bg-zinc-800 rounded-lg text-zinc-400">
                  {isKpisSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {isKpisSectionOpen && (
              <div className="p-4 sm:p-5 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-zinc-950/40">
                {/* Card 1: Gross Revenue */}
                <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-md min-w-0">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.02] rounded-full filter blur-2xl pointer-events-none" />
                  <div className="flex justify-between items-center text-zinc-400 mb-2">
                    <span className="text-xs font-semibold tracking-wider uppercase truncate">Faturamento Bruto</span>
                    <Coins className="w-5 h-5 text-emerald-400 shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight font-mono truncate" title={formatBRL(totalGrossEarnings)}>
                      {formatBRL(totalGrossEarnings)}
                    </h3>
                    <div className="mt-2.5 pt-2 border-t border-zinc-850/60 space-y-1 text-[11px]">
                      <div className="flex justify-between items-center text-zinc-300 gap-2">
                        <span className="text-zinc-400 font-medium truncate">Trabalho + Recompensas:</span>
                        <span className="font-mono font-bold text-emerald-400 shrink-0">{formatBRL(totalOperationalEarnings)}</span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-300 gap-2">
                        <span className="text-amber-400 font-semibold flex items-center gap-1 truncate">
                          Anjo:
                        </span>
                        <span className="font-mono font-bold text-amber-400 shrink-0">{formatBRL(totalAnjo)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-1 border-t border-zinc-850/40">
                        <span>{totalRides} Corridas</span>
                        <span className="text-emerald-500 font-semibold">
                          {totalRides > 0 ? formatBRL(totalOperationalEarnings / totalRides) + '/corr' : 'R$ 0,00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Total Operating Cost */}
                <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-md min-w-0">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/[0.02] rounded-full filter blur-2xl pointer-events-none" />
                  <div className="flex justify-between items-center text-zinc-400 mb-2">
                    <span className="text-xs font-semibold tracking-wider uppercase truncate">Custos Variáveis</span>
                    <Zap className="w-5 h-5 text-amber-500 shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight font-mono truncate" title={formatBRL(totalVariableCosts)}>
                      {formatBRL(totalVariableCosts)}
                    </h3>
                    <div className="mt-2.5 pt-2 border-t border-zinc-850/60 space-y-1 text-[11px] text-zinc-400">
                      <div className="flex justify-between items-center gap-2">
                        <span className="truncate">{carProfile.vehicleType === 'eletrico' ? 'Bateria:' : 'Combustível:'}</span>
                        <span className="font-mono font-medium text-zinc-300 shrink-0">{formatBRL(totalEnergyCost)}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="truncate">Desp. Extras Carro:</span>
                        <span className="font-mono font-medium text-zinc-300 shrink-0">{formatBRL(totalCarExpenses)}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="truncate">Alimentação:</span>
                        <span className="font-mono font-medium text-zinc-300 shrink-0">{formatBRL(totalFoodExpenses)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Net Income */}
                <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-md min-w-0">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/[0.02] rounded-full filter blur-2xl pointer-events-none" />
                  <div className="flex justify-between items-center text-zinc-400 mb-3">
                    <span className="text-xs font-semibold tracking-wider uppercase truncate">Resultado Líquido</span>
                    <DollarSign className="w-5 h-5 text-blue-400 shrink-0" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase shrink-0">Operacional:</span>
                      <span className={`text-xs sm:text-sm font-bold font-mono truncate ${netOperational >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {formatBRL(netOperational)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2 pt-1.5 border-t border-zinc-800/60">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase shrink-0">Real Líquido:</span>
                      <span className={`text-xl sm:text-2xl font-black font-mono truncate ${realNetEarnings >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        {formatBRL(realNetEarnings)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-850/60 text-[11px] text-zinc-400 gap-2">
                      <span className="truncate">Diárias Carro: {formatBRL(totalCarRental)}</span>
                      <span className="truncate">Fixo Mês: {formatBRL(totalFixedExpenses)}</span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Profit Margin & Efficiency */}
                <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-md min-w-0">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/[0.02] rounded-full filter blur-2xl pointer-events-none" />
                  <div className="flex justify-between items-center text-zinc-400 mb-3">
                    <span className="text-xs font-semibold tracking-wider uppercase truncate">Margem Operacional</span>
                    <TrendingUp className="w-5 h-5 text-purple-400 shrink-0" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase shrink-0">Op. Margem:</span>
                      <span className="text-xs sm:text-sm font-bold text-purple-400 font-mono truncate">
                        {profitMargin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-2 pt-1.5 border-t border-zinc-850/60">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase shrink-0">Margem Real:</span>
                      <span className={`text-lg sm:text-xl font-extrabold font-mono truncate ${realProfitMargin >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        {realProfitMargin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-850/60 text-[11px] text-zinc-400 gap-2">
                      <span className="truncate">Distância: {formatKM(totalKM)}</span>
                      <span className="truncate">Líquido: {formatBRL(realNetEarnings / (totalKM || 1))}/KM</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </section>

        {/* Projeção de Fechamento do Mês Card */}
        <section className="bg-gradient-to-r from-emerald-950/30 via-zinc-900 to-zinc-900 border border-emerald-500/30 rounded-2xl overflow-hidden shadow-lg shadow-emerald-500/5 transition-all">
          <button
            type="button"
            onClick={() => setIsProjectionSectionOpen(!isProjectionSectionOpen)}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-emerald-950/20 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <TrendingUp className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                    Projeção do Mês de {MONTH_NAMES[selectedMonth - 1]}
                  </h3>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Ritmo de {currentMonthProj?.workDays || 0} dias
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Estimativa de fechamento mantendo a média diária até o fim do mês
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isProjectionSectionOpen && (
                <div className="hidden sm:flex items-center gap-2 text-xs font-mono font-bold">
                  <span className="text-emerald-300">Est: {formatBRL(currentMonthProj?.projNet || 0)}</span>
                </div>
              )}
              <div className="p-1.5 bg-zinc-800 rounded-lg text-zinc-400">
                {isProjectionSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {isProjectionSectionOpen && (
            <div className="p-4 sm:p-5 border-t border-zinc-800/80 bg-zinc-950/50 space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => setIsProjectionModalOpen(true)}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-2 rounded-xl border border-emerald-500/30 transition-all cursor-pointer shadow-sm"
                >
                  <span>Ver Detalhes</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-zinc-950/60 p-3 sm:p-3.5 rounded-xl border border-zinc-850 min-w-0 overflow-hidden flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block truncate" title="Faturamento Bruto Est.">Faturamento Bruto Est.</span>
                  <span className="text-sm xs:text-base sm:text-lg font-black font-mono text-emerald-400 block truncate tracking-tight my-0.5" title={formatBRL(currentMonthProj?.projGross || 0)}>
                    {formatBRL(currentMonthProj?.projGross || 0)}
                  </span>
                  <span className="text-[10px] text-zinc-400 block truncate">
                    Faturado: <strong className="text-zinc-300 font-mono">{formatBRL(totalGrossEarnings)}</strong>
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-3 sm:p-3.5 rounded-xl border border-zinc-850 min-w-0 overflow-hidden flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block truncate" title="Custos Variáveis Est.">Custos Variáveis Est.</span>
                  <span className="text-sm xs:text-base sm:text-lg font-black font-mono text-amber-400 block truncate tracking-tight my-0.5" title={formatBRL(currentMonthProj?.projVarCosts || 0)}>
                    {formatBRL(currentMonthProj?.projVarCosts || 0)}
                  </span>
                  <span className="text-[10px] text-zinc-400 block truncate">
                    Realizado: <strong className="text-zinc-300 font-mono">{formatBRL(totalVariableCosts)}</strong>
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-3 sm:p-3.5 rounded-xl border border-zinc-850 min-w-0 overflow-hidden flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block truncate" title="Despesas Fixas Mês">Despesas Fixas Mês</span>
                  <span className="text-sm xs:text-base sm:text-lg font-black font-mono text-rose-400 block truncate tracking-tight my-0.5" title={formatBRL(currentMonthProj?.projFixed || 0)}>
                    {formatBRL(currentMonthProj?.projFixed || 0)}
                  </span>
                  <span className="text-[10px] text-zinc-400 block truncate">Total fixo lançado</span>
                </div>

                <div className="bg-emerald-950/40 p-3 sm:p-3.5 rounded-xl border border-emerald-500/30 min-w-0 overflow-hidden flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase text-emerald-400 block truncate" title="Lucro Líquido Est. (Bolso)">Lucro Líquido Est. (Bolso)</span>
                  <span className="text-sm xs:text-base sm:text-lg font-black font-mono text-emerald-300 block truncate tracking-tight my-0.5" title={formatBRL(currentMonthProj?.projNet || 0)}>
                    {formatBRL(currentMonthProj?.projNet || 0)}
                  </span>
                  <span className="text-[10px] text-zinc-400 block truncate">Real no bolso ao fim do mês</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Driver Productivity & Electric Car efficiency stats */}
        <section className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg transition-all">
          <div
            onClick={() => setIsEfficiencySectionOpen(!isEfficiencySectionOpen)}
            className="w-full flex items-center justify-between p-4 sm:p-5 bg-zinc-900 hover:bg-zinc-850 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                  Indicadores de Produtividade & Eficiência por KM
                </h3>
                <p className="text-xs text-zinc-400">Rendimento por KM rodado e custos operacionais por distância</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEfficiencyModalOpen(true);
                }}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30 transition-all cursor-pointer hidden sm:flex items-center gap-1"
              >
                <span>Ver em Modal</span>
              </button>
              {!isEfficiencySectionOpen && (
                <div className="hidden sm:flex items-center gap-2 text-xs font-mono font-bold text-zinc-300">
                  <span>{formatBRL(earningsPerKM)}/KM</span>
                </div>
              )}
              <div className="p-1.5 bg-zinc-800 rounded-lg text-zinc-400">
                {isEfficiencySectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </div>

          {isEfficiencySectionOpen && (
            <div className="p-4 sm:p-5 border-t border-zinc-800/80 grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-950/40">
              <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl flex items-center gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Faturamento por KM</span>
                  <p className="text-base font-extrabold text-zinc-200 font-mono">{formatBRL(earningsPerKM)} <span className="text-xs text-zinc-500 font-normal">/ KM</span></p>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl flex items-center gap-4">
                <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-amber-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">{carProfile.vehicleType === 'eletrico' ? 'Custo Energia' : 'Custo Combustível'} por KM</span>
                  <p className="text-base font-extrabold text-zinc-200 font-mono">{formatBRL(energyCostPerKM)} <span className="text-xs text-zinc-500 font-normal">/ KM</span></p>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl flex items-center gap-4">
                <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl text-blue-400">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Consumo de Alimentação Diário</span>
                  <p className="text-base font-extrabold text-zinc-200 font-mono">
                    {formatBRL(dailyFoodAverage)} 
                    <span className="text-xs text-zinc-500 font-normal"> / dia trabalhado ({elapsedWorkingDays} {elapsedWorkingDays === 1 ? 'dia' : 'dias'})</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 1. Chart of daily trends */}
        <section className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg transition-all">
          <div className="p-5 bg-zinc-900 border-b border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Tendência Financeira Diária</h3>
                <p className="text-xs text-zinc-400 font-sans">Faturamento Bruto (Verde) vs. Custos Operacionais (Laranja)</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData.filter(d => d.Faturamento > 0 || d.Custos > 0)}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCustos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                  <YAxis stroke="#6b7280" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px', color: '#f4f4f5' }}
                    formatter={(value: any) => [formatBRL(Number(value)), '']}
                  />
                  <Area type="monotone" dataKey="Faturamento" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorFaturamento)" name="Faturamento Bruto" />
                  <Area type="monotone" dataKey="Custos" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorCustos)" name="Custos Totais" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-2 border-t border-zinc-800/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm" />
                <span className="text-zinc-300 font-medium">Faturamento: <strong className="text-zinc-100 font-mono">{formatBRL(totalGrossEarnings)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
                <span className="text-zinc-300 font-medium">Custos: <strong className="text-zinc-100 font-mono">{formatBRL(totalCosts)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm" />
                <span className="text-zinc-300 font-medium">Lucro Líquido: <strong className="text-emerald-400 font-mono">{formatBRL(realNetEarnings)}</strong></span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Breakdown Cards: App Revenue vs Expense Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* App Revenue Share */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <Car className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-100">Faturamento por Aplicativo</h4>
                  <p className="text-[11px] text-zinc-400">Origem das corridas e ganhos</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-300">{formatBRL(totalGrossEarnings)}</span>
            </div>

            <div className="space-y-3 pt-1">
              {/* Uber */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-300 flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-zinc-100" /> Uber
                  </span>
                  <span className="font-mono text-zinc-200">
                    {formatBRL(uberTotal)} ({totalGrossEarnings > 0 ? `${((uberTotal / totalGrossEarnings) * 100).toFixed(1)}%` : '0%'})
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full bg-zinc-200 rounded-full transition-all"
                    style={{ width: `${totalGrossEarnings > 0 ? (uberTotal / totalGrossEarnings) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* 99 Pop */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-300 flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> 99 Pop / Comfort
                  </span>
                  <span className="font-mono text-zinc-200">
                    {formatBRL(app99Total)} ({totalGrossEarnings > 0 ? `${((app99Total / totalGrossEarnings) * 100).toFixed(1)}%` : '0%'})
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${totalGrossEarnings > 0 ? (app99Total / totalGrossEarnings) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Particular */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-300 flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Particular / Outros
                  </span>
                  <span className="font-mono text-zinc-200">
                    {formatBRL(particularTotal)} ({totalGrossEarnings > 0 ? `${((particularTotal / totalGrossEarnings) * 100).toFixed(1)}%` : '0%'})
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${totalGrossEarnings > 0 ? (particularTotal / totalGrossEarnings) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Expense Categories Share */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-100">Distribuição de Despesas</h4>
                  <p className="text-[11px] text-zinc-400">Custos operacionais e fixos do mês</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-rose-400">
                {formatBRL(totalCosts)}
              </span>
            </div>

            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center justify-between p-2 bg-zinc-950/60 rounded-xl border border-zinc-850">
                <span className="text-zinc-300 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> {carProfile.vehicleType === 'eletrico' ? 'Energia / Recargas' : 'Combustível'}
                </span>
                <span className="font-mono font-bold text-zinc-200">{formatBRL(totalEnergyCost)}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/60 rounded-xl border border-zinc-850">
                <span className="text-zinc-300 flex items-center gap-2">
                  <Car className="w-3.5 h-3.5 text-blue-400" /> Diária / Aluguel do Carro
                </span>
                <span className="font-mono font-bold text-zinc-200">{formatBRL(totalCarRental)}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/60 rounded-xl border border-zinc-850">
                <span className="text-zinc-300 flex items-center gap-2">
                  <Coffee className="w-3.5 h-3.5 text-orange-400" /> Alimentação & Café
                </span>
                <span className="font-mono font-bold text-zinc-200">{formatBRL(totalFoodExpenses)}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/60 rounded-xl border border-zinc-850">
                <span className="text-zinc-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Manutenção & Lavagem
                </span>
                <span className="font-mono font-bold text-zinc-200">{formatBRL(totalCarExpenses)}</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-zinc-950/60 rounded-xl border border-zinc-850">
                <span className="text-zinc-300 flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-rose-400" /> Contas & Despesas Fixas
                </span>
                <span className="font-mono font-bold text-zinc-200">{formatBRL(totalFixedExpenses)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* 3. Driver Performance Indicators */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-100">Indicadores de Eficiência do Motorista</h4>
              <p className="text-[11px] text-zinc-400">Rendimento por KM rodado e por corrida realizada</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-850 space-y-1">
              <span className="text-[10px] text-zinc-400 font-bold uppercase block">Rendimento R$/KM</span>
              <span className="text-base font-black font-mono text-emerald-400">
                {formatBRL(earningsPerKM)}
                <span className="text-[10px] text-zinc-500 font-normal"> /km</span>
              </span>
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-850 space-y-1">
              <span className="text-[10px] text-zinc-400 font-bold uppercase block">Lucro Líquido R$/KM</span>
              <span className="text-base font-black font-mono text-cyan-400">
                {formatBRL(netEarningsPerKM)}
                <span className="text-[10px] text-zinc-500 font-normal"> /km</span>
              </span>
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-850 space-y-1">
              <span className="text-[10px] text-zinc-400 font-bold uppercase block">Custo de Energia/KM</span>
              <span className="text-base font-black font-mono text-amber-400">
                {formatBRL(energyCostPerKM)}
                <span className="text-[10px] text-zinc-500 font-normal"> /km</span>
              </span>
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-850 space-y-1">
              <span className="text-[10px] text-zinc-400 font-bold uppercase block">KM Total Rodado</span>
              <span className="text-base font-black font-mono text-zinc-200">
                {totalKM.toLocaleString('pt-BR')}
                <span className="text-[10px] text-zinc-500 font-normal"> km</span>
              </span>
            </div>
          </div>
        </div>

      </div>
    )}

      </main>

      {/* Elegant Footer info */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-10 mt-20 text-xs text-zinc-500 pb-28">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2.5 text-zinc-500 text-xs">
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              className="p-1 bg-white border border-zinc-700/80 rounded-lg shadow-sm hover:scale-105 transition-transform cursor-pointer"
              title="GKD Mobility"
            >
              <GkdMobilityLogo size="xs" />
            </button>
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              className="font-bold text-zinc-300 hover:text-emerald-400 transition-colors cursor-pointer"
              title="Clique para ver Detalhes e Descrição do Aplicativo"
            >
              GKD Controle Diário
            </button>
            <span className="text-zinc-700">•</span>
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(true)}
              className="text-[11px] font-mono text-zinc-500 hover:text-zinc-400 transition-colors cursor-pointer"
              title="Versão do Aplicativo (Clique para detalhes)"
            >
              GKD_CD_V.1.0.0
            </button>
          </div>
          <p className="max-w-xl mx-auto text-zinc-500 leading-relaxed">
            Algoritmo inteligente integrado para {carProfile.vehicleType === 'eletrico' ? 'carros elétricos' : 'carros a combustão'}. Cálculos operacionais, persistência local 100% offline e interface otimizada para dispositivos móveis.
          </p>
        </div>
      </footer>

      {/* MODERN BOTTOM NAVIGATION BAR DOCK */}
      <nav id="bottom-dock-nav" className="fixed bottom-0 left-0 right-0 z-50 bg-[#090b10]/95 backdrop-blur-xl border-t border-zinc-800/90 shadow-[0_-15px_40px_rgba(0,0,0,0.9)] pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 px-2">
        <div className="max-w-lg mx-auto px-3 sm:px-4 py-2 flex items-center justify-between relative">
          
          {/* 1. Contas */}
          <button
            id="btn-nav-contas"
            type="button"
            onClick={() => {
              setActiveTab('contas');
              setIsFixedExpensesSectionOpen(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer group ${
              activeTab === 'contas' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="relative">
              <Receipt className={`w-5 h-5 transition-transform group-hover:scale-110 ${activeTab === 'contas' ? 'text-emerald-400 stroke-[2.5]' : 'text-zinc-400'}`} />
              {fixedExpenses.length > 0 && (
                <span className="absolute -top-1.5 -right-3 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-md shadow-rose-500/40 border border-rose-400/50 min-w-[16px] text-center">
                  {fixedExpenses.length}
                </span>
              )}
            </div>
            <span className={`text-[11px] font-bold mt-1 tracking-tight ${activeTab === 'contas' ? 'text-emerald-400 font-extrabold' : 'text-zinc-400'}`}>
              Contas
            </span>
            {activeTab === 'contas' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] mt-0.5 animate-pulse" />
            ) : (
              <span className="w-1.5 h-1.5 mt-0.5 opacity-0" />
            )}
          </button>

          {/* 2. Entradas */}
          <button
            id="btn-nav-entradas"
            type="button"
            onClick={() => {
              setActiveTab('entradas');
              setIsHistorySectionOpen(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer group ${
              activeTab === 'entradas' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TrendingUp className={`w-5 h-5 transition-transform group-hover:scale-110 ${activeTab === 'entradas' ? 'text-emerald-400 stroke-[2.5]' : 'text-zinc-400'}`} />
            <span className={`text-[11px] font-bold mt-1 tracking-tight ${activeTab === 'entradas' ? 'text-emerald-400 font-extrabold' : 'text-zinc-400'}`}>
              Entradas
            </span>
            {activeTab === 'entradas' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] mt-0.5 animate-pulse" />
            ) : (
              <span className="w-1.5 h-1.5 mt-0.5 opacity-0" />
            )}
          </button>

          {/* 3. Botão Central (+) */}
          <div className="flex-1 flex justify-center -mt-6 sm:-mt-7 z-20">
            <button
              id="btn-nav-add"
              type="button"
              onClick={() => {
                const today = new Date();
                const pad = (n: number) => String(n).padStart(2, '0');
                const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
                openModalForDate(todayStr);
              }}
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-300 text-zinc-950 flex items-center justify-center shadow-lg shadow-teal-500/40 hover:shadow-teal-500/70 hover:scale-110 active:scale-95 transition-all border-4 border-[#090b10] cursor-pointer"
              title="Novo Lançamento Diário (Hoje)"
            >
              <Plus className="w-7 h-7 sm:w-8 sm:h-8 stroke-[3] text-zinc-950" />
            </button>
          </div>

          {/* 4. Visão Geral */}
          <button
            id="btn-nav-visao-geral"
            type="button"
            onClick={() => {
              setActiveTab('visao-geral');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer group ${
              activeTab === 'visao-geral' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LayoutGrid className={`w-5 h-5 transition-transform group-hover:scale-110 ${activeTab === 'visao-geral' ? 'text-emerald-400 stroke-[2.5]' : 'text-zinc-400'}`} />
            <span className={`text-[11px] font-bold mt-1 tracking-tight ${activeTab === 'visao-geral' ? 'text-emerald-400 font-extrabold' : 'text-zinc-400'}`}>
              Visão Geral
            </span>
            {activeTab === 'visao-geral' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] mt-0.5 animate-pulse" />
            ) : (
              <span className="w-1.5 h-1.5 mt-0.5 opacity-0" />
            )}
          </button>

          {/* 5. Relatórios */}
          <button
            id="btn-nav-relatorios"
            type="button"
            onClick={() => {
              setActiveTab('relatorios');
              setIsChartSectionOpen(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer group ${
              activeTab === 'relatorios' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <PieChart className={`w-5 h-5 transition-transform group-hover:scale-110 ${activeTab === 'relatorios' ? 'text-emerald-400 stroke-[2.5]' : 'text-zinc-400'}`} />
            <span className={`text-[11px] font-bold mt-1 tracking-tight ${activeTab === 'relatorios' ? 'text-emerald-400 font-extrabold' : 'text-zinc-400'}`}>
              Relatórios
            </span>
            {activeTab === 'relatorios' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] mt-0.5 animate-pulse" />
            ) : (
              <span className="w-1.5 h-1.5 mt-0.5 opacity-0" />
            )}
          </button>

        </div>
      </nav>


      {/* HIGH-FIDELITY "EDITAR LANÇAMENTO DIÁRIO" MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 pb-[calc(env(safe-area-inset-bottom)+24px)] overflow-y-auto">
          <div className="bg-[#0f1115] border border-zinc-800/90 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8">
            
            {/* Modal Header */}
            <div className="border-b border-zinc-850 px-5 py-4 flex justify-between items-center bg-[#13171e]">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded-lg">
                  <span className="text-lg">📄</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">
                    Editar Lançamento Diário
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Registre rodagem, {carProfile.vehicleType === 'eletrico' ? 'energia' : 'combustível'}, custos e ganhos por aplicativo
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveLog} className="p-5 space-y-6 overflow-y-auto max-h-[75vh] scrollbar-thin scrollbar-thumb-zinc-800">
              
              {/* Dia Anterior Sem Dados - Modal Pop-up Moderno e Elegante */}
              {confirmPrevDayPrompt && prevDayPromptInfo && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[110] p-4 pb-[calc(env(safe-area-inset-bottom)+24px)] animate-fadeIn">
                  <div className="bg-[#0f131a] border border-amber-500/40 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-5 sm:p-6 space-y-4 animate-scaleUp">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl shrink-0">
                          <CalendarIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-zinc-100">
                            Confirmar Data do Registro
                          </h3>
                          <p className="text-xs text-amber-400 font-medium">Dia anterior sem lançamento</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmPrevDayPrompt(false);
                          setPrevDayPromptInfo(null);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                        title="Fechar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content Explanation */}
                    <div className="bg-zinc-900/70 border border-zinc-800/80 p-3.5 rounded-xl text-xs sm:text-sm text-zinc-300 leading-relaxed space-y-2">
                      <p>
                        Identificamos que o dia <span className="font-bold text-amber-400">{prevDayPromptInfo.prevDateStr.split('-').reverse().join('/')}</span> ainda não possui lançamentos.
                      </p>
                      <p className="text-zinc-400 text-xs">
                        Para qual data você gostaria de salvar estas informações?
                      </p>
                    </div>

                    {/* Option Cards */}
                    <div className="grid grid-cols-1 gap-2.5 pt-1">
                      {/* Opção 1: Salvar para a data atual */}
                      <button
                        type="button"
                        onClick={() => executeSaveLog(prevDayPromptInfo.formDate)}
                        className="p-3.5 bg-zinc-900 hover:bg-zinc-850 border-2 border-emerald-500/40 hover:border-emerald-400 rounded-xl transition-all flex items-center justify-between text-left group cursor-pointer shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg group-hover:scale-105 transition-transform">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-zinc-100 block">
                              Salvar em {prevDayPromptInfo.formDate.split('-').reverse().join('/')}
                            </span>
                            <span className="text-[11px] text-emerald-400 font-medium">
                              Data selecionada atualmente
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                      </button>

                      {/* Opção 2: Salvar para o dia anterior */}
                      <button
                        type="button"
                        onClick={() => {
                          setFormDate(prevDayPromptInfo.prevDateStr);
                          executeSaveLog(prevDayPromptInfo.prevDateStr);
                        }}
                        className="p-3.5 bg-amber-500/10 hover:bg-amber-500/20 border-2 border-amber-500/40 hover:border-amber-400 rounded-xl transition-all flex items-center justify-between text-left group cursor-pointer shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg group-hover:scale-105 transition-transform">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-zinc-100 block">
                              Salvar em {prevDayPromptInfo.prevDateStr.split('-').reverse().join('/')}
                            </span>
                            <span className="text-[11px] text-amber-400 font-medium">
                              Preencher o dia anterior pendente
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    </div>

                    {/* Footer Cancel */}
                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmPrevDayPrompt(false);
                          setPrevDayPromptInfo(null);
                        }}
                        className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors py-1 cursor-pointer"
                      >
                        Voltar para editar formulário
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* High KM Confirmation Pop-up Modal */}
              {confirmHighKmPrompt && (() => {
                const targetD = highKmTargetDate || formDate;
                let prevKmLog: DailyLog | null = null;
                if (targetD) {
                  const [y, m, d] = targetD.split('-').map(Number);
                  const targetObj = new Date(y, m - 1, d);
                  const prevDateObj = new Date(targetObj);
                  prevDateObj.setDate(prevDateObj.getDate() - 1);
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const prevDateStr = `${prevDateObj.getFullYear()}-${pad(prevDateObj.getMonth() + 1)}-${pad(prevDateObj.getDate())}`;
                  
                  const exactPrev = logs.find(l => l.date === prevDateStr);
                  if (exactPrev) {
                    prevKmLog = exactPrev;
                  } else {
                    const older = logs.filter(l => l.date < targetD).sort((a, b) => b.date.localeCompare(a.date));
                    if (older.length > 0) prevKmLog = older[0];
                  }
                }

                const parseVal = (v: any) => {
                  if (typeof v === 'number') return isNaN(v) ? 0 : Math.round(v * 100) / 100;
                  if (!v) return 0;
                  const parsed = parseFloat(String(v).replace(',', '.'));
                  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
                };
                const currentKm = parseVal(kmRodado);
                const prevKm = prevKmLog ? parseVal(prevKmLog.kmRodado) : 0;
                const deductedKm = Math.round(Math.max(0, currentKm - prevKm) * 100) / 100;
                const removedZeroKm = Math.round(currentKm / 10);

                return (
                  <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[100] p-4 pb-[calc(env(safe-area-inset-bottom)+24px)] animate-fadeIn">
                    <div className="bg-[#12161f] border border-red-500/40 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-5 animate-scaleUp">
                      
                      {/* Header Icon + Title */}
                      <div className="flex items-center gap-3 border-b border-red-500/20 pb-4">
                        <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl shrink-0">
                          <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-red-400">
                            Quilometragem Acima de 300 KM
                          </h3>
                          <p className="text-xs text-zinc-400">Verifique o valor do odômetro</p>
                        </div>
                      </div>

                      {/* Body Message */}
                      <div className="text-sm text-zinc-200 leading-relaxed space-y-3 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
                        <p>
                          Você informou <span className="font-bold text-red-400 text-base">{kmRodado} KM</span> para hoje.
                        </p>

                        {prevKmLog ? (
                          <p className="text-xs sm:text-sm text-zinc-300">
                            No registro anterior ({prevKmLog.date.split('-').reverse().join('/')}), constavam <span className="font-bold text-emerald-400">{prevKm} KM</span>.
                            <br /><br />
                            {prevKm > 0 ? (
                              <>
                                Você pode <span className="font-bold text-emerald-400">abater os {prevKm} KM</span> do dia anterior (ficando <span className="font-bold text-emerald-300">{deductedKm} KM</span>), ou confirmar se <span className="font-bold text-red-400">zerou o odômetro</span>.
                              </>
                            ) : (
                              <>
                                Você pode confirmar se <span className="font-bold text-red-400">zerou o odômetro</span>.
                              </>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs sm:text-sm text-zinc-300">
                            Você tem certeza que este valor está correto e zerou o odômetro no dia anterior?
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                        {prevKmLog && prevKm > 0 && (
                          <button
                            type="button"
                            onClick={() => executeSaveLog(targetD, true, deductedKm)}
                            className="py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                          >
                            <span>Abater {prevKm} KM ({deductedKm} KM)</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => executeSaveLog(targetD, true)}
                          className="py-3 px-4 bg-red-500 hover:bg-red-600 text-zinc-950 font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-lg shadow-red-500/20 text-center"
                        >
                          Sim, Zerei ({kmRodado} KM)
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmHighKmPrompt(false)}
                          className={`py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer text-center ${(!prevKmLog || prevKm <= 0) ? 'col-span-1 sm:col-span-2' : ''}`}
                        >
                          Corrigir Manualmente
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })()}
              
              {/* INTUITIVE AI EXTRACTION CARD */}
              <div className="bg-[#12161f]/90 border border-emerald-500/30 p-4 rounded-2xl space-y-3.5 shadow-xl shadow-emerald-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-400 tracking-wide">
                      Leitura Automática & Scanner IA
                    </span>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                    Gemini Vision
                  </span>
                </div>
                
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Tire foto, envie múltiplos prints (Uber, 99, recargas, despesas) ou cole dados para preencher o dia automaticamente.
                </p>

                {/* Mode Selector Tabs */}
                {!cameraActive && (
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAiTabMode('upload')}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        aiTabMode === 'upload'
                          ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/30'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Fotos/Prints</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && (window as any).Capacitor) {
                          handleNativeCameraCapture();
                        } else {
                          setAiTabMode('camera');
                          startCamera(cameraFacingMode);
                        }
                      }}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        aiTabMode === 'camera'
                          ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/30'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Câmera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiTabMode('paste')}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        aiTabMode === 'paste'
                          ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/30'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>Colar Texto</span>
                    </button>
                  </div>
                )}

                {/* Status alerts */}
                {aiLoading && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs flex items-center gap-2.5 text-emerald-200 animate-pulse">
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                    <span>Lendo comprovantes e preenchendo todos os campos...</span>
                  </div>
                )}

                {aiSuccessMsg && (
                  <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-emerald-200">Reconhecimento Concluído!</span>
                      <span className="text-zinc-300 text-[11px] leading-tight block mt-0.5">{aiSuccessMsg}</span>
                    </div>
                  </div>
                )}

                {aiErrorMsg && (
                  <div className="bg-red-950/40 border border-red-500/40 text-red-300 p-3 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-red-200">Atenção</span>
                      <span className="text-zinc-300 text-[11px] leading-tight block mt-0.5">{aiErrorMsg}</span>
                    </div>
                  </div>
                )}

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
                          <p className="text-white text-xs font-bold">Enquadre o comprovante, recibo ou tela da Uber / 99</p>
                          <p className="text-emerald-300 text-[11px] mt-0.5">A IA fará a leitura automática de todos os valores</p>
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
                          <Upload className="w-5 h-5 text-emerald-400" />
                        </button>

                        {/* Botão Shutter Principal de Captura */}
                        <button
                          type="button"
                          onClick={takePhoto}
                          className="w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex flex-col items-center justify-center gap-1 shadow-2xl shadow-emerald-500/50 border-4 border-white/90 transition-all cursor-pointer transform active:scale-90 hover:scale-105"
                          title="Tirar Foto e Ler com IA"
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
                        Toque no botão para Fotografar e Preencher com IA
                      </span>
                    </div>
                  </div>,
                  document.body
                )}

                {/* UPLOAD MODE */}
                {!cameraActive && aiTabMode === 'upload' && !aiLoading && (
                  <div className="space-y-2">
                    <div 
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          processUploadedFiles(e.dataTransfer.files);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 rounded-xl p-4 text-center cursor-pointer transition-all bg-zinc-950/40 hover:bg-emerald-950/10 group"
                    >
                      <Upload className="w-6 h-6 mx-auto text-emerald-400 mb-1.5 group-hover:scale-110 transition-transform" />
                      <span className="text-xs text-zinc-200 block font-bold">
                        Clique ou arraste um ou vários prints/fotos aqui
                      </span>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">
                        Prints do Uber, 99, foto de comprovante de recarga/posto, pedágio ou refeição
                      </span>
                    </div>

                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      multiple
                      className="hidden" 
                      onChange={handleFileChange}
                    />

                    <input 
                      ref={cameraInputRef}
                      type="file" 
                      accept="image/*" 
                      capture="user"
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                  </div>
                )}

                {/* PASTE TEXT MODE */}
                {!cameraActive && aiTabMode === 'paste' && !aiLoading && (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={aiPastedText}
                      onChange={(e) => setAiPastedText(e.target.value)}
                      placeholder="Cole aqui o texto copiado de relatórios, planilhas do Excel, mensagens do WhatsApp ou recibos..."
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-550 focus:outline-none transition-all resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleExtractPastedText}
                        disabled={!aiPastedText.trim()}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 text-xs font-black py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Extrair Dados do Texto</span>
                      </button>
                      {aiPastedText && (
                        <button
                          type="button"
                          onClick={() => setAiPastedText('')}
                          className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl text-xs border border-zinc-800 cursor-pointer"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* DISCREET VOICE RECOGNITION BUTTON */}
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={voiceRecording ? stopVoiceRecognition : startVoiceRecognition}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer font-bold text-xs ${
                        voiceRecording 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' 
                          : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20'
                      }`}
                      title={voiceRecording ? "Clique para parar de gravar" : "Clique para falar por voz"}
                    >
                      {voiceRecording ? (
                        <>
                          <MicOff className="w-3.5 h-3.5 text-red-400" />
                          <span>Parar Gravação</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-blue-400" />
                          <span>Falar por Voz</span>
                        </>
                      )}
                    </button>

                    {voiceLoading && (
                      <span className="text-xs text-blue-400 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando voz...
                      </span>
                    )}
                  </div>

                  {voiceTranscribedText && (
                    <span className="text-[11px] text-zinc-400 italic truncate max-w-[180px]" title={voiceTranscribedText}>
                      "{voiceTranscribedText}"
                    </span>
                  )}
                </div>

                {voiceSuccessMsg && (
                  <div className="bg-blue-950/20 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-zinc-300 text-[11px]">{voiceSuccessMsg}</span>
                  </div>
                )}

                {voiceErrorMsg && (
                  <div className="bg-red-950/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-zinc-300 text-[11px]">{voiceErrorMsg}</span>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* SECTION 1: DIA DO LANÇAMENTO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400/90 text-xs font-bold uppercase tracking-wider">
                  <CalendarIcon className="w-4 h-4 text-emerald-400" />
                  <span>Dia do Lançamento</span>
                </div>

                {/* Tags row */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="bg-[#152a22] text-emerald-400 border border-emerald-500/20 text-xs px-3 py-1.5 rounded-lg font-bold">
                    {(() => {
                      const dObj = new Date(formDate + 'T00:00:00');
                      const wDay = WEEK_DAYS[dObj.getDay()];
                      const formatedD = formDate.split('-').reverse().join('/');
                      return `${wDay} • ${formatedD}`;
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const realY = today.getFullYear();
                      const realM = today.getMonth() + 1;
                      const realD = today.getDate();
                      setSelectedYear(realY);
                      setSelectedMonth(realM);
                      const todayStr = `${realY}-${String(realM).padStart(2, '0')}-${String(realD).padStart(2, '0')}`;
                      handleDateChange(todayStr);
                    }}
                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 font-semibold cursor-pointer"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(today.getDate() - 1);
                      const realY = yesterday.getFullYear();
                      const realM = yesterday.getMonth() + 1;
                      const realD = yesterday.getDate();
                      setSelectedYear(realY);
                      setSelectedMonth(realM);
                      const yStr = `${realY}-${String(realM).padStart(2, '0')}-${String(realD).padStart(2, '0')}`;
                      handleDateChange(yStr);
                    }}
                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 font-semibold cursor-pointer"
                  >
                    Ontem
                  </button>
                </div>

                {/* Month selectors */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-450 block uppercase font-bold tracking-wider">Dia do Mês</label>
                    <select
                      value={formDate ? parseInt(formDate.split('-')[2], 10) : 1}
                      onChange={(e) => {
                        const dayP = String(e.target.value).padStart(2, '0');
                        const newD = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${dayP}`;
                        handleDateChange(newD);
                      }}
                      className="w-full bg-[#11141a] border border-zinc-800 rounded-lg text-xs py-2 px-2.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {Array.from({ length: daysInSelectedMonth }).map((_, idx) => (
                        <option key={idx + 1} value={idx + 1}>Dia {idx + 1}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] text-zinc-450 block uppercase font-bold tracking-wider">Data Completa</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="w-full bg-[#11141a] border border-zinc-800 rounded-lg text-xs py-2 px-2.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

              </div>

              {/* SECTION 2: RODAGEM, BATERIA & CUSTOS OPERACIONAIS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pt-2 border-t border-zinc-850">
                  <div className="flex items-center gap-2 text-emerald-450 text-xs font-bold uppercase tracking-wider">
                    {carProfile.vehicleType === 'eletrico' ? <Zap className="w-4 h-4 text-emerald-400" /> : <Coffee className="w-4 h-4 text-emerald-400" />}
                    <span>Rodagem, {carProfile.vehicleType === 'eletrico' ? 'Bateria' : 'Combustível'} & Custos Operacionais</span>
                  </div>
                </div>

                {/* Electric/Combustion Car calculator block */}
                <div className="bg-[#12161f] border border-emerald-950/40 p-4 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-450 text-[11px] font-bold uppercase tracking-wider">
                      {carProfile.vehicleType === 'eletrico' ? <Zap className="w-3.5 h-3.5 text-amber-500" /> : <Coffee className="w-3.5 h-3.5 text-amber-500" />}
                      <span>{carProfile.vehicleType === 'eletrico' ? 'Cálculo de Energia (Carro Elétrico)' : 'Cálculo de Abastecimento (Carro a Combustão)'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleLoadCarDataIntoEntry}
                        className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-all flex items-center gap-1 group ${
                          (Math.abs((parseFloat(String(valorKwh).replace(',', '.')) || 0) - (carProfile.kwhCostRate || 1.05)) > 0.01 ||
                           Math.abs((parseFloat(String(capacidadeBateria).replace(',', '.')) || 0) - (carProfile.batteryCapacityKwh || 53.6)) > 0.1)
                            ? 'bg-amber-900/30 text-amber-400 border-amber-800/50 hover:bg-amber-800/40 animate-pulse'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900 hover:text-emerald-400'
                        }`}
                        title="Sincronizar dados do lançamento com o perfil atual do veículo (Tarifa e Bateria)"
                      >
                        <Sparkles className={`w-2.5 h-2.5 ${(Math.abs((parseFloat(String(valorKwh).replace(',', '.')) || 0) - (carProfile.kwhCostRate || 1.05)) > 0.01) ? 'text-amber-400' : 'text-zinc-500 group-hover:text-emerald-400'}`} />
                        {carProfile.modelName || (carProfile.vehicleType === 'eletrico' ? 'EV' : 'Combustão')}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-500 block font-bold uppercase tracking-wider">{carProfile.vehicleType === 'eletrico' ? 'Sobrou de Bateria (%)' : 'Sobrou no Tanque (%)'}</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex: 20"
                        value={sobrouBateria}
                        onFocus={() => setSobrouBateria('')}
                        onChange={(e) => {
                          // Allow numbers and comma/dot
                          const val = e.target.value.replace(/[^\d.,]/g, '');
                          setSobrouBateria(val);
                          setLastEditedEnergyField('bateria');
                          setIsEnergyCostOverridden(false);
                        }}
                        className="w-full bg-[#0d0d0f] border border-zinc-800/50 rounded-xl text-sm py-3 px-4 font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] text-zinc-500 block font-bold uppercase tracking-wider">{carProfile.vehicleType === 'eletrico' ? 'Kilowatt (R$/kWh)' : 'Preço (R$/Litro)'}</label>
                        {Math.abs((parseFloat(String(valorKwh).replace(',', '.')) || 0) - (carProfile.kwhCostRate || (carProfile.vehicleType === 'eletrico' ? 1.05 : 5.50))) > 0.01 && (
                          <span className="text-[9px] text-amber-500 font-bold flex items-center gap-0.5" title="Diferente do perfil">
                            <AlertCircle className="w-2 h-2" /> Perfil: {String(carProfile.kwhCostRate || (carProfile.vehicleType === 'eletrico' ? 1.05 : 5.50)).replace('.', ',')}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valorKwh}
                        onFocus={() => setValorKwh('')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d.,]/g, '');
                          setValorKwh(val);
                          setIsEnergyCostOverridden(false);
                        }}
                        className={`w-full bg-[#0d0d0f] border rounded-xl text-sm py-3 px-4 font-mono focus:outline-none focus:ring-1 transition-all ${
                          Math.abs((parseFloat(String(valorKwh).replace(',', '.')) || 0) - (carProfile.kwhCostRate || (carProfile.vehicleType === 'eletrico' ? 1.05 : 5.50))) > 0.01
                            ? 'border-amber-500/30 text-amber-200 focus:ring-amber-500/30'
                            : 'border-zinc-800/50 text-zinc-100 focus:ring-emerald-500/30'
                        }`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] text-zinc-500 block font-bold uppercase tracking-wider">{carProfile.vehicleType === 'eletrico' ? 'Bateria (kWh)' : 'Tanque (Litros)'}</label>
                        {Math.abs((parseFloat(String(capacidadeBateria).replace(',', '.')) || 0) - (carProfile.batteryCapacityKwh || (carProfile.vehicleType === 'eletrico' ? 53.6 : 50))) > 0.1 && (
                          <span className="text-[9px] text-amber-500 font-bold flex items-center gap-0.5" title="Diferente do perfil">
                            <AlertCircle className="w-2 h-2" /> Perfil: {String(carProfile.batteryCapacityKwh || (carProfile.vehicleType === 'eletrico' ? 53.6 : 50)).replace('.', ',')}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={capacidadeBateria}
                        onFocus={() => setCapacidadeBateria('')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d.,]/g, '');
                          setCapacidadeBateria(val);
                          setIsEnergyCostOverridden(false);
                        }}
                        className={`w-full bg-[#0d0d0f] border rounded-xl text-sm py-3 px-4 font-mono focus:outline-none focus:ring-1 transition-all ${
                          Math.abs((parseFloat(String(capacidadeBateria).replace(',', '.')) || 0) - (carProfile.batteryCapacityKwh || (carProfile.vehicleType === 'eletrico' ? 53.6 : 50))) > 0.1
                            ? 'border-amber-500/30 text-amber-200 focus:ring-amber-500/30'
                            : 'border-zinc-800/50 text-zinc-100 focus:ring-emerald-500/30'
                        }`}
                      />
                    </div>
                  </div>
                  
                  <div className="h-px bg-zinc-800/50 w-full my-1"></div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-500 block font-bold uppercase tracking-wider">KM Rodado</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ex: 180"
                        value={kmRodado}
                        onFocus={() => setKmRodado('')}
                        onChange={(e) => {
                          // Allow only numbers
                          const val = e.target.value.replace(/\D/g, '');
                          setKmRodado(val);
                          setLastEditedEnergyField('km');
                          setIsEnergyCostOverridden(false);
                        }}
                        onBlur={() => {
                          const num = parseInt(String(kmRodado), 10) || 0;
                          if (num > 0) setKmRodado(num.toString());
                        }}
                        className="w-full bg-[#0d0d0f] border border-zinc-800/50 rounded-xl text-sm py-3 px-4 font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-500 block font-bold uppercase tracking-wider">{carProfile.vehicleType === 'eletrico' ? 'Custo Energia (R$)' : 'Custo Abastec. (R$)'}</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={custoEnergia}
                        onFocus={() => setCustoEnergia('')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d.,]/g, '');
                          setCustoEnergia(val);
                          setIsEnergyCostOverridden(true);
                        }}
                        className="w-full bg-[#0d0d0f] border border-zinc-800/50 rounded-xl text-sm py-3 px-4 font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
                      />
                    </div>
                  </div>
                  
                  {!showRechargeInput ? (
                    <button
                      type="button"
                      onClick={() => setShowRechargeInput(true)}
                      className="text-[11px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 mt-2 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Novo (Recarga/Abastecimento na rua)
                    </button>
                  ) : (
                    <div className="bg-sky-500/10 border border-sky-500/20 p-3 rounded-lg mt-3 space-y-3">
                      <div className="text-[10px] text-sky-400 font-bold uppercase">Adicionar Recarga na Rua</div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Valor Gasto (R$)"
                          value={rechargeCost}
                          onChange={(e) => setRechargeCost(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded-md text-xs py-1.5 px-2 font-mono text-zinc-200 focus:ring-1 focus:ring-sky-500"
                        />
                        <input
                          type="number"
                          placeholder="KM Rodados (Opcional)"
                          value={rechargeKm}
                          onChange={(e) => setRechargeKm(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded-md text-xs py-1.5 px-2 font-mono text-zinc-200 focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddRecharge}
                          className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-md cursor-pointer transition-colors"
                        >
                          Adicionar
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRechargeInput(false)}
                          className="text-zinc-400 hover:text-zinc-200 text-[10px] font-bold px-2 py-1.5 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Car Daily / Rent input with smart rateio */}
                {(() => {
                  const [fYear, fMonth] = (formDate || '').split('-').map(Number);
                  const mKey = (fYear && fMonth) ? `${fYear}-${String(fMonth).padStart(2, '0')}` : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
                  const cDays = carProfile.customWorkDays?.[mKey] || [];
                  
                  const rateInfo = (fYear && fMonth) 
                    ? getMonthWorkDaysAndRate(fYear, fMonth, getEffectiveMonthlyCost(fYear, fMonth), cDays) 
                    : getMonthWorkDaysAndRate(selectedYear, selectedMonth, getEffectiveMonthlyCost(selectedYear, selectedMonth), cDays);
                  
                  return (
                    <div className="space-y-1.5 bg-[#12161f]/80 border border-blue-950/40 p-3 rounded-xl">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-zinc-300 block font-bold uppercase tracking-wider">
                          Diária Carro / Despesa do Veículo (R$)
                        </label>
                        {!isDayOff && null}
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={isDayOff ? "0.00 (Folga)" : "0.00"}
                          value={isDayOff ? '' : diariaCarro}
                          disabled={isDayOff}
                          onFocus={() => !isDayOff && setDiariaCarro('')}
                          onChange={(e) => setDiariaCarro(e.target.value)}
                          className={`w-full bg-[#11141a] border ${isDayOff ? 'border-zinc-850 text-zinc-600 bg-zinc-950/60' : 'border-blue-900/50 text-zinc-100 focus:ring-1 focus:ring-blue-500'} rounded-lg text-xs py-2 px-2.5 font-mono outline-none`}
                        />
                        {isDayOff && (
                          <span className="absolute right-3 top-2 text-[10px] text-amber-500 font-bold">
                            🌴 Folga (R$ 0,00)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-zinc-400 pt-0.5">
                        <span>
                          {isDayOff 
                            ? 'Dia de folga: sem débito de diária.' 
                            : `Rateio de ${formatBRL(rateInfo.monthlyTotalCost)} em ${rateInfo.workDaysCount} dias selecionados (${MONTH_NAMES[(fMonth || selectedMonth) - 1]}).`}
                        </span>
                        <span className="text-zinc-500 font-mono">
                          {rateInfo.workDaysCount} dias úteis
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ACCORDION 1: DESPESAS COM CARRO */}
                <div className="border border-zinc-850 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsCarExpensesOpen(!isCarExpensesOpen)}
                    className="w-full flex items-center justify-between p-3.5 bg-zinc-900/60 hover:bg-zinc-900 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">🚗</span>
                      <span className="text-xs font-bold text-zinc-200">Despesas com Carro</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-pink-400">
                        {formatBRL((parseFloat(wash) || 0) + (parseFloat(toll) || 0) + (parseFloat(maintenance) || 0) + (parseFloat(parking) || 0) + (parseFloat(carOther) || 0))}
                      </span>
                      {isCarExpensesOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                    </div>
                  </button>

                  {isCarExpensesOpen && (
                    <div className="p-4 bg-zinc-950/80 border-t border-zinc-850 space-y-3 grid grid-cols-2 gap-3">
                      <div className="space-y-1 col-span-2">
                        <label className="text-[10px] text-zinc-400 font-medium">Lava-jato / Limpeza (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={wash}
                          onFocus={() => setWash('')}
                          onChange={(e) => setWash(e.target.value)}
                          className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-1.5 px-2.5 font-mono text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-zinc-400 font-medium">Pedágios (R$)</label>
                          <button 
                            type="button" 
                            onClick={() => setIsTollCalculatorOpen(true)}
                            className="text-[9px] text-emerald-500 font-bold hover:text-emerald-400 transition-colors flex items-center gap-0.5"
                          >
                            <PlusCircle className="w-2.5 h-2.5" />
                            + Novo
                          </button>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={toll}
                          onFocus={() => setToll('')}
                          onChange={(e) => setToll(e.target.value)}
                          className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-1.5 px-2.5 font-mono text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 font-medium">Estacionamento (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={parking}
                          onFocus={() => setParking('')}
                          onChange={(e) => setParking(e.target.value)}
                          className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-1.5 px-2.5 font-mono text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 font-medium">Recarga Externa/Rua (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={publicCharging}
                          onFocus={() => setPublicCharging('')}
                          onChange={(e) => setPublicCharging(e.target.value)}
                          className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-1.5 px-2.5 font-mono text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 font-medium">Manutenção Extra (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={maintenance}
                          onFocus={() => setMaintenance('')}
                          onChange={(e) => setMaintenance(e.target.value)}
                          className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-1.5 px-2.5 font-mono text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 font-medium">Outros Extra (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={carOther}
                          onFocus={() => setCarOther('')}
                          onChange={(e) => setCarOther(e.target.value)}
                          className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-1.5 px-2.5 font-mono text-zinc-200"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCORDION 2: ALIMENTAÇÃO */}
                <div className="border border-zinc-850 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsFoodExpensesOpen(!isFoodExpensesOpen)}
                    className="w-full flex items-center justify-between p-3.5 bg-zinc-900/60 hover:bg-zinc-900 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">🍴</span>
                      <span className="text-xs font-bold text-zinc-200">Alimentação</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-500">
                        {formatBRL((parseFloat(lunch) || 0) + (parseFloat(dinner) || 0) + (parseFloat(snacks) || 0) + (parseFloat(coffee) || 0))}
                      </span>
                      {isFoodExpensesOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                    </div>
                  </button>

                  {isFoodExpensesOpen && (
                    <div className="p-4 bg-zinc-950/80 border-t border-zinc-850 space-y-3 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 font-medium">Café da manhã (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={snacks}
                          onFocus={() => setSnacks('')}
                          onChange={(e) => setSnacks(e.target.value)}
                          className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-1.5 px-2.5 font-mono text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 font-medium">Almoço (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={lunch}
                          onFocus={() => setLunch('')}
                          onChange={(e) => setLunch(e.target.value)}
                          className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-1.5 px-2.5 font-mono text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 font-medium">Café da tarde (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={coffee}
                          onFocus={() => setCoffee('')}
                          onChange={(e) => setCoffee(e.target.value)}
                          className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-1.5 px-2.5 font-mono text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 font-medium">Jantar (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={dinner}
                          onFocus={() => setDinner('')}
                          onChange={(e) => setDinner(e.target.value)}
                          className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-1.5 px-2.5 font-mono text-zinc-200"
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* SECTION 3: FATURAMENTO POR APLICATIVO */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-emerald-450 text-xs font-bold uppercase tracking-wider pt-2 border-t border-zinc-850">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span>Faturamento por Aplicativo</span>
                </div>

                {/* 99 App Section */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-sky-400">99 App</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400">Corridas</label>
                      <input
                        type="number"
                        placeholder="Ex: 8"
                        value={nRides}
                        onFocus={() => setNRides('')}
                        onChange={(e) => setNRides(e.target.value)}
                        className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-2 px-2.5 font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400">Ganhos (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={nEarnings}
                        onFocus={() => setNEarnings('')}
                        onChange={(e) => setNEarnings(e.target.value)}
                        className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-2 px-2.5 font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400">Recomp. (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={nBonus}
                        onFocus={() => setNBonus('')}
                        onChange={(e) => setNBonus(e.target.value)}
                        className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-2 px-2.5 font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Uber Section */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-sky-400">Uber</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400">Corridas</label>
                      <input
                        type="number"
                        placeholder="Ex: 12"
                        value={uRides}
                        onFocus={() => setURides('')}
                        onChange={(e) => setURides(e.target.value)}
                        className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-2 px-2.5 font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400">Ganhos (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={uEarnings}
                        onFocus={() => setUEarnings('')}
                        onChange={(e) => setUEarnings(e.target.value)}
                        className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-2 px-2.5 font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400">Recomp. (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={uBonus}
                        onFocus={() => setUBonus('')}
                        onChange={(e) => setUBonus(e.target.value)}
                        className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-2 px-2.5 font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Particular / InDrive Section */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-sky-400">Particular / InDrive</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400">Corridas</label>
                      <input
                        type="number"
                        placeholder="Ex: 2"
                        value={pRides}
                        onFocus={() => setPRides('')}
                        onChange={(e) => setPRides(e.target.value)}
                        className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-2 px-2.5 font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400">Valor (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={pEarnings}
                        onFocus={() => setPEarnings('')}
                        onChange={(e) => setPEarnings(e.target.value)}
                        className="w-full bg-[#11141a] border border-zinc-850 rounded-lg text-xs py-2 px-2.5 font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Rewards and other sources */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-emerald-400 block font-bold">Recompensas / Bônus do Dia (Soma no valor do dia)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={recompensasExtra}
                      onFocus={() => setRecompensasExtra('')}
                      onChange={(e) => setRecompensasExtra(e.target.value)}
                      className="w-full bg-[#11141a] border border-emerald-900/40 focus:border-emerald-500 rounded-lg text-xs py-2 px-2.5 font-mono text-emerald-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-amber-400 block font-bold">Anjo / Outras Fontes</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={outrasFontes}
                      onFocus={() => setOutrasFontes('')}
                      onChange={(e) => setOutrasFontes(e.target.value)}
                      className="w-full bg-[#11141a] border border-amber-900/40 focus:border-amber-500 rounded-lg text-xs py-2 px-2.5 font-mono text-amber-300"
                    />
                  </div>
                </div>

              </div>

            </form>

            {/* Modal Actions Footer */}
            <div className="border-t border-zinc-850 px-5 py-4 flex justify-between items-center bg-[#13171e]">
              {modalDeleteStage > 0 ? (
                <div className="flex items-center gap-2 bg-red-950/90 border border-red-500/60 p-2 rounded-xl animate-fadeIn">
                  {modalDeleteStage === 1 && (
                    <button
                      type="button"
                      onClick={handleDeleteLog}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-lg cursor-pointer transition-all shadow-lg shadow-red-600/30 animate-pulse flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Tem certeza?</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModalDeleteStage(0)}
                    className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg cursor-pointer transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalDeleteStage(1)}
                  disabled={!editingLogId}
                  className="p-2.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-20 cursor-pointer flex items-center gap-1.5"
                  title="Excluir Lançamento"
                >
                  <Trash2 className="w-5 h-5 stroke-[2]" />
                  <span className="text-xs font-bold hidden sm:inline">Excluir</span>
                </button>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveLog}
                  className="px-5 py-2.5 bg-[#00e676] hover:bg-[#00c853] text-zinc-950 font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                >
                  Salvar Registro
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE PROJEÇÃO DE FECHAMENTO DO ANO */}
      {isProjectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+24px)] bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#12141a] border border-emerald-500/30 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-zinc-800/80 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <TrendingUp className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-zinc-100 flex items-center gap-2">
                    Projeção de Fechamento do Ano ({selectedYear})
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Estimativa do resultado acumulado no bolso até 31 de Dezembro mantendo seu ritmo de rodagem
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProjectionModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">

              {/* Selector / Pace Switcher */}
              <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block">Base de Cálculo da Pegada:</label>
                  <p className="text-[11px] text-zinc-500">
                    Escolha se deseja projetar os meses restantes com a média de todo o ano ou com o ritmo deste mês.
                  </p>
                </div>
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 gap-1 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setProjectionPaceMode('all_year')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      projectionPaceMode === 'all_year'
                        ? 'bg-emerald-500 text-zinc-950 shadow-md font-extrabold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Média de Todos os Meses ({projectionData.completedMonthsCount} m)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectionPaceMode('selected_month')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      projectionPaceMode === 'selected_month'
                        ? 'bg-emerald-500 text-zinc-950 shadow-md font-extrabold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Ritmo de {MONTH_NAMES[selectedMonth - 1]}
                  </button>
                </div>
              </div>

              {/* Highlight Card for Current Selected Month Projection */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                    <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                      Projeção do Mês de {MONTH_NAMES[selectedMonth - 1]} ({selectedYear})
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {currentMonthProj?.workDays || 0} dias rodados
                      </span>
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Estimativa de fechamento mantendo a média diária até completar o mês (meta de 26 dias úteis)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  <div className="bg-zinc-950/80 px-3 py-1.5 rounded-lg border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block uppercase font-sans font-bold">Bruto Est.</span>
                    <span className="font-extrabold text-emerald-400">{formatBRL(currentMonthProj?.projGross || 0)}</span>
                  </div>
                  <div className="bg-zinc-950/80 px-3 py-1.5 rounded-lg border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block uppercase font-sans font-bold">Custos Est.</span>
                    <span className="font-extrabold text-amber-400">{formatBRL((currentMonthProj?.projVarCosts || 0) + (currentMonthProj?.projFixed || 0))}</span>
                  </div>
                  <div className="bg-emerald-950/60 px-3.5 py-1.5 rounded-lg border border-emerald-500/40">
                    <span className="text-[10px] text-emerald-400 block uppercase font-sans font-bold">Líquido Est. (Bolso)</span>
                    <span className="font-black text-emerald-300 text-sm">{formatBRL(currentMonthProj?.projNet || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Top Highlights KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Projected Gross */}
                <div className="bg-zinc-900/80 border border-zinc-800 p-5 rounded-xl space-y-2 relative overflow-hidden">
                  <div className="flex justify-between items-center text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    <span>Faturamento Bruto Ano</span>
                    <Coins className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                    {formatBRL(projectionData.projectedGrossTotal)}
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center justify-between border-t border-zinc-800/60 pt-2">
                    <span>Já faturado: <strong className="text-zinc-200 font-mono">{formatBRL(projectionData.totalRealizedGrossSoFar)}</strong></span>
                  </div>
                </div>

                {/* Projected Net Profit */}
                <div className="bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 p-5 rounded-xl space-y-2 relative overflow-hidden shadow-lg shadow-emerald-500/5">
                  <div className="flex justify-between items-center text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <span>Lucro Líquido Real (Ano)</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-black text-emerald-300 font-mono tracking-tight">
                    {formatBRL(projectionData.projectedNetTotal)}
                  </div>
                  <div className="text-[11px] text-zinc-300 flex items-center justify-between border-t border-emerald-900/30 pt-2">
                    <span>Sobras acumuladas no bolso ao fim de 12 meses</span>
                  </div>
                </div>

                {/* Monthly Net Average */}
                <div className="bg-zinc-900/80 border border-zinc-800 p-5 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    <span>Média Mensal Líquida</span>
                    <Award className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-400 font-mono tracking-tight">
                    {formatBRL(projectionData.monthlyNetAvg)} / mês
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center justify-between border-t border-zinc-800/60 pt-2">
                    <span>Faturamento mensal médio: <strong className="text-zinc-200 font-mono">{formatBRL(projectionData.monthlyGrossAvg)}</strong></span>
                  </div>
                </div>

              </div>

              {/* Summary Metrics & Cost Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-950/60 p-4 rounded-xl border border-zinc-850">
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Despesas Fixas (12 Meses)</span>
                  <span className="text-sm font-extrabold font-mono text-red-400">{formatBRL(projectionData.projectedFixedTotal)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Custos Variáveis Estimados</span>
                  <span className="text-sm font-extrabold font-mono text-amber-400">{formatBRL(projectionData.projectedVarCostsTotal)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">KM Total Estimado no Ano</span>
                  <span className="text-sm font-extrabold font-mono text-zinc-200">{Math.round(projectionData.projectedKmTotal).toLocaleString('pt-BR')} KM</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Corridas Estimadas</span>
                  <span className="text-sm font-extrabold font-mono text-zinc-200">{Math.round(projectionData.projectedRidesTotal).toLocaleString('pt-BR')} corridas</span>
                </div>
              </div>

              {/* Detailed Month-by-Month Breakdown Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <span>Detalhamento Mês a Mês do Ano ({selectedYear})</span>
                  </h3>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Realizado</span>
                    <span className="flex items-center gap-1 text-sky-400"><span className="w-2 h-2 rounded-full bg-sky-500 inline-block"></span> Projetado</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                        <th className="py-2.5 px-3">Mês</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Fat. Bruto</th>
                        <th className="py-2.5 px-3 text-right">Custos Var.</th>
                        <th className="py-2.5 px-3 text-right">Desp. Fixas</th>
                        <th className="py-2.5 px-3 text-right font-bold text-emerald-400">Resultado Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/60 font-mono">
                      {projectionData.fullYearBreakdown.map((m) => (
                        <tr key={m.monthNum} className={`hover:bg-zinc-900/50 transition-colors ${m.monthNum === selectedMonth ? 'bg-zinc-900/30' : ''}`}>
                          <td className="py-2 px-3 font-sans font-bold text-zinc-200 flex items-center gap-2">
                            <span>{m.monthName}</span>
                            {m.monthNum === selectedMonth && <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded">Atual</span>}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {!m.isProjected ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                Realizado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase">
                                Projetado
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-200">{formatBRL(m.projGross)}</td>
                          <td className="py-2 px-3 text-right text-red-400/90">-{formatBRL(m.projVarCosts)}</td>
                          <td className="py-2 px-3 text-right text-amber-400/90">-{formatBRL(m.projFixed)}</td>
                          <td className={`py-2 px-3 text-right font-bold ${m.projNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatBRL(m.projNet)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-900 border-t-2 border-zinc-800 font-mono font-black text-xs text-zinc-100">
                      <tr>
                        <td className="py-3 px-3 font-sans uppercase text-emerald-400" colSpan={2}>Total Fechamento do Ano</td>
                        <td className="py-3 px-3 text-right text-emerald-400">{formatBRL(projectionData.projectedGrossTotal)}</td>
                        <td className="py-3 px-3 text-right text-red-400">-{formatBRL(projectionData.projectedVarCostsTotal)}</td>
                        <td className="py-3 px-3 text-right text-amber-400">-{formatBRL(projectionData.projectedFixedTotal)}</td>
                        <td className="py-3 px-3 text-right text-emerald-300 text-sm">{formatBRL(projectionData.projectedNetTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-800 px-6 py-4 bg-zinc-950 flex justify-between items-center">
              <span className="text-[11px] text-zinc-500">
                Projeção baseada nos registros reais armazenados do ano de {selectedYear}.
              </span>
              <button
                type="button"
                onClick={() => setIsProjectionModalOpen(false)}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer"
              >
                Entendido
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE ASSISTENTE DE BUSCA DE DADOS (VOZ E TEXTO) */}
      {isAssistantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+24px)] bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0f1117] border border-indigo-500/40 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto relative">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-zinc-800/80 bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-zinc-950 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 rounded-xl shadow-lg shadow-indigo-500/10">
                  <Bot className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-zinc-100 flex items-center gap-2">
                    Assistente de Dados (Voz & Texto)
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-bold animate-pulse">
                      IA Gemini
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Localize faturamentos, rodagens, baterias, despesas ou metas por comando de voz ou digitação
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopAssistantSpeaking();
                  stopAssistantListening();
                  setIsAssistantOpen(false);
                }}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">

              {/* Input Area (Text + Mic Button) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Digite ou Fale o que deseja localizar:</span>
                </label>

                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={assistantQuery}
                    onChange={(e) => setAssistantQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isAssistantSearching) {
                        handleAssistantSearch();
                      }
                    }}
                    placeholder="Ex: Quanto ganhei na Uber este mês? Ou qual o meu dia com maior faturamento?"
                    className="w-full pl-4 pr-24 py-3 bg-zinc-900/90 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80 transition-all"
                  />

                  <div className="absolute right-2 flex items-center gap-1">
                    {/* Microphone Toggle Button */}
                    <button
                      type="button"
                      onClick={isAssistantListening ? stopAssistantListening : startAssistantListening}
                      className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                        isAssistantListening
                          ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30'
                      }`}
                      title={isAssistantListening ? "Clique para parar a gravação de voz" : "Clique para falar por voz"}
                    >
                      {isAssistantListening ? (
                        <MicOff className="w-4 h-4 text-white" />
                      ) : (
                        <Mic className="w-4 h-4 text-indigo-300" />
                      )}
                    </button>

                    {/* Search Submit Button */}
                    <button
                      type="button"
                      onClick={() => handleAssistantSearch()}
                      disabled={isAssistantSearching || !assistantQuery.trim()}
                      className="p-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:hover:bg-indigo-500 text-zinc-950 rounded-lg transition-all cursor-pointer font-bold flex items-center justify-center"
                      title="Enviar busca"
                    >
                      {isAssistantSearching ? (
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                      ) : (
                        <Send className="w-4 h-4 text-zinc-950" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Voice Listening Wave Indicator */}
                {isAssistantListening && (
                  <div className="bg-indigo-950/40 border border-indigo-500/40 px-4 py-2.5 rounded-xl flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span>Ouvindo sua voz... Fale normalmente</span>
                    </div>
                    <span className="text-[11px] text-zinc-400 italic">
                      "{assistantQuery || 'Aguardando fala...'}"
                    </span>
                  </div>
                )}
              </div>

              {/* Suggestions / Prompt Chips */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb className="w-3 h-3 text-amber-400" />
                  Sugestões de Perguntas Rápidas:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Quanto ganhei no total este mês?",
                    "Em quais dias bati a meta de R$ 500?",
                    "Qual aplicativo rendeu mais, Uber ou 99?",
                    "Quanto gastei com recarga/abastecimento?",
                    "Qual foi o meu dia mais lucrativo do ano?",
                    "Qual o meu gasto acumulado com lavagem?"
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAssistantQuery(chip);
                        handleAssistantSearch(chip);
                      }}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-indigo-950/60 border border-zinc-800 hover:border-indigo-500/40 text-zinc-300 hover:text-indigo-300 rounded-lg text-xs font-medium transition-all cursor-pointer text-left"
                    >
                      💡 {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Box */}
              {assistantError && (
                <div className="bg-rose-950/30 border border-rose-500/40 p-3.5 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{assistantError}</span>
                </div>
              )}

              {/* Loading Spinner */}
              {isAssistantSearching && (
                <div className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-xs font-bold text-indigo-300">Analisando histórico de lançamentos com a IA...</p>
                  <p className="text-[11px] text-zinc-500">Buscando correspondências em todas as corridas, baterias e gastos.</p>
                </div>
              )}

              {/* Search Result Box */}
              {assistantResult && !isAssistantSearching && (
                <div className="bg-zinc-900/80 border border-indigo-500/30 rounded-xl p-5 space-y-4 shadow-xl">
                  
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Resposta Encontrada</span>
                    </div>

                    {/* Audio Readout Controls */}
                    <div className="flex items-center gap-2">
                      {isAssistantSpeaking ? (
                        <button
                          type="button"
                          onClick={stopAssistantSpeaking}
                          className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
                        >
                          <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                          <span>Parar Áudio</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => speakAssistantAnswer(assistantResult.speechText)}
                          className="px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Ouvir em Voz Alta</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Highlight Metric Badge */}
                  {assistantResult.highlightMetric && (
                    <div className="bg-indigo-950/60 border border-indigo-500/40 px-4 py-2.5 rounded-lg flex items-center justify-between">
                      <span className="text-xs text-zinc-400 font-medium">Destaque Localizado:</span>
                      <span className="text-sm font-extrabold text-indigo-300 font-mono">
                        {assistantResult.highlightMetric}
                      </span>
                    </div>
                  )}

                  {/* Text Answer */}
                  <div className="text-xs text-zinc-200 leading-relaxed space-y-2 whitespace-pre-line font-sans">
                    {assistantResult.textAnswer}
                  </div>

                  {/* Matching Dates Badges & Actions */}
                  {assistantResult.matchingDates && assistantResult.matchingDates.length > 0 && (
                    <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-zinc-400">Datas Localizadas:</span>
                        {assistantResult.matchingDates.map((dateStr, dIdx) => (
                          <button
                            key={dIdx}
                            type="button"
                            onClick={() => {
                              openModalForDate(dateStr);
                              setIsAssistantOpen(false);
                            }}
                            className="px-2.5 py-1 bg-indigo-500/20 border border-indigo-500/40 hover:bg-indigo-500/30 text-indigo-300 font-mono font-bold text-[11px] rounded-md transition-all cursor-pointer"
                            title="Clique para abrir e editar este dia"
                          >
                            📅 {dateStr}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsAssistantOpen(false)}
                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-extrabold transition-all cursor-pointer self-end sm:self-auto"
                      >
                        Ver no Calendário ✨
                      </button>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-800 px-6 py-4 bg-zinc-950 flex justify-between items-center text-[11px] text-zinc-500">
              <span>Pesquisa alimentada pelo modelo Gemini e síntese de voz nativa.</span>
              <button
                type="button"
                onClick={() => {
                  stopAssistantSpeaking();
                  stopAssistantListening();
                  setIsAssistantOpen(false);
                }}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Help & Settings Modal (Menu de Ajuda com Engrenagem e IA) */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#111318] border border-zinc-750 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 shadow-2xl flex flex-col relative">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 bg-zinc-950 flex flex-col gap-4 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1 bg-white border border-zinc-700/80 rounded-xl shadow-md shrink-0">
                    <GkdMobilityLogo size="sm" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-zinc-100 flex items-center gap-2">
                      Central de Ajuda, Guia & Configurações
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                        GKD Mobility
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Instruções detalhadas, cálculos explicados, scanner com IA e suporte operacional para motoristas.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHelpModalOpen(false)}
                  className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'geral', label: '⚡ Ações & Atalhos', icon: Settings },
                  { id: 'guia', label: '📱 Como Lançar', icon: CalendarIcon },
                  { id: 'scanner', label: '📸 Scanner & IA', icon: Sparkles },
                  { id: 'energia', label: '⚡ Energia & Autonomia', icon: Zap },
                  { id: 'diaria', label: '🚗 Despesas & Diária', icon: Car },
                  { id: 'kpis', label: '📊 Métricas & Lucro', icon: TrendingUp },
                  { id: 'ia', label: '🎙️ Assistente IA', icon: Bot },
                  { id: 'faq', label: '❓ FAQ Dúvidas', icon: Info }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHelpActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                      helpActiveTab === tab.id
                        ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/30'
                        : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-6 shrink-0">
              
              {/* TAB 1: GERAL & AÇÕES RÁPIDAS */}
              {helpActiveTab === 'geral' && (
                <div className="space-y-6">
                  {/* ASSISTENTE DE ALIMENTAÇÃO POR DOCUMENTO (OCR / IA) */}
                  <div className="bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-emerald-950/80 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300">
                        <Receipt className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-emerald-200 flex items-center gap-2">
                          Scanner de Documentos & Despesas Fixas
                          <span className="text-[10px] bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                            OCR + IA
                          </span>
                        </h4>
                        <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                          Reconheça despesas do carro com mês, descrição e parcelas, ou extraia comprovantes de combustível e ganhos de plataformas.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsHelpModalOpen(false);
                        setIsDocumentFeederOpen(true);
                      }}
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-2 shrink-0 group w-full sm:w-auto justify-center"
                    >
                      <Upload className="w-4 h-4 text-zinc-950 group-hover:scale-110 transition-transform" />
                      <span>Alimentar com Documento</span>
                    </button>
                  </div>

                  {/* IA BANNER DESTACADO DENTRO DO MENU DE AJUDA */}
                  <div className="bg-gradient-to-r from-indigo-950/70 via-purple-950/50 to-indigo-950/70 border border-indigo-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-indigo-500/20 border border-indigo-500/40 rounded-xl text-indigo-300">
                        <Bot className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-indigo-200 flex items-center gap-2">
                          Assistente de Voz & Perguntas Inteligentes
                          <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-bold">
                            Voz & Texto
                          </span>
                        </h4>
                        <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                          Consulte lucros, médias por hora, KM rodado e compare rendimento entre Uber e 99 apenas conversando com o assistente.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsHelpModalOpen(false);
                        setIsAssistantOpen(true);
                        setAssistantError(null);
                      }}
                      className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-zinc-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center gap-2 shrink-0 group w-full sm:w-auto justify-center"
                    >
                      <Sparkles className="w-4 h-4 text-zinc-950 group-hover:rotate-12 transition-transform" />
                      <span>Abrir IA de Perguntas</span>
                    </button>
                  </div>

                  {/* ATALHOS RÁPIDOS DE AÇÕES E CONFIGURAÇÕES */}
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Ações Rápidas & Configurações:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* IMPORTAÇÃO DE DADOS EXCEL */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsHelpModalOpen(false);
                          setIsExcelImportOpen(true);
                        }}
                        className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-emerald-500 text-zinc-950 rounded-lg group-hover:scale-110 transition-transform">
                          <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-emerald-300 block group-hover:text-emerald-200">Importar Planilha (Excel/CSV)</span>
                          <span className="text-[11px] text-zinc-400">Puxar dados de faturamento e KM do Uber/99</span>
                        </div>
                      </button>

                      {/* NOVO REGISTRO */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsHelpModalOpen(false);
                          handleOpenNewLog();
                        }}
                        className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-emerald-500 text-zinc-950 rounded-lg group-hover:scale-110 transition-transform">
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-emerald-300 block group-hover:text-emerald-200">Novo Registro (Registrar Dia)</span>
                          <span className="text-[11px] text-zinc-400">Lançamento de KM, corridas e despesas</span>
                        </div>
                      </button>

                      {/* DADOS DO VEÍCULO */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsHelpModalOpen(false);
                          setIsCarModalOpen(true);
                        }}
                        className="p-3 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                          <Car className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-zinc-200 block group-hover:text-emerald-400">Dados do Veículo & Despesas Fixas</span>
                          <span className="text-[11px] text-zinc-400">Elétrico / Combustão, IPVA, seguro, washpass</span>
                        </div>
                      </button>

                      {/* PROJEÇÃO ANUAL */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsHelpModalOpen(false);
                          setIsProjectionModalOpen(true);
                        }}
                        className="p-3 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-teal-500/40 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg group-hover:scale-110 transition-transform">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-zinc-200 block group-hover:text-teal-300">Projeção & Metas Anuais</span>
                          <span className="text-[11px] text-zinc-400">Estimativas de faturamento e lucro do ano</span>
                        </div>
                      </button>

                      {/* FALE CONOSCO (WHATSAPP) */}
                      <button
                        type="button"
                        onClick={() => {
                          const appName = "GKD Controle Diário";
                          const phoneNumber = "5511953292570";
                          const text = encodeURIComponent(`Olá! Tenho uma sugestão/dúvida sobre o aplicativo ${appName}: `);
                          window.open(`https://wa.me/${phoneNumber}?text=${text}`, '_blank');
                        }}
                        className="p-3 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-zinc-200 block group-hover:text-emerald-400">Fale Conosco (WhatsApp)</span>
                          <span className="text-[11px] text-zinc-400">Suporte direto com a equipe de engenharia</span>
                        </div>
                      </button>

                      {/* BACKUP EM EXCEL */}
                      <button
                        type="button"
                        onClick={(e) => {
                          setIsHelpModalOpen(false);
                          setIsBackupModalOpen(true);
                        }}
                        className="p-3 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-zinc-200 block group-hover:text-emerald-400">Backup em Planilha Excel</span>
                          <span className="text-[11px] text-zinc-400">Exportar todos os lançamentos em (.csv)</span>
                        </div>
                      </button>

                      {/* CONSOLIDAR DADOS DO ANO */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsHelpModalOpen(false);
                          handleConsolidateData();
                        }}
                        className="p-3 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg group-hover:scale-110 transition-transform">
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-zinc-200 block group-hover:text-amber-300">Consolidar Dados do Ano</span>
                          <span className="text-[11px] text-zinc-400">Auditar e sincronizar registros anuais</span>
                        </div>
                      </button>

                      {/* VARREDURA PROFUNDA */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsHelpModalOpen(false);
                          handleDeepSweep();
                        }}
                        className="p-3 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-sky-500/40 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg group-hover:scale-110 transition-transform">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-zinc-200 block group-hover:text-sky-300">Auditoria</span>
                          <span className="text-[11px] text-zinc-400">Auditoria completa de integridade local</span>
                        </div>
                      </button>

                      {/* SOBRE O APP & VERSÃO */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsHelpModalOpen(false);
                          setIsAboutModalOpen(true);
                        }}
                        className="p-3 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                          <Info className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-zinc-200 block group-hover:text-emerald-400">Sobre o Aplicativo</span>
                          <span className="text-[11px] text-zinc-400">GKD Mobility GKD_CD_V.1.0.0</span>
                        </div>
                      </button>

                      {/* VISUALIZAR RELATÓRIO PDF */}
                      <a
                        href="/relatorio_reclamacao_desempenho.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setIsHelpModalOpen(false)}
                        className="p-3 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/40 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg group-hover:scale-110 transition-transform">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-zinc-200 block group-hover:text-rose-400">Relatório Técnico (PDF)</span>
                          <span className="text-[11px] text-zinc-400">Visualizar/Imprimir documento PDF</span>
                        </div>
                      </a>

                      {/* APAGAR TODOS OS DADOS */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsHelpModalOpen(false);
                          setIsConfirmClearAllModalOpen(true);
                        }}
                        className="p-3 bg-red-950/30 hover:bg-red-900/50 border border-red-850/80 hover:border-red-500/60 rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-red-500/20 text-red-400 rounded-lg group-hover:scale-110 transition-transform">
                          <Trash2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-red-300 block group-hover:text-red-200">Apagar Todos os Dados</span>
                          <span className="text-[11px] text-zinc-400">Zerar todos os lançamentos da planilha</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: GUIA PASSO A PASSO */}
              {helpActiveTab === 'guia' && (
                <div className="space-y-4">
                  <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-2">
                    <h3 className="text-sm font-extrabold text-emerald-300 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-emerald-400" />
                      1. Fluxo Diário de Lançamento
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Ao finalizar seu turno de trabalho, basta clicar no dia correspondente no calendário ou abrir o botão <b>"Novo Registro"</b>. Você pode preencher manualmente ou usar a câmera/IA para leitura automática dos prints de Uber, 99 e comprovantes.
                    </p>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-2">
                    <h3 className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-amber-400" />
                      2. Controle de Quilometragem (KM) e Odômetro
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Você pode informar a quilometragem de duas formas:
                    </p>
                    <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
                      <li><b>KM Rodado no Dia:</b> Digite diretamente quantos KM rodou no dia (ex: 210 KM).</li>
                      <li><b>Odômetro Total:</b> Se digitar o odômetro total do painel (ex: 45.320 KM), o app detecta o último odômetro registrado e sugere abater automaticamente a diferença para calcular apenas o percurso do dia.</li>
                    </ul>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-2">
                    <h3 className="text-sm font-extrabold text-blue-300 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-blue-400" />
                      3. Divisão de Corridas & Plataformas
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      O app permite separar faturamento bruto, número de viagens e bônus/incentivos para cada aplicativo: <b>Uber</b>, <b>99</b>, <b>Particular</b>, <b>Recompensas Extras</b> e <b>Outras Fontes</b>. Isso permite saber exatamente qual plataforma é mais rentável por KM rodado.
                    </p>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-2">
                    <h3 className="text-sm font-extrabold text-rose-300 flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-rose-400" />
                      4. Refeições e Despesas Operacionais do Dia
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Registre seus gastos com <b>Almoço, Jantar e Café</b>, além de despesas do veículo no dia (<b>Lavagem, Pedágio, Estacionamento, Recarga de Rua e Manutenções Rápidas</b>). Todos os custos são abatidos para exibir o <b>Lucro Líquido Real</b> que vai para o seu bolso.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: SCANNER & CÂMERA IA */}
              {helpActiveTab === 'scanner' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-emerald-950/40 to-zinc-900 border border-emerald-500/30 p-4 rounded-xl space-y-3">
                    <h3 className="text-sm font-black text-emerald-300 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-emerald-400" />
                      Como Funciona o Scanner Inteligente no "Novo Lançamento"
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Dentro do modal de Novo Lançamento, você tem 3 maneiras ultrarrápidas de preencher seus dados usando a inteligência artificial Gemini Vision:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl space-y-1">
                        <span className="text-xs font-bold text-emerald-400 block">1. 📸 Câmera Ao Vivo</span>
                        <p className="text-[11px] text-zinc-400">Aponte para a tela do painel do carro ou nota fiscal impressa e toque em capturar.</p>
                      </div>
                      <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl space-y-1">
                        <span className="text-xs font-bold text-emerald-400 block">2. 🖼️ Fotos & Prints</span>
                        <p className="text-[11px] text-zinc-400">Selecione vários prints de uma vez (Uber + 99 + recarga + almoço). O app unifica tudo no dia.</p>
                      </div>
                      <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl space-y-1">
                        <span className="text-xs font-bold text-emerald-400 block">3. 📋 Colar Texto</span>
                        <p className="text-[11px] text-zinc-400">Copie textos de planilhas do Excel ou mensagens do WhatsApp e clique em extrair.</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Dicas para Melhor Precisão na Leitura:
                    </h4>
                    <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
                      <li>Tire fotos bem iluminadas sem reflexo excessivo na tela do celular.</li>
                      <li>Prints do fechamento diário do app da Uber ou 99 são lidos com 100% de precisão.</li>
                      <li>Comprovantes de maquininha de recarga ou posto de combustível identificam o valor automaticamente.</li>
                      <li>Se a foto contiver apenas a quilometragem, o custo de combustível/energia é calculado de forma automática com base no perfil do seu veículo!</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB 4: ENERGIA & VEÍCULO */}
              {helpActiveTab === 'energia' && (
                <div className="space-y-4">
                  <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-2">
                    <h3 className="text-sm font-extrabold text-emerald-300 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      Veículo Elétrico vs. Combustão
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      No menu <b>"Dados do Veículo"</b>, configure seu tipo de carro:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-1">
                        <span className="text-xs font-bold text-emerald-300 block">⚡ Veículo Elétrico</span>
                        <p className="text-[11px] text-zinc-300 leading-relaxed">
                          Informe a capacidade da bateria (kWh), valor do kWh cobrado no seu carregador/posto e a autonomia média (KM). O gasto é calculado por porcentagem consumida ou proporção por KM.
                        </p>
                      </div>
                      <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-1">
                        <span className="text-xs font-bold text-amber-300 block">⛽ Veículo a Combustão</span>
                        <p className="text-[11px] text-zinc-300 leading-relaxed">
                          Informe a média de consumo do carro (KM/L) e o preço atual do litro da gasolina/etanol/GNV. O app calcula o custo exato do combustível por KM percorrido.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-zinc-200">Fórmula de Gasto Energético Automático:</h4>
                    <p className="text-xs text-zinc-300 font-mono bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
                      Gasto Diário = (KM Rodado ÷ Autonomia Estimada) × Capacidade (kWh ou Litros) × Valor Unitário (R$/kWh ou R$/L)
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Se você digitar um valor manual de recarga/combustível no dia, o valor manual sobrepõe o cálculo automático para garantir precisão absoluta.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 5: DESPESAS & RATEIO DA DIÁRIA */}
              {helpActiveTab === 'diaria' && (
                <div className="space-y-4">
                  <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-2">
                    <h3 className="text-sm font-extrabold text-indigo-300 flex items-center gap-2">
                      <Car className="w-4 h-4 text-indigo-400" />
                      Regra de Rateio da Diária do Carro (Segunda a Sábado)
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Para que o motorista tenha folgas saudáveis aos Domingos sem distorcer o custo fixo, o aplicativo divide o total das despesas fixas mensais exclusivamente pelos dias úteis e sábados do mês (Segunda a Sábado, ~26 dias trabalháveis).
                    </p>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-zinc-200">Como Cadastrar suas Despesas Fixas:</h4>
                    <ul className="text-xs text-zinc-300 space-y-2 list-disc list-inside">
                      <li><b>No Botão "Dados do Veículo":</b> Cadastre financiamento, parcela do carro, aluguel, seguro auto, IPVA, licenciamento e washpass/lavagens mensais.</li>
                      <li><b>No Scanner de Documentos:</b> Você também pode enviar comprovantes ou relatórios com parcelas e descrições para cadastrar despesas fixas de qualquer mês com IA.</li>
                      <li><b>Abatimento Automático:</b> Ao abrir um dia de Segunda a Sábado, a diária calculada é sugerida automaticamente para rateio justo do custo do carro.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB 6: KPIS & LUCRO REAL */}
              {helpActiveTab === 'kpis' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1.5">
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" /> Lucro Líquido Real
                      </span>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Faturamento Bruto Total <b>menos</b> Custo de Energia/Combustível <b>menos</b> Despesas Fixas Rateadas <b>menos</b> Despesas do Carro (lavagem/pedágio) <b>menos</b> Refeições.
                      </p>
                    </div>

                    <div className="p-3.5 bg-blue-950/20 border border-blue-500/30 rounded-xl space-y-1.5">
                      <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> Lucro por Hora & KM
                      </span>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Mede quanto dinheiro limpo sobra por cada hora no trânsito (R$/h) e por cada quilômetro rodado no hodômetro (R$/KM).
                      </p>
                    </div>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-2">
                    <h3 className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-400" />
                      Metas Diárias e Mensais
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Acompanhe o termômetro de faturamento na tela principal. O app calcula quanto falta para atingir a meta do dia e a projeção para bater a meta do mês com base na média diária atual.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 7: ASSISTENTE IA */}
              {helpActiveTab === 'ia' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-indigo-950/50 via-purple-950/30 to-indigo-950/50 border border-indigo-500/30 p-4 rounded-xl space-y-3">
                    <h3 className="text-sm font-black text-indigo-300 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-400" />
                      Exemplos de Perguntas para Fazer ao Assistente IA
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      O assistente possui acesso completo ao seu histórico de corridas, KM e gastos. Você pode perguntar por voz ou digitar:
                    </p>
                    <div className="space-y-2 pt-1">
                      {[
                        "Quanto lucrei na semana passada?",
                        "Qual foi meu dia de maior faturamento neste ano?",
                        "Quanto gastei de combustível/recarga neste mês?",
                        "Qual aplicativo me deu mais lucro: Uber ou 99?",
                        "Qual minha média de KM rodado por dia?",
                        "Quanto gastei com alimentação e almoço até agora?",
                        "Qual foi o lucro líquido do dia 15 deste mês?"
                      ].map((ex, idx) => (
                        <div key={idx} className="bg-zinc-950/80 border border-zinc-800 p-2.5 rounded-lg flex items-center justify-between text-xs text-zinc-300">
                          <span className="italic text-indigo-200 font-medium">"{ex}"</span>
                          <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded">Comando Rápido</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 8: FAQ DÚVIDAS */}
              {helpActiveTab === 'faq' && (
                <div className="space-y-3">
                  {[
                    {
                      q: "Como exportar meus dados ou fazer backup?",
                      a: "No menu de configurações (engrenagem), seus dados ficam salvos automaticamente no armazenamento seguro local do navegador. Você pode usar a opção de Varredura Profunda e Consolidar Dados para sincronização."
                    },
                    {
                      q: "O aplicativo funciona sem internet (offline)?",
                      a: "Sim! Todos os cálculos, calendário, histórico e relatórios funcionam 100% offline. A conexão só é necessária quando você usa a IA para leitura de imagens ou perguntas ao assistente."
                    },
                    {
                      q: "O que acontece se eu rodar mais KM em viagens particulares?",
                      a: "Você pode lançar os ganhos e viagens no campo 'Particular'. O app calcula a média de R$/KM separadamente para que você compare a rentabilidade com as plataformas."
                    },
                    {
                      q: "Como corrigir um valor digitado errado em um dia anterior?",
                      a: "Basta clicar diretamente sobre o dia no calendário. O formulário abrirá com todos os valores anteriores carregados para edição imediata."
                    },
                    {
                      q: "O que fazer se o scanner não reconhecer um comprovante amassado?",
                      a: "Você pode tirar uma nova foto mais nítida com melhor iluminação ou usar a aba 'Colar Texto' para digitar os números rapidamente."
                    }
                  ].map((faqItem, fIdx) => (
                    <div key={fIdx} className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-1.5">
                      <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        {faqItem.q}
                      </h4>
                      <p className="text-xs text-zinc-300 leading-relaxed pl-6">
                        {faqItem.a}
                      </p>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-800 px-6 py-4 bg-zinc-950 flex justify-between items-center">
              <span className="text-[11px] text-zinc-400">
                GKD Controle Diário • Suporte e Engenharia GKD_CD_V.1.0.0
              </span>
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-emerald-500/20"
              >
                Entendi, Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Car Data Modal - "Dados do Veículo" */}
      {isCarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#101116] border-2 border-zinc-700/80 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-1.5 bg-white border border-zinc-700/80 rounded-2xl shadow-md shrink-0">
                  <GkdMobilityLogo size="sm" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-zinc-100 flex items-center gap-2">
                    Dados do Veículo & Rateio
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold">
                      {carProfile.vehicleType === 'eletrico' ? '⚡ Elétrico' : '⛽ Combustão'}
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400">
                    Cadastre os dados completos do seu veículo. A quilometragem é atualizada automaticamente a cada dia lançado.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCarModalOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form Content */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsCarModalOpen(false);
                setSweepNotification(`Dados do veículo ${carProfile.modelName || 'cadastrado'} salvos com sucesso!`);
                setTimeout(() => setSweepNotification(null), 4000);
              }}
              className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-130px)] scrollbar-thin scrollbar-thumb-zinc-800"
            >
              {/* Section 1: Informações Gerais do Veículo */}
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Informações Gerais do Veículo
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tipo de Veículo */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-zinc-200 mb-2 uppercase tracking-wide">
                      Tipo de Veículo
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCarProfile(prev => ({ ...prev, vehicleType: 'eletrico' }))}
                        className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all cursor-pointer ${
                          carProfile.vehicleType === 'eletrico'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/50'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
                        }`}
                      >
                        <Zap className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm font-extrabold">Elétrico (EV)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCarProfile(prev => ({ ...prev, vehicleType: 'combustao' }))}
                        className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all cursor-pointer ${
                          carProfile.vehicleType === 'combustao'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-950/50'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
                        }`}
                      >
                        <Coffee className="w-5 h-5 text-amber-400" />
                        <span className="text-sm font-extrabold">Combustão (Gasolina/Etanol)</span>
                      </button>
                    </div>
                  </div>

                  {/* Model Name */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Marca / Modelo do Carro
                    </label>
                    <input
                      type="text"
                      value={carProfile.modelName}
                      onChange={(e) => setCarProfile(prev => ({ ...prev, modelName: e.target.value }))}
                      placeholder={carProfile.vehicleType === 'eletrico' ? "Ex: BYD Dolphin EV, GWM Ora 03" : "Ex: Chevrolet Onix, Hyundai HB20"}
                      className="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-400 rounded-xl px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition-colors"
                    />
                  </div>

                  {/* License Plate */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Placa do Veículo
                    </label>
                    <input
                      type="text"
                      value={carProfile.licensePlate}
                      onChange={(e) => setCarProfile(prev => ({ ...prev, licensePlate: e.target.value.toUpperCase() }))}
                      placeholder="Ex: ABC-1D23"
                      className="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-400 rounded-xl px-4 py-3 text-sm font-bold uppercase font-mono text-zinc-100 outline-none transition-colors tracking-wider"
                    />
                  </div>

                  {/* Current KM (Odômetro) */}
                  <div>
                    <label className="block text-xs font-bold text-emerald-400 flex items-center gap-1 mb-1.5">
                      <Gauge className="w-4 h-4 text-emerald-400" />
                      <span>KM Atual (Odômetro Total)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={carProfile.currentKm !== undefined ? Math.round(carProfile.currentKm) : ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setCarProfile(prev => ({ ...prev, currentKm: parseInt(val, 10) || 0 }));
                        }}
                        placeholder="Ex: 15200 (atualizado auto nos lançamentos)"
                        className="w-full bg-zinc-900 border-2 border-emerald-500/50 focus:border-emerald-400 rounded-xl px-4 py-3 text-sm font-mono font-bold text-emerald-300 outline-none transition-colors pr-12"
                      />
                      <span className="absolute right-3.5 top-3.5 text-xs text-emerald-400 font-mono font-black">KM</span>
                    </div>
                    <span className="text-[11px] text-zinc-400 block mt-1">
                      Atualizado automaticamente ao registrar KM rodado no dia.
                    </span>
                  </div>

                  {/* Manufacture Year */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Ano / Modelo
                    </label>
                    <input
                      type="text"
                      value={carProfile.manufactureYear}
                      onChange={(e) => setCarProfile(prev => ({ ...prev, manufactureYear: e.target.value }))}
                      placeholder="Ex: 2024 ou 2024/2025"
                      className="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-400 rounded-xl px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition-colors"
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Cor do Veículo
                    </label>
                    <input
                      type="text"
                      value={carProfile.color}
                      onChange={(e) => setCarProfile(prev => ({ ...prev, color: e.target.value }))}
                      placeholder="Ex: Preto, Branco, Cinza"
                      className="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-400 rounded-xl px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition-colors"
                    />
                  </div>


                </div>
              </div>

              {/* Section: Cálculo & Rateio das Despesas com o Carro */}
              <div className="space-y-4 pt-4 border-t border-zinc-850">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    Dias que irei trabalhar ({MONTH_NAMES[selectedMonth - 1]}/{selectedYear})
                  </h3>
                  <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                    Cálculo por Calendário
                  </span>
                </div>

                <div className="bg-[#12141c] border border-purple-900/40 rounded-2xl p-4 space-y-6">
                  {(() => {
                    const currentCost = carProfile.monthlyCarExpense ?? 0;

                    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
                    const selectedDays = carProfile.customWorkDays?.[monthKey] || [];
                    
                    const info = getMonthWorkDaysAndRate(selectedYear, selectedMonth, currentCost, selectedDays);

                    // Calendar Helper
                    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                    const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1).getDay();
                    const calendarDays = [];
                    for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
                    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

                    const toggleDay = (day: number) => {
                      const currentDays = carProfile.customWorkDays?.[monthKey] || [];
                      let newDays;
                      if (currentDays.includes(day)) {
                        newDays = currentDays.filter(d => d !== day);
                      } else {
                        newDays = [...currentDays, day].sort((a, b) => a - b);
                      }
                      
                      setCarProfile(prev => ({
                        ...prev,
                        customWorkDays: {
                          ...(prev.customWorkDays || {}),
                          [monthKey]: newDays
                        }
                      }));
                    };

                    return (
                      <>
                        <div className="space-y-4">
                          <div className="grid grid-cols-7 gap-1 text-center mb-1">
                            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                              <span key={i} className="text-[10px] font-bold text-zinc-500">{d}</span>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day, idx) => {
                              if (day === null) return <div key={idx} />;
                              const isSelected = selectedDays.includes(day);
                              const isToday = day === new Date().getDate() && selectedMonth === (new Date().getMonth() + 1) && selectedYear === new Date().getFullYear();
                              
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => toggleDay(day)}
                                  className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all border ${
                                    isSelected 
                                      ? 'bg-purple-600 border-purple-400 text-white shadow-sm shadow-purple-900/50 scale-105 z-10' 
                                      : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800'
                                  } ${isToday ? 'ring-1 ring-emerald-500' : ''}`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1 italic">
                            <span>* Clique nos dias para marcar/desmarcar seu trabalho</span>
                            <button 
                              type="button"
                              onClick={() => {
                                // Default Mon-Sat
                                const monSat = [];
                                for(let d=1; d<=daysInMonth; d++) {
                                  if (new Date(selectedYear, selectedMonth-1, d).getDay() !== 0) monSat.push(d);
                                }
                                setCarProfile(prev => ({
                                  ...prev,
                                  customWorkDays: { ...(prev.customWorkDays || {}), [monthKey]: monSat }
                                }));
                              }}
                              className="text-purple-400 hover:underline font-bold not-italic"
                            >
                              Resetar para Seg-Sáb
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-zinc-200">
                              Despesa Total do Mês ({MONTH_NAMES[selectedMonth - 1]}/{selectedYear})
                            </label>
                            {currentCost === 0 && (
                              <button
                                type="button"
                                onClick={() => setCarProfile(prev => ({ ...prev, monthlyCarExpense: 7093.05 }))}
                                className="text-[10px] text-purple-400 hover:text-purple-300 font-bold underline flex items-center gap-1"
                              >
                                <Zap className="w-3 h-3" />
                                <span>Sugerir Padrão: R$ 7.093,05</span>
                              </button>
                            )}
                          </div>

                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={carProfile.monthlyCarExpense !== undefined && carProfile.monthlyCarExpense !== null && carProfile.monthlyCarExpense > 0 ? carProfile.monthlyCarExpense : ''}
                              onChange={(e) => setCarProfile(prev => ({ ...prev, monthlyCarExpense: parseFloat(String(e.target.value).replace(',', '.')) || 0 }))}
                              placeholder="0.00"
                              className="w-full bg-zinc-950 border border-purple-900/60 focus:border-purple-400 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-purple-200 outline-none transition-colors"
                            />
                            <span className="absolute right-3.5 top-2.5 text-xs text-purple-400 font-mono font-bold">R$ / MÊS</span>
                          </div>
                        </div>

                        {/* Dynamic Month Breakdown Card */}
                        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-3">
                          <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                              Demonstrativo: {MONTH_NAMES[selectedMonth - 1]} / {selectedYear}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {selectedDays.length} dias selecionados
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-purple-950/30 p-2 rounded-lg border border-purple-900/50">
                              <span className="text-[10px] text-purple-300 block font-medium">Rateio Diário</span>
                              <span className="text-xs font-bold text-purple-300 font-mono">{formatBRL(info.dailyRate)} / dia</span>
                            </div>
                            <div className="bg-blue-950/30 p-2 rounded-lg border border-blue-900/50">
                              <span className="text-[10px] text-blue-300 block font-medium">Custo Total em {MONTH_NAMES[selectedMonth - 1]}</span>
                              <span className="text-xs font-bold text-blue-300 font-mono">{formatBRL(info.dailyRate * info.workDaysCount)}</span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-zinc-850">
                            <span className="text-[10px] text-zinc-400 text-center sm:text-left">
                              Cálculo: <strong className="text-zinc-200">{formatBRL(info.monthlyTotalCost)} ÷ {info.workDaysCount} dias</strong> = <strong className="text-emerald-400">{formatBRL(info.dailyRate)}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                handleApplyMonthlyCarRateToAllDays(selectedMonth, selectedYear, currentCost);
                                setIsCarModalOpen(false);
                              }}
                              className="w-full sm:w-auto px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>Aplicar em todos os lançamentos</span>
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Section 2: Especificações de Energia / Combustível */}
              <div className="space-y-4 pt-4 border-t border-zinc-850">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  {carProfile.vehicleType === 'eletrico' ? <Zap className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                  {carProfile.vehicleType === 'eletrico' ? 'Especificações de Energia & Bateria' : 'Especificações de Combustível'}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      {carProfile.vehicleType === 'eletrico' ? 'Capacidade (kWh)' : 'Tanque (Litros)'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={carProfile.batteryCapacityKwh || ''}
                      onChange={(e) => setCarProfile(prev => ({ ...prev, batteryCapacityKwh: parseFloat(String(e.target.value).replace(',', '.')) || 0 }))}
                      placeholder={carProfile.vehicleType === 'eletrico' ? "Ex: 53.6" : "Ex: 50"}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Autonomia Est. (KM)
                    </label>
                    <input
                      type="number"
                      value={carProfile.estimatedAutonomyKm || ''}
                      onChange={(e) => setCarProfile(prev => ({ ...prev, estimatedAutonomyKm: parseInt(e.target.value, 10) || 0 }))}
                      placeholder={carProfile.vehicleType === 'eletrico' ? "Ex: 300" : "Ex: 500"}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      {carProfile.vehicleType === 'eletrico' ? 'Tarifa R$/kWh' : 'Preço R$/Litro'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={carProfile.kwhCostRate || ''}
                      onChange={(e) => setCarProfile(prev => ({ ...prev, kwhCostRate: parseFloat(String(e.target.value).replace(',', '.')) || 0 }))}
                      placeholder={carProfile.vehicleType === 'eletrico' ? "Ex: 1.05" : "Ex: 5.50"}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Manutenção & Seguro do Veículo */}
              <div className="space-y-4 pt-4 border-t border-zinc-850">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Manutenção & Seguro do Veículo
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Próxima Revisão (KM)
                    </label>
                    <input
                      type="text"
                      value={carProfile.nextMaintenanceKm}
                      onChange={(e) => setCarProfile(prev => ({ ...prev, nextMaintenanceKm: e.target.value }))}
                      placeholder="Ex: 10.000 KM"
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-zinc-100 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Seguradora
                    </label>
                    <input
                      type="text"
                      value={carProfile.insurerName}
                      onChange={(e) => setCarProfile(prev => ({ ...prev, insurerName: e.target.value }))}
                      placeholder="Ex: Porto Seguro, Allianz"
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-zinc-100 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Nº da Apólice
                    </label>
                    <input
                      type="text"
                      value={carProfile.insurancePolicyNumber}
                      onChange={(e) => setCarProfile(prev => ({ ...prev, insurancePolicyNumber: e.target.value }))}
                      placeholder="Ex: 01.031.98234-0"
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-zinc-100 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Observações Gerais */}
              <div className="space-y-2 pt-4 border-t border-zinc-850">
                <label className="block text-xs font-medium text-zinc-300">
                  Observações e Lembretes do Carro
                </label>
                <textarea
                  rows={3}
                  value={carProfile.notes}
                  onChange={(e) => setCarProfile(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Anotações sobre alinhamento, rodízio de pneus, garantia, etc."
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-zinc-100 outline-none transition-colors resize-none"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCarModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Salvar Dados do Veículo</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL DE INDICADORES FINANCEIROS (KPIS) */}
      {isKpisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+24px)] bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#12141a] border border-emerald-500/30 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-5 border-b border-zinc-800/80 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-zinc-100">Indicadores Financeiros (KPIs)</h2>
                  <p className="text-xs text-zinc-400">Faturamento Bruto, Custos Variáveis e Lucro Líquido</p>
                </div>
              </div>
              <button
                onClick={() => setIsKpisModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950/40">
              <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-md">
                <div className="flex justify-between items-center text-zinc-400 mb-2">
                  <span className="text-xs font-semibold tracking-wider uppercase">Faturamento Bruto</span>
                  <Coins className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-emerald-400 tracking-tight font-mono">{formatBRL(totalGrossEarnings)}</h3>
                  <div className="mt-2.5 pt-2 border-t border-zinc-850/60 space-y-1 text-[11px]">
                    <div className="flex justify-between text-zinc-300">
                      <span className="text-zinc-400">Trabalho + Recompensas:</span>
                      <span className="font-mono font-bold text-emerald-400">{formatBRL(totalOperationalEarnings)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span className="text-amber-400 font-semibold">Anjo:</span>
                      <span className="font-mono font-bold text-amber-400">{formatBRL(totalAnjo)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-md">
                <div className="flex justify-between items-center text-zinc-400 mb-2">
                  <span className="text-xs font-semibold tracking-wider uppercase">Custos Variáveis</span>
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-amber-400 tracking-tight font-mono">{formatBRL(totalVariableCosts)}</h3>
                  <div className="mt-2.5 pt-2 border-t border-zinc-850/60 space-y-1 text-[11px] text-zinc-400">
                    <div>{carProfile.vehicleType === 'eletrico' ? 'Bateria' : 'Combustível'}: {formatBRL(totalEnergyCost)}</div>
                    <div>Desp. Extras Carro: {formatBRL(totalCarExpenses)}</div>
                    <div>Alimentação: {formatBRL(totalFoodExpenses)}</div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-md">
                <div className="flex justify-between items-center text-zinc-400 mb-2">
                  <span className="text-xs font-semibold tracking-wider uppercase">Resultado Líquido</span>
                  <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className={`text-2xl font-black tracking-tight font-mono ${realNetEarnings >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{formatBRL(realNetEarnings)}</h3>
                  <div className="mt-2.5 pt-2 border-t border-zinc-850/60 space-y-1 text-[11px] text-zinc-400">
                    <div>Operacional: {formatBRL(netOperational)}</div>
                    <div>Diárias Carro: {formatBRL(totalCarRental)}</div>
                    <div>Custo Fixo Mês: {formatBRL(totalFixedExpenses)}</div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-md">
                <div className="flex justify-between items-center text-zinc-400 mb-2">
                  <span className="text-xs font-semibold tracking-wider uppercase">Margem Real</span>
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className={`text-2xl font-black tracking-tight font-mono ${realProfitMargin >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{realProfitMargin.toFixed(1)}%</h3>
                  <div className="mt-2.5 pt-2 border-t border-zinc-850/60 space-y-1 text-[11px] text-zinc-400">
                    <div>Distância: {formatKM(totalKM)}</div>
                    <div>Líquido/KM: {formatBRL(realNetEarnings / (totalKM || 1))}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
              <button
                onClick={() => setIsKpisModalOpen(false)}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PRODUTIVIDADE E EFICIÊNCIA */}
      {isEfficiencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+24px)] bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#12141a] border border-emerald-500/30 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-5 border-b border-zinc-800/80 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-zinc-100">Indicadores de Produtividade & Eficiência por KM</h2>
                  <p className="text-xs text-zinc-400">Rendimento por KM rodado e custos operacionais por distância</p>
                </div>
              </div>
              <button
                onClick={() => setIsEfficiencyModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 bg-zinc-950/40">
              <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl flex items-center gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500">Faturamento por KM</span>
                  <p className="text-base font-extrabold text-zinc-200 font-mono">{formatBRL(earningsPerKM)} <span className="text-xs text-zinc-500 font-normal">/ KM</span></p>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl flex items-center gap-4">
                <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-amber-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500">{carProfile.vehicleType === 'eletrico' ? 'Custo Energia' : 'Custo Combustível'} por KM</span>
                  <p className="text-base font-extrabold text-zinc-200 font-mono">{formatBRL(energyCostPerKM)} <span className="text-xs text-zinc-500 font-normal">/ KM</span></p>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl flex items-center gap-4">
                <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl text-blue-400">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500">Consumo de Alimentação Diário</span>
                  <p className="text-base font-extrabold text-zinc-200 font-mono">
                    {formatBRL(dailyFoodAverage)} 
                    <span className="text-xs text-zinc-500 font-normal"> / dia trabalhado</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
              <button
                onClick={() => setIsEfficiencyModalOpen(false)}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DISTRIBUIÇÃO DE RECEITAS & CUSTOS */}
      {isAppShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#12141a] border border-emerald-500/30 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-5 border-b border-zinc-800/80 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <PieChart className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-zinc-100">Distribuição de Receitas & Custos</h2>
                  <p className="text-xs text-zinc-400">Visualização acumulada da operação do mês selecionado.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAppShareModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 bg-zinc-950/40">
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">Faturamento por Canal</span>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> Uber
                    </span>
                    <span className="font-mono">{formatBRL(uberTotal)} <span className="text-zinc-500 font-normal">({uberRides} corr.)</span></span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-400 rounded-full" 
                      style={{ width: `${totalGrossEarnings > 0 ? (uberTotal / totalGrossEarnings) * 100 : 0}%` }} 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400" /> 99 App
                    </span>
                    <span className="font-mono">{formatBRL(app99Total)} <span className="text-zinc-500 font-normal">({app99Rides} corr.)</span></span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-400 rounded-full" 
                      style={{ width: `${totalGrossEarnings > 0 ? (app99Total / totalGrossEarnings) * 100 : 0}%` }} 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-zinc-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400" /> InDrive / Outros
                    </span>
                    <span className="font-mono">{formatBRL(particularTotal)} <span className="text-zinc-500 font-normal">({particularRides} corr.)</span></span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-400 rounded-full" 
                      style={{ width: `${totalGrossEarnings > 0 ? (particularTotal / totalGrossEarnings) * 100 : 0}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
              <button
                onClick={() => setIsAppShareModalOpen(false)}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SOBRE O APLICATIVO & VERSÃO (GKD MOBILITY) */}
      <AboutAppModal 
        isOpen={isAboutModalOpen} 
        onClose={() => setIsAboutModalOpen(false)} onBack={() => { setIsAboutModalOpen(false); setIsHelpModalOpen(true); }} 
      />

      {/* MODAL ASSISTENTE DE DOCUMENTOS & ALIMENTAÇÃO POR IA */}
      <DocumentFeederModal
        isOpen={isDocumentFeederOpen}
        onClose={() => setIsDocumentFeederOpen(false)} onBack={() => { setIsDocumentFeederOpen(false); setIsHelpModalOpen(true); }}
        onApplyExtractedData={handleApplyExtractedDocumentData}
        onApplyFixedExpenses={handleApplyExtractedFixedExpenses}
        onOpenExcelImport={() => setIsExcelImportOpen(true)}
        carProfile={carProfile}
        defaultDate={formDate || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`}
      />

      {/* MODAL DE CONFRONTO E RESOLUÇÃO DE CONFLITOS DE LANÇAMENTO */}
      {pendingConflictData && (
        <ConflictResolverModal
          isOpen={!!pendingConflictData}
          onClose={() => setPendingConflictData(null)}
          targetDate={pendingConflictData.targetDate}
          conflicts={pendingConflictData.conflicts}
          onConfirm={handleConfirmConflictResolution}
        />
      )}

      {/* MODAL DETALHES DA SEMANA */}
      {selectedWeekModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#12141a] border border-emerald-500/40 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-800 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-zinc-100">
                    Detalhes da {selectedWeekModalData.label} ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
                  </h2>
                  <p className="text-xs text-zinc-400">Resumo financeiro e dias trabalhados na semana</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWeekModalData(null)}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-xl transition-all cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-5 bg-zinc-950/40">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Soma Total</span>
                  <p className="text-base font-black text-emerald-400 font-mono">{formatBRL(selectedWeekModalData.totalGross)}</p>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Dias Trabalhados</span>
                  <p className="text-base font-black text-zinc-100 font-mono">{selectedWeekModalData.weekWorkDays} dias</p>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Média Diária</span>
                  <p className={`text-base font-black font-mono ${selectedWeekModalData.passesAvg ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatBRL(selectedWeekModalData.weeklyAvg)}
                  </p>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Meta Semanal</span>
                  <p className="text-xs font-bold pt-1">
                    <span className={`px-2 py-0.5 rounded-full ${selectedWeekModalData.passesAvg ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                      {selectedWeekModalData.passesAvg ? 'Atingida ✅' : 'Abaixo 🔴'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Days breakdown list */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Lançamentos da Semana</h3>
                <div className="space-y-1.5">
                  {selectedWeekModalData.days.map((wd: any) => {
                    const uTotal = wd.log ? (wd.log.appUber.earnings + wd.log.appUber.bonus) : 0;
                    const nTotal = wd.log ? (wd.log.app99.earnings + wd.log.app99.bonus) : 0;
                    const pTotal = wd.log ? wd.log.appParticular.earnings : 0;
                    const g = wd.log ? (uTotal + nTotal + pTotal + (wd.log.recompensasExtra || 0) + (wd.log.outrasFontes || 0)) : 0;
                    const isOff = wd.log ? Boolean(wd.log.isDayOff) : (new Date(selectedYear, selectedMonth - 1, wd.day).getDay() === 0);
                    const worked = wd.log && (!isOff || wd.log.kmRodado > 0 || g > 0);
                    return (
                      <div key={wd.day} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${worked ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                            {wd.day}
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-zinc-200 block">{WEEK_DAYS[new Date(selectedYear, selectedMonth - 1, wd.day).getDay()]}</span>
                            {wd.log ? (
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                                <span>{wd.log.kmRodado || 0} km</span>
                                <span>•</span>
                                <span className="text-blue-400 font-medium">Uber: <strong>{wd.log.appUber.rides || 0}</strong> corr. ({formatBRL(uTotal)})</span>
                                <span>•</span>
                                <span className="text-amber-400 font-medium">99: <strong>{wd.log.app99.rides || 0}</strong> corr. ({formatBRL(nTotal)})</span>
                                {wd.log.appParticular.rides > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-purple-400 font-medium">Part.: <strong>{wd.log.appParticular.rides}</strong> corr. ({formatBRL(pTotal)})</span>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-zinc-500">Sem registro para este dia</span>
                            )}
                          </div>
                        </div>

                        <div className="text-right font-mono self-end sm:self-center shrink-0">
                          <span className={`text-xs font-black block ${g > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            {formatBRL(g)}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {worked ? 'Trabalhado' : 'Folga'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-zinc-800 bg-zinc-950 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedWeekModalData(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AGENDA & SELETOR DE DATA (DIA, MÊS, ANO) */}
      {isDatePickerModalOpen && (() => {
        const daysInSelectedMonth = new Date(datePickerYear, datePickerMonth, 0).getDate();
        const firstDayOfWeek = new Date(datePickerYear, datePickerMonth - 1, 1).getDay(); // 0: Dom ... 6: Sáb
        const currentTargetDay = Math.min(datePickerDay, daysInSelectedMonth);
        const targetDateStr = `${datePickerYear}-${String(datePickerMonth).padStart(2, '0')}-${String(currentTargetDay).padStart(2, '0')}`;
        const hasExistingLogForDay = logs.some(l => l.date === targetDateStr && (l.kmRodado > 0 || l.appUber.earnings > 0 || l.app99.earnings > 0 || l.appParticular.earnings > 0 || l.isDayOff));
        
        const availableYears = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
        const weekDayShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        const todayDate = new Date();
        const todayYear = todayDate.getFullYear();
        const todayMonth = todayDate.getMonth() + 1;
        const todayDay = todayDate.getDate();

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div className="bg-[#12141a] border border-emerald-500/30 rounded-2xl w-full max-w-lg max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
              
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-800/80 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black tracking-tight text-zinc-100 flex items-center gap-2">
                      Agenda & Navegação
                    </h2>
                    <p className="text-xs text-zinc-400">Selecione o Dia, Mês e Ano</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDatePickerModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-xl transition-all cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-zinc-950/40">
                
                {/* 1. SELETOR DE ANO */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      1. Ano ({datePickerYear})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDatePickerYear(prev => prev - 1)}
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                        title="Ano anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="font-mono text-xs font-bold text-emerald-400 px-2 py-0.5 bg-emerald-950/40 border border-emerald-500/30 rounded">
                        {datePickerYear}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDatePickerYear(prev => prev + 1)}
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                        title="Próximo ano"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {availableYears.map(y => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => setDatePickerYear(y)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-mono font-bold transition-all cursor-pointer ${
                          datePickerYear === y
                            ? 'bg-emerald-500 text-zinc-950 shadow-md scale-105'
                            : 'bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-750'
                        }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. SELETOR DE MÊS */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      2. Mês ({MONTH_NAMES[datePickerMonth - 1]})
                    </span>
                    <span className="text-[10px] text-zinc-500">Mês {datePickerMonth} de 12</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {MONTH_NAMES.map((name, idx) => {
                      const mNum = idx + 1;
                      const isSelectedM = datePickerMonth === mNum;
                      const isCurrentM = todayYear === datePickerYear && todayMonth === mNum;
                      
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setDatePickerMonth(mNum);
                            const maxD = new Date(datePickerYear, mNum, 0).getDate();
                            if (datePickerDay > maxD) setDatePickerDay(maxD);
                          }}
                          className={`text-xs py-2 px-2 rounded-xl font-bold transition-all text-center cursor-pointer flex flex-col items-center justify-center relative ${
                            isSelectedM
                              ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-zinc-950 shadow-md font-extrabold scale-[1.02]'
                              : 'bg-zinc-800/70 text-zinc-300 hover:bg-zinc-750 hover:text-zinc-100 border border-zinc-800'
                          }`}
                        >
                          <span>{name.slice(0, 3)}</span>
                          <span className={`text-[9px] ${isSelectedM ? 'text-zinc-900 font-semibold' : 'text-zinc-500'}`}>
                            {name}
                          </span>
                          {isCurrentM && !isSelectedM && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. SELETOR DE DIA (AGENDA) */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      3. Dia ({MONTH_NAMES[datePickerMonth - 1]} / {datePickerYear})
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Com registro
                      </span>
                    </div>
                  </div>

                  {/* Dias da semana */}
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-zinc-500 pb-1">
                    {weekDayShort.map((w, i) => (
                      <div key={w} className={i === 0 || i === 6 ? 'text-amber-400/80' : ''}>
                        {w}
                      </div>
                    ))}
                  </div>

                  {/* Grade de dias */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-9 rounded-lg opacity-10" />
                    ))}
                    {Array.from({ length: daysInSelectedMonth }).map((_, i) => {
                      const d = i + 1;
                      const isSel = currentTargetDay === d;
                      const dateStr = `${datePickerYear}-${String(datePickerMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const hasLog = logs.some(l => l.date === dateStr && (l.kmRodado > 0 || l.appUber.earnings > 0 || l.app99.earnings > 0 || l.appParticular.earnings > 0 || l.isDayOff));
                      const isToday = todayYear === datePickerYear && todayMonth === datePickerMonth && todayDay === d;

                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDatePickerDay(d)}
                          className={`h-9 rounded-xl font-mono text-xs font-bold transition-all relative flex flex-col items-center justify-center cursor-pointer ${
                            isSel
                              ? 'bg-emerald-500 text-zinc-950 font-black shadow-lg scale-105 z-10'
                              : isToday
                              ? 'bg-zinc-800 border-2 border-emerald-400/80 text-emerald-300 font-bold'
                              : 'bg-zinc-800/60 hover:bg-zinc-700 text-zinc-200 border border-zinc-800/80'
                          }`}
                        >
                          <span>{d}</span>
                          {hasLog && (
                            <span 
                              className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${
                                isSel ? 'bg-zinc-950' : 'bg-emerald-400'
                              }`} 
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Banner de Data Ativa */}
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                      Data Selecionada:
                    </span>
                    <span className="text-xs font-mono font-bold text-zinc-100">
                      {String(currentTargetDay).padStart(2, '0')}/{String(datePickerMonth).padStart(2, '0')}/{datePickerYear} ({MONTH_NAMES[datePickerMonth - 1]})
                    </span>
                  </div>
                  {hasExistingLogForDay && (
                    <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                      ✓ Dia com Registro
                    </span>
                  )}
                </div>

              </div>

              {/* Actions Footer */}
              <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-950 flex flex-wrap gap-2 justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setDatePickerYear(now.getFullYear());
                    setDatePickerMonth(now.getMonth() + 1);
                    setDatePickerDay(now.getDate());
                  }}
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                  Hoje
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear(datePickerYear);
                      setSelectedMonth(datePickerMonth);
                      setIsAllYear(false);
                      setIsDatePickerModalOpen(false);
                    }}
                    className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Ver Mês ({MONTH_NAMES[datePickerMonth - 1].slice(0, 3)}/{datePickerYear})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear(datePickerYear);
                      setSelectedMonth(datePickerMonth);
                      setIsAllYear(false);
                      setIsDatePickerModalOpen(false);
                      const dStr = `${datePickerYear}-${String(datePickerMonth).padStart(2, '0')}-${String(currentTargetDay).padStart(2, '0')}`;
                      openModalForDate(dStr);
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Abrir Registro do Dia
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL DE VARREDURA PROFUNDA */}
      <DeepSweepModal
        isOpen={isDeepSweepModalOpen}
        onClose={() => setIsDeepSweepModalOpen(false)} onBack={() => { setIsDeepSweepModalOpen(false); setIsHelpModalOpen(true); }}
        report={deepSweepReport}
        onRerun={handleDeepSweep}
        onApplyAugustToAll={handleApplyAugustToAllMonths}
      />

      {/* MODAL PARA COLAR CONTAS (EXCEL / WHATSAPP / EXTRATO) */}
      <PasteFixedExpensesModal
        isOpen={isPasteFixedExpensesModalOpen}
        onClose={() => setIsPasteFixedExpensesModalOpen(false)}
        currentMonth={selectedMonth}
        currentYear={selectedYear}
        onApplyExpenses={handleApplyExtractedFixedExpenses}
      />

      {/* MODAL DE CONFIRMAÇÃO PARA APAGAR TODOS OS DADOS DA PLANILHA */}
      {isConfirmClearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121215] border border-red-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Apagar Todos os Dados?</h3>
                <p className="text-xs text-zinc-400">Zerar todos os lançamentos da planilha</p>
              </div>
            </div>

            <div className="p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-800 space-y-2">
              <p className="text-xs text-zinc-300 leading-relaxed font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Deseja fazer um backup antes?
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Recomendamos exportar seus dados para Excel antes de apagar tudo, para não perder seu histórico de faturamento e quilometragem.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmClearAllModalOpen(false);
                  setIsBackupModalOpen(true);
                }}
                className="w-full mt-2 py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Fazer Backup do Histórico (Excel)
              </button>
            </div>

            <div className="p-3.5 bg-red-500/5 rounded-xl border border-red-500/10 space-y-2">
              <p className="text-xs text-zinc-300 leading-relaxed">
                Tem certeza que deseja apagar todos os dados?
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Isso apagará todos os lançamentos diários, dados do veículo e despesas fixas. Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmClearAllModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearAllData}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-red-600/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Apagar Tudo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE BACKUP */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)} onBack={() => { setIsBackupModalOpen(false); setIsHelpModalOpen(true); }}
        onExport={handleExportExcelBackup}
      />

      <TollCalculator
        isOpen={isTollCalculatorOpen}
        onClose={() => setIsTollCalculatorOpen(false)}
        onApply={(total) => setToll(String(total))}
        initialTotal={parseFloat(toll.replace(',', '.')) || 0}
      />

    </div>
  );
}
