// src/services/storage/index.js
import localDriver from "./local";
import supabaseDriver from "./supabase";

export function getStorage() {
  const driver = (import.meta.env.VITE_STORAGE_DRIVER || "local").toLowerCase();
  if (driver === "supabase") return supabaseDriver();
  return localDriver();
}

export default getStorage;
