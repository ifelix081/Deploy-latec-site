(async function iniciarPerfilDiscord() {
  const session = await exigirLogin();
  if (!session) return;

  const { data: membro } = await supabaseClient
    .from('membros')
    .select('id, discord_username, discord_roles')
    .eq('auth_id', session.user.id)
    .single();

  // Se voltou do Discord com ?code= na URL, processa a conexão primeiro
  const params = new URLSearchParams(window.location.search);
  if (params.get('code')) {
    const resultado = await processarCallbackDiscord();
    if (resultado) {
      await mostrarStatusDiscord(resultado.discord_username, resultado.roles);
      return;
    }
  }

  await mostrarStatusDiscord(membro && membro.discord_username, membro && membro.discord_roles);

  document.getElementById('btn-conectar-discord').addEventListener('click', iniciarConexaoDiscord);
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