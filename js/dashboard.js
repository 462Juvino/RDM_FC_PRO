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
           sortearTimeParaNovoTreinador();
        } else {
            carregarVisaoGeralClube();
        }
    });
});

async function sortearTimeParaNovoTreinador() {
    const area = document.getElementById('area-trabalho');
    if (!document.getElementById('animacao-espera')) {
        const style = document.createElement('style');
        style.id = 'animacao-espera';
        style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }

    area.innerHTML = `
        <div style="text-align: center; margin-top: 80px;">
            <div style="font-size: 50px; animation: spin 2s linear infinite; display: inline-block; margin-bottom: 20px;">🎲</div>
            <h2 style="color: #ff8c00; font-size: 28px;">Sorteando o seu Clube...</h2>
            <p style="color: #aaa; font-size: 16px;">Assinando papéis e buscando o comando de um time na liga...</p>
        </div>
    `;

    try {
        // 1. Puxa todos os times do banco global
        const snapTimes = await db.ref('banco_global_times').once('value');
        const times = snapTimes.val() || {};

        // 2. Puxa os usuários para ver quais times já estão ocupados
        const snapUsuarios = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
        const usuarios = snapUsuarios.val() || {};

        let timesOcupados = [];
        for (let u in usuarios) {
            if (usuarios[u].timeAtual && usuarios[u].timeAtual !== "Sem Clube") {
                timesOcupados.push(usuarios[u].timeAtual);
            }
        }

        // 3. Filtra apenas as vagas abertas
        let timesDisponiveis = [];
        for (let t in times) {
            if (t !== "Agentes_Livres" && t !== "Fantasma" && !timesOcupados.includes(t)) {
                timesDisponiveis.push(t);
            }
        }

        if (timesDisponiveis.length === 0) {
            area.innerHTML = `
                <div style="text-align: center; margin-top: 80px;">
                    <h2 style="color: #dc3545; font-size: 28px;">⚠️ Liga Lotada</h2>
                    <p style="color: #aaa; font-size: 16px;">Infelizmente, todos os clubes já possuem um treinador ativo.</p>
                </div>`;
            return;
        }

        // 4. Sorteia um time para o técnico e o amarra a ele!
        const timeSorteado = timesDisponiveis[Math.floor(Math.random() * timesDisponiveis.length)];

        await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
            timeAtual: timeSorteado
        });

        // 5. Recarrega a página para abrir o Dashboard direto!
        window.location.reload();

    } catch (erro) {
        console.error("Erro no sorteio:", erro);
        area.innerHTML = `<p style="text-align:center; color:#dc3545;">Ocorreu um erro no sorteio. Tente atualizar a página com F5.</p>`;
    }
}

function carregarVisaoGeralClube() {
    iniciarSomAmbiente(dadosUsuario.timeAtual); // LIGA O SOM AMBIENTE! 🎵

    // Código antigo que já estava aqui carregando o painel...
    const area = document.getElementById('area-trabalho');
    const timeIdBanco = dadosUsuario.timeAtual;
    const meuTime = timeIdBanco.replace(/_/g, ' ');

    document.body.style.backgroundImage = `linear-gradient(rgba(18, 18, 18, 0.85), rgba(18, 18, 18, 0.95)), url('${getEstadio(timeIdBanco)}')`;

    let moral = dadosUsuario.moral !== undefined ? dadosUsuario.moral : 50;
    let corMoral = moral >= 70 ? "#00b853" : (moral <= 30 ? "#dc3545" : "#ff8c00");
    let emojiMoral = moral >= 70 ? "🤩" : (moral <= 30 ? "🤬" : "🤔");

    area.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
            <h2 style="margin-top:0; margin-bottom:0;">Comando Central: ${meuTime}</h2>
            <span style="background: #333; padding: 5px 15px; border-radius: 20px; font-size: 14px; border: 1px solid #555;">
                Meta: <strong>${dadosUsuario.tierMetas}ª Colocação</strong>
            </span>
        </div>

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
                    <p class="news-title">Giro da Bola (Notícias Ao Vivo)</p>
                    <p id="texto-noticia" class="news-text">"Buscando informações quentes nos bastidores..."</p>
                    <button class="btn-pular-news" onclick="gerarNoticia('${meuTime}')">Próxima Notícia ⏭️</button>
                </div>
            </div>
        </div>

        <div class="dashboard-widgets" style="grid-template-columns: repeat(auto-fit, minmax(48%, 1fr));">

            <!-- WIDGET 1: PRÓXIMO JOGO -->
            <div class="widget-card">
                <h3 style="margin-bottom: 5px;">Próximo Compromisso <span>📅</span></h3>
                <p id="lbl-rodada-dash" style="color: #aaa; font-size: 13px; text-align: center; margin-top: 0;">Buscando tabela...</p>
                <div class="placar-proximo-jogo" id="placar-proximo-jogo-container" style="background: #1a1a1a; border-radius: 8px; padding: 15px; border: 1px dashed #444;">
                    <div style="font-size: 24px; animation: spin 2s linear infinite; text-align: center; width: 100%;">⏳</div>
                </div>
                <button id="btn-ir-jogo" class="widget-btn" onclick="window.location.href='partida.html'" style="display: none; background: #ff8c00; border-color: #ff8c00; color: white;">Ir para a Transmissão ⚡</button>
            </div>

            <!-- WIDGET 2: MINI TABELA FUNCIONAL -->
            <div class="widget-card">
                <h3>Resumo da Divisão <span>🏆</span></h3>
                <table style="width: 100%; text-align: center; margin-bottom: 15px; font-size: 13px; color: #ccc; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid #444; color: #888;">
                            <th style="text-align:left; padding-bottom:5px;">Pos</th><th style="text-align:left;">Time</th><th>J</th><th>SG</th><th>Pts</th>
                        </tr>
                    </thead>
                    <tbody id="mini-tabela-corpo">
                        <tr><td colspan="5" style="padding: 10px;">Calculando tabela...</td></tr>
                    </tbody>
                </table>
                <button class="widget-btn" onclick="window.location.href='ranking.html'">Ver Tabela Completa</button>
            </div>

            <!-- WIDGET 3: ESTATÍSTICAS INTEGRADAS -->
            <div class="widget-card">
                <h3>Destaques da Liga <span>🔥</span></h3>
                <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px;">
                    <div style="flex: 1; min-width: 150px; background: #1a1a1a; padding: 10px; border-radius: 6px; border: 1px solid #333;">
                        <div style="font-size: 11px; color: #ff8c00; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">Top Gols ⚽</div>
                        <ul id="lista-top-gols" class="lista-info" style="font-size: 12px;"></ul>
                    </div>
                    <div style="flex: 1; min-width: 150px; background: #1a1a1a; padding: 10px; border-radius: 6px; border: 1px solid #333;">
                        <div style="font-size: 11px; color: var(--verde-campo); font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">Top Assist. 👟</div>
                        <ul id="lista-top-asts" class="lista-info" style="font-size: 12px;"></ul>
                    </div>
                </div>
            </div>

            <!-- WIDGET 4: RADAR DO MERCADO -->
            <div class="widget-card">
                <h3>Radar do Mercado <span>💼</span></h3>
                <div id="lista-radar-mercado" style="background: #1a1a1a; border-radius: 6px; border: 1px solid #333; padding: 10px; min-height: 100px; max-height: 150px; overflow-y: auto; margin-bottom: 15px;">
                    <p style="color:#666; font-size:12px; text-align:center; margin-top: 30px;">Acessando fax da diretoria...</p>
                </div>
                <button class="widget-btn" onclick="window.location.href='mercado.html'">Ir ao Mercado de Transferências</button>
            </div>

        </div>
    `;

    buscarMeuProximoJogo(timeIdBanco);
    carregarEstatisticasGerais(timeIdBanco);
    carregarMiniTabela(timeIdBanco);
    carregarRadarMercado();

    if(window.loopNoticias) clearInterval(window.loopNoticias);
    gerarNoticia(meuTime);
    window.loopNoticias = setInterval(() => gerarNoticia(meuTime), 10000);
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
        const rodadaKey = `rodada_${rodada}`;
        let meuJogo = null;
        let campeonatoNome = "Campeonato Nacional";

        // Verifica se é dia de Copa (Sábado) para mudar o título
        let dataHoje = new Date().getDay();
        if (dataHoje === 6 && cal.copa) {
            // Lógica simples pra descobrir a fase da copa se necessário,
            // mas vamos manter genérico para não quebrar a busca
            campeonatoNome = "Copa (Mata-Mata)";
        }

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

            let dataHora = meuJogo.data_jogo || "Data a definir";
            lblRodada.innerHTML = `<strong style="color: #fff;">${campeonatoNome} - Rodada ${rodada}</strong><br><span style="color: var(--verde-campo); font-size: 12px; font-weight: bold;">📅 ${dataHora}</span>`;

            btnIrJogo.style.display = "block";
            if (meuJogo.jogado || meuJogo.linhaDoTempo) {
                lblRodada.innerHTML += ` <span style="color: #dc3545; font-size: 11px; text-transform: uppercase;">(Partida Rolando / Encerrada)</span>`;
                btnIrJogo.innerText = "Ver Resultado e Gols";
                btnIrJogo.style.background = "#333";
                btnIrJogo.style.borderColor = "#555";
            }

            placarContainer.innerHTML = `
                <div style="display:flex; justify-content:center; align-items:center; width:100%;">
                    <span style="color: ${isMandante ? '#fff' : '#aaa'}; font-weight: ${isMandante ? 'bold' : 'normal'}; text-align: right; flex: 1;">
                        ${mandante} <img src="${getEscudo(meuJogo.mandante)}" onerror="this.src='esculdos/default.png'" class="escudo-mini">
                    </span>
                    <span style="color: #666; font-size: 14px; padding: 0 15px;">X</span>
                    <span style="color: ${!isMandante ? '#fff' : '#aaa'}; font-weight: ${!isMandante ? 'bold' : 'normal'}; text-align: left; flex: 1;">
                        <img src="${getEscudo(meuJogo.visitante)}" onerror="this.src='esculdos/default.png'" class="escudo-mini"> ${visitante}
                    </span>
                </div>
            `;
        } else {
            placarContainer.innerHTML = `<span style="font-size: 14px; color: #888;">Descanso nesta rodada.</span>`;
        }

    } catch (e) {
        console.error("Erro ao buscar jogo:", e);
    }
}

// ========================================================
// 6. O JORNAL DINÂMICO (IA DE NOTÍCIAS)
// ========================================================
let ultimaNoticia = ""; // Guarda a última notícia para não repetir

async function gerarNoticia(meuTime) {
    const elem = document.getElementById('texto-noticia');
    if(!elem) return;

    let noticias = [
        `"Especulações fortíssimas indicam que a diretoria do ${meuTime} está preparando um bote no mercado!"`,
        `"O campeonato esquenta e a imprensa já questiona as táticas escolhidas para a próxima rodada."`,
        `"Fofoca de corredor: Treinadores adversários estão passando a madrugada estudando o esquema tático do ${meuTime}."`,
        `"Preparador físico em alerta: A maratona insana de jogos vai testar a resistência e o fôlego dos elencos."`,
        `"Clima tenso? Fontes anônimas dizem que a cobrança por resultados está aumentando nos bastidores."`,
        `"A torcida não para de cantar! Há uma expectativa de quebra de recorde de público para os próximos compromissos da liga."`,
        `"Olho no cofre! Especialistas financeiros alertam para a inflação e pedem cautela nos leilões do mercado da bola."`,
        `"Fim da linha para os veteranos? As novas promessas da base (Pro Players) estão pedindo passagem nos treinos desta semana."`
    ];

    try {
        const snapCal = await db.ref(`ligas/${ligaLogada}/calendario`).once('value');
        const cal = snapCal.val();

        // 1. FOFOCA SOBRE RESULTADOS (Goleadas e Seu Time)
        if (cal && cal.rodadaAtual > 1) {
            let rodadaAnterior = `rodada_${cal.rodadaAtual - 1}`;
            let jogosA = cal.serieA ? cal.serieA[rodadaAnterior] : {};
            let jogosB = cal.serieB ? cal.serieB[rodadaAnterior] : {};
            let jogos = {...jogosA, ...jogosB};

            for (let j in jogos) {
                let jogo = jogos[j];
                if (jogo.jogado || jogo.linhaDoTempo) {
                    let m = jogo.mandante.replace(/_/g,' ');
                    let v = jogo.visitante.replace(/_/g,' ');
                    let dif = Math.abs(jogo.placarMandante - jogo.placarVisitante);

                    // Notícias de Goleada (3 gols ou mais de diferença)
                    if (dif >= 3) {
                        let humilhado = jogo.placarMandante < jogo.placarVisitante ? m : v;
                        let carrasco = jogo.placarMandante > jogo.placarVisitante ? m : v;
                        noticias.push(`"VEXAME! O time do ${humilhado} foi atropelado e humilhado pelo ${carrasco} na última rodada. Clima tenso no vestiário!"`);
                        noticias.push(`"Máquina de gols! A torcida do ${carrasco} está em êxtase após a goleada brutal de ontem."`);
                    }

                    // Notícias sobre o SEU TIME especificamente
                    if (jogo.mandante === dadosUsuario.timeAtual || jogo.visitante === dadosUsuario.timeAtual) {
                        let meusGols = jogo.mandante === dadosUsuario.timeAtual ? jogo.placarMandante : jogo.placarVisitante;
                        let advGols = jogo.mandante === dadosUsuario.timeAtual ? jogo.placarVisitante : jogo.placarMandante;

                        if (meusGols > advGols) {
                            noticias.push(`"Embalou! A cidade está em festa após a bela vitória do ${meuTime} na última rodada!"`);
                            noticias.push(`"A tática funcionou perfeitamente e o ${meuTime} garantiu +3 pontos importantes no campeonato."`);
                        } else if (meusGols < advGols) {
                            noticias.push(`"Sinal de alerta! A dura derrota na última rodada colocou o treinador do ${meuTime} sob pressão da diretoria."`);
                            noticias.push(`"Reunião a portas fechadas: O elenco do ${meuTime} tenta entender os erros cometidos na última partida."`);
                        } else {
                            noticias.push(`"Jogo truncado! O empate na última rodada deixou um gosto amargo para os torcedores do ${meuTime}."`);
                        }
                    }
                }
            }
        }

        // 2. FOFOCAS SOBRE JOGADORES PRO E AVALIAÇÕES
        const snapPro = await db.ref(`ligas/${ligaLogada}/pro_players`).once('value');
        const proPlayers = snapPro.val();
        if (proPlayers) {
            for(let key in proPlayers) {
                let p = proPlayers[key];
                if (p.nota_comunidade) {
                    let nota = parseFloat(p.nota_comunidade);
                    if (nota >= 4.0) noticias.push(`"Craque isolado! O atleta ${p.nome} vem encantando o país. A comunidade o avaliou com nota ${nota}⭐ e os gigantes já abrem o cofre!"`);
                    else if (nota <= 2.5) noticias.push(`"Decepção da base? O jovem ${p.nome} foi chamado de 'perna de pau' pelos treinadores da liga (Média ${nota}⭐). Será que ele dá a volta por cima?"`);
                } else if (p.status === "avaliando") {
                    noticias.push(`"Olho vivo: A promessa ${p.nome} acabou de se formar na base e aguarda a impiedosa avaliação dos técnicos da liga!"`);
                }
            }
        }

        // 3. FOFOCAS DE MERCADO
        const snapMercado = await db.ref(`ligas/${ligaLogada}/mercado_propostas`).once('value');
        const propostas = snapMercado.val();
        if (propostas) {
            for(let idAlvo in propostas) {
                let lances = Object.keys(propostas[idAlvo]).length;
                if(lances > 1) {
                    noticias.push(`"LEILÃO ABERTO! Um jogador misterioso está sendo disputado a tapa por ${lances} clubes diferentes neste exato momento!"`);
                } else {
                    noticias.push(`"Rumores quentes: Maletas de dinheiro circulam nos bastidores. Uma transferência bombástica pode estourar a qualquer momento."`);
                }
            }
        }
    } catch(e) { console.error("Erro na IA do Jornal:", e); }

    let noticiaSorteada;
    // Sorteia até achar uma diferente da última que apareceu na tela
    do {
        noticiaSorteada = noticias[Math.floor(Math.random() * noticias.length)];
    } while (noticiaSorteada === ultimaNoticia && noticias.length > 1);

    ultimaNoticia = noticiaSorteada;

    elem.style.opacity = 0;
    setTimeout(() => {
        elem.innerText = noticiaSorteada;
        elem.style.opacity = 1;
        elem.style.transition = "opacity 0.5s";
    }, 300);
}

async function carregarEstatisticasGerais(meuTimeId) {
    try {
        const snapTimes = await db.ref('banco_global_times').once('value');
        const times = snapTimes.val();
        let todosJogadores = [];
        let minhaDivisao = times && times[meuTimeId] ? times[meuTimeId].divisao : "A";

        if (times) {
            for (let t in times) {
                // FILTRA OS DESTAQUES APENAS DA SUA DIVISÃO!
                if (times[t].divisao === minhaDivisao && times[t].jogadores) {
                    for (let j in times[t].jogadores) {
                        let jog = times[t].jogadores[j];
                        jog.timeOrigem = t;
                        todosJogadores.push(jog);
                    }
                }
            }
        }

        // GOLS
        let artilheiros = [...todosJogadores].filter(j => j.estatisticas && j.estatisticas.gols > 0).sort((a, b) => b.estatisticas.gols - a.estatisticas.gols).slice(0, 5);
        let htmlGols = artilheiros.length === 0 ? '<li><span style="color:#666;">Sem gols...</span></li>' : '';
        artilheiros.forEach(j => {
            let nomeCurto = j.nome.split(" ")[0];
            htmlGols += `<li style="padding: 4px 0;"><span style="color:#fff;">${nomeCurto} <span style="font-size:9px;color:#888;">(${j.timeOrigem.replace(/_/g,' ')})</span></span> <span style="color:#ff8c00; font-weight:bold;">${j.estatisticas.gols}</span></li>`;
        });
        document.getElementById('lista-top-gols').innerHTML = htmlGols;

        // ASSISTÊNCIAS
        let assistentes = [...todosJogadores].filter(j => j.estatisticas && j.estatisticas.assistencias > 0).sort((a, b) => b.estatisticas.assistencias - a.estatisticas.assistencias).slice(0, 5);
        let htmlAsts = assistentes.length === 0 ? '<li><span style="color:#666;">Sem assistências...</span></li>' : '';
        assistentes.forEach(j => {
            let nomeCurto = j.nome.split(" ")[0];
            htmlAsts += `<li style="padding: 4px 0;"><span style="color:#fff;">${nomeCurto} <span style="font-size:9px;color:#888;">(${j.timeOrigem.replace(/_/g,' ')})</span></span> <span style="color:var(--verde-campo); font-weight:bold;">${j.estatisticas.assistencias}</span></li>`;
        });
        document.getElementById('lista-top-asts').innerHTML = htmlAsts;

    } catch (e) { console.error(e); }
}

async function carregarMiniTabela(meuTimeId) {
    try {
        const snapTimes = await db.ref('banco_global_times').once('value');
        const timesGlobais = snapTimes.val() || {};

        let minhaDivisao = timesGlobais[meuTimeId] ? timesGlobais[meuTimeId].divisao : "A";

        const snapCal = await db.ref(`ligas/${ligaLogada}/calendario`).once('value');
        const cal = snapCal.val();
        if(!cal) return;

        let tabela = {};
        for (let t in timesGlobais) {
            if (timesGlobais[t].divisao === minhaDivisao) {
                tabela[t] = { id: t, Pts: 0, J: 0, V: 0, SG: 0, GP: 0, GC: 0 };
            }
        }

        const jogosDivisao = minhaDivisao === "A" ? cal.serieA : cal.serieB;
        if (jogosDivisao) {
            for (let rodada in jogosDivisao) {
                for (let idJogo in jogosDivisao[rodada]) {
                    let jogo = jogosDivisao[rodada][idJogo];

                    if (jogo.jogado || jogo.linhaDoTempo) {
                        let m = jogo.mandante; let v = jogo.visitante;
                        let gm = jogo.placarMandante || 0; let gv = jogo.placarVisitante || 0;
                        if (m === "Fantasma" || v === "Fantasma") continue;

                        if(!tabela[m]) tabela[m] = { id: m, Pts: 0, J: 0, V: 0, SG: 0, GP: 0, GC: 0 };
                        if(!tabela[v]) tabela[v] = { id: v, Pts: 0, J: 0, V: 0, SG: 0, GP: 0, GC: 0 };

                        tabela[m].J++; tabela[m].GP += gm; tabela[m].GC += gv;
                        tabela[v].J++; tabela[v].GP += gv; tabela[v].GC += gm;

                        if (gm > gv) { tabela[m].Pts += 3; tabela[m].V++; }
                        else if (gv > gm) { tabela[v].Pts += 3; tabela[v].V++; }
                        else { tabela[m].Pts += 1; tabela[v].Pts += 1; }
                    }
                }
            }
        }

        for (let t in tabela) tabela[t].SG = tabela[t].GP - tabela[t].GC;
        let arrTabela = Object.values(tabela);
        arrTabela.sort((a, b) => {
            if (b.Pts !== a.Pts) return b.Pts - a.Pts;
            if (b.V !== a.V) return b.V - a.V;
            if (b.SG !== a.SG) return b.SG - a.SG;
            return b.GP - a.GP;
        });

        let html = "";
        let acheiMeuTime = false;

        for(let i = 0; i < arrTabela.length; i++) {
            let t = arrTabela[i];
            let ehMeu = (t.id === meuTimeId);
            if (ehMeu) acheiMeuTime = true;

            // Mostra os 4 primeiros ou o seu time
            if (i < 4 || ehMeu) {
                let cor = ehMeu ? "#ff8c00" : "#fff";
                let peso = ehMeu ? "bold" : "normal";
                html += `
                    <tr style="border-bottom: 1px solid #333; background: ${ehMeu ? 'rgba(255,140,0,0.1)' : 'transparent'};">
                        <td style="padding: 8px 0; color: #aaa;">${i+1}º</td>
                        <td style="text-align: left; color: ${cor}; font-weight: ${peso};">
                            <img src="${getEscudo(t.id)}" onerror="this.src='esculdos/default.png'" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 5px;">
                            ${t.id.replace(/_/g, ' ')}
                        </td>
                        <td>${t.J}</td>
                        <td style="color: ${t.SG > 0 ? 'var(--verde-campo)' : (t.SG < 0 ? '#dc3545' : '#888')};">${t.SG > 0 ? '+' : ''}${t.SG}</td>
                        <td style="font-weight: bold; color: #fff; background: rgba(0,0,0,0.2); border-radius: 4px;">${t.Pts}</td>
                    </tr>
                `;
            }
        }

        document.getElementById('mini-tabela-corpo').innerHTML = html;

    } catch (e) { console.error(e); }
}

async function carregarRadarMercado() {
    try {
        const snapPropostas = await db.ref(`ligas/${ligaLogada}/mercado_propostas`).once('value');
        const propostas = snapPropostas.val();
        const listaRadar = document.getElementById('lista-radar-mercado');

        if (!propostas) {
            listaRadar.innerHTML = `<p style="color:#666; font-size:12px; text-align:center; margin-top: 30px;">O fax está silencioso. Nenhuma negociação ativa.</p>`;
            return;
        }

        const snapTimes = await db.ref('banco_global_times').once('value');
        const timesGlobais = snapTimes.val() || {};

        let html = "";
        for (let idAlvo in propostas) {
            let lancesObj = propostas[idAlvo];
            let qtdLances = Object.keys(lancesObj).length;

            // Tenta achar o nome do jogador alvo no banco global
            let nomeAlvo = "Atleta Desconhecido";
            for(let t in timesGlobais) {
                if(timesGlobais[t].jogadores && timesGlobais[t].jogadores[idAlvo]) {
                    nomeAlvo = timesGlobais[t].jogadores[idAlvo].nome;
                    break;
                }
            }

            html += `
                <div style="padding: 8px; border-bottom: 1px dashed #444; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column;">
                        <strong style="color: #fff;">${nomeAlvo}</strong>
                        <span style="color: #888; font-size: 10px;">Recebeu ${qtdLances} proposta(s)</span>
                    </div>
                    <span style="background: rgba(255, 140, 0, 0.2); color: #ff8c00; padding: 3px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #ff8c00;">Em Negociação</span>
                </div>
            `;
        }
        listaRadar.innerHTML = html;

    } catch(e) { console.error(e); }
}

// ========================================================
// 8. FERRAMENTAS GERAIS
// ========================================================
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
function formatarDinheiro(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}
function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}

// ==========================================
// SISTEMA DE SOM AMBIENTE DA VISÃO GERAL
// ==========================================
let somAmbienteIniciado = false;
const hinoAmbiente = new Audio();
const torcidaAmbiente = new Audio();

function iniciarSomAmbiente(nomeDoTime) {
    if (somAmbienteIniciado || !nomeDoTime || nomeDoTime === "Sem Clube") return;

    // Caminhos corrigidos para refletir os nomes reais dos arquivos no seu GitHub!
    hinoAmbiente.src = `sounds/${nomeDoTime}_Hino.mp3`;
    hinoAmbiente.onerror = () => { hinoAmbiente.src = 'sounds/hino_generico.mp3'; };
    hinoAmbiente.volume = 0.2;
    hinoAmbiente.loop = true;

    torcidaAmbiente.src = `sounds/${nomeDoTime}_torcida.mp3`;
    torcidaAmbiente.onerror = () => { torcidaAmbiente.src = 'sounds/torcida_generica.mp3'; };
    torcidaAmbiente.volume = 0.1;
    torcidaAmbiente.loop = true;

    let promise = hinoAmbiente.play();
    if (promise !== undefined) {
        promise.then(() => {
            torcidaAmbiente.play().catch(()=>{});
            somAmbienteIniciado = true;
            criarBotaoSom();
        }).catch(() => {
            document.body.addEventListener('click', iniciarForcado, { once: true });
        });
    }
}

function iniciarForcado() {
    if (somAmbienteIniciado) return;
    hinoAmbiente.play().catch(()=>{});
    torcidaAmbiente.play().catch(()=>{});
    somAmbienteIniciado = true;
    criarBotaoSom();
}

function criarBotaoSom() {
    if (document.getElementById('btn-som-ambiente')) return;

    let btn = document.createElement('button');
    btn.id = 'btn-som-ambiente';
    btn.innerHTML = '🔊';
    btn.title = "Ligar/Desligar Som";

    // Visual elegante e pequeno, feito para se encaixar no cabeçalho
    btn.style.cssText = "background: transparent; color: var(--verde-campo); border: 1px solid #444; border-radius: 4px; padding: 4px 8px; font-size: 14px; cursor: pointer; transition: 0.2s; margin-left: 15px;";

    btn.onclick = (e) => {
        e.stopPropagation();
        if (hinoAmbiente.paused) {
            hinoAmbiente.play(); torcidaAmbiente.play();
            btn.innerHTML = '🔊';
            btn.style.color = 'var(--verde-campo)';
            btn.style.borderColor = '#444';
        } else {
            hinoAmbiente.pause(); torcidaAmbiente.pause();
            btn.innerHTML = '🔇';
            btn.style.color = '#888';
            btn.style.borderColor = '#333';
        }
    };

    // Procura o cabeçalho onde fica o "Treinador: Nome" para injetar o botão lá
    let cabecalhoInfos = document.querySelector('.header-infos');
    if (cabecalhoInfos) {
        cabecalhoInfos.style.display = "flex";
        cabecalhoInfos.style.alignItems = "center";
        cabecalhoInfos.appendChild(btn);
    } else {
        // Fallback caso não ache o cabeçalho exato
        btn.style.position = "absolute";
        btn.style.top = "15px";
        btn.style.right = "250px";
        document.body.appendChild(btn);
    }
}