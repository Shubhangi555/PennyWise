import { useState } from 'react';
import { useAuth } from '../context/auth-context';
import api from '../api/axios';
import { getErrorMessage } from '../lib/errors';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // api instance already has baseURL set — just need the path
      const res = await api.post(`/auth/${mode}`, {
        username,
        password,
        ...(mode === 'register' && { displayName }), // only send displayName on register
      });
      login(res.data.token, res.data.user); // save token + user to context + localStorage
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <a className="brand" href="#auth" aria-label="Pennywise home"><span className="brand-mark" aria-hidden="true">P</span><span>Pennywise</span></a>
        <div className="auth-message">
          <p className="auth-kicker">A LITTLE MORE CLARITY</p>
          <h1>Make your money make sense.</h1>
          <p>Keep everyday spending and income in one calm, clear place.</p>
        </div>
        <p className="auth-footnote">Your personal finance, at your pace.</p>
      </section>
      <section className="auth-main" id="auth">
        <div className="auth-card">
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-subtitle">{mode === 'login' ? 'Sign in to see your financial overview.' : 'Start building a clearer picture of your money.'}</p>
          <div className="auth-tabs" role="tablist" aria-label="Account access">
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setError(''); }}
              className={mode === m ? 'auth-tab active' : 'auth-tab'}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <input
              placeholder="Display Name"
              aria-label="Display name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              autoComplete="name"
              maxLength={100}
            />
          )}
          <input
            type="text"
            placeholder="Username"
            aria-label="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
          <input
            type="password"
            placeholder={mode === 'register' ? 'Password (8+ characters)' : 'Password'}
            aria-label="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'register' ? 8 : undefined}
            maxLength={72}
            required
          />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
      </section>
    </main>
  );
}
