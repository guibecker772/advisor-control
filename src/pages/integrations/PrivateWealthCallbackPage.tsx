import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui';
import { consumePrivateWealthCallback } from '../../services/privateWealthIntegration';

type CallbackStatus = 'processing' | 'expired' | 'invalid' | 'error';

function resolveAdvisorHomeUrl(): string {
  return '/clientes';
}

function buildLoginReturnTo(pathname: string, search: string): string {
  const fullPath = `${pathname}${search}`;
  return `/login?returnTo=${encodeURIComponent(fullPath)}`;
}

export default function PrivateWealthCallbackPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>('processing');

  const linkKey = searchParams.get('linkKey') || '';
  const pwClientId = searchParams.get('pwClientId') || '';

  const title = useMemo(() => {
    if (status === 'processing') return 'Vinculando cliente';
    if (status === 'expired') return 'Sessao expirada';
    if (status === 'invalid') return 'Link invalido';
    return 'Nao foi possivel vincular';
  }, [status]);

  const description = useMemo(() => {
    if (status === 'processing') return 'Aguarde enquanto finalizamos a vinculacao e abrimos o Private Wealth.';
    if (status === 'expired') return 'A sessao de vinculacao expirou ou ja foi utilizada.';
    if (status === 'invalid') return 'Parametros de vinculacao ausentes ou invalidos.';
    return 'Tente novamente a partir do Advisor Control.';
  }, [status]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    let cancelled = false;

    const processCallback = async () => {
      if (!linkKey || !pwClientId) {
        setStatus('invalid');
        return;
      }

      try {
        const result = await consumePrivateWealthCallback(linkKey, pwClientId, user);
        if (!result.ok) {
          if (result.reason === 'expired' || result.reason === 'used') {
            setStatus('expired');
          } else if (result.reason === 'invalid') {
            setStatus('invalid');
          } else {
            setStatus('error');
          }
          return;
        }

        if (cancelled) return;
        window.location.replace(result.openUrl);
      } catch (error) {
        console.error('Erro ao processar callback do Private Wealth:', error);
        if (!cancelled) {
          setStatus('error');
        }
      }
    };

    void processCallback();

    return () => {
      cancelled = true;
    };
  }, [linkKey, loading, pwClientId, user]);

  if (!loading && !user) {
    return (
      <Navigate
        to={buildLoginReturnTo(location.pathname, location.search)}
        replace
      />
    );
  }

  return (
    <div className="min-h-screen px-6 py-12 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div
        className="w-full max-w-xl rounded-2xl p-8 space-y-5"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
            {title}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {description}
          </p>
        </div>

        {status === 'processing' && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processando callback...
          </div>
        )}

        {status !== 'processing' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => {
                window.location.assign(resolveAdvisorHomeUrl());
              }}
            >
              Voltar ao Advisor Control
            </Button>
            <Button
              variant="ghost"
              leftIcon={<ExternalLink className="w-4 h-4" />}
              onClick={() => {
                window.location.assign('/clientes');
              }}
            >
              Ir para Clientes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
