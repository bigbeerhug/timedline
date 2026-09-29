import { useEffect, useState } from "react";
import { supabaseClient } from "../services/storage/supabase";

export default function AuthGate() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabaseClient.auth.getUser();

      if (!mounted) return;
      setUser(authUser || null);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);
    if (error) setMessage(error.message);
  };

  const signOut = async () => {
    await supabaseClient.auth.signOut();
    setUser(null);
    setMenuOpen(false);
  };

  if (user) {
    const display =
      user.email?.length > 24 ? `${user.email.slice(0, 24)}…` : user.email;

    return (
      <div className="auth-shell">
        <button
          type="button"
          className="auth-pill"
          onClick={() => setMenuOpen((v) => !v)}
          title={user.email}
          aria-expanded={menuOpen}
        >
          <span className="auth-dot" aria-hidden="true" />
          <span style={{ fontSize: 13 }}>{display}</span>
          <span style={{ fontSize: 16, lineHeight: 1 }}>
            {menuOpen ? "▴" : "▾"}
          </span>
        </button>

        {menuOpen && (
          <div className="auth-panel">
            <div className="auth-panel__identity">
              Signed in as <strong>{user.email}</strong>
            </div>
            <button type="button" onClick={signOut}>Sign out</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <button
        type="button"
        className="auth-pill"
        onClick={() => setMenuOpen((value) => !value)}
        aria-expanded={menuOpen}
      >
        <span className="auth-dot" aria-hidden="true" />
        Sign in
        <span aria-hidden="true">{menuOpen ? "▴" : "▾"}</span>
      </button>
      {menuOpen && (
        <form className="auth-panel" onSubmit={signIn}>
          <h2>Keep your vault close.</h2>
          <p>Sign in to preserve memories in your private cloud vault.</p>
          <div className="auth-panel__fields">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
            />
            {message && (
              <div role="alert" className="auth-panel__error">
                {message}
              </div>
            )}
            <button type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
