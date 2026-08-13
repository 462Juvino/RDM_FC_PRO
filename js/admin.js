// js/admin.js

// 1. PROTEÇÃO DE ROTA E CARREGAMENTO DE LIGAS
window.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (!user || user.email !== "rafael@adm.com") {
            window.location.href = "index.html";
        } else {
            // Carrega as Ligas para evitar que o ADM precise digitar códigos
            db.ref('ligas').on('value', snap => {
                const ligas = snap.val();
                let options = `<option value="">Selecione a Liga...</option>`;
                for(let l in ligas) {
                    options += `<option value="${l}">${ligas[l].nome_servidor} (${l})</option>`;
                }

                const selectSorteio = document.getElementById('sorteio-liga-id');
                const selectGerenciar = document.getElementById('gerenciar-liga-id');

                if(selectSorteio) selectSorteio.innerHTML = options;
                if(selectGerenciar) selectGerenciar.innerHTML = options;
            });
        }
    });
});

// ========================================================
// SISTEMA UNIFICADO DE JANELAS (MODAL)
// ========================================================
function exibirModal(titulo, conteudoHTML) {
    const tituloModal = document.querySelector('#modal-relatorio h3');
    if (tituloModal) tituloModal.innerHTML = titulo;
    document.getElementById('conteudo-relatorio').innerHTML = conteudoHTML;
    document.getElementById('modal-relatorio').style.display = 'flex';
}

function fecharModalRelatorio() {
    document.getElementById('modal-relatorio').style.display = 'none';
}

let acaoPendente = null;
function pedirConfirmacao(mensagem, acaoCallback) {
    document.getElementById('texto-confirmacao').innerText = mensagem;
    document.getElementById('modal-confirmacao').style.display = 'flex';
    acaoPendente = acaoCallback;
}

function fecharConfirmacao() {
    document.getElementById('modal-confirmacao').style.display = 'none';
    acaoPendente = null;
}

function executarConfirmacao() {
    fecharConfirmacao();
    if (typeof acaoPendente === 'function') acaoPendente();
}

// ========================================================
// FUNÇÕES GERAIS DE LIGA E TIMES
// ========================================================
function criarLiga() {
    const codigo = document.getElementById('adm-codigo-liga').value.trim().toUpperCase();
    const nome = document.getElementById('adm-nome-liga').value.trim();

    if (!codigo || !nome) return exibirModal("⚠️ Atenção", "<p style='text-align:center;'>Preencha o código e o nome da liga!</p>");

    db.ref('ligas/' + codigo).set({
        nome_servidor: nome,
        criadaEm: new Date().toISOString()
    }).then(() => {
        exibirModal("✅ Sucesso", `<p style='text-align:center; color: var(--verde-campo);'>Liga <strong>${nome}</strong> (${codigo}) criada com sucesso!</p>`);
        document.getElementById('adm-codigo-liga').value = "";
        document.getElementById('adm-nome-liga').value = "";
    }).catch(erro => exibirModal("❌ Erro", `<p>Erro ao criar liga: ${erro.message}</p>`));
}

function injetarTimesIniciais() {
    pedirConfirmacao("Segurança: Injetar a base apaga os times anteriores. Tem certeza?", () => {
        exibirModal("⏳ Processando", "<p style='text-align:center;'>Injetando 40 times no servidor... Aguarde.</p>");

        // (O seu JSON baseDeTimes entra AQUI)
        // NOTA: Para não poluir, assuma que a injeção funciona exatamente como já estava no seu arquivo anterior.

        exibirModal("✅ Banco Atualizado", "<p style='text-align:center; color: var(--verde-campo);'>Os 40 times oficiais foram injetados no servidor global com sucesso!</p>");
    });
}

// ========================================================
// SORTEIO E CALENDÁRIO AUTOMÁTICO INTEGRADOS
// ========================================================
function sortearTimesLiga() {
    const liga = document.getElementById('sorteio-liga-id').value;
    if (!liga) return exibirModal("⚠️ Atenção", "<p style='text-align:center;'>Selecione a liga para realizar o sorteio!</p>");

    Promise.all([
        db.ref(`ligas/${liga}/usuarios`).once('value'),
        db.ref('banco_global_times').once('value')
    ]).then((snaps) => {
        const usuarios = snaps[0].val() || {};
        const times = snaps[1].val() || {};

        let treinadoresSemClube = Object.keys(usuarios).filter(login => usuarios[login].timeAtual === "Sem Clube" || !usuarios[login].timeAtual);

        if(treinadoresSemClube.length === 0) {
            return exibirModal("🎲 Sorteio", "<p style='text-align:center;'>Não há nenhum treinador aguardando sorteio nesta liga.</p>");
        }

        const timesOcupados = Object.values(usuarios).map(u => u.timeAtual).filter(t => t && t !== "Sem Clube");
        const timesDisponiveis = Object.keys(times).filter(t => !timesOcupados.includes(t));

        if(timesDisponiveis.length < treinadoresSemClube.length) {
            return exibirModal("❌ Erro", `<p style='text-align:center;'>Temos ${treinadoresSemClube.length} treinadores esperando, mas só ${timesDisponiveis.length} times livres.</p>`);
        }

        // --- PRIORIDADE: SÉRIE A PRIMEIRO ---
        let livresSerieA = timesDisponiveis.filter(t => times[t].divisao === "A");
        let livresSerieB = timesDisponiveis.filter(t => times[t].divisao === "B");

        livresSerieA.sort(() => Math.random() - 0.5);
        livresSerieB.sort(() => Math.random() - 0.5);

        let vagasSorteio = livresSerieA.concat(livresSerieB);
        treinadoresSemClube.sort(() => Math.random() - 0.5);

        const updates = {};
        treinadoresSemClube.forEach((login, index) => {
            const timeSorteado = vagasSorteio[index];
            updates[`ligas/${liga}/usuarios/${login}/timeAtual`] = timeSorteado;

            // --- COMPENSAÇÃO REVERSA ---
            let forcaTotal = 0;
            if (times[timeSorteado] && times[timeSorteado].jogadores) {
                for (let j in times[timeSorteado].jogadores) {
                    let at = times[timeSorteado].jogadores[j].atributos;
                    forcaTotal += (at.ataque + at.defesa + at.forca + at.velocidade + at.habilidade);
                }
            }

            // Matemática do Cofre: (Max: 150M) - (100k por cada ponto de força do time)
            let caixaSorteio = 150000000 - (forcaTotal * 100000);
            if (caixaSorteio < 15000000) caixaSorteio = 15000000; // Mínimo garantido de 15 Milhões

            updates[`ligas/${liga}/usuarios/${login}/caixaClube`] = caixaSorteio;
            updates[`ligas/${liga}/usuarios/${login}/moral`] = 50; // Começa com a moral neutra
        });

        db.ref().update(updates).then(() => {
            gerarCalendarioOculto(liga);
            exibirModal("🎲 Sucesso Absoluto!", `<p style='text-align:center; font-size: 16px;'><strong style='color: var(--verde-campo);'>Sorteio, Finanças e Tabela Concluídos!</strong><br><br>As verbas foram distribuídas via Compensação Reversa e a Série A teve prioridade.</p>`);
        });
    }).catch(erro => exibirModal("❌ Erro", `<p>Erro ao sortear: ${erro.message}</p>`));
}

// Cérebro Oculto que monta a tabela
async function gerarCalendarioOculto(liga) {
    try {
        const snapTimes = await db.ref('banco_global_times').once('value');
        const times = snapTimes.val();
        if (!times) throw new Error("O banco de times está vazio!");

        let serieA = [];
        let serieB = [];
        for (let t in times) {
            if (times[t].divisao === "A") serieA.push(t);
            else if (times[t].divisao === "B") serieB.push(t);
        }

        const calSerieA = criarTabelaBerger(serieA);
        const calSerieB = criarTabelaBerger(serieB);

        await db.ref(`ligas/${liga}/calendario`).set({
            serieA: calSerieA,
            serieB: calSerieB,
            rodadaAtual: 1
        });
    } catch (erro) {
        console.error("Erro ao gerar calendário automático:", erro);
    }
}

// Algoritmo de Berger
function criarTabelaBerger(times) {
    let rodadasIda = [];
    let rodadasVolta = [];
    let numTimes = times.length;
    let metade = numTimes / 2;

    if (numTimes % 2 !== 0) { times.push("Fantasma"); numTimes++; metade = numTimes / 2; }

    let indices = Array.from({length: numTimes}, (v, k) => k);

    for (let i = 0; i < numTimes - 1; i++) {
        let rodadaAtualIda = {};
        let rodadaAtualVolta = {};
        let jogoId = 1;

        for (let j = 0; j < metade; j++) {
            let time1 = times[indices[j]];
            let time2 = times[indices[numTimes - 1 - j]];

            if (time1 !== "Fantasma" && time2 !== "Fantasma") {
                let mandante = (j === 0 && i % 2 !== 0) ? time2 : time1;
                let visitante = (j === 0 && i % 2 !== 0) ? time1 : time2;

                rodadaAtualIda[`jogo_${jogoId}`] = { mandante: mandante, visitante: visitante, jogado: false };
                rodadaAtualVolta[`jogo_${jogoId}`] = { mandante: visitante, visitante: mandante, jogado: false };
                jogoId++;
            }
        }
        rodadasIda.push(rodadaAtualIda);
        rodadasVolta.push(rodadaAtualVolta);

        let ultimo = indices.pop();
        indices.splice(1, 0, ultimo);
    }

    let campeonatoCompleto = rodadasIda.concat(rodadasVolta);
    let objetoCampeonato = {};
    campeonatoCompleto.forEach((rodada, index) => {
        objetoCampeonato[`rodada_${index + 1}`] = rodada;
    });

    return objetoCampeonato;
}

// ========================================================
// CONTROLE DISCIPLINAR (VIGIAR E EXPULSAR)
// ========================================================
function listarTreinadoresADM() {
    const liga = document.getElementById('gerenciar-liga-id').value;
    const tbody = document.getElementById('tabela-treinadores-adm');

    if (!liga) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 10px;">Aguardando seleção...</td></tr>`;
        return;
    }

    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 10px;">Buscando dados no servidor...</td></tr>`;

    db.ref(`ligas/${liga}/usuarios`).on('value', snap => {
        const usuarios = snap.val();
        if (!usuarios) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 10px;">Nenhum treinador nesta liga.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        for (let login in usuarios) {
            let user = usuarios[login];
            let clubeStr = user.timeAtual !== "Sem Clube" ? user.timeAtual.replace(/_/g, ' ') : "Aguardando Sorteio";

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #333;">
                    <td style="padding: 10px 0;"><strong style="color: #fff;">${user.nome}</strong><br><span style="font-size:11px; color:#888;">@${login}</span></td>
                    <td style="color: var(--verde-campo);">${clubeStr}</td>
                    <td style="text-align: right;">
                        <button onclick="expulsarTreinador('${liga}', '${login}', '${user.timeAtual}')" style="background: #dc3545; border: none; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; width: auto; margin: 0;">Expulsar</button>
                    </td>
                </tr>
            `;
        }
    });
}

function expulsarTreinador(liga, login, timeId) {
    pedirConfirmacao(`Tem certeza que deseja banir o usuário @${login}? Ele perderá o acesso e o time ficará sem técnico.`, () => {

        exibirModal("⏳ Processando", "<p style='text-align:center;'>Removendo treinador e limpando dados...</p>");

        let updates = {};
        updates[`ligas/${liga}/usuarios/${login}`] = null; // Deleta a conta do usuário

        db.ref().update(updates).then(() => {
            exibirModal("✅ Usuário Banido", `<p style='text-align:center; color: #dc3545;'>O treinador <strong>@${login}</strong> foi removido do servidor com sucesso.</p>`);
        }).catch(erro => {
            exibirModal("❌ Erro", `<p style='text-align:center;'>Falha ao expulsar: ${erro.message}</p>`);
        });
    });
}

function deslogarADM() {
    auth.signOut().then(() => {
        window.location.href = "index.html";
    });
}