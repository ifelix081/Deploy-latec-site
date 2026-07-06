const FOTO_PADRAO_COM = 'https://api.dicebear.com/7.x/initials/svg?seed=';

// meuMembroId precisa estar definido globalmente na página que usa esse componente

// Mantém a mesma assinatura de antes (pra não precisar mexer em eventos.js/projetos.js/votacoes.js),
// só que agora abre modal em vez de expandir inline.
function toggleComentarios(containerIdAntigo, entidadeTipo, entidadeId) {
  abrirModalComentarios(entidadeTipo, entidadeId);
}

function garantirModalComentarios() {
  if (document.getElementById('modal-comentarios-overlay')) return;

  const html = `
    <div id="modal-comentarios-overlay" class="modal-comentarios-overlay"></div>
    <div id="modal-comentarios-painel" class="modal-comentarios-painel">
      <div class="modal-comentarios-topo">
        <h3>Comentários</h3>
        <button id="modal-comentarios-fechar" class="modal-comentarios-fechar" aria-label="Fechar">×</button>
      </div>
      <div id="modal-comentarios-conteudo" class="modal-comentarios-conteudo">
        <p>Carregando...</p>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  document.getElementById('modal-comentarios-overlay').addEventListener('click', fecharModalComentarios);
  document.getElementById('modal-comentarios-fechar').addEventListener('click', fecharModalComentarios);
}

function fecharModalComentarios() {
  const overlay = document.getElementById('modal-comentarios-overlay');
  const painel = document.getElementById('modal-comentarios-painel');
  if (overlay) overlay.classList.remove('aberto');
  if (painel) painel.classList.remove('aberto');
}

async function abrirModalComentarios(entidadeTipo, entidadeId) {
  garantirModalComentarios();

  document.getElementById('modal-comentarios-overlay').classList.add('aberto');
  document.getElementById('modal-comentarios-painel').classList.add('aberto');
  document.getElementById('modal-comentarios-conteudo').innerHTML = '<p>Carregando...</p>';

  await carregarComentarios(entidadeTipo, entidadeId, 'modal-comentarios-conteudo');
}

async function carregarComentarios(entidadeTipo, entidadeId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { data: comentarios, error } = await supabaseClient
    .from('comentarios')
    .select('id, conteudo, criado_em, autor_id, membros(nome_completo, nickname, foto_url, discord_roles)')
    .eq('entidade_tipo', entidadeTipo)
    .eq('entidade_id', entidadeId)
    .order('criado_em', { ascending: true });

  if (error) {
    container.innerHTML = `<p class="erro">Erro ao carregar comentários: ${error.message}</p>`;
    return;
  }

  const medalhas = await carregarMedalhas();
  const listaHtml = (comentarios || []).map(c => itemComentario(c, medalhas)).join('');

  container.innerHTML = `
    <div class="comentarios-lista">${listaHtml || '<p class="sem-comentarios">Nenhum comentário ainda.</p>'}</div>
    <div class="comentarios-form">
      <input type="text" id="input-${containerId}" placeholder="Escreva um comentário..." />
      <button id="btn-${containerId}" class="btn-secondary btn-small" style="width:auto;">Comentar</button>
    </div>
  `;

  (comentarios || []).forEach(c => {
    const btnApagar = document.getElementById(`apagar-com-${c.id}`);
    if (btnApagar) {
      btnApagar.addEventListener('click', () => apagarComentario(c.id, entidadeTipo, entidadeId, containerId));
    }
  });

  document.getElementById(`btn-${containerId}`).addEventListener('click', () =>
    enviarComentario(entidadeTipo, entidadeId, containerId)
  );

  document.getElementById(`input-${containerId}`).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enviarComentario(entidadeTipo, entidadeId, containerId);
  });
}

function itemComentario(c, medalhas) {
  const autor = c.membros;
  const nomeExibicao = autor ? (autor.nickname || autor.nome_completo) : 'Membro';
  const foto = (autor && autor.foto_url) || (FOTO_PADRAO_COM + encodeURIComponent(nomeExibicao));
  const data = new Date(c.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const podeApagar = c.autor_id === meuMembroId;
  const badgeHtml = badgesHtmlDeCache(autor && autor.discord_roles, medalhas, true);

  return `
    <div class="comentario-item">
      <img src="${foto}" class="avatar-pequeno" alt="" onerror="this.src='${FOTO_PADRAO_COM}${encodeURIComponent(nomeExibicao)}'" />
      <div class="comentario-corpo">
        <div class="comentario-cabecalho">
          <span class="comentario-autor">${escapeHtmlCom(nomeExibicao)}</span>
          ${badgeHtml}
        </div>
        <p class="comentario-texto">${escapeHtmlCom(c.conteudo)}</p>
        <span class="comentario-data">${data}</span>
      </div>
      ${podeApagar ? `<button id="apagar-com-${c.id}" class="btn-apagar-comentario" title="Apagar">×</button>` : ''}
    </div>
  `;
}

async function enviarComentario(entidadeTipo, entidadeId, containerId) {
  const input = document.getElementById(`input-${containerId}`);
  const conteudo = input.value.trim();
  if (!conteudo) return;

  const { error } = await supabaseClient
    .from('comentarios')
    .insert({
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      autor_id: meuMembroId,
      conteudo,
    });

  if (error) {
    alert(`Erro ao comentar: ${error.message}`);
    return;
  }

  await carregarComentarios(entidadeTipo, entidadeId, containerId);
}

async function apagarComentario(comentarioId, entidadeTipo, entidadeId, containerId) {
  const { error } = await supabaseClient
    .from('comentarios')
    .delete()
    .eq('id', comentarioId);

  if (error) {
    alert(`Erro ao apagar: ${error.message}`);
    return;
  }

  await carregarComentarios(entidadeTipo, entidadeId, containerId);
}

function escapeHtmlCom(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}