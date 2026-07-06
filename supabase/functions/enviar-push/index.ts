// supabase/functions/enviar-push/index.ts
//
// Deploy: supabase functions deploy enviar-push
// Secrets necessários (supabase secrets set):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT        (ex: mailto:contato@latecficr.com.br)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontos no ambiente da function.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const aviso = payload.record; // { titulo, mensagem, ... } — vem do Database Webhook

    if (!aviso) {
      return new Response(JSON.stringify({ erro: 'Sem registro no payload' }), { status: 400 });
    }

    const { data: inscricoes, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth');

    if (error) throw error;

    const corpoNotificacao = JSON.stringify({
      titulo: aviso.titulo,
      corpo: aviso.mensagem,
    });

    const resultados = await Promise.allSettled(
      (inscricoes || []).map(async (sub) => {
        const subscriptionWebPush = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        try {
          await webpush.sendNotification(subscriptionWebPush, corpoNotificacao);
        } catch (err) {
          // 410 = inscrição expirada/inválida -> apaga do banco
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
          throw err;
        }
      })
    );

    const enviados = resultados.filter(r => r.status === 'fulfilled').length;

    return new Response(JSON.stringify({ enviados, total: (inscricoes || []).length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), { status: 500 });
  }
});