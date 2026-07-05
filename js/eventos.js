const CARGOS_DIRETORIA_EV = ['Presidente', 'Co-Presidente', 'Secretário'];
const CATEGORIAS_EV = ['Hackathons', 'Workshops', 'Palestras', 'Meetups', 'Competições', 'Reunião'];

let souDiretoriaEventos = false;
let meuMembroId = null;

const TIPO_LABEL = {
  reuniao: 'Reunião',
  workshop: 'Workshop',
  evento_externo: 'Evento externo',
};

(async function iniciarEventos() {
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
    souDiretoriaEventos = CARGOS_DIRETORIA_EV.includes(meuRegistro.cargo);
  }

  if (souDiretoriaEventos) {
    document.getElementById('form-novo-evento').style.display = 'block';
    document.getElementById('btn-criar-evento').addEventListener('click', criarEvento);
  }

  await carregarEventos();
})();

async function carregarEventos() {
  const { data: eventos, error } = await supabaseClient
    .from('eventos')
    .select('id, titulo, descricao, data_hora, local, tipo, categoria')
    .order('data_hora', { ascending: true });

  const container = document.getElementById('lista-eventos');

  if (error) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${error.message}</p>`;
    return;
  }

  if (!eventos || eventos.length === 0) {
    container.innerHTML = `<p>Nenhum evento cadastrado ainda.</p>`;
    return;
  }

  container.innerHTML = CATEGORIAS_EV
    .map(cat => blocoCategoria(cat, eventos.filter(e => (e.categoria || 'Reunião') === cat)))
    .filter(Boolean)
    .join('');
}

function blocoCategoria(categoria, eventosDaCategoria) {
  if (eventosDaCategoria.length === 0) return '';

  return `
    <div class="categoria-bloco">
      <h3 class="categoria-titulo">${categoria} <span class="categoria-contagem">${eventosDaCategoria.length}</span></h3>
      <div class="categoria-scroll">
        ${eventosDaCategoria.map(cardEvento).join('')}
      </div>
    </div>
  `;
}

function cardEvento(ev) {
  const data = new Date(ev.data_hora);
  const dataFormatada = data.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  return `
    <div class="card-evento card-evento-mini">
      <div class="card-evento-header">
        <strong>${escapeHtmlEv(ev.titulo)}</strong>
        <span class="badge badge-tipo">${TIPO_LABEL[ev.tipo] || ev.tipo}</span>
      </div>
      <p class="card-evento-data">${dataFormatada}${ev.local ? ' · ' + escapeHtmlEv(ev.local) : ''}</p>
      ${ev.descricao ? `<p class="card-evento-desc">${escapeHtmlEv(ev.descricao)}</p>` : ''}
      <div class="comentarios-wrap">
        <button class="comentarios-toggle" onclick="toggleComentarios('coment-evento-${ev.id}', 'evento', '${ev.id}')">Comentários</button>
        <div id="coment-evento-${ev.id}" style="display:none;"></div>
      </div>
    </div>
  `;
}

async function criarEvento() {
  const titulo = document.getElementById('ev-titulo').value.trim();
  const descricao = document.getElementById('ev-descricao').value.trim();
  const dataHora = document.getElementById('ev-data-hora').value;
  const local = document.getElementById('ev-local').value.trim();
  const tipo = document.getElementById('ev-tipo').value;
  const categoria = document.getElementById('ev-categoria').value;

  const erroEl = document.getElementById('erro-evento');
  erroEl.style.display = 'none';

  if (!titulo || !dataHora) {
    erroEl.textContent = 'Preencha pelo menos título e data/hora.';
    erroEl.style.display = 'block';
    return;
  }

  const { error } = await supabaseClient
    .from('eventos')
    .insert({
      titulo,
      descricao: descricao || null,
      data_hora: new Date(dataHora).toISOString(),
      local: local || null,
      tipo,
      categoria,
    });

  if (error) {
    erroEl.textContent = `Erro ao criar evento: ${error.message}`;
    erroEl.style.display = 'block';
    return;
  }

  document.getElementById('ev-titulo').value = '';
  document.getElementById('ev-descricao').value = '';
  document.getElementById('ev-data-hora').value = '';
  document.getElementById('ev-local').value = '';

  await carregarEventos();
}

function escapeHtmlEv(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}