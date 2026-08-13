// js/matchEngine.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let divisaoAtual = "A";
let rodadaSistema = 1;
let meuJogoId = null;

// Elementos
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

        iniciarTransmissao();
    } catch (e) { console.error(e); }
});

function iniciarTransmissao() {
    // Fica escutando o calendário em tempo real!
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
            lblMandante.innerText = jogoAoVivo.mandante.replace(/_/g, ' ');
            lblVisitante.innerText = jogoAoVivo.visitante.replace(/_/g, ' ');

            // Cenário 1: Jogo já acabou (P2P processou e o tempo passou)
            if (jogoAoVivo.jogado) {
                lblGolsM.style.color = "#ff8c00"; lblGolsV.style.color = "#ff8c00";
                lblGolsM.innerText = jogoAoVivo.placarMandante;
                lblGolsV.innerText = jogoAoVivo.placarVisitante;
                cronometro.innerText = "FIM";
                cronometro.style.color = "#dc3545";
                statusTransmissao.innerText = "Partida Encerrada 🏁";
                narracao.innerHTML = `<div style="color: #aaa; text-align: center;">O juiz já apitou o fim do jogo. Volte amanhã para a próxima rodada!</div>`;
            }
            // Cenário 2: Jogo Simulando AO VIVO (P2P gerou a linha do tempo)
            else if (jogoAoVivo.linhaDoTempo) {
                statusTransmissao.innerText = "Ao Vivo 🔴";
                statusTransmissao.style.animation = "piscar 1s infinite";
                reproduzirLinhaDoTempo(jogoAoVivo.linhaDoTempo, jogoAoVivo.horaInicio);
            }
            // Cenário 3: Aguardando horário do servidor
            else {
                statusTransmissao.innerText = "Aguardando Horário do Jogo ⏳";
                narracao.innerHTML = `<div style="color: var(--verde-campo); text-align: center;">As equipes estão no vestiário. A partida iniciará no horário programado.</div>`;
            }
        }
    });
}

function reproduzirLinhaDoTempo(linha, horaInicioTstamp) {
    // Calcula em qual "minuto" o jogo está baseado no relógio do mundo real
    // Exemplo: 1 minuto real = 10 minutos de jogo.
    const agora = Date.now();
    const diferencaSegundos = Math.floor((agora - horaInicioTstamp) / 1000);

    // Supondo que 1 segundo real = 1 minuto no jogo (Partida dura 1 minuto e meio)
    let minutoAtualJogo = diferencaSegundos;

    if (minutoAtualJogo > 90) return; // Se já passou, o on('value') do Firebase vai atualizar pra jogado=true agorinha

    cronometro.innerText = minutoAtualJogo + "'";
    cronometro.style.color = "#00b853";
    lblGolsM.style.color = "#ff8c00"; lblGolsV.style.color = "#ff8c00";

    // Pinta os gols que já aconteceram ATÉ esse minuto
    let golsM = 0; let golsV = 0;
    narracao.innerHTML = "";

    linha.forEach(evento => {
        if (evento.minuto <= minutoAtualJogo) {
            if (evento.tipo === "gol_mandante") golsM++;
            if (evento.tipo === "gol_visitante") golsV++;
            adicionarNarraçao(`${evento.minuto}'`, evento.texto, evento.cor);
        }
    });

    lblGolsM.innerText = golsM;
    lblGolsV.innerText = golsV;
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