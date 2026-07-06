const FOTO_PADRAO_DASH = 'https://api.dicebear.com/7.x/initials/svg?seed=';

(async function iniciarDashboard() {
  const session = await exigirLogin();
  if (!session) return;

  const { data: membro } = await supabaseClient
    .from('membros')
    .select('nome_completo, cargo, status, foto_url')
    .eq('auth_id', session.user.id)
    .single();

  const boasVindas = document.getElementById('boas-vindas');
  if (membro) {
    const foto = membro.foto_url || (FOTO_PADRAO_DASH + encodeURIComponent(membro.nome_completo));
    boasVindas.innerHTML = `
      <img src="${foto}" class="avatar-pequeno" alt="" />
      Bem-vindo(a), ${membro.nome_completo} — ${membro.cargo} (status: ${membro.status})
    `;
  } else {
    boasVindas.textContent = `Bem-vindo(a)!`;
  }

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);

  await carregarResumoDashboard(membro);
  await carregarWidgetAvisos();
  await carregarWidgetRankProfessores();

  // Rank de professores atualiza sozinho quando chega voto novo
  supabaseClient
    .channel('rank-prof-dashboard')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'avaliacoes_professores' }, () => {
      carregarWidgetRankProfessores();
    })
    .subscribe();

  // Avisos novos aparecem sozinhos também
  supabaseClient
    .channel('avisos-dashboard')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos' }, () => {
      carregarWidgetAvisos();
    })
    .subscribe();
})();

async function carregarWidgetAvisos() {
  const destino = document.getElementById('widget-avisos');

  const { data, error } = await supabaseClient
    .from('avisos')
    .select('titulo, mensagem, criado_em')
    .order('criado_em', { ascending: false })
    .limit(3);

  if (error) {
    destino.innerHTML = `<p class="erro">Erro ao carregar avisos.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    destino.innerHTML = '<p class="sem-comentarios">Nenhum aviso publicado ainda.</p>';
    return;
  }

  destino.innerHTML = data.map(a => `
    <div class="dash-widget-item">
      <strong>${escapeHtmlDash(a.titulo)}</strong>
      <p>${escapeHtmlDash(a.mensagem)}</p>
    </div>
  `).join('');
}

async function carregarWidgetRankProfessores() {
  const destino = document.getElementById('widget-rank-prof');

  const hoje = new Date();
  const mesReferencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabaseClient
    .from('avaliacoes_professores')
    .select('professor_id, nota, professores(nome)')
    .eq('mes_referencia', mesReferencia);

  if (error) {
    destino.innerHTML = `<p class="erro">Rank de professores indisponível ainda.</p>`;
    return;
  }

  const agregados = {};
  (data || []).forEach(a => {
    if (!a.professores) return;
    if (!agregados[a.professor_id]) agregados[a.professor_id] = { nome: a.professores.nome, soma: 0, qtd: 0 };
    agregados[a.professor_id].soma += a.nota;
    agregados[a.professor_id].qtd += 1;
  });

  const ranking = Object.values(agregados)
    .map(p => ({ ...p, media: p.soma / p.qtd }))
    .sort((a, b) => b.media - a.media)
    .slice(0, 3);

  if (ranking.length === 0) {
    destino.innerHTML = '<p class="sem-comentarios">Nenhuma avaliação neste mês ainda. <a href="extras.html">Avaliar agora</a></p>';
    return;
  }

  destino.innerHTML = ranking.map((r, i) => `
    <div class="dash-widget-item dash-widget-item-linha">
      <span>${i + 1}º — ${escapeHtmlDash(r.nome)}</span>
      <strong>${r.media.toFixed(1)} ★</strong>
    </div>
  `).join('');
}

function iconeDashboard(href) {
  const item = NAV_ITEMS_SIDEBAR.find(([h]) => h === href);
  return item ? item[2] : '';
}

async function carregarResumoDashboard(meuMembro) {
  const heroEl = document.getElementById('hero-dashboard');
  const gridEl = document.getElementById('resumo-dashboard');

  const [eventos, votacoes, projetos, membros, presenca, rankProf] = await Promise.all([
    buscarEventos(),
    buscarVotacoes(),
    buscarProjetos(),
    buscarMembros(),
    buscarPresenca(),
    buscarRankingProfessorAtual(),
  ]);

  heroEl.innerHTML = montarHero(eventos, votacoes, projetos, rankProf);

  const cardsCompactos = [
    {
      href: 'membros.html',
      rotulo: 'Membros',
      numero: membros.total,
      sub: `${membros.ativos} ativo(s)`,
    },
    {
      href: 'presenca.html',
      rotulo: 'Presença',
      numero: presenca.total,
      sub: 'confirmadas no total',
    },
    {
      href: 'projetos.html',
      rotulo: 'Projetos',
      numero: projetos.items.length,
      sub: projetos.items[0] ? `Recente: ${projetos.items[0].titulo}` : 'Nenhum ainda',
    },
    {
      href: 'perfil.html',
      rotulo: 'Meu Perfil',
      numero: meuMembro ? meuMembro.cargo : '—',
      sub: meuMembro ? `Status: ${meuMembro.status}` : 'Complete seu cadastro',
    },
    {
      href: 'documentos.html',
      rotulo: 'Documentos',
      numero: 'Emitir',
      sub: 'Declarações e atas em PDF',
    },
    {
      href: 'selecao.html',
      rotulo: 'Processo Seletivo',
      numero: 'Em breve',
      sub: 'Resumo ainda não disponível',
    },
    {
      href: 'noticias.html',
      rotulo: 'Notícias',
      numero: 'Em breve',
      sub: 'Resumo ainda não disponível',
    },
  ];

  gridEl.innerHTML = cardsCompactos.map(cardCompacto).join('');
}

// ===== Hero: sorteia entre os itens válidos (real-time a cada carregamento) =====
function montarHero(eventos, votacoes, projetos, rankProf) {
  const candidatos = [];

  if (eventos.proximos.length > 0) {
    const ev = eventos.proximos[0];
    const data = new Date(ev.data_hora).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    candidatos.push(heroTemplate('eventos.html', 'Próximo evento', ev.titulo, `${data}${ev.local ? ' · ' + escapeHtmlDash(ev.local) : ''}`));
  }

  if (votacoes.abertas.length > 0) {
    const v = votacoes.abertas[0];
    candidatos.push(heroTemplate('votacoes.html', 'Votação aberta', v.titulo, v.descricao || 'Vote agora'));
  }

  if (projetos.items.length > 0) {
    const p = projetos.items[0];
    candidatos.push(heroTemplate('projetos.html', 'Projeto mais recente', p.titulo, STATUS_LABEL_DASH[p.status] || p.status));
  }

  if (rankProf) {
    candidatos.push(heroTemplate('extras.html', `Professor do mês (${rankProf.mesLabel})`, rankProf.nome, `${rankProf.media.toFixed(1)} ★ — ${rankProf.qtd} avaliação(ões)`));
  }

  if (candidatos.length === 0) {
    return `
      <div class="dash-hero dash-hero-vazio">
        <span class="dash-hero-eyebrow">Tudo em dia</span>
        <h2 class="dash-hero-titulo">Nenhuma pendência no momento</h2>
        <span class="dash-hero-sub">Crie um evento, abra uma votação ou cadastre um projeto</span>
      </div>
    `;
  }

  return candidatos[Math.floor(Math.random() * candidatos.length)];
}

async function buscarRankingProfessorAtual() {
  const hoje = new Date();
  const mesReferencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabaseClient
    .from('avaliacoes_professores')
    .select('professor_id, nota, professores(nome)')
    .eq('mes_referencia', mesReferencia);

  if (error || !data || data.length === 0) return null;

  const agregados = {};
  data.forEach(a => {
    if (!a.professores) return;
    if (!agregados[a.professor_id]) agregados[a.professor_id] = { nome: a.professores.nome, soma: 0, qtd: 0 };
    agregados[a.professor_id].soma += a.nota;
    agregados[a.professor_id].qtd += 1;
  });

  const ranking = Object.values(agregados).map(p => ({ ...p, media: p.soma / p.qtd }));
  if (ranking.length === 0) return null;

  ranking.sort((a, b) => b.media - a.media || b.qtd - a.qtd);
  const top = ranking[0];
  const mesLabel = hoje.toLocaleDateString('pt-BR', { month: 'long' });

  return { nome: top.nome, media: top.media, qtd: top.qtd, mesLabel };
}

function heroTemplate(href, eyebrow, titulo, sub) {
  return `
    <a href="${href}" class="dash-hero">
      <span class="dash-hero-eyebrow">${eyebrow}</span>
      <h2 class="dash-hero-titulo">${escapeHtmlDash(titulo)}</h2>
      <span class="dash-hero-sub">${escapeHtmlDash(sub)}</span>
    </a>
  `;
}

const STATUS_LABEL_DASH = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  pausado: 'Pausado',
};

// ===== Card compacto da grid inferior =====
function cardCompacto({ href, rotulo, numero, sub }) {
  return `
    <a href="${href}" class="card-resumo-compacto">
      <div class="crc-topo">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${iconeDashboard(href)}</svg>
        <span class="rotulo">${rotulo}</span>
      </div>
      <strong class="numero">${numero}</strong>
      <span class="sub">${sub}</span>
    </a>
  `;
}

// ===== Buscas =====
async function buscarEventos() {
  const { data, error } = await supabaseClient
    .from('eventos')
    .select('id, titulo, data_hora, local')
    .order('data_hora', { ascending: true });

  const items = error ? [] : (data || []);
  const agora = new Date();
  const proximos = items.filter(e => new Date(e.data_hora) >= agora);

  return { items, proximos };
}

async function buscarVotacoes() {
  const { data, error } = await supabaseClient
    .from('votacoes')
    .select('id, titulo, descricao, status')
    .order('data_abertura', { ascending: false });

  const items = error ? [] : (data || []);
  const abertas = items.filter(v => v.status === 'aberta');

  return { items, abertas };
}

async function buscarProjetos() {
  const { data, error } = await supabaseClient
    .from('projetos')
    .select('id, titulo, status, created_at')
    .order('created_at', { ascending: false });

  return { items: error ? [] : (data || []) };
}

async function buscarMembros() {
  const { data, error } = await supabaseClient
    .from('membros')
    .select('id, status');

  const items = error ? [] : (data || []);
  return { total: items.length, ativos: items.filter(m => m.status === 'ativo').length };
}

async function buscarPresenca() {
  const { data, error } = await supabaseClient
    .from('presencas')
    .select('presente')
    .eq('presente', true);

  return { total: error ? 0 : (data || []).length };
}

function escapeHtmlDash(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}