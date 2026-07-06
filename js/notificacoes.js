const CARGOS_DIRETORIA_AV = ['Presidente', 'Co-Presidente', 'Secretário'];

(async function iniciarNotificacoes() {
  const session = await exigirLogin();
  if (!session) return;

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);

  const { data: meuRegistro } = await supabaseClient
    .from('membros')
    .select('cargo')
    .eq('auth_id', session.user.id)
    .single();

  const souDiretoria = meuRegistro && CARGOS_DIRETORIA_AV.includes(meuRegistro.cargo);

  if (souDiretoria) {
    document.getElementById('form-novo-aviso').style.display = 'block';
    document.getElementById('btn-criar-aviso').addEventListener('click', criarAviso);
  }

  const { data: meuMembroCompleto } = await supabaseClient
    .from('membros')
    .select('id')
    .eq('auth_id', session.user.id)
    .single();

  document.getElementById('btn-ativar-push').addEventListener('click', () => {
    ativarNotificacoesPush(meuMembroCompleto.id);
  });

  await carregarAvisos();

  // Atualiza a lista em tempo real quando alguém posta um aviso novo
  supabaseClient
    .channel('avisos-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos' }, () => {
      carregarAvisos();
    })
    .subscribe();
})();

async function criarAviso() {
  const titulo = document.getElementById('aviso-titulo').value.trim();
  const mensagem = document.getElementById('aviso-mensagem').value.trim();
  const erroEl = document.getElementById('erro-aviso');
  erroEl.style.display = 'none';

  if (!titulo || !mensagem) {
    erroEl.textContent = 'Preencha título e mensagem.';
    erroEl.style.display = 'block';
    return;
  }

  const { error } = await supabaseClient.from('avisos').insert({ titulo, mensagem });

  if (error) {
    erroEl.textContent = `Erro ao publicar: ${error.message}`;
    erroEl.style.display = 'block';
    return;
  }

  document.getElementById('aviso-titulo').value = '';
  document.getElementById('aviso-mensagem').value = '';
}

async function carregarAvisos() {
  const container = document.getElementById('lista-avisos');

  const { data: avisos, error } = await supabaseClient
    .from('avisos')
    .select('id, titulo, mensagem, criado_em')
    .order('criado_em', { ascending: false });

  if (error) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${error.message}</p>`;
    return;
  }

  if (!avisos || avisos.length === 0) {
    container.innerHTML = '<p>Nenhum aviso publicado ainda.</p>';
    return;
  }

  container.innerHTML = avisos.map(a => `
    <div class="card-evento">
      <div class="card-evento-header">
        <strong>${escapeHtmlAv(a.titulo)}</strong>
        <span class="card-evento-data">${new Date(a.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <p class="card-evento-desc">${escapeHtmlAv(a.mensagem)}</p>
    </div>
  `).join('');
}

function escapeHtmlAv(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}