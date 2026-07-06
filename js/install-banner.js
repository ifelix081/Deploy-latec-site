(function bannerInstalarApp() {
  const ehStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (ehStandalone) return; // já tá instalado, não mostra nada

  const jaFechou = localStorage.getItem('banner-instalar-fechado');
  if (jaFechou) return;

  const ehIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;

  let deferredPrompt = null;

  // Android/Chrome: guarda o evento nativo de instalação
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    mostrarBanner('android');
  });

  if (ehIOS) {
    mostrarBanner('ios');
  }

  function mostrarBanner(tipo) {
    if (document.getElementById('banner-instalar-app')) return;

    const mensagem = tipo === 'ios'
      ? 'Instale o app: toque em <strong>Compartilhar</strong> <span style="font-size:1.1em;">⬆️</span> e depois em <strong>"Adicionar à Tela de Início"</strong>.'
      : 'Instale o app da LATec FICR no seu celular pra acesso rápido e notificações.';

    const botaoAcao = tipo === 'android'
      ? '<button id="btn-instalar-app" class="btn-primary btn-small" style="width:auto; margin-top:0.6rem;">Instalar app</button>'
      : '';

    const html = `
      <div id="banner-instalar-app" class="banner-instalar">
        <button id="btn-fechar-banner" class="banner-instalar-fechar" aria-label="Fechar">×</button>
        <p>${mensagem}</p>
        ${botaoAcao}
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('btn-fechar-banner').addEventListener('click', () => {
      document.getElementById('banner-instalar-app').remove();
      localStorage.setItem('banner-instalar-fechado', 'true');
    });

    if (tipo === 'android') {
      document.getElementById('btn-instalar-app').addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        document.getElementById('banner-instalar-app').remove();
      });
    }
  }
})();