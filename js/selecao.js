const CARGOS_DIRETORIA_SEL = ['Presidente', 'Co-Presidente', 'Secretário'];

const STATUS_LABEL = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

(async function iniciarSelecao() {
  const session = await exigirLogin();
  if (!session) return;

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);

  const { data: meuRegistro } = await supabaseClient
    .from('membros')
    .select('cargo')
    .eq('auth_id', session.user.id)
    .single();

  const souDiretoria = meuRegistro && CARGOS_DIRETORIA_SEL.includes(meuRegistro.cargo);

  if (!souDiretoria) {
    document.getElementById('aviso-sem-acesso').style.display = 'block';
    document.getElementById('lista-candidaturas').innerHTML = '';
    return;
  }

  await carregarCandidaturas();
})();

async function carregarCandidaturas() {
  const container = document.getElementById('lista-candidaturas');

  const { data: candidaturas, error } = await supabaseClient
    .from('candidaturas')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${error.message}</p>`;
    return;
  }

  if (!candidaturas || candidaturas.length === 0) {
    container.innerHTML = '<p>Nenhuma candidatura recebida ainda.</p>';
    return;
  }

  container.innerHTML = candidaturas.map(cardCandidatura).join('');

  candidaturas.forEach(c => {
    if (c.status === 'pendente') {
      const btnAprovar = document.getElementById(`aprovar-${c.id}`);
      const btnRejeitar = document.getElementById(`rejeitar-${c.id}`);
      if (btnAprovar) btnAprovar.addEventListener('click', () => avaliarCandidatura(c.id, 'aprovado'));
      if (btnRejeitar) btnRejeitar.addEventListener('click', () => avaliarCandidatura(c.id, 'rejeitado'));
    }
  });
}

function cardCandidatura(c) {
  const data = new Date(c.criado_em).toLocaleDateString('pt-BR');
  const badgeClasse = c.status === 'aprovado' ? 'badge-ativo' : c.status === 'rejeitado' ? 'badge-inativo' : 'badge-pendente';

  return `
    <div class="card-evento">
      <div class="card-evento-header">
        <strong>${escapeHtmlSel(c.nome_completo)}</strong>
        <span class="badge ${badgeClasse}">${STATUS_LABEL[c.status]}</span>
      </div>
      <p class="card-evento-data">${escapeHtmlSel(c.email)} · Recebida em ${data}</p>
      <p class="card-evento-desc">
        <strong>Curso:</strong> ${escapeHtmlSel(c.curso || '—')} &nbsp;·&nbsp;
        <strong>Período:</strong> ${escapeHtmlSel(c.periodo || '—')} &nbsp;·&nbsp;
        <strong>Telefone:</strong> ${escapeHtmlSel(c.telefone || '—')}
      </p>
      <p class="card-evento-desc"><strong>Área de interesse:</strong> ${escapeHtmlSel(c.area_interesse || '—')}</p>
      ${c.motivacao ? `<p class="card-evento-desc"><strong>Motivação:</strong> ${escapeHtmlSel(c.motivacao)}</p>` : ''}
      ${c.status === 'pendente' ? `
        <div style="margin-top:0.8rem; display:flex; gap:0.5rem;">
          <button id="aprovar-${c.id}" class="btn-primary btn-small" style="width:auto;">Aprovar</button>
          <button id="rejeitar-${c.id}" class="btn-secondary btn-small" style="width:auto;">Rejeitar</button>
        </div>
      ` : ''}
    </div>
  `;
}

async function avaliarCandidatura(id, novoStatus) {
  const { error } = await supabaseClient
    .from('candidaturas')
    .update({ status: novoStatus, avaliado_em: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    alert(`Erro ao avaliar: ${error.message}`);
    return;
  }

  await carregarCandidaturas();
}

function escapeHtmlSel(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}