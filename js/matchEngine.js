// js/matchEngine.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let divisaoAtual = "A";
let rodadaSistema = 1;
let meuJogoId = null;
let jogoAtual = null;
window.treinadoresGlobais = {}; // 🟢 Mapeamento global de quem controla quem

// ==========================================
// MÁQUINA DE ÁUDIO DINÂMICO (P2P QUEUE)
// ==========================================
let audioLiberado = false;
const canalTorcidaM = new Audio();
const canalTorcidaV = new Audio();
const canalEfeitos = new Audio();
const canalHino = new Audio();
const somApito = new Audio('sounds/apito_arbitro.mp3');

canalTorcidaM.loop = true;
canalTorcidaV.loop = true;

let eventosJaTocados = new Set();
let filaNarracaoOficial = [];
let narradorOficialOcupado = false;
let placarNarracaoM = 0;
let placarNarracaoV = 0;

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const narracao = document.getElementById('narracao-container');
        if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 20px;">Buscando sinal do satélite...</div>`;

        // Busca a lista de treinadores para exibir os nomes na tela de transmissão
        const snapAllUsers = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
        const allUsers = snapAllUsers.val() || {};
        for(let k in allUsers) {
            if(allUsers[k].timeAtual && allUsers[k].timeAtual !== "Sem Clube") {
                window.treinadoresGlobais[allUsers[k].timeAtual] = allUsers[k].nome;
            }
        }

        const snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
        dadosUsuario = snapUser.val();
        if(!dadosUsuario || dadosUsuario.timeAtual === "Sem Clube") return window.location.href = "dashboard.html";

        const snapTime = await db.ref(`banco_global_times/${dadosUsuario.timeAtual}`).once('value');
        if (snapTime.exists()) divisaoAtual = snapTime.val().divisao;

        iniciarTransmissao();
    } catch (e) { console.error(e); }
});

function atualizarTorcidasOficiais() {
    if (!audioLiberado) return;
    if (placarNarracaoM > placarNarracaoV) { canalTorcidaM.volume = 0.5; canalTorcidaV.volume = 0.1; }
    else if (placarNarracaoV > placarNarracaoM) { canalTorcidaM.volume = 0.1; canalTorcidaV.volume = 0.5; }
    else { canalTorcidaM.volume = 0.4; canalTorcidaV.volume = 0.2; }
}

window.liberarAudio = function() {
    audioLiberado = true;
    const narracao = document.getElementById('narracao-container');
    if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center;">Áudio e vídeo conectados! Aguardando rolar a bola...</div>`;

    if (jogoAtual && jogoAtual.linhaDoTempo) {
        canalTorcidaM.src = getTorcida(jogoAtual.mandante);
        canalTorcidaV.src = getTorcida(jogoAtual.visitante);
        canalTorcidaM.play().catch(()=>{});
        canalTorcidaV.play().catch(()=>{});
        atualizarTorcidasOficiais();

        reproduzirLinhaDoTempo(jogoAtual.linhaDoTempo, jogoAtual.horaInicio, jogoAtual.placarMandante, jogoAtual.placarVisitante);
    }
}

// ==========================================
// LÓGICA DE TRANSMISSÃO COM SELETOR DE RODADAS (CAMP E COPA)
// ==========================================
let calGlobal = null;
let rodadaExibicao = null;

function iniciarTransmissao() {
    db.ref(`ligas/${ligaLogada}/calendario`).on('value', (snapCal) => {
        calGlobal = snapCal.val();
        if (!calGlobal) return;

        rodadaSistema = calGlobal.rodadaAtual || 1;

        // 🟢 CORREÇÃO: Força a rodada atual baseando-se na data real de hoje!
        let dataHoje = new Date();
        let hojeDT = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), dataHoje.getDate());

        if (calGlobal.serieA) {
            for (let r = 1; r <= 38; r++) {
                let rodadaData = calGlobal.serieA[`rodada_${r}`];
                if (rodadaData) {
                    let jogoExemplo = Object.values(rodadaData)[0];
                    if (jogoExemplo && jogoExemplo.data_jogo) {
                        let [dJ, mJ] = jogoExemplo.data_jogo.split(' ')[0].split('/');
                        let jogoDT = new Date(dataHoje.getFullYear(), parseInt(mJ)-1, parseInt(dJ));
                        // Se a data do jogo já chegou, libera a rodada no filtro!
                        if (jogoDT <= hojeDT) rodadaSistema = r;
                    }
                }
            }
        }

        renderizarPartida();
    });
}

window.mudarRodadaTransmissao = function(novaRodada) {
    rodadaExibicao = novaRodada;
    canalTorcidaM.pause(); canalTorcidaV.pause();
    eventosJaTocados.clear(); filaNarracaoOficial = []; narradorOficialOcupado = false;
    placarNarracaoM = 0; placarNarracaoV = 0;
    renderizarPartida();
};

