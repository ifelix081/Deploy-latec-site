(async function iniciarDashboard() {
  const session = await exigirLogin();
  if (!session) return;

  const { data: membro } = await supabaseClient
    .from('membros')
    .select('nome_completo, cargo, status')
    .eq('auth_id', session.user.id)
    .single();

  const boasVindas = document.getElementById('boas-vindas');
  if (membro) {
    boasVindas.textContent = `Bem-vindo(a), ${membro.nome_completo} — ${membro.cargo} (status: ${membro.status})`;
  } else {
    boasVindas.textContent = `Bem-vindo(a)!`;
  }

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);
})();