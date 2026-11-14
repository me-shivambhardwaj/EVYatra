import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);
// Placeholders keep the build from crashing if the .env.local file is missing
export const supabase = createClient(url || "http://localhost:54321", key || "missing-anon-key");