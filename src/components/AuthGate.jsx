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

  const shell = { position: "fixed", top: 8, right: 8, zIndex: 50 };
  const panel = {
    background: "#ffffffcc",
    backdropFilter: "blur(2px)",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12,
    boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
    maxWidth: 380,
  };
  const pill = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    background: "#ffffffcc",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
  };

  if (user) {
    const display =
      user.email?.length > 24 ? `${user.email.slice(0, 24)}…` : user.email;

    return (
      <div style={shell}>
        <div
          style={pill}
          onClick={() => setMenuOpen((v) => !v)}
          title={user.email}
        >
          <span role="img" aria-label="user">
            👤
          </span>
          <span style={{ fontSize: 13 }}>{display}</span>
          <span style={{ fontSize: 16, lineHeight: 1 }}>
            {menuOpen ? "▴" : "▾"}
          </span>
        </div>

        {menuOpen && (
          <div style={{ ...panel, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#374151", marginBottom: 8 }}>
              Signed in as <strong>{user.email}</strong>
            </div>
            <button
              onClick={signOut}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={shell}>
      <form style={panel} onSubmit={signIn}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            Sign in to Timedline
          </div>
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
            <div role="alert" style={{ fontSize: 12, color: "#991b1b" }}>
              {message}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#e5f3ff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
