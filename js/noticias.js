const CARGOS_DIRETORIA_NT = ['Presidente', 'Co-Presidente', 'Secretário'];
const CATEGORIAS_NT = ['Porto Digital', 'Liga', 'Hackathons', 'Editais', 'Eventos', 'Programas de Inovação', 'Oportunidades'];

let souDiretoriaNoticias = false;
let filtroAtivo = null;
let todasNoticias = [];

(async function iniciarNoticias() {
  const session = await exigirLogin();
  if (!session) return;

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);

  const { data: meuRegistro } = await supabaseClient
    .from('membros')
    .select('cargo')
    .eq('auth_id', session.user.id)
    .single();

  souDiretoriaNoticias = meuRegistro && CARGOS_DIRETORIA_NT.includes(meuRegistro.cargo);

  if (souDiretoriaNoticias) {
    document.getElementById('form-nova-noticia').style.display = 'block';
    document.getElementById('btn-criar-noticia').addEventListener('click', criarNoticia);
  }

  renderizarFiltros();
  await carregarNoticias();
})();

function renderizarFiltros() {
  const container = document.getElementById('filtro-categorias');
  const botoes = ['Todas', ...CATEGORIAS_NT].map(cat => {
    const valor = cat === 'Todas' ? '' : cat;
    const ativo = filtroAtivo === valor ? 'filtro-ativo' : '';
    return `<button class="filtro-botao ${ativo}" data-cat="${valor}">${cat}</button>`;
  }).join('');

  container.innerHTML = botoes;

  container.querySelectorAll('.filtro-botao').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroAtivo = btn.dataset.cat || null;
      renderizarFiltros();
      renderizarNoticias();
    });
  });
}

async function carregarNoticias() {
  const { data: noticias, error } = await supabaseClient
    .from('noticias')
    .select('id, titulo, resumo, link, categoria, criado_em')
    .order('criado_em', { ascending: false });

  if (error) {
    document.getElementById('lista-noticias').innerHTML = `<p class="erro">Erro ao carregar: ${error.message}</p>`;
    return;
  }

  todasNoticias = noticias || [];
  renderizarNoticias();
}

function renderizarNoticias() {
  const container = document.getElementById('lista-noticias');
  const filtradas = filtroAtivo ? todasNoticias.filter(n => n.categoria === filtroAtivo) : todasNoticias;

  if (filtradas.length === 0) {
    container.innerHTML = '<p>Nenhuma notícia nessa categoria ainda.</p>';
    return;
  }

  container.innerHTML = filtradas.map(cardNoticia).join('');

  if (souDiretoriaNoticias) {
    filtradas.forEach(n => {
      const btn = document.getElementById(`apagar-noticia-${n.id}`);
      if (btn) btn.addEventListener('click', () => apagarNoticia(n.id));
    });
  }
}

function cardNoticia(n) {
  const data = new Date(n.criado_em);
  const ehRecente = (Date.now() - data.getTime()) < 7 * 24 * 60 * 60 * 1000;
  const dataFormatada = data.toLocaleDateString('pt-BR');

  return `
    <div class="card-evento">
      <div class="card-evento-header">
        <strong>${escapeHtmlNt(n.titulo)}</strong>
        <span class="badge badge-tipo">${escapeHtmlNt(n.categoria)}</span>
      </div>
      <p class="card-evento-data">${dataFormatada}${ehRecente ? ' · <span class="tag-novo">Novo</span>' : ''}</p>
      ${n.resumo ? `<p class="card-evento-desc">${escapeHtmlNt(n.resumo)}</p>` : ''}
      ${n.link ? `<p style="margin-top:0.5rem;"><a href="${escapeHtmlNt(n.link)}" target="_blank" rel="noopener">Ler mais →</a></p>` : ''}
      ${souDiretoriaNoticias ? `<button id="apagar-noticia-${n.id}" class="btn-secondary btn-small" style="width:auto; margin-top:0.6rem;">Apagar</button>` : ''}
    </div>
  `;
}

async function criarNoticia() {
  const titulo = document.getElementById('nt-titulo').value.trim();
  const resumo = document.getElementById('nt-resumo').value.trim();
  const link = document.getElementById('nt-link').value.trim();
  const categoria = document.getElementById('nt-categoria').value;

  const erroEl = document.getElementById('erro-noticia');
  erroEl.style.display = 'none';

  if (!titulo) {
    erroEl.textContent = 'Preencha pelo menos o título.';
    erroEl.style.display = 'block';
    return;
  }

  const { error } = await supabaseClient
    .from('noticias')
    .insert({ titulo, resumo: resumo || null, link: link || null, categoria });

  if (error) {
    erroEl.textContent = `Erro ao publicar: ${error.message}`;
    erroEl.style.display = 'block';
    return;
  }

  document.getElementById('nt-titulo').value = '';
  document.getElementById('nt-resumo').value = '';
  document.getElementById('nt-link').value = '';

  await carregarNoticias();
}

async function apagarNoticia(id) {
  await supabaseClient.from('noticias').delete().eq('id', id);
  await carregarNoticias();
}

function escapeHtmlNt(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}