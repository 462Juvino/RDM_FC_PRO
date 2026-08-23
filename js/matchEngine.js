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

        // Pede pro usuário clicar para liberar o som
        narracao.innerHTML = `
            <div style="text-align: center; padding: 30px;">
                <h3 style="color: #ff8c00;">A transmissão está pronta!</h3>
                <button onclick="liberarAudio()" style="background: var(--verde-campo); color: white; padding: 10px 20px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px;">▶️ LIGAR SOM E TRANSMISSÃO</button>
            </div>`;

    } catch (e) { console.error(e); }
});

// Helper para Escudos Inteligentes (Tenta Local, se falhar pega do Banco/Padrão)
function gerarImgEscudo(timeId, dadosTimeBanco) {
    // Se o time tiver o escudo salvo em Base64 ou URL no banco, usa ele
    if (dadosTimeBanco && dadosTimeBanco.escudo_base64) {
        return `<img src="${dadosTimeBanco.escudo_base64}" class="escudo-mini">`;
    }
    // Senão, tenta puxar da pasta local. Se falhar (Série B sem imagem), mostra um escudo genérico
    return `<img src="esculdos/${timeId}.png" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;
}

function liberarAudio() {
    audioLiberado = true;
    narracao.innerHTML = `<div style="color: #aaa; text-align: center;">Conectando com o satélite...</div>`;
    iniciarTransmissao();
}

function iniciarTransmissao() {
    db.ref(`ligas/${ligaLogada}/calendario`).on('value', (snapCal) => {
        const cal = snapCal.val();
        if (!cal) return;

        rodadaSistema = cal.rodadaAtual || 1;
        document.getElementById('lbl-rodada-top').innerText = rodadaSistema;

        const rodadaKey = `rodada_${rodadaSistema}`;
        const jogosDaDivisao = divisaoAtual === "A" ? cal.serieA[rodadaKey] : cal.serieB[rodadaKey];

        let jogoAoVivo = null;
        for (let j in jogosDaDivisao) {
            if (jogosDaDivisao[j].mandante === dadosUsuario.timeAtual || jogosDaDivisao[j].visitante === dadosUsuario.timeAtual) {
                meuJogoId = j;
                jogoAoVivo = jogosDaDivisao[j];
                break;
            }
        }

        if (jogoAoVivo) {
            jogoAtual = jogoAoVivo;

            // 🟢 INJETA ESTÁDIO DO VISITANTE NO FUNDO
            document.body.style.backgroundImage = `linear-gradient(rgba(18, 18, 18, 0.7), rgba(18, 18, 18, 0.9)), url('${getEstadio(jogoAoVivo.visitante)}')`;

            lblMandante.innerHTML = `${jogoAoVivo.mandante.replace(/_/g, ' ')} <img src="${getEscudo(jogoAoVivo.mandante)}" onerror="this.src='esculdos/default.png'" class="escudo-placar">`;
            lblVisitante.innerHTML = `<img src="${getEscudo(jogoAoVivo.visitante)}" onerror="this.src='esculdos/default.png'" class="escudo-placar"> ${jogoAoVivo.visitante.replace(/_/g, ' ')}`;

            // Toca a torcida do mandante de fundo (Ou genérica se não tiver arquivo)
            if (audioLiberado && canalTorcida.src === "") {
                canalTorcida.src = getTorcida(jogoAoVivo.mandante);
                canalTorcida.onerror = () => { canalTorcida.src = 'sounds/torcida_generica.mp3'; canalTorcida.play(); };
                canalTorcida.play();
            }

            if (jogoAoVivo.jogado) {
                lblGolsM.innerText = jogoAoVivo.placarMandante;
                lblGolsV.innerText = jogoAoVivo.placarVisitante;
                cronometro.innerText = "FIM";
                cronometro.style.color = "#dc3545";
                statusTransmissao.innerText = "Partida Encerrada 🏁";

                if(!eventosJaTocados.has("fim")) {
                    canalEfeitos.src = 'sounds/final_do_jogo.mp3';
                    canalEfeitos.play();
                    canalTorcida.volume = 0.1; // Abaixa a torcida no fim
                    eventosJaTocados.add("fim");
                }
            }
            else if (jogoAoVivo.linhaDoTempo) {
                statusTransmissao.innerText = "Ao Vivo 🔴";
                statusTransmissao.style.animation = "piscar 1s infinite";
                reproduzirLinhaDoTempo(jogoAoVivo.linhaDoTempo, jogoAoVivo.horaInicio);
            }
            else {
                statusTransmissao.innerText = "Aguardando Horário ⏳";
            }
        }
    });
}

function reproduzirLinhaDoTempo(linha, horaInicioTstamp) {
    const agora = Date.now();
    const diferencaSegundos = Math.floor((agora - horaInicioTstamp) / 1000);
    let minutoAtualJogo = diferencaSegundos;

    if (minutoAtualJogo > 90) return;

    cronometro.innerText = minutoAtualJogo + "'";

    let golsM = 0; let golsV = 0;
    narracao.innerHTML = "";

    // Dentro da função reproduzirLinhaDoTempo, no forEach:
    linha.forEach(evento => {
        if (evento.minuto <= minutoAtualJogo) {
            if (evento.tipo === "gol_mandante") golsM++;
            if (evento.tipo === "gol_visitante") golsV++;

            // INJETA O ESCUDO NO TEXTO DA NARRAÇÃO
            let escudoID = evento.tipo === "gol_mandante" ? jogoAtual.mandante : jogoAtual.visitante;
            let escudoHTML = `<img src="esculdos/${escudoID}.png" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;
            let textoComEscudo = evento.texto.replace("GOOOL DO", `GOOOL DO ${escudoHTML}`);

            adicionarNarraçao(`${evento.minuto}'`, textoComEscudo, evento.cor);

            // Gatilho de Áudio (Gol!)
            let idEvento = `${evento.minuto}_${evento.tipo}`;
            if (evento.tipo.includes("gol") && !eventosJaTocados.has(idEvento) && audioLiberado) {
                eventosJaTocados.add(idEvento);
                dispararAudioGol(escudoID);
            }
        }
    });

    lblGolsM.innerText = golsM;
    lblGolsV.innerText = golsV;

    // Dinâmica da Torcida: Ganhar = Empolgação (Volume 0.8), Perder = Silêncio (Volume 0.2)
    let souMandante = (dadosUsuario.timeAtual === jogoAtual.mandante);
    if (souMandante) {
        if (golsM > golsV) canalTorcida.volume = 0.8;
        else if (golsM < golsV) canalTorcida.volume = 0.2;
        else canalTorcida.volume = 0.4;
    }
}

function dispararAudioGol(timeQueMarcou) {
    // 1. Abaixa a torcida momentaneamente
    let volAnterior = canalTorcida.volume;
    canalTorcida.volume = 0.1;

    // 2. Grito de Gol genérico
    canalEfeitos.src = 'sounds/gol_generico.mp3';
    canalEfeitos.play();

    // 3. Toca o hino do time
    setTimeout(() => {
        canalHino.src = getHino(timeQueMarcou);
        canalHino.play();

        // Corta o hino depois de 10 segundos e volta a torcida
        setTimeout(() => {
            canalHino.pause();
            canalTorcida.volume = volAnterior; // Volta a cantar
        }, 10000);

    }, 2000); // Toca o hino 2 segundos depois do grito de gol começar
}

function adicionarNarraçao(tempo, texto, cor = "#ccc") {
    narracao.innerHTML += `
        <div style="border-bottom: 1px dashed #333; padding-bottom: 8px;">
            <strong style="color: var(--verde-campo); margin-right: 8px;">${tempo}</strong>
            <span style="color: ${cor};">${texto}</span>
        </div>`;
    narracao.scrollTop = narracao.scrollHeight;
}

function toggleMenu() { document.querySelector('.sidebar').classList.toggle('aberta'); }
function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}