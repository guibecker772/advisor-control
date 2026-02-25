interface FirebaseConfigErrorScreenProps {
  missingVars: string[];
}

export default function FirebaseConfigErrorScreen({ missingVars }: FirebaseConfigErrorScreenProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-6 md:p-8"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
          Configuracao do Firebase ausente
        </h1>
        <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
          Para iniciar o app, configure as variaveis no arquivo <code>.env.local</code> na raiz do projeto
          (mesma pasta do <code>vite.config.ts</code>) e reinicie o servidor de desenvolvimento.
        </p>

        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
            Variaveis faltando:
          </p>
          <ul className="space-y-2">
            {missingVars.map((variableName) => (
              <li
                key={variableName}
                className="text-sm font-mono px-3 py-2 rounded-lg"
                style={{
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-surface-3)',
                }}
              >
                {variableName}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
