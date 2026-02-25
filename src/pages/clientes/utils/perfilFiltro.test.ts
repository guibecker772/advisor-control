import { describe, expect, it } from 'vitest';
import { parsePerfilFiltro, parsePerfilFromQuery } from './perfilFiltro';

describe('perfilFiltro parsing', () => {
  it('accepts known values case-insensitively', () => {
    expect(parsePerfilFromQuery('Qualificado')).toBe('Qualificado');
    expect(parsePerfilFromQuery('profissional')).toBe('Profissional');
    expect(parsePerfilFromQuery('ALL')).toBe('all');
  });

  it('returns null for invalid values', () => {
    expect(parsePerfilFromQuery('investidor')).toBeNull();
    expect(parsePerfilFiltro('')).toBeNull();
    expect(parsePerfilFiltro(null)).toBeNull();
  });
});
