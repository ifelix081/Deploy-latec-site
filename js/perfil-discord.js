let meuMembroIdPerfil = null;

(async function iniciarPerfilDiscord() {
  const session = await exigirLogin();
  if (!session) return;

  const { data: membro } = await supabaseClient
    .from('membros')
    .select('id, discord_username, discord_roles')
    .eq('auth_id', session.user.id)
    .single();

  if (!membro) return;
  meuMembroIdPerfil = membro.id;

  // Se voltou do Discord com ?code= na URL, processa a conexão primeiro
  const params = new URLSearchParams(window.location.search);
  if (params.get('code')) {
    const resultado = await processarCallbackDiscord();
    if (resultado) {
      await mostrarStatusDiscord(resultado.discord_username, resultado.roles);
    } else {
      await mostrarStatusDiscord(membro.discord_username, membro.discord_roles);
    }
  } else {
    await mostrarStatusDiscord(membro.discord_username, membro.discord_roles);
  }

  document.getElementById('btn-conectar-discord').addEventListener('click', iniciarConexaoDiscord);
  document.getElementById('btn-recarregar-cargos').addEventListener('click', recarregarMeusCargos);
  document.getElementById('btn-desconectar-discord').addEventListener('click', desconectarDiscord);
})();

async function mostrarStatusDiscord(username, roles) {
  const conectado = !!username;

  document.getElementById('discord-nao-conectado').style.display = conectado ? 'none' : 'block';
  document.getElementById('discord-conectado').style.display = conectado ? 'block' : 'none';

  if (conectado) {
    document.getElementById('discord-username').textContent = username;
    const badgesHtml = await renderizarBadgesDiscord(roles, false);
    document.getElementById('discord-badges').innerHTML = badgesHtml || '<span class="sem-comentarios" style="font-size:0.8rem;">Nenhuma medalha reconhecida ainda (fala com a Diretoria pra cadastrar seu cargo).</span>';
  }
}

async function recarregarMeusCargos() {
  const btn = document.getElementById('btn-recarregar-cargos');
  const erroEl = document.getElementById('discord-erro');
  erroEl.style.display = 'none';

  btn.disabled = true;
  btn.textContent = 'Recarregando...';

  try {
    await sincronizarCargosDiscord('proprio');

    const { data: membroAtualizado } = await supabaseClient
      .from('membros')
      .select('discord_username, discord_roles')
      .eq('id', meuMembroIdPerfil)
      .single();

    await mostrarStatusDiscord(membroAtualizado.discord_username, membroAtualizado.discord_roles);
  } catch (e) {
    erroEl.textContent = e.message;
    erroEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Recarregar meus cargos';
  }
}

async function desconectarDiscord() {
  if (!confirm('Tem certeza? Suas medalhas somem do site até você conectar de novo.')) return;

  const btn = document.getElementById('btn-desconectar-discord');
  const erroEl = document.getElementById('discord-erro');
  erroEl.style.display = 'none';
  btn.disabled = true;

  const { error } = await supabaseClient
    .from('membros')
    .update({
      discord_id: null,
      discord_username: null,
      discord_roles: [],
      discord_access_token: null,
      discord_refresh_token: null,
      discord_token_expira: null,
    })
    .eq('id', meuMembroIdPerfil);

  btn.disabled = false;

  if (error) {
    erroEl.textContent = `Erro ao desconectar: ${error.message}`;
    erroEl.style.display = 'block';
    return;
  }

  await mostrarStatusDiscord(null, null);
}