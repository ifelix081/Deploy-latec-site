const CARGOS_DIRETORIA_PJ = ['Presidente', 'Co-Presidente', 'Secretário'];

let souDiretoriaProjetos = false;
let meuMembroId = null;

const STATUS_LABEL_PJ = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  pausado: 'Pausado',
};

const STATUS_BADGE_PJ = {
  planejamento: 'badge-pendente',
  em_andamento: 'badge-tipo',
  concluido: 'badge-ativo',
  pausado: 'badge-inativo',
};

let ordenacaoAtual = 'recentes';

(async function iniciarProjetos() {
  const session = await exigirLogin();
  if (!session) return;

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);

  const { data: meuRegistro } = await supabaseClient
    .from('membros')
    .select('id, cargo')
    .eq('auth_id', session.user.id)
    .single();

  if (meuRegistro) {
    meuMembroId = meuRegistro.id;
    souDiretoriaProjetos = CARGOS_DIRETORIA_PJ.includes(meuRegistro.cargo);
  }

  if (souDiretoriaProjetos) {
    document.getElementById('form-novo-projeto').style.display = 'block';
    await carregarSelectResponsavel();
    document.getElementById('btn-criar-projeto').addEventListener('click', criarProjeto);
  }

  document.getElementById('select-ordenacao').addEventListener('change', (e) => {
    ordenacaoAtual = e.target.value;
    carregarProjetos();
  });

  await carregarProjetos();
})();

async function carregarSelectResponsavel() {
  const { data: membros } = await supabaseClient
    .from('membros')
    .select('id, nome_completo')
    .eq('status', 'ativo')
    .order('nome_completo');

  const select = document.getElementById('pj-responsavel');
  select.innerHTML =
    `<option value="">Sem responsável definido</option>` +
    (membros || []).map(m => `<option value="${m.id}">${escapeHtmlPj(m.nome_completo)}</option>`).join('');
}

async function criarProjeto() {
  const titulo = document.getElementById('pj-titulo').value.trim();
  const descricao = document.getElementById('pj-descricao').value.trim();
  const responsavelId = document.getElementById('pj-responsavel').value;
  const status = document.getElementById('pj-status').value;
  const dataInicio = document.getElementById('pj-data-inicio').value;

  const erroEl = document.getElementById('erro-projeto');
  erroEl.style.display = 'none';

  if (!titulo) {
    erroEl.textContent = 'Preencha pelo menos o título.';
    erroEl.style.display = 'block';
    return;
  }

  const { error } = await supabaseClient
    .from('projetos')
    .insert({
      titulo,
      descricao: descricao || null,
      responsavel_id: responsavelId || null,
      status,
      data_inicio: dataInicio || null,
    });

  if (error) {
    erroEl.textContent = `Erro ao criar projeto: ${error.message}`;
    erroEl.style.display = 'block';
    return;
  }

  document.getElementById('pj-titulo').value = '';
  document.getElementById('pj-descricao').value = '';
  document.getElementById('pj-data-inicio').value = '';

  await carregarProjetos();
}

