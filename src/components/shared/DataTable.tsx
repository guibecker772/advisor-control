import { type ReactNode, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  pageSize?: number;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  sortingState?: SortingState;
  onSortingChange?: (value: SortingState) => void;
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Buscar...',
  pageSize = 10,
  searchValue,
  onSearchChange,
  sortingState,
  onSortingChange,
}: DataTableProps<T>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalGlobalFilter, setInternalGlobalFilter] = useState('');

  const sorting = sortingState ?? internalSorting;
  const globalFilter = searchValue ?? internalGlobalFilter;

  const handleSortingChange = (nextSorting: SortingState) => {
    if (onSortingChange) {
      onSortingChange(nextSorting);
      return;
    }
    setInternalSorting(nextSorting);
  };

  const handleGlobalFilterChange = (nextFilter: string) => {
    if (onSearchChange) {
      onSearchChange(nextFilter);
      return;
    }
    setInternalGlobalFilter(nextFilter);
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: (updater) => {
      const nextValue =
        typeof updater === 'function'
          ? updater(sorting)
          : updater;
      handleSortingChange(nextValue);
    },
    onGlobalFilterChange: (updater) => {
      const nextValue =
        typeof updater === 'function'
          ? updater(globalFilter)
          : updater;
      handleGlobalFilterChange(nextValue as string);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={(e) => handleGlobalFilterChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="focus-gold w-full rounded-md border px-4 py-2 pl-10 text-sm"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </div>
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {table.getFilteredRowModel().rows.length} registro(s)
        </div>
      </div>

      <div
        className="overflow-x-auto rounded-xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <table className="min-w-full">
          <thead style={{ backgroundColor: 'var(--color-surface-2)' }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="hover-light px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center space-x-1">
                      <span>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </span>
                      {header.column.getCanSort() && (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronsUpDown className="w-4 h-4" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody style={{ backgroundColor: 'var(--color-surface)' }}>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover-light transition-colors"
                  style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-6 py-4 whitespace-nowrap text-sm"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {(['<<', '<', '>', '>>'] as const).map((label) => {
            const actionMap = {
              '<<': () => table.setPageIndex(0),
              '<': () => table.previousPage(),
              '>': () => table.nextPage(),
              '>>': () => table.setPageIndex(table.getPageCount() - 1),
            };
            const disabledMap = {
              '<<': !table.getCanPreviousPage(),
              '<': !table.getCanPreviousPage(),
              '>': !table.getCanNextPage(),
              '>>': !table.getCanNextPage(),
            };
            return (
              <button
                key={label}
                type="button"
                onClick={actionMap[label]}
                disabled={disabledMap[label]}
                className="focus-gold hover-light rounded px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Ir para ${label === '<<'
                  ? 'a primeira página'
                  : label === '<'
                    ? 'a página anterior'
                    : label === '>'
                      ? 'a próxima página'
                      : 'a última página'}`}
                style={{
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'transparent',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Página {table.getState().pagination.pageIndex + 1} de{' '}
          {table.getPageCount()}
        </span>

        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="px-2 py-1 rounded text-sm"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        >
          {[10, 20, 30, 50].map((size) => (
            <option key={size} value={size}>
              {size} por página
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Componentes auxiliares para células da tabela
export function CurrencyCell({ value }: { value: number }) {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);

  return (
    <span style={value < 0 ? { color: 'var(--color-danger)' } : undefined}>
      {formatted}
    </span>
  );
}

export function PercentCell({ value }: { value: number }) {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((value || 0) / 100);

  return (
    <span style={value < 0 ? { color: 'var(--color-danger)' } : undefined}>
      {formatted}
    </span>
  );
}

export function StatusBadge({
  status,
  variant = 'default',
}: {
  status: string;
  variant?: 'success' | 'warning' | 'danger' | 'default';
}) {
  const styles: Record<string, React.CSSProperties> = {
    success: {
      backgroundColor: 'var(--color-success-bg)',
      color: 'var(--color-success)',
    },
    warning: {
      backgroundColor: 'var(--color-warning-bg)',
      color: 'var(--color-warning)',
    },
    danger: {
      backgroundColor: 'var(--color-danger-bg)',
      color: 'var(--color-danger)',
    },
    default: {
      backgroundColor: 'var(--color-surface-2)',
      color: 'var(--color-text-secondary)',
    },
  };

  return (
    <span
      className="px-2 py-1 text-xs font-medium rounded-full inline-block"
      style={styles[variant]}
    >
      {status}
    </span>
  );
}

export function ActionButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}): ReactNode {
  return (
    <div className="flex space-x-2">
      <button
        type="button"
        onClick={onEdit}
        className="focus-gold rounded-sm text-sm font-medium transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-info)' }}
      >
        Editar
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="focus-gold rounded-sm text-sm font-medium transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-danger)' }}
      >
        Excluir
      </button>
    </div>
  );
}
