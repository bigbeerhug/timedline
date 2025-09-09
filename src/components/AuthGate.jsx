// src/components/AuthGate.jsx
import { useEffect, useState } from "react";
import { supabaseClient as supabase } from "../services/storage/supabase";

// Used ONLY when you click “Magic link”
const REDIRECT = (import.meta.env.VITE_REDIRECT_URL || "").trim();

export default function AuthGate() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(""); // 6-digit email code
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(""); // info/error
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // for compact signed-in view

  // On mount: if you used a magic link, exchange ?code=… for a session. Then fetch current user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fullUrl = window.location.href;

        // PKCE code may come in search params or hash
        const urlObj = new URL(fullUrl);
        const hasCodeQuery = urlObj.searchParams.get("code");
        const hashParams = new URLSearchParams(
          fullUrl.includes("#") ? fullUrl.slice(fullUrl.indexOf("#") + 1) : ""
        );
        const hasCodeHash = hashParams.get("code");
        const hasCode = hasCodeQuery || hasCodeHash;

        if (hasCode) {
          setStatus("Completing sign-in…");
          const { error } = await supabase.auth.exchangeCodeForSession(fullUrl);
          if (error) setStatus(`Sign-in failed: ${error.message}`);
          else setStatus("Signed in!");

          // Clean URL
          try {
            urlObj.searchParams.delete("code");
            urlObj.searchParams.delete("type");
            const clean = urlObj.pathname + (urlObj.search || "");
            window.history.replaceState({}, document.title, clean);
          } catch {}
        }

        // Current user
        const { data, error } = await supabase.auth.getUser();
        if (!cancelled) {
          if (error) setUser(null);
          else {
            setUser(data?.user || null);
            setEmail(data?.user?.email || "");
            if (data?.user?.email) setStatus("");
          }
        }
      } catch (e) {
        if (!cancelled) setStatus(e?.message || String(e));
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user?.email) setStatus("");
    });

    return () => {
      cancelled = true;
      try {
        sub?.subscription?.unsubscribe?.();
      } catch {}
    };
  }, []);

  // --- Email CODE flow (recommended; no redirect required) ---
  const sendCode = async (e) => {
    e.preventDefault();
    setStatus("");
    if (!email) return setStatus("Enter your email.");

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true }, // creates user if not exists
      });
      if (error) setStatus(`Could not send code: ${error.message}`);
      else setStatus(`Code sent to ${email}. Check your email.`);
    } catch (err) {
      setStatus(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setStatus("");
    if (!email) return setStatus("Enter your email.");
    if (!code || code.length < 6) return setStatus("Enter the 6-digit code.");

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email", // verifying 6-digit email code
      });
      if (error) setStatus(`Verify failed: ${error.message}`);
      else if (data?.user) {
        setStatus("Signed in!");
        setUser(data.user);
        setMenuOpen(false);
      } else {
        setStatus("Verify failed: no user returned.");
      }
    } catch (err) {
      setStatus(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  // --- MAGIC LINK flow (optional; uses your hosted redirect origin) ---
  const sendMagicLink = async (e) => {
    e.preventDefault();
    setStatus("");
    if (!email) return setStatus("Enter your email.");
    if (!REDIRECT) return setStatus("Magic link requires VITE_REDIRECT_URL.");

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: REDIRECT, shouldCreateUser: true },
      });
      if (error) setStatus(`Could not send link: ${error.message}`);
      else setStatus(`Magic link sent to ${email}.`);
    } catch (err) {
      setStatus(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setStatus("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setStatus(error.message);
      setMenuOpen(false);
    } finally {
      setBusy(false);
    }
  };

  // Styles
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
    // Compact pill when signed in
    const display = user.email?.length > 24 ? user.email.slice(0, 24) + "…" : user.email;
    return (
      <div style={shell}>
        <div style={pill} onClick={() => setMenuOpen((v) => !v)} title={user.email}>
          <span role="img" aria-label="user">👤</span>
          <span style={{ fontSize: 13 }}>{display}</span>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{menuOpen ? "▴" : "▾"}</span>
        </div>
        {menuOpen && (
          <div style={{ ...panel, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#374151", marginBottom: 8 }}>
              Signed in as <strong>{user.email}</strong>
            </div>
            <button
              onClick={signOut}
              disabled={busy}
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

  // Not signed in → code flow UI + optional magic link button
  return (
    <div style={shell}>
      <div style={panel}>
        <form onSubmit={verifyCode} style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Sign in</div>
          <input
            type="email"
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#f9fafb",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {busy ? "Sending…" : "Send code"}
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{
                flex: 1,
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: "6px 8px",
                fontVariantNumeric: "tabular-nums",
              }}
            />
            <button
              type="submit"
              disabled={busy}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#e5f3ff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Verify
            </button>
          </div>

          {/* Optional fallback */}
          <button
            type="button"
            onClick={sendMagicLink}
            disabled={busy}
            style={{
              marginTop: 4,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #eee",
              background: "#fff",
              cursor: "pointer",
              fontSize: 12,
              color: "#374151",
            }}
            title="Requires VITE_REDIRECT_URL to be your hosted origin"
          >
            Or use Magic link
          </button>

          {status && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#374151" }}>{status}</div>
          )}
        </form>
      </div>
    </div>
  );
}
