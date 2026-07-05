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
})();

// Pega o SVG de um item do menu lateral (mesmo ícone, mesmo lugar)
function iconeDashboard(href) {
  const item = NAV_ITEMS_SIDEBAR.find(([h]) => h === href);
  return item ? item[2] : '';
}

function cardResumo({ href, label, numero, sub }) {
  return `
    <a href="${href}" class="card-resumo">
      <div class="card-resumo-topo">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${iconeDashboard(href)}</svg>
        <span class="card-resumo-label">${label}</span>
      </div>
      <strong class="card-resumo-numero">${numero}</strong>
      <span class="card-resumo-sub">${sub}</span>
    </a>
  `;
}

async function carregarResumoDashboard(meuMembro) {
  const destino = document.getElementById('resumo-dashboard');

  const [membros, eventos, presenca, votacoes, projetos] = await Promise.all([
    resumoMembros(),
    resumoEventos(),
    resumoPresenca(),
    resumoVotacoes(),
    resumoProjetos(),
  ]);

  const cards = [
    membros,
    eventos,
    presenca,
    votacoes,
    projetos,
    {
      href: 'perfil.html',
      label: 'Meu Perfil',
      numero: meuMembro ? meuMembro.cargo : '—',
      sub: meuMembro ? `Status: ${meuMembro.status}` : 'Complete seu cadastro',
    },
    {
      href: 'selecao.html',
      label: 'Processo Seletivo',
      numero: 'Em breve',
      sub: 'Resumo ainda não disponível',
    },
    {
      href: 'noticias.html',
      label: 'Notícias',
      numero: 'Em breve',
      sub: 'Resumo ainda não disponível',
    },
    {
      href: 'documentos.html',
      label: 'Documentos',
      numero: 'Emitir',
      sub: 'Declarações e atas em PDF',
    },
  ];

  destino.innerHTML = cards.map(cardResumo).join('');
}

async function resumoMembros() {
  const { data: membros, error } = await supabaseClient
    .from('membros')
    .select('id, status');

  if (error || !membros) {
    return { href: 'membros.html', label: 'Membros', numero: '—', sub: 'Erro ao carregar' };
  }

  const ativos = membros.filter(m => m.status === 'ativo').length;

  return {
    href: 'membros.html',
    label: 'Membros',
    numero: membros.length,
    sub: `${ativos} ativo(s)`,
  };
}

async function resumoEventos() {
  const { data: eventos, error } = await supabaseClient
    .from('eventos')
    .select('id, titulo, data_hora')
    .order('data_hora', { ascending: true });

  if (error || !eventos) {
    return { href: 'eventos.html', label: 'Eventos', numero: '—', sub: 'Erro ao carregar' };
  }

  const agora = new Date();
  const proximos = eventos.filter(e => new Date(e.data_hora) >= agora);

  const sub = proximos.length > 0
    ? `Próximo: ${proximos[0].titulo} — ${new Date(proximos[0].data_hora).toLocaleDateString('pt-BR')}`
    : 'Nenhum evento agendado';

  return {
    href: 'eventos.html',
    label: 'Eventos',
    numero: proximos.length,
    sub,
  };
}

async function resumoPresenca() {
  const { data: presencas, error } = await supabaseClient
    .from('presencas')
    .select('presente')
    .eq('presente', true);

  if (error) {
    return { href: 'presenca.html', label: 'Presença', numero: '—', sub: 'Erro ao carregar' };
  }

  return {
    href: 'presenca.html',
    label: 'Presença',
    numero: (presencas || []).length,
    sub: 'presenças confirmadas no total',
  };
}

async function resumoVotacoes() {
  const { data: votacoes, error } = await supabaseClient
    .from('votacoes')
    .select('id, titulo, status')
    .order('data_abertura', { ascending: false });

  if (error || !votacoes) {
    return { href: 'votacoes.html', label: 'Votações', numero: '—', sub: 'Erro ao carregar' };
  }

  const abertas = votacoes.filter(v => v.status === 'aberta');

  let sub = 'Nenhuma votação criada ainda';
  if (abertas.length > 0) {
    sub = `Aberta: ${abertas[0].titulo}`;
  } else if (votacoes.length > 0) {
    sub = `Última: ${votacoes[0].titulo} (encerrada)`;
  }

  return {
    href: 'votacoes.html',
    label: 'Votações',
    numero: abertas.length,
    sub,
  };
}

async function resumoProjetos() {
  const { data: projetos, error } = await supabaseClient
    .from('projetos')
    .select('id, titulo, created_at')
    .order('created_at', { ascending: false });

  if (error || !projetos) {
    return { href: 'projetos.html', label: 'Projetos', numero: '—', sub: 'Erro ao carregar' };
  }

  const sub = projetos.length > 0
    ? `Mais recente: ${projetos[0].titulo}`
    : 'Nenhum projeto cadastrado ainda';

  return {
    href: 'projetos.html',
    label: 'Projetos',
    numero: projetos.length,
    sub,
  };
}