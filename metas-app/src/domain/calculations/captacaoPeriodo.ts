import type { CaptacaoLancamento } from '../types';
import { calcularCaptacaoLiquidaMensal, calcularTransferenciaXpMensal } from './index';

export interface CaptacaoPeriodoSeriesPoint {
  dia: number;
  label: string;
  captacaoLiquida: number;
  transferenciaXp: number;
  captacaoLiquidaAcumulada: number;
  transferenciaXpAcumulada: number;
}

export interface CaptacaoPeriodoResumo {
  lancamentosPeriodo: CaptacaoLancamento[];
  entradas: number;
  saidas: number;
  captacaoLiquida: number;
  transferenciaXp: number;
  seriesEvolucao: CaptacaoPeriodoSeriesPoint[];
}

interface CaptacaoLancamentoRuntimeShape {
  category?: string;
  type?: string;
  amount?: number | null;
  status?: string;
  cancelled?: boolean;
  voided?: boolean;
  deletedAt?: string | null;
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseLancamentoDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00-03:00`);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const brDateOnlyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDateOnlyMatch) {
    const [, day, month, year] = brDateOnlyMatch;
    const parsed = new Date(`${year}-${month}-${day}T12:00:00-03:00`);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const parsed = new Date(trimmed);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function isValidLancamento(lancamento: CaptacaoLancamento): boolean {
  const runtime = lancamento as CaptacaoLancamento & CaptacaoLancamentoRuntimeShape;
  if (runtime.cancelled || runtime.voided || Boolean(runtime.deletedAt)) return false;
  const status = normalizeText(runtime.status);
  return !(status === 'CANCELADA'
    || status === 'CANCELADO'
    || status === 'CANCELLED'
    || status === 'VOIDED'
    || status === 'DELETED');
}

function resolveMonthYear(lancamento: CaptacaoLancamento): { mes: number; ano: number } | null {
  const parsedDate = parseLancamentoDate(lancamento.data);
  if (parsedDate) {
    return {
      mes: parsedDate.getMonth() + 1,
      ano: parsedDate.getFullYear(),
    };
  }

  if (
    Number.isFinite(lancamento.mes)
    && Number.isFinite(lancamento.ano)
    && lancamento.mes >= 1
    && lancamento.mes <= 12
  ) {
    return { mes: lancamento.mes, ano: lancamento.ano };
  }

  return null;
}

function resolveDayInMonth(lancamento: CaptacaoLancamento, mes: number, ano: number): number | null {
  const parsedDate = parseLancamentoDate(lancamento.data);
  if (parsedDate) {
    const parsedMonth = parsedDate.getMonth() + 1;
    const parsedYear = parsedDate.getFullYear();
    if (parsedMonth !== mes || parsedYear !== ano) return null;
    return parsedDate.getDate();
  }

  if (lancamento.mes === mes && lancamento.ano === ano) {
    return 1;
  }

  return null;
}

function resolveAbsoluteAmount(lancamento: CaptacaoLancamento): number {
  const runtime = lancamento as CaptacaoLancamento & CaptacaoLancamentoRuntimeShape;
  const amountRaw = typeof runtime.amount === 'number' ? runtime.amount : lancamento.valor;
  return Number.isFinite(amountRaw) ? amountRaw : 0;
}

function isEntrada(direction: unknown): boolean {
  return normalizeText(direction) === 'ENTRADA';
}

function resolveCategory(lancamento: CaptacaoLancamento): 'CAPTACAO' | 'TRANSFERENCIA' | null {
  const runtime = lancamento as CaptacaoLancamento & CaptacaoLancamentoRuntimeShape;
  const category = normalizeText(runtime.category ?? runtime.type ?? lancamento.tipo);
  if (category === 'TRANSFERENCIA_XP') return 'TRANSFERENCIA';
  if (category === 'CAPTACAO_LIQUIDA' || category === 'RESGATE') return 'CAPTACAO';
  return null;
}

function resolveSignedAmount(lancamento: CaptacaoLancamento): number {
  const amount = resolveAbsoluteAmount(lancamento);
  return isEntrada(lancamento.direcao) ? amount : -amount;
}

export function filterCaptacaoLancamentosByPeriodo(
  lancamentos: CaptacaoLancamento[],
  mes: number,
  ano: number,
): CaptacaoLancamento[] {
  return lancamentos.filter((lancamento) => {
    if (!isValidLancamento(lancamento)) return false;
    const period = resolveMonthYear(lancamento);
    if (!period) return false;
    return period.mes === mes && period.ano === ano;
  });
}

export function buildCaptacaoEvolucaoSeries(
  lancamentos: CaptacaoLancamento[],
  mes: number,
  ano: number,
): CaptacaoPeriodoSeriesPoint[] {
  const daysInMonth = new Date(ano, mes, 0).getDate();
  const dayTotals = Array.from({ length: daysInMonth }, () => ({
    captacaoLiquida: 0,
    transferenciaXp: 0,
  }));

  for (const lancamento of lancamentos) {
    if (!isValidLancamento(lancamento)) continue;
    const category = resolveCategory(lancamento);
    if (!category) continue;
    const day = resolveDayInMonth(lancamento, mes, ano);
    if (!day || day < 1 || day > daysInMonth) continue;
    const amount = resolveSignedAmount(lancamento);
    const dayIndex = day - 1;
    if (category === 'CAPTACAO') {
      dayTotals[dayIndex].captacaoLiquida += amount;
    } else {
      dayTotals[dayIndex].transferenciaXp += amount;
    }
  }

  let captacaoAcumulada = 0;
  let transferenciaAcumulada = 0;

  return dayTotals.map((day, index) => {
    captacaoAcumulada += day.captacaoLiquida;
    transferenciaAcumulada += day.transferenciaXp;

    return {
      dia: index + 1,
      label: String(index + 1).padStart(2, '0'),
      captacaoLiquida: day.captacaoLiquida,
      transferenciaXp: day.transferenciaXp,
      captacaoLiquidaAcumulada: captacaoAcumulada,
      transferenciaXpAcumulada: transferenciaAcumulada,
    };
  });
}

export function getCaptacaoResumoPeriodo(
  lancamentos: CaptacaoLancamento[],
  mes: number,
  ano: number,
): CaptacaoPeriodoResumo {
  const lancamentosPeriodo = filterCaptacaoLancamentosByPeriodo(lancamentos, mes, ano);
  const entradas = lancamentosPeriodo
    .filter((lancamento) => isEntrada(lancamento.direcao))
    .reduce((sum, lancamento) => sum + resolveAbsoluteAmount(lancamento), 0);
  const saidas = lancamentosPeriodo
    .filter((lancamento) => !isEntrada(lancamento.direcao))
    .reduce((sum, lancamento) => sum + resolveAbsoluteAmount(lancamento), 0);

  return {
    lancamentosPeriodo,
    entradas,
    saidas,
    captacaoLiquida: calcularCaptacaoLiquidaMensal(lancamentos, mes, ano),
    transferenciaXp: calcularTransferenciaXpMensal(lancamentos, mes, ano),
    seriesEvolucao: buildCaptacaoEvolucaoSeries(lancamentos, mes, ano),
  };
}
