// js/ranking.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let timesGlobais = {};
let calendarioLiga = null;
let divisaoAtiva = "A";

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
        dadosUsuario = snapUser.val();

        if(!dadosUsuario || dadosUsuario.timeAtual === "Sem Clube") return window.location.href = "dashboard.html";

        document.getElementById('nome-treinador').innerText = dadosUsuario.nome;
        document.getElementById('nome-time').innerText = dadosUsuario.timeAtual.replace(/_/g, ' ');

        const snapMeusDadosTime = await db.ref(`banco_global_times/${dadosUsuario.timeAtual}`).once('value');
        if (snapMeusDadosTime.exists() && snapMeusDadosTime.val().divisao) {
            divisaoAtiva = snapMeusDadosTime.val().divisao;
            atualizarBotoesAba();
        }

        const snapTimes = await db.ref('banco_global_times').once('value');
        timesGlobais = snapTimes.val() || {};

        db.ref(`ligas/${ligaLogada}/calendario`).on('value', snapCal => {
            calendarioLiga = snapCal.val();
            renderizarTabela();
            carregarEstatisticasGerais(); // Dispara a busca de artilheiros
        });

    } catch (e) {
        console.error("Erro ao carregar ranking:", e);
    }
});

function mudarDivisao(divisao) {
    divisaoAtiva = divisao;
    atualizarBotoesAba();
    renderizarTabela();
    carregarEstatisticasGerais(); // Atualiza artilheiros da Série A ou B
}

function atualizarBotoesAba() {
    document.getElementById('btn-div-A').classList.remove('ativo');
    document.getElementById('btn-div-B').classList.remove('ativo');
    document.getElementById(`btn-div-${divisaoAtiva}`).classList.add('ativo');
}

// ========================================================
// 1. CÉREBRO DA CLASSIFICAÇÃO (Com as Zonas de Copa)
// ========================================================
function renderizarTabela() {
    const tbody = document.getElementById('corpo-tabela');

    if (!calendarioLiga) {
        tbody.innerHTML = `<tr><td colspan="10" style="padding: 20px; color: #ff8c00;">A tabela ainda não foi sorteada pelo Administrador.</td></tr>`;
        return;
    }

    let tabela = {};
    for (let t in timesGlobais) {
        if (timesGlobais[t].divisao === divisaoAtiva) {
            tabela[t] = {
                id: t,
                nome: t.replace(/_/g, ' '),
                Pts: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, SG: 0
            };
        }
    }

    const jogosDivisao = divisaoAtiva === "A" ? calendarioLiga.serieA : calendarioLiga.serieB;

    if (jogosDivisao) {
        for (let rodada in jogosDivisao) {
            let jogos = jogosDivisao[rodada];
            for (let idJogo in jogos) {
                let jogo = jogos[idJogo];

                if (jogo.jogado) {
                    let mand = jogo.mandante;
                    let vis = jogo.visitante;
                    let gm = jogo.placarMandante;
                    let gv = jogo.placarVisitante;

                    if (mand === "Fantasma" || vis === "Fantasma") continue;

                    if (tabela[mand]) { tabela[mand].J++; tabela[mand].GP += gm; tabela[mand].GC += gv; }
                    if (tabela[vis]) { tabela[vis].J++; tabela[vis].GP += gv; tabela[vis].GC += gm; }

                    if (gm > gv) {
                        if (tabela[mand]) { tabela[mand].Pts += 3; tabela[mand].V++; }
                        if (tabela[vis]) { tabela[vis].D++; }
                    } else if (gv > gm) {
                        if (tabela[vis]) { tabela[vis].Pts += 3; tabela[vis].V++; }
                        if (tabela[mand]) { tabela[mand].D++; }
                    } else {
                        if (tabela[mand]) { tabela[mand].Pts += 1; tabela[mand].E++; }
                        if (tabela[vis]) { tabela[vis].Pts += 1; tabela[vis].E++; }
                    }
                }
            }
        }
    }

    for (let t in tabela) { tabela[t].SG = tabela[t].GP - tabela[t].GC; }

    let arrTabela = Object.values(tabela);
    arrTabela.sort((a, b) => {
        if (b.Pts !== a.Pts) return b.Pts - a.Pts;
        if (b.V !== a.V) return b.V - a.V;
        if (b.SG !== a.SG) return b.SG - a.SG;
        return b.GP - a.GP;
    });

    tbody.innerHTML = "";
    arrTabela.forEach((time, index) => {
        let pos = index + 1;

        // Regras das Zonas (Igual ao da imagem que você mandou)
        // 1 ao 4 = Azul | 5 ao 10 = Verde (Totalizando os Top 10 para Copas) | Últimos 4 = Vermelho
        let classeCSS = "sem-zona";
        if (pos <= 4) classeCSS = "zona-azul";
        else if (pos <= 10) classeCSS = "zona-verde";
        else if (pos >= arrTabela.length - 3) classeCSS = "zona-vermelha";

        let corNome = time.id === dadosUsuario.timeAtual ? "#ff8c00" : "#fff";
        let pesoNome = time.id === dadosUsuario.timeAtual ? "bold" : "normal";

        tbody.innerHTML += `
            <tr class="${classeCSS}">
                <td>${pos}</td>
                <td style="text-align: left; color: ${corNome}; font-weight: ${pesoNome}; display: flex; align-items: center;">
                    <img src="${getEscudo(time.id)}" onerror="this.src='esculdos/default.png'" class="escudo-mini"> ${time.nome}
                </td>
                <td class="col-pts">${time.Pts}</td>
                <td>${time.J}</td>
                <td>${time.V}</td>
                <td>${time.E}</td>
                <td>${time.D}</td>
                <td>${time.GP}</td>
                <td>${time.GC}</td>
                <td style="color: ${time.SG > 0 ? 'var(--verde-campo)' : (time.SG < 0 ? '#dc3545' : '#888')}; font-weight: bold;">
                    ${time.SG > 0 ? '+' : ''}${time.SG}
                </td>
            </tr>
        `;
    });
}

// ========================================================
// 2. PAINEL DE ESTATÍSTICAS DA DIVISÃO
// ========================================================
function carregarEstatisticasGerais() {
    let todosJogadores = [];

    // Vasculha os times apenas da Divisão que o usuário está visualizando
    for (let t in timesGlobais) {
        if (timesGlobais[t].divisao === divisaoAtiva && timesGlobais[t].jogadores) {
            for (let j in timesGlobais[t].jogadores) {
                let jog = timesGlobais[t].jogadores[j];
                jog.timeOrigem = t;
                todosJogadores.push(jog);
            }
        }
    }

    // Top 10 Artilheiros
    let artilheiros = [...todosJogadores]
        .filter(j => j.estatisticas && j.estatisticas.gols > 0)
        .sort((a, b) => b.estatisticas.gols - a.estatisticas.gols)
        .slice(0, 10);

    // Top 10 Assistências
    let assistentes = [...todosJogadores]
        .filter(j => j.estatisticas && j.estatisticas.assistencias > 0)
        .sort((a, b) => b.estatisticas.assistencias - a.estatisticas.assistencias)
        .slice(0, 10);

    // Renderiza HTML
    const listaGols = document.getElementById('lista-artilheiros');
    const listaAst = document.getElementById('lista-assistencias');

    if (artilheiros.length === 0) {
        listaGols.innerHTML = `<li><span style="color: #666;">Nenhum gol registrado nesta divisão.</span></li>`;
    } else {
        listaGols.innerHTML = "";
        artilheiros.forEach((j, i) => {
            let nomeCurto = j.nome.split(" ")[0];
            listaGols.innerHTML += `
                <li>
                    <div style="display: flex; align-items: center;">
                        <span style="color: #888; width: 20px;">${i+1}º</span>
                        <img src="${getEscudo(j.timeOrigem)}" onerror="this.src='esculdos/default.png'" style="width: 16px; height: 16px; margin: 0 8px;">
                        <strong style="color: #fff;">${nomeCurto}</strong>
                    </div>
                    <span style="font-weight: bold; color: #ff8c00;">${j.estatisticas.gols} <span style="font-size:10px;color:#888;">Gols</span></span>
                </li>
            `;
        });
    }

    if (assistentes.length === 0) {
        listaAst.innerHTML = `<li><span style="color: #666;">Nenhuma assistência registrada nesta divisão.</span></li>`;
    } else {
        listaAst.innerHTML = "";
        assistentes.forEach((j, i) => {
            let nomeCurto = j.nome.split(" ")[0];
            listaAst.innerHTML += `
                <li>
                    <div style="display: flex; align-items: center;">
                        <span style="color: #888; width: 20px;">${i+1}º</span>
                        <img src="${getEscudo(j.timeOrigem)}" onerror="this.src='esculdos/default.png'" style="width: 16px; height: 16px; margin: 0 8px;">
                        <strong style="color: #fff;">${nomeCurto}</strong>
                    </div>
                    <span style="font-weight: bold; color: var(--verde-campo);">${j.estatisticas.assistencias} <span style="font-size:10px;color:#888;">Ast</span></span>
                </li>
            `;
        });
    }
}

// CONTROLE DO MENU MOBILE OTIMIZADO
function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    const menuAberto = sidebar.classList.toggle('aberta');

    // Adiciona uma classe ao body para fazer o fundo escurecer
    if (menuAberto) {
        document.body.classList.add('menu-aberto');
    } else {
        document.body.classList.remove('menu-aberto');
    }
}

// Fecha o menu se o cara tocar no fundo escuro ou em um botão do próprio menu
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');

    // Se a tela for pequena, e o menu tá aberto...
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('aberta')) {
        // Se ele tocou em qualquer botão de ir pra outra página (tag A ou tag BUTTON)...
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('btn-menu')) {
            sidebar.classList.remove('aberta');
            document.body.classList.remove('menu-aberto');
        }

        // Se ele tocou fora do menu (no fundo escuro ou no X)
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