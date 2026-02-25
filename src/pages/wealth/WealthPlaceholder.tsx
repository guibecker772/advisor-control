import { Gem, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BaseCard, Button } from '../../components/ui';

export default function WealthPlaceholder() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <BaseCard className="max-w-md text-center" padding="lg">
        <div 
          className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
          style={{ 
            backgroundColor: 'var(--color-gold-bg)',
          }}
        >
          <Gem 
            className="w-8 h-8" 
            style={{ color: 'var(--color-gold)' }}
          />
        </div>
        
        <h1 
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text)' }}
        >
          Private Wealth
        </h1>
        
        <p 
          className="text-sm mb-6"
          style={{ color: 'var(--color-text-muted)' }}
        >
          O módulo de Planejamento Patrimonial será integrado em breve. 
          Você poderá gerenciar cenários, metas, sucessão e muito mais 
          diretamente aqui no Advisor Control.
        </p>

        <div 
          className="p-4 rounded-lg mb-6"
          style={{ backgroundColor: 'var(--color-surface-2)' }}
        >
          <p 
            className="text-xs font-medium uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-gold)' }}
          >
            Em desenvolvimento
          </p>
          <ul 
            className="text-sm text-left space-y-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <li>✓ Visão Executiva do cliente</li>
            <li>✓ Simulação de cenários</li>
            <li>✓ Planejamento sucessório</li>
            <li>✓ Guia de alocação</li>
            <li>✓ Metas & Objetivos</li>
          </ul>
        </div>

        <Button
          variant="secondary"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/')}
        >
          Voltar ao Advisor Control
        </Button>
      </BaseCard>
    </div>
  );
}
