// js/calendario.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let meuTimeObj = null;
let divisaoAtual = "A"; // Padrão
let calendarioCompleto = {};
let rodadaAtualSistema = 1;

window.addEventListener('DOMContentLoaded', () => {
    db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value').then(snapshot => {
        dadosUsuario = snapshot.val();

        if(!dadosUsuario || dadosUsuario.timeAtual === "Sem Clube") {
            return window.location.href = "dashboard.html";
        }

        const nomeTimeFormatado = dadosUsuario.timeAtual.replace(/_/g, ' ');
        document.getElementById('nome-treinador').innerText = dadosUsuario.nome;
        document.getElementById('nome-time').innerText = nomeTimeFormatado;
        document.getElementById('saldo-treinador').innerText = formatarDinheiro(dadosUsuario.caixaClube || 0);

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
                    <p style="color: #aaa;">A diretoria da Liga ainda não realizou o sorteio do calendário desta temporada (ou ocorreu um erro na geração).</p>
                </div>`;
            return;
        }

        calendarioCompleto = divisaoAtual === "B" && cal.serieB ? cal.serieB : (cal.serieA || {});
        rodadaAtualSistema = cal.rodadaAtual || 1;

        let lblRodada = document.getElementById('lbl-rodada-atual');
        if(lblRodada) lblRodada.innerText = rodadaAtualSistema;

        if(Object.keys(calendarioCompleto).length > 0) {
            preencherSeletorRodadas();
        } else {
             document.getElementById('container-jogos').innerHTML = `<p style="text-align:center; width:100%; color:#dc3545;">Erro: O campeonato desta divisão está vazio no servidor.</p>`;
        }

    } catch (erro) {
        console.error("Erro Crítico no Calendário:", erro);
        document.getElementById('container-jogos').innerHTML = `<p style="color:#dc3545;">Erro de conexão com o campeonato.</p>`;
    }
}

// 2. Cria as 38 opções no Menu Dropdown
function preencherSeletorRodadas() {
    const seletor = document.getElementById('seletor-rodada');
    seletor.innerHTML = "";

    // Pega quantas rodadas tem no objeto (deve ser 38)
    const totalRodadas = Object.keys(calendarioCompleto).length;

    for (let i = 1; i <= totalRodadas; i++) {
        let opt = document.createElement('option');
        opt.value = `rodada_${i}`;
        opt.text = `Rodada ${i}`;

        // Deixa a rodada atual pré-selecionada
        if (i === rodadaAtualSistema) opt.selected = true;

        seletor.appendChild(opt);
    }

    renderizarRodada();
}

// 3. Desenha os jogos da Rodada Selecionada
function renderizarRodada() {
    const rodadaSelecionada = document.getElementById('seletor-rodada').value;
    const container = document.getElementById('container-jogos');
    container.innerHTML = "";

    const jogos = calendarioCompleto[rodadaSelecionada];
    if (!jogos) return;

    for (let idJogo in jogos) {
        let jogo = jogos[idJogo];
        let timeMandante = jogo.mandante.replace(/_/g, ' ');
        let timeVisitante = jogo.visitante.replace(/_/g, ' ');

        // Verifica se é o jogo do usuário para destacar a caixinha
        let ehMeuJogo = (jogo.mandante === dadosUsuario.timeAtual || jogo.visitante === dadosUsuario.timeAtual);
        let corBorda = ehMeuJogo ? "#ff8c00" : "#444";
        let destaqueBackground = ehMeuJogo ? "background: linear-gradient(135deg, #2a2a2a, #3a2510);" : "background: #2a2a2a;";

        // Layout do Card de Jogo (Lindo e Elegante)
        container.innerHTML += `
            <div style="${destaqueBackground} border: 1px solid ${corBorda}; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">

                <div style="font-size: 11px; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
                    ${ehMeuJogo ? '<span style="color: #ff8c00; font-weight: bold;">⭐ Seu Jogo</span>' : 'Campeonato Nacional'}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 10px;">
                    <div style="flex: 1; text-align: right; font-weight: bold; color: ${jogo.mandante === dadosUsuario.timeAtual ? '#fff' : '#ccc'}; font-size: 15px;">
                        ${timeMandante}
                    </div>

                    <div style="background: #111; padding: 5px 12px; border-radius: 6px; font-weight: bold; color: #555; border: 1px solid #333;">
                        X
                    </div>

                    <div style="flex: 1; text-align: left; font-weight: bold; color: ${jogo.visitante === dadosUsuario.timeAtual ? '#fff' : '#ccc'}; font-size: 15px;">
                        ${timeVisitante}
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

// Utilidades
function formatarDinheiro(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
function toggleMenu() { document.querySelector('.sidebar').classList.toggle('aberta'); }
function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}