let sessaoAtual = null;

const FOTO_PADRAO = 'https://api.dicebear.com/7.x/initials/svg?seed=';

(async function iniciarPerfil() {
  const session = await exigirLogin();
  if (!session) return;
  sessaoAtual = session;

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);

  const { data: membro, error } = await supabaseClient
    .from('membros')
    .select('nome_completo, email, cargo, nickname, foto_url')
    .eq('auth_id', session.user.id)
    .single();

  if (error || !membro) {
    document.getElementById('msg-perfil').textContent = 'Erro ao carregar perfil.';
    document.getElementById('msg-perfil').style.display = 'block';
    return;
  }

  document.getElementById('perfil-nome').textContent = membro.nome_completo;
  document.getElementById('perfil-email').textContent = membro.email;
  document.getElementById('perfil-cargo').textContent = membro.cargo;
  document.getElementById('perfil-nick').value = membro.nickname || '';
  document.getElementById('preview-foto').src = membro.foto_url || (FOTO_PADRAO + encodeURIComponent(membro.nome_completo));

  document.getElementById('input-foto').addEventListener('change', enviarFoto);
  document.getElementById('btn-salvar-perfil').addEventListener('click', salvarPerfil);
})();

async function enviarFoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  const msgEl = document.getElementById('msg-perfil');
  msgEl.style.display = 'none';

  const extensao = file.name.split('.').pop();
  const caminho = `${sessaoAtual.user.id}/foto.${extensao}`;

  const { error: erroUpload } = await supabaseClient
    .storage
    .from('avatars')
    .upload(caminho, file, { upsert: true });

  if (erroUpload) {
    msgEl.textContent = `Erro ao subir foto: ${erroUpload.message}`;
    msgEl.style.display = 'block';
    return;
  }

  const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(caminho);
  const urlComCache = `${urlData.publicUrl}?t=${Date.now()}`;

  document.getElementById('preview-foto').src = urlComCache;

  const { error: erroUpdate } = await supabaseClient
    .from('membros')
    .update({ foto_url: urlData.publicUrl })
    .eq('auth_id', sessaoAtual.user.id);

  if (erroUpdate) {
    msgEl.textContent = `Foto enviada, mas erro ao salvar referência: ${erroUpdate.message}`;
    msgEl.style.display = 'block';
  }
}

async function salvarPerfil() {
  const nickname = document.getElementById('perfil-nick').value.trim();
  const msgEl = document.getElementById('msg-perfil');
  msgEl.style.display = 'none';

  const { error } = await supabaseClient
    .from('membros')
    .update({ nickname: nickname || null })
    .eq('auth_id', sessaoAtual.user.id);

  if (error) {
    msgEl.textContent = `Erro ao salvar: ${error.message}`;
    msgEl.style.color = '#E5484D';
    msgEl.style.display = 'block';
    return;
  }

  msgEl.textContent = 'Perfil salvo com sucesso!';
  msgEl.style.color = '#16A672';
  msgEl.style.display = 'block';
}