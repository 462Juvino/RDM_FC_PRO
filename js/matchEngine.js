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
const canalEfeitos = new Audio(); // Gol e Apito
const canalHino = new Audio();

canalTorcida.loop = true;
canalTorcida.volume = 0.3; // Volume base calmo

let eventosJaTocados = new Set(); // Evita tocar o mesmo gol 2 vezes

const lblMandante = document.getElementById('placar-nome-mandante');
const lblVisitante = document.getElementById('placar-nome-visitante');
const lblGolsM = document.getElementById('gols-mandante');
const lblGolsV = document.getElementById('gols-visitante');
const cronometro = document.getElementById('tempo-jogo');
const statusTransmissao = document.getElementById('status-transmissao');
const narracao = document.getElementById('narracao-container');

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
        dadosUsuario = snapUser.val();
        if(!dadosUsuario || dadosUsuario.timeAtual === "Sem Clube") return window.location.href = "dashboard.html";

        const snapTime = await db.ref(`banco_global_times/${dadosUsuario.timeAtual}`).once('value');
        if (snapTime.exists()) divisaoAtual = snapTime.val().divisao;

        narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 20px;">Buscando sinal do satélite...</div>`;

        iniciarTransmissao();
    } catch (e) { console.error(e); }
});

function liberarAudio() {
    audioLiberado = true;
    narracao.innerHTML = `<div style="color: #aaa; text-align: center;">Áudio e vídeo conectados! Aguardando rolar a bola...</div>`;

    if (jogoAtual && jogoAtual.linhaDoTempo) {
        reproduzirLinhaDoTempo(jogoAtual.linhaDoTempo, jogoAtual.horaInicio);
    }
}

function gerarImgEscudo(timeId, dadosTimeBanco) {
    if (dadosTimeBanco && dadosTimeBanco.escudo_base64) {
        return `<img src="${dadosTimeBanco.escudo_base64}" class="escudo-mini">`;
    }
    return `<img src="esculdos/${timeId}.png" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;
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
    // 1. Cria o Filtro (Dropdown) na Interface
    let selectHtml = `<select onchange="mudarRodadaTransmissao(this.value)" style="background:#1a1a1a; color:var(--verde-campo); border:1px solid #444; padding:2px 5px; border-radius:4px; font-weight:bold; outline:none; margin-left: 5px; cursor: pointer;">`;
    for (let r = 1; r <= rodadaSistema; r++) {
        selectHtml += `<option value="${r}" ${r === rodadaExibicao ? 'selected' : ''}>Rodada ${r}</option>`;
    }
    selectHtml += `</select>`;
    document.getElementById('lbl-rodada-top').innerHTML = selectHtml;

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

    // 3. Renderiza a Tela
    if (jogoAoVivo) {
        jogoAtual = jogoAoVivo;

        document.body.style.backgroundImage = `linear-gradient(rgba(18, 18, 18, 0.7), rgba(18, 18, 18, 0.9)), url('estadios/${jogoAoVivo.visitante}.jpg')`;

        lblMandante.innerHTML = `${jogoAoVivo.mandante.replace(/_/g, ' ')} <img src="esculdos/${jogoAoVivo.mandante}.png" onerror="this.src='esculdos/default.png'" class="escudo-placar">`;
        lblVisitante.innerHTML = `<img src="esculdos/${jogoAoVivo.visitante}.png" onerror="this.src='esculdos/default.png'" class="escudo-placar"> ${jogoAoVivo.visitante.replace(/_/g, ' ')}`;

        let tempoPassado = jogoAoVivo.horaInicio ? (Date.now() - jogoAoVivo.horaInicio) / 1000 : 999;
        let jaTerminouDeVerdade = jogoAoVivo.jogado || tempoPassado > 95;

        // 🛡️ PROTEÇÃO FIREBASE: Garante que a linha do tempo seja lida, mesmo se o Firebase transformar em Objeto ou apagar (0 a 0)
        let linhaObj = jogoAoVivo.linhaDoTempo || [];
        let linhaArray = Array.isArray(linhaObj) ? linhaObj : Object.values(linhaObj);

        // Conta os gols na marra caso a simulação antiga não tenha gravado o placar final
        let golsMCount = linhaArray.filter(e => e.tipo && e.tipo.includes('gol_mandante')).length;
        let golsVCount = linhaArray.filter(e => e.tipo && e.tipo.includes('gol_visitante')).length;

        let placarMReal = jogoAoVivo.placarMandante !== undefined ? jogoAoVivo.placarMandante : golsMCount;
        let placarVReal = jogoAoVivo.placarVisitante !== undefined ? jogoAoVivo.placarVisitante : golsVCount;

        if (jaTerminouDeVerdade) {
            lblGolsM.innerText = placarMReal;
            lblGolsV.innerText = placarVReal;

            cronometro.innerText = "FIM";
            cronometro.style.color = "#dc3545";
            statusTransmissao.innerText = "Partida Encerrada 🏁";

            if (linhaArray.length > 0) {
                narracao.innerHTML = `<div style="text-align:center; padding: 10px; color:#ff8c00; font-weight:bold; border-bottom:1px solid #333; margin-bottom:10px;">Resumo da Partida:</div>`;
                linhaArray.forEach(evento => {
                    let escudoID = evento.tipo.includes("mandante") ? jogoAoVivo.mandante : jogoAoVivo.visitante;
                    let escudoHTML = `<img src="esculdos/${escudoID}.png" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;
                    let txt = evento.texto.replace("GOOOL DO", `GOOOL DO ${escudoHTML}`);
                    adicionarNarraçao(`${evento.minuto}'`, txt, evento.cor);
                });
            } else {
                 narracao.innerHTML = `<div style="text-align:center; padding: 20px; color:#aaa;">O juiz apitou o fim de jogo! Partida sem lances de perigo ou melhores momentos (0x0).</div>`;
            }

            if(!eventosJaTocados.has(`fim_${rodadaExibicao}`) && audioLiberado && rodadaExibicao === rodadaSistema) {
                canalEfeitos.src = 'sounds/final_do_jogo.mp3';
                canalEfeitos.play();
                canalTorcida.volume = 0.1;
                eventosJaTocados.add(`fim_${rodadaExibicao}`);
            }
        }
        else {
            lblGolsM.innerText = "0";
            lblGolsV.innerText = "0";
            cronometro.innerText = "00'";
            cronometro.style.color = "#fff";

            // TRAVA DE TEMPO
            const agora = new Date();
            const horaAtual = agora.getHours();
            const minAtual = agora.getMinutes();
            const HORA_JOGO = 20; // 20:00

            let horarioPermitido = false;
            if (horaAtual > (HORA_JOGO - 1)) horarioPermitido = true;
            if (horaAtual === (HORA_JOGO - 1) && minAtual >= 40) horarioPermitido = true;

            if (rodadaExibicao < rodadaSistema) {
                 statusTransmissao.innerText = "Atrasado ⚠️";
                 narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;">Aguardando o processamento desta partida no servidor...</div>`;
            }
            else if (!horarioPermitido) {
                statusTransmissao.innerText = "Aguardando Horário ⏳";
                narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;">
                    <h3 style="color: #666;">Os portões do estádio ainda estão fechados.</h3>
                    <p>A transmissão abrirá 20 minutos antes do jogo (19:40).</p>
                </div>`;
            }
            else if (!audioLiberado) {
                statusTransmissao.innerText = "Sinal Encontrado 📡";
                narracao.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <h3 style="color: #ff8c00;">A transmissão está pronta!</h3>
                        <button onclick="liberarAudio()" style="background: var(--verde-campo); color: white; padding: 10px 20px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px;">▶️ LIGAR SOM E ENTRAR NO ESTÁDIO</button>
                    </div>`;
            }
            else if (linhaArray.length > 0) {
                statusTransmissao.innerText = "Ao Vivo 🔴";
                statusTransmissao.style.animation = "piscar 1s infinite";

                if (canalTorcida.src === "") {
                    canalTorcida.src = `sounds/torcida_${jogoAoVivo.mandante}.mp3`;
                    canalTorcida.onerror = () => { canalTorcida.src = 'sounds/torcida_generica.mp3'; canalTorcida.play(); };
                    canalTorcida.play();
                }

                reproduzirLinhaDoTempo(linhaArray, jogoAoVivo.horaInicio, placarMReal, placarVReal);
            }
            else {
                statusTransmissao.innerText = "Aquecimento 🏃‍♂️";
            }
        }
    } else {
        lblMandante.innerHTML = "Folga";
        lblVisitante.innerHTML = "Folga";
        lblGolsM.innerText = "-";
        lblGolsV.innerText = "-";
        cronometro.innerText = "--'";
        statusTransmissao.innerText = "Sem Jogo";
        narracao.innerHTML = `<div style="text-align:center; padding: 30px; color:#aaa;">O seu clube não joga nesta rodada.</div>`;
    }
}

function reproduzirLinhaDoTempo(linha, horaInicioTstamp, placarMFinal, placarVFinal) {
    const agora = Date.now();
    const diferencaSegundos = Math.floor((agora - horaInicioTstamp) / 1000);
    let minutoAtualJogo = diferencaSegundos;

    if (minutoAtualJogo > 95) {
        cronometro.innerText = "FIM";
        statusTransmissao.innerText = "Partida Encerrada 🏁";
        statusTransmissao.style.animation = "none";
        lblGolsM.innerText = placarMFinal;
        lblGolsV.innerText = placarVFinal;

        if(!eventosJaTocados.has("fim") && audioLiberado) {
            canalEfeitos.src = 'sounds/final_do_jogo.mp3';
            canalEfeitos.play();
            canalTorcida.volume = 0.1;
            eventosJaTocados.add("fim");
        }
        location.reload();
        return;
    }

    cronometro.innerText = minutoAtualJogo + "'";

    let golsM = 0; let golsV = 0;
    narracao.innerHTML = "";

    linha.forEach(evento => {
        if (evento.minuto <= minutoAtualJogo) {
            if (evento.tipo.includes("gol_mandante")) golsM++;
            if (evento.tipo.includes("gol_visitante")) golsV++;

            let escudoID = evento.tipo.includes("mandante") ? jogoAtual.mandante : jogoAtual.visitante;
            let escudoHTML = `<img src="esculdos/${escudoID}.png" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;
            let textoComEscudo = evento.texto.replace("GOOOL DO", `GOOOL DO ${escudoHTML}`);

            adicionarNarraçao(`${evento.minuto}'`, textoComEscudo, evento.cor);

            let idEvento = `${evento.minuto}_${evento.tipo}`;
            if (evento.tipo.includes("gol") && !eventosJaTocados.has(idEvento) && audioLiberado) {
                eventosJaTocados.add(idEvento);
                dispararAudioGol(escudoID);
            }
        }
    });

    lblGolsM.innerText = golsM;
    lblGolsV.innerText = golsV;

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
    canalEfeitos.play();

    setTimeout(() => {
        canalHino.src = `sounds/hino_${timeQueMarcou}.mp3`;
        canalHino.play();

        setTimeout(() => {
            canalHino.pause();
            canalTorcida.volume = volAnterior;
        }, 10000);

    }, 2000);
}

function adicionarNarraçao(tempo, texto, cor = "#ccc") {
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