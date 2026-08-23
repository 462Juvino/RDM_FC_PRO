// js/escalacao.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let elencoCompleto = {};
let titulares = new Array(11).fill(null);
let slotSelecionado = null;
let slotSelecionadoSigla = null;
let indiceSlotGlobal = 0;

window.addEventListener('DOMContentLoaded', () => {
    db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value').then(snapshot => {
        dadosUsuario = snapshot.val() || {};

        let timeSeguro = dadosUsuario.timeAtual || "Sem Clube";
        if(timeSeguro === "Sem Clube") return window.location.href = "dashboard.html";

        document.getElementById('nome-treinador').innerText = dadosUsuario.nome || "Treinador";
        document.getElementById('nome-time').innerText = timeSeguro.replace(/_/g, ' ');

        // Carrega táticas salvas
        if(dadosUsuario.formacao) document.getElementById('select-formacao').value = dadosUsuario.formacao;
        if(dadosUsuario.estilo) document.getElementById('select-estilo').value = dadosUsuario.estilo;
        if(dadosUsuario.mentalidade) document.getElementById('select-mentalidade').value = dadosUsuario.mentalidade;

        if(dadosUsuario.titulares) {
            titulares = Array.from({length: 11}, (_, i) => dadosUsuario.titulares[i] || null);
        } else {
            titulares = new Array(11).fill(null);
        }

        desenharCampinho(false);
        carregarElenco(timeSeguro);
    }).catch(e => {
        console.error(e);
        alert("Erro ao carregar dados. Tente atualizar a página.");
    });
});

