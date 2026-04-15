import { useEffect, useState } from "react";
import {
  getDevUser,
  setDevUser,
  clearDevUser,
  supabaseClient,
} from "../services/storage/supabase";

const DEV_USER = {
  id: "3b022637-69ee-44eb-a3e9-0dd43810c331",
  email: "paulson3680@gmail.com",
};

export default function DevAuthGate() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabaseClient.auth.getUser();

      if (!mounted) return;
      setUser(authUser || getDevUser());
    }

    loadUser();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || getDevUser());
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = () => {
    if (!import.meta.env.DEV) return;
    setDevUser(DEV_USER);
    setUser(DEV_USER);
    setMenuOpen(false);
  };

  const signOut = async () => {
    clearDevUser();
    await supabaseClient.auth.signOut();
    setUser(null);
    setMenuOpen(false);
  };

  if (!import.meta.env.DEV && !user) return null;

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
              {import.meta.env.DEV ? (
                <>
                  Local dev mode as <strong>{user.email}</strong>
                </>
              ) : (
                <>
                  Signed in as <strong>{user.email}</strong>
                </>
              )}
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
      <div style={panel}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            Timedline local dev sign-in
          </div>
          <div style={{ fontSize: 12, color: "#374151" }}>
            This bypasses Supabase Auth for now and uses your restored data.
          </div>
          <button
            type="button"
            onClick={signIn}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#e5f3ff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}