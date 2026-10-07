import type { SupabaseClient } from '@supabase/supabase-js';
import { useState, type FormEvent } from 'react';

interface AccountAccessProps {
  client: SupabaseClient;
}

export function AccountAccess({ client }: AccountAccessProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleGoogleSignIn = async () => {
    setPending(true);
    setMessage('');
    setError('');

    try {
      const { error: oauthError } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) setError(oauthError.message);
    } catch (oauthError) {
      setError(oauthError instanceof Error ? oauthError.message : 'No se pudo iniciar sesión con Google.');
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setError('');

    const result = mode === 'sign-in'
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password });

    setPending(false);
    if (result.error) {
      setError(result.error.message);
    } else if (mode === 'sign-up' && !result.data.session) {
      setMessage('Cuenta creada. Revisa tu correo para confirmar el registro.');
    }
  };

  const changeMode = (nextMode: 'sign-in' | 'sign-up') => {
    setMode(nextMode);
    setMessage('');
    setError('');
  };

  return (
    <section className="account-panel" aria-labelledby="account-title">
      <p className="eyebrow">TU BIBLIOTECA PERSONAL</p>
      <h2 id="account-title">{mode === 'sign-in' ? 'Inicia sesión' : 'Crea tu cuenta'}</h2>
      <p className="account-description">Tu lista se guardará en la nube y estará disponible al iniciar sesión desde otro dispositivo.</p>

      <button className="google-sign-in" type="button" onClick={() => { void handleGoogleSignIn(); }} disabled={pending}>
        {pending ? 'Conectando…' : 'Continuar con Google'}
      </button>
      <p className="account-divider"><span>o usa tu correo</span></p>

      <div className="account-tabs" role="group" aria-label="Acceso a la cuenta">
        <button className={mode === 'sign-in' ? 'is-active' : ''} type="button" onClick={() => changeMode('sign-in')}>Iniciar sesión</button>
        <button className={mode === 'sign-up' ? 'is-active' : ''} type="button" onClick={() => changeMode('sign-up')}>Crear cuenta</button>
      </div>

      <form className="account-form" onSubmit={handleSubmit}>
        <label htmlFor="account-email">Correo electrónico</label>
        <input
          id="account-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="account-password">Contraseña</label>
        <input
          id="account-password"
          type="password"
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? 'Procesando…' : mode === 'sign-in' ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>
      </form>

      {message && <p className="account-message" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}