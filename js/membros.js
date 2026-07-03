const CARGOS = [
  'Presidente',
  'Co-Presidente',
  'Secretário',
  'Diretor de Projetos',
  'Vice-Diretor de Projetos',
  'Diretor de Comunicação e Marketing',
  'Vice-Diretor de Comunicação e Marketing',
  'Diretor de Eventos',
  'Vice-Diretor de Eventos',
  'Diretor de Finanças',
  'Vice-Diretor de Finanças',
  'Membro',
];

const STATUS = ['ativo', 'inativo', 'pendente'];

const CARGOS_DIRETORIA = ['Presidente', 'Co-Presidente', 'Secretário'];

let souDiretoria = false;

(async function iniciarMembros() {
  const session = await exigirLogin();
  if (!session) return;

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);

  // Verifica se o usuário logado é da Diretoria (pra saber se libera edição)
  const { data: meuRegistro } = await supabaseClient
    .from('membros')
    .select('cargo')
    .eq('auth_id', session.user.id)
    .single();

  souDiretoria = meuRegistro && CARGOS_DIRETORIA.includes(meuRegistro.cargo);

  if (!souDiretoria) {
    document.getElementById('aviso-permissao').style.display = 'block';
  }

  await carregarMembros();
})();

async function carregarMembros() {
  const { data: membros, error } = await supabaseClient
    .from('membros')
    .select('id, nome_completo, email, cargo, status')
    .order('nome_completo');

  const tbody = document.getElementById('lista-membros');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5">Erro ao carregar: ${error.message}</td></tr>`;
    return;
  }

  if (!membros || membros.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Nenhum membro encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = membros.map(m => linhaMembro(m)).join('');

  if (souDiretoria) {
    membros.forEach(m => {
      const btn = document.getElementById(`salvar-${m.id}`);
      if (btn) btn.addEventListener('click', () => salvarMembro(m.id));
    });
  }
}

function linhaMembro(m) {
  if (!souDiretoria) {
    return `
      <tr>
        <td>${escapeHtml(m.nome_completo)}</td>
        <td>${escapeHtml(m.email)}</td>
        <td>${escapeHtml(m.cargo)}</td>
        <td><span class="badge badge-${m.status}">${m.status}</span></td>
        <td>—</td>
      </tr>
    `;
  }

  return `
    <tr>
      <td>${escapeHtml(m.nome_completo)}</td>
      <td>${escapeHtml(m.email)}</td>
      <td>
        <select id="cargo-${m.id}">
          ${CARGOS.map(c => `<option value="${c}" ${c === m.cargo ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </td>
      <td>
        <select id="status-${m.id}">
          ${STATUS.map(s => `<option value="${s}" ${s === m.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><button id="salvar-${m.id}" class="btn-primary btn-small">Salvar</button></td>
    </tr>
  `;
}

async function salvarMembro(id) {
  const novoCargo = document.getElementById(`cargo-${id}`).value;
  const novoStatus = document.getElementById(`status-${id}`).value;

  const { error } = await supabaseClient
    .from('membros')
    .update({ cargo: novoCargo, status: novoStatus })
    .eq('id', id);

  if (error) {
    alert(`Erro ao salvar: ${error.message}`);
    return;
  }

  await carregarMembros();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}