import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Package, Users, Sparkles, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { custodiaReceitaRepository, clienteRepository, offerReservationRepository } from '../../services/repositories';
import { custodiaReceitaSchema, calcOffersRevenueForMonth, type CustodiaReceita, type CustodiaReceitaInput, type Cliente, type OfferReservation } from '../../domain/types';
import {
  formatCurrency,
  formatPercent,
  calcularReceitaRegistro,
  calcularROARegistro,
  calcularCaptacaoLiquida,
  calcularReceitaTotal,
  calcularCaptacaoTotal,
  getNomeMes,
} from '../../domain/calculations';
import { DataTable, CurrencyCell, PercentCell, ActionButtons } from '../../components/shared/DataTable';
import { Modal, ConfirmDelete } from '../../components/shared/Modal';
import { Input, PeriodFilter } from '../../components/shared/FormFields';
import ClientSelect from '../../components/clientes/ClientSelect';

export default function CustodiaReceitaPage() {
  const { user, loading: authLoading } = useAuth();
  const ownerUid = user?.uid;
  const [registros, setRegistros] = useState<CustodiaReceita[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ofertas, setOfertas] = useState<OfferReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState<CustodiaReceita | null>(null);
  const [saving, setSaving] = useState(false);

  // Filtros
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustodiaReceitaInput>({
    resolver: zodResolver(custodiaReceitaSchema),
    defaultValues: {
      mes: mesFiltro,
      ano: anoFiltro,
      custodiaInicio: 0,
      custodiaFim: 0,
      captacaoBruta: 0,
      resgate: 0,
      receitaRV: 0,
      receitaRF: 0,
      receitaCOE: 0,
      receitaFundos: 0,
      receitaPrevidencia: 0,
      receitaOutros: 0,
    },
  });

  // Para calcular receita total em tempo real
  const watchedValues = watch();
  const receitaTotalCalc = useMemo(() => {
    return (
      (watchedValues.receitaRV || 0) +
      (watchedValues.receitaRF || 0) +
      (watchedValues.receitaCOE || 0) +
      (watchedValues.receitaFundos || 0) +
      (watchedValues.receitaPrevidencia || 0) +
      (watchedValues.receitaOutros || 0)
    );
  }, [watchedValues]);

  useEffect(() => {
    if (authLoading) return;
    if (!ownerUid) {
      setRegistros([]);
      setClientes([]);
      setOfertas([]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const [registroData, clienteData, ofertasData] = await Promise.all([
          custodiaReceitaRepository.getByMonth(ownerUid, mesFiltro, anoFiltro),
          clienteRepository.getAll(ownerUid),
          offerReservationRepository.getAll(ownerUid),
        ]);
        setRegistros(registroData);
        setClientes(clienteData);
        setOfertas(ofertasData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, ownerUid, mesFiltro, anoFiltro]);

  // Receita derivada das Ofertas/Reservas liquidadas no mês/ano
  const receitaOfertas = useMemo(() => {
    return calcOffersRevenueForMonth(ofertas, mesFiltro, anoFiltro);
  }, [ofertas, mesFiltro, anoFiltro]);

  // ====== SUGESTÕES AUTOMÁTICAS (Etapa 6) ======
  // Custódia sugerida = soma de custodiaAtual de todos os clientes ativos
  const custodiaSugerida = useMemo(() => {
    return clientes
      .filter((c) => c.status === 'ativo')
      .reduce((sum, c) => sum + (c.custodiaAtual || 0), 0);
  }, [clientes]);

  // Receita sugerida de ofertas = já calculada em receitaOfertas
  const receitaOfertasSugerida = receitaOfertas;

  // Handler para aplicar valores automáticos
  const aplicarValoresAutomaticos = async () => {
    if (!ownerUid) return;
    try {
      setSaving(true);
      
      // Verificar se já existe registro "Geral" para o mês/ano
      const registroGeral = registros.find((r) => !r.clienteId || r.clienteId === '');
      
      if (registroGeral?.id) {
        // Atualizar registro existente apenas com custódia
        const updated = await custodiaReceitaRepository.update(
          registroGeral.id,
          {
            custodiaFim: custodiaSugerida,
            // Nota: receita de ofertas é derivada, não gravamos duplicado
          },
          ownerUid
        );
        if (updated) {
          setRegistros((prev) => prev.map((r) => (r.id === registroGeral.id ? updated : r)));
        }
      } else {
        // Criar novo registro "Geral" com valores sugeridos
        const created = await custodiaReceitaRepository.create(
          {
            clienteId: '',
            clienteNome: 'Geral',
            mes: mesFiltro,
            ano: anoFiltro,
            custodiaInicio: custodiaSugerida,
            custodiaFim: custodiaSugerida,
            captacaoBruta: 0,
            resgate: 0,
            receitaRV: 0,
            receitaRF: 0,
            receitaCOE: 0,
            receitaFundos: 0,
            receitaPrevidencia: 0,
            receitaOutros: 0,
          },
          ownerUid
        );
        setRegistros((prev) => [...prev, created]);
      }
      
      toast.success('Valores automáticos aplicados com sucesso!');
    } catch (error) {
      console.error('Erro ao aplicar valores:', error);
      toast.error('Erro ao aplicar valores automáticos');
    } finally {
      setSaving(false);
    }
  };

  const clientSelectOptions = useMemo(
    () => [
      { value: '', label: 'Geral (sem cliente)', hint: 'Registro agregado do período' },
      ...clientes
        .filter((c) => Boolean(c.id))
        .map((c) => ({
          value: c.id || '',
          label: c.nome,
          hint: [c.cpfCnpj, c.codigoConta, c.email, c.telefone].filter(Boolean).join(' | '),
          searchText: [c.nome, c.cpfCnpj, c.codigoConta, c.email, c.telefone].filter(Boolean).join(' '),
        })),
    ],
    [clientes]
  );

  const openModal = (registro?: CustodiaReceita) => {
    if (registro) {
      setSelectedRegistro(registro);
      reset(registro);
    } else {
      setSelectedRegistro(null);
      reset({
        mes: mesFiltro,
        ano: anoFiltro,
        clienteId: '',
        custodiaInicio: 0,
        custodiaFim: 0,
        captacaoBruta: 0,
        resgate: 0,
        receitaRV: 0,
        receitaRF: 0,
        receitaCOE: 0,
        receitaFundos: 0,
        receitaPrevidencia: 0,
        receitaOutros: 0,
      });
    }
    setModalOpen(true);
  };

  const onSubmit = async (data: CustodiaReceitaInput) => {
    if (!ownerUid) return;

    try {
      setSaving(true);
      const parsed = custodiaReceitaSchema.parse(data);

      const cliente = clientes.find((c) => c.id === parsed.clienteId);
      const dataWithCliente = {
        ...parsed,
        clienteNome: cliente?.nome || 'Geral',
      };

      if (selectedRegistro?.id) {
        const updated = await custodiaReceitaRepository.update(selectedRegistro.id, dataWithCliente, ownerUid);
        if (updated) {
          setRegistros((prev) =>
            prev.map((r) => (r.id === selectedRegistro.id ? updated : r))
          );
          toast.success('Registro atualizado com sucesso!');
        }
      } else {
        const created = await custodiaReceitaRepository.create(dataWithCliente, ownerUid);
        setRegistros((prev) => [...prev, created]);
        toast.success('Registro criado com sucesso!');
      }

      setModalOpen(false);
      reset();
    } catch (error) {
      console.error('Erro ao salvar registro:', error);
      toast.error('Erro ao salvar registro');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!ownerUid || !selectedRegistro?.id) return;

    try {
      setSaving(true);
      await custodiaReceitaRepository.delete(selectedRegistro.id, ownerUid);
      setRegistros((prev) => prev.filter((r) => r.id !== selectedRegistro.id));
      toast.success('Registro excluído com sucesso!');
      setDeleteModalOpen(false);
      setSelectedRegistro(null);
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      toast.error('Erro ao excluir registro');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<CustodiaReceita>[]>(
    () => [
      {
        accessorKey: 'clienteNome',
        header: 'Cliente',
        cell: (info) => <span className="font-medium">{(info.getValue() as string) || 'Geral'}</span>,
      },
      {
        accessorKey: 'custodiaInicio',
        header: 'Custódia Início',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        accessorKey: 'custodiaFim',
        header: 'Custódia Fim',
        cell: (info) => <CurrencyCell value={info.getValue() as number} />,
      },
      {
        id: 'captacaoLiquida',
        header: 'Captação Líq.',
        cell: (info) => {
          const row = info.row.original;
          const captacao = calcularCaptacaoLiquida(row.captacaoBruta, row.resgate);
          return <CurrencyCell value={captacao} />;
        },
      },
      {
        id: 'receitaTotal',
        header: 'Receita Total',
        cell: (info) => {
          const receita = calcularReceitaRegistro(info.row.original);
          return <CurrencyCell value={receita} />;
        },
      },
      {
        id: 'roa',
        header: 'ROA (%)',
        cell: (info) => {
          const roa = calcularROARegistro(info.row.original);
          return <PercentCell value={roa} />;
        },
      },
      {
        id: 'actions',
        header: 'Ações',
        cell: (info) => (
          <ActionButtons
            onEdit={() => openModal(info.row.original)}
            onDelete={() => {
              setSelectedRegistro(info.row.original);
              setDeleteModalOpen(true);
            }}
          />
        ),
      },
    ],
    []
  );

  const totais = useMemo(() => {
    const custodiaTotal = registros.reduce((sum, r) => sum + (r.custodiaFim || 0), 0);
    const receitaRegistros = calcularReceitaTotal(registros);
    const receitaTotal = receitaRegistros + receitaOfertas;
    const captacaoTotal = calcularCaptacaoTotal(registros);
    const custodiaMedia = registros.reduce((sum, r) => sum + ((r.custodiaInicio + r.custodiaFim) / 2), 0);
    const roaMedio = custodiaMedia > 0 ? (receitaTotal / custodiaMedia) * 100 : 0;

    return {
      registros: registros.length,
      custodiaTotal,
      receitaRegistros,
      receitaOfertas,
      receitaTotal,
      captacaoTotal,
      roaMedio,
    };
  }, [registros, receitaOfertas]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custódia x Receita</h1>
          <p className="text-gray-600">
            {getNomeMes(mesFiltro)} de {anoFiltro}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <PeriodFilter
            mes={mesFiltro}
            ano={anoFiltro}
            onMesChange={setMesFiltro}
            onAnoChange={setAnoFiltro}
          />
          <button
            onClick={() => openModal()}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Registro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Registros</p>
          <p className="text-2xl font-bold text-gray-900">{totais.registros}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Custódia Total</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totais.custodiaTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Captação Líquida</p>
          <p className={`text-2xl font-bold ${totais.captacaoTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totais.captacaoTotal)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Receita Registros</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totais.receitaRegistros)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-teal-500">
          <p className="text-sm text-gray-600 flex items-center gap-1">
            <Package className="w-4 h-4" /> Ofertas/Reservas
          </p>
          <p className="text-2xl font-bold text-teal-600">{formatCurrency(totais.receitaOfertas)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow bg-gradient-to-r from-green-50 to-teal-50">
          <p className="text-sm text-gray-600 font-semibold">Receita Total</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totais.receitaTotal)}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <p className="text-sm text-gray-600">ROA Médio</p>
        <p className="text-2xl font-bold text-purple-600">{formatPercent(totais.roaMedio)}</p>
      </div>

      {/* ====== SUGESTÕES AUTOMÁTICAS (Etapa 6) ====== */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-lg shadow border border-indigo-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-indigo-900">Sugestões Automáticas</h3>
          </div>
          <button
            onClick={aplicarValoresAutomaticos}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
          >
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Aplicando...' : 'Aplicar valores automáticos'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">AUTO: Clientes</span>
            </div>
            <p className="text-sm text-gray-600">Custódia Sugerida</p>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(custodiaSugerida)}</p>
            <p className="text-xs text-gray-500 mt-1">Soma da custódia atual de {clientes.filter(c => c.status === 'ativo').length} clientes ativos</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-teal-200">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-medium text-teal-600 bg-teal-100 px-2 py-0.5 rounded">AUTO: Reservas</span>
            </div>
            <p className="text-sm text-gray-600">Receita Sugerida (Ofertas)</p>
            <p className="text-2xl font-bold text-teal-700">{formatCurrency(receitaOfertasSugerida)}</p>
            <p className="text-xs text-gray-500 mt-1">Ofertas liquidadas em {getNomeMes(mesFiltro)}/{anoFiltro}</p>
          </div>
        </div>
      </div>

      <DataTable
        data={registros}
        columns={columns}
        searchPlaceholder="Buscar registros..."
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedRegistro ? 'Editar Registro' : 'Novo Registro'}
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ClientSelect
              label="Cliente"
              value={watchedValues.clienteId || ''}
              options={clientSelectOptions}
              loading={loading}
              onChange={(nextValue) => {
                setValue('clienteId', nextValue, { shouldDirty: true, shouldValidate: true });
              }}
              error={errors.clienteId?.message}
              placeholder="Selecione o cliente"
            />
            <Input
              label="Mês"
              type="number"
              min="1"
              max="12"
              {...register('mes', { valueAsNumber: true })}
              error={errors.mes?.message}
            />
            <Input
              label="Ano"
              type="number"
              min="2020"
              max="2100"
              {...register('ano', { valueAsNumber: true })}
              error={errors.ano?.message}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Custódia</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                label="Custódia Início"
                type="number"
                step="0.01"
                {...register('custodiaInicio', { valueAsNumber: true })}
                error={errors.custodiaInicio?.message}
              />
              <Input
                label="Custódia Fim"
                type="number"
                step="0.01"
                {...register('custodiaFim', { valueAsNumber: true })}
                error={errors.custodiaFim?.message}
              />
              <Input
                label="Captação Bruta"
                type="number"
                step="0.01"
                {...register('captacaoBruta', { valueAsNumber: true })}
                error={errors.captacaoBruta?.message}
              />
              <Input
                label="Resgates"
                type="number"
                step="0.01"
                {...register('resgate', { valueAsNumber: true })}
                error={errors.resgate?.message}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Receitas (Total: {formatCurrency(receitaTotalCalc)})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Renda Variável"
                type="number"
                step="0.01"
                {...register('receitaRV', { valueAsNumber: true })}
                error={errors.receitaRV?.message}
              />
              <Input
                label="Renda Fixa"
                type="number"
                step="0.01"
                {...register('receitaRF', { valueAsNumber: true })}
                error={errors.receitaRF?.message}
              />
              <Input
                label="COE"
                type="number"
                step="0.01"
                {...register('receitaCOE', { valueAsNumber: true })}
                error={errors.receitaCOE?.message}
              />
              <Input
                label="Fundos"
                type="number"
                step="0.01"
                {...register('receitaFundos', { valueAsNumber: true })}
                error={errors.receitaFundos?.message}
              />
              <Input
                label="Previdência"
                type="number"
                step="0.01"
                {...register('receitaPrevidencia', { valueAsNumber: true })}
                error={errors.receitaPrevidencia?.message}
              />
              <Input
                label="Outros"
                type="number"
                step="0.01"
                {...register('receitaOutros', { valueAsNumber: true })}
                error={errors.receitaOutros?.message}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : selectedRegistro ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDelete
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        loading={saving}
      />
    </div>
  );
}