function renderizarPartida() {
    const topoRodada = document.getElementById('lbl-rodada-top');

    // 1️⃣ MÁGICA DO FILTRO: Define a rodada atual ANTES de gerar o HTML do Dropdown!
    if (!rodadaExibicao) rodadaExibicao = `camp_rodada_${rodadaSistema}`;

    if (topoRodada && (!document.getElementById('select-rodada-transmissao'))) {
        let selectHtml = `<select id="select-rodada-transmissao" onchange="mudarRodadaTransmissao(this.value)" style="background:#1a1a1a; color:var(--verde-campo); border:1px solid #444; padding:2px 5px; border-radius:4px; font-weight:bold; outline:none; margin-left: 5px; cursor: pointer;">`;

        for (let r = 1; r <= rodadaSistema; r++) {
            selectHtml += `<option value="camp_rodada_${r}" ${rodadaExibicao === 'camp_rodada_'+r ? 'selected' : ''}>Rodada ${r}</option>`;
        }
        if (calGlobal.copa) {
            for (let f in calGlobal.copa) {
                selectHtml += `<option value="copa_${f}" ${rodadaExibicao === 'copa_'+f ? 'selected' : ''}>Copa: ${f.toUpperCase()}</option>`;
            }
        }
        selectHtml += `</select>`;
        topoRodada.innerHTML = selectHtml;
    }

    let isCopa = rodadaExibicao.startsWith("copa_");
    let chave = rodadaExibicao.replace("camp_", "").replace("copa_", "");

    let jogosDaDivisao = null;
    if (isCopa) jogosDaDivisao = calGlobal.copa[chave];
    else jogosDaDivisao = divisaoAtual === "A" ? calGlobal.serieA[chave] : calGlobal.serieB[chave];

    let jogoAoVivo = null;
    if (jogosDaDivisao) {
        for (let j in jogosDaDivisao) {
            if (jogosDaDivisao[j].mandante === dadosUsuario.timeAtual || jogosDaDivisao[j].visitante === dadosUsuario.timeAtual) {
                meuJogoId = j; jogoAoVivo = jogosDaDivisao[j]; break;
            }
        }
    }

    let jaTerminouDeVerdade = false;
    let tempoPassadoMs = -1;
    const HORA_JOGO = isCopa ? 20 : 19;
    let horaInicioFake = new Date();

    if (jogoAoVivo) {
        let dataHoje = new Date();
        let [diaJ, mesJ] = (jogoAoVivo.data_jogo || "01/01").split(' ')[0].split('/');
        let jogoDT = new Date(dataHoje.getFullYear(), parseInt(mesJ)-1, parseInt(diaJ));
        jogoDT.setHours(0,0,0,0);
        let hojeDT = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), dataHoje.getDate());

        let isAtrasado = jogoDT < hojeDT;
        let isHoje = jogoDT.getTime() === hojeDT.getTime();
        let isFuturo = jogoDT > hojeDT; // Variável nova para bloquear jogos adiantados

        if (jogoAoVivo.horaInicio) {
            tempoPassadoMs = Date.now() - jogoAoVivo.horaInicio;
        }

        let rodandoAoVivo = (jogoAoVivo.jogado && tempoPassadoMs >= 0 && tempoPassadoMs <= 130000);
        jaTerminouDeVerdade = jogoAoVivo.jogado && !rodandoAoVivo;
    }

    const lblMandante = document.getElementById('placar-nome-mandante');
    const lblVisitante = document.getElementById('placar-nome-visitante');
    const cronometro = document.getElementById('tempo-jogo');
    const statusTransmissao = document.getElementById('status-transmissao');
    const narracao = document.getElementById('narracao-container');

    if (jogoAoVivo) {
        jogoAtual = jogoAoVivo;

        // 2️⃣ MÁGICA DA IMERSÃO: Background Absoluto para o Estádio não falhar!
        try {
            document.body.style.background = "transparent";
            document.body.style.backgroundImage = `linear-gradient(rgba(18, 18, 18, 0.85), rgba(18, 18, 18, 0.98)), url('${getEstadio(jogoAoVivo.mandante)}')`;
            document.body.style.backgroundPosition = "center";
            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundAttachment = "fixed";
        } catch(e) {}

        // 3️⃣ MÁGICA DOS ESCUDOS E NOMES DOS PLAYERS:
        if (lblMandante) {
            let donoM = window.treinadoresGlobais[jogoAoVivo.mandante] ? `👤 ${window.treinadoresGlobais[jogoAoVivo.mandante]}` : `🤖 IA`;
            lblMandante.innerHTML = `
                <div style="display:inline-flex; flex-direction:column; align-items:flex-end; vertical-align: middle;">
                    <span style="font-size: 22px; line-height:1;">${jogoAoVivo.mandante.replace(/_/g, ' ')}</span>
                    <span style="font-size: 11px; color:#ff8c00; margin-top:2px;">${donoM}</span>
                </div>
                <img src="${getEscudo(jogoAoVivo.mandante)}" onerror="this.src='esculdos/default.png'" style="width: 40px; height: 40px; object-fit: contain; vertical-align: middle; margin-left: 12px; filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));">
            `;
        }
        if (lblVisitante) {
            let donoV = window.treinadoresGlobais[jogoAoVivo.visitante] ? `👤 ${window.treinadoresGlobais[jogoAoVivo.visitante]}` : `🤖 IA`;
            lblVisitante.innerHTML = `
                <img src="${getEscudo(jogoAoVivo.visitante)}" onerror="this.src='esculdos/default.png'" style="width: 40px; height: 40px; object-fit: contain; vertical-align: middle; margin-right: 12px; filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));">
                <div style="display:inline-flex; flex-direction:column; align-items:flex-start; vertical-align: middle;">
                    <span style="font-size: 22px; line-height:1;">${jogoAoVivo.visitante.replace(/_/g, ' ')}</span>
                    <span style="font-size: 11px; color:#ff8c00; margin-top:2px;">${donoV}</span>
                </div>
            `;
        }

        let linhaObj = jogoAoVivo.linhaDoTempo || [];
        let linhaArray = Array.isArray(linhaObj) ? linhaObj : Object.values(linhaObj);

        let placarMReal = jogoAoVivo.placarMandante !== undefined ? jogoAoVivo.placarMandante : 0;
        let placarVReal = jogoAoVivo.placarVisitante !== undefined ? jogoAoVivo.placarVisitante : 0;

        if (jaTerminouDeVerdade) {
            document.getElementById('gols-mandante').innerText = placarMReal;
            document.getElementById('gols-visitante').innerText = placarVReal;

            if(cronometro) { cronometro.innerText = "FIM"; cronometro.style.color = "#dc3545"; }
            if(statusTransmissao) { statusTransmissao.innerText = "Partida Encerrada 🏁"; statusTransmissao.style.animation = "none"; }

            if(narracao) {
                if (linhaArray.length > 0) {
                    narracao.innerHTML = `<div style="text-align:center; padding: 10px; color:#ff8c00; font-weight:bold; border-bottom:1px solid #333; margin-bottom:10px;">Resumo da Partida:</div>`;
                    linhaArray.forEach(evento => {
                        let escudoID = evento.tipo.includes("mandante") ? jogoAoVivo.mandante : jogoAoVivo.visitante;
                        let escudoHTML = `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;

                        let cor = '#ccc';
                        if (evento.tipo.includes('ataque_mandante')) cor = 'var(--verde-campo)';
                        if (evento.tipo.includes('ataque_visitante')) cor = '#ffc107';
                        if (evento.tipo.includes('gol_mandante')) cor = 'var(--verde-campo)';
                        if (evento.tipo.includes('gol_visitante')) cor = '#dc3545';
                        if (evento.tipo === 'penaltis') cor = '#ff8c00';
                        if (evento.tipo === 'intervalo' || evento.tipo === 'inicio') cor = '#007bff';

                        adicionarNarraçao(`${evento.minuto}'`, evento.texto, cor, (evento.tipo !== 'intervalo' && evento.tipo !== 'inicio' && evento.tipo !== 'penaltis') ? escudoID : null);
                    });
                } else { narracao.innerHTML = `<div style="text-align:center; padding: 20px; color:#aaa;">Partida sem lances computados (0x0).</div>`; }
            }

            if(!eventosJaTocados.has(`fim_${rodadaExibicao}`) && audioLiberado) {
                canalEfeitos.src = 'sounds/final_do_jogo.mp3'; canalEfeitos.play().catch(()=>{});
                canalTorcidaM.volume = 0.1; canalTorcidaV.volume = 0.1;
                eventosJaTocados.add(`fim_${rodadaExibicao}`);

                setTimeout(() => {
                    let somCampeao = (placarMReal > placarVReal) ? getHino(jogoAoVivo.mandante) : getHino(jogoAoVivo.visitante);
                    canalHino.src = somCampeao; canalHino.currentTime = 0; canalHino.volume = 0.2; canalHino.loop = true;
                    canalHino.play().catch(()=>{});
                }, 1500);
            }
        }
        else {
            let isAntesDaHora = (isHoje && new Date().getHours() < HORA_JOGO);

            // Variáveis injetadas para decidir o texto da tela
            let dataHoje = new Date();
            let [diaJ, mesJ] = (jogoAoVivo.data_jogo || "01/01").split(' ')[0].split('/');
            let jogoDT = new Date(dataHoje.getFullYear(), parseInt(mesJ)-1, parseInt(diaJ));
            jogoDT.setHours(0,0,0,0);
            let hojeDT = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), dataHoje.getDate());

            let isAtrasado = jogoDT < hojeDT;
            let isFuturo = jogoDT > hojeDT;

            if (isFuturo) {
                if(statusTransmissao) statusTransmissao.innerText = "Em Breve 📅";
                if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;"><h3 style="color: #666;">Partida Agendada</h3><p>Este jogo ocorrerá em ${jogoAoVivo.data_jogo}. Volte na data correta!</p></div>`;
            }
            else if (isAntesDaHora && !isAtrasado) {
                const horaAtual = new Date().getHours();
                const minAtual = new Date().getMinutes();
                let portoesAbertos = (horaAtual === (HORA_JOGO - 1) && minAtual >= 40);

                if (portoesAbertos) {
                    if(statusTransmissao) statusTransmissao.innerText = "Aquecimento 🏃‍♂️";
                    if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;">Os jogadores estão aquecendo. A partida começa às ${HORA_JOGO}:00!</div>`;
                } else {
                    if(statusTransmissao) statusTransmissao.innerText = "Aguardando Horário ⏳";
                    if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;"><h3 style="color: #666;">Os portões estão fechados.</h3><p>A transmissão abrirá às ${HORA_JOGO - 1}:40.</p></div>`;
                }
            }
            else if (!jogoAoVivo.jogado) {
                // MÁGICA: DEU A HORA OU É UM JOGO ATRASADO. MOSTRA O BOTÃO CERTO!
                let txtBotao = isAtrasado ? "🚜 SIMULAR ATRASADOS" : "⚽ INICIAR PARTIDA";
                if(statusTransmissao) { statusTransmissao.innerText = "Aguardando Início ⏱️"; statusTransmissao.style.animation = "piscar 1s infinite"; }
                if(narracao) narracao.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <h3 style="color: #ff8c00;">As equipes estão preparadas!</h3>
                        <p style="color:#aaa; font-size:14px; margin-bottom:15px;">Seja o primeiro a iniciar a simulação oficial desta rodada.</p>
                        <button onclick="gerarPartidaAoVivo()" style="background: #dc3545; color: white; padding: 12px 25px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; box-shadow: 0 0 15px rgba(220,53,69,0.5);">${txtBotao}</button>
                    </div>`;
            }
            else if (!audioLiberado) {
                if(statusTransmissao) statusTransmissao.innerText = "Sinal Encontrado 📡";
                if(narracao) narracao.innerHTML = `<div style="text-align: center; padding: 30px;"><h3 style="color: #ff8c00;">A bola já está rolando!</h3><button onclick="liberarAudio()" style="background: var(--verde-campo); color: white; padding: 10px 20px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px;">▶️ ENTRAR NO ESTÁDIO</button></div>`;
            }
            else {
                // TRANSMISSÃO AO VIVO COM RELÓGIO ATIVO
                if(statusTransmissao) { statusTransmissao.innerText = "Ao Vivo 🔴"; statusTransmissao.style.animation = "piscar 1s infinite"; }

                if (!canalTorcidaM.src || !canalTorcidaM.src.includes(jogoAoVivo.mandante.replace(/_/g, ' '))) {
                    canalTorcidaM.src = getTorcida(jogoAoVivo.mandante);
                    canalTorcidaV.src = getTorcida(jogoAoVivo.visitante);
                    canalTorcidaM.play().catch(()=>{}); canalTorcidaV.play().catch(()=>{});
                }

                // O pulo do gato: A TV agora usa o exato milissegundo em que o botão foi clicado!
                reproduzirLinhaDoTempo(linhaArray, jogoAoVivo.horaInicio, placarMReal, placarVReal);
            }
        }
    } else {
        if(lblMandante) lblMandante.innerHTML = "Folga"; if(lblVisitante) lblVisitante.innerHTML = "Folga";
        document.getElementById('gols-mandante').innerText = "-"; document.getElementById('gols-visitante').innerText = "-";
        if(cronometro) cronometro.innerText = "--'";
        if(statusTransmissao) statusTransmissao.innerText = "Sem Jogo";
        if(narracao) narracao.innerHTML = `<div style="text-align:center; padding: 30px; color:#aaa;">O seu clube não joga nesta rodada ou a fase sorteada ainda não tem confrontos.</div>`;
    }
}

function processarNarradorOficial() {
    if (narradorOficialOcupado || filaNarracaoOficial.length === 0) return;

    let evento = filaNarracaoOficial.shift();
    narradorOficialOcupado = true; // Tranca o narrador e o relógio visual!

    let isMandante = evento.tipo.includes("mandante");
    let isVisitante = evento.tipo.includes("visitante");
    let escudoID = isMandante ? jogoAtual.mandante : (isVisitante ? jogoAtual.visitante : null);

    let cor = '#ccc';
    if (evento.tipo.includes('ataque_mandante')) cor = 'var(--verde-campo)';
    if (evento.tipo.includes('ataque_visitante')) cor = '#ffc107';
    if (evento.tipo.includes('gol_mandante')) cor = 'var(--verde-campo)';
    if (evento.tipo.includes('gol_visitante')) cor = '#dc3545';
    if (evento.tipo === 'penaltis') cor = '#ff8c00';
    if (evento.tipo === 'intervalo' || evento.tipo === 'inicio') cor = '#007bff';

    let textoFinal = evento.texto;
    if (escudoID) {
        // Coloca a bandeira redondinha bem no começo do lance!
        let imgHtml = `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" style="width:16px; height:16px; vertical-align:middle; margin-right:5px; border-radius:50%;">`;
        textoFinal = imgHtml + textoFinal.replace("GOOOL DO", "GOOOL DO");
    }

    adicionarNarraçao(`${evento.minuto}'`, evento.texto, cor, (evento.tipo !== 'intervalo' && evento.tipo !== 'inicio' && evento.tipo !== 'penaltis') ? escudoID : null);

    if (evento.tipo === 'inicio') { somApito.play().catch(()=>{}); }

    if (evento.tipo.includes("gol")) {
        if (isMandante) {
            placarNarracaoM++; document.getElementById('gols-mandante').innerText = placarNarracaoM;
            if(audioLiberado) { canalTorcidaM.volume = 1.0; canalTorcidaV.volume = 0.0; }
        } else {
            placarNarracaoV++; document.getElementById('gols-visitante').innerText = placarNarracaoV;
            if(audioLiberado) { canalTorcidaM.volume = 0.0; canalTorcidaV.volume = 1.0; }
        }

        if(audioLiberado) {
            canalEfeitos.src = 'sounds/gol_generico.mp3'; canalEfeitos.play().catch(()=>{});
            setTimeout(() => { canalHino.src = getHino(escudoID); canalHino.volume = 0.4; canalHino.play().catch(()=>{}); }, 1500);

            // Pausa magistral de 12 segundos para o hino e festa no painel
            setTimeout(() => {
                canalHino.pause(); canalHino.currentTime = 0;
                atualizarTorcidasOficiais();
                narradorOficialOcupado = false;
                processarNarradorOficial();
            }, 12000);
        } else {
            setTimeout(() => { narradorOficialOcupado = false; processarNarradorOficial(); }, 2000);
        }
    } else {
        if (audioLiberado && evento.tipo.includes("ataque")) {
            if (isMandante) canalTorcidaM.volume = 0.8; else canalTorcidaV.volume = 0.8;
        }
        setTimeout(() => { atualizarTorcidasOficiais(); narradorOficialOcupado = false; processarNarradorOficial(); }, 3500);
    }
}

function reproduzirLinhaDoTempo(linha, horaInicioTstamp, placarMFinal, placarVFinal) {
    if (window.transmissaoOficialLoop) clearInterval(window.transmissaoOficialLoop);

    // MÁGICA: Se o cara entrou 1 minuto atrasado, descarrega os gols velhos instantaneamente na tela!
    const diferencaMsInit = Date.now() - horaInicioTstamp;
    let minutoInicial = Math.max(0, Math.floor(diferencaMsInit / 1333));

    let lancesPassados = linha.filter(l => l.minuto <= minutoInicial);
    lancesPassados.forEach(evento => {
        let idEvento = `${evento.minuto}_${evento.tipo}`;
        if (!eventosJaTocados.has(idEvento)) {
            eventosJaTocados.add(idEvento);
            let cor = '#ccc';
            if (evento.tipo.includes('ataque_mandante')) cor = 'var(--verde-campo)';
            if (evento.tipo.includes('ataque_visitante')) cor = '#ffc107';
            if (evento.tipo.includes('gol_mandante')) cor = 'var(--verde-campo)';
            if (evento.tipo.includes('gol_visitante')) cor = '#dc3545';
            if (evento.tipo === 'penaltis') cor = '#ff8c00';
            if (evento.tipo === 'intervalo' || evento.tipo === 'inicio') cor = '#007bff';

            let escudoID = evento.tipo.includes("mandante") ? jogoAtual.mandante : jogoAtual.visitante;
            let escudoHTML = `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;

            adicionarNarraçao(`${evento.minuto}'`, evento.texto, cor, (evento.tipo !== 'intervalo' && evento.tipo !== 'inicio' && evento.tipo !== 'penaltis') ? escudoID : null);

            if (evento.tipo.includes('gol_mandante')) placarNarracaoM++;
            if (evento.tipo.includes('gol_visitante')) placarNarracaoV++;
        }
    });

    document.getElementById('gols-mandante').innerText = placarNarracaoM;
    document.getElementById('gols-visitante').innerText = placarNarracaoV;
    document.getElementById('tempo-jogo').innerText = minutoInicial + "'";

    // INICIA O CRONÔMETRO AO VIVO A PARTIR DO MINUTO ATUAL
    window.transmissaoOficialLoop = setInterval(() => {
        if (narradorOficialOcupado) return; // Se estiver tocando Hino, o cronômetro trava!

        const diferencaMs = Date.now() - horaInicioTstamp;
        let minutoAtualJogo = Math.floor(diferencaMs / 1333);

        if (minutoAtualJogo > 95) {
            clearInterval(window.transmissaoOficialLoop);
            document.getElementById('tempo-jogo').innerText = "FIM";
            document.getElementById('tempo-jogo').style.color = "#dc3545";
            document.getElementById('gols-mandante').innerText = placarMFinal;
            document.getElementById('gols-visitante').innerText = placarVFinal;

            if(!eventosJaTocados.has("fim") && audioLiberado) {
                canalEfeitos.src = 'sounds/final_do_jogo.mp3'; canalEfeitos.play().catch(()=>{});
                canalTorcidaM.volume = 0.1; canalTorcidaV.volume = 0.1;

                setTimeout(() => {
                    let somCampeao = (placarMFinal > placarVFinal) ? getHino(jogoAtual.mandante) : getHino(jogoAtual.visitante);
                    canalHino.src = somCampeao; canalHino.currentTime = 0; canalHino.volume = 0.2; canalHino.loop = true;
                    canalHino.play().catch(()=>{});
                }, 1500);
                eventosJaTocados.add("fim");
            }
            return;
        }

        document.getElementById('tempo-jogo').innerText = minutoAtualJogo + "'";

        let lancesAgora = linha.filter(l => l.minuto === minutoAtualJogo);
        lancesAgora.forEach(evento => {
            let idEvento = `${evento.minuto}_${evento.tipo}`;
            if (!eventosJaTocados.has(idEvento)) {
                eventosJaTocados.add(idEvento);
                filaNarracaoOficial.push(evento);
            }
        });

        processarNarradorOficial();
    }, 300); // Roda rápido para injetar os lances na fila instantaneamente!
}

function adicionarNarraçao(tempo, texto, cor = "#ccc", escudoID = null) {
    const narracao = document.getElementById('narracao-container');
    if(!narracao) return;

    let imgHtml = escudoID ? `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" style="width:16px; height:16px; vertical-align:middle; margin-right:6px; border-radius:50%;">` : "";

    narracao.innerHTML += `
        <div style="margin-top:10px; border-bottom:1px dashed #333; padding-bottom:8px; display: flex; align-items: flex-start;">
            <strong style="color: ${cor}; font-size:15px; margin-right: 8px; flex-shrink:0;">${tempo}</strong>
            <span style="color: ${texto.includes('GOOOL') ? '#fff' : '#ccc'}; font-weight: ${texto.includes('GOOOL') ? 'bold' : 'normal'}; line-height: 1.4;">
                ${imgHtml}${texto}
            </span>
        </div>`;
    narracao.scrollTop = narracao.scrollHeight;
}

function processarNarradorOficial() {
    if (narradorOficialOcupado || filaNarracaoOficial.length === 0) return;

    let evento = filaNarracaoOficial.shift();
    narradorOficialOcupado = true; // Tranca o narrador e o relógio visual!

    let isMandante = evento.tipo.includes("mandante");
    let escudoID = isMandante ? jogoAtual.mandante : jogoAtual.visitante;
    let escudoHTML = `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;

    let cor = '#ccc';
    if (evento.tipo.includes('ataque_mandante')) cor = 'var(--verde-campo)';
    if (evento.tipo.includes('ataque_visitante')) cor = '#ffc107';
    if (evento.tipo.includes('gol_mandante')) cor = 'var(--verde-campo)';
    if (evento.tipo.includes('gol_visitante')) cor = '#dc3545';
    if (evento.tipo === 'penaltis') cor = '#ff8c00';
    if (evento.tipo === 'intervalo' || evento.tipo === 'inicio') cor = '#007bff';

    // Removemos o replace do GOOOL antigo, pois a bandeira agora vai no começo da frase!
    adicionarNarraçao(`${evento.minuto}'`, evento.texto, cor, (evento.tipo !== 'intervalo' && evento.tipo !== 'inicio' && evento.tipo !== 'penaltis') ? escudoID : null);

    if (evento.tipo === 'inicio') { somApito.play().catch(()=>{}); }

    if (evento.tipo.includes("gol")) {
        if (isMandante) {
            placarNarracaoM++; document.getElementById('gols-mandante').innerText = placarNarracaoM;
            if(audioLiberado) { canalTorcidaM.volume = 1.0; canalTorcidaV.volume = 0.0; }
        } else {
            placarNarracaoV++; document.getElementById('gols-visitante').innerText = placarNarracaoV;
            if(audioLiberado) { canalTorcidaM.volume = 0.0; canalTorcidaV.volume = 1.0; }
        }

        if(audioLiberado) {
            canalEfeitos.src = 'sounds/gol_generico.mp3'; canalEfeitos.play().catch(()=>{});
            setTimeout(() => { canalHino.src = getHino(escudoID); canalHino.volume = 0.4; canalHino.play().catch(()=>{}); }, 1500);

            // Pausa magistral de 12 segundos para o hino e festa no painel
            setTimeout(() => {
                canalHino.pause(); canalHino.currentTime = 0;
                atualizarTorcidasOficiais();
                narradorOficialOcupado = false;
                processarNarradorOficial();
            }, 12000);
        } else {
            setTimeout(() => { narradorOficialOcupado = false; processarNarradorOficial(); }, 2000);
        }
    } else {
        if (audioLiberado && evento.tipo.includes("ataque")) {
            if (isMandante) canalTorcidaM.volume = 0.8; else canalTorcidaV.volume = 0.8;
        }
        setTimeout(() => { atualizarTorcidasOficiais(); narradorOficialOcupado = false; processarNarradorOficial(); }, 3500);
    }
}

function reproduzirLinhaDoTempo(linha, horaInicioTstamp, placarMFinal, placarVFinal) {
    if (window.transmissaoOficialLoop) clearInterval(window.transmissaoOficialLoop);

    window.transmissaoOficialLoop = setInterval(() => {
        if (narradorOficialOcupado) return; // Se estiver tocando Hino, o cronômetro trava para você não perder nada!

        const diferencaMs = Date.now() - horaInicioTstamp;
        let minutoAtualJogo = Math.floor(diferencaMs / 1333); // O Motor Rápido (1 minuto = 1.33s)

        if (minutoAtualJogo > 95) {
            clearInterval(window.transmissaoOficialLoop);
            document.getElementById('tempo-jogo').innerText = "FIM";
            document.getElementById('tempo-jogo').style.color = "#dc3545";
            document.getElementById('gols-mandante').innerText = placarMFinal;
            document.getElementById('gols-visitante').innerText = placarVFinal;

            // Desliga a tag "Ao Vivo" quando o cronômetro chega ao fim!
            let statusTransmissao = document.getElementById('status-transmissao');
            if(statusTransmissao) {
                statusTransmissao.innerText = "Partida Encerrada 🏁";
                statusTransmissao.style.animation = "none";
            }

            if(!eventosJaTocados.has("fim") && audioLiberado) {
                canalEfeitos.src = 'sounds/final_do_jogo.mp3'; canalEfeitos.play().catch(()=>{});
                canalTorcidaM.volume = 0.1; canalTorcidaV.volume = 0.1;

                setTimeout(() => {
                    let somCampeao = (placarMFinal > placarVFinal) ? getHino(jogoAtual.mandante) : getHino(jogoAtual.visitante);
                    canalHino.src = somCampeao; canalHino.currentTime = 0; canalHino.volume = 0.2; canalHino.loop = true;
                    canalHino.play().catch(()=>{});
                }, 1500);
                eventosJaTocados.add("fim");
            }
            return;
        }

        document.getElementById('tempo-jogo').innerText = minutoAtualJogo + "'";

        let lancesAgora = linha.filter(l => l.minuto === minutoAtualJogo);
        lancesAgora.forEach(evento => {
            let idEvento = `${evento.minuto}_${evento.tipo}`;
            if (!eventosJaTocados.has(idEvento)) {
                eventosJaTocados.add(idEvento);
                filaNarracaoOficial.push(evento);
            }
        });

        processarNarradorOficial();
    }, 300); // Roda rápido para injetar os lances na fila instantaneamente!
}

function adicionarNarraçao(tempo, texto, cor = "#ccc") {
    const narracao = document.getElementById('narracao-container');
    if(!narracao) return;

    narracao.innerHTML += `
        <div style="margin-top:10px; border-bottom:1px dashed #333; padding-bottom:8px;">
            <strong style="color: ${cor}; font-size:15px; margin-right: 8px;">${tempo}</strong>
            <span style="color: ${texto.includes('GOOOL') ? '#fff' : '#ccc'}; font-weight: ${texto.includes('GOOOL') ? 'bold' : 'normal'};">${texto}</span>
        </div>`;
    narracao.scrollTop = narracao.scrollHeight;
}

// CONTROLE DO MENU MOBILE OTIMIZADO
function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    const menuAberto = sidebar.classList.toggle('aberta');
    if (menuAberto) document.body.classList.add('menu-aberto');
    else document.body.classList.remove('menu-aberto');
}

document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('aberta')) {
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('btn-menu')) {
            sidebar.classList.remove('aberta');
            document.body.classList.remove('menu-aberto');
        }
        if (!e.target.closest('.sidebar') && !e.target.closest('.btn-menu')) {
            sidebar.classList.remove('aberta');
            document.body.classList.remove('menu-aberto');
        }
    }
});

function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}

// ========================================================
// 🧠 GERADOR P2P: O PRIMEIRO QUE CLICA SIMULA O JOGO E SALVA NA NUVEM!
// ========================================================
window.gerarPartidaAoVivo = async function() {
    document.getElementById('narracao-container').innerHTML = `<div style="color: #ff8c00; text-align: center; padding: 30px; font-weight:bold;">Gerando simulação na nuvem... Aguarde.</div>`;

    try {
        const snapB = await db.ref('banco_global_times').once('value');
        const times = snapB.val() || {};
        const snapU = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
        const usuarios = snapU.val() || {};
        const snapCal = await db.ref(`ligas/${ligaLogada}/calendario`).once('value');
        const cal = snapCal.val() || {};

        let chave = rodadaExibicao.replace("camp_", "").replace("copa_", "");
        let isMataMata = rodadaExibicao.startsWith("copa_");
        let caminhoDivisao = isMataMata ? `copa/${chave}` : (divisaoAtual === "A" ? `serieA/${chave}` : `serieB/${chave}`);

        let rodadaObj = null;
        if (isMataMata && cal.copa) rodadaObj = cal.copa[chave];
        else if (!isMataMata && divisaoAtual === "A" && cal.serieA) rodadaObj = cal.serieA[chave];
        else if (!isMataMata && divisaoAtual === "B" && cal.serieB) rodadaObj = cal.serieB[chave];

        if (!rodadaObj || !rodadaObj[meuJogoId]) return alert("Erro ao encontrar a partida no calendário.");
        if (rodadaObj[meuJogoId].jogado) return alert("Alguém já iniciou esta rodada! A transmissão vai começar em instantes.");

        let updates = {};
        let tsAgora = Date.now(); // Grava a hora do clique para TODAS as partidas do servidor começarem simultaneamente!

        // Função interna inteligente para processar JOGO por JOGO da rodada
        const simularJogo = (jogo, idJ) => {
            if (jogo.jogado) return;

            let donoM = null; let donoV = null;
            let forcaM = times[jogo.mandante]?.forca_base || 500;
            let forcaV = times[jogo.visitante]?.forca_base || 500;
            let mentM = "Moderado"; let mentV = "Moderado";

            for (let u in usuarios) {
                if (usuarios[u].timeAtual === jogo.mandante) { if (usuarios[u].forcaAtual) forcaM = usuarios[u].forcaAtual; mentM = usuarios[u].mentalidade || "Moderado"; donoM = u; }
                if (usuarios[u].timeAtual === jogo.visitante) { if (usuarios[u].forcaAtual) forcaV = usuarios[u].forcaAtual; mentV = usuarios[u].mentalidade || "Moderado"; donoV = u; }
            }

            let fadigaM = (times[jogo.mandante]?.jogadores && Object.keys(times[jogo.mandante].jogadores).length > 11) ? 1.0 : 0.85;
            let fadigaV = (times[jogo.visitante]?.jogadores && Object.keys(times[jogo.visitante].jogadores).length > 11) ? 1.0 : 0.85;

            let modM = 1.0 * fadigaM; let modV = 1.0 * fadigaV;
            let capGolsM = 99; let capGolsV = 99;

            if (mentM === "Retranca") { modM *= 0.7; modV *= 0.5; capGolsM = 1; }
            if (mentM === "Ofensivo") { modM *= 1.3; modV *= 1.2; }
            if (mentV === "Retranca") { modV *= 0.7; modM *= 0.5; capGolsV = 1; }
            if (mentV === "Ofensivo") { modV *= 1.3; modM *= 1.2; }

            let golsM = 0; let golsV = 0;
            let linhaTempo = [];

            linhaTempo.push({ minuto: 1, tipo: 'inicio', texto: `🟢 APITA O ÁRBITRO! Rola a bola para a partida oficial!` });

            if (fadigaM === 1.0) linhaTempo.push({ minuto: Math.floor(Math.random() * 10) + 60, tipo: "sub", texto: `🔄 Substituição no ${jogo.mandante.replace(/_/g,' ')}: Fôlego novo!`, cor: "#aaa" });
            if (fadigaV === 1.0) linhaTempo.push({ minuto: Math.floor(Math.random() * 10) + 60, tipo: "sub", texto: `🔄 Substituição no ${jogo.visitante.replace(/_/g,' ')}: Alteração tática!`, cor: "#aaa" });

            // NOVA INTELIGÊNCIA DE NOMES E POSIÇÕES
                const sortearAtleta = (tId, posicoes = null) => {
                    let el = times[tId]?.jogadores ? Object.values(times[tId].jogadores) : [];
                    if(posicoes) {
                        let filtrados = el.filter(j => posicoes.includes(j.posicoes?.p));
                        if(filtrados.length > 0) return filtrados[Math.floor(Math.random() * filtrados.length)];
                    }
                    return el.length ? el[Math.floor(Math.random() * el.length)] : {nome: "Jogador"};
                };

                for(let i=0; i<16; i++) {
                    let minAleatorio = Math.floor(Math.random()*89)+1;
                    if (minAleatorio === 45) minAleatorio = 46;

                    let isM = Math.random() > 0.5;
                    let tAtq = isM ? jogoReal.mandante : jogoReal.visitante;
                    let tDef = isM ? jogoReal.visitante : jogoReal.mandante;
                    let tipoLance = isM ? 'ataque_mandante' : 'ataque_visitante';

                    // Seleciona os protagonistas do lance
                    let atk = sortearAtleta(tAtq, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
                    let mei = sortearAtleta(tAtq, ["Meia", "Volante"]).nome.split(" ")[0];
                    let zag = sortearAtleta(tDef, ["Zagueiro", "Lateral", "Volante"]).nome.split(" ")[0];
                    let gol = sortearAtleta(tDef, ["Goleiro"]).nome.split(" ")[0];

                    let frases = [
                        `UHHH! ${mei} deu um passe açucarado para ${atk}, que chutou raspando a trave!`,
                        `Bela jogada! ${atk} tentou a finta, mas ${zag} fez um desarme cirúrgico na bola!`,
                        `Troca de passes envolvente. ${mei} dita o ritmo no meio-campo.`,
                        `Cruzamento venenoso na área, ${atk} cabeceia e o goleiro ${gol} faz uma defesa espetacular!`,
                        `PERIGO! ${atk} arranca com velocidade, deixa a zaga para trás, mas o chute vai direto para fora.`,
                        `MILAGRE! ${atk} finaliza à queima-roupa e ${gol} salva a pátria com a ponta dos dedos!`,
                        `Chuteira calibrada! ${mei} arrisca uma bomba de muito longe, a bola passa assustando a zaga!`,
                        `Falta dura de ${zag} em cima de ${atk}. O juiz marca a infração, mas guarda o cartão.`
                    ];

                    linhaTempo.push({ minuto: minAleatorio, tipo: tipoLance, texto: frases[Math.floor(Math.random()*frases.length)] });
                }

            let gkM_id = Object.keys(times[jogo.mandante]?.jogadores || {}).find(k => times[jogo.mandante].jogadores[k].posicoes?.p === "Goleiro");
            let gkV_id = Object.keys(times[jogo.visitante]?.jogadores || {}).find(k => times[jogo.visitante].jogadores[k].posicoes?.p === "Goleiro");

            if (gkM_id) { let gkM = times[jogo.mandante].jogadores[gkM_id]; gkM.estatisticas = gkM.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0}; gkM.estatisticas.jogos = (gkM.estatisticas.jogos || 0) + 1; updates[`banco_global_times/${jogo.mandante}/jogadores/${gkM_id}`] = gkM; }
            if (gkV_id) { let gkV = times[jogo.visitante].jogadores[gkV_id]; gkV.estatisticas = gkV.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0}; gkV.estatisticas.jogos = (gkV.estatisticas.jogos || 0) + 1; updates[`banco_global_times/${jogo.visitante}/jogadores/${gkV_id}`] = gkV; }

            for(let i=0; i<5; i++) {
                if (golsM < capGolsM && Math.random() < ((forcaM / (forcaM + forcaV)) * modM * 0.6)) {
                    golsM++;
                    if (gkV_id) { let gkV = times[jogo.visitante].jogadores[gkV_id]; gkV.estatisticas.gols_sofridos = (gkV.estatisticas.gols_sofridos || 0) + 1; updates[`banco_global_times/${jogo.visitante}/jogadores/${gkV_id}`] = gkV; }
                    let idA = sortearAtleta(jogo.mandante); let nA = idA ? times[jogo.mandante].jogadores[idA].nome.split(" ")[0] : "Jogador";
                    if(idA) {
                        let jg = times[jogo.mandante].jogadores[idA]; jg.estatisticas = jg.estatisticas || {gols:0, assistencias:0}; jg.estatisticas.gols++; jg.valor_mercado = (jg.valor_mercado||1000000) + 1000000;
                        if (Math.random() > 0.4) { let idAst = sortearAtleta(jogo.mandante); if (idAst && idAst !== idA) { let jgAst = times[jogo.mandante].jogadores[idAst]; jgAst.estatisticas = jgAst.estatisticas || {gols:0, assistencias:0}; jgAst.estatisticas.assistencias++; updates[`banco_global_times/${jogo.mandante}/jogadores/${idAst}`] = jgAst; } }
                        updates[`banco_global_times/${jogo.mandante}/jogadores/${idA}`] = jg;
                    }
                    linhaTempo.push({ minuto: Math.floor(Math.random()*89)+1, tipo: "gol_mandante", texto: `⚽ GOOOL! ${nA} estufa as redes e corre para os braços da torcida!` });
                }
                if (golsV < capGolsV && Math.random() < ((forcaV / (forcaM + forcaV)) * modV * 0.6)) {
                    golsV++;
                    let idA = sortearAtleta(jogo.visitante); let nA = idA ? times[jogo.visitante].jogadores[idA].nome.split(" ")[0] : "Jogador";
                    if(idA) {
                        let jg = times[jogo.visitante].jogadores[idA]; jg.estatisticas = jg.estatisticas || {gols:0, assistencias:0}; jg.estatisticas.gols++; jg.valor_mercado = (jg.valor_mercado||1000000) + 1000000;
                        if (Math.random() > 0.4) { let idAst = sortearAtleta(jogo.visitante); if (idAst && idAst !== idA) { let jgAst = times[jogo.visitante].jogadores[idAst]; jgAst.estatisticas = jgAst.estatisticas || {gols:0, assistencias:0}; jgAst.estatisticas.assistencias++; updates[`banco_global_times/${jogo.visitante}/jogadores/${idAst}`] = jgAst; } }
                        updates[`banco_global_times/${jogo.visitante}/jogadores/${idA}`] = jg;
                    }
                    linhaTempo.push({ minuto: Math.floor(Math.random()*89)+1, tipo: "gol_visitante", texto: `⚽ GOOOL! ${nA} estufa as redes e corre para os braços da torcida!` });
                }
                if (gkM_id) { let gkM = times[jogo.mandante].jogadores[gkM_id]; gkM.estatisticas.gols_sofridos = (gkM.estatisticas.gols_sofridos || 0) + 1; updates[`banco_global_times/${jogo.mandante}/jogadores/${gkM_id}`] = gkM; }
            }

            if (!linhaTempo.some(l => l.minuto === 45 && l.tipo.includes('gol'))) {
                linhaTempo.push({ minuto: 45, tipo: 'intervalo', texto: `⏱️ Fim do Primeiro Tempo! Os jogadores vão para o vestiário.` });
            }

            if (isMataMata && golsM === golsV && jogo.mandante !== "Fantasma" && jogo.visitante !== "Fantasma") {
                linhaTempo.push({ minuto: 95, tipo: "penaltis", texto: `⚖️ Fim de Jogo Empatado! A decisão vai para os PÊNALTIS!` });
                if (Math.random() > 0.5) {
                    golsM++;
                    linhaTempo.push({ minuto: 99, tipo: "gol_mandante", texto: `🏆 O ${jogo.mandante.replace(/_/g,' ')} VENCEU A DISPUTA DE PÊNALTIS!` });
                } else {
                    golsV++;
                    linhaTempo.push({ minuto: 99, tipo: "gol_visitante", texto: `🏆 O ${jogo.visitante.replace(/_/g,' ')} VENCEU A DISPUTA DE PÊNALTIS!` });
                }
            }

            linhaTempo.sort((a,b) => a.minuto - b.minuto);

            if (donoM) {
                let pub = 15000 + ((usuarios[donoM].moral||50) * 400); let ren = pub * 60;
                let cxa = (usuarios[donoM].caixaClube || 0) + ren;
                updates[`ligas/${ligaLogada}/usuarios/${donoM}/caixaClube`] = cxa;
                linhaTempo.unshift({ minuto: 0, tipo: "renda", texto: `🎟️ Renda: R$ ${ren.toLocaleString('pt-BR')} (${pub.toLocaleString('pt-BR')} pagantes)` });
            }

            if (golsM > golsV) { if(donoM) updates[`ligas/${ligaLogada}/usuarios/${donoM}/moral`] = Math.min(100, (usuarios[donoM].moral||50)+10); if(donoV) updates[`ligas/${ligaLogada}/usuarios/${donoV}/moral`] = Math.max(0, (usuarios[donoV].moral||50)-10); }
            else if (golsV > golsM) { if(donoV) updates[`ligas/${ligaLogada}/usuarios/${donoV}/moral`] = Math.min(100, (usuarios[donoV].moral||50)+10); if(donoM) updates[`ligas/${ligaLogada}/usuarios/${donoM}/moral`] = Math.max(0, (usuarios[donoM].moral||50)-10); }

            jogo.linhaDoTempo = linhaTempo;
            jogo.horaInicio = tsAgora;
            jogo.placarMandante = golsM;
            jogo.placarVisitante = golsV;
            jogo.jogado = true;

            updates[`ligas/${ligaLogada}/calendario/${caminhoDivisao}/${idJ}`] = jogo;

            if (isMataMata) {
                let f = chave;
                let vencedor = golsM > golsV ? jogo.mandante : jogo.visitante;
                let num = parseInt(idJ.split('_')[1]);

                if (f === "oitavas" && cal.copa.quartas) { let tgt = `jogo_${9 + Math.floor((num-1)/2)}`; num%2!==0 ? updates[`ligas/${ligaLogada}/calendario/copa/quartas/${tgt}/mandante`] = vencedor : updates[`ligas/${ligaLogada}/calendario/copa/quartas/${tgt}/visitante`] = vencedor; }
                else if (f === "quartas" && cal.copa.semis) { let tgt = `jogo_${13 + Math.floor((num-9)/2)}`; num%2!==0 ? updates[`ligas/${ligaLogada}/calendario/copa/semis/${tgt}/mandante`] = vencedor : updates[`ligas/${ligaLogada}/calendario/copa/semis/${tgt}/visitante`] = vencedor; }
                else if (f === "semis" && cal.copa.final) { let tgt = `jogo_15`; num===13 ? updates[`ligas/${ligaLogada}/calendario/copa/final/${tgt}/mandante`] = vencedor : updates[`ligas/${ligaLogada}/calendario/copa/final/${tgt}/visitante`] = vencedor; }
                else if (f === "final") { updates[`ligas/${ligaLogada}/calendario/sistema_campeao_copa`] = vencedor; }
            }
        };

        // 🚜 TRATOR ATIVADO PELA TV: Simula todos os jogos da rodada que estão faltando!
        for (let idJ in rodadaObj) {
            if (!rodadaObj[idJ].jogado) simularJogo(rodadaObj[idJ], idJ);
        }

        await db.ref().update(updates);
        // Não precisa fazer mais nada, o Firebase vai ver o 'update' e disparar a TV pra todos que estão assistindo!

    } catch (e) {
        console.error("Erro ao gerar partida:", e);
        alert("Houve um erro ao se conectar com o servidor.");
    }
};