import { beforeEach, describe, expect, it } from 'vitest';
import { saveProspectWithConversion } from './prospectConversionService';
import { captacaoLancamentoRepository, clienteRepository, prospectRepository } from './repositories';
import type { ProspectInput } from '../domain/types';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const ownerUid = 'test-owner';

function buildWonProspectInput(overrides: Partial<ProspectInput> = {}): ProspectInput {
  return {
    nome: 'Prospect Teste',
    cpfCnpj: '123.456.789-00',
    email: 'prospect@example.com',
    telefone: '(11) 99999-9999',
    origem: 'indicacao',
    potencial: 1000,
    potencialTipo: 'captacao_liquida',
    probabilidade: 100,
    dataContato: '2026-01-01',
    proximoContato: '',
    proximoContatoHora: '',
    realizadoValor: 100,
    realizadoTipo: 'captacao_liquida',
    realizadoData: '2026-01-10',
    status: 'ganho',
    observacoes: '',
    ...overrides,
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
});

describe('prospect conversion service', () => {
  it('converte e mantém idempotência de cliente e lançamento', async () => {
    const first = await saveProspectWithConversion({
      data: buildWonProspectInput(),
    }, { ownerUid });

    expect(first.prospect.id).toBeDefined();
    expect(first.prospect.converted).toBe(true);
    expect(first.prospect.convertedClientId).toBeDefined();

    const second = await saveProspectWithConversion({
      prospectId: first.prospect.id,
      data: buildWonProspectInput({ observacoes: 'Atualizado' }),
    }, { ownerUid });

    expect(second.prospect.converted).toBe(true);

    const clients = await clienteRepository.getAll(ownerUid);
    expect(clients).toHaveLength(1);

    const lancamentos = await captacaoLancamentoRepository.getAll(ownerUid);
    const conversionLancamentos = lancamentos.filter((item) => item.sourceRef === `prospect_conversion:${first.prospect.id}`);
    expect(conversionLancamentos).toHaveLength(1);
  });

  it('ao editar em ganho atualiza o mesmo lançamento', async () => {
    const created = await saveProspectWithConversion({
      data: buildWonProspectInput(),
    }, { ownerUid });

    await saveProspectWithConversion({
      prospectId: created.prospect.id,
      data: buildWonProspectInput({
        realizadoValor: 250,
        realizadoData: '2026-02-15',
        realizadoTipo: 'transferencia_xp',
      }),
    }, { ownerUid });

    const lancamentos = await captacaoLancamentoRepository.getAll(ownerUid);
    const conversion = lancamentos.find((item) => item.sourceRef === `prospect_conversion:${created.prospect.id}`);
    expect(conversion).toBeDefined();
    expect(conversion?.valor).toBe(250);
    expect(conversion?.mes).toBe(2);
    expect(conversion?.tipo).toBe('transferencia_xp');
  });

  it('desconverte sem apagar cliente e cria estorno idempotente', async () => {
    const created = await saveProspectWithConversion({
      data: buildWonProspectInput(),
    }, { ownerUid });

    const deconverted = await saveProspectWithConversion({
      prospectId: created.prospect.id,
      data: buildWonProspectInput({
        status: 'perdido',
      }),
    }, { ownerUid });

    expect(deconverted.prospect.converted).toBe(false);

    const clients = await clienteRepository.getAll(ownerUid);
    expect(clients).toHaveLength(1);

    const lancamentos = await captacaoLancamentoRepository.getAll(ownerUid);
    const conversion = lancamentos.filter((item) => item.sourceRef === `prospect_conversion:${created.prospect.id}`);
    const reversal = lancamentos.filter((item) => item.sourceRef === `prospect_conversion_reversal:${created.prospect.id}`);

    expect(conversion).toHaveLength(1);
    expect(reversal).toHaveLength(1);
    expect(reversal[0].direcao).toBe('saida');
  });

  it('rejeita ganho sem valor/data realizado', async () => {
    await expect(
      saveProspectWithConversion({
        data: buildWonProspectInput({
          realizadoValor: 0,
          realizadoData: '',
        }),
      }, { ownerUid }),
    ).rejects.toThrow('PROSPECT_CONVERSION_REQUIREMENTS');

    const prospects = await prospectRepository.getAll(ownerUid);
    expect(prospects).toHaveLength(0);
  });
});