function carregarElenco(nomeTime) {
    db.ref(`banco_global_times/${nomeTime}/jogadores`).once('value').then(snap => {
        elencoCompleto = snap.val() || {};

        // --- LÓGICA DE ESCALAÇÃO AUTOMÁTICA ---
        let timeVazio = titulares.every(slot => slot === null);

        if (timeVazio && Object.keys(elencoCompleto).length > 0) {
            let todosJogadores = Object.keys(elencoCompleto).map(id => ({ id, ...elencoCompleto[id] }));

            // Ordena os jogadores por Força Total (OVR)
            todosJogadores.sort((a, b) => {
                let ovrA = a.atributos.ataque + a.atributos.defesa + a.atributos.forca + a.atributos.velocidade + a.atributos.habilidade;
                let ovrB = b.atributos.ataque + b.atributos.defesa + b.atributos.forca + b.atributos.velocidade + b.atributos.habilidade;
                return ovrB - ovrA;
            });

            // Isola o melhor Goleiro no Slot 10
            let goleiroIndex = todosJogadores.findIndex(j => j.posicoes.p === "Goleiro" || j.posicoes.s === "Goleiro");
            if (goleiroIndex !== -1) {
                titulares[10] = todosJogadores[goleiroIndex].id;
                todosJogadores.splice(goleiroIndex, 1);
            }

            // Coloca os 10 melhores de linha nos slots restantes
            let countLinha = 0;
            for (let i = 0; i < todosJogadores.length; i++) {
                if (countLinha >= 10) break;
                titulares[countLinha] = todosJogadores[i].id;
                countLinha++;
            }
            // Salva no banco de dados silenciosamente
            db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/titulares`).set(titulares);
        }
        // ---------------------------------------

        // Renderiza a tabela e recalcula os nomes no campinho agora que os dados chegaram
        renderizarTabela();
        for(let i=0; i < titulares.length; i++) atualizarVisualSlot(i);
        calcularForcaTime();

    }).catch(erro => {
        console.error("Erro ao buscar elenco:", erro);
        document.getElementById('tabela-jogadores').innerHTML = `<tr><td colspan="7" style="color: #dc3545; padding: 20px;">❌ Falha na conexão com o servidor.</td></tr>`;
    });
}

function desenharCampinho(resetarTitulares = true) {
    const selectFormacao = document.getElementById('select-formacao');
    const formacao = selectFormacao ? selectFormacao.value : "4-4-2";
    const campinho = document.getElementById('campinho');
    const linhas = formacao.split('-');

    if (resetarTitulares) {
        titulares = new Array(11).fill(null);
    }

    slotSelecionado = null;
    slotSelecionadoSigla = null;
    indiceSlotGlobal = 0;

    let htmlCampinho = `
        <div class="linha-tatica">${gerarBolinhas(linhas[2] || 2, "ATA")}</div>
        <div class="linha-tatica">${gerarBolinhas(linhas[1] || 4, "MEI")}</div>
        <div class="linha-tatica">${gerarBolinhas(linhas[0] || 4, "DEF")}</div>
        <div class="linha-tatica" style="justify-content: center;">${gerarBolinhas(1, "GOL")}</div>
    `;

    if(campinho) campinho.innerHTML = htmlCampinho;

    for(let i=0; i < titulares.length; i++) {
        atualizarVisualSlot(i);
    }

    calcularForcaTime();
    renderizarTabela();
}

function gerarBolinhas(qtd, siglaBase) {
    let html = "";
    for(let i=0; i < parseInt(qtd); i++) {
        let index = indiceSlotGlobal++;
        html += `
            <div class="jogador-campo" id="slot-${index}" onclick="selecionarSlot(${index}, '${siglaBase}')">
                <span id="sigla-${index}">${siglaBase}</span>
                <span class="nome-lbl" id="lbl-${index}">Vazio</span>
            </div>`;
    }
    return html;
}

function salvarEscalacao() {
    const escaladosCount = titulares.filter(id => id !== null).length;
    if(escaladosCount < 11 && !confirm(`Apenas ${escaladosCount} jogadores em campo. Salvar incompleto? O time será punido.`)) return;

    db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
        titulares: titulares,
        formacao: document.getElementById('select-formacao').value || "4-4-2",
        estilo: document.getElementById('select-estilo').value || "Posse de Bola",
        mentalidade: document.getElementById('select-mentalidade').value || "Moderado",
        forcaAtual: parseInt(document.getElementById('forca-time').innerText || "0")
    }).then(() => alert("✅ Tática, Estilo e Mentalidade salvas com sucesso!"))
      .catch(erro => alert("Erro ao salvar: " + erro.message));
}

function selecionarSlot(index, sigla) {
    if(slotSelecionado === index) {
        document.getElementById(`slot-${index}`).style.borderColor = 'var(--verde-campo)';
        document.getElementById(`slot-${index}`).style.boxShadow = 'none';
        slotSelecionado = null;
        slotSelecionadoSigla = null;
        renderizarTabela();
        return;
    }

    document.querySelectorAll('.jogador-campo').forEach(el => {
        el.style.borderColor = 'var(--verde-campo)';
        el.style.boxShadow = 'none';
    });

    const slot = document.getElementById(`slot-${index}`);
    if(slot) {
        slot.style.borderColor = '#ff8c00';
        slot.style.boxShadow = '0 0 10px #ff8c00';
    }

    slotSelecionado = index;
    slotSelecionadoSigla = sigla;

    renderizarTabela();
}

function escalarJogador(idJogador) {
    if (slotSelecionado === null) {
        return alert("TÁTICA: Clique em uma posição vazia no campinho primeiro!");
    }

    let posicaoAntiga = titulares.indexOf(idJogador);
    if (posicaoAntiga !== -1) {
        titulares[posicaoAntiga] = null;
        atualizarVisualSlot(posicaoAntiga);
    }

    titulares[slotSelecionado] = idJogador;
    atualizarVisualSlot(slotSelecionado);

    const slotAtual = document.getElementById(`slot-${slotSelecionado}`);
    if(slotAtual) {
        slotAtual.style.borderColor = 'var(--verde-campo)';
        slotAtual.style.boxShadow = 'none';
    }

    slotSelecionado = null;
    slotSelecionadoSigla = null;

    calcularForcaTime();
    renderizarTabela();
}

function removerJogador(idJogador) {
    let index = titulares.indexOf(idJogador);
    if (index !== -1) {
        titulares[index] = null;
        atualizarVisualSlot(index);
        calcularForcaTime();
        renderizarTabela();
    }
}

function atualizarVisualSlot(index) {
    const lbl = document.getElementById(`lbl-${index}`);
    const sigla = document.getElementById(`sigla-${index}`);
    const idJogador = titulares[index];

    if(!lbl || !sigla) return;

    if (idJogador && elencoCompleto && elencoCompleto[idJogador]) {
        const jog = elencoCompleto[idJogador];
        const primeiroNome = (jog.nome || "Atleta").split(" ")[0];

        const pPrincipal = (jog.posicoes && jog.posicoes.p) ? jog.posicoes.p : "IND";

        lbl.innerText = primeiroNome;
        lbl.style.background = "#ff8c00";
        sigla.innerText = pPrincipal.substring(0,3).toUpperCase();
    } else {
        lbl.innerText = "Vazio";
        lbl.style.background = "rgba(0,0,0,0.8)";
        if(index === 10) sigla.innerText = "GOL";
        else if(index >= 6) sigla.innerText = "DEF";
        else if(index >= 2) sigla.innerText = "MEI";
        else sigla.innerText = "ATA";
    }
}

function renderizarTabela() {
    const tbody = document.getElementById('tabela-jogadores');
    if(!tbody) return;

    tbody.innerHTML = "";

    if(Object.keys(elencoCompleto).length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; color: #dc3545;">⚠️ O seu clube não possui nenhum jogador cadastrado.</td></tr>`;
        return;
    }

    let posicoesFiltro = [];
    if (slotSelecionadoSigla === "GOL") posicoesFiltro = ["Goleiro"];
    else if (slotSelecionadoSigla === "DEF") posicoesFiltro = ["Zagueiro", "Lateral"];
    else if (slotSelecionadoSigla === "MEI") posicoesFiltro = ["Volante", "Meia"];
    else if (slotSelecionadoSigla === "ATA") posicoesFiltro = ["Atacante", "Ponta", "Centroavante"];

    let temAlguemNaLista = false;

    for (let id in elencoCompleto) {
        let j = elencoCompleto[id];

        let at = j.atributos || {ataque: 0, defesa: 0, forca: 0, velocidade: 0, habilidade: 0};
        let pos = j.posicoes || {p: 'Sem', s: 'Sem', t: 'Sem'};

        if (posicoesFiltro.length > 0) {
            let atendeFiltro = posicoesFiltro.includes(pos.p) ||
                               posicoesFiltro.includes(pos.s) ||
                               posicoesFiltro.includes(pos.t);

            if (!atendeFiltro) continue;
        }

        temAlguemNaLista = true;
        let estaEscalado = titulares.includes(id);

        let btnHtml = estaEscalado
            ? `<button class="btn-remover" onclick="removerJogador('${id}')">Remover</button>`
            : `<button class="btn-escalar" onclick="escalarJogador('${id}')">Escalar</button>`;

        tbody.innerHTML += `
            <tr style="${estaEscalado ? 'opacity: 0.5;' : ''}">
                <td style="text-align: left; font-weight: bold; color: white;">
                    ${btnHtml} <span style="margin-left:5px; font-size: 13px;">${j.nome || 'Desconhecido'}</span>
                </td>
                <td style="font-size: 12px;">${pos.p}</td>
                <td style="font-size: 12px;">${at.ataque}</td>
                <td style="font-size: 12px;">${at.defesa}</td>
                <td style="font-size: 12px;">${at.forca}</td>
                <td style="font-size: 12px;">${at.velocidade}</td>
                <td style="color: var(--verde-campo); font-weight: bold; font-size: 12px;">${at.habilidade}</td>
            </tr>
        `;
    }

    if(!temAlguemNaLista && slotSelecionadoSigla) {
        tbody.innerHTML = `
            <tr><td colspan="7" style="padding: 20px; color: #ff8c00;">
                Nenhum atleta na posição. Improvise um jogador!<br>
                <button onclick="limparFiltroDeEmergencia()" style="margin-top:10px; padding: 6px 12px; background: transparent; border: 1px solid #ff8c00; color: #ff8c00; border-radius: 4px; cursor: pointer;">Ver Todo o Elenco</button>
            </td></tr>`;
    }
}

function limparFiltroDeEmergencia() {
    slotSelecionadoSigla = null;
    renderizarTabela();
}

function calcularForcaTime() {
    let forcaReal = 0;
    let escaladosCount = 0;
    let improvisados = 0;

    for (let i = 0; i < titulares.length; i++) {
        let idJogador = titulares[i];

        if (idJogador && elencoCompleto && elencoCompleto[idJogador]) {
            let jog = elencoCompleto[idJogador];
            let at = jog.atributos || {ataque: 0, defesa: 0, forca: 0, velocidade: 0, habilidade: 0};
            let pos = jog.posicoes || {p: 'IND', s: 'IND', t: 'IND'};

            let overall = at.ataque + at.defesa + at.forca + at.velocidade + at.habilidade;

            const siglaElemento = document.getElementById(`sigla-${i}`);
            if (siglaElemento) {
                let setor = siglaElemento.innerText;
                let posicoesJogador = [pos.p, pos.s, pos.t];
                let taNaPosicaoCerta = false;

                if (setor === "GOL" && posicoesJogador.includes("Goleiro")) taNaPosicaoCerta = true;
                if (setor === "DEF" && (posicoesJogador.includes("Zagueiro") || posicoesJogador.includes("Lateral"))) taNaPosicaoCerta = true;
                if (setor === "MEI" && (posicoesJogador.includes("Volante") || posicoesJogador.includes("Meia"))) taNaPosicaoCerta = true;
                if (setor === "ATA" && (posicoesJogador.includes("Atacante") || posicoesJogador.includes("Ponta") || posicoesJogador.includes("Centroavante"))) taNaPosicaoCerta = true;

                if (!taNaPosicaoCerta) {
                    overall = Math.floor(overall * 0.7);
                    improvisados++;
                }
            }

            forcaReal += overall;
            escaladosCount++;
        }
    }

    const placarForca = document.getElementById('forca-time');
    if(!placarForca) return;

    placarForca.innerText = forcaReal;

    if (escaladosCount < 11) {
        placarForca.style.color = "#ff8c00";
    } else if (improvisados > 0) {
        placarForca.style.color = "#dc3545";
        placarForca.title = `${improvisados} jogador(es) improvisado(s)!`;
    } else {
        placarForca.style.color = "#00b853";
        placarForca.title = "Time ideal!";
    }
}

function toggleMenu() { document.querySelector('.sidebar').classList.toggle('aberta'); }
function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}