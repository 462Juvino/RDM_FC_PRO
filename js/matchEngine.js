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
// MÁQUINA DE ÁUDIO DINÂMICO
// ==========================================
let audioLiberado = false;
const canalTorcida = new Audio();
const canalEfeitos = new Audio();
const canalHino = new Audio();

canalTorcida.loop = true;
canalTorcida.volume = 0.3;

let eventosJaTocados = new Set();

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

function liberarAudio() {
    audioLiberado = true;
    const narracao = document.getElementById('narracao-container');
    if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center;">Áudio e vídeo conectados! Aguardando rolar a bola...</div>`;

    if (jogoAtual && jogoAtual.linhaDoTempo) {
        reproduzirLinhaDoTempo(jogoAtual.linhaDoTempo, jogoAtual.horaInicio, jogoAtual.placarMandante, jogoAtual.placarVisitante);
    }
}

// ==========================================
// LÓGICA DE TRANSMISSÃO COM SELETOR DE RODADAS
// ==========================================
let calGlobal = null;
let rodadaExibicao = null;

function iniciarTransmissao() {
    db.ref(`ligas/${ligaLogada}/calendario`).on('value', (snapCal) => {
        calGlobal = snapCal.val();
        if (!calGlobal) return;

        rodadaSistema = calGlobal.rodadaAtual || 1;
        if (!rodadaExibicao) rodadaExibicao = rodadaSistema;

        renderizarPartida();
    });
}

window.mudarRodadaTransmissao = function(novaRodada) {
    rodadaExibicao = parseInt(novaRodada);
    renderizarPartida();
};