async function carregarProjetos() {
  const { data: projetos, error } = await supabaseClient
    .from('projetos')
    .select('id, titulo, descricao, status, data_inicio, data_fim, responsavel_id, created_at, membros(nome_completo)')
    .order('created_at', { ascending: false });

  const container = document.getElementById('lista-projetos');

  if (error) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${error.message}</p>`;
    return;
  }

  if (!projetos || projetos.length === 0) {
    container.innerHTML = `<p>Nenhum projeto cadastrado ainda.</p>`;
    return;
  }

  const { data: avaliacoes } = await supabaseClient
    .from('avaliacoes_projetos')
    .select('projeto_id, membro_id, nota, comentario');

  const projetosComNota = projetos.map(p => {
    const notasDoProjeto = (avaliacoes || []).filter(a => a.projeto_id === p.id);
    const media = notasDoProjeto.length > 0
      ? notasDoProjeto.reduce((soma, a) => soma + a.nota, 0) / notasDoProjeto.length
      : 0;
    const minhaAvaliacao = notasDoProjeto.find(a => a.membro_id === meuMembroId);
    return { ...p, _media: media, _qtdAvaliacoes: notasDoProjeto.length, _minhaAvaliacao: minhaAvaliacao };
  });

  if (ordenacaoAtual === 'melhor_avaliados') {
    projetosComNota.sort((a, b) => b._media - a._media || b._qtdAvaliacoes - a._qtdAvaliacoes);
  }

  container.innerHTML = projetosComNota.map(cardProjeto).join('');

  projetosComNota.forEach(p => {
    if (souDiretoriaProjetos) {
      const select = document.getElementById(`status-projeto-${p.id}`);
      if (select) select.addEventListener('change', () => atualizarStatusProjeto(p.id, select.value));
    }

    const estrelas = document.querySelectorAll(`#estrelas-${p.id} .estrela`);
    estrelas.forEach(estrela => {
      estrela.addEventListener('click', () => avaliarProjeto(p.id, parseInt(estrela.dataset.valor)));
    });
  });
}

function cardProjeto(p) {
  const responsavelNome = p.membros ? p.membros.nome_completo : 'Sem responsável definido';
  const dataInicio = p.data_inicio ? new Date(p.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : null;

  const statusHtml = souDiretoriaProjetos ? `
    <select id="status-projeto-${p.id}" style="margin-top:0.6rem;">
      ${Object.keys(STATUS_LABEL_PJ).map(s => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${STATUS_LABEL_PJ[s]}</option>`).join('')}
    </select>
  ` : `<span class="badge ${STATUS_BADGE_PJ[p.status]}">${STATUS_LABEL_PJ[p.status]}</span>`;

  const notaAtual = p._minhaAvaliacao ? p._minhaAvaliacao.nota : 0;
  const estrelasHtml = [1, 2, 3, 4, 5].map(v =>
    `<span class="estrela ${v <= notaAtual ? 'marcada' : ''}" data-valor="${v}">★</span>`
  ).join('');

  return `
    <div class="card-evento">
      <div class="card-evento-header">
        <strong>${escapeHtmlPj(p.titulo)}</strong>
        ${!souDiretoriaProjetos ? statusHtml : ''}
      </div>
      <p class="card-evento-data">Responsável: ${escapeHtmlPj(responsavelNome)}${dataInicio ? ' · Início: ' + dataInicio : ''}</p>
      ${p.descricao ? `<p class="card-evento-desc">${escapeHtmlPj(p.descricao)}</p>` : ''}
      ${souDiretoriaProjetos ? statusHtml : ''}

      <div class="avaliacao-bloco">
        <div class="avaliacao-media">
          <span class="media-numero">${p._media > 0 ? p._media.toFixed(1) : '—'}</span>
          <span class="media-qtd">${p._qtdAvaliacoes} avaliação(ões)</span>
        </div>
        <div class="avaliacao-estrelas" id="estrelas-${p.id}">${estrelasHtml}</div>
      </div>

      <div class="comentarios-wrap">
        <button class="comentarios-toggle" onclick="toggleComentarios('coment-projeto-${p.id}', 'projeto', '${p.id}')">Comentários</button>
        <div id="coment-projeto-${p.id}" style="display:none;"></div>
      </div>
    </div>
  `;
}

async function avaliarProjeto(projetoId, nota) {
  const { error } = await supabaseClient
    .from('avaliacoes_projetos')
    .upsert({ projeto_id: projetoId, membro_id: meuMembroId, nota }, { onConflict: 'projeto_id,membro_id' });

  if (error) {
    alert(`Erro ao avaliar: ${error.message}`);
    return;
  }

  await carregarProjetos();
}

async function atualizarStatusProjeto(id, novoStatus) {
  await supabaseClient
    .from('projetos')
    .update({ status: novoStatus })
    .eq('id', id);
}

function escapeHtmlPj(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}