// js/calendario.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let meuTimeObj = null;
let divisaoAtual = "A";
let calendarioCompleto = {}; // Guarda Série A ou B
let calendarioCopa = {};     // Guarda a Copa
let rodadaAtualSistema = 1;
let modoAtual = "camp";      // 'camp' ou 'copa'

window.addEventListener('DOMContentLoaded', () => {
    db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value').then(snapshot => {
        dadosUsuario = snapshot.val();

        if(!dadosUsuario || dadosUsuario.timeAtual === "Sem Clube") {
            return window.location.href = "dashboard.html";
        }

        const nomeTimeFormatado = dadosUsuario.timeAtual.replace(/_/g, ' ');
        document.getElementById('nome-treinador').innerText = dadosUsuario.nome;
        document.getElementById('nome-time').innerText = nomeTimeFormatado;

        carregarTabela(dadosUsuario.timeAtual);
    });
});

async function carregarTabela(timeIdBanco) {
    try {
        const snapTime = await db.ref(`banco_global_times/${timeIdBanco}`).once('value');
        meuTimeObj = snapTime.val() || {};
        divisaoAtual = meuTimeObj.divisao || "A";

        const snapCalendario = await db.ref(`ligas/${ligaLogada}/calendario`).once('value');
        const cal = snapCalendario.val();

        if (!cal || (!cal.serieA && !cal.serieB)) {
            document.getElementById('container-jogos').innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: #2a2a2a; border-radius: 8px; border: 1px dashed #555;">
                    <h3 style="color: #ff8c00;">Tabela Indisponível</h3>
                    <p style="color: #aaa;">A diretoria da Liga ainda não realizou o sorteio do calendário desta temporada.</p>
                </div>`;
            return;
        }

        calendarioCompleto = divisaoAtual === "B" && cal.serieB ? cal.serieB : (cal.serieA || {});
        calendarioCopa = cal.copa || {};
        rodadaAtualSistema = cal.rodadaAtual || 1;

        let lblRodada = document.getElementById('lbl-rodada-atual');
        if(lblRodada) lblRodada.innerText = rodadaAtualSistema;

        preencherSeletorRodadas();

    } catch (erro) {
        console.error("Erro Crítico no Calendário:", erro);
        document.getElementById('container-jogos').innerHTML = `<p style="color:#dc3545;">Erro de conexão com o campeonato.</p>`;
    }
}

// ----------------------------------------------------
// CONTROLE DE ABAS (CAMPEONATO vs COPA)
// ----------------------------------------------------
function mudarAbaCalendario(modo) {
    modoAtual = modo;
    document.getElementById('aba-camp').classList.remove('ativo');
    document.getElementById('aba-copa').classList.remove('ativo');
    document.getElementById(`aba-${modo}`).classList.add('ativo');

    document.getElementById('titulo-calendario').innerText = modo === 'camp' ? "Calendário Oficial 🗓️" : "Chaveamento da Copa ⚔️";
    document.getElementById('lbl-status-rodada').style.display = modo === 'camp' ? "inline" : "none";

    preencherSeletorRodadas();
}

function preencherSeletorRodadas() {
    const seletor = document.getElementById('seletor-rodada');
    seletor.innerHTML = "";

    if (modoAtual === "camp") {
        const totalRodadas = Object.keys(calendarioCompleto).length;
        for (let i = 1; i <= totalRodadas; i++) {
            let opt = document.createElement('option');
            opt.value = `rodada_${i}`;
            opt.text = `Rodada ${i}`;
            if (i === rodadaAtualSistema) opt.selected = true;
            seletor.appendChild(opt);
        }
    } else {
        // MODO COPA
        const fases = Object.keys(calendarioCopa);
        if (fases.length === 0) {
            seletor.innerHTML = "<option value=''>Sorteio Pendente</option>";
        } else {
            fases.forEach(fase => {
                let opt = document.createElement('option');
                opt.value = fase;
                // Ex: "oitavas" vira "Oitavas de Final"
                let textoFase = fase === 'oitavas' ? 'Oitavas de Final' : fase.charAt(0).toUpperCase() + fase.slice(1);
                opt.text = textoFase;
                seletor.appendChild(opt);
            });
        }
    }

    renderizarRodada();
}

function renderizarRodada() {
    const rodadaSelecionada = document.getElementById('seletor-rodada').value;
    const container = document.getElementById('container-jogos');
    container.innerHTML = "";

    if (!rodadaSelecionada) {
        container.innerHTML = `<p style="color:#aaa; text-align:center; width:100%;">Nenhum jogo para exibir.</p>`;
        return;
    }

    const jogos = modoAtual === "camp" ? calendarioCompleto[rodadaSelecionada] : calendarioCopa[rodadaSelecionada];

    if (!jogos) return;

    for (let idJogo in jogos) {
        let jogo = jogos[idJogo];
        let timeMandante = jogo.mandante.replace(/_/g, ' ');
        let timeVisitante = jogo.visitante.replace(/_/g, ' ');

        let ehMeuJogo = (jogo.mandante === dadosUsuario.timeAtual || jogo.visitante === dadosUsuario.timeAtual);
        let corBorda = ehMeuJogo ? "#ff8c00" : "#444";
        let destaqueBackground = ehMeuJogo ? "background: linear-gradient(135deg, #2a2a2a, #3a2510);" : "background: #2a2a2a;";

        let subTitulo = modoAtual === "camp" ? "Campeonato Nacional" : "Copa Nacional";

        container.innerHTML += `
            <div style="${destaqueBackground} border: 1px solid ${corBorda}; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">

                <div style="width: 100%; display: flex; justify-content: space-between; font-size: 11px; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
                    <span>${ehMeuJogo ? `<strong style="color: #ff8c00;">⭐ Seu Jogo - ${subTitulo}</strong>` : subTitulo}</span>
                    <span style="color: var(--verde-campo); font-weight: bold;">📅 ${jogo.data_jogo || "Data a definir"}</span>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 10px;">
                    <div style="flex: 1; text-align: right; font-weight: bold; color: ${jogo.mandante === dadosUsuario.timeAtual ? '#fff' : '#ccc'}; font-size: 15px;">
                        ${timeMandante} <img src="${getEscudo(jogo.mandante)}" onerror="this.src='esculdos/default.png'" class="escudo-mini">
                    </div>

                    <div style="background: #111; padding: 5px 12px; border-radius: 6px; font-weight: bold; color: #555; border: 1px solid #333;">X</div>

                    <div style="flex: 1; text-align: left; font-weight: bold; color: ${jogo.visitante === dadosUsuario.timeAtual ? '#fff' : '#ccc'}; font-size: 15px;">
                        <img src="${getEscudo(jogo.visitante)}" onerror="this.src='esculdos/default.png'" class="escudo-mini"> ${timeVisitante}
                    </div>
                </div>

                ${jogo.jogado
                    ? `<div style="margin-top: 10px; font-size: 12px; color: var(--verde-campo); background: rgba(0,184,83,0.1); padding: 3px 8px; border-radius: 4px;">Partida Encerrada</div>`
                    : `<div style="margin-top: 10px; font-size: 12px; color: #aaa;">Aguardando Simulação</div>`
                }
            </div>
        `;
    }
}

function toggleMenu() { document.querySelector('.sidebar').classList.toggle('aberta'); }
function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}