function renderizarPartida() {
    // 1. Cria o Filtro (Dropdown) na Interface (Escudo Anti-Null)
    const topoRodada = document.getElementById('lbl-rodada-top');
    if (topoRodada) {
        let selectHtml = `<select onchange="mudarRodadaTransmissao(this.value)" style="background:#1a1a1a; color:var(--verde-campo); border:1px solid #444; padding:2px 5px; border-radius:4px; font-weight:bold; outline:none; margin-left: 5px; cursor: pointer;">`;
        for (let r = 1; r <= rodadaSistema; r++) {
            selectHtml += `<option value="${r}" ${r === rodadaExibicao ? 'selected' : ''}>Rodada ${r}</option>`;
        }
        selectHtml += `</select>`;
        topoRodada.innerHTML = selectHtml;
    }

    // 2. Busca o Jogo da Rodada Selecionada
    const rodadaKey = `rodada_${rodadaExibicao}`;
    const jogosDaDivisao = divisaoAtual === "A" ? calGlobal.serieA[rodadaKey] : calGlobal.serieB[rodadaKey];

    let jogoAoVivo = null;
    if (jogosDaDivisao) {
        for (let j in jogosDaDivisao) {
            if (jogosDaDivisao[j].mandante === dadosUsuario.timeAtual || jogosDaDivisao[j].visitante === dadosUsuario.timeAtual) {
                meuJogoId = j;
                jogoAoVivo = jogosDaDivisao[j];
                break;
            }
        }
    }

    // 3. Resgata os Elementos da Tela
    const lblMandante = document.getElementById('placar-nome-mandante');
    const lblVisitante = document.getElementById('placar-nome-visitante');
    const lblGolsM = document.getElementById('gols-mandante');
    const lblGolsV = document.getElementById('gols-visitante');
    const cronometro = document.getElementById('tempo-jogo');
    const statusTransmissao = document.getElementById('status-transmissao');
    const narracao = document.getElementById('narracao-container');

    // 4. Renderiza a Tela
    if (jogoAoVivo) {
        jogoAtual = jogoAoVivo;

        // Tenta puxar o estádio, se der erro ignora para não travar
        try {
            document.body.style.backgroundImage = `linear-gradient(rgba(18, 18, 18, 0.7), rgba(18, 18, 18, 0.9)), url('${getEstadio(jogoAoVivo.visitante)}')`;
        } catch(e) {}

        if (lblMandante) lblMandante.innerHTML = `${jogoAoVivo.mandante.replace(/_/g, ' ')} <img src="${getEscudo(jogoAoVivo.mandante)}" onerror="this.src='esculdos/default.png'" class="escudo-placar">`;
        if (lblVisitante) lblVisitante.innerHTML = `<img src="${getEscudo(jogoAoVivo.visitante)}" onerror="this.src='esculdos/default.png'" class="escudo-placar"> ${jogoAoVivo.visitante.replace(/_/g, ' ')}`;

        let tempoPassado = jogoAoVivo.horaInicio ? (Date.now() - jogoAoVivo.horaInicio) / 1000 : 999;
        let jaTerminouDeVerdade = jogoAoVivo.jogado || tempoPassado > 95;

        // 🛡️ PROTEÇÃO FIREBASE
        let linhaObj = jogoAoVivo.linhaDoTempo || [];
        let linhaArray = Array.isArray(linhaObj) ? linhaObj : Object.values(linhaObj);

        let golsMCount = linhaArray.filter(e => e.tipo && e.tipo.includes('gol_mandante')).length;
        let golsVCount = linhaArray.filter(e => e.tipo && e.tipo.includes('gol_visitante')).length;

        let placarMReal = jogoAoVivo.placarMandante !== undefined ? jogoAoVivo.placarMandante : golsMCount;
        let placarVReal = jogoAoVivo.placarVisitante !== undefined ? jogoAoVivo.placarVisitante : golsVCount;

        if (jaTerminouDeVerdade) {
            if(lblGolsM) lblGolsM.innerText = placarMReal;
            if(lblGolsV) lblGolsV.innerText = placarVReal;

            if(cronometro) {
                cronometro.innerText = "FIM";
                cronometro.style.color = "#dc3545";
            }
            if(statusTransmissao) {
                statusTransmissao.innerText = "Partida Encerrada 🏁";
                statusTransmissao.style.animation = "none";
            }

            if(narracao) {
                if (linhaArray.length > 0) {
                    narracao.innerHTML = `<div style="text-align:center; padding: 10px; color:#ff8c00; font-weight:bold; border-bottom:1px solid #333; margin-bottom:10px;">Resumo da Partida:</div>`;
                    linhaArray.forEach(evento => {
                        let escudoID = evento.tipo.includes("mandante") ? jogoAoVivo.mandante : jogoAoVivo.visitante;
                        let escudoHTML = `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;
                        let txt = evento.texto.replace("GOOOL DO", `GOOOL DO ${escudoHTML}`);
                        adicionarNarraçao(`${evento.minuto}'`, txt, evento.cor);
                    });
                } else {
                     narracao.innerHTML = `<div style="text-align:center; padding: 20px; color:#aaa;">O juiz apitou o fim de jogo! Partida sem lances de perigo ou melhores momentos (0x0).</div>`;
                }
            }

            if(!eventosJaTocados.has(`fim_${rodadaExibicao}`) && audioLiberado && rodadaExibicao === rodadaSistema) {
                canalEfeitos.src = 'sounds/final_do_jogo.mp3';
                canalEfeitos.play().catch(()=>{});
                canalTorcida.volume = 0.1;
                eventosJaTocados.add(`fim_${rodadaExibicao}`);
            }
        }
        else {
            if(lblGolsM) lblGolsM.innerText = "0";
            if(lblGolsV) lblGolsV.innerText = "0";
            if(cronometro) {
                cronometro.innerText = "00'";
                cronometro.style.color = "#fff";
            }

            // TRAVA DE TEMPO
            const agora = new Date();
            const horaAtual = agora.getHours();
            const minAtual = agora.getMinutes();
            const HORA_JOGO = 20; // 20:00

            let horarioPermitido = false;
            if (horaAtual > (HORA_JOGO - 1)) horarioPermitido = true;
            if (horaAtual === (HORA_JOGO - 1) && minAtual >= 40) horarioPermitido = true;

            if (rodadaExibicao < rodadaSistema) {
                 if(statusTransmissao) statusTransmissao.innerText = "Atrasado ⚠️";
                 if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;">Aguardando o processamento desta partida no servidor...</div>`;
            }
            else if (!horarioPermitido) {
                if(statusTransmissao) statusTransmissao.innerText = "Aguardando Horário ⏳";
                if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;">
                    <h3 style="color: #666;">Os portões do estádio ainda estão fechados.</h3>
                    <p>A transmissão abrirá 20 minutos antes do jogo (19:40).</p>
                </div>`;
            }
            else if (!audioLiberado) {
                if(statusTransmissao) statusTransmissao.innerText = "Sinal Encontrado 📡";
                if(narracao) narracao.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <h3 style="color: #ff8c00;">A transmissão está pronta!</h3>
                        <button onclick="liberarAudio()" style="background: var(--verde-campo); color: white; padding: 10px 20px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px;">▶️ LIGAR SOM E ENTRAR NO ESTÁDIO</button>
                    </div>`;
            }
            else if (linhaArray.length > 0) {
                if(statusTransmissao) {
                    statusTransmissao.innerText = "Ao Vivo 🔴";
                    statusTransmissao.style.animation = "piscar 1s infinite";
                }

                if (canalTorcida.src === "") {
                    // Proteção de áudio
                    canalTorcida.src = `sounds/torcida_${jogoAoVivo.mandante}.mp3`;
                    canalTorcida.onerror = () => { canalTorcida.src = 'sounds/torcida_generica.mp3'; canalTorcida.play().catch(()=>{}); };
                    canalTorcida.play().catch(()=>{});
                }

                reproduzirLinhaDoTempo(linhaArray, jogoAoVivo.horaInicio, placarMReal, placarVReal);
            }
            else {
                if(statusTransmissao) statusTransmissao.innerText = "Aquecimento 🏃‍♂️";
            }
        }
    } else {
        if(lblMandante) lblMandante.innerHTML = "Folga";
        if(lblVisitante) lblVisitante.innerHTML = "Folga";
        if(lblGolsM) lblGolsM.innerText = "-";
        if(lblGolsV) lblGolsV.innerText = "-";
        if(cronometro) cronometro.innerText = "--'";
        if(statusTransmissao) statusTransmissao.innerText = "Sem Jogo";
        if(narracao) narracao.innerHTML = `<div style="text-align:center; padding: 30px; color:#aaa;">O seu clube não joga nesta rodada.</div>`;
    }
}

