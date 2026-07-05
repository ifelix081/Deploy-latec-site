const NAV_ITEMS_SIDEBAR = [
  ['dashboard.html', 'Painel', '<path d="M3 10L10 3l7 7"/><path d="M5 9v8h10V9"/>'],
  ['perfil.html', 'Meu Perfil', '<circle cx="10" cy="6" r="3"/><path d="M4 17c0-3.5 2.7-6 6-6s6 2.5 6 6"/>'],
  ['membros.html', 'Membros', '<circle cx="7" cy="6" r="2.6"/><circle cx="14" cy="7.5" r="2"/><path d="M2 17c0-2.8 2.2-5 5-5s5 2.2 5 5"/><path d="M12.5 12.3c2.2 0.3 4 2.1 4 4.7"/>'],
  ['eventos.html', 'Eventos', '<rect x="3" y="4" width="14" height="13" rx="1.5"/><path d="M3 8h14"/><path d="M7 2v4"/><path d="M13 2v4"/>'],
  ['presenca.html', 'Presença', '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M6.5 10l2.5 2.5 4.5-5"/>'],
  ['votacoes.html', 'Votações', '<path d="M4 16.5V9"/><path d="M10 16.5V4"/><path d="M16 16.5v-6"/><path d="M2.5 17.5h15"/>'],
  ['projetos.html', 'Projetos', '<path d="M2.5 5.5h5l1.7 1.8h8.3v8.7a1 1 0 01-1 1h-13a1 1 0 01-1-1z"/>'],
  ['selecao.html', 'Processo Seletivo', '<rect x="5" y="3" width="10" height="14.5" rx="1.2"/><rect x="7" y="1.3" width="6" height="3" rx="1"/><path d="M7.5 9h5"/><path d="M7.5 12h5"/>'],
  ['noticias.html', 'Notícias', '<rect x="3" y="4" width="14" height="12" rx="1.2"/><path d="M6 8h8"/><path d="M6 11h8"/><path d="M6 14h5"/>'],
  ['documentos.html', 'Documentos', '<path d="M6 2.5h6l3 3v11a1 1 0 01-1 1H6a1 1 0 01-1-1v-13a1 1 0 011-1z"/><path d="M12 2.5v3.5h3.5"/><path d="M7 11h6"/><path d="M7 14h6"/>'],
];

const ICONE_SAIR_SIDEBAR = '<path d="M8 3.5H4.5a1 1 0 00-1 1v11a1 1 0 001 1H8"/><path d="M13 14l4-4-4-4"/><path d="M17 10H7.5"/>';

(function renderizarSidebar() {
  const paginaAtual = window.location.pathname.split('/').pop() || 'dashboard.html';

  const links = NAV_ITEMS_SIDEBAR.map(([href, label, path]) => {
    const ativo = href === paginaAtual ? ' active' : '';
    return `<a href="${href}" class="sidebar-link${ativo}"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg><span class="sidebar-label">${label}</span></a>`;
  }).join('\n      ');

  const sidebarHtml = `
    <div class="sidebar-brand"><span>//</span> LATEC_FICR</div>
    <nav class="sidebar-nav">
      ${links}
    </nav>
    <button id="btn-logout" class="sidebar-logout"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONE_SAIR_SIDEBAR}</svg><span class="sidebar-label">Sair</span></button>
  `;

  const placeholder = document.getElementById('sidebar-placeholder');
  if (placeholder) {
    placeholder.outerHTML = `<aside class="sidebar">${sidebarHtml}</aside>`;
  }

  const tituloEl = document.getElementById('page-title-placeholder');
  if (tituloEl) {
    const item = NAV_ITEMS_SIDEBAR.find(([href]) => href === paginaAtual);
    if (item) tituloEl.textContent = item[1];
  }
})();