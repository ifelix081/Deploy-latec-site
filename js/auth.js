// ===== Login =====
async function fazerLogin(email, senha) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: senha,
  });

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      mostrarErro('Você ainda não confirmou seu email. Verifique sua caixa de entrada (e o spam).');
      mostrarBotaoReenviar(email);
      return;
    }
    mostrarErro(error.message);
    return;
  }

  // Login ok -> redireciona pro dashboard
  window.location.href = 'dashboard.html';
}

// ===== Cadastro =====
async function fazerCadastro(nomeCompleto, email, senha) {
  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: senha,
    options: {
      data: {
        nome_completo: nomeCompleto,
      },
    },
  });

  if (error) {
    mostrarErro(error.message);
    return;
  }

  mostrarSucesso('Cadastro feito! Enviamos um email de confirmação — clique no link para ativar sua conta antes de fazer login.');
}

// ===== Reenviar email de confirmação =====
async function reenviarConfirmacao(email) {
  const { error } = await supabaseClient.auth.resend({
    type: 'signup',
    email: email,
  });

  if (error) {
    mostrarErro(`Erro ao reenviar: ${error.message}`);
    return;
  }

  mostrarSucesso('Email de confirmação reenviado! Confira sua caixa de entrada.');
}

function mostrarBotaoReenviar(email) {
  const container = document.getElementById('reenviar-container');
  if (!container) return;
  container.style.display = 'block';
  container.querySelector('button').onclick = () => reenviarConfirmacao(email);
}

// ===== Verifica se já existe sessão ativa (usado no dashboard) =====
async function exigirLogin() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = 'index.html';
    return null;
  }

  return session;
}

// ===== Logout =====
async function fazerLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}

// ===== Helpers visuais =====
function mostrarErro(mensagem) {
  const el = document.getElementById('error-msg');
  const suc = document.getElementById('success-msg');
  if (suc) suc.style.display = 'none';
  if (el) {
    el.textContent = mensagem;
    el.style.display = 'block';
  }
}

function mostrarSucesso(mensagem) {
  const el = document.getElementById('success-msg');
  const err = document.getElementById('error-msg');
  if (err) err.style.display = 'none';
  if (el) {
    el.textContent = mensagem;
    el.style.display = 'block';
  }
}