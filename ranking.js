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
        // 1. Carrega o usuário
        const snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
        dadosUsuario = snapUser.val();

        if(!dadosUsuario || dadosUsuario.timeAtual === "Sem Clube") return window.location.href = "dashboard.html";

        document.getElementById('nome-treinador').innerText = dadosUsuario.nome;
        document.getElementById('nome-time').innerText = dadosUsuario.timeAtual.replace(/_/g, ' ');

        // Descobre a divisão do usuário e a define como inicial
        const snapMeusDadosTime = await db.ref(`banco_global_times/${dadosUsuario.timeAtual}`).once('value');
        if (snapMeusDadosTime.exists() && snapMeusDadosTime.val().divisao) {
            divisaoAtiva = snapMeusDadosTime.val().divisao;
            atualizarBotoesAba();
        }

        // 2. Carrega todos os times do mundo para montar a base
        const snapTimes = await db.ref('banco_global_times').once('value');
        timesGlobais = snapTimes.val() || {};

        // 3. Carrega o calendário e fica escutando atualizações (se o P2P rodar, atualiza na hora)
        db.ref(`ligas/${ligaLogada}/calendario`).on('value', snapCal => {
            calendarioLiga = snapCal.val();
            renderizarTabela();
        });

    } catch (e) {
        console.error("Erro ao carregar ranking:", e);
    }
});

// Controle da aba Superior
function mudarDivisao(divisao) {
    divisaoAtiva = divisao;
    atualizarBotoesAba();
    renderizarTabela();
}

function atualizarBotoesAba() {
    document.getElementById('btn-div-A').classList.remove('ativo');
    document.getElementById('btn-div-B').classList.remove('ativo');
    document.getElementById(`btn-div-${divisaoAtiva}`).classList.add('ativo');
}

// O CÉREBRO DA CLASSIFICAÇÃO
function renderizarTabela() {
    const tbody = document.getElementById('corpo-tabela');

    if (!calendarioLiga) {
        tbody.innerHTML = `<tr><td colspan="10" style="padding: 20px; color: #ff8c00;">A tabela ainda não foi sorteada pelo Administrador.</td></tr>`;
        return;
    }

    // 1. Cria a base de times zerada
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

    // 2. Varre os jogos do calendário para somar os pontos
    const jogosDivisao = divisaoAtiva === "A" ? calendarioLiga.serieA : calendarioLiga.serieB;

    if (jogosDivisao) {
        for (let rodada in jogosDivisao) {
            let jogos = jogosDivisao[rodada];
            for (let idJogo in jogos) {
                let jogo = jogos[idJogo];

                // Só calcula se a partida já aconteceu
                if (jogo.jogado) {
                    let mand = jogo.mandante;
                    let vis = jogo.visitante;
                    let gm = jogo.placarMandante;
                    let gv = jogo.placarVisitante;

                    // Fantasma significa "Descanso", não conta
                    if (mand === "Fantasma" || vis === "Fantasma") continue;

                    // Acréscimo de Gols e Jogos
                    if (tabela[mand]) {
                        tabela[mand].J++;
                        tabela[mand].GP += gm;
                        tabela[mand].GC += gv;
                    }
                    if (tabela[vis]) {
                        tabela[vis].J++;
                        tabela[vis].GP += gv;
                        tabela[vis].GC += gm;
                    }

                    // Verifica o resultado
                    if (gm > gv) { // Vitória do Mandante
                        if (tabela[mand]) { tabela[mand].Pts += 3; tabela[mand].V++; }
                        if (tabela[vis]) { tabela[vis].D++; }
                    } else if (gv > gm) { // Vitória do Visitante
                        if (tabela[vis]) { tabela[vis].Pts += 3; tabela[vis].V++; }
                        if (tabela[mand]) { tabela[mand].D++; }
                    } else { // Empate
                        if (tabela[mand]) { tabela[mand].Pts += 1; tabela[mand].E++; }
                        if (tabela[vis]) { tabela[vis].Pts += 1; tabela[vis].E++; }
                    }
                }
            }
        }
    }

    // 3. Atualiza Saldo de Gols final
    for (let t in tabela) {
        tabela[t].SG = tabela[t].GP - tabela[t].GC;
    }

    // 4. Converte em Array e Ordena pelas regras oficias de desempate
    let arrTabela = Object.values(tabela);
    arrTabela.sort((a, b) => {
        if (b.Pts !== a.Pts) return b.Pts - a.Pts; // 1º Pontos
        if (b.V !== a.V) return b.V - a.V;         // 2º Vitórias
        if (b.SG !== a.SG) return b.SG - a.SG;     // 3º Saldo de Gols
        return b.GP - a.GP;                        // 4º Gols Pró
    });

    // 5. Injeta no HTML
    tbody.innerHTML = "";
    arrTabela.forEach((time, index) => {
        let pos = index + 1;

        // Cores de zonas de rebaixamento ou título (Opcional, configurado para ligas de 20 times)
        let classeCSS = "";
        if (pos <= 4) classeCSS = "zona-libertadores";
        else if (pos >= arrTabela.length - 3) classeCSS = "zona-rebaixamento";

        // Destaca o time do usuário
        let corNome = time.id === dadosUsuario.timeAtual ? "#ff8c00" : "#fff";
        let pesoNome = time.id === dadosUsuario.timeAtual ? "bold" : "normal";

        tbody.innerHTML += `
            <tr>
                <td class="${classeCSS}" style="font-weight: bold; color: #888;">${pos}º</td>
                <td style="text-align: left; color: ${corNome}; font-weight: ${pesoNome};">${time.nome}</td>
                <td style="font-weight: bold; color: white;">${time.Pts}</td>
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

function toggleMenu() { document.querySelector('.sidebar').classList.toggle('aberta'); }
function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}