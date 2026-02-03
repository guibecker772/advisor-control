import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { custodiaReceitaRepository, clienteRepository } from '../../services/repositories';
import { custodiaReceitaSchema, type CustodiaReceita, type CustodiaReceitaInput, type Cliente } from '../../domain/types';
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
import { Input, Select, PeriodFilter } from '../../components/shared/FormFields';

export default function CustodiaReceitaPage() {
  const { user } = useAuth();
  const [registros, setRegistros] = useState<CustodiaReceita[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
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
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [registroData, clienteData] = await Promise.all([
          custodiaReceitaRepository.getByMonth(user.uid, mesFiltro, anoFiltro),
          clienteRepository.getAll(user.uid),
        ]);
        setRegistros(registroData);
        setClientes(clienteData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, mesFiltro, anoFiltro]);

  const clienteOptions = useMemo(
    () => [
      { value: '', label: 'Geral (sem cliente)' },
      ...clientes.map((c) => ({ value: c.id || '', label: c.nome })),
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
    if (!user) return;

    try {
      setSaving(true);
      const parsed = custodiaReceitaSchema.parse(data);

      const cliente = clientes.find((c) => c.id === parsed.clienteId);
      const dataWithCliente = {
        ...parsed,
        clienteNome: cliente?.nome || 'Geral',
      };

      if (selectedRegistro?.id) {
        const updated = await custodiaReceitaRepository.update(selectedRegistro.id, dataWithCliente, user.uid);
        if (updated) {
          setRegistros((prev) =>
            prev.map((r) => (r.id === selectedRegistro.id ? updated : r))
          );
          toast.success('Registro atualizado com sucesso!');
        }
      } else {
        const created = await custodiaReceitaRepository.create(dataWithCliente, user.uid);
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
    if (!user || !selectedRegistro?.id) return;

    try {
      setSaving(true);
      await custodiaReceitaRepository.delete(selectedRegistro.id, user.uid);
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
    const receitaTotal = calcularReceitaTotal(registros);
    const captacaoTotal = calcularCaptacaoTotal(registros);
    const custodiaMedia = registros.reduce((sum, r) => sum + ((r.custodiaInicio + r.custodiaFim) / 2), 0);
    const roaMedio = custodiaMedia > 0 ? (receitaTotal / custodiaMedia) * 100 : 0;

    return {
      registros: registros.length,
      custodiaTotal,
      receitaTotal,
      captacaoTotal,
      roaMedio,
    };
  }, [registros]);

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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <p className="text-sm text-gray-600">Receita Total</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totais.receitaTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">ROA Médio</p>
          <p className="text-2xl font-bold text-purple-600">{formatPercent(totais.roaMedio)}</p>
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
            <Select
              label="Cliente"
              options={clienteOptions}
              {...register('clienteId')}
              error={errors.clienteId?.message}
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
