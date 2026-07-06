// Troque pelo Client ID da sua aplicação no Discord Developer Portal (esse é público, pode ficar aqui)
const DISCORD_CLIENT_ID = '1523596355845619794';

// Mesma URL do seu projeto Supabase, só trocando /rest ou nada por /functions/v1
// Ex: se seu supabase-config.js usa 'https://vhzpwxaolisqdbakslna.supabase.co', cole igual aqui + /functions/v1
const SUPABASE_FUNCTIONS_URL = 'https://SEU_PROJECT_REF.supabase.co/functions/v1';

let medalhasCache = null; // { role_id: {nome, emoji, cor, prioridade} }

function urlRedirectDiscord() {
  return window.location.origin + '/perfil.html';
}

// Chamado pelo botão "Conectar Discord"
function iniciarConexaoDiscord() {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: urlRedirectDiscord(),
    response_type: 'code',
    scope: 'identify guilds.members.read',
  });
  window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`;
}

// Chamado automaticamente quando a página perfil.html carrega vindo do redirect do Discord
async function processarCallbackDiscord() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;

  // limpa o ?code= da URL pra não reprocessar se recarregar a página
  window.history.replaceState({}, document.title, window.location.pathname);

  const { data: { session } } = await supabaseClient.auth.getSession();

  const resposta = await fetch(`${SUPABASE_FUNCTIONS_URL}/conectar-discord`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ code, redirect_uri: urlRedirectDiscord() }),
  });

  const resultado = await resposta.json();

  if (!resposta.ok) {
    alert(`Erro ao conectar Discord: ${resultado.erro || 'erro desconhecido'}`);
    return null;
  }

  return resultado;
}

// Busca e cacheia o mapeamento role_id -> medalha (uma vez só por carregamento de página)
async function carregarMedalhas() {
  if (medalhasCache) return medalhasCache;

  const { data, error } = await supabaseClient.from('discord_medalhas').select('*');
  medalhasCache = {};

  if (!error && data) {
    data.forEach(m => { medalhasCache[m.role_id] = m; });
  }

  return medalhasCache;
}

// Versão síncrona: usa um cache de medalhas já carregado (bom pra listas, tipo comentários)
function badgesHtmlDeCache(rolesIds, medalhas, apenasPrincipal = false) {
  if (!rolesIds || rolesIds.length === 0 || !medalhas) return '';

  let minhas = rolesIds
    .map(id => medalhas[id])
    .filter(Boolean)
    .sort((a, b) => b.prioridade - a.prioridade);

  if (minhas.length === 0) return '';
  if (apenasPrincipal) minhas = [minhas[0]];

  return minhas.map(m => `
    <span class="badge-discord" style="background:${m.cor}22; color:${m.cor}; border:1px solid ${m.cor}55;">
      ${m.emoji} ${escapeHtmlBadge(m.nome)}
    </span>
  `).join('');
}

// Versão assíncrona: carrega o cache sozinha (bom pra usos avulsos, tipo Perfil e Quem é quem)
async function renderizarBadgesDiscord(rolesIds, apenasPrincipal = false) {
  const medalhas = await carregarMedalhas();
  return badgesHtmlDeCache(rolesIds, medalhas, apenasPrincipal);
}

function escapeHtmlBadge(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}