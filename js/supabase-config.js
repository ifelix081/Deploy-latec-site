// Configuração do cliente Supabase
// Importa a lib do Supabase via CDN (adicionada no <script> do HTML)

const SUPABASE_URL = 'https://vhzpwxaolisqdbakslna.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1PMiP_GWMoo6u26n8rMwXA_ZQ2n-zY5';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);