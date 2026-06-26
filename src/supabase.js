import { createClient } from "@supabase/supabase-js";

// These are safe to expose in the browser — the publishable (anon) key only
// grants access permitted by Row Level Security, which is enforced server-side.
// Configure via a .env file (see .env.example) or the values below as fallback.
const url = import.meta.env.VITE_SUPABASE_URL || "https://fpyafdcgarhgajwxwuwd.supabase.co";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_nbR6hVbPBxfBuUPEYLFoHg_K5SdcoY5";

export const supabase = createClient(url, anon);
