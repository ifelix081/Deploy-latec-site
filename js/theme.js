// Aplica o tema salvo o quanto antes, pra não "piscar" escuro->claro na carga da página
(function aplicarTemaSalvo() {
  const salvo = localStorage.getItem('tema-deploy');
  if (salvo === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const ICONE_SOL = '<circle cx="10" cy="10" r="4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4"/>';
  const ICONE_LUA = '<path d="M16 11.5A6.5 6.5 0 018.5 4 6.5 6.5 0 1016 11.5z"/>';

  const botao = document.createElement('button');
  botao.id = 'btn-trocar-tema';
  botao.className = 'btn-trocar-tema';
  botao.setAttribute('aria-label', 'Trocar tema claro/escuro');
  botao.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${document.documentElement.getAttribute('data-theme') === 'light' ? ICONE_LUA : ICONE_SOL}</svg>`;

  document.body.appendChild(botao);

  botao.addEventListener('click', () => {
    const ehClaroAgora = document.documentElement.getAttribute('data-theme') === 'light';
    const novoTema = ehClaroAgora ? 'dark' : 'light';

    if (novoTema === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    localStorage.setItem('tema-deploy', novoTema);
    botao.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${novoTema === 'light' ? ICONE_LUA : ICONE_SOL}</svg>`;
  });
});