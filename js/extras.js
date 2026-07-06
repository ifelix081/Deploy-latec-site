const CARGOS_DIRETORIA_EXTRAS = ['Presidente', 'Co-Presidente', 'Secretário'];
const FOTO_PADRAO_EXTRAS = 'https://api.dicebear.com/7.x/initials/svg?seed=';

let meuMembroExtras = null;
let projetosLideradosCv = [];
let eventosParticipadosCv = [];
let eventosCache = [];
let projetosCache = [];
let notaProfessorSelecionada = 0;

(async function iniciarExtras() {
  const session = await exigirLogin();
  if (!session) return;

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);

  const { data: membro } = await supabaseClient
    .from('membros')
    .select('id, nome_completo, email, cargo, status, data_ingresso')
    .eq('auth_id', session.user.id)
    .single();

  meuMembroExtras = membro;

  configurarAcordeao('toggle-curriculo', 'corpo-curriculo', () => carregarDadosCurriculo());
  configurarAcordeao('toggle-post', 'corpo-post', () => carregarOpcoesPost());
  configurarAcordeao('toggle-export', 'corpo-export', () => configurarExport());
  configurarAcordeao('toggle-pauta', 'corpo-pauta', () => configurarPauta());
  configurarAcordeao('toggle-quemequem', 'corpo-quemequem', () => configurarQuemEQuem());
  configurarAcordeao('toggle-ranking-presenca', 'corpo-ranking-presenca', () => carregarRankingPresenca());
  configurarAcordeao('toggle-ranking-prof', 'corpo-ranking-prof', () => configurarRankingProfessores());
})();

function configurarAcordeao(idBotao, idCorpo, aoAbrirPrimeiraVez) {
  const botao = document.getElementById(idBotao);
  const corpo = document.getElementById(idCorpo);

  botao.addEventListener('click', () => {
    const abrindo = corpo.style.display === 'none';
    corpo.style.display = abrindo ? 'block' : 'none';

    if (abrindo && !corpo.dataset.carregado) {
      aoAbrirPrimeiraVez();
      corpo.dataset.carregado = 'true';
    }
  });
}

function escapeHtmlExtras(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ==================================================================
   1) GERADOR DE CURRÍCULO
   ================================================================== */

async function carregarDadosCurriculo() {
  if (!meuMembroExtras) {
    document.getElementById('curriculo-carregando').innerHTML =
      '<p class="erro">Não encontramos seu cadastro de membro. Fale com a Diretoria.</p>';
    return;
  }

  document.getElementById('cv-nome').value = meuMembroExtras.nome_completo || '';
  document.getElementById('cv-cargo').value = meuMembroExtras.cargo || '';
  document.getElementById('cv-email').value = meuMembroExtras.email || '';

  const [{ data: projetos }, { data: presencas }] = await Promise.all([
    supabaseClient
      .from('projetos')
      .select('id, titulo, status, data_inicio')
      .eq('responsavel_id', meuMembroExtras.id)
      .order('data_inicio', { ascending: false }),
    supabaseClient
      .from('presencas')
      .select('evento_id, eventos(titulo, data_hora)')
      .eq('membro_id', meuMembroExtras.id)
      .eq('presente', true),
  ]);

  projetosLideradosCv = projetos || [];
  eventosParticipadosCv = (presencas || [])
    .filter(p => p.eventos)
    .sort((a, b) => new Date(b.eventos.data_hora) - new Date(a.eventos.data_hora));

  renderizarListaCheckbox(
    'lista-projetos-cv',
    projetosLideradosCv.map(p => ({
      texto: p.titulo + (p.data_inicio ? ` — desde ${new Date(p.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''),
    })),
    'Nenhum projeto liderado encontrado.'
  );

  renderizarListaCheckbox(
    'lista-eventos-cv',
    eventosParticipadosCv.map(p => ({
      texto: `${p.eventos.titulo} — ${new Date(p.eventos.data_hora).toLocaleDateString('pt-BR')}`,
    })),
    'Nenhuma presença confirmada encontrada.'
  );

  document.getElementById('curriculo-carregando').style.display = 'none';
  document.getElementById('form-curriculo').style.display = 'block';

  document.getElementById('btn-gerar-curriculo').addEventListener('click', gerarCurriculoPdf);
}

function renderizarListaCheckbox(containerId, itens, msgVazio) {
  const container = document.getElementById(containerId);

  if (itens.length === 0) {
    container.innerHTML = `<p class="sem-comentarios">${msgVazio}</p>`;
    return;
  }

  container.innerHTML = itens.map(item => `
    <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.87rem; padding:0.3rem 0;">
      <input type="checkbox" class="${containerId}-check" value="${escapeHtmlExtras(item.texto)}" checked />
      ${escapeHtmlExtras(item.texto)}
    </label>
  `).join('');
}

function itensMarcados(containerId) {
  return Array.from(document.querySelectorAll(`.${containerId}-check:checked`)).map(el => el.value);
}

function novoPdfComCabecalho(nome, subtitulo) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const margemEsq = 20;
  const largura = 170;
  let y = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(nome, margemEsq, y);
  y += 8;

  if (subtitulo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text(subtitulo, margemEsq, y);
    y += 8;
  }

  doc.setTextColor(30, 30, 30);

  return {
    doc, margemEsq, largura,
    y,
    linhaSecao(titulo) {
      this.y += 4;
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(12);
      this.doc.setTextColor(30, 30, 30);
      this.doc.text(titulo.toUpperCase(), this.margemEsq, this.y);
      this.y += 1.5;
      this.doc.setDrawColor(180, 180, 180);
      this.doc.line(this.margemEsq, this.y, this.margemEsq + this.largura, this.y);
      this.y += 7;
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(10.5);
    },
    paragrafo(texto) {
      const linhas = this.doc.splitTextToSize(texto, this.largura);
      this.doc.text(linhas, this.margemEsq, this.y);
      this.y += linhas.length * 5.2 + 4;
    },
    itemLista(texto) {
      const linhas = this.doc.splitTextToSize(`•  ${texto}`, this.largura - 4);
      this.doc.text(linhas, this.margemEsq, this.y);
      this.y += linhas.length * 5.2 + 2;
    },
    espaco(altura) {
      if (this.y + altura > 280) {
        this.doc.addPage();
        this.y = 24;
      }
    },
  };
}

function gerarCurriculoPdf() {
  const erroEl = document.getElementById('erro-curriculo');
  erroEl.style.display = 'none';

  const nome = document.getElementById('cv-nome').value.trim();
  if (!nome) {
    erroEl.textContent = 'Preencha pelo menos o nome.';
    erroEl.style.display = 'block';
    return;
  }

  const cargo = document.getElementById('cv-cargo').value.trim();
  const email = document.getElementById('cv-email').value.trim();
  const telefone = document.getElementById('cv-telefone').value.trim();
  const linkedin = document.getElementById('cv-linkedin').value.trim();
  const resumo = document.getElementById('cv-resumo').value.trim();
  const formacao = document.getElementById('cv-formacao').value.trim();
  const experienciasExtra = document.getElementById('cv-experiencias-extra').value
    .split('\n').map(l => l.trim()).filter(Boolean);
  const habilidades = document.getElementById('cv-habilidades').value.trim();
  const idiomas = document.getElementById('cv-idiomas').value.trim();

  const projetosSelecionados = itensMarcados('lista-projetos-cv');
  const eventosSelecionados = itensMarcados('lista-eventos-cv');

  const contatos = [email, telefone, linkedin].filter(Boolean).join('   ·   ');
  const pdf = novoPdfComCabecalho(nome, contatos);
  pdf.doc.setFontSize(9.5);

  if (resumo) { pdf.espaco(20); pdf.linhaSecao('Resumo profissional'); pdf.paragrafo(resumo); }
  if (formacao) { pdf.espaco(20); pdf.linhaSecao('Formação acadêmica'); pdf.paragrafo(formacao); }

  if (cargo || projetosSelecionados.length > 0) {
    pdf.espaco(20);
    pdf.linhaSecao('Experiência — LATec FICR');
    if (cargo) {
      const desde = meuMembroExtras && meuMembroExtras.data_ingresso
        ? ` (desde ${new Date(meuMembroExtras.data_ingresso + 'T00:00:00').toLocaleDateString('pt-BR')})`
        : '';
      pdf.paragrafo(`${cargo}${desde}`);
    }
    projetosSelecionados.forEach(p => { pdf.espaco(10); pdf.itemLista(`Projeto liderado: ${p}`); });
  }

  if (experienciasExtra.length > 0) {
    pdf.espaco(20); pdf.linhaSecao('Outras experiências');
    experienciasExtra.forEach(e => { pdf.espaco(10); pdf.itemLista(e); });
  }

  if (eventosSelecionados.length > 0) {
    pdf.espaco(20); pdf.linhaSecao('Eventos e participações');
    eventosSelecionados.forEach(e => { pdf.espaco(10); pdf.itemLista(e); });
  }

  if (habilidades) { pdf.espaco(20); pdf.linhaSecao('Habilidades'); pdf.paragrafo(habilidades); }
  if (idiomas) { pdf.espaco(20); pdf.linhaSecao('Idiomas'); pdf.paragrafo(idiomas); }

  pdf.doc.save(`curriculo_${nome.replace(/\s+/g, '_').toLowerCase()}.pdf`);
}

/* ==================================================================
   2) GERADOR DE POST (INSTA/LINKEDIN)
   ================================================================== */

async function carregarOpcoesPost() {
  const [{ data: eventos }, { data: projetos }] = await Promise.all([
    supabaseClient.from('eventos').select('id, titulo, descricao, data_hora, local').order('data_hora', { ascending: false }),
    supabaseClient.from('projetos').select('id, titulo, descricao, membros(nome_completo)').order('created_at', { ascending: false }),
  ]);

  eventosCache = eventos || [];
  projetosCache = projetos || [];

  document.getElementById('post-tipo').addEventListener('change', atualizarSelectPostItem);
  document.getElementById('btn-gerar-post').addEventListener('click', gerarTextoPost);
  document.getElementById('btn-copiar-post').addEventListener('click', copiarTextoPost);

  atualizarSelectPostItem();
}

function atualizarSelectPostItem() {
  const tipo = document.getElementById('post-tipo').value;
  const select = document.getElementById('post-item');
  const lista = tipo === 'evento' ? eventosCache : projetosCache;

  if (lista.length === 0) {
    select.innerHTML = '<option value="">Nada cadastrado ainda</option>';
    return;
  }

  select.innerHTML = lista.map(item => `<option value="${item.id}">${escapeHtmlExtras(item.titulo)}</option>`).join('');
}

function gerarTextoPost() {
  const erroEl = document.getElementById('erro-post');
  erroEl.style.display = 'none';

  const tipo = document.getElementById('post-tipo').value;
  const itemId = document.getElementById('post-item').value;
  const tom = document.getElementById('post-tom').value;

  if (!itemId) {
    erroEl.textContent = 'Selecione um item.';
    erroEl.style.display = 'block';
    return;
  }

  let texto = '';

  if (tipo === 'evento') {
    const ev = eventosCache.find(e => e.id === itemId);
    const data = new Date(ev.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const local = ev.local ? ` 📍 ${ev.local}` : '';

    if (tom === 'empolgado') {
      texto = `🎉 Bora participar do "${ev.titulo}"!\n📅 ${data}${local}\n\n${ev.descricao || ''}\n\nNos vemos lá! 🚀\n#LATecFICR`;
    } else if (tom === 'formal') {
      texto = `A Liga Acadêmica de Tecnologia (LATec FICR) convida para o evento "${ev.titulo}", a ser realizado em ${data}${ev.local ? ', no local ' + ev.local : ''}.\n\n${ev.descricao || ''}`;
    } else {
      texto = `📢 Ainda dá tempo! "${ev.titulo}" acontece em ${data}${local}. Garanta sua presença e venha construir conhecimento com a gente.\n#LATecFICR`;
    }
  } else {
    const pj = projetosCache.find(p => p.id === itemId);
    const responsavel = pj.membros ? pj.membros.nome_completo : 'equipe LATec FICR';

    if (tom === 'empolgado') {
      texto = `🚀 Projeto em destaque: "${pj.titulo}"!\nResponsável: ${responsavel}.\n\n${pj.descricao || ''}\n\n#LATecFICR #Tecnologia`;
    } else if (tom === 'formal') {
      texto = `A LATec FICR apresenta o projeto "${pj.titulo}", conduzido por ${responsavel}.\n\n${pj.descricao || ''}`;
    } else {
      texto = `Quer conhecer o projeto "${pj.titulo}"? Fala com a gente e participe da LATec FICR! 💻\n#LATecFICR`;
    }
  }

  document.getElementById('post-texto-gerado').value = texto;
  document.getElementById('resultado-post').style.display = 'block';
  document.getElementById('post-copiado-msg').style.display = 'none';
}

function copiarTextoPost() {
  const texto = document.getElementById('post-texto-gerado').value;
  navigator.clipboard.writeText(texto).then(() => {
    document.getElementById('post-copiado-msg').style.display = 'block';
  });
}

/* ==================================================================
   3) EXPORT DE DADOS
   ================================================================== */

function configurarExport() {
  document.getElementById('btn-exportar-dados').addEventListener('click', exportarMeusDados);
}

async function exportarMeusDados() {
  const erroEl = document.getElementById('erro-export');
  erroEl.style.display = 'none';

  if (!meuMembroExtras) {
    erroEl.textContent = 'Não encontramos seu cadastro.';
    erroEl.style.display = 'block';
    return;
  }

  const [{ data: projetos }, { data: presencas }, { data: comentarios }] = await Promise.all([
    supabaseClient.from('projetos').select('titulo, status, data_inicio').eq('responsavel_id', meuMembroExtras.id),
    supabaseClient.from('presencas').select('presente, eventos(titulo, data_hora)').eq('membro_id', meuMembroExtras.id),
    supabaseClient.from('comentarios').select('conteudo, criado_em, entidade_tipo').eq('autor_id', meuMembroExtras.id).order('criado_em', { ascending: false }),
  ]);

  const pdf = novoPdfComCabecalho(meuMembroExtras.nome_completo, 'Ficha de dados — LATec FICR');

  pdf.linhaSecao('Dados cadastrais');
  pdf.paragrafo(`Email: ${meuMembroExtras.email || '—'}`);
  pdf.paragrafo(`Cargo: ${meuMembroExtras.cargo || '—'}`);
  pdf.paragrafo(`Status: ${meuMembroExtras.status || '—'}`);
  if (meuMembroExtras.data_ingresso) {
    pdf.paragrafo(`Membro desde: ${new Date(meuMembroExtras.data_ingresso + 'T00:00:00').toLocaleDateString('pt-BR')}`);
  }

  pdf.espaco(20);
  pdf.linhaSecao('Projetos liderados');
  if ((projetos || []).length === 0) pdf.paragrafo('Nenhum.');
  (projetos || []).forEach(p => pdf.itemLista(`${p.titulo} (${p.status})`));

  pdf.espaco(20);
  pdf.linhaSecao('Eventos — presença registrada');
  const comPresenca = (presencas || []).filter(p => p.eventos);
  if (comPresenca.length === 0) pdf.paragrafo('Nenhum registro.');
  comPresenca.forEach(p => {
    const data = new Date(p.eventos.data_hora).toLocaleDateString('pt-BR');
    pdf.itemLista(`${p.eventos.titulo} — ${data} — ${p.presente ? 'presente' : 'ausente'}`);
  });

  pdf.espaco(20);
  pdf.linhaSecao('Comentários feitos');
  if ((comentarios || []).length === 0) pdf.paragrafo('Nenhum.');
  (comentarios || []).forEach(c => {
    pdf.espaco(10);
    const data = new Date(c.criado_em).toLocaleDateString('pt-BR');
    pdf.itemLista(`[${c.entidade_tipo}, ${data}] ${c.conteudo}`);
  });

  pdf.doc.save(`meus_dados_${meuMembroExtras.nome_completo.replace(/\s+/g, '_').toLowerCase()}.pdf`);
}

/* ==================================================================
   4) GERADOR DE PAUTA (DIRETORIA)
   ================================================================== */

function configurarPauta() {
  const souDiretoria = meuMembroExtras && CARGOS_DIRETORIA_EXTRAS.includes(meuMembroExtras.cargo);

  if (!souDiretoria) {
    document.getElementById('pauta-sem-permissao').style.display = 'block';
    return;
  }

  document.getElementById('pauta-conteudo').style.display = 'block';
  document.getElementById('pauta-data').valueAsDate = new Date();
  document.getElementById('btn-gerar-pauta').addEventListener('click', gerarPautaPdf);
}

async function gerarPautaPdf() {
  const erroEl = document.getElementById('erro-pauta');
  erroEl.style.display = 'none';

  const dataReuniao = document.getElementById('pauta-data').value;
  if (!dataReuniao) {
    erroEl.textContent = 'Selecione a data da reunião.';
    erroEl.style.display = 'block';
    return;
  }

  const itensExtra = document.getElementById('pauta-extra').value.split('\n').map(l => l.trim()).filter(Boolean);

  const [{ data: votacoes }, { data: projetos }, { data: eventos }] = await Promise.all([
    supabaseClient.from('votacoes').select('titulo').eq('status', 'aberta'),
    supabaseClient.from('projetos').select('titulo, status').in('status', ['planejamento', 'pausado']),
    supabaseClient.from('eventos').select('titulo, data_hora').order('data_hora', { ascending: true }),
  ]);

  const agora = new Date();
  const proximoEvento = (eventos || []).find(e => new Date(e.data_hora) >= agora);

  const dataFormatada = new Date(dataReuniao + 'T00:00:00').toLocaleDateString('pt-BR');
  const pdf = novoPdfComCabecalho('Pauta de Reunião', `LATec FICR — ${dataFormatada}`);

  pdf.linhaSecao('1. Abertura');
  pdf.paragrafo('Verificação de quórum e abertura dos trabalhos.');

  pdf.espaco(20);
  pdf.linhaSecao('2. Votações em aberto');
  if ((votacoes || []).length === 0) pdf.paragrafo('Nenhuma votação em aberto no momento.');
  (votacoes || []).forEach(v => pdf.itemLista(v.titulo));

  pdf.espaco(20);
  pdf.linhaSecao('3. Projetos que precisam de atenção');
  if ((projetos || []).length === 0) pdf.paragrafo('Nenhum projeto parado ou em planejamento.');
  (projetos || []).forEach(p => pdf.itemLista(`${p.titulo} (${p.status === 'planejamento' ? 'em planejamento' : 'pausado'})`));

  pdf.espaco(20);
  pdf.linhaSecao('4. Próximo evento');
  pdf.paragrafo(proximoEvento
    ? `${proximoEvento.titulo} — ${new Date(proximoEvento.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
    : 'Nenhum evento futuro cadastrado.');

  if (itensExtra.length > 0) {
    pdf.espaco(20);
    pdf.linhaSecao('5. Outros itens');
    itensExtra.forEach(item => pdf.itemLista(item));
  }

  pdf.espaco(20);
  pdf.linhaSecao('Encerramento');
  pdf.paragrafo('Encaminhamentos, definição de responsáveis e prazos.');

  pdf.doc.save(`pauta_reuniao_${dataReuniao}.pdf`);
}

/* ==================================================================
   5) QUEM É QUEM
   ================================================================== */

let membrosAtivosQq = [];

function configurarQuemEQuem() {
  document.getElementById('btn-sortear-membro').addEventListener('click', sortearMembro);
}

async function sortearMembro() {
  if (membrosAtivosQq.length === 0) {
    const { data } = await supabaseClient
      .from('membros')
      .select('nome_completo, cargo, foto_url')
      .eq('status', 'ativo');
    membrosAtivosQq = data || [];
  }

  if (membrosAtivosQq.length === 0) return;

  const sorteado = membrosAtivosQq[Math.floor(Math.random() * membrosAtivosQq.length)];
  const foto = sorteado.foto_url || (FOTO_PADRAO_EXTRAS + encodeURIComponent(sorteado.nome_completo));

  document.getElementById('qq-foto').src = foto;
  document.getElementById('qq-nome').textContent = sorteado.nome_completo;
  document.getElementById('qq-cargo').textContent = sorteado.cargo;
  document.getElementById('resultado-quemequem').style.display = 'block';
}

/* ==================================================================
   6) RANKING DE PARTICIPAÇÃO
   ================================================================== */

async function carregarRankingPresenca() {
  const destino = document.getElementById('lista-ranking-presenca');

  const { data, error } = await supabaseClient
    .from('presencas')
    .select('membro_id, membros(nome_completo)')
    .eq('presente', true);

  if (error || !data) {
    destino.innerHTML = '<p class="erro">Erro ao carregar ranking.</p>';
    return;
  }

  const contagem = {};
  data.forEach(p => {
    if (!p.membros) return;
    const chave = p.membro_id;
    if (!contagem[chave]) contagem[chave] = { nome: p.membros.nome_completo, total: 0 };
    contagem[chave].total += 1;
  });

  const ranking = Object.values(contagem).sort((a, b) => b.total - a.total).slice(0, 10);

  if (ranking.length === 0) {
    destino.innerHTML = '<p class="sem-comentarios">Nenhuma presença registrada ainda.</p>';
    return;
  }

  destino.innerHTML = `
    <div class="tabela-membros-wrap">
      <table class="tabela-membros">
        <thead><tr><th>#</th><th>Nome</th><th>Presenças</th></tr></thead>
        <tbody>
          ${ranking.map((r, i) => `
            <tr>
              <td data-label="#">${i + 1}º</td>
              <td data-label="Nome">${escapeHtmlExtras(r.nome)}</td>
              <td data-label="Presenças">${r.total}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ==================================================================
   7) RANKING DE PROFESSORES (MENSAL)
   ================================================================== */

let professoresCache = [];

async function configurarRankingProfessores() {
  await carregarSelectProfessores();

  document.getElementById('btn-add-professor').addEventListener('click', () => {
    document.getElementById('novo-professor-form').style.display = 'block';
  });

  document.getElementById('btn-salvar-professor').addEventListener('click', salvarNovoProfessor);

  document.querySelectorAll('#prof-estrelas .estrela').forEach(estrela => {
    estrela.addEventListener('click', () => {
      notaProfessorSelecionada = parseInt(estrela.dataset.valor);
      document.querySelectorAll('#prof-estrelas .estrela').forEach(e => {
        e.classList.toggle('marcada', parseInt(e.dataset.valor) <= notaProfessorSelecionada);
      });
    });
  });

  document.getElementById('btn-avaliar-professor').addEventListener('click', enviarAvaliacaoProfessor);

  const inputMes = document.getElementById('prof-ranking-mes');
  const hoje = new Date();
  inputMes.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  inputMes.addEventListener('change', () => carregarRankingProfessores(inputMes.value));

  await carregarRankingProfessores(inputMes.value);
}

async function carregarSelectProfessores() {
  const { data, error } = await supabaseClient.from('professores').select('id, nome').order('nome');
  const select = document.getElementById('prof-select');

  if (error) {
    select.innerHTML = '<option value="">Erro ao carregar (tabela existe?)</option>';
    return;
  }

  professoresCache = data || [];

  select.innerHTML = professoresCache.length > 0
    ? professoresCache.map(p => `<option value="${p.id}">${escapeHtmlExtras(p.nome)}</option>`).join('')
    : '<option value="">Nenhum professor cadastrado ainda</option>';
}

async function salvarNovoProfessor() {
  const nome = document.getElementById('prof-novo-nome').value.trim();
  if (!nome) return;

  const { error } = await supabaseClient.from('professores').insert({ nome });
  if (error) {
    alert(`Erro ao cadastrar: ${error.message}`);
    return;
  }

  document.getElementById('prof-novo-nome').value = '';
  document.getElementById('novo-professor-form').style.display = 'none';
  await carregarSelectProfessores();
}

async function enviarAvaliacaoProfessor() {
  const msgEl = document.getElementById('msg-avaliacao-prof');
  msgEl.style.display = 'none';

  const professorId = document.getElementById('prof-select').value;

  if (!professorId || notaProfessorSelecionada === 0) {
    msgEl.textContent = 'Selecione um professor e uma nota.';
    msgEl.style.color = '#D57C70';
    msgEl.style.display = 'block';
    return;
  }

  const hoje = new Date();
  const mesReferencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

  const { error } = await supabaseClient
    .from('avaliacoes_professores')
    .upsert({
      professor_id: professorId,
      membro_id: meuMembroExtras.id,
      nota: notaProfessorSelecionada,
      mes_referencia: mesReferencia,
    }, { onConflict: 'professor_id,membro_id,mes_referencia' });

  if (error) {
    msgEl.textContent = `Erro ao enviar: ${error.message}`;
    msgEl.style.color = '#D57C70';
    msgEl.style.display = 'block';
    return;
  }

  msgEl.textContent = 'Avaliação registrada! Obrigado.';
  msgEl.style.color = '#82A578';
  msgEl.style.display = 'block';

  await carregarRankingProfessores(document.getElementById('prof-ranking-mes').value);
}

async function carregarRankingProfessores(mesStr) {
  const destino = document.getElementById('lista-ranking-prof');
  if (!mesStr) return;

  const mesReferencia = `${mesStr}-01`;

  const { data, error } = await supabaseClient
    .from('avaliacoes_professores')
    .select('professor_id, nota, professores(nome)')
    .eq('mes_referencia', mesReferencia);

  if (error) {
    destino.innerHTML = `<p class="erro">Erro ao carregar ranking (tabela existe? RLS ok?): ${error.message}</p>`;
    return;
  }

  const agregados = {};
  (data || []).forEach(a => {
    if (!a.professores) return;
    if (!agregados[a.professor_id]) agregados[a.professor_id] = { nome: a.professores.nome, soma: 0, qtd: 0 };
    agregados[a.professor_id].soma += a.nota;
    agregados[a.professor_id].qtd += 1;
  });

  const ranking = Object.values(agregados)
    .map(p => ({ ...p, media: p.soma / p.qtd }))
    .sort((a, b) => b.media - a.media || b.qtd - a.qtd);

  if (ranking.length === 0) {
    destino.innerHTML = '<p class="sem-comentarios">Nenhuma avaliação nesse mês ainda.</p>';
    return;
  }

  destino.innerHTML = `
    <div class="tabela-membros-wrap">
      <table class="tabela-membros">
        <thead><tr><th>#</th><th>Professor</th><th>Média</th><th>Avaliações</th></tr></thead>
        <tbody>
          ${ranking.map((r, i) => `
            <tr>
              <td data-label="#">${i + 1}º</td>
              <td data-label="Professor">${escapeHtmlExtras(r.nome)}</td>
              <td data-label="Média">${r.media.toFixed(1)} ★</td>
              <td data-label="Avaliações">${r.qtd}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}