function reproduzirLinhaDoTempo(linha, horaInicioTstamp, placarMFinal, placarVFinal) {
    const agora = Date.now();
    const diferencaSegundos = Math.floor((agora - horaInicioTstamp) / 1000);
    let minutoAtualJogo = diferencaSegundos;

    const lblGolsM = document.getElementById('gols-mandante');
    const lblGolsV = document.getElementById('gols-visitante');
    const cronometro = document.getElementById('tempo-jogo');
    const statusTransmissao = document.getElementById('status-transmissao');
    const narracao = document.getElementById('narracao-container');

    if (minutoAtualJogo > 95) {
        if(cronometro) {
            cronometro.innerText = "FIM";
            cronometro.style.color = "#dc3545";
        }
        if(statusTransmissao) {
            statusTransmissao.innerText = "Partida Encerrada 🏁";
            statusTransmissao.style.animation = "none";
        }
        if(lblGolsM) lblGolsM.innerText = placarMFinal;
        if(lblGolsV) lblGolsV.innerText = placarVFinal;

        if(!eventosJaTocados.has("fim") && audioLiberado) {
            canalEfeitos.src = 'sounds/final_do_jogo.mp3';
            canalEfeitos.play().catch(()=>{});
            canalTorcida.volume = 0.1;
            eventosJaTocados.add("fim");
        }
        location.reload();
        return;
    }

    if(cronometro) cronometro.innerText = minutoAtualJogo + "'";

    let golsM = 0; let golsV = 0;
    if(narracao) narracao.innerHTML = "";

    linha.forEach(evento => {
        if (evento.minuto <= minutoAtualJogo) {
            if (evento.tipo.includes("gol_mandante")) golsM++;
            if (evento.tipo.includes("gol_visitante")) golsV++;

            let escudoID = evento.tipo.includes("mandante") ? jogoAtual.mandante : jogoAtual.visitante;
            let escudoHTML = `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;
            let textoComEscudo = evento.texto.replace("GOOOL DO", `GOOOL DO ${escudoHTML}`);

            adicionarNarraçao(`${evento.minuto}'`, textoComEscudo, evento.cor);

            let idEvento = `${evento.minuto}_${evento.tipo}`;
            if (evento.tipo.includes("gol") && !eventosJaTocados.has(idEvento) && audioLiberado) {
                eventosJaTocados.add(idEvento);
                dispararAudioGol(escudoID);
            }
        }
    });

    if(lblGolsM) lblGolsM.innerText = golsM;
    if(lblGolsV) lblGolsV.innerText = golsV;

    let souMandante = (dadosUsuario.timeAtual === jogoAtual.mandante);
    if (souMandante) {
        if (golsM > golsV) canalTorcida.volume = 0.8;
        else if (golsM < golsV) canalTorcida.volume = 0.2;
        else canalTorcida.volume = 0.4;
    }
}

function dispararAudioGol(timeQueMarcou) {
    let volAnterior = canalTorcida.volume;
    canalTorcida.volume = 0.1;

    canalEfeitos.src = 'sounds/gol_generico.mp3';
    canalEfeitos.play().catch(()=>{});

    setTimeout(() => {
        canalHino.src = `sounds/hino_${timeQueMarcou}.mp3`;
        canalHino.play().catch(()=>{});

        setTimeout(() => {
            canalHino.pause();
            canalTorcida.volume = volAnterior;
        }, 10000);

    }, 2000);
}

function adicionarNarraçao(tempo, texto, cor = "#ccc") {
    const narracao = document.getElementById('narracao-container');
    if(!narracao) return;

    narracao.innerHTML += `
        <div style="border-bottom: 1px dashed #333; padding-bottom: 8px;">
            <strong style="color: var(--verde-campo); margin-right: 8px;">${tempo}</strong>
            <span style="color: ${cor};">${texto}</span>
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