import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { TrendingUp } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const registerSchema = loginSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register: registerUser } = useAuth();
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

  const onLogin = async (data: LoginForm) => {
    try {
      setLoading(true);
      await login(data.email, data.password);
      toast.success('Login realizado com sucesso!');
      navigate(returnTo);
    } catch (error: unknown) {
      console.error('Erro no login:', error);
      const authError = error as { code?: string };
      const message = authError.code === 'auth/invalid-credential'
        ? 'Email ou senha incorretos'
        : authError.code === 'auth/user-not-found'
        ? 'Usuário não encontrado'
        : 'Erro ao fazer login';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (data: RegisterForm) => {
    try {
      setLoading(true);
      await registerUser(data.email, data.password);
      toast.success('Conta criada com sucesso!');
      navigate(returnTo);
    } catch (error: unknown) {
      console.error('Erro no cadastro:', error);
      const authError = error as { code?: string };
      const message = authError.code === 'auth/email-already-in-use'
        ? 'Este email já está em uso'
        : authError.code === 'auth/weak-password'
        ? 'Senha muito fraca'
        : 'Erro ao criar conta';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Metas Profissionais</h1>
          <p className="text-gray-600 mt-2">
            {isRegister ? 'Crie sua conta' : 'Acesse sua conta'}
          </p>
        </div>

        {!isRegister ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                {...loginForm.register('email')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="seu@email.com"
              />
              {loginForm.formState.errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                {...loginForm.register('password')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="********"
              />
              {loginForm.formState.errors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                {...registerForm.register('email')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="seu@email.com"
              />
              {registerForm.formState.errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {registerForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                {...registerForm.register('password')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="********"
              />
              {registerForm.formState.errors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {registerForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar Senha
              </label>
              <input
                type="password"
                {...registerForm.register('confirmPassword')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="********"
              />
              {registerForm.formState.errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {registerForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {isRegister
              ? 'Já tem uma conta? Faça login'
              : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
}

