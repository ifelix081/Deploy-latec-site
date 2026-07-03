const FOTO_PADRAO_DASH = 'https://api.dicebear.com/7.x/initials/svg?seed=';

(async function iniciarDashboard() {
  const session = await exigirLogin();
  if (!session) return;

  const { data: membro } = await supabaseClient
    .from('membros')
    .select('nome_completo, cargo, status, foto_url')
    .eq('auth_id', session.user.id)
    .single();

  const boasVindas = document.getElementById('boas-vindas');
  if (membro) {
    const foto = membro.foto_url || (FOTO_PADRAO_DASH + encodeURIComponent(membro.nome_completo));
    boasVindas.innerHTML = `
      <img src="${foto}" class="avatar-pequeno" alt="" />
      Bem-vindo(a), ${membro.nome_completo} — ${membro.cargo} (status: ${membro.status})
    `;
  } else {
    boasVindas.textContent = `Bem-vindo(a)!`;
  }

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);
})();