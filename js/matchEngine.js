// js/matchEngine.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let divisaoAtual = "A";
let rodadaSistema = 1;
let meuJogoId = null;
let jogoAtual = null;

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

    if (topoRodada && (!rodadaExibicao || !document.getElementById('select-rodada-transmissao'))) {
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

    if (!rodadaExibicao) rodadaExibicao = `camp_rodada_${rodadaSistema}`;

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

        horaInicioFake.setHours(HORA_JOGO, 0, 0, 0);

        if (isHoje) {
            tempoPassadoMs = Date.now() - horaInicioFake.getTime();
        }

        // 🚨 O GRANDE SEGREDO: A Janela de TV! 🚨
        // O Jogo fica "Ao Vivo" entre 19:00:00 e 19:02:10!
        let rodandoAoVivo = (isHoje && tempoPassadoMs >= 0 && tempoPassadoMs <= 130000);
        jaTerminouDeVerdade = isAtrasado || (!rodandoAoVivo && jogoAoVivo.jogado) || (!rodandoAoVivo && isHoje && tempoPassadoMs > 130000);
    }

    const lblMandante = document.getElementById('placar-nome-mandante');
    const lblVisitante = document.getElementById('placar-nome-visitante');
    const cronometro = document.getElementById('tempo-jogo');
    const statusTransmissao = document.getElementById('status-transmissao');
    const narracao = document.getElementById('narracao-container');

    if (jogoAoVivo) {
        jogoAtual = jogoAoVivo;
        try { document.body.style.backgroundImage = `linear-gradient(rgba(18, 18, 18, 0.7), rgba(18, 18, 18, 0.9)), url('${getEstadio(jogoAoVivo.mandante)}')`; } catch(e) {}

        if (lblMandante) lblMandante.innerHTML = `${jogoAoVivo.mandante.replace(/_/g, ' ')} <img src="${getEscudo(jogoAoVivo.mandante)}" onerror="this.src='esculdos/default.png'" class="escudo-placar">`;
        if (lblVisitante) lblVisitante.innerHTML = `<img src="${getEscudo(jogoAoVivo.visitante)}" onerror="this.src='esculdos/default.png'" class="escudo-placar"> ${jogoAoVivo.visitante.replace(/_/g, ' ')}`;

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

                        adicionarNarraçao(`${evento.minuto}'`, evento.texto.replace("GOOOL DO", `GOOOL DO ${escudoHTML}`), cor);
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
            if (tempoPassadoMs < 0) {
                // ANTES DA HORA DO JOGO!
                const horaAtual = new Date().getHours();
                const minAtual = new Date().getMinutes();
                let portoesAbertos = (horaAtual === (HORA_JOGO - 1) && minAtual >= 40);

                if (portoesAbertos) {
                    if(statusTransmissao) statusTransmissao.innerText = "Aquecimento 🏃‍♂️";
                    if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;">Os jogadores estão no gramado aquecendo. A partida começa às ${HORA_JOGO}:00!</div>`;
                } else {
                    if(statusTransmissao) statusTransmissao.innerText = "Aguardando Horário ⏳";
                    if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;"><h3 style="color: #666;">Os portões estão fechados.</h3><p>A transmissão abrirá às ${HORA_JOGO - 1}:40.</p></div>`;
                }
            }
            else if (linhaArray.length === 0) {
                // É O HORÁRIO, MAS O MOTOR AINDA TÁ SALVANDO
                if(statusTransmissao) { statusTransmissao.innerText = "Conectando 📡"; statusTransmissao.style.animation = "piscar 1s infinite"; }
                if(narracao) narracao.innerHTML = `<div style="color: #ff8c00; text-align: center; padding: 30px; font-weight:bold;">O árbitro está conferindo as redes com o VAR. O jogo vai rolar em segundos!</div>`;
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
                reproduzirLinhaDoTempo(linhaArray, horaInicioFake.getTime(), placarMReal, placarVReal);
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
    let escudoID = isMandante ? jogoAtual.mandante : jogoAtual.visitante;
    let escudoHTML = `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;

    let cor = '#ccc';
    if (evento.tipo.includes('ataque_mandante')) cor = 'var(--verde-campo)';
    if (evento.tipo.includes('ataque_visitante')) cor = '#ffc107';
    if (evento.tipo.includes('gol_mandante')) cor = 'var(--verde-campo)';
    if (evento.tipo.includes('gol_visitante')) cor = '#dc3545';
    if (evento.tipo === 'penaltis') cor = '#ff8c00';
    if (evento.tipo === 'intervalo' || evento.tipo === 'inicio') cor = '#007bff';

    adicionarNarraçao(`${evento.minuto}'`, evento.texto.replace("GOOOL DO", `GOOOL DO ${escudoHTML}`), cor);

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

            adicionarNarraçao(`${evento.minuto}'`, evento.texto.replace("GOOOL DO", `GOOOL DO ${escudoHTML}`), cor);

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

    adicionarNarraçao(`${evento.minuto}'`, evento.texto.replace("GOOOL DO", `GOOOL DO ${escudoHTML}`), cor);

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