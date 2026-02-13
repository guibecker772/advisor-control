export type PerfilInvestidor = 'Regular' | 'Qualificado' | 'Profissional';
export type PerfilFiltro = 'all' | PerfilInvestidor;

export function parsePerfilFiltro(value: string | null | undefined): PerfilFiltro | null {
  if (!value) return null;

  switch (value.trim().toLowerCase()) {
    case 'all':
      return 'all';
    case 'regular':
      return 'Regular';
    case 'qualificado':
      return 'Qualificado';
    case 'profissional':
      return 'Profissional';
    default:
      return null;
  }
}

export function parsePerfilFromQuery(value: string | null | undefined): PerfilFiltro | null {
  return parsePerfilFiltro(value);
}
