// js/dashboard.js

// 1. VERIFICA SEGURANÇA
const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) {
    window.location.href = "index.html";
}

let dadosUsuario = {};

// 2. INICIALIZAÇÃO
window.addEventListener('DOMContentLoaded', () => {
    db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).on('value', (snapshot) => {
        dadosUsuario = snapshot.val();

        if(!dadosUsuario) {
            // Se não achar o usuário, vamos usar o nosso padrão elegante e não o alert()
            localStorage.removeItem('treinadorLiga');
            localStorage.removeItem('treinadorUsuario');
            window.location.href = "index.html";
            return;
        }

        document.getElementById('nome-treinador').innerText = dadosUsuario.nome;
        document.getElementById('nome-liga').innerText = ligaLogada;
        document.getElementById('saldo-treinador').innerText = formatarDinheiro(dadosUsuario.caixaClube);

        if (dadosUsuario.timeAtual === "Sem Clube" || !dadosUsuario.timeAtual) {
           telaAguardandoSorteio();
        } else {
            carregarVisaoGeralClube();
        }
    });
});

// TELA: AGUARDANDO SORTEIO DA DIRETORIA
function telaAguardandoSorteio() {
    const area = document.getElementById('area-trabalho');
    if (!document.getElementById('animacao-espera')) {
        const style = document.createElement('style');
        style.id = 'animacao-espera';
        style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }

    area.innerHTML = `
        <div style="text-align: center; margin-top: 80px;">
            <h2 style="color: #ff8c00; font-size: 32px;">🎲 Aguardando Sorteio</h2>
            <p style="color: #aaa; font-size: 18px; max-width: 600px; margin: 20px auto; line-height: 1.6;">
                Você está cadastrado na liga <strong>${ligaLogada}</strong>.<br>
                A administração ainda não realizou o sorteio oficial dos clubes.
            </p>
            <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; border: 1px solid #444; max-width: 400px; margin: 0 auto;">
                <div style="font-size: 50px; animation: spin 4s linear infinite; display: inline-block;">⏳</div>
                <p style="color: var(--verde-campo); margin-top: 15px; font-weight: bold;">
                    Fique de olho! Esta tela será atualizada automaticamente quando seu time for definido.
                </p>
            </div>
        </div>
    `;
}

// 5. TELA: VISÃO GERAL (EMPREGADO)
function carregarVisaoGeralClube() {
    const area = document.getElementById('area-trabalho');
    const timeIdBanco = dadosUsuario.timeAtual;
    const meuTime = timeIdBanco.replace(/_/g, ' ');

    // Calcula a Moral e as cores
    let moral = dadosUsuario.moral !== undefined ? dadosUsuario.moral : 50; // Começa em 50% se for novo
    let corMoral = moral >= 70 ? "#00b853" : (moral <= 30 ? "#dc3545" : "#ff8c00");
    let emojiMoral = moral >= 70 ? "🤩" : (moral <= 30 ? "🤬" : "🤔");

    area.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
            <h2 style="margin-top:0; margin-bottom:0;">Comando Central: ${meuTime}</h2>
            <span style="background: #333; padding: 5px 15px; border-radius: 20px; font-size: 14px; border: 1px solid #555;">
                Meta: <strong>${dadosUsuario.tierMetas}ª Colocação</strong>
            </span>
        </div>

        <!-- BARRINHA DE MORAL DA TORCIDA -->
        <div style="width: 100%; background: #1a1a1a; border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid #444; display: flex; align-items: center; gap: 15px; box-sizing: border-box;">
            <div style="font-size: 28px;">${emojiMoral}</div>
            <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #aaa; margin-bottom: 8px;">
                    <span>Aprovação da Diretoria e Torcida</span>
                    <span style="color: ${corMoral}; font-weight: bold; font-size: 15px;">${moral}%</span>
                </div>
                <div style="width: 100%; background: #333; height: 12px; border-radius: 6px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);">
                    <div style="width: ${moral}%; background: ${corMoral}; height: 100%; transition: width 1s ease-in-out; border-radius: 6px;"></div>
                </div>
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <div class="news-ticker">
                <div class="news-icon">📰</div>
                <div class="news-content">
                    <p class="news-title">Giro da Bola</p>
                    <p id="texto-noticia" class="news-text">"Carregando últimas notícias do campeonato..."</p>
                    <button class="btn-pular-news" onclick="gerarNoticia('${meuTime}')">Próxima ⏭️</button>
                </div>
            </div>
        </div>

        <div class="dashboard-widgets">

            <!-- WIDGET: PRÓXIMO JOGO -->
            <div class="widget-card">
                <h3 style="margin-bottom: 5px;">Próximo Jogo <span>📅</span></h3>
                <p id="lbl-rodada-dash" style="color: #aaa; font-size: 13px; text-align: center; margin-top: 0;">Buscando tabela...</p>

                <div class="placar-proximo-jogo" id="placar-proximo-jogo-container" style="background: #1a1a1a; border-radius: 8px; padding: 15px; border: 1px dashed #444;">
                    <div style="font-size: 24px; animation: spin 2s linear infinite; text-align: center; width: 100%;">⏳</div>
                </div>

                <button id="btn-ir-jogo" class="widget-btn" onclick="window.location.href='partida.html'" style="display: none; background: #ff8c00; border-color: #ff8c00; color: white;">Ir para o Jogo ⚡</button>
            </div>

            <!-- WIDGET: CLASSIFICAÇÃO -->
            <div class="widget-card">
                <h3>Classificação <span>🏆</span></h3>
                <table style="width: 100%; text-align: left; margin-bottom: 15px; font-size: 14px; color: #ccc;">
                    <tr><th>Pos</th><th>Time</th><th style="text-align:right;">Pts</th></tr>
                    <tr><td>1º</td><td class="nome-destaque">A definir</td><td style="text-align:right;">0</td></tr>
                    <tr><td>2º</td><td class="nome-destaque">A definir</td><td style="text-align:right;">0</td></tr>
                    <tr><td>3º</td><td class="nome-destaque">A definir</td><td style="text-align:right;">0</td></tr>
                    <tr><td colspan="3"><hr style="border-color:#444; margin: 5px 0;"></td></tr>
                    <tr style="color: var(--verde-campo); font-weight: bold;">
                        <td>-</td><td>${meuTime}</td><td style="text-align:right;">0</td>
                    </tr>
                </table>
                <button class="widget-btn" onclick="window.location.href='ranking.html'">Ver Tabela Completa</button>
            </div>

            <!-- WIDGET: ESTATÍSTICAS ROTATIVAS -->
            <div class="widget-card">
                <h3 id="titulo-estatistica">Top Artilheiros <span>⚽</span></h3>
                <div id="container-estatistica" style="margin-bottom: 15px;" class="fade-in"></div>
                <button class="widget-btn" onclick="window.location.href='ranking.html'">Ver Estatísticas</button>
            </div>

        </div>
    `;

    // Dispara a busca do jogo real!
    buscarMeuProximoJogo(timeIdBanco);

    // Loops
    if(window.loopNoticias) clearInterval(window.loopNoticias);
    if(window.loopEstatistica) clearInterval(window.loopEstatistica);

    gerarNoticia(meuTime);
    window.loopNoticias = setInterval(() => gerarNoticia(meuTime), 8000);
    window.loopEstatistica = setInterval(alternarEstatisticas, 5000);
    alternarEstatisticas();
}

// INTEGRAÇÃO COM O CALENDÁRIO
async function buscarMeuProximoJogo(timeIdBanco) {
    const meuTime = timeIdBanco.replace(/_/g, ' ');
    const placarContainer = document.getElementById('placar-proximo-jogo-container');
    const lblRodada = document.getElementById('lbl-rodada-dash');
    const btnIrJogo = document.getElementById('btn-ir-jogo');

    try {
        const snapCal = await db.ref(`ligas/${ligaLogada}/calendario`).once('value');
        const cal = snapCal.val();

        if (!cal) {
            lblRodada.innerText = "Aguardando CBF Virtual";
            placarContainer.innerHTML = `<span style="font-size: 14px; color: #888;">Nenhum sorteio realizado ainda.</span>`;
            return;
        }

        const rodada = cal.rodadaAtual || 1;
        lblRodada.innerText = `Campeonato Nacional - Rodada ${rodada}`;
        const rodadaKey = `rodada_${rodada}`;
        let meuJogo = null;

        // Varre a Série A
        if (cal.serieA && cal.serieA[rodadaKey]) {
            for (let j in cal.serieA[rodadaKey]) {
                if (cal.serieA[rodadaKey][j].mandante === timeIdBanco || cal.serieA[rodadaKey][j].visitante === timeIdBanco) {
                    meuJogo = cal.serieA[rodadaKey][j];
                }
            }
        }
        // Varre a Série B
        if (!meuJogo && cal.serieB && cal.serieB[rodadaKey]) {
            for (let j in cal.serieB[rodadaKey]) {
                if (cal.serieB[rodadaKey][j].mandante === timeIdBanco || cal.serieB[rodadaKey][j].visitante === timeIdBanco) {
                    meuJogo = cal.serieB[rodadaKey][j];
                }
            }
        }

        if (meuJogo) {
            const mandante = meuJogo.mandante.replace(/_/g, ' ');
            const visitante = meuJogo.visitante.replace(/_/g, ' ');
            const isMandante = (meuJogo.mandante === timeIdBanco);

            placarContainer.innerHTML = `
                <span style="color: ${isMandante ? '#fff' : '#aaa'}; font-weight: ${isMandante ? 'bold' : 'normal'};">${mandante}</span>
                <span style="color: #666; font-size: 14px; padding: 0 10px;">X</span>
                <span style="color: ${!isMandante ? '#fff' : '#aaa'}; font-weight: ${!isMandante ? 'bold' : 'normal'};">${visitante}</span>
            `;

            btnIrJogo.style.display = "block";
            if (meuJogo.jogado) {
                lblRodada.innerHTML += ` <span style="color: var(--verde-campo);">(Encerrada)</span>`;
                btnIrJogo.innerText = "Ver Resultado";
                btnIrJogo.style.background = "#333";
                btnIrJogo.style.borderColor = "#555";
            }
        } else {
            placarContainer.innerHTML = `<span style="font-size: 14px; color: #888;">Descanso nesta rodada.</span>`;
        }

    } catch (e) {
        console.error("Erro ao buscar jogo:", e);
    }
}

// 6. MOTOR DO JORNALZINHO DINÂMICO
async function gerarNoticia(meuTime) {
    const elem = document.getElementById('texto-noticia');
    if(!elem) return;

    let noticias = [
        `"Especulações fortíssimas indicam que a diretoria do ${meuTime} está preparando um bote no mercado!"`,
        `"O campeonato mal começou e a imprensa já questiona as táticas escolhidas para a rodada."`,
        `"Zebra à vista? Os analistas preveem uma rodada cheia de surpresas após os últimos treinos fechados."`
    ];

    try {
        // Busca Pro Players para fazer fofoca
        const snapPro = await db.ref(`ligas/${ligaLogada}/pro_players`).once('value');
        const proPlayers = snapPro.val();
        if (proPlayers) {
            for(let key in proPlayers) {
                let p = proPlayers[key];
                if (p.nota_comunidade) {
                    let nota = parseFloat(p.nota_comunidade);
                    if (nota >= 4.0) noticias.push(`"A torcida vai à loucura! O craque criado ${p.nome} vem sendo chamado de gênio nas avaliações (Média ${nota})!"`);
                    else if (nota <= 2.0) noticias.push(`"Polêmica: O novato ${p.nome} foi taxado de 'bagre' pelos especialistas (Média ${nota}). O mercado não perdoa!"`);
                } else if (p.status === "avaliando") {
                    noticias.push(`"Novo atleta na praça! ${p.nome} aguarda as avaliações dos treinadores para definir seu futuro."`);
                }
            }
        }

        // Busca Propostas no mercado para falar de "leilões"
        const snapMercado = await db.ref(`ligas/${ligaLogada}/mercado_propostas`).once('value');
        const propostas = snapMercado.val();
        if (propostas) {
            let qtdAlvos = Object.keys(propostas).length;
            if(qtdAlvos > 0) noticias.push(`"O mercado ferve! Temos ${qtdAlvos} negociações rolando nos bastidores da liga neste exato momento."`);

            // Verifica se tem algum jogador com vários lances (Leilão)
            for(let id in propostas) {
                let lances = Object.keys(propostas[id]).length;
                if(lances > 1) noticias.push(`"Guerra de Cartolas! Um atleta está sendo disputado a tapa por ${lances} clubes diferentes na surdina!"`);
            }
        }
    } catch(e) { /* Segue o jogo com as notícias base */ }

    const noticiaSorteada = noticias[Math.floor(Math.random() * noticias.length)];

    elem.style.opacity = 0;
    setTimeout(() => {
        elem.innerText = noticiaSorteada;
        elem.style.opacity = 1;
        elem.style.transition = "opacity 0.5s";
    }, 200);
}

// 7. MOTOR ROTATIVO DE ESTATÍSTICAS (RANKING GLOBAL)
let estadoEstatistica = 0;
let topArtilheiros = [];
let topAssistencias = [];

// Função que busca do banco uma vez para não sobrecarregar
async function buscarEstatisticasGlobais() {
    try {
        const snapTimes = await db.ref('banco_global_times').once('value');
        const times = snapTimes.val();
        let todosJogadores = [];

        if (times) {
            for (let t in times) {
                if (times[t].jogadores) {
                    for (let j in times[t].jogadores) {
                        let jog = times[t].jogadores[j];
                        jog.timeOrigem = t.replace(/_/g, ' '); // Guarda o time para a tela
                        todosJogadores.push(jog);
                    }
                }
            }
        }

        // Ordena e pega o TOP 3 de Gols
        topArtilheiros = [...todosJogadores]
            .filter(j => j.estatisticas && j.estatisticas.gols > 0)
            .sort((a, b) => b.estatisticas.gols - a.estatisticas.gols)
            .slice(0, 3);

        // Ordena e pega o TOP 3 de Assistências
        topAssistencias = [...todosJogadores]
            .filter(j => j.estatisticas && j.estatisticas.assistencias > 0)
            .sort((a, b) => b.estatisticas.assistencias - a.estatisticas.assistencias)
            .slice(0, 3);

    } catch (e) { console.error("Erro ao buscar estatísticas:", e); }
}

// Alterna os dados na tela a cada 5 segundos
async function alternarEstatisticas() {
    const titulo = document.getElementById('titulo-estatistica');
    const container = document.getElementById('container-estatistica');
    if(!titulo || !container) return;

    // Se as listas estiverem vazias, tenta buscar do banco
    if (topArtilheiros.length === 0 && topAssistencias.length === 0) {
        await buscarEstatisticasGlobais();
    }

    container.classList.remove('fade-in');
    void container.offsetWidth; // Força reflow da animação

    if (estadoEstatistica === 0) {
        titulo.innerHTML = `Top Artilheiros <span>⚽</span>`;
        let htmlLista = '<ul class="lista-info">';

        if (topArtilheiros.length === 0) {
            htmlLista += `<li><span class="nome-destaque">Nenhum gol na liga ainda</span></li>`;
        } else {
            topArtilheiros.forEach((j, index) => {
                let nomeCurto = j.nome.split(" ")[0];
                htmlLista += `<li><span class="nome-destaque">${index + 1}. ${nomeCurto} <span style="font-size:10px;color:#888;">(${j.timeOrigem})</span></span> <span>${j.estatisticas.gols} Gols</span></li>`;
            });
        }

        htmlLista += '</ul>';
        container.innerHTML = htmlLista;
        estadoEstatistica = 1;
    } else {
        titulo.innerHTML = `Líderes de Assistência <span>👟</span>`;
        let htmlLista = '<ul class="lista-info">';

        if (topAssistencias.length === 0) {
            htmlLista += `<li><span class="nome-destaque">Nenhuma assistência ainda</span></li>`;
        } else {
            topAssistencias.forEach((j, index) => {
                let nomeCurto = j.nome.split(" ")[0];
                htmlLista += `<li><span class="nome-destaque">${index + 1}. ${nomeCurto} <span style="font-size:10px;color:#888;">(${j.timeOrigem})</span></span> <span>${j.estatisticas.assistencias} Ast</span></li>`;
            });
        }

        htmlLista += '</ul>';
        container.innerHTML = htmlLista;
        estadoEstatistica = 0;
    }

    container.classList.add('fade-in');
}

// 8. FERRAMENTAS
function toggleMenu() { document.querySelector('.sidebar').classList.toggle('aberta'); }
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('aberta') && !e.target.closest('.sidebar') && !e.target.closest('.btn-menu')) {
        sidebar.classList.remove('aberta');
    }
});
function formatarDinheiro(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}
function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}