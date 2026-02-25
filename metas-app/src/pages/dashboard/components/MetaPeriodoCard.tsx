import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import {
  calcularCaptacaoLiquidaMensal,
  calcularTransferenciaXpMensal,
  formatCurrency,
  getNomeMes,
} from '../../../domain/calculations';
import type { CaptacaoLancamento, MonthlyGoals } from '../../../domain/types';
import { EmptyState, SectionCard, SegmentedControl } from '../../../components/ui';

type MetaPeriodo = 'quarterly' | 'semiannual';
type Quarter = 1 | 2 | 3 | 4;
type Semester = 1 | 2;

interface MetaPeriodoCardProps {
  goals: MonthlyGoals[];
  lancamentos: CaptacaoLancamento[];
  mesAtual: number;
  anoAtual: number;
  metasRoute?: string;
}

const PERIODO_OPTIONS = [
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
] as const;

const QUARTER_OPTIONS = [
  { value: '1', label: '1º Tri' },
  { value: '2', label: '2º Tri' },
  { value: '3', label: '3º Tri' },
  { value: '4', label: '4º Tri' },
] as const;

const SEMESTER_OPTIONS = [
  { value: '1', label: '1º Sem' },
  { value: '2', label: '2º Sem' },
] as const;

function getProgressColor(progressPercent: number): string {
  if (progressPercent >= 100) return 'var(--color-success)';
  if (progressPercent >= 75) return 'var(--chart-1)';
  return 'var(--color-warning)';
}

function getMonthShortLabel(mes: number, ano: number): string {
  return `${getNomeMes(mes).slice(0, 3)}/${String(ano).slice(-2)}`;
}

function buildPeriodMonths(periodo: MetaPeriodo, quarter: Quarter, semester: Semester, anoAtual: number) {
  if (periodo === 'semiannual') {
    const start = semester === 1 ? 1 : 7;
    const end = semester === 1 ? 6 : 12;
    const months = Array.from({ length: end - start + 1 }, (_, index) => ({
      mes: start + index,
      ano: anoAtual,
      label: getMonthShortLabel(start + index, anoAtual),
    }));

    return {
      months,
      title: `Meta ${semester}º Semestre`,
      subtitle: `${getMonthShortLabel(start, anoAtual)} - ${getMonthShortLabel(end, anoAtual)}`,
    };
  }

  const start = ((quarter - 1) * 3) + 1;
  const end = start + 2;
  const months = Array.from({ length: 3 }, (_, index) => ({
    mes: start + index,
    ano: anoAtual,
    label: getMonthShortLabel(start + index, anoAtual),
  }));

  return {
    months,
    title: `Meta ${quarter}º Trimestre`,
    subtitle: `${getMonthShortLabel(start, anoAtual)} - ${getMonthShortLabel(end, anoAtual)}`,
  };
}

export function MetaPeriodoCard({
  goals,
  lancamentos,
  mesAtual,
  anoAtual,
  metasRoute = '/metas',
}: MetaPeriodoCardProps) {
  const [periodo, setPeriodo] = useState<MetaPeriodo>('quarterly');
  const [quarter, setQuarter] = useState<Quarter>(Math.ceil(mesAtual / 3) as Quarter);
  const [semester, setSemester] = useState<Semester>(mesAtual <= 6 ? 1 : 2);

  const periodInfo = useMemo(() => {
    return buildPeriodMonths(periodo, quarter, semester, anoAtual);
  }, [anoAtual, periodo, quarter, semester]);

  const resumo = useMemo(() => {
    const goalsMap = new Map(goals.map((goal) => [`${goal.ano}-${goal.mes}`, goal] as const));

    const metaCaptacaoLiquida = periodInfo.months.reduce((sum, month) => {
      const goal = goalsMap.get(`${month.ano}-${month.mes}`);
      return sum + Number(goal?.metaCaptacaoLiquida ?? 0);
    }, 0);

    const metaTransferenciaXp = periodInfo.months.reduce((sum, month) => {
      const goal = goalsMap.get(`${month.ano}-${month.mes}`);
      return sum + Number(goal?.metaTransferenciaXp ?? 0);
    }, 0);

    const realizadoCaptacaoLiquida = periodInfo.months.reduce((sum, month) => {
      return sum + calcularCaptacaoLiquidaMensal(lancamentos, month.mes, month.ano);
    }, 0);

    const realizadoTransferenciaXp = periodInfo.months.reduce((sum, month) => {
      return sum + calcularTransferenciaXpMensal(lancamentos, month.mes, month.ano);
    }, 0);

    const metaTotal = metaCaptacaoLiquida + metaTransferenciaXp;
    const realizadoTotal = realizadoCaptacaoLiquida + realizadoTransferenciaXp;

    const progressRaw = metaTotal > 0 ? (realizadoTotal / metaTotal) * 100 : null;
    const progressBarPercent = progressRaw === null ? 0 : Math.max(0, Math.min(progressRaw, 100));

    return {
      metaCaptacaoLiquida,
      metaTransferenciaXp,
      realizadoCaptacaoLiquida,
      realizadoTransferenciaXp,
      metaTotal,
      realizadoTotal,
      progressRaw,
      progressBarPercent,
    };
  }, [goals, lancamentos, periodInfo.months]);

  const handlePeriodoChange = useCallback((value: string) => {
    setPeriodo(value === 'semiannual' ? 'semiannual' : 'quarterly');
  }, []);

  const handleQuarterChange = useCallback((value: string) => {
    const parsed = Number(value);
    if (parsed >= 1 && parsed <= 4) {
      setQuarter(parsed as Quarter);
    }
  }, []);

  const handleSemesterChange = useCallback((value: string) => {
    const parsed = Number(value);
    if (parsed === 1 || parsed === 2) {
      setSemester(parsed as Semester);
    }
  }, []);

  return (
    <SectionCard
      title="Meta de Captação"
      subtitle={periodInfo.subtitle}
      action={(
        <SegmentedControl
          options={PERIODO_OPTIONS}
          value={periodo}
          onChange={handlePeriodoChange}
          size="sm"
          className="w-auto"
        />
      )}
    >
      {resumo.metaTotal <= 0 ? (
        <EmptyState
          title="Meta não definida"
          description="Cadastre metas mensais para acompanhar captação líquida e transferência XP por período."
          action={(
            <Link
              to={metasRoute}
              className="rounded-lg px-4 py-2 text-sm font-medium focus-gold"
              style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-text-inverse)' }}
            >
              Definir metas
            </Link>
          )}
        />
      ) : (
        <div className="space-y-4">
          <SegmentedControl
            options={periodo === 'semiannual' ? SEMESTER_OPTIONS : QUARTER_OPTIONS}
            value={String(periodo === 'semiannual' ? semester : quarter)}
            onChange={periodo === 'semiannual' ? handleSemesterChange : handleQuarterChange}
            size="sm"
          />

          <div className="flex flex-col items-center justify-center text-center">
            <div
              className="mb-2 flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-info-bg)', color: 'var(--chart-1)' }}
            >
              <Target className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              {periodInfo.title}
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Você atingiu{' '}
              <strong style={{ color: getProgressColor(resumo.progressRaw ?? 0) }}>
                {Math.max(0, resumo.progressRaw ?? 0).toFixed(0)}%
              </strong>{' '}
              da meta de captação líquida + transferência XP.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <p style={{ color: 'var(--color-text-muted)' }}>Realizado</p>
              <p className="mt-1 font-semibold" style={{ color: 'var(--color-text)' }}>
                {formatCurrency(resumo.realizadoTotal)}
              </p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <p style={{ color: 'var(--color-text-muted)' }}>Meta</p>
              <p className="mt-1 font-semibold" style={{ color: 'var(--color-text)' }}>
                {formatCurrency(resumo.metaTotal)}
              </p>
            </div>
          </div>

          <div className="space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="flex items-center justify-between gap-3">
              <span>Captação Líquida</span>
              <span>{formatCurrency(resumo.realizadoCaptacaoLiquida)} / {formatCurrency(resumo.metaCaptacaoLiquida)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Transferência XP</span>
              <span>{formatCurrency(resumo.realizadoTransferenciaXp)} / {formatCurrency(resumo.metaTransferenciaXp)}</span>
            </div>
          </div>

          <div>
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--color-surface-3)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${resumo.progressBarPercent}%`,
                  backgroundColor: getProgressColor(resumo.progressRaw ?? 0),
                }}
              />
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
