// Troque pela sua chave pública gerada com "npx web-push generate-vapid-keys"
const VAPID_PUBLIC_KEY = 'BDxrsjTH547atiKqXJGHBIJRrRnND1lYMtNqGYt4G8OYkEw4408lRIQpuKir5vICs7ZKsf2BN5Y03yePe2VI40s';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function ativarNotificacoesPush(membroId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Seu navegador não suporta notificações push.');
    return;
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    alert('Você precisa permitir notificações pra isso funcionar.');
    return;
  }

  const registro = await navigator.serviceWorker.ready;

  let inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const dados = inscricao.toJSON();

  const { error } = await supabaseClient
    .from('push_subscriptions')
    .upsert({
      membro_id: membroId,
      endpoint: dados.endpoint,
      p256dh: dados.keys.p256dh,
      auth: dados.keys.auth,
    }, { onConflict: 'endpoint' });

  if (error) {
    alert(`Erro ao ativar: ${error.message}`);
    return;
  }

  alert('Notificações ativadas! Você vai receber avisos mesmo com o app fechado.');
}