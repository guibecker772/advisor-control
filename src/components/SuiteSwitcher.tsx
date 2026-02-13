import advisorControlMark from '../assets/brand/advisor-control-mark.svg';

export type SuiteSwitcherSuite = 'advisor' | 'pw';

interface SuiteSwitcherProps {
  current: SuiteSwitcherSuite;
  className?: string;
}

export default function SuiteSwitcher({ current, className = '' }: SuiteSwitcherProps) {
  const privateWealthUrl = (import.meta.env.VITE_PRIVATE_WEALTH_BASE_URL ?? '').trim();
  const isPrivateWealthConfigured = privateWealthUrl.length > 0;

  const handleOpenPrivateWealth = () => {
    if (!isPrivateWealthConfigured) return;
    window.open(privateWealthUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={className}>
      <div
        role="group"
        aria-label="Selecionar ferramenta da suite"
        className="grid grid-cols-2 gap-2 rounded-xl p-1"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
        }}
      >
        <button
          type="button"
          aria-label="Advisor Control"
          aria-current={current === 'advisor' ? 'page' : undefined}
          className="focus-gold flex items-center gap-2 rounded-lg px-3 py-2 text-left"
          style={{
            backgroundColor: current === 'advisor' ? 'var(--color-gold-bg)' : 'transparent',
            color: current === 'advisor' ? 'var(--color-gold)' : 'var(--color-text-secondary)',
            border: current === 'advisor' ? '1px solid var(--color-gold)' : '1px solid transparent',
          }}
        >
          <img src={advisorControlMark} alt="" aria-hidden="true" className="h-5 w-5 rounded-md" />
          <span className="text-xs font-semibold uppercase tracking-wide">Advisor</span>
        </button>

        <button
          type="button"
          onClick={handleOpenPrivateWealth}
          disabled={!isPrivateWealthConfigured}
          aria-disabled={!isPrivateWealthConfigured}
          aria-label="Abrir Private Wealth"
          title={!isPrivateWealthConfigured ? 'Configurar URL do Private Wealth' : 'Abrir Private Wealth'}
          className={`
            focus-gold flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors
            ${isPrivateWealthConfigured ? 'hover:bg-[var(--color-surface-hover)]' : 'cursor-not-allowed opacity-70'}
          `}
          style={{
            backgroundColor: current === 'pw' ? 'var(--color-gold-bg)' : 'transparent',
            color: current === 'pw' ? 'var(--color-gold)' : 'var(--color-text-secondary)',
            border: current === 'pw' ? '1px solid var(--color-gold)' : '1px solid transparent',
          }}
        >
          <span
            aria-hidden="true"
            className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold"
            style={{
              backgroundColor: 'rgba(126, 208, 255, 0.2)',
              color: '#7ED0FF',
            }}
          >
            PW
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide">Private Wealth</span>
        </button>
      </div>

      {!isPrivateWealthConfigured && (
        <p className="mt-2 text-xs" style={{ color: '#7ED0FF' }}>
          Configurar URL do Private Wealth
        </p>
      )}
    </div>
  );
}
