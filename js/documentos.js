const CARGOS_DIRETORIA_DOC = ['Presidente', 'Co-Presidente', 'Secretário'];

let listaMembrosDoc = [];
let listaEventosDoc = [];
let listaVotacoesDoc = [];
let listaProjetosDoc = [];
let presidenteAtual = null;

(async function iniciarDocumentos() {
  const session = await exigirLogin();
  if (!session) return;

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);

  const { data: meuRegistro } = await supabaseClient
    .from('membros')
    .select('cargo')
    .eq('auth_id', session.user.id)
    .single();

  const souDiretoria = meuRegistro && CARGOS_DIRETORIA_DOC.includes(meuRegistro.cargo);

  if (!souDiretoria) {
    document.getElementById('aviso-permissao').style.display = 'block';
    return;
  }

  document.getElementById('area-doc').style.display = 'block';

  const { data: presidenteRow } = await supabaseClient
    .from('membros')
    .select('nome_completo')
    .eq('cargo', 'Presidente')
    .eq('status', 'ativo')
    .maybeSingle();

  presidenteAtual = presidenteRow ? presidenteRow.nome_completo : '________________';

  await carregarMembrosDoc();
  await carregarEventosDoc();
  await carregarVotacoesDoc();
  await carregarProjetosDoc();

  document.getElementById('doc-tipo').addEventListener('change', atualizarCamposVisiveis);
  atualizarCamposVisiveis();

  document.getElementById('btn-gerar-doc').addEventListener('click', gerarPdf);
})();

function atualizarCamposVisiveis() {
  const tipo = document.getElementById('doc-tipo').value;
  document.getElementById('doc-campo-evento').style.display = tipo === 'evento' ? 'block' : 'none';
  document.getElementById('doc-campo-votacao').style.display = tipo === 'votacao' ? 'block' : 'none';
  document.getElementById('doc-campo-projeto').style.display = tipo === 'projeto' ? 'block' : 'none';
  document.getElementById('doc-campo-evento-presenca').style.display = tipo === 'lista_presenca' ? 'block' : 'none';
  document.getElementById('doc-campo-membro').style.display = (tipo === 'votacao' || tipo === 'lista_presenca') ? 'none' : 'block';
}

async function carregarMembrosDoc() {
  const { data: membros } = await supabaseClient
    .from('membros')
    .select('id, nome_completo, cargo, status, data_ingresso')
    .order('nome_completo');

  listaMembrosDoc = membros || [];
  document.getElementById('doc-membro').innerHTML =
    listaMembrosDoc.map(m => `<option value="${m.id}">${escapeHtmlDoc(m.nome_completo)}</option>`).join('');
}

async function carregarEventosDoc() {
  const { data: eventos } = await supabaseClient
    .from('eventos')
    .select('id, titulo, data_hora')
    .order('data_hora', { ascending: false });

  listaEventosDoc = eventos || [];
  const optsEventos = listaEventosDoc.map(ev => {
    const data = new Date(ev.data_hora).toLocaleDateString('pt-BR');
    return `<option value="${ev.id}">${escapeHtmlDoc(ev.titulo)} — ${data}</option>`;
  }).join('');
  document.getElementById('doc-evento').innerHTML = optsEventos;
  document.getElementById('doc-evento-presenca').innerHTML = optsEventos;
}

async function carregarVotacoesDoc() {
  const { data: votacoes } = await supabaseClient
    .from('votacoes')
    .select('id, titulo, status, data_abertura, data_encerramento')
    .order('data_abertura', { ascending: false });

  listaVotacoesDoc = votacoes || [];
  document.getElementById('doc-votacao').innerHTML = listaVotacoesDoc.map(v =>
    `<option value="${v.id}">${escapeHtmlDoc(v.titulo)} (${v.status})</option>`
  ).join('');
}

async function carregarProjetosDoc() {
  const { data: projetos } = await supabaseClient
    .from('projetos')
    .select('id, titulo, responsavel_id')
    .order('created_at', { ascending: false });

  listaProjetosDoc = projetos || [];
  document.getElementById('doc-projeto').innerHTML = listaProjetosDoc.map(p =>
    `<option value="${p.id}">${escapeHtmlDoc(p.titulo)}</option>`
  ).join('');
}

async function gerarPdf() {
  const erroEl = document.getElementById('erro-doc');
  erroEl.style.display = 'none';

  const tipo = document.getElementById('doc-tipo').value;

  if (tipo === 'votacao') {
    await gerarPdfVotacao();
    return;
  }

  if (tipo === 'lista_presenca') {
    await gerarPdfPresenca();
    return;
  }

  const membroId = document.getElementById('doc-membro').value;
  const membro = listaMembrosDoc.find(m => m.id === membroId);

  if (!membro) {
    erroEl.textContent = 'Selecione um membro.';
    erroEl.style.display = 'block';
    return;
  }

  let corpo = '';
  const dataIngresso = membro.data_ingresso ? new Date(membro.data_ingresso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

  if (tipo === 'membro_ativo') {
    corpo = `Declaramos, para os devidos fins, que ${membro.nome_completo} é membro ativo da Liga Acadêmica de Tecnologia (LATec FICR) desde ${dataIngresso}, encontrando-se em situação regular junto à entidade.`;
  } else if (tipo === 'cargo') {
    corpo = `Declaramos, para os devidos fins, que ${membro.nome_completo} ocupa o cargo de ${membro.cargo} na Liga Acadêmica de Tecnologia (LATec FICR), fazendo parte de sua Diretoria/corpo de membros desde ${dataIngresso}.`;
  } else if (tipo === 'evento') {
    const eventoId = document.getElementById('doc-evento').value;
    const evento = listaEventosDoc.find(ev => ev.id === eventoId);
    if (!evento) {
      erroEl.textContent = 'Selecione um evento.';
      erroEl.style.display = 'block';
      return;
    }
    const dataEvento = new Date(evento.data_hora).toLocaleDateString('pt-BR');
    corpo = `Declaramos, para os devidos fins, que ${membro.nome_completo} participou do evento "${evento.titulo}", promovido pela Liga Acadêmica de Tecnologia (LATec FICR), realizado em ${dataEvento}.`;
  } else if (tipo === 'projeto') {
    const projetoId = document.getElementById('doc-projeto').value;
    const projeto = listaProjetosDoc.find(p => p.id === projetoId);
    if (!projeto) {
      erroEl.textContent = 'Selecione um projeto.';
      erroEl.style.display = 'block';
      return;
    }
    const papel = projeto.responsavel_id === membro.id ? 'responsável' : 'colaborador(a)';
    corpo = `Declaramos, para os devidos fins, que ${membro.nome_completo} participou como ${papel} do projeto "${projeto.titulo}", desenvolvido no âmbito da Liga Acadêmica de Tecnologia (LATec FICR).`;
  }

  montarPdfDeclaracao('DECLARAÇÃO', corpo, membro.nome_completo);
}

async function gerarPdfVotacao() {
  const erroEl = document.getElementById('erro-doc');
  const votacaoId = document.getElementById('doc-votacao').value;
  const votacao = listaVotacoesDoc.find(v => v.id === votacaoId);

  if (!votacao) {
    erroEl.textContent = 'Selecione uma votação.';
    erroEl.style.display = 'block';
    return;
  }

  const { data: opcoes } = await supabaseClient
    .from('opcoes_votacao')
    .select('id, texto_opcao')
    .eq('votacao_id', votacaoId);

  const { data: votos } = await supabaseClient
    .from('votos')
    .select('opcao_id')
    .eq('votacao_id', votacaoId);

  const total = (votos || []).length;
  const contagem = {};
  (votos || []).forEach(v => { contagem[v.opcao_id] = (contagem[v.opcao_id] || 0) + 1; });

  const linhasResultado = (opcoes || []).map(op => {
    const qtd = contagem[op.id] || 0;
    const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
    return `${op.texto_opcao}: ${qtd} voto(s) (${pct}%)`;
  });

  const dataAbertura = new Date(votacao.data_abertura).toLocaleDateString('pt-BR');
  const dataEncerramento = votacao.data_encerramento ? new Date(votacao.data_encerramento).toLocaleDateString('pt-BR') : '—';

  const corpo = `Ata de resultado da votação "${votacao.titulo}", realizada pela Liga Acadêmica de Tecnologia (LATec FICR), com abertura em ${dataAbertura} e encerramento em ${dataEncerramento}. Total de votos computados: ${total}. Os votos foram registrados de forma anônima, sem identificação individual dos votantes no resultado abaixo.`;

  montarPdfDeclaracao('ATA DE RESULTADO DE VOTAÇÃO', corpo, null, linhasResultado, 'Resultado por opção:');
}

function montarPdfDeclaracao(titulo, corpo, nomeArquivoBase, linhasExtras, rotuloExtras) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const hoje = new Date().toLocaleDateString('pt-BR');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('LATec FICR', 105, 30, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Liga Acadêmica de Tecnologia — FICR / Porto Digital', 105, 38, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(titulo, 105, 60, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const linhas = doc.splitTextToSize(corpo, 160);
  doc.text(linhas, 25, 85);

  let yAtual = 85 + linhas.length * 7 + 10;

  if (linhasExtras && linhasExtras.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text(rotuloExtras || 'Detalhes:', 25, yAtual);
    yAtual += 8;
    doc.setFont('helvetica', 'normal');
    linhasExtras.forEach(l => {
      doc.text(`• ${l}`, 30, yAtual);
      yAtual += 7;
    });
    yAtual += 8;
  }

  doc.text(`Recife, ${hoje}.`, 25, Math.max(yAtual, 130));

  const yAssinatura = Math.max(yAtual, 130) + 35;
  doc.line(60, yAssinatura, 150, yAssinatura);
  doc.setFontSize(11);
  doc.text(presidenteAtual, 105, yAssinatura + 7, { align: 'center' });
  doc.text('Presidente — LATec FICR', 105, yAssinatura + 13, { align: 'center' });

  const base = nomeArquivoBase ? nomeArquivoBase.replace(/\s+/g, '_').toLowerCase() : 'votacao';
  doc.save(`documento_${base}.pdf`);
}

async function gerarPdfPresenca() {
  const erroEl = document.getElementById('erro-doc');
  const eventoId = document.getElementById('doc-evento-presenca').value;
  const evento = listaEventosDoc.find(ev => ev.id === eventoId);

  if (!evento) {
    erroEl.textContent = 'Selecione um evento.';
    erroEl.style.display = 'block';
    return;
  }

  const { data: presencas } = await supabaseClient
    .from('presencas')
    .select('membro_id, presente')
    .eq('evento_id', eventoId)
    .eq('presente', true);

  const idsPresentes = (presencas || []).map(p => p.membro_id);
  const presentes = listaMembrosDoc.filter(m => idsPresentes.includes(m.id));

  if (presentes.length === 0) {
    erroEl.textContent = 'Nenhuma presença registrada pra esse evento ainda.';
    erroEl.style.display = 'block';
    return;
  }

  const dataEvento = new Date(evento.data_hora).toLocaleDateString('pt-BR');

  const corpo = `Declaramos, para os devidos fins, que os membros abaixo relacionados estiveram presentes no evento "${evento.titulo}", promovido pela Liga Acadêmica de Tecnologia (LATec FICR), realizado em ${dataEvento}, totalizando ${presentes.length} participante(s) confirmado(s).`;

  const linhasPresentes = presentes.map((m, i) => `${i + 1}. ${m.nome_completo} — ${m.cargo}`);

  montarPdfDeclaracao('LISTA DE PRESENÇA', corpo, evento.titulo, linhasPresentes, 'Membros presentes:');
}

function escapeHtmlDoc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}