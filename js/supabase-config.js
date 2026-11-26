const SUPABASE_URL = "https://ilkdyhsmcgswdvgbhegn.supabase.co";
const SUPABASE_KEY = "sb_publishable_JcWkcSzIXCzj7M925ePl8A_ji4fTzJF";

// Cliente global de Supabase (usamos window.sb para no chocar con la librería CDN)
window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);