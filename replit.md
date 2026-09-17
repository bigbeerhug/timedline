# Timedline on Replit

## Run

The **Start application** workflow runs:

```bash
npm run dev
```

Vite listens on `0.0.0.0:5000` so the app is available in Replit Preview.

## Storage

The default setup uses browser-local storage and does not require secrets.

To use Supabase persistence instead:

1. Set `VITE_STORAGE_DRIVER` to `supabase`.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Replit environment
   variables or secrets.
3. Restart the workflow.

Never commit `.env` files or privileged database keys.