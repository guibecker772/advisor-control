import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '../../components/ui/Button';
import SuiteSwitcher from '../../components/SuiteSwitcher';
import { useAuth } from '../../contexts/AuthContext';
import advisorControlLogo from '../../assets/brand/advisor-control-logo.svg';
import advisorControlMark from '../../assets/brand/advisor-control-mark.svg';

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha deve ter no minimo 6 caracteres'),
});

const registerSchema = loginSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas nao conferem',
    path: ['confirmPassword'],
  });

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type PendingAction = 'email' | 'google' | null;

type AuthErrorLike = {
  code?: string;
  message?: string;
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email ou senha invalidos.',
  'auth/user-not-found': 'Email ou senha invalidos.',
  'auth/wrong-password': 'Email ou senha invalidos.',
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/unauthorized-domain': 'Dominio nao autorizado no Firebase. Verifique Authorized domains.',
  'auth/email-already-in-use': 'Este email ja esta em uso.',
  'auth/weak-password': 'Senha muito fraca. Use ao menos 6 caracteres.',
};

const DEFAULT_AUTH_ERROR_MESSAGE = 'Nao foi possivel entrar. Tente novamente.';

function resolveAuthErrorMessage(error: unknown): string {
  const authError = error as AuthErrorLike;
  if (authError?.code && AUTH_ERROR_MESSAGES[authError.code]) {
    return AUTH_ERROR_MESSAGES[authError.code];
  }

  if (typeof authError?.message === 'string' && authError.message.trim().length > 0) {
    return authError.message;
  }

  return DEFAULT_AUTH_ERROR_MESSAGE;
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M23.52 12.27C23.52 11.46 23.45 10.69 23.32 9.95H12V14.56H18.47C18.19 16.04 17.34 17.3 16.08 18.15V21.13H19.92C22.17 19.06 23.52 15.99 23.52 12.27Z"
        fill="#4285F4"
      />
      <path
        d="M12 24C15.24 24 17.95 22.93 19.92 21.13L16.08 18.15C15.01 18.87 13.64 19.3 12 19.3C8.88 19.3 6.22 17.2 5.28 14.37H1.31V17.45C3.27 21.33 7.29 24 12 24Z"
        fill="#34A853"
      />
      <path
        d="M5.28 14.37C5.04 13.65 4.9 12.87 4.9 12C4.9 11.13 5.04 10.35 5.28 9.63V6.55H1.31C0.49 8.18 0 10.03 0 12C0 13.97 0.49 15.82 1.31 17.45L5.28 14.37Z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.7C13.79 4.7 15.39 5.32 16.65 6.51L20.01 3.15C17.95 1.18 15.24 0 12 0C7.29 0 3.27 2.67 1.31 6.55L5.28 9.63C6.22 6.8 8.88 4.7 12 4.7Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login, register: registerUser, loginGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const returnTo = (() => {
    const value = searchParams.get('returnTo');
    if (!value || !value.startsWith('/')) return '/';
    return value;
  })();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const isSubmitting = pendingAction !== null;

  const onLogin = async (data: LoginForm) => {
    setAuthError(null);
    setPendingAction('email');
    try {
      await login(data.email, data.password);
      toast.success('Login realizado com sucesso.');
      navigate(returnTo);
    } catch (error: unknown) {
      const message = resolveAuthErrorMessage(error);
      setAuthError(message);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  };

  const onRegister = async (data: RegisterForm) => {
    setAuthError(null);
    setPendingAction('email');
    try {
      await registerUser(data.email, data.password);
      toast.success('Conta criada com sucesso.');
      navigate(returnTo);
    } catch (error: unknown) {
      const message = resolveAuthErrorMessage(error);
      setAuthError(message);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  };

  const onGoogleLogin = async () => {
    setAuthError(null);
    setPendingAction('google');
    try {
      await loginGoogle();
      toast.success('Login com Google realizado com sucesso.');
      navigate(returnTo);
    } catch (error: unknown) {
      const message = resolveAuthErrorMessage(error);
      setAuthError(message);
      if ((error as AuthErrorLike)?.code !== 'auth/popup-closed-by-user') {
        console.error('Erro no login com Google:', error);
      }
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  };

  const handleToggleMode = () => {
    setIsRegister((prev) => !prev);
    setAuthError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    loginForm.clearErrors();
    registerForm.clearErrors();
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(47,107,255,0.22), transparent 40%), radial-gradient(circle at 80% 10%, rgba(22,194,255,0.16), transparent 35%), var(--color-bg)',
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-24 -left-20 h-72 w-72 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(47, 107, 255, 0.22)' }}
        />
        <div
          className="absolute bottom-0 right-0 h-80 w-80 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(22, 194, 255, 0.18)' }}
        />
      </div>

      <div className="relative min-h-screen lg:grid lg:grid-cols-2">
        <section className="hidden lg:flex lg:flex-col lg:justify-between p-10 xl:p-14">
          <div className="max-w-lg">
            <img src={advisorControlLogo} alt="Advisor Control" className="h-14 w-auto" />
            <h1 className="mt-10 text-4xl font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>
              Controle comercial com foco em resultado e relacionamento.
            </h1>
            <p className="mt-4 text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Centralize metas, captacao, agendas e oportunidades em um fluxo unico para o assessor.
            </p>
          </div>

          <div className="space-y-3">
            {[
              'Visao consolidada de performance e metas.',
              'Planejamento com dados confiaveis e atualizados.',
              'Rotina comercial com mais previsibilidade.',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  backgroundColor: 'rgba(49,58,72,0.6)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <CheckCircle2 className="h-4 w-4" style={{ color: '#7ED0FF' }} />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-4 sm:p-8 lg:p-10">
          <div
            className="w-full max-w-md rounded-2xl p-6 sm:p-8 backdrop-blur-sm"
            style={{
              backgroundColor: 'rgba(42, 50, 62, 0.88)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <SuiteSwitcher current="advisor" className="mb-5" />

            <div className="mb-6 flex items-center gap-3">
              <img src={advisorControlMark} alt="Advisor Control" className="h-11 w-11 rounded-xl" />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Advisor Control
                </p>
                <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
                  {isRegister ? 'Criar conta' : 'Entrar na plataforma'}
                </h2>
              </div>
            </div>

            {authError && (
              <div
                role="alert"
                className="mb-5 rounded-xl px-3 py-2.5 text-sm"
                style={{
                  backgroundColor: 'var(--color-danger-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  color: '#FCA5A5',
                }}
              >
                {authError}
              </div>
            )}

            {!isRegister ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4" noValidate>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: 'var(--color-text-muted)' }}
                    />
                    <input
                      type="email"
                      autoComplete="email"
                      {...loginForm.register('email')}
                      disabled={isSubmitting}
                      placeholder="seu@email.com"
                      className="w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm transition-colors focus:outline-none"
                      style={{
                        backgroundColor: 'var(--color-surface-2)',
                        borderColor: loginForm.formState.errors.email ? 'var(--color-danger)' : 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                  </div>
                  {loginForm.formState.errors.email && (
                    <p className="mt-1.5 text-sm" style={{ color: 'var(--color-danger)' }}>
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Senha
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: 'var(--color-text-muted)' }}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      {...loginForm.register('password')}
                      disabled={isSubmitting}
                      placeholder="Sua senha"
                      className="w-full rounded-lg border py-2.5 pl-10 pr-11 text-sm transition-colors focus:outline-none"
                      style={{
                        backgroundColor: 'var(--color-surface-2)',
                        borderColor: loginForm.formState.errors.password ? 'var(--color-danger)' : 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      disabled={isSubmitting}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="mt-1.5 text-sm" style={{ color: 'var(--color-danger)' }}>
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button type="submit" fullWidth loading={pendingAction === 'email'} disabled={isSubmitting} className="h-11">
                  Entrar
                </Button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4" noValidate>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: 'var(--color-text-muted)' }}
                    />
                    <input
                      type="email"
                      autoComplete="email"
                      {...registerForm.register('email')}
                      disabled={isSubmitting}
                      placeholder="seu@email.com"
                      className="w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm transition-colors focus:outline-none"
                      style={{
                        backgroundColor: 'var(--color-surface-2)',
                        borderColor: registerForm.formState.errors.email ? 'var(--color-danger)' : 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                  </div>
                  {registerForm.formState.errors.email && (
                    <p className="mt-1.5 text-sm" style={{ color: 'var(--color-danger)' }}>
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Senha
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: 'var(--color-text-muted)' }}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      {...registerForm.register('password')}
                      disabled={isSubmitting}
                      placeholder="Crie uma senha"
                      className="w-full rounded-lg border py-2.5 pl-10 pr-11 text-sm transition-colors focus:outline-none"
                      style={{
                        backgroundColor: 'var(--color-surface-2)',
                        borderColor: registerForm.formState.errors.password ? 'var(--color-danger)' : 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      disabled={isSubmitting}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {registerForm.formState.errors.password && (
                    <p className="mt-1.5 text-sm" style={{ color: 'var(--color-danger)' }}>
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <ShieldCheck
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: 'var(--color-text-muted)' }}
                    />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      {...registerForm.register('confirmPassword')}
                      disabled={isSubmitting}
                      placeholder="Repita sua senha"
                      className="w-full rounded-lg border py-2.5 pl-10 pr-11 text-sm transition-colors focus:outline-none"
                      style={{
                        backgroundColor: 'var(--color-surface-2)',
                        borderColor: registerForm.formState.errors.confirmPassword
                          ? 'var(--color-danger)'
                          : 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-label={showConfirmPassword ? 'Ocultar confirmacao de senha' : 'Mostrar confirmacao de senha'}
                      disabled={isSubmitting}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="mt-1.5 text-sm" style={{ color: 'var(--color-danger)' }}>
                      {registerForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button type="submit" fullWidth loading={pendingAction === 'email'} disabled={isSubmitting} className="h-11">
                  Criar conta
                </Button>
              </form>
            )}

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
              <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                ou
              </span>
              <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
            </div>

            <Button
              type="button"
              variant="secondary"
              fullWidth
              className="h-11"
              leftIcon={<GoogleIcon />}
              onClick={onGoogleLogin}
              loading={pendingAction === 'google'}
              disabled={isSubmitting}
              aria-label="Continuar com Google"
            >
              Continuar com Google
            </Button>

            <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {isRegister ? 'Ja tem conta?' : 'Nao tem conta?'}{' '}
              <button
                type="button"
                onClick={handleToggleMode}
                className="font-semibold transition-colors"
                style={{ color: 'var(--color-gold)' }}
                disabled={isSubmitting}
              >
                {isRegister ? 'Fazer login' : 'Cadastre-se'}
              </button>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
