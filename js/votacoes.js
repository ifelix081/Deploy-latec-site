const CARGOS_DIRETORIA_VT = ['Presidente', 'Co-Presidente', 'Secretário'];

let souDiretoriaVotacoes = false;
let meuMembroId = null;

(async function iniciarVotacoes() {
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
    souDiretoriaVotacoes = CARGOS_DIRETORIA_VT.includes(meuRegistro.cargo);
  }

  if (souDiretoriaVotacoes) {
    document.getElementById('form-nova-votacao').style.display = 'block';
    document.getElementById('btn-add-opcao').addEventListener('click', adicionarCampoOpcao);
    document.getElementById('btn-criar-votacao').addEventListener('click', criarVotacao);
  }

  await carregarVotacoes();
})();

function adicionarCampoOpcao() {
  const lista = document.getElementById('lista-opcoes');
  const n = lista.querySelectorAll('.input-opcao').length + 1;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input-opcao';
  input.placeholder = `Opção ${n}`;
  lista.appendChild(input);
}

async function criarVotacao() {
  const titulo = document.getElementById('vt-titulo').value.trim();
  const descricao = document.getElementById('vt-descricao').value.trim();
  const opcoes = Array.from(document.querySelectorAll('.input-opcao'))
    .map(i => i.value.trim())
    .filter(v => v.length > 0);

  const erroEl = document.getElementById('erro-votacao');
  erroEl.style.display = 'none';

  if (!titulo || opcoes.length < 2) {
    erroEl.textContent = 'Preencha o título e pelo menos 2 opções.';
    erroEl.style.display = 'block';
    return;
  }

  const { data: votacao, error: erroVotacao } = await supabaseClient
    .from('votacoes')
    .insert({ titulo, descricao: descricao || null })
    .select()
    .single();

  if (erroVotacao) {
    erroEl.textContent = `Erro ao criar votação: ${erroVotacao.message}`;
    erroEl.style.display = 'block';
    return;
  }

  const { error: erroOpcoes } = await supabaseClient
    .from('opcoes_votacao')
    .insert(opcoes.map(texto_opcao => ({ votacao_id: votacao.id, texto_opcao })));

  if (erroOpcoes) {
    erroEl.textContent = `Votação criada, mas erro ao salvar opções: ${erroOpcoes.message}`;
    erroEl.style.display = 'block';
    return;
  }

  document.getElementById('vt-titulo').value = '';
  document.getElementById('vt-descricao').value = '';
  document.getElementById('lista-opcoes').innerHTML = `
    <input type="text" class="input-opcao" placeholder="Opção 1" />
    <input type="text" class="input-opcao" placeholder="Opção 2" />
  `;

  await carregarVotacoes();
}

async function carregarVotacoes() {
  const container = document.getElementById('lista-votacoes');

  const { data: votacoes, error } = await supabaseClient
    .from('votacoes')
    .select('id, titulo, descricao, status, data_abertura')
    .order('data_abertura', { ascending: false });

  if (error) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${error.message}</p>`;
    return;
  }

  if (!votacoes || votacoes.length === 0) {
    container.innerHTML = '<p>Nenhuma votação criada ainda.</p>';
    return;
  }

  container.innerHTML = '<p>Carregando opções e votos...</p>';

  const blocos = await Promise.all(votacoes.map(renderizarVotacao));
  container.innerHTML = blocos.join('');

  votacoes.forEach(v => {
    if (v.status === 'aberta') {
      const btnVotar = document.getElementById(`votar-${v.id}`);
      if (btnVotar) btnVotar.addEventListener('click', () => registrarVoto(v.id));
    }
    if (souDiretoriaVotacoes && v.status === 'aberta') {
      const btnEncerrar = document.getElementById(`encerrar-${v.id}`);
      if (btnEncerrar) btnEncerrar.addEventListener('click', () => encerrarVotacao(v.id));
    }
  });
}

async function renderizarVotacao(v) {
  const { data: opcoes } = await supabaseClient
    .from('opcoes_votacao')
    .select('id, texto_opcao')
    .eq('votacao_id', v.id);

  const { data: votos } = await supabaseClient
    .from('votos')
    .select('opcao_id, membro_id')
    .eq('votacao_id', v.id);

  const jaVotei = (votos || []).some(vt => vt.membro_id === meuMembroId);
  const totalVotos = (votos || []).length;

  const contagem = {};
  (votos || []).forEach(vt => { contagem[vt.opcao_id] = (contagem[vt.opcao_id] || 0) + 1; });

  const opcoesHtml = (opcoes || []).map(op => {
    const qtd = contagem[op.id] || 0;
    const pct = totalVotos > 0 ? Math.round((qtd / totalVotos) * 100) : 0;

    const permiteVotar = v.status === 'aberta' && !jaVotei;

    return `
      <div class="opcao-votacao">
        <label>
          ${permiteVotar ? `<input type="radio" name="opcao-${v.id}" value="${op.id}" />` : ''}
          ${escapeHtmlVt(op.texto_opcao)}
        </label>
        <div class="barra-resultado">
          <div class="barra-preenchida" style="width:${pct}%;"></div>
        </div>
        <span class="resultado-numero">${qtd} voto(s) — ${pct}%</span>
      </div>
    `;
  }).join('');

  return `
    <div class="card-evento">
      <div class="card-evento-header">
        <strong>${escapeHtmlVt(v.titulo)}</strong>
        <span class="badge ${v.status === 'aberta' ? 'badge-ativo' : 'badge-inativo'}">${v.status}</span>
      </div>
      ${v.descricao ? `<p class="card-evento-desc">${escapeHtmlVt(v.descricao)}</p>` : ''}
      <div class="opcoes-container">${opcoesHtml}</div>
      ${v.status === 'aberta' && !jaVotei ? `<button id="votar-${v.id}" class="btn-primary btn-small" style="width:auto; margin-top:0.8rem;">Votar</button>` : ''}
      ${jaVotei ? '<p class="ja-votou">Você já votou nessa votação.</p>' : ''}
      ${souDiretoriaVotacoes && v.status === 'aberta' ? `<button id="encerrar-${v.id}" class="btn-secondary btn-small" style="width:auto; margin-top:0.5rem;">Encerrar votação</button>` : ''}
    </div>
  `;
}

async function registrarVoto(votacaoId) {
  const radioSelecionado = document.querySelector(`input[name="opcao-${votacaoId}"]:checked`);

  if (!radioSelecionado) {
    alert('Selecione uma opção antes de votar.');
    return;
  }

  const { error } = await supabaseClient
    .from('votos')
    .insert({
      votacao_id: votacaoId,
      opcao_id: radioSelecionado.value,
      membro_id: meuMembroId,
    });

  if (error) {
    alert(`Erro ao votar: ${error.message}`);
    return;
  }

  await carregarVotacoes();
}

async function encerrarVotacao(votacaoId) {
  const { error } = await supabaseClient
    .from('votacoes')
    .update({ status: 'encerrada', data_encerramento: new Date().toISOString() })
    .eq('id', votacaoId);

  if (error) {
    alert(`Erro ao encerrar: ${error.message}`);
    return;
  }

  await carregarVotacoes();
}

function escapeHtmlVt(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}