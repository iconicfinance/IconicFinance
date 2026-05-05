import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, lang, setLang } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || t('Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-2xl p-8">

          {/* Language toggle */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="px-3 py-1 text-sm font-semibold border border-border rounded-md hover:bg-muted transition-colors"
            >
              {lang === 'en' ? 'ع العربية' : 'EN English'}
            </button>
          </div>

          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img
                src="/logos/iconic-finance.png"
                alt="Iconic Finance"
                className="w-24 h-24 rounded-full object-cover shadow-md"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <h1 className="text-3xl font-bold text-primary mb-1">Iconic Finance</h1>
            <p className="text-muted-foreground text-sm">{t('Clinic Finance Management System')}</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('Username')}
              </label>
              <Input
                type="text"
                placeholder={t('Enter your username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full"
                autoComplete="username"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('Password')}
              </label>
              <Input
                type="password"
                placeholder={t('Enter your password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full"
                autoComplete="current-password"
                dir="ltr"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 me-2 animate-spin" />
                  {t('Signing in...')}
                </>
              ) : (
                t('Sign In')
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}
