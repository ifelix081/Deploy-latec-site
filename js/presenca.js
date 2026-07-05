const CARGOS_DIRETORIA_PR = ['Presidente', 'Co-Presidente', 'Secretário'];

let souDiretoriaPresenca = false;
let eventoSelecionado = null;

(async function iniciarPresenca() {
  const session = await exigirLogin();
  if (!session) return;

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);

  const { data: meuRegistro } = await supabaseClient
    .from('membros')
    .select('cargo')
    .eq('auth_id', session.user.id)
    .single();

  souDiretoriaPresenca = meuRegistro && CARGOS_DIRETORIA_PR.includes(meuRegistro.cargo);

  if (!souDiretoriaPresenca) {
    document.getElementById('aviso-permissao').style.display = 'block';
  }

  await carregarSelectEventos();
})();

async function carregarSelectEventos() {
  const { data: eventos, error } = await supabaseClient
    .from('eventos')
    .select('id, titulo, data_hora')
    .order('data_hora', { ascending: false });

  const select = document.getElementById('select-evento');

  if (error) {
    select.innerHTML = `<option value="">Erro ao carregar eventos</option>`;
    return;
  }

  if (!eventos || eventos.length === 0) {
    select.innerHTML = `<option value="">Nenhum evento cadastrado ainda</option>`;
    return;
  }

  select.innerHTML =
    `<option value="">Selecione um evento...</option>` +
    eventos.map(ev => {
      const data = new Date(ev.data_hora).toLocaleDateString('pt-BR');
      return `<option value="${ev.id}">${escapeHtmlPr(ev.titulo)} — ${data}</option>`;
    }).join('');

  select.addEventListener('change', () => {
    eventoSelecionado = select.value || null;
    if (eventoSelecionado) {
      carregarListaPresenca(eventoSelecionado);
    } else {
      document.getElementById('area-presenca').innerHTML = '';
    }
  });
}

async function carregarListaPresenca(eventoId) {
  const area = document.getElementById('area-presenca');
  area.innerHTML = '<p>Carregando membros...</p>';

  const { data: membros, error: erroMembros } = await supabaseClient
    .from('membros')
    .select('id, nome_completo, cargo')
    .eq('status', 'ativo')
    .order('nome_completo');

  if (erroMembros) {
    area.innerHTML = `<p class="erro">Erro ao carregar membros: ${erroMembros.message}</p>`;
    return;
  }

  const { data: presencas, error: erroPresencas } = await supabaseClient
    .from('presencas')
    .select('membro_id, presente')
    .eq('evento_id', eventoId);

  if (erroPresencas) {
    area.innerHTML = `<p class="erro">Erro ao carregar presenças: ${erroPresencas.message}</p>`;
    return;
  }

  const presencaPorMembro = {};
  (presencas || []).forEach(p => { presencaPorMembro[p.membro_id] = p.presente; });

  if (!membros || membros.length === 0) {
    area.innerHTML = '<p>Nenhum membro ativo encontrado.</p>';
    return;
  }

  const linhas = membros.map(m => {
    const marcado = presencaPorMembro[m.id] === true;
    return `
      <tr>
        <td>${escapeHtmlPr(m.nome_completo)}</td>
        <td>${escapeHtmlPr(m.cargo)}</td>
        <td style="text-align:center;">
          <input type="checkbox" id="presenca-${m.id}" ${marcado ? 'checked' : ''} ${souDiretoriaPresenca ? '' : 'disabled'} />
        </td>
      </tr>
    `;
  }).join('');

  area.innerHTML = `
    <div class="tabela-membros-wrap">
    <table class="tabela-membros">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Cargo</th>
          <th style="text-align:center;">Presente</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
    </div>
    ${souDiretoriaPresenca ? '<button id="btn-salvar-presenca" class="btn-primary btn-small" style="margin-top:1rem; width:auto;">Salvar presença</button>' : ''}
    <p id="msg-presenca" class="erro" style="display:none;"></p>
  `;

  if (souDiretoriaPresenca) {
    document.getElementById('btn-salvar-presenca').addEventListener('click', () => salvarPresenca(eventoId, membros));
  }
}

async function salvarPresenca(eventoId, membros) {
  const msgEl = document.getElementById('msg-presenca');
  msgEl.style.display = 'none';

  const registros = membros.map(m => ({
    evento_id: eventoId,
    membro_id: m.id,
    presente: document.getElementById(`presenca-${m.id}`).checked,
  }));

  const { error } = await supabaseClient
    .from('presencas')
    .upsert(registros, { onConflict: 'evento_id,membro_id' });

  if (error) {
    msgEl.textContent = `Erro ao salvar: ${error.message}`;
    msgEl.style.color = '#D57C70';
    msgEl.style.display = 'block';
    return;
  }

  msgEl.textContent = 'Presença salva com sucesso!';
  msgEl.style.color = '#82A578';
  msgEl.style.display = 'block';
}

function escapeHtmlPr(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}