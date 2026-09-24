// js/dashboard.js

// 1. VERIFICA SEGURANÇA
const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');


if (!ligaLogada || !userLogado) {
    window.location.href = "index.html";
}

window.x1Audios = { torcidaM: new Audio(), torcidaV: new Audio(), hino: new Audio(), gol: new Audio(), fim: new Audio(), apito: new Audio() };


let dadosUsuario = {};
window.treinadoresGlobais = {}; // 🟢 Mapeamento global de quem controla quem

// 2. INICIALIZAÇÃO
window.addEventListener('DOMContentLoaded', () => {
    // Escuta independente para manter a lista de treinadores sempre atualizada sem bloquear a tela
    db.ref(`ligas/${ligaLogada}/usuarios`).on('value', snap => {
        const users = snap.val() || {};
        window.treinadoresGlobais = {};
        for(let key in users) {
            if(users[key].timeAtual && users[key].timeAtual !== "Sem Clube") {
                window.treinadoresGlobais[users[key].timeAtual] = users[key].nome;
            }
        }
    });

    // Escuta principal do seu usuário logado
    db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).on('value', (snapshot) => {
        dadosUsuario = snapshot.val();

        if(!dadosUsuario) {
            localStorage.removeItem('treinadorLiga');
            localStorage.removeItem('treinadorUsuario');
            window.location.href = "index.html";
            return;
        }

        document.getElementById('nome-treinador').innerText = dadosUsuario.nome;
        document.getElementById('nome-liga').innerText = ligaLogada;
        document.getElementById('saldo-treinador').innerText = formatarDinheiro(dadosUsuario.caixaClube);
        // 🔥 STREAK DIÁRIO - bônus viciante
        let hoje = new Date().toISOString().split('T')[0];
        let ultimo = dadosUsuario.ultimo_login || "";
        if(ultimo!== hoje){
            let streak = (dadosUsuario.streak||0) + 1;
            if(ultimo){
                let diff = (new Date(hoje) - new Date(ultimo))/86400000;
                if(diff > 1) streak = 1; // perdeu streak
            }
            let bonus = streak >= 7? 1000000 : streak >= 3? 300000 : 100000;
            db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({ultimo_login: hoje, streak: streak, caixaClube: (dadosUsuario.caixaClube||0)+bonus});
            setTimeout(()=>alert(`🔥 STREAK ${streak} dias! +${formatarDinheiro(bonus)}`), 1000);
        }

        if (dadosUsuario.timeAtual === "Sem Clube" ||!dadosUsuario.timeAtual) {
           tentarAssumirTimeIA(); // 🟢 Chama a nova inteligência em vez de travar direto!
        } else {
            carregarVisaoGeralClube();
        }
    });
});

async function tentarAssumirTimeIA() {
    try {
        // 1. Verifica se a liga já foi sorteada (Se já existe calendário)
        const snapCal = await db.ref(`ligas/${ligaLogada}/calendario`).once('value');
        if (!snapCal.exists()) {
            // A liga ainda não começou, então ele deve aguardar o ADM sortear.
            mostrarTelaAguardandoSorteio();
            return;
        }

        // 2. Se a liga já começou, vamos procurar uma vaga de IA!
        document.getElementById('area-trabalho').innerHTML = `
            <div style="text-align: center; margin-top: 50px; padding: 40px;">
                <div style="font-size: 50px; margin-bottom: 20px; animation: spin 2s linear infinite;">⏳</div>
                <h2 style="color:#ff8c00;">Procurando clube disponível... 🕵️‍♂️</h2>
            </div>
        `;

        const [snapUsers, snapTimes] = await Promise.all([
            db.ref(`ligas/${ligaLogada}/usuarios`).once('value'),
            db.ref('banco_global_times').once('value')
        ]);

        const usuarios = snapUsers.val() || {};
        const times = snapTimes.val() || {};

        let timesHumanos = [];
        for (let u in usuarios) {
            if (!u.startsWith('IA_') && usuarios[u].timeAtual && usuarios[u].timeAtual !== "Sem Clube") {
                timesHumanos.push(usuarios[u].timeAtual);
            }
        }

        // Filtra os times que não são de humanos e não são "fantasmas"
        let timesIA = Object.keys(times).filter(t => !t.startsWith("Agentes_Livres") && t !== "Fantasma" && !timesHumanos.includes(t));

        if (timesIA.length > 0) {
            // Sorteia um time da IA para o novato assumir
            let timeSorteado = timesIA[Math.floor(Math.random() * timesIA.length)];
            let loginIA = `IA_${timeSorteado}`;

            // Tenta herdar o dinheiro que a IA já tinha, ou cria o caixa base caso ela fosse muito pobre
            let caixaInicial = 15000000;
            if (usuarios[loginIA] && usuarios[loginIA].caixaClube) {
                caixaInicial = usuarios[loginIA].caixaClube;
            } else {
                let forcaTotal = 0;
                if (times[timeSorteado] && times[timeSorteado].jogadores) {
                    for (let j in times[timeSorteado].jogadores) {
                        let at = times[timeSorteado].jogadores[j].atributos;
                        forcaTotal += (at.ataque + at.defesa + at.forca + at.velocidade + at.habilidade);
                    }
                }
                let calcCaixa = 150000000 - (forcaTotal * 100000);
                caixaInicial = calcCaixa < 15000000 ? 15000000 : calcCaixa;
            }

            let updates = {};
            updates[`ligas/${ligaLogada}/usuarios/${userLogado}/timeAtual`] = timeSorteado;
            updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = caixaInicial;
            updates[`ligas/${ligaLogada}/usuarios/${userLogado}/moral`] = 50;
            updates[`ligas/${ligaLogada}/usuarios/${loginIA}`] = null; // Extermina a IA desse clube!

            await db.ref().update(updates);

            alert(`🎉 Sorte grande! Você acaba de assumir o comando do ${timeSorteado.replace(/_/g, ' ')}!`);
            window.location.reload();

        } else {
            // A liga está com as 40 vagas ocupadas por jogadores reais
            document.getElementById('area-trabalho').innerHTML = `
                <div style="text-align: center; margin-top: 50px; padding: 40px; background: #1a1a1a; border: 1px dashed #dc3545; border-radius: 8px;">
                    <div style="font-size: 50px; margin-bottom: 20px;">🚫</div>
                    <h2 style="color: #dc3545; font-size: 28px;">Liga Lotada!</h2>
                    <p style="color: #ccc; font-size: 16px;">Todos os clubes desta liga já possuem treinadores humanos. Não há vagas disponíveis no momento.</p>
                </div>
            `;
        }

    } catch (e) {
        console.error("Erro ao assumir time:", e);
        mostrarTelaAguardandoSorteio();
    }
}

function mostrarTelaAguardandoSorteio() {
    const area = document.getElementById('area-trabalho');
    area.innerHTML = `
        <div style="text-align: center; margin-top: 50px; padding: 40px; background: #1a1a1a; border: 1px dashed #555; border-radius: 8px;">
            <div style="font-size: 50px; margin-bottom: 20px;">⏳</div>
            <h2 style="color: #ff8c00; font-size: 28px;">Aguardando a Diretoria</h2>
            <p style="color: #ccc; font-size: 16px;">O Administrador da liga ainda não realizou o sorteio oficial dos clubes. Por favor, aguarde!</p>
            <p style="color: #888; font-size: 13px;">O Mercado e a Tática estão bloqueados, mas você já pode explorar as abas <strong>Pro Player</strong> e <strong>Pelada (Sorteio)</strong> no menu lateral.</p>
        </div>
    `;

    // Como bônus de segurança, trava os botões do menu lateral para abas proibidas!
    const botoes = document.querySelectorAll('.sidebar button');
    botoes.forEach(btn => {
        let txt = btn.innerText.toLowerCase();
        // 🟢 CORREÇÃO: Ignora o botão de sair usando a classe 'btn-sair'
        if (!btn.classList.contains('btn-sair') && (txt.includes('tática') || txt.includes('calendário') || txt.includes('classificação') || txt.includes('mercado') || txt.includes('transmissão') || txt.includes('jogo'))) {
            btn.onclick = () => alert("Acesso bloqueado! Aguarde o sorteio do seu clube para liberar este menu.");
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
        }
    });
}

function carregarVisaoGeralClube() {
    iniciarSomAmbiente(dadosUsuario.timeAtual);

    const area = document.getElementById('area-trabalho');
    const timeIdBanco = dadosUsuario.timeAtual;
    const meuTime = timeIdBanco.replace(/_/g, ' ');
    document.body.style.backgroundImage = `linear-gradient(rgba(18, 18, 18, 0.85), rgba(18, 18, 18, 0.95)), url('${getEstadio(timeIdBanco)}')`;
    // Atualiza contadores pra conquista
    db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/forcaAtual`).set(dadosUsuario.forcaAtual||0);

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

        <!-- 🚨 NOVA CENTRAL DE PENDÊNCIAS (Inicia oculta) 🚨 -->
        <div id="widget-avisos" style="display:none; width: 100%; background: rgba(220, 53, 69, 0.1); border: 1px solid #dc3545; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 0 15px rgba(220,53,69,0.2);">
            <h3 style="color: #dc3545; margin-top: 0; margin-bottom: 10px; font-size: 16px;">⚠️ Pendências do Clube</h3>
            <ul id="lista-avisos" style="list-style: none; padding: 0; margin: 0; font-size: 13px;"></ul>
        </div>

        <div style="width: 100%; background: #1a1a1a; border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid #444; display: flex; align-items: center; gap: 15px; box-sizing: border-box;">
            <div style="font-size: 28px;">${emojiMoral}</div>
            <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #aaa; margin-bottom: 8px;">
                    <span>Aprovação da Diretoria e Torcida</span>
                    <span style="color: ${corMoral}; font-weight: bold; font-size: 15px;">${moral}%</span>
                </div>
                <div style="width: 100%; background: #333; height: 12px; border-radius: 6px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5); margin-bottom: 10px;">
                    <div style="width: ${moral}%; background: ${corMoral}; height: 100%; transition: width 1s ease-in-out; border-radius: 6px;"></div>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button onclick="darColetivaImprensa()" style="flex: 1; background: #333; color: #fff; border: 1px solid #555; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">🎤 Coletiva</button>
                    <button onclick="pagarBichoExtra()" style="flex: 1; background: #ff8c00; color: #fff; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">💰 Bicho Extra</button>
                    <button onclick="recolherPatrocinio()" style="flex: 1; background: #007bff; color: #fff; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">📺 Patrocínio</button>
                    <button onclick="ativarTreinoSigiloso()" style="flex: 1; background: #800080; color: #fff; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; box-shadow: 0 0 10px rgba(128,0,128,0.5);">🛡️ Treino Secreto</button>
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
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
                    <div style="flex: 1; min-width: 100px; background: #1a1a1a; padding: 10px; border-radius: 6px; border: 1px solid #333;">
                        <div style="font-size: 11px; color: #ff8c00; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">Gols ⚽</div>
                        <ul id="lista-top-gols" class="lista-info" style="font-size: 12px;"></ul>
                    </div>
                    <div style="flex: 1; min-width: 100px; background: #1a1a1a; padding: 10px; border-radius: 6px; border: 1px solid #333;">
                        <div style="font-size: 11px; color: var(--verde-campo); font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">Asts 👟</div>
                        <ul id="lista-top-asts" class="lista-info" style="font-size: 12px;"></ul>
                    </div>
                    <div style="flex: 1; min-width: 100px; background: #1a1a1a; padding: 10px; border-radius: 6px; border: 1px solid #333;">
                        <div style="font-size: 11px; color: #007bff; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">Goleiros 🧤</div>
                        <ul id="lista-top-gks" class="lista-info" style="font-size: 12px;"></ul>
                    </div>
                </div>
            </div>

            <!-- WIDGET 4: RADAR DO MERCADO -->
            <div class="widget-card">
                <h3>Radar do Mercado <span>💼</span></h3>
                <div id="lista-radar-mercado" style="background: #1a1a1a; border-radius: 6px; border: 1px solid #333; padding: 10px; min-height: 100px; max-height: 150px; overflow-y: auto; margin-bottom: 15px;">
                    <p style="color:#666; font-size:12px; text-align:center; margin-top: 30px;">Acessando fax da diretoria...</p>
                </div>
                <button class="widget-btn" onclick="window.location.href='mercado.html'">Ir ao Mercado</button>
            </div>

            <!-- WIDGET 5: ARENA X1 -->
            <div class="widget-card" style="border: 1px solid #dc3545; box-shadow: 0 0 15px rgba(220,53,69,0.2);">
                <h3 style="color: #dc3545; margin-bottom: 5px;">Arena X1 ⚔️</h3>
                <p style="color: #aaa; font-size: 12px; margin-top:0; margin-bottom: 15px;">Desafie a Máquina ou outros Players. Aposte dinheiro do caixa ou passes de jogadores em um duelo instantâneo!</p>
                <div style="flex: 1;"></div>
                <button class="widget-btn" onclick="abrirModalX1()" style="background: #dc3545; color: white; border: none; font-weight: bold; width: 100%;">Entrar na Arena</button>
            </div>

            <!-- WIDGET 6: CENTRO DE TREINAMENTO + FISIOTERAPIA (2 ABAS) -->
            <div class="widget-card" style="border: 1px solid #007bff; box-shadow: 0 0 15px rgba(0,123,255,0.1); grid-column: 1 / -1;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="color: #007bff; margin:0;">CT & Fisioterapia 🏋️‍♂️🏥</h3>
                    <div style="display:flex; gap:5px;">
                        <button id="aba-ct-btn" onclick="mudarAbaCT('treino')" style="padding:5px 12px; background:#007bff; color:#fff; border:none; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">Treino</button>
                        <button id="aba-fisio-btn" onclick="mudarAbaCT('fisio')" style="padding:5px 12px; background:#222; color:#888; border:1px solid #333; border-radius:4px; font-size:11px; cursor:pointer;">Fisio 2h</button>
                    </div>
                </div>
                <div id="area-ct" style="flex: 1; display: flex; flex-direction: column; justify-content: center; margin-top: 5px;">
                    <p style="color:#666; font-size:12px; text-align:center;">Abrindo portões...</p>
                </div>
                <div id="area-fisio" style="flex: 1; display:none; flex-direction: column; margin-top: 5px;">
                    <p style="color:#666; font-size:12px; text-align:center;">Carregando DM...</p>
                </div>
            </div>
        </div>
    `;

    buscarMeuProximoJogo(timeIdBanco);
    carregarEstatisticasGerais(timeIdBanco);
    carregarMiniTabela(timeIdBanco);
    carregarRadarMercado();
    carregarCentralDeAvisos(timeIdBanco);
    carregarCentroDeTreinamento(timeIdBanco);
    criarBotaoChatSuperior();
    // Avisa de jogadores novos nos Agentes Livres
    carregarAvisoNovosJogadores();

    if(window.loopNoticias) clearInterval(window.loopNoticias);
    gerarNoticia(meuTime);
    window.loopNoticias = setInterval(() => gerarNoticia(meuTime), 10000);
}

// ==========================================
// 🏋️ CENTRO DE TREINAMENTO (CT) TEMPORIZADO
// ==========================================
let timerCT = null;

async function carregarCentroDeTreinamento(meuTimeId) {
    const areaCT = document.getElementById('area-ct');
    if (!areaCT) return;

    try {
        const [snapUser, snapTime] = await Promise.all([
            db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value'),
            db.ref(`banco_global_times/${meuTimeId}`).once('value')
        ]);

        let u = snapUser.val();
        let elenco = snapTime.val()?.jogadores || {};
        let ct = u.ct_ativo; // { id_jogador, nome, atributo, fim_ts }

        if (timerCT) clearInterval(timerCT);

        if (ct) {
            let agora = Date.now();
            if (agora >= ct.fim_ts) {
                // 🟢 FINALIZADO
                areaCT.innerHTML = `
                    <div style="text-align:center; padding: 10px; background: rgba(0,184,83,0.1); border: 1px dashed var(--verde-campo); border-radius: 6px;">
                        <strong style="color:var(--verde-campo); font-size:14px;">Treino Concluído! ✅</strong>
                        <p style="font-size:12px; color:#ccc; margin:5px 0;">${ct.nome} finalizou o treino de <strong>${ct.atributo.toUpperCase()}</strong> e está liberado.</p>
                        <button onclick="concluirTreinoCT('${ct.id_jogador}', '${ct.atributo}', '${meuTimeId}')" style="width:100%; padding:8px; background:var(--verde-campo); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px; margin-top:5px;">Resgatar +1 de Atributo</button>
                    </div>
                `;
            } else {
                // ⏳ ROLANDO (Apenas Visual)
                const atualizarRelogio = () => {
                    let f = ct.fim_ts - Date.now();
                    if (f <= 0) {
                        carregarCentroDeTreinamento(meuTimeId);
                        return;
                    }
                    let h = Math.floor((f % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    let m = Math.floor((f % (1000 * 60 * 60)) / (1000 * 60));
                    let s = Math.floor((f % (1000 * 60)) / 1000);
                    let tempoRestante = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;

                    if(document.getElementById('ct-relogio')) {
                        document.getElementById('ct-relogio').innerText = tempoRestante;
                    }
                };

                areaCT.innerHTML = `
                    <div style="text-align:center; padding: 10px; background: #111; border: 1px dashed #444; border-radius: 6px;">
                        <span style="color:#007bff; font-size:12px; font-weight:bold;">Treinando: ${ct.atributo.toUpperCase()} 🏃‍♂️</span>
                        <div style="color:#fff; font-size:14px; margin:5px 0;">${ct.nome}</div>
                        <div id="ct-relogio" style="font-size:22px; color:#ff8c00; font-family:monospace; font-weight:bold;">00:00:00</div>
                        <span style="color:#666; font-size:10px;">Atleta indisponível para os jogos oficiais.</span>
                    </div>
                `;
                atualizarRelogio();
                timerCT = setInterval(atualizarRelogio, 1000);
            }
        } else {
            // 🔓 LIVRE
            let optionsJ = `<option value="">Selecione o Atleta...</option>`;
            let arrayElenco = Object.keys(elenco).map(k => ({
                id: k,
                nome: elenco[k].nome,
                pos: elenco[k].posicoes ? elenco[k].posicoes.p : 'IND'
            })).sort((a,b) => a.nome.localeCompare(b.nome));

            for(let jog of arrayElenco) {
                optionsJ += `<option value="${jog.id}">[${jog.pos}] ${jog.nome}</option>`;
            }

            areaCT.innerHTML = `
                <div id="msg-ct-info" style="color:#aaa; font-size:11px; margin-top:0; margin-bottom: 8px; text-align:center;">Duração: 8h. O jogador será desescalado e não jogará partidas oficiais neste período!</div>
                <select id="ct-select-jog" style="width:100%; padding:8px; background:#111; border:1px solid #333; color:#fff; border-radius:4px; margin-bottom:5px; font-size:12px;">
                    ${optionsJ}
                </select>
                <select id="ct-select-atr" style="width:100%; padding:8px; background:#111; border:1px solid #333; color:#fff; border-radius:4px; margin-bottom:10px; font-size:12px;">
                    <option value="">Qual Atributo?</option>
                    <option value="ataque">Ataque</option>
                    <option value="defesa">Defesa</option>
                    <option value="forca">Força Física</option>
                    <option value="velocidade">Velocidade</option>
                    <option value="habilidade">Habilidade</option>
                </select>
                <button onclick="iniciarTreinoCT()" style="width:100%; padding:8px; background:#007bff; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px;">Iniciar Treinamento</button>
            `;
        }
    } catch (e) { console.error("Erro no CT:", e); }
}

window.iniciarTreinoCT = async function() {
    let idJog = document.getElementById('ct-select-jog').value;
    let atr = document.getElementById('ct-select-atr').value;
    let areaCT = document.getElementById('area-ct');

    if (!idJog || !atr) {
        let msgInfo = document.getElementById('msg-ct-info');
        if(msgInfo) msgInfo.innerHTML = `<span style="color:#dc3545; font-weight:bold;">Selecione o jogador e o atributo primeiro!</span>`;
        return;
    }

    let selectEl = document.getElementById('ct-select-jog');
    let nomeCompletoTxt = selectEl.options[selectEl.selectedIndex].text;
    let nomeJog = nomeCompletoTxt.includes(']') ? nomeCompletoTxt.substring(nomeCompletoTxt.indexOf(']') + 2) : nomeCompletoTxt;

    let fimTs = Date.now() + (8 * 60 * 60 * 1000);

    // Efeito Visual de Carregamento sem alerts
    areaCT.innerHTML = `<div style="text-align:center; padding: 20px; color:#007bff; font-weight:bold;">Equipando CT... 🏃‍♂️💨</div>`;

    await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/ct_ativo`).set({
        id_jogador: idJog,
        nome: nomeJog,
        atributo: atr,
        fim_ts: fimTs
    });

    // Remove imediatamente da escalação!
    if (dadosUsuario.titulares) {
        let novosTitulares = {};
        for(let pos in dadosUsuario.titulares) {
            if(dadosUsuario.titulares[pos] !== idJog) {
                novosTitulares[pos] = dadosUsuario.titulares[pos];
            }
        }
        await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/titulares`).set(novosTitulares);
    }
};

window.concluirTreinoCT = async function(idJog, atributo, meuTimeId) {
    const areaCT = document.getElementById('area-ct');
    areaCT.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--verde-campo); font-weight:bold;">Avaliando resultados... 📊</div>`;

    try {
        const snapJ = await db.ref(`banco_global_times/${meuTimeId}/jogadores/${idJog}`).once('value');
        let j = snapJ.val();

        if (!j) {
            await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/ct_ativo`).remove();
            areaCT.innerHTML = `<div style="text-align:center; padding: 15px; color:#dc3545;"><strong>Atleta não encontrado!</strong><br>O treino foi perdido.</div>`;
            setTimeout(() => carregarCentroDeTreinamento(meuTimeId), 2500);
            return;
        }

        if (!j.atributos) j.atributos = {ataque:60, defesa:60, forca:60, velocidade:60, habilidade:60};

        let valAtual = j.atributos[atributo] || 60;
        if (valAtual < 99) j.atributos[atributo] = valAtual + 1;

        j.valor_mercado = (j.valor_mercado || 1000000) + 500000;

        let updates = {};
        updates[`banco_global_times/${meuTimeId}/jogadores/${idJog}`] = j;
        updates[`ligas/${ligaLogada}/usuarios/${userLogado}/ct_ativo`] = null;

        await db.ref().update(updates);

        areaCT.innerHTML = `
            <div style="text-align:center; padding: 15px; background: rgba(0, 184, 83, 0.1); border: 1px solid var(--verde-campo); border-radius: 6px;">
                <div style="font-size:30px;">⭐</div>
                <div style="color:var(--verde-campo); font-weight:bold; margin-top:5px;">Evolução Concluída!</div>
                <div style="color:#fff; font-size:12px; margin-top:5px;">${j.nome} ganhou +1 em ${atributo.toUpperCase()}.</div>
            </div>
        `;

        setTimeout(() => carregarCentroDeTreinamento(meuTimeId), 3500);

    } catch(e) { console.error("Erro ao concluir CT:", e); }
};

// ========================================================
// 🎭 FUNÇÃO AUXILIAR: MENSAGENS ELEGANTES DASHBOARD
// ========================================================
window.mostrarAvisoEleganteDash = function(texto, corBorda, icone) {
    let cx = document.createElement('div');
    cx.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
    cx.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:1px solid ${corBorda}; padding:25px; text-align:center;">
            <div style="font-size:40px; margin-bottom:10px;">${icone}</div>
            <p style="color:#fff; font-size:16px; margin-bottom:20px; line-height:1.4;">${texto}</p>
            <button onclick="this.parentElement.parentElement.remove()" style="width:100%; padding:10px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; font-weight:bold; cursor:pointer;">Fechar</button>
        </div>
    `;
    document.body.appendChild(cx);
};

// 🎤 SISTEMA DE RETENÇÃO DIÁRIA (MANUTENÇÃO DA MORAL)
window.darColetivaImprensa = async function() {
    let hoje = new Date().toLocaleDateString('pt-BR');
    if (dadosUsuario.ultima_coletiva === hoje) return mostrarAvisoEleganteDash("Você já deu uma coletiva hoje! A mídia e a torcida estão cansadas da sua voz por hoje.", "#ff8c00", "🎤");

    let cxConf = document.createElement('div');
    cxConf.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
    cxConf.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:2px solid #555; padding:20px; box-shadow:0 10px 40px rgba(0,0,0,0.5); text-align:center;">
            <div style="font-size:40px; margin-bottom:10px;">🎤</div>
            <h3 style="color:#fff; margin-top:0;">Coletiva de Imprensa</h3>
            <p style="color:#ccc; font-size:14px; margin-bottom:20px;">Deseja convocar os jornalistas? Uma boa entrevista pode subir a moral em 15%, mas uma declaração infeliz derruba a moral em 10%.</p>
            <div style="display:flex; gap:10px;">
                <button id="btn-conf-coletiva" style="flex:1; padding:12px; background:#007bff; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Sim, Convocar</button>
                <button id="btn-canc-coletiva" style="flex:1; padding:12px; background:#333; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Não, Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(cxConf);

    document.getElementById('btn-canc-coletiva').onclick = () => cxConf.remove();
    document.getElementById('btn-conf-coletiva').onclick = async () => {
        cxConf.remove();

        let sucesso = Math.random() > 0.4; // 60% chance de sucesso
        let moralAtual = dadosUsuario.moral || 50;
        let novaMoral = sucesso ? Math.min(100, moralAtual + 15) : Math.max(0, moralAtual - 10);

        let msg = sucesso ? "A coletiva foi um sucesso! Você animou os torcedores (+15% Moral)." : "Desastre na coletiva! Você falou besteira e irritou a torcida (-10% Moral).";

        await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
            moral: novaMoral,
            ultima_coletiva: hoje
        });

        // Atualiza variável local para o painel não piscar errado depois
        dadosUsuario.moral = novaMoral;

        mostrarAvisoEleganteDash(msg, sucesso ? "var(--verde-campo)" : "#dc3545", sucesso ? "✅" : "❌");
    };
};

window.pagarBichoExtra = async function() {
    let hoje = new Date().toLocaleDateString('pt-BR');
    if (dadosUsuario.ultimo_bicho === hoje) return mostrarAvisoEleganteDash("A diretoria vetou! O Bicho Extra só pode ser pago uma vez ao dia.", "#ff8c00", "⛔");

    let caixa = dadosUsuario.caixaClube || 0;
    if (caixa < 500000) return mostrarAvisoEleganteDash("Você não tem R$ 500.000 em caixa para pagar essa premiação!", "#dc3545", "💸");

    let cxConf = document.createElement('div');
    cxConf.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
    cxConf.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:2px solid #ff8c00; padding:20px; box-shadow:0 10px 40px rgba(255,140,0,0.3); text-align:center;">
            <div style="font-size:40px; margin-bottom:10px;">💰</div>
            <h3 style="color:#ff8c00; margin-top:0;">Pagar Bicho Extra</h3>
            <p style="color:#ccc; font-size:14px; margin-bottom:20px;">Deseja tirar <strong>R$ 500.000,00</strong> do caixa e dividir com o elenco para aumentar a motivação (+25% Moral)?</p>
            <div style="display:flex; gap:10px;">
                <button id="btn-conf-bicho" style="flex:1; padding:12px; background:#ff8c00; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Sim, Pagar</button>
                <button id="btn-canc-bicho" style="flex:1; padding:12px; background:#333; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Não, Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(cxConf);

    document.getElementById('btn-canc-bicho').onclick = () => cxConf.remove();
    document.getElementById('btn-conf-bicho').onclick = async () => {
        cxConf.remove();

        let moralAtual = dadosUsuario.moral || 50;
        let novaMoral = Math.min(100, moralAtual + 25);
        let novoCaixa = caixa - 500000;

        await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
            moral: novaMoral,
            caixaClube: novoCaixa,
            ultimo_bicho: hoje
        });

        // Atualiza a interface gráfica do saldo na hora!
        dadosUsuario.caixaClube = novoCaixa;
        dadosUsuario.moral = novaMoral;
        let saldoElem = document.getElementById('saldo-treinador');
        if (saldoElem) {
            saldoElem.innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(novoCaixa);
        }

        mostrarAvisoEleganteDash("O vestiário virou uma festa! Jogadores ultra motivados (+25% Moral).<br><br>R$ 500.000 foram descontados do caixa.", "var(--verde-campo)", "🎉");
    };
};

// 🤝 SISTEMA DE PATROCINADORES MASTER (RISCO E PERFORMANCE)
window.recolherPatrocinio = async function() {
    let cxConf = document.getElementById('modal-patrocinio');
    if(cxConf) cxConf.remove();

    let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let u = snapUser.val() || {};
    let pat = u.patrocinio_ativo;

    cxConf = document.createElement('div');
    cxConf.id = 'modal-patrocinio';
    cxConf.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";

    if (pat && pat.rodadas_restantes > 0) {
        cxConf.innerHTML = `
            <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:2px solid #007bff; padding:20px; box-shadow:0 10px 40px rgba(0,123,255,0.3); text-align:center;">
                <div style="font-size:40px; margin-bottom:10px;">🤝</div>
                <h3 style="color:#007bff; margin-top:0;">Patrocinador Atual</h3>
                <div style="background:#111; padding:15px; border-radius:8px; border:1px solid #333; margin-bottom:20px; text-align:left;">
                    <strong style="color:#fff; font-size:16px;">${pat.empresa}</strong> <span style="color:#aaa; font-size:12px;">(${pat.desc})</span><br><br>

                    <span style="color:#888; font-size:12px;">Modelo de Contrato:</span><br>
                    <strong style="color:${pat.tipo==='Fixo Seguro'?'var(--verde-campo)':(pat.tipo==='Alta Performance'?'#dc3545':'#ff8c00')};">${pat.tipo}</strong><br><br>

                    <span style="color:#888; font-size:12px;">Previsão de Ganhos (Por Jogo):</span><br>
                    <div style="background:#000; padding:10px; border-radius:6px; margin-top:5px; font-size:13px;">
                        <span style="color:var(--verde-campo);">Vitória: <strong>${formatarDinheiro(pat.valVitoria)}</strong></span><br>
                        <span style="color:#ffc107;">Empate: <strong>${formatarDinheiro(pat.valEmpate)}</strong></span><br>
                        <span style="color:#dc3545;">Derrota: <strong>${formatarDinheiro(pat.valDerrota)}</strong></span>
                    </div>
                    <br>
                    <span style="color:#888; font-size:12px;">Vigência do Contrato:</span><br>
                    <strong style="color:#fff;">Restam ${pat.rodadas_restantes} Jogo(s)</strong>
                </div>
                <button onclick="document.getElementById('modal-patrocinio').remove()" style="width:100%; padding:12px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; font-weight:bold; cursor:pointer;">Fechar Painel</button>
            </div>
        `;
    } else {
        const empresasDB = [
            { nome: "Elicars", desc: "Oficina Mecânica" },
            { nome: "RDM Studios", desc: "Estúdio de Games" },
            { nome: "Etilim Modas", desc: "Loja de Roupas" },
            { nome: "Fleury Games", desc: "Streamer" },
            { nome: "Mileniso", desc: "Marcenaria" },
            { nome: "Zi_bar", desc: "Tabacaria" }
        ];

        // Sorteia 4 empresas da lista para oferecerem propostas
        const empresas = empresasDB.sort(() => Math.random() - 0.5).slice(0, 4);

        let htmlPropostas = empresas.map((emp, i) => {
            let rng = Math.random();
            let tipo, rodadas, valorBase;
            let corTipo = "";

            if (rng < 0.33) {
                tipo = 'Fixo Seguro'; corTipo = 'var(--verde-campo)';
                rodadas = Math.floor(Math.random() * 4) + 4; // 4 a 7 rodadas
                valorBase = Math.floor(Math.random() * 800000) + 800000; // 800k a 1.6M
            } else if (rng < 0.66) {
                tipo = 'Risco Moderado'; corTipo = '#ff8c00';
                rodadas = Math.floor(Math.random() * 3) + 2; // 2 a 4 rodadas
                valorBase = Math.floor(Math.random() * 1000000) + 1500000; // 1.5M a 2.5M
            } else {
                tipo = 'Alta Performance'; corTipo = '#dc3545';
                rodadas = Math.floor(Math.random() * 2) + 1; // 1 a 2 rodadas
                valorBase = Math.floor(Math.random() * 2000000) + 3000000; // 3M a 5M
            }

            let valVitoria = valorBase;
            let valEmpate = tipo === 'Fixo Seguro' ? valorBase : (tipo === 'Risco Moderado' ? valorBase * 0.5 : valorBase * 0.1);
            let valDerrota = tipo === 'Fixo Seguro' ? valorBase : (tipo === 'Risco Moderado' ? valorBase * 0.2 : 0);

            window[`assinarPatrocinio_${i}`] = async function() {
                cxConf.remove();
                await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/patrocinio_ativo`).set({
                    empresa: emp.nome, desc: emp.desc, tipo: tipo,
                    valVitoria: valVitoria, valEmpate: valEmpate, valDerrota: valDerrota,
                    rodadas_restantes: rodadas, rodadas_total: rodadas
                });
                mostrarAvisoEleganteDash(`Contrato assinado com a ${emp.nome} por ${rodadas} jogo(s)!<br><br>As transferências serão automáticas ao fim de cada partida. Dê o seu melhor em campo!`, "var(--verde-campo)", "✍️");
            };

            return `
            <div style="background:#111; border:1px solid ${corTipo}; padding:15px; border-radius:8px; margin-bottom:12px; text-align:left; position:relative; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);">
                <strong style="color:#fff; font-size:15px;">${emp.nome}</strong> <span style="color:#aaa; font-size:11px;">(${emp.desc})</span><br>
                <div style="font-size:12px; color:#aaa; margin:8px 0; display:flex; justify-content:space-between;">
                    <span>Tipo: <strong style="color:${corTipo};">${tipo}</strong></span>
                    <span>Duração: <strong style="color:#fff;">${rodadas} Jogos</strong></span>
                </div>
                <div style="background:#000; padding:8px; border-radius:6px; font-size:11px; margin-bottom:10px; line-height:1.4;">
                    <span style="color:var(--verde-campo);">Vitória: <strong>${formatarDinheiro(valVitoria)}</strong></span><br>
                    <span style="color:#ffc107;">Empate: <strong>${formatarDinheiro(valEmpate)}</strong></span><br>
                    <span style="color:#dc3545;">Derrota: <strong>${formatarDinheiro(valDerrota)}</strong></span>
                </div>
                <button onclick="assinarPatrocinio_${i}()" style="width:100%; padding:10px; background:${corTipo}; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:13px; text-shadow:1px 1px 2px rgba(0,0,0,0.5);">Assinar Contrato</button>
            </div>
            `;
        }).join('');

        cxConf.innerHTML = `
            <div style="background:#1a1a1a; width:95%; max-width:500px; border-radius:12px; border:2px solid #007bff; display:flex; flex-direction:column; max-height:85vh; box-shadow:0 10px 40px rgba(0,123,255,0.3);">
                <div style="padding:15px 20px; border-bottom:1px solid #333; background:#111; border-radius:12px 12px 0 0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="color:#007bff; margin:0; font-size:18px;">🤝 Propostas de Patrocínio</h3>
                    <button onclick="document.getElementById('modal-patrocinio').remove()" style="background:transparent; border:none; color:#aaa; font-size:26px; cursor:pointer;">&times;</button>
                </div>
                <div style="padding:20px; overflow-y:auto; flex:1;">
                    <p style="color:#ccc; font-size:13px; margin-top:0;">O seu departamento de marketing recebeu propostas das empresas abaixo. Escolha bem o nível de risco que a sua equipa consegue suportar!</p>
                    ${htmlPropostas}
                </div>
            </div>
        `;
    }
    document.body.appendChild(cxConf);
};

// 💬 SISTEMA DE CHAT GLOBAL (OTIMIZADO PARA MOBILE)
window.criarBotaoChatSuperior = function() {
    if (document.getElementById('btn-abrir-chat')) return;

    // Botão blindado contra CSS global, fixo à direita e com tamanho exato
    let btn = document.createElement('button');
    btn.id = 'btn-abrir-chat';
    btn.innerHTML = '<span style="font-size:13px;">💬</span> Chat';
    btn.style.cssText = "position:fixed !important; top:65px !important; right:15px !important; left:auto !important; width:fit-content !important; min-width:60px !important; background:rgba(0,0,0,0.8) !important; color:#fff !important; border:1px solid #555 !important; padding:4px 10px !important; border-radius:15px !important; font-size:11px !important; cursor:pointer !important; z-index:9999 !important; box-shadow:0 2px 5px rgba(0,0,0,0.5) !important; backdrop-filter: blur(5px) !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; gap:4px !important; margin:0 !important; line-height:1 !important;";
    btn.onclick = abrirChatLiga;
    document.body.appendChild(btn);
};

window.abrirChatLiga = function() {
    let modal = document.getElementById('modal-chat-liga');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-chat-liga';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";

        modal.innerHTML = `
            <div style="background:#1a1a1a; width:95%; max-width:450px; height:85vh; border-radius:12px; border:1px solid #444; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,0.8); overflow:hidden;">

                <!-- Cabeçalho do Chat -->
                <div style="padding:15px; border-bottom:1px solid #333; background:#111; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:20px;">💬</span>
                        <h2 style="color:#ff8c00; margin:0; font-size:16px;">Resenha da Liga</h2>
                    </div>
                    <button onclick="document.getElementById('modal-chat-liga').style.display='none'" style="background:transparent; border:none; color:#aaa; font-size:26px; cursor:pointer; line-height:1;">&times;</button>
                </div>

                <!-- Área de Mensagens (Estilo WhatsApp) -->
                <div id="chat-messages-modal" style="flex:1; overflow-y:auto; padding:15px; display:flex; flex-direction:column; gap:12px; background: #0a0a0a;">
                    <span style="color:#666; text-align:center; font-size:12px;">Conectando ao satélite...</span>
                </div>

                <!-- Input Moderno -->
                <div style="padding:12px; background:#111; border-top:1px solid #333; display:flex; gap:10px; align-items:center;">
                    <input type="text" id="chat-input-modal" placeholder="Mande uma provocação..." maxlength="100" style="flex:1; padding:12px 15px; border-radius:25px; border:1px solid #444; background:#222; color:#fff; font-size:14px; outline:none;" onkeypress="if(event.key === 'Enter') enviarMensagemChat()">
                    <button onclick="enviarMensagemChat()" style="background:var(--verde-campo); color:#fff; border:none; border-radius:50%; width:45px; height:45px; display:flex; justify-content:center; align-items:center; cursor:pointer; flex-shrink:0; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                        <span style="font-size:18px; margin-left:3px;">➤</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Ouve o Firebase apenas uma vez quando o modal é criado
        db.ref(`ligas/${ligaLogada}/chat`).limitToLast(30).on('value', snap => {
            const chatContainer = document.getElementById('chat-messages-modal');
            if(!chatContainer) return;

            const msgs = snap.val();
            if (!msgs) {
                chatContainer.innerHTML = `<span style="color:#666; text-align:center; font-size:12px; margin-top:20px;">Nenhuma mensagem. Seja o primeiro a puxar assunto!</span>`;
                return;
            }

            let html = "";
            for (let m in msgs) {
                let info = msgs[m];
                let isMe = info.time === dadosUsuario.timeAtual;
                let timeClean = info.time.replace(/_/g, ' ');

                // Estilo dos Balões (Direita para Você, Esquerda para os Outros)
                let alinhamento = isMe ? 'align-self: flex-end;' : 'align-self: flex-start;';
                let fundo = isMe ? 'background: #0056b3;' : 'background: #2a2a2a;';
                let borda = isMe ? 'border-radius: 12px 12px 0 12px;' : 'border-radius: 12px 12px 12px 0;';
                let escudoHtml = isMe ? '' : `<img src="${getEscudo(info.time)}" onerror="this.src='esculdos/default.png'" style="width:14px; height:14px; margin-bottom:-2px; margin-right:4px;">`;

                html += `
                    <div style="max-width:85%; ${alinhamento} ${fundo} ${borda} padding:8px 12px; box-shadow:0 2px 4px rgba(0,0,0,0.3);">
                        ${isMe ? '' : `<div style="font-size:10px; color:#aaa; margin-bottom:4px; font-weight:bold;">${escudoHtml}${info.autor} <span style="font-weight:normal;">(${timeClean})</span></div>`}
                        <div style="color:#fff; font-size:13px; word-break: break-word; line-height:1.4;">${info.texto}</div>
                    </div>
                `;
            }
            chatContainer.innerHTML = html;
            chatContainer.scrollTop = chatContainer.scrollHeight; // Desce o scroll pro final
        });
    }

    modal.style.display = 'flex';
    // Garante que o scroll vá pro fundo ao abrir a janela
    setTimeout(() => {
        let ct = document.getElementById('chat-messages-modal');
        if(ct) ct.scrollTop = ct.scrollHeight;
    }, 100);
};

window.enviarMensagemChat = function() {
    let input = document.getElementById('chat-input-modal');
    if(!input) return;
    let txt = input.value.trim();
    if(!txt) return;

    db.ref(`ligas/${ligaLogada}/chat`).push({
        autor: dadosUsuario.nome,
        time: dadosUsuario.timeAtual,
        texto: txt,
        ts: Date.now()
    });
    input.value = "";
    input.focus();
};

// ✨ LETREIRO DE GOL ANIMADO (X1 e Oficial)
window.mostrarLetreiroGol = function(nomeTime) {
    let div = document.createElement('div');
    div.style.cssText = "position:fixed; top:25%; left:0; width:100%; text-align:center; z-index:99999; animation: pulsaGol 0.4s infinite alternate; pointer-events:none; text-shadow: 0 0 20px rgba(0,0,0,0.8);";
    div.innerHTML = `
        <h1 style="font-size: 80px; color: #fff; margin: 0; text-transform: uppercase; font-style: italic; letter-spacing: 5px;">⚽ GOOOOL!!!</h1>
        <h2 style="font-size: 45px; color: #ffc107; text-shadow: 3px 3px 5px #000; margin: 0; text-transform: uppercase;">${nomeTime.replace(/_/g, ' ')}</h2>
    `;
    document.body.appendChild(div);

    if (!document.getElementById('style-gol-anim')) {
        let style = document.createElement('style');
        style.id = 'style-gol-anim';
        style.innerHTML = `@keyframes pulsaGol { from { transform: scale(0.95); opacity: 0.9; } to { transform: scale(1.05); opacity: 1; } }`;
        document.head.appendChild(style);
    }
    setTimeout(() => {
        div.style.transition = "opacity 0.5s";
        div.style.opacity = "0";
        setTimeout(() => div.remove(), 500);
    }, 4000);
};

async function carregarCentralDeAvisos(meuTimeId) {
    const ul = document.getElementById('lista-avisos');
    const widget = document.getElementById('widget-avisos');
    let avisos = [];

    try {
        // 🟢 Agora busca também dívidas e usuario pra checar escalação 18:59
        const [snapMsgs, snapMercado, snapPros, snapTime, snapX1, snapDividas, snapMeuUser] = await Promise.all([
            db.ref(`ligas/${ligaLogada}/caixa_mensagens/${userLogado}`).once('value'),
            db.ref(`ligas/${ligaLogada}/mercado_propostas`).once('value'),
            db.ref(`ligas/${ligaLogada}/pro_players`).once('value'),
            db.ref(`banco_global_times/${meuTimeId}`).once('value'),
            db.ref(`ligas/${ligaLogada}/x1_desafios`).once('value'),
            db.ref(`ligas/${ligaLogada}/dividas_financeiras`).once('value'),
            db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value')
        ]);

        // Estilo blindado para os botões da central (Evita herdar botões gigantes do layout principal)
        const btnStyle = "margin-left:10px; border:none; padding:4px 10px !important; border-radius:4px; cursor:pointer; font-size:11px !important; flex-shrink:0; width:auto !important; max-width:max-content; white-space:nowrap; height:fit-content; line-height:normal; align-self:center;";

        // 1. Mensagens da Diretoria e Transferências
        const msgs = snapMsgs.val();
        if (msgs) {
            for (let m in msgs) {
                let cor = msgs[m].tipo === 'sucesso' ? 'var(--verde-campo)' : '#dc3545';
                avisos.push(`
                    <li style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444; display:flex; justify-content:space-between; align-items:center;">
                        <div style="padding-right: 10px;">
                            <strong style="color:${cor};">📬 Comunicado:</strong> <span style="color:#ccc;">${msgs[m].texto}</span>
                        </div>
                        <button onclick="marcarMensagemLidaDash('${m}')" style="${btnStyle} background:#333; color:#fff;">Ciente</button>
                    </li>
                `);
            }
        }

        // 2. Propostas no Mercado
        const propostas = snapMercado.val();
        const meuElenco = snapTime.val()?.jogadores || {};
        let propostasRecebidas = 0;

        if (propostas) {
            for (let idAlvo in propostas) {
                if (meuElenco[idAlvo]) propostasRecebidas += Object.keys(propostas[idAlvo]).length;
            }
        }
        if (propostasRecebidas > 0) {
            avisos.push(`
                <li style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444; display:flex; justify-content:space-between; align-items:center;">
                    <div style="padding-right: 10px;">
                        <strong style="color:#ff8c00;">💼 Mercado da Bola:</strong> <span style="color:#ccc;">Você tem ${propostasRecebidas} proposta(s) na mesa aguardando aprovação.</span>
                    </div>
                    <button onclick="window.location.href='mercado.html'" style="${btnStyle} background:#ff8c00; color:#fff;">Ver Propostas</button>
                </li>
            `);
        }

        // 3. Olheiro de Pro Players
        const pros = snapPros.val();
        let avaliacoesFaltando = 0;
        if (pros) {
            for (let dono in pros) {
                if (dono !== userLogado && pros[dono].status === "avaliando") {
                    if (!pros[dono].avaliacoes || !pros[dono].avaliacoes[userLogado]) avaliacoesFaltando++;
                }
            }
        }
        if (avaliacoesFaltando > 0) {
            avisos.push(`
                <li style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444; display:flex; justify-content:space-between; align-items:center;">
                    <div style="padding-right: 10px;">
                        <strong style="color:#00b853;">⭐ Olheiro da Base:</strong> <span style="color:#ccc;">Existem ${avaliacoesFaltando} Pro Player(s) aguardando sua nota de avaliação.</span>
                    </div>
                    <button onclick="window.location.href='perfil.html'" style="${btnStyle} background:#00b853; color:#fff;">Avaliar</button>
                </li>
            `);
        }

        // 3.5 Arena X1 (Desafios)
        const desafios = snapX1.val();
        if (desafios) {
            let desafiosPendentes = 0;
            let desafiosAceitos = 0;
            for (let id in desafios) {
                let d = desafios[id];
                if (d.desafiado === meuTimeId && d.status === 'pendente') desafiosPendentes++;
                if ((d.desafiante === meuTimeId || d.desafiado === meuTimeId) && d.status === 'aceito') desafiosAceitos++;
            }
            if (desafiosPendentes > 0) {
                avisos.push(`
                    <li style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444; display:flex; justify-content:space-between; align-items:center;">
                        <div style="padding-right: 10px;">
                            <strong style="color:#dc3545;">⚔️ Arena X1:</strong> <span style="color:#ccc;">Você recebeu ${desafiosPendentes} novo(s) desafio(s)! Defenda a honra do clube.</span>
                        </div>
                        <button onclick="abrirModalX1(); setTimeout(() => renderAbaX1('rec'), 500);" style="${btnStyle} background:#dc3545; color:#fff;">Ver Desafios</button>
                    </li>
                `);
            }
            if (desafiosAceitos > 0) {
                avisos.push(`
                    <li style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444; display:flex; justify-content:space-between; align-items:center;">
                        <div style="padding-right: 10px;">
                            <strong style="color:#ff8c00;">📺 Transmissão X1:</strong> <span style="color:#ccc;">Temos ${desafiosAceitos} partida(s) da Arena prontas para iniciar.</span>
                        </div>
                        <button onclick="abrirModalX1()" style="${btnStyle} background:#ff8c00; color:#fff;">Ir para Arena</button>
                    </li>
                `);
            }
        }

        // 4. Plantel Curto (Crítico!)
        let numJogadores = Object.keys(meuElenco).length;
        if (numJogadores > 0 && numJogadores < 11) {
            avisos.push(`
                <li style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444;">
                    <strong style="color:#dc3545;">🚨 Plantel Incompleto:</strong> <span style="color:#ccc;">Seu time tem apenas ${numJogadores} jogadores. Vai perder por W.O.!</span>
                </li>
            `);
        }

        // 5. ESCALAÇÃO E PATROCÍNIO MASTER
        const meuUser = snapMeuUser.val()||{};

        // Checa Escalação
        let ultima = meuUser.ultima_escalacao_confirmada? new Date(meuUser.ultima_escalacao_confirmada) : null;
        let hoje = new Date();
        let pendenteEscalacao =!ultima || ultima.toDateString()!==hoje.toDateString() || (ultima.getHours()+ultima.getMinutes()/60)>=18.983;
        if(pendenteEscalacao){
            avisos.push(`
                <li style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444; display:flex; justify-content:space-between; align-items:center;">
                    <div><strong style="color:#dc3545;">⚠️ Escalação Pendente:</strong> <span style="color:#ccc;">Confirme até 18:59 ou -15% no jogo.</span></div>
                    <button onclick="window.location.href='escalacao.html'" style="${btnStyle} background:#dc3545; color:#fff;">Escalar</button>
                </li>
            `);
        }

        // Checa Patrocínio Master
        let patMaster = meuUser.patrocinio_ativo;
        if (!patMaster || patMaster.rodadas_restantes <= 0) {
            avisos.push(`
                <li style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444; display:flex; justify-content:space-between; align-items:center;">
                    <div><strong style="color:#ff8c00;">🤝 Camisa Limpa:</strong> <span style="color:#ccc;">O seu clube está sem Patrocinador Master. Você está deixando dinheiro na mesa!</span></div>
                    <button onclick="recolherPatrocinio()" style="${btnStyle} background:#ff8c00; color:#fff;">Negociar</button>
                </li>
            `);
        }

        // 6. DÍVIDA PENDENTE
        const dividas = snapDividas.val()||{};
        let totalDividas=0;
        for(let id in dividas){ if(dividas[id].devedor===meuTimeId) totalDividas++; }
        if(totalDividas>0){
            avisos.push(`
                <li style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444; display:flex; justify-content:space-between; align-items:center;">
                    <div><strong style="color:#dc3545;">💸 Dívida Pendente:</strong> <span style="color:#ccc;">${totalDividas} dívida(s). Parcela todo jogo 19h.</span></div>
                    <button onclick="window.location.href='mercado.html'" style="${btnStyle} background:#dc3545; color:#fff;">Pagar</button>
                </li>
            `);
        }

        // Se encontrou problemas, acende o telão vermelho!
        if (avisos.length > 0) {
            ul.innerHTML = avisos.join('');
            widget.style.display = 'block';
        } else {
            widget.style.display = 'none';
        }

    } catch(e) { console.error("Erro ao carregar Central de Avisos:", e); }
}

window.marcarMensagemLidaDash = function(idMsg) {
    db.ref(`ligas/${ligaLogada}/caixa_mensagens/${userLogado}/${idMsg}`).remove().then(() => {
        carregarCentralDeAvisos(dadosUsuario.timeAtual); // Recarrega os avisos sem precisar de F5!
    });
};

// INTEGRAÇÃO COM O CALENDÁRIO
async function buscarMeuProximoJogo(timeIdBanco) {
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

        let rodadaAtual = cal.rodadaAtual || 1;
        let meuJogo = null;
        let rodadaEncontrada = rodadaAtual;
        let campeonatoNome = "Campeonato Nacional";

        // 🏆 Se hoje tem Copa, mostra Copa primeiro
        let hojeStr = new Date().toLocaleDateString('pt-BR').slice(0,5);
        if(cal.copa){
            for(let fase in cal.copa){
                let jogosFase = cal.copa[fase];
                for(let j in jogosFase){
                    let jogo = jogosFase[j];
                    if((jogo.mandante === timeIdBanco || jogo.visitante === timeIdBanco) && jogo.data_jogo && jogo.data_jogo.includes(hojeStr)){
                        meuJogo = jogo;
                        rodadaEncontrada = fase;
                        campeonatoNome = `Copa Nacional - ${fase.charAt(0).toUpperCase()+fase.slice(1)}`;
                        break;
                    }
                }
                if(meuJogo) break;
            }
        }

        // Se não é Copa hoje, tenta achar o próximo jogo NÃO jogado deste time, a partir da rodada atual até a última
        if(!meuJogo){
        for(let r = rodadaAtual; r <= 38; r++){
            let key = `rodada_${r}`;
            let jogosRodada = null;
            if(cal.serieA && cal.serieA[key]) jogosRodada = cal.serieA[key];
            else if(cal.serieB && cal.serieB[key]) jogosRodada = cal.serieB[key];
            if(!jogosRodada) continue;
            for(let j in jogosRodada){
                let jogo = jogosRodada[j];
                if(jogo.mandante === timeIdBanco || jogo.visitante === timeIdBanco){
                    if(!jogo.jogado &&!jogo.linhaDoTempo){
                        meuJogo = jogo;
                        rodadaEncontrada = r;
                        break;
                    }
                    // Se ainda não achou nenhum não-jogado, guarda o último jogado da rodada atual
                    if(r === rodadaAtual &&!meuJogo) {
                        meuJogo = jogo;
                        rodadaEncontrada = r;
                    }
                }
            }
            if(meuJogo &&!meuJogo.jogado) break;
            }
        }

        // Fallback: se não achou nada, varre tudo (caso time trocou de divisão)
        if(!meuJogo){
            for(let div of ['serieA','serieB']){
                if(!cal[div]) continue;
                for(let key in cal[div]){
                    for(let j in cal[div][key]){
                        let jogo = cal[div][key][j];
                        if(jogo.mandante === timeIdBanco || jogo.visitante === timeIdBanco){
                            if(!meuJogo) { meuJogo = jogo; rodadaEncontrada = parseInt(key.split('_')[1])||1; }
                        }
                    }
                }
            }
        }

        if (meuJogo) {
            let donoM = window.treinadoresGlobais[meuJogo.mandante] ? `<br><span style="font-size:10px; color:#ff8c00; font-weight:normal;">👤 ${window.treinadoresGlobais[meuJogo.mandante]}</span>` : `<br><span style="font-size:10px; color:#888; font-weight:normal;">🤖 IA</span>`;
            let donoV = window.treinadoresGlobais[meuJogo.visitante] ? `<br><span style="font-size:10px; color:#ff8c00; font-weight:normal;">👤 ${window.treinadoresGlobais[meuJogo.visitante]}</span>` : `<br><span style="font-size:10px; color:#888; font-weight:normal;">🤖 IA</span>`;

            const mandante = meuJogo.mandante.replace(/_/g, ' ') + donoM;
            const visitante = meuJogo.visitante.replace(/_/g, ' ') + donoV;
            const isMandante = (meuJogo.mandante === timeIdBanco);

            let dataHora = meuJogo.data_jogo || "Data a definir";
            lblRodada.innerHTML = `<strong style="color: #fff;">${campeonatoNome} - Rodada ${rodadaEncontrada}</strong><br><span style="color: var(--verde-campo); font-size: 12px; font-weight: bold;">📅 ${dataHora}</span>`;

            btnIrJogo.style.display = "block";
            if (meuJogo.jogado || meuJogo.linhaDoTempo) {
                // Se já jogou esta rodada, avisa e já prepara para a próxima
                if(rodadaEncontrada < 38){
                    lblRodada.innerHTML += ` <span style="color: #dc3545; font-size: 11px; text-transform: uppercase;">(Encerrada)</span>`;
                    btnIrJogo.innerText = "Ver Resultado e Gols";
                    btnIrJogo.style.background = "#333";
                    btnIrJogo.style.borderColor = "#555";
                } else {
                    lblRodada.innerHTML += ` <span style="color: #aaa; font-size: 11px;">(Fim de campeonato)</span>`;
                    btnIrJogo.style.display = "none";
                }
            } else {
                btnIrJogo.innerText = "Ir para a Transmissão ⚡";
                btnIrJogo.style.background = "#ff8c00";
                btnIrJogo.style.borderColor = "#ff8c00";
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

let ultimaNoticia = ""; // Guarda a última notícia para não repetir

async function gerarNoticia(meuTime) {
    const elem = document.getElementById('texto-noticia');
    if(!elem) return;

    let noticias = [
        `"Especulações fortíssimas indicam que a diretoria do ${meuTime} prepara um bote no mercado!"`,
        `"A torcida não para de cantar! Expectativa de casa cheia para os próximos compromissos."`
    ];

    let hoje = new Date().toLocaleDateString('pt-BR');

    // 🚨 1. PENDÊNCIAS DO SEU CLUBE (Alertas de Ação)
    if (dadosUsuario.ultimo_patrocinio !== hoje) {
        noticias.push(`"💰 ALERTA FINANCEIRO: A Patrocínio está disponível na mesa do presidente! Não se esqueça de recolher o patrocínio de hoje."`);
    }
    if (dadosUsuario.ultima_coletiva !== hoje) {
        noticias.push(`"🎤 IMPRENSA NO AGUARDO: Os jornalistas estão na sala de imprensa cobrando a sua Coletiva Diária. Corra para melhorar a moral da torcida!"`);
    }
    if ((dadosUsuario.moral || 50) < 50 && dadosUsuario.ultimo_bicho !== hoje) {
        noticias.push(`"⚠️ CRISE NO VESTIÁRIO? Com a moral em baixa, a diretoria liberou o 'Bicho Extra'. Pague os jogadores para evitar um desastre em campo!"`);
    }

    let escalados = dadosUsuario.titulares ? dadosUsuario.titulares.filter(id => id) : [];
    if (escalados.length < 11) {
        noticias.push(`"🚨 URGENTE: Faltam jogadores na sua escalação titular! O ${meuTime} corre o sério risco de perder por W.O. Vá até a prancheta tática imediatamente."`);
    }

    try {
        const [snapCal, snapMerc, snapPro, snapX1, snapUsers, snapTimes, snapInv] = await Promise.all([
            db.ref(`ligas/${ligaLogada}/calendario`).once('value'),
            db.ref(`ligas/${ligaLogada}/mercado_propostas`).once('value'),
            db.ref(`ligas/${ligaLogada}/pro_players`).once('value'),
            db.ref(`ligas/${ligaLogada}/x1_desafios`).once('value'),
            db.ref(`ligas/${ligaLogada}/usuarios`).once('value'),
            db.ref('banco_global_times').once('value'),
            db.ref(`ligas/${ligaLogada}/banco_investidores`).once('value')
        ]);

        const cal = snapCal.val();
        const propostas = snapMerc.val();
        const proPlayers = snapPro.val();
        const desafios = snapX1.val();
        const usuarios = snapUsers.val() || {};
        const times = snapTimes.val() || {};
        const investidores = snapInv.val() || {};

        // 🚨 2. AVALIAÇÕES DA COMUNIDADE PENDENTES
        if (proPlayers) {
            let avalFaltando = 0;
            for (let dono in proPlayers) {
                if (dono !== userLogado && proPlayers[dono].status === "avaliando") {
                    if (!proPlayers[dono].avaliacoes || !proPlayers[dono].avaliacoes[userLogado]) avalFaltando++;
                }
            }
            if (avalFaltando > 0) {
                noticias.push(`"⭐ OLHEIRO CHAMADO: Existem ${avalFaltando} Pro Player(s) na base aguardando sua nota de avaliação. O futuro da liga depende da sua análise!"`);
            }
        }

        // 📰 3. FOFOCAS DA LIGA - JORNAL COMPLETO CÔMICO
        if (cal) {
            let rAtual = cal.rodadaAtual || 1;
            let rodadaChave = `rodada_${rAtual}`;
            let jogos = {...(cal.serieA?.[rodadaChave]||{}),...(cal.serieB?.[rodadaChave]||{})};

            for (let j in jogos) {
                let jogo = jogos[j];
                if (!jogo.jogado) {
                    let isHumanoM = Object.values(usuarios).some(u => u.timeAtual === jogo.mandante);
                    let isHumanoV = Object.values(usuarios).some(u => u.timeAtual === jogo.visitante);
                    if (isHumanoM && isHumanoV) {
                        let frasesClassico = [
                            `"🔥 CLÁSSICO À VISTA! ${jogo.mandante.replace(/_/g,' ')} x ${jogo.visitante.replace(/_/g,' ')} vai parar a cidade! Ingressos esgotados!"`,
                            `"⚔️ CHEIRINHO DE SANGUE! ${jogo.mandante.replace(/_/g,' ')} e ${jogo.visitante.replace(/_/g,' ')} se odeiam desde 1923. Promete pancadaria!"`,
                            `"💣 DUELO DE GIGANTES! ${jogo.mandante.replace(/_/g,' ')} vs ${jogo.visitante.replace(/_/g,' ')} - Até o árbitro pediu folga!"`
                        ];
                        noticias.push(frasesClassico[Math.floor(Math.random()*frasesClassico.length)]);
                    }
                }
            }

            if (rAtual > 1) {
                let rAnt = `rodada_${rAtual - 1}`;
                let jogosAnt = {...(cal.serieA?.[rAnt]||{}),...(cal.serieB?.[rAnt]||{})};
                for (let j in jogosAnt) {
                    let jogo = jogosAnt[j];
                    if (jogo.jogado) {
                        let diff = Math.abs(jogo.placarMandante - jogo.placarVisitante);
                        if (diff >= 3) {
                            let humilhado = jogo.placarMandante < jogo.placarVisitante? jogo.mandante : jogo.visitante;
                            let carrasco = jogo.placarMandante > jogo.placarVisitante? jogo.mandante : jogo.visitante;
                            let frasesGoleada = [
                                `"🛑 VEXAME HISTÓRICO! ${humilhado.replace(/_/g,' ')} tomou uma surra de ${jogo.placarMandante}x${jogo.placarVisitante} do ${carrasco.replace(/_/g,' ')} e a torcida pede a cabeça do treinador!"`,
                                `"😭 HUMILHAÇÃO! ${humilhado.replace(/_/g,' ')} foi amassado pelo lanterna ${carrasco.replace(/_/g,' ')}! Até o gandula fez gol!"`,
                                `"💀 ENTERROU! ${carrasco.replace(/_/g,' ')} goleou o ${humilhado.replace(/_/g,' ')} e mandou pra Série B do coração!"`
                            ];
                            noticias.push(frasesGoleada[Math.floor(Math.random()*frasesGoleada.length)]);
                        } else if (diff === 0) {
                            noticias.push(`"😴 EMPATE SONOLENTO! ${jogo.mandante.replace(/_/g,' ')} 0x0 ${jogo.visitante.replace(/_/g,' ')} - Nem o VAR quis ver esse jogo!"`);
                        }
                    }
                }
            }
        }

        // FISIOTERAPIA E CT - FOFOCA
        for(let uId in usuarios){
            let u = usuarios[uId];
            if(u.fisioterapia_nivel && u.fisioterapia_nivel>0 && Math.random()<0.1){
                noticias.push(`"🏥 O ${u.timeAtual.replace(/_/g,' ')} investiu no DM! Nível ${u.fisioterapia_nivel} e os jogadores estão voando de tão recuperados!"`);
            }
            if(u.ct_ativo && u.ct_ativo.id_jogador){
                let nomeCT = times[u.timeAtual]?.jogadores?.[u.ct_ativo.id_jogador]?.nome || "um craque";
                noticias.push(`"🏋️‍♂️ ${u.timeAtual.replace(/_/g,' ')} está treinando ${nomeCT} no CT! Dizem que vai voltar voando!"`);
            }
        }

        // AGENTES LIVRES E LENDAS
        let agentesSnap = times[`Agentes_Livres_${ligaLogada}`];
        if(agentesSnap && Object.keys(agentesSnap.jogadores||{}).length>0){
            let qtd = Object.keys(agentesSnap.jogadores).length;
            let nomes = Object.values(agentesSnap.jogadores).slice(0,2).map(j=>j.nome).join(' e ');
            noticias.push(`"👀 AGENTES LIVRES BOMBANDO! ${qtd} jogadores sem clube, incluindo ${nomes}! Quem vai contratar?"`);
        }
        if(times['Lendas_Futebol'] && Object.keys(times['Lendas_Futebol'].jogadores||{}).length>0){
            noticias.push(`"⭐ LENDA NA ÁREA! Uma lenda do futebol apareceu nos Agentes Livres! Corre que a IA vai levar!"`);
        }

        if (desafios) {
            for (let id in desafios) {
                let d = desafios[id];
                if (d.status === 'finalizado') {
                    let v = d.golsM > d.golsV? d.desafiante : d.desafiado;
                    let p = d.golsM > d.golsV? d.desafiado : d.desafiante;
                    let frasesX1 = [
                        `"⚔️ ARENA X1: O ${v.replace(/_/g,' ')} humilhou o ${p.replace(/_/g,' ')} por ${Math.max(d.golsM,d.golsV)}x${Math.min(d.golsM,d.golsV)} e levou ${d.aposta?.tipo==='dinheiro'?`R$ ${d.aposta.valor}`:`o jogador ${d.aposta?.jogador||''}`}!"`,
                        `"💰 X1 VALENDO GRANA! ${v.replace(/_/g,' ')} deu aula no ${p.replace(/_/g,' ')}! O perdedor vai ter que vender o estádio!"`,
                        `"🔥 X1 PEGANDO FOGO! ${v.replace(/_/g,' ')} amassou o ${p.replace(/_/g,' ')} na Arena! Até a mãe do perdedor torceu pro vencedor!"`
                    ];
                    noticias.push(frasesX1[Math.floor(Math.random()*frasesX1.length)]);
                }
            }
        }

        // MERCADO - COMPRA E VENDA COM NOME
        if (propostas) {
            for (let idJog in propostas) {
                let lances = propostas[idJog];
                let qtdLances = Object.keys(lances).length;
                if (qtdLances >= 2) {
                    let nomeJog = times[Object.values(usuarios).find(u=>u.timeAtual===Object.values(lances)[0]?.time_origem)?.timeAtual||'']?.jogadores?.[idJog]?.nome || idJog;
                    let frasesLeilao = [
                        `"💼 LEILÃO INSANO! ${nomeJog} tem ${qtdLances} clubes brigando! O telefone do empresário derreteu!"`,
                        `"💸 CORRIDA POR ${nomeJog.toUpperCase()}! ${qtdLances} propostas na mesa! Quem paga mais leva esse canela de ouro!"`
                    ];
                    noticias.push(frasesLeilao[Math.floor(Math.random()*frasesLeilao.length)]);
                }
            }
        }

        // JORNAL PERSONALIZADO DE JOGOS RECENTES (busca jornal do Firebase)
        try{
            let snapJornal = await db.ref(`ligas/${ligaLogada}/jornal`).orderByChild('data').limitToLast(20).once('value');
            let jornais = snapJornal.val()||{};
            for(let jId in jornais){
                let j = jornais[jId];
                if(j.texto && Math.random()<0.3){
                    noticias.push(`"${j.texto}"`);
                }
            }
        }catch(e){}

        let ricaços = Object.keys(investidores).filter(k =>!investidores[k].is_ia && investidores[k].saldo > 10000000);
        if (ricaços.length > 0) {
            let agiota = ricaços[Math.floor(Math.random() * ricaços.length)];
            noticias.push(`"🏦 AGIOTA OU GÊNIO? O clube ${agiota.replace(/_/g,' ')} virou o Banco Central da liga e está emprestando fortunas a juros altos!"`);
        }

    } catch(e) { console.error("Erro na IA do Jornal:", e); }

    let noticiaSorteada;
    do { noticiaSorteada = noticias[Math.floor(Math.random() * noticias.length)];
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
                if (times[t].jogadores && t!== "Fantasma" &&!t.startsWith("Agentes_Livres") &&!t.startsWith("Lendas_Futebol")) {
                    if (minhaDivisao && times[t].divisao && times[t].divisao!== minhaDivisao) continue;
                    for (let j in times[t].jogadores) {
                        let jog = times[t].jogadores[j];

                        // 🟢 INJEÇÃO DA REGRA DE CAMPEONATO (Filtra gols e GC da Copa)
                        let golsCamp = (jog.estatisticas?.gols || 0) - (jog.estatisticas?.gols_copa || 0);
                        let astsCamp = (jog.estatisticas?.assistencias || 0) - (jog.estatisticas?.assistencias_copa || 0);
                        let gcCamp = (jog.estatisticas?.gols_sofridos || 0) - (jog.estatisticas?.gols_sofridos_copa || 0);
                        let jogosCamp = jog.estatisticas?.jogos || 0;

                        if (golsCamp > 0 || astsCamp > 0 || (jog.posicoes && jog.posicoes.p === "Goleiro" && jogosCamp > 0)) {
                            jog.timeOrigem = t;
                            jog.golsFiltro = Math.max(0, golsCamp);
                            jog.astsFiltro = Math.max(0, astsCamp);
                            jog.gcFiltro = Math.max(0, gcCamp);
                            jog.jogosFiltro = jogosCamp;
                            todosJogadores.push(jog);
                        }
                    }
                }
            }
        }

        // 💾 SALVAMENTO GLOBAL PARA OS MODAIS FULL
        window.rankingDashDados = {
            artilheiros: [...todosJogadores].filter(j => j.golsFiltro > 0).sort((a, b) => b.golsFiltro - a.golsFiltro),
            assistentes: [...todosJogadores].filter(j => j.astsFiltro > 0).sort((a, b) => b.astsFiltro - a.astsFiltro),
            goleiros: [...todosJogadores].filter(j => j.posicoes && j.posicoes.p === "Goleiro" && j.jogosFiltro >= 1).sort((a, b) => a.gcFiltro - b.gcFiltro)
        };

        // GOLS (Mini Widget)
        let htmlGols = window.rankingDashDados.artilheiros.length === 0 ? '<li><span style="color:#666;">Sem gols...</span></li>' : '';
        window.rankingDashDados.artilheiros.slice(0, 5).forEach(j => {
            let nomeCurto = j.nome.split(" ")[0];
            htmlGols += `<li style="padding: 4px 0; border-bottom: 1px dashed #333; cursor:pointer;" onclick="abrirRankingCompletoDash('gols')"><span style="color:#fff;">${nomeCurto} <span style="font-size:9px;color:#888;">(${j.timeOrigem.replace(/_/g,' ')})</span></span> <span style="color:#ff8c00; font-weight:bold;">${j.golsFiltro}</span></li>`;
        });
        document.getElementById('lista-top-gols').innerHTML = htmlGols + `<div style="text-align:center; margin-top:8px;"><button onclick="abrirRankingCompletoDash('gols')" style="background:transparent; border:1px solid #ff8c00; color:#ff8c00; padding:2px 8px; border-radius:12px; font-size:10px; cursor:pointer;">Ver Tudo</button></div>`;

        // ASSISTÊNCIAS (Mini Widget)
        let htmlAsts = window.rankingDashDados.assistentes.length === 0 ? '<li><span style="color:#666;">Sem assistências...</span></li>' : '';
        window.rankingDashDados.assistentes.slice(0, 5).forEach(j => {
            let nomeCurto = j.nome.split(" ")[0];
            htmlAsts += `<li style="padding: 4px 0; border-bottom: 1px dashed #333; cursor:pointer;" onclick="abrirRankingCompletoDash('asts')"><span style="color:#fff;">${nomeCurto} <span style="font-size:9px;color:#888;">(${j.timeOrigem.replace(/_/g,' ')})</span></span> <span style="color:var(--verde-campo); font-weight:bold;">${j.astsFiltro}</span></li>`;
        });
        document.getElementById('lista-top-asts').innerHTML = htmlAsts + `<div style="text-align:center; margin-top:8px;"><button onclick="abrirRankingCompletoDash('asts')" style="background:transparent; border:1px solid var(--verde-campo); color:var(--verde-campo); padding:2px 8px; border-radius:12px; font-size:10px; cursor:pointer;">Ver Tudo</button></div>`;

        // GOLEIROS (Mini Widget)
        let htmlGks = window.rankingDashDados.goleiros.length === 0 ? '<li><span style="color:#666;">Aguardando...</span></li>' : '';
        window.rankingDashDados.goleiros.slice(0, 5).forEach(j => {
            let nomeCurto = j.nome.split(" ")[0];
            let corGS = (j.gcFiltro === 0) ? "var(--verde-campo)" : "#007bff";
            htmlGks += `<li style="padding: 4px 0; border-bottom: 1px dashed #333; cursor:pointer;" onclick="abrirRankingCompletoDash('gks')"><span style="color:#fff;">${nomeCurto} <span style="font-size:9px;color:#888;">(${j.timeOrigem.replace(/_/g,' ')})</span></span> <span style="color:${corGS}; font-weight:bold;">${j.gcFiltro}</span></li>`;
        });
        document.getElementById('lista-top-gks').innerHTML = htmlGks + `<div style="text-align:center; margin-top:8px;"><button onclick="abrirRankingCompletoDash('gks')" style="background:transparent; border:1px solid #007bff; color:#007bff; padding:2px 8px; border-radius:12px; font-size:10px; cursor:pointer;">Ver Tudo</button></div>`;

    } catch (e) { console.error(e); }
}

// 🏆 JANELA MODAL DO RANKING DE ESTATÍSTICAS
window.abrirRankingCompletoDash = function(tipo) {
    if(!window.rankingDashDados) return;

    let dados = [];
    let titulo = "";
    let icone = "";
    let cor = "";
    let colValor = "";

    if (tipo === 'gols') {
        dados = window.rankingDashDados.artilheiros.slice(0, 20); // Top 20
        titulo = "Artilharia da Liga"; icone = "⚽"; cor = "#ff8c00"; colValor = "Gols";
    } else if (tipo === 'asts') {
        dados = window.rankingDashDados.assistentes.slice(0, 20);
        titulo = "Garçons da Liga"; icone = "👟"; cor = "var(--verde-campo)"; colValor = "Assists";
    } else if (tipo === 'gks') {
        dados = window.rankingDashDados.goleiros.slice(0, 20);
        titulo = "Goleiros Menos Vazados"; icone = "🧤"; cor = "#007bff"; colValor = "GS / Jogos";
    }

    let cx = document.createElement('div');
    cx.id = 'modal-ranking-estatisticas';
    cx.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10006; display:flex; justify-content:center; align-items:center;";

    let htmlLinhas = dados.map((j, i) => {
        let val = "";
        if (tipo === 'gols') val = j.golsFiltro;
        else if (tipo === 'asts') val = j.astsFiltro;
        else if (tipo === 'gks') val = `${j.gcFiltro} <span style="font-size:10px; color:#888;">(${j.jogosFiltro}J)</span>`;

        let medalha = i === 0 ? "🥇" : (i === 1 ? "🥈" : (i === 2 ? "🥉" : `${i+1}º`));

        return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #333; background:${i%2===0?'#111':'#1a1a1a'};">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:#aaa; font-weight:bold; width:25px; text-align:center;">${medalha}</span>
                <div style="display:flex; flex-direction:column;">
                    <strong style="color:#fff; font-size:15px;">${j.nome}</strong>
                    <span style="color:#888; font-size:11px;">${j.timeOrigem.replace(/_/g, ' ')}</span>
                </div>
            </div>
            <strong style="color:${cor}; font-size:18px;">${val}</strong>
        </div>`;
    }).join('');

    if (dados.length === 0) htmlLinhas = `<div style="text-align:center; padding:30px; color:#666;">Sem estatísticas registradas ainda.</div>`;

    cx.innerHTML = `
        <div style="background:#1a1a1a; width:95%; max-width:450px; max-height:85vh; border-radius:12px; border:2px solid ${cor}; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,0.8);">
            <div style="padding:15px 20px; border-bottom:1px solid #333; background:#111; display:flex; justify-content:space-between; align-items:center; border-radius: 12px 12px 0 0;">
                <h2 style="color:${cor}; margin:0; font-size:18px;">${icone} ${titulo}</h2>
                <button onclick="document.getElementById('modal-ranking-estatisticas').remove()" style="background:transparent; border:none; color:#aaa; font-size:26px; cursor:pointer;">&times;</button>
            </div>
            <div style="padding:10px 20px; display:flex; justify-content:space-between; border-bottom:1px dashed #444; color:#aaa; font-size:12px; font-weight:bold; background:#000;">
                <span>JOGADOR</span>
                <span>${colValor.toUpperCase()}</span>
            </div>
            <div style="overflow-y:auto; flex:1; padding-bottom:10px;">
                ${htmlLinhas}
            </div>
        </div>
    `;
    document.body.appendChild(cx);
};
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
                let nomeDono = window.treinadoresGlobais[t.id]? `<span style="font-size:9px; color:#aaa; display:block; line-height:1; font-weight:normal; margin-top:2px;">👤 ${window.treinadoresGlobais[t.id]}</span>` : `<span style="font-size:9px; color:#666; display:block; line-height:1; font-weight:normal; margin-top:2px;">👤 Diretoria ${t.id.replace(/_/g,' ')}</span>`;

                // 🟢 O Botão de Olheiro!
                let btnEspionar = !ehMeu ? `<button onclick="espionarAdversario('${t.id}')" title="Espionar Escalação" style="background:transparent; border:none; cursor:pointer; font-size:16px; margin-left:5px; padding:0; filter:grayscale(1) brightness(2); transition:0.2s;" onmouseover="this.style.filter='none'" onmouseout="this.style.filter='grayscale(1) brightness(2)'">👁️</button>` : "";

                html += `
                    <tr style="border-bottom: 1px solid #333; background: ${ehMeu ? 'rgba(255,140,0,0.1)' : 'transparent'};">
                        <td style="padding: 8px 0; color: #aaa;">${i+1}º</td>
                        <td style="text-align: left; color: ${cor}; font-weight: ${peso}; line-height:1.1; padding: 4px 0;">
                            <div style="display:flex; align-items:center;">
                                <img src="${getEscudo(t.id)}" onerror="this.src='esculdos/default.png'" style="width: 16px; height: 16px; margin-right: 6px;">
                                <div style="display:flex; flex-direction:column;">
                                    <div style="display:flex; align-items:center;">
                                        <span>${t.id.replace(/_/g, ' ')}</span>
                                        ${btnEspionar}
                                    </div>
                                    ${nomeDono}
                                </div>
                            </div>
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

        // Salva globalmente para o modal de detalhes poder ler
        window.propostasRadarGlobal = propostas;
        window.timesRadarGlobal = timesGlobais;

        let html = "";
        for (let idAlvo in propostas) {
            let lancesObj = propostas[idAlvo];
            let qtdLances = Object.keys(lancesObj).length;

            // Tenta achar o nome do jogador alvo e o clube dono no banco global
            let nomeAlvo = "Atleta Desconhecido";
            let donoAlvo = "Clube Desconhecido";

            for(let t in timesGlobais) {
                if(timesGlobais[t].jogadores && timesGlobais[t].jogadores[idAlvo]) {
                    nomeAlvo = timesGlobais[t].jogadores[idAlvo].nome;
                    donoAlvo = t;
                    break;
                }
            }

            // Prepara as variáveis para não quebrar a tela caso o nome do jogador tenha aspas simples
            let nomeSeguro = nomeAlvo.replace(/'/g, "\\'");
            let donoSeguro = donoAlvo.replace(/'/g, "\\'");

            html += `
                <div onclick="abrirDetalhesRadar('${idAlvo}', '${nomeSeguro}', '${donoSeguro}')" style="padding: 8px; border-bottom: 1px dashed #444; font-size: 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#222'" onmouseout="this.style.background='transparent'">
                    <div style="display: flex; flex-direction: column;">
                        <strong style="color: #fff;">${nomeAlvo}</strong>
                        <span style="color: #888; font-size: 10px;">Recebeu ${qtdLances} proposta(s)</span>
                    </div>
                    <span style="background: rgba(255, 140, 0, 0.2); color: #ff8c00; padding: 3px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #ff8c00;">Visualizar Ofertas 🔎</span>
                </div>
            `;
        }
        listaRadar.innerHTML = html;

    } catch(e) { console.error(e); }
}

// ==========================================
// MODAL DE DETALHES DO RADAR DE MERCADO
// ==========================================
window.abrirDetalhesRadar = function(idAlvo, nomeAlvo, donoAlvo) {
    let lances = window.propostasRadarGlobal ? window.propostasRadarGlobal[idAlvo] : null;
    if (!lances) return alert("As propostas já foram encerradas ou o radar desatualizou.");

    let modal = document.getElementById('modal-detalhes-radar');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-detalhes-radar';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
        document.body.appendChild(modal);
    }

    let htmlLances = "";
    for (let login in lances) {
        let lance = lances[login];

        // Trata a data da proposta
        let dataF = lance.data_proposta ? new Date(lance.data_proposta).toLocaleString('pt-BR') : 'Data não registrada';

        // Distingue Compra de Empréstimo
        let badgeTipo = lance.tipo_negocio === 'emprestimo'
            ? `<span style="background:#0056b3; padding:3px 8px; border-radius:4px; font-size:10px; color:#fff; font-weight:bold;">🤝 Empréstimo (${lance.duracao_rodadas} rodadas)</span>`
            : `<span style="background:var(--verde-campo); padding:3px 8px; border-radius:4px; font-size:10px; color:#fff; font-weight:bold;">💰 Compra Definitiva</span>`;

        // Verifica se há jogador incluído na troca
        let txtTroca = "";
        if (lance.id_jogador_oferecido && window.timesRadarGlobal && window.timesRadarGlobal[lance.time_comprador]) {
            let jogTroca = window.timesRadarGlobal[lance.time_comprador].jogadores[lance.id_jogador_oferecido];
            if (jogTroca) {
                let at = jogTroca.atributos || {ataque:0, defesa:0, forca:0, velocidade:0, habilidade:0};
                let ovrTroca = Math.round((at.ataque + at.defesa + at.forca + at.velocidade + at.habilidade) / 5);
                txtTroca = `<div style="color:#ff8c00; font-size:12px; margin-top:8px; padding-top:8px; border-top:1px dashed #333;">🔄 <strong style="color:#fff;">Inclui na troca:</strong> ${jogTroca.nome} (OVR: ${ovrTroca})</div>`;
            }
        }

        htmlLances += `
            <div style="background:#111; border:1px solid #333; padding:15px; border-radius:8px; margin-bottom:12px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #222; padding-bottom:8px; margin-bottom:8px;">
                    <div style="display:flex; flex-direction:column;">
                        <strong style="color:#fff; font-size:15px;">🏢 ${lance.time_comprador.replace(/_/g, ' ')}</strong>
                        <span style="font-size:11px; color:#aaa; margin-top:2px;">👤 ${window.treinadoresGlobais[lance.time_comprador] || "Diretoria (IA)"}</span>
                    </div>
                    <strong style="color:var(--verde-campo); font-size:16px;">${formatarDinheiro(lance.valor_oferecido)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    ${badgeTipo}
                    <span style="color:#888; font-size:11px;">📅 ${dataF}</span>
                </div>
                ${txtTroca}
            </div>
        `;
    }

    modal.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:550px; border-radius:12px; border:1px solid #444; box-shadow: 0 10px 40px rgba(0,0,0,0.8); display:flex; flex-direction:column; max-height:85vh;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 20px; border-bottom:1px solid #333; background:#222; border-radius: 12px 12px 0 0;">
                <div>
                    <h2 style="color:#ff8c00; margin:0; font-size:18px;">Dossiê de Mercado 🕵️‍♂️</h2>
                    <span style="color:#aaa; font-size:12px;">Alvo: <strong style="color:#fff;">${nomeAlvo}</strong> (Dono Atual: ${donoAlvo.replace(/_/g, ' ')})</span>
                </div>
                <button onclick="document.getElementById('modal-detalhes-radar').remove()" style="background:transparent; border:none; color:#aaa; font-size:26px; cursor:pointer; line-height:1;">&times;</button>
            </div>
            <div style="overflow-y:auto; flex:1; padding:20px;">
                ${htmlLances}
            </div>
        </div>
    `;
};

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
    hinoAmbiente.volume = 0.05;
    hinoAmbiente.loop = true;

    torcidaAmbiente.src = `sounds/${nomeDoTime}_torcida.mp3`;
    torcidaAmbiente.onerror = () => { torcidaAmbiente.src = 'sounds/torcida_generica.mp3'; };
    torcidaAmbiente.volume = 0.02;
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

    btn.style.cssText = "background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; width: 32px; height: 32px; font-size: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; flex-shrink: 0;";

    btn.onclick = (e) => {
        e.stopPropagation();
        if (hinoAmbiente.paused) {
            hinoAmbiente.play(); torcidaAmbiente.play();
            btn.innerHTML = '🔊';
            btn.style.background = 'rgba(0,184,83,0.2)';
            btn.style.borderColor = 'var(--verde-campo)';
        } else {
            hinoAmbiente.pause(); torcidaAmbiente.pause();
            btn.innerHTML = '🔇';
            btn.style.background = 'rgba(255,255,255,0.1)';
            btn.style.borderColor = 'rgba(255,255,255,0.2)';
        }
    };

    // 🟢 Novo Ponto de Injeção: O botão de Som vai ficar entre a Info do Treinador e o Saldo, perfeitamente alinhado na Topbar!
    let infoCaixaDiv = document.querySelector('.info-caixa');
    if (infoCaixaDiv) {
        infoCaixaDiv.insertBefore(btn, infoCaixaDiv.firstChild);
    } else {
        document.body.appendChild(btn);
    }
}

// ==========================================
// ⚔️ SISTEMA DE AMISTOSOS X1 (Apostas e Desafios)
// ==========================================
let arenaDadosGlobais = { times: {}, usuarios: {} };
let desafiosX1Globais = {};
let listenerX1Ativo = false;

window.abrirModalX1 = async function() {
    try {
        const snapB = await db.ref('banco_global_times').once('value');
        const snapU = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
        arenaDadosGlobais.times = snapB.val() || {};
        arenaDadosGlobais.usuarios = snapU.val() || {};

        let modal = document.getElementById('modal-arena-x1');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-arena-x1';
            modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10005; display:flex; justify-content:center; align-items:center;";
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background:#1a1a1a; width:90%; max-width:600px; border-radius:12px; border:2px solid #dc3545; padding:20px; box-shadow: 0 0 30px rgba(220,53,69,0.3); display:flex; flex-direction:column; max-height:85vh;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-shrink:0;">
                    <h2 style="color:#dc3545; margin:0; text-transform:uppercase; letter-spacing:2px;">⚔️ Arena X1</h2>
                    <button onclick="fecharModalX1()" style="background:transparent; border:none; color:#aaa; font-size:24px; cursor:pointer;">&times;</button>
                </div>

                <div style="display:flex; border-bottom:1px solid #333; margin-bottom:15px; flex-shrink:0;">
                    <button id="tab-x1-novo" onclick="renderAbaX1('novo')" style="flex:1; padding:10px; background:#dc3545; color:#fff; border:none; cursor:pointer; font-weight:bold; font-size:12px;">⚔️ Novo</button>
                    <button id="tab-x1-env" onclick="renderAbaX1('env')" style="flex:1; padding:10px; background:#111; color:#888; border:none; cursor:pointer; font-weight:bold; border-left:1px solid #333; border-right:1px solid #333; font-size:12px;">📤 Enviados</button>
                    <button id="tab-x1-rec" onclick="renderAbaX1('rec')" style="flex:1; padding:10px; background:#111; color:#888; border:none; cursor:pointer; font-weight:bold; font-size:12px;">📥 Recebidos</button>
                </div>

                <div id="conteudo-x1" style="overflow-y:auto; flex:1; padding-right:5px;">
                    <p style="color:#888; text-align:center;">Carregando...</p>
                </div>
            </div>
        `;

        // Ativa o Radar do Firebase para os Desafios em tempo real
        if (!listenerX1Ativo) {
            db.ref(`ligas/${ligaLogada}/x1_desafios`).on('value', snap => {
                desafiosX1Globais = snap.val() || {};
                if (document.getElementById('modal-arena-x1') && !document.getElementById('x1-lances')) {
                    let abaAtiva = 'novo';
                    if (document.getElementById('tab-x1-env') && document.getElementById('tab-x1-env').style.background.includes('220')) abaAtiva = 'env';
                    if (document.getElementById('tab-x1-rec') && document.getElementById('tab-x1-rec').style.background.includes('220')) abaAtiva = 'rec';
                    renderAbaX1(abaAtiva);
                }
            });
            listenerX1Ativo = true;
        } else {
            renderAbaX1('novo');
        }

    } catch(e) { console.error("Erro na Arena X1", e); }
};

window.fecharModalX1 = function() {
    let m = document.getElementById('modal-arena-x1');
    if(m) m.remove();
    if(window.transmissaoX1Loop) clearInterval(window.transmissaoX1Loop);
    if(window.x1Audios) {
        Object.values(window.x1Audios).forEach(a => { if(a) { a.pause(); a.currentTime = 0; } });
    }
};

window.renderAbaX1 = function(aba) {
    let btnNovo = document.getElementById('tab-x1-novo');
    let btnEnv = document.getElementById('tab-x1-env');
    let btnRec = document.getElementById('tab-x1-rec');

    if(btnNovo) { btnNovo.style.background = (aba === 'novo') ? '#dc3545' : '#111'; btnNovo.style.color = (aba === 'novo') ? '#fff' : '#888'; }
    if(btnEnv) { btnEnv.style.background = (aba === 'env') ? '#dc3545' : '#111'; btnEnv.style.color = (aba === 'env') ? '#fff' : '#888'; }
    if(btnRec) { btnRec.style.background = (aba === 'rec') ? '#dc3545' : '#111'; btnRec.style.color = (aba === 'rec') ? '#fff' : '#888'; }

    const div = document.getElementById('conteudo-x1');
    if (!div) return;

    let meuTime = dadosUsuario.timeAtual;

    if (aba === 'novo') {
        let optionsAdversarios = `<option value="">Selecione um oponente...</option>`;

        for (let t in arenaDadosGlobais.times) {
            if (t === meuTime || t.startsWith("Agentes_Livres") || t === "Fantasma") continue;

            // 🟢 IDENTIFICAÇÃO CORRETA DE IA: Só é player se não começar com IA_
            let donoNome = "🤖 IA";
            for (let k in arenaDadosGlobais.usuarios) {
                if (arenaDadosGlobais.usuarios[k].timeAtual === t && !k.startsWith('IA_')) {
                    donoNome = `👤 ${arenaDadosGlobais.usuarios[k].nome}`;
                    break;
                }
            }

            optionsAdversarios += `<option value="${t}">${t.replace(/_/g, ' ')} - ${donoNome}</option>`;
        }

        div.innerHTML = `
            <div style="margin-bottom:15px;">
                <label style="color:#aaa; font-size:12px; font-weight:bold;">1. Escolha seu Oponente:</label>
                <select id="x1-oponente" onchange="atualizarOpcoesApostaX1()" style="width:100%; padding:10px; background:#111; border:1px solid #333; color:#fff; border-radius:4px; margin-top:5px;">
                    ${optionsAdversarios}
                </select>
            </div>
            <div style="margin-bottom:15px;">
                <label style="color:#aaa; font-size:12px; font-weight:bold;">2. Tipo de Aposta:</label>
                <select id="x1-tipo-aposta" onchange="atualizarOpcoesApostaX1()" style="width:100%; padding:10px; background:#111; border:1px solid #333; color:#fff; border-radius:4px; margin-top:5px;">
                    <option value="dinheiro">Dinheiro (Caixa do Clube)</option>
                    <option value="jogador">Passe de Jogador (Pink Slip)</option>
                </select>
            </div>
            <div id="x1-area-aposta" style="background:#111; padding:15px; border-radius:8px; border:1px dashed #444; margin-bottom:20px;"></div>
            <button onclick="enviarDesafioX1()" style="width:100%; padding:12px; background:#dc3545; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:14px; text-transform:uppercase;">Lançar Desafio</button>
        `;
        atualizarOpcoesApostaX1();
    }
    else {
        let html = "";
        let cont = 0;
        for (let id in desafiosX1Globais) {
            let d = desafiosX1Globais[id];

            // 🟢 LIXEIRA DE REPRISES: Se o jogo acabou e VOCÊ já assistiu, some daqui!
            if (d.status === 'finalizado' && d[`visto_${userLogado}`]) continue;

            let isEnv = (aba === 'env' && d.desafiante === meuTime);
            let isRec = (aba === 'rec' && d.desafiado === meuTime);

            if (isEnv || isRec) {
                cont++;
                let adv = isEnv ? d.desafiado : d.desafiante;
                let txtAposta = d.tipo === 'dinheiro' ? `Aposta: ${formatarDinheiro(d.valor)}` : `Aposta de Jogadores (Pink Slip)`;

                let corStatus = d.status === 'pendente' ? '#ffc107' : (d.status === 'aceito' ? 'var(--verde-campo)' : '#aaa');
                let lblStatus = d.status.toUpperCase();

                let botoes = "";
                if (d.status === 'pendente') {
                    if (isEnv) botoes = `<button onclick="cancelarDesafioX1('${id}')" style="padding:6px 12px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; cursor:pointer; font-size:11px;">Cancelar Desafio</button>`;
                    if (isRec) botoes = `
                        <button onclick="aceitarDesafioX1('${id}')" style="padding:6px 12px; background:var(--verde-campo); color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px; margin-right:5px;">Aceitar</button>
                        <button onclick="cancelarDesafioX1('${id}')" style="padding:6px 12px; background:#dc3545; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px;">Recusar</button>
                    `;
                } else if (d.status === 'aceito') {
                    botoes = `<button onclick="iniciarTransmissaoX1('${id}')" style="padding:8px 15px; background:#ff8c00; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold; width:100%; box-shadow:0 0 10px rgba(255,140,0,0.5);">▶️ INICIAR TRANSMISSÃO</button>`;
                } else if (d.status === 'finalizado') {
                    botoes = `<button onclick="iniciarTransmissaoX1('${id}')" style="padding:6px 12px; background:#333; color:#aaa; border:1px solid #555; border-radius:4px; cursor:pointer; font-size:11px; width:100%;">Ver Reprise da Partida</button>`;
                }

                // 🟢 IDENTIFICAÇÃO CORRETA DE IA DO OPONENTE
                let nomeAdv = "🤖 IA";
                for (let k in arenaDadosGlobais.usuarios) {
                    if (arenaDadosGlobais.usuarios[k].timeAtual === adv && !k.startsWith('IA_')) {
                        nomeAdv = `👤 ${arenaDadosGlobais.usuarios[k].nome}`;
                        break;
                    }
                }

                html += `
                    <div style="background:#111; border:1px solid #333; padding:12px; border-radius:8px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div style="display:flex; flex-direction:column;">
                                <strong style="color:#fff; font-size:14px;">${adv.replace(/_/g, ' ')}</strong>
                                <span style="font-size:10px; color:#ff8c00; margin-top:2px;">${nomeAdv}</span>
                            </div>
                            <span style="background:rgba(0,0,0,0.5); padding:3px 8px; border-radius:10px; font-size:10px; color:${corStatus}; border:1px solid ${corStatus}; font-weight:bold;">${lblStatus}</span>
                        </div>
                        <div style="font-size:12px; color:#aaa; margin-bottom:12px;">${txtAposta}</div>
                        <div style="text-align:right;">${botoes}</div>
                    </div>
                `;
            }
        }
        div.innerHTML = html || `<p style="text-align:center; color:#666; margin-top:30px;">Nenhum desafio nesta aba.</p>`;
    }
};

window.atualizarOpcoesApostaX1 = function() {
    let tipo = document.getElementById('x1-tipo-aposta').value;
    let oponente = document.getElementById('x1-oponente').value;
    let area = document.getElementById('x1-area-aposta');

    if (!oponente) {
        area.innerHTML = `<p style="color:#666; text-align:center; margin:0;">Selecione um oponente primeiro.</p>`;
        return;
    }

    if (tipo === 'dinheiro') {
        area.innerHTML = `
            <label style="color:#aaa; font-size:12px;">Valor da Aposta (R$):</label>
            <input type="number" id="x1-valor-aposta" placeholder="Ex: 5000000" style="width:100%; padding:10px; background:#000; border:1px solid #333; color:var(--verde-campo); font-weight:bold; border-radius:4px; margin-top:5px;">
            <small style="color:#666; display:block; margin-top:5px;">O vencedor leva tudo.</small>
        `;
    } else {
        let meuTime = dadosUsuario.timeAtual;
        let meusJ = arenaDadosGlobais.times[meuTime].jogadores || {};
        let advJ = arenaDadosGlobais.times[oponente].jogadores || {};

        let optMeus = `<option value="">Selecione o SEU jogador que será apostado...</option>`;
        for(let id in meusJ) optMeus += `<option value="${id}">${meusJ[id].nome} (Valor: ${formatarDinheiro(meusJ[id].valor_mercado)})</option>`;

        let optAdv = `<option value="">Selecione o jogador DELE que você quer ganhar...</option>`;
        for(let id in advJ) optAdv += `<option value="${id}">${advJ[id].nome} (Valor: ${formatarDinheiro(advJ[id].valor_mercado)})</option>`;

        area.innerHTML = `
            <label style="color:#aaa; font-size:12px;">O que você coloca na mesa?</label>
            <select id="x1-meu-jogador" style="width:100%; padding:10px; background:#000; border:1px solid #333; color:#fff; border-radius:4px; margin-top:5px; margin-bottom:10px;">${optMeus}</select>

            <label style="color:#aaa; font-size:12px;">O que você quer do oponente?</label>
            <select id="x1-adv-jogador" style="width:100%; padding:10px; background:#000; border:1px solid #333; color:#fff; border-radius:4px; margin-top:5px;">${optAdv}</select>

            <small style="color:#dc3545; display:block; margin-top:8px; font-weight:bold;">⚠️ REGRA: A diferença de valor entre os atletas não pode passar de 5%.</small>
        `;
    }
};

window.enviarDesafioX1 = async function() {
    let oponente = document.getElementById('x1-oponente').value;
    let tipo = document.getElementById('x1-tipo-aposta').value;
    let meuTime = dadosUsuario.timeAtual;

    if (!oponente) return mostrarAvisoEleganteDash("Selecione um oponente!", "#dc3545", "⚔️");

    let forcaM = arenaDadosGlobais.times[meuTime].forca_base || 500;
    let forcaV = arenaDadosGlobais.times[oponente].forca_base || 500;

    // 🟢 IDENTIFICAÇÃO CORRETA DE IA NO DISPARO
    let isOponenteIA = true;
    for (let k in arenaDadosGlobais.usuarios) {
        if (arenaDadosGlobais.usuarios[k].timeAtual === oponente && !k.startsWith('IA_')) {
            isOponenteIA = false;
            break;
        }
    }

    if (isOponenteIA && forcaM > forcaV) {
        return mostrarAvisoEleganteDash(`A Diretoria do ${oponente.replace(/_/g, ' ')} RECUSOU o desafio!<br><br>A inteligência artificial identificou que seu time é superior e não quer arriscar perder os ativos do clube.`, "#ff8c00", "🤖");
    }

    let apostaValidada = {};
    let taxaX1 = 5000;

    if (tipo === 'dinheiro') {
        let valor = parseInt(document.getElementById('x1-valor-aposta').value);
        if (isNaN(valor) || valor <= 0) return mostrarAvisoEleganteDash("Valor de aposta inválido.", "#dc3545", "❌");

        let caixaM = dadosUsuario.caixaClube || 0;
        let caixaV = isOponenteIA ? 50000000 : 0;
        if (!isOponenteIA) {
            let userAdv = Object.values(arenaDadosGlobais.usuarios).find(u => u.timeAtual === oponente && !u.nome.includes('Diretoria'));
            if (userAdv) caixaV = userAdv.caixaClube || 0;
        }

        if (caixaM < (valor + taxaX1)) return mostrarAvisoEleganteDash(`Saldo Insuficiente! Você precisa do valor da aposta + R$ 5.000 da Taxa da Arena.`, "#dc3545", "💸");
        if (caixaV < (valor + taxaX1)) return mostrarAvisoEleganteDash(`O oponente não tem caixa para a aposta + R$ 5.000 de Taxa.`, "#dc3545", "💸");

        apostaValidada = { tipo: 'dinheiro', valor: valor, taxa: taxaX1 };
    } else {
        let meuId = document.getElementById('x1-meu-jogador').value;
        let advId = document.getElementById('x1-adv-jogador').value;
        if (!meuId || !advId) return mostrarAvisoEleganteDash("Selecione os dois jogadores da aposta.", "#dc3545", "👤");

        let caixaM = dadosUsuario.caixaClube || 0;
        let caixaV = isOponenteIA ? 50000000 : 0;
        if (!isOponenteIA) {
            let userAdv = Object.values(arenaDadosGlobais.usuarios).find(u => u.timeAtual === oponente && !u.nome.includes('Diretoria'));
            if (userAdv) caixaV = userAdv.caixaClube || 0;
        }

        if (caixaM < taxaX1) return mostrarAvisoEleganteDash(`Você precisa ter pelo menos R$ 5.000 em caixa para pagar a Taxa da Arena.`, "#dc3545", "💸");
        if (caixaV < taxaX1) return mostrarAvisoEleganteDash(`O oponente não tem R$ 5.000 em caixa para pagar a Taxa da Arena.`, "#dc3545", "💸");

        let meuJog = arenaDadosGlobais.times[meuTime].jogadores[meuId];
        let advJog = arenaDadosGlobais.times[oponente].jogadores[advId];

        let valorM = meuJog.valor_mercado || 1000000;
        let valorV = advJog.valor_mercado || 1000000;
        let diff = Math.abs(valorM - valorV);
        let maxDiff = Math.max(valorM, valorV) * 0.05;

        if (diff > maxDiff) return mostrarAvisoEleganteDash(`Aposta Rejeitada! A diferença de valor ultrapassa 5%.<br><br>Seu Jogador: ${formatarDinheiro(valorM)}<br>Adversário: ${formatarDinheiro(valorV)}`, "#dc3545", "⚖️");

        apostaValidada = { tipo: 'jogador', id_meu: meuId, id_adv: advId, dados_meu: meuJog, dados_adv: advJog };
    }

    if (isOponenteIA) {
        // IA SIMULATION INSTANT
        let linhaTempoX1 = [];
        let golsM = 0; let golsV = 0;

        const sortearX1 = (tId, arg2, arg3) => {
            let posicoes = Array.isArray(arg2) ? arg2 : (Array.isArray(arg3) ? arg3 : null);
            let el = arenaDadosGlobais.times[tId]?.jogadores ? Object.values(arenaDadosGlobais.times[tId].jogadores) : [];
            if(posicoes) {
                let filt = el.filter(j => j.posicoes && posicoes.includes(j.posicoes.p));
                if(filt.length > 0) return filt[Math.floor(Math.random() * filt.length)];
            }
            return el.length ? el[Math.floor(Math.random() * el.length)] : {nome: "Jogador"};
        };

        for(let i=0; i<5; i++) {
            let minutoGolM = Math.floor(Math.random()*89)+1;
            if (Math.random() < (forcaM / (forcaM + forcaV)) * 0.6) {
                let nA = sortearX1(meuTime, minutoGolM, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
                linhaTempoX1.push({ minuto: minutoGolM, tipo: 'gol_m', texto: `⚽ GOOOL! Golaço espetacular de ${nA}! A Arena vai à loucura!` });
                golsM++;
            }
            let minutoGolV = Math.floor(Math.random()*89)+1;
            if (Math.random() < (forcaV / (forcaM + forcaV)) * 0.6) {
                let nA = sortearX1(oponente, minutoGolV, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
                linhaTempoX1.push({ minuto: minutoGolV, tipo: 'gol_v', texto: `⚽ GOL DO VISITANTE! ${nA} acha uma brecha na zaga e manda pro fundo da rede!` });
                golsV++;
            }
        }

        for(let i=0; i<16; i++) {
            let minAleatorio = Math.floor(Math.random()*89)+1;
            if (minAleatorio === 45) minAleatorio = 46;

            let isM = Math.random() > 0.5;
            let tAtq = isM ? meuTime : oponente;
            let tDef = isM ? oponente : meuTime;

            let atk = sortearX1(tAtq, minAleatorio, ["Atacante", "Ponta", "Centroavante"]).nome.split(" ")[0];
            let mei = sortearX1(tAtq, minAleatorio, ["Meia", "Volante"]).nome.split(" ")[0];
            let zag = sortearX1(tDef, minAleatorio, ["Zagueiro", "Lateral", "Volante"]).nome.split(" ")[0];
            let gol = sortearX1(tDef, minAleatorio, ["Goleiro"]).nome.split(" ")[0];

            let frases = [
                `UHHH! ${mei} deu um passe açucarado para ${atk}, que chutou raspando a trave!`,
                `Bela jogada! ${atk} tentou a finta, mas ${zag} fez um desarme cirúrgico!`,
                `Troca de passes envolvente. ${mei} dita o ritmo.`,
                `Cruzamento venenoso na área, ${atk} cabeceia e o goleiro ${gol} salva!`,
                `PERIGO! ${atk} arranca com velocidade, mas o chute vai para fora.`,
                `MILAGRE! ${atk} finaliza à queima-roupa e ${gol} salva com as pontas dos dedos!`,
                `Chuteira calibrada! ${mei} arrisca de longe, a bola passa assustando!`,
                `Falta de ${zag} em cima de ${atk}. O juiz marca a infração.`
            ];
            linhaTempoX1.push({ minuto: minAleatorio, tipo: isM ? 'ataque_m' : 'ataque_v', texto: frases[Math.floor(Math.random()*frases.length)] });
        }

        linhaTempoX1.push({ minuto: 1, tipo: 'inicio', texto: `🟢 APITA O ÁRBITRO! Começa o duelo na Arena X1!` });
        if (!linhaTempoX1.some(l => l.minuto === 45 && (l.tipo === 'gol_m' || l.tipo === 'gol_v'))) {
            linhaTempoX1.push({ minuto: 45, tipo: 'intervalo', texto: `⏱️ Fim do Primeiro Tempo!` });
        }

        linhaTempoX1.sort((a,b) => a.minuto - b.minuto);

        let empate = (golsM === golsV);
        let venci = golsM > golsV;
        let txtFim = "";

        if (empate) {
            txtFim = `EMPATE! Ninguém venceu a aposta e a Arena cobrou taxa dupla de R$ 10.000 do seu caixa!`;
            apostaValidada.empate = true;
        } else if (tipo === 'dinheiro') {
            txtFim = (venci ? `Você faturou ${formatarDinheiro(apostaValidada.valor)} da máquina! (Taxa da Arena: R$ 5.000)` : `A máquina levou ${formatarDinheiro(apostaValidada.valor)}! (Taxa da Arena: R$ 5.000)`);
        } else {
            txtFim = (venci ? `O passe de ${apostaValidada.dados_adv.nome} agora é seu! (Taxa da Arena: R$ 5.000)` : `Adeus! O seu jogador ${apostaValidada.dados_meu.nome} fez as malas. (Taxa da Arena: R$ 5.000)`);
        }

        reproduzirTransmissaoX1(meuTime, oponente, linhaTempoX1, golsM, golsV, venci, txtFim, true, apostaValidada);
    } else {
        // P2P HUMAN - Salva a solicitação na Nuvem
        let idDesafio = `x1_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        let d = {
            desafiante: meuTime,
            desafiado: oponente,
            status: 'pendente',
            tipo: tipo,
            data: new Date().toISOString()
        };
        if(tipo === 'dinheiro') {
            d.valor = apostaValidada.valor;
        } else {
            d.id_meu = apostaValidada.id_meu; d.id_adv = apostaValidada.id_adv;
            d.dados_meu = apostaValidada.dados_meu; d.dados_adv = apostaValidada.dados_adv;
        }
        await db.ref(`ligas/${ligaLogada}/x1_desafios/${idDesafio}`).set(d);
        mostrarAvisoEleganteDash("Desafio enviado com sucesso! Aguarde o oponente aceitar na aba 'Enviados'.", "var(--verde-campo)", "🚀");
        renderAbaX1('env');
    }
};
window.cancelarDesafioX1 = async function(id) {
    if(confirm("Deseja cancelar/recusar este desafio?")) {
        await db.ref(`ligas/${ligaLogada}/x1_desafios/${id}`).remove();
    }
};

window.aceitarDesafioX1 = async function(id) {
    if(confirm("Deseja ACEITAR o desafio e liberar a transmissão na Arena X1?")) {
        await db.ref(`ligas/${ligaLogada}/x1_desafios/${id}/status`).set('aceito');
        alert("Desafio Aceito! O botão de Iniciar Transmissão está disponível.");
    }
};

// ========================================================
// 🧠 MOTOR GERADOR DA PARTIDA (Nuvem / Local)
// ========================================================
function gerarLinhaTempoX1(forcaM, forcaV, mandante, visitante) {
    let linhaTempo = [];
    let golsM = 0; let golsV = 0;

    const getTitularesX1 = (tId) => {
        let login = Object.keys(arenaDadosGlobais.usuarios||{}).find(k=> arenaDadosGlobais.usuarios[k].timeAtual===tId);
        let ids = login? (arenaDadosGlobais.usuarios[login].titulares||[]) : [];
        let jogadores = arenaDadosGlobais.times[tId]?.jogadores||{};
        let lista = [];
        if(ids.length>0){
            lista = ids.filter(Boolean).map(id=> jogadores[id]).filter(Boolean).map((j,idx)=> ({...j, id_real: ids[idx]}));
        }
        if(lista.length<11){
            // fallback top 11 por OVR
            let todos = Object.values(jogadores).map(j=> ({...j, ovr: ((j.atributos.ataque||0)+(j.atributos.defesa||0)+(j.atributos.forca||0)+(j.atributos.velocidade||0)+(j.atributos.habilidade||0))/5 })).sort((a,b)=>b.ovr-a.ovr);
            lista = todos.slice(0,11);
        }
        return lista;
    };
    const getReservasX1 = (tId) => {
        let titulares = getTitularesX1(tId);
        let nomesTit = titulares.map(t=>t.nome);
        let todos = Object.values(arenaDadosGlobais.times[tId]?.jogadores||{});
        return todos.filter(j=>!nomesTit.includes(j.nome));
    };

    let titularesM = getTitularesX1(mandante);
    let titularesV = getTitularesX1(visitante);
    let reservasM = getReservasX1(mandante);
    let reservasV = getReservasX1(visitante);

    const sortearX1 = (tId, minuto, posicoes = null) => {
        let ehMandante = tId===mandante;
        let poolTit = ehMandante? titularesM : titularesV;
        let poolRes = ehMandante? reservasM : reservasV;
        let pool = [];
        if(minuto<=45){
            pool = poolTit; // 1º tempo SÓ titular
        } else {
            // 2º tempo 75% titular, 25% reserva entrando
            pool = Math.random()<0.75? poolTit : (poolRes.length? poolRes : poolTit);
        }
        if(posicoes){
            let filt = pool.filter(j=> posicoes.includes(j.posicoes?.p));
            if(filt.length>0) return filt[Math.floor(Math.random()*filt.length)];
        }
        return pool.length? pool[Math.floor(Math.random()*pool.length)] : {nome:"Jogador", posicoes:{p:"Atacante"}};
    };

    for(let i=0; i<5; i++) {
        let minutoGolM = Math.floor(Math.random()*89)+1;
        if (Math.random() < (forcaM / (forcaM + forcaV)) * 0.6) {
            let nA = sortearX1(mandante, minutoGolM, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
            linhaTempo.push({ minuto: minutoGolM, tipo: 'gol_m', texto: `⚽ GOOOL! Golaço espetacular de ${nA}! A Arena vai à loucura!` });
            golsM++;
        }
        let minutoGolV = Math.floor(Math.random()*89)+1;
        if (Math.random() < (forcaV / (forcaM + forcaV)) * 0.6) {
            let nA = sortearX1(visitante, minutoGolV, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
            linhaTempo.push({ minuto: minutoGolV, tipo: 'gol_v', texto: `⚽ GOL DO VISITANTE! ${nA} acha uma brecha na zaga e manda pro fundo da rede!` });
            golsV++;
        }
    }

    for(let i=0; i<16; i++) {
        let minAleatorio = Math.floor(Math.random()*89)+1;
        if (minAleatorio === 45) minAleatorio = 46;

        let isM = Math.random() > 0.5;
        let tAtq = isM? mandante : visitante;
        let tDef = isM? visitante : mandante;

        let atk = sortearX1(tAtq, minAleatorio, ["Atacante", "Ponta", "Centroavante"]).nome.split(" ")[0];
        let mei = sortearX1(tAtq, minAleatorio, ["Meia", "Volante"]).nome.split(" ")[0];
        let zag = sortearX1(tDef, minAleatorio, ["Zagueiro", "Lateral", "Volante"]).nome.split(" ")[0];
        let gol = sortearX1(tDef, minAleatorio, ["Goleiro"]).nome.split(" ")[0];

        let frases = [
            `UHHH! ${mei} deu um passe açucarado para ${atk}, que chutou raspando a trave!`,
            `Bela jogada! ${atk} tentou a finta, mas ${zag} fez um desarme cirúrgico!`,
            `Troca de passes envolvente. ${mei} dita o ritmo.`,
            `Cruzamento venenoso na área, ${atk} cabeceia e o goleiro ${gol} salva!`,
            `PERIGO! ${atk} arranca com velocidade, mas o chute vai para fora.`,
            `MILAGRE! ${atk} finaliza à queima-roupa e ${gol} salva com as pontas dos dedos!`,
            `Chuteira calibrada! ${mei} arrisca de longe, a bola passa assustando!`,
            `Falta de ${zag} em cima de ${atk}. O juiz marca a infração.`
        ];
        linhaTempo.push({ minuto: minAleatorio, tipo: isM ? 'ataque_m' : 'ataque_v', texto: frases[Math.floor(Math.random()*frases.length)] });
    }

    linhaTempo.push({ minuto: 1, tipo: 'inicio', texto: `🟢 APITA O ÁRBITRO! Começa o duelo na Arena X1!` });
    if (!linhaTempo.some(l => l.minuto === 45 && (l.tipo === 'gol_m' || l.tipo === 'gol_v'))) {
        linhaTempo.push({ minuto: 45, tipo: 'intervalo', texto: `⏱️ Fim do Primeiro Tempo!` });
    }

    if (golsM === golsV) {
        linhaTempo.push({ minuto: 95, tipo: 'penaltis', texto: `⚖️ Fim do tempo normal! O duelo vai para os PÊNALTIS!` });
        if (Math.random() > 0.5) { golsM++; linhaTempo.push({ minuto: 99, tipo: 'gol_m', texto: `🏆 O MANDANTE VENCE A DISPUTA DE PÊNALTIS!` }); }
        else { golsV++; linhaTempo.push({ minuto: 99, tipo: 'gol_v', texto: `💀 O VISITANTE VENCE A DISPUTA DE PÊNALTIS!` }); }
    }
    linhaTempo.sort((a,b) => a.minuto - b.minuto);
    return { eventos: linhaTempo, golsM: golsM, golsV: golsV };
}

window.iniciarTransmissaoX1 = async function(id) {
    let snap = await db.ref(`ligas/${ligaLogada}/x1_desafios/${id}`).once('value');
    let d = snap.val();
    if(!d) return mostrarAvisoEleganteDash("Desafio não existe mais.", "#dc3545", "🗑️");

    // 🟢 MÁGICA DA LIXEIRA: Grava no Firebase que você (usuário atual) já deu play nesta reprise!
    db.ref(`ligas/${ligaLogada}/x1_desafios/${id}/visto_${userLogado}`).set(true);

    let meuTime = dadosUsuario.timeAtual;
    let isDesafiante = (d.desafiante === meuTime);
    let mandante = d.desafiante;
    let visitante = d.desafiado;

    // QUEM CLICAR PRIMEIRO NO BOTÃO "INICIAR" GERA O JOGO E SALVA NA NUVEM!
    if (d.status === 'aceito') {
        document.getElementById('modal-arena-x1').innerHTML = `<h2 style="color:white; text-align:center; margin-top:50px;">Conectando satélite e calculando variáveis P2P...</h2>`;

        let forcaM = arenaDadosGlobais.times[mandante]?.forca_base || 500;
        let forcaV = arenaDadosGlobais.times[visitante]?.forca_base || 500;

        // --- INÍCIO DA GERAÇÃO DE LANCES DO X1 (Humano vs Humano) ---
        let linhaTempoX1 = [];
        let golsM = 0; let golsV = 0;

        const sortearX1 = (tId, arg2, arg3) => {
            let posicoes = Array.isArray(arg2) ? arg2 : (Array.isArray(arg3) ? arg3 : null);

            let el = arenaDadosGlobais.times[tId]?.jogadores ? Object.values(arenaDadosGlobais.times[tId].jogadores) : [];
            if(posicoes) {
                let filt = el.filter(j => j.posicoes && posicoes.includes(j.posicoes.p));
                if(filt.length > 0) return filt[Math.floor(Math.random() * filt.length)];
            }
            return el.length ? el[Math.floor(Math.random() * el.length)] : {nome: "Jogador"};
        };

        for(let i=0; i<5; i++) {
            let minutoGolM = Math.floor(Math.random()*89)+1;
            if (Math.random() < (forcaM / (forcaM + forcaV)) * 0.6) {
                let nA = sortearX1(mandante, minutoGolM, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
                linhaTempoX1.push({ minuto: minutoGolM, tipo: 'gol_m', texto: `⚽ GOOOL! Golaço espetacular de ${nA}! A Arena vai à loucura!` });
                golsM++;
            }
            let minutoGolV = Math.floor(Math.random()*89)+1;
            if (Math.random() < (forcaV / (forcaM + forcaV)) * 0.6) {
                let nA = sortearX1(visitante, minutoGolV, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
                linhaTempoX1.push({ minuto: minutoGolV, tipo: 'gol_v', texto: `⚽ GOL DO VISITANTE! ${nA} acha uma brecha na zaga e manda pro fundo da rede!` });
                golsV++;
            }
        }

        for(let i=0; i<16; i++) {
            let minAleatorio = Math.floor(Math.random()*89)+1;
            if (minAleatorio === 45) minAleatorio = 46;

            let isM = Math.random() > 0.5;
            let tAtq = isM? mandante : visitante;
            let tDef = isM? visitante : mandante;

            let atk = sortearX1(tAtq, minAleatorio, ["Atacante", "Ponta", "Centroavante"]).nome.split(" ")[0];
            let mei = sortearX1(tAtq, minAleatorio, ["Meia", "Volante"]).nome.split(" ")[0];
            let zag = sortearX1(tDef, minAleatorio, ["Zagueiro", "Lateral", "Volante"]).nome.split(" ")[0];
            let gol = sortearX1(tDef, minAleatorio, ["Goleiro"]).nome.split(" ")[0];

            let frases = [
                `UHHH! ${mei} deu um passe açucarado para ${atk}, que chutou raspando a trave!`,
                `Bela jogada! ${atk} tentou a finta, mas ${zag} fez um desarme cirúrgico!`,
                `Troca de passes envolvente. ${mei} dita o ritmo.`,
                `Cruzamento venenoso na área, ${atk} cabeceia e o goleiro ${gol} salva!`,
                `PERIGO! ${atk} arranca com velocidade, mas o chute vai para fora.`,
                `MILAGRE! ${atk} finaliza à queima-roupa e ${gol} salva com as pontas dos dedos!`,
                `Chuteira calibrada! ${mei} arrisca de longe, a bola passa assustando!`,
                `Falta de ${zag} em cima de ${atk}. O juiz marca a infração.`
            ];
            linhaTempoX1.push({ minuto: minAleatorio, tipo: isM ? 'ataque_m' : 'ataque_v', texto: frases[Math.floor(Math.random()*frases.length)] });
        }

        linhaTempoX1.push({ minuto: 1, tipo: 'inicio', texto: `🟢 APITA O ÁRBITRO! Começa o duelo na Arena X1!` });
        if (!linhaTempoX1.some(l => l.minuto === 45 && (l.tipo === 'gol_m' || l.tipo === 'gol_v'))) {
            linhaTempoX1.push({ minuto: 45, tipo: 'intervalo', texto: `⏱️ Fim do Primeiro Tempo!` });
        }

        if (golsM === golsV) {
            linhaTempoX1.push({ minuto: 95, tipo: 'penaltis', texto: `⚖️ Fim do tempo normal! O duelo vai para os PÊNALTIS!` });
            if (Math.random() > 0.5) { golsM++; linhaTempoX1.push({ minuto: 99, tipo: 'gol_m', texto: `🏆 O MANDANTE VENCE A DISPUTA DE PÊNALTIS!` }); }
            else { golsV++; linhaTempoX1.push({ minuto: 99, tipo: 'gol_v', texto: `💀 O VISITANTE VENCE A DISPUTA DE PÊNALTIS!` }); }
        }
        linhaTempoX1.sort((a,b) => a.minuto - b.minuto);
        // --- FIM DA GERAÇÃO DE LANCES ---

        d.linhaDoTempo = linhaTempoX1;
        d.golsM = golsM;
        d.golsV = golsV;
        d.status = 'finalizado';

        let updates = {};
        updates[`ligas/${ligaLogada}/x1_desafios/${id}`] = d; // Salva o jogo finalizado para o outro player ver a reprise

        let vitoriaMandante = d.golsM > d.golsV;
        let loginM = Object.keys(arenaDadosGlobais.usuarios).find(k => arenaDadosGlobais.usuarios[k].timeAtual === mandante);
        let loginV = Object.keys(arenaDadosGlobais.usuarios).find(k => arenaDadosGlobais.usuarios[k].timeAtual === visitante);

        let cxM = arenaDadosGlobais.usuarios[loginM]?.caixaClube || 0;
        let cxV = arenaDadosGlobais.usuarios[loginV]?.caixaClube || 0;
        let taxaCobrada = 5000;

        // Executa o pagamento e as transferências na nuvem apenas 1 vez (Quem gerar o jogo processa)
        if (d.tipo === 'dinheiro') {
            if (vitoriaMandante) {
                if(loginM) updates[`ligas/${ligaLogada}/usuarios/${loginM}/caixaClube`] = cxM + d.valor - taxaCobrada;
                if(loginV) updates[`ligas/${ligaLogada}/usuarios/${loginV}/caixaClube`] = cxV - d.valor - taxaCobrada;
            } else {
                if(loginM) updates[`ligas/${ligaLogada}/usuarios/${loginM}/caixaClube`] = cxM - d.valor - taxaCobrada;
                if(loginV) updates[`ligas/${ligaLogada}/usuarios/${loginV}/caixaClube`] = cxV + d.valor - taxaCobrada;
            }
        } else {
            // Em aposta de jogador (Pink Slip), desconta só a taxa da arena
            if(loginM) updates[`ligas/${ligaLogada}/usuarios/${loginM}/caixaClube`] = cxM - taxaCobrada;
            if(loginV) updates[`ligas/${ligaLogada}/usuarios/${loginV}/caixaClube`] = cxV - taxaCobrada;

            if (vitoriaMandante) {
                updates[`banco_global_times/${visitante}/jogadores/${d.id_adv}`] = null;
                updates[`banco_global_times/${mandante}/jogadores/${d.id_adv}`] = d.dados_adv;
            } else {
                updates[`banco_global_times/${mandante}/jogadores/${d.id_meu}`] = null;
                updates[`banco_global_times/${visitante}/jogadores/${d.id_meu}`] = d.dados_meu;
            }
        }
        await db.ref().update(updates);
    }

    let empate = (d.golsM === d.golsV);
    let isVitoriaMinha = isDesafiante? (d.golsM > d.golsV) : (d.golsV > d.golsM);
    let txtFim = "";

    if (empate) {
        txtFim = `EMPATE! A aposta foi anulada, mas a Arena cobrou R$ 10.000 de taxa dupla do seu caixa. Ninguém ganha Ticket.`;
    } else {
        if (isVitoriaMinha) {
            // GANHOU X1 - GANHA 1 TICKET DE LIBERAÇÃO (só se ganhar, empate não ganha)
            db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/tickets_liberacao`).transaction(t=> (t||0)+1);
        }
        if (d.tipo === 'dinheiro') {
            txtFim = isVitoriaMinha ? `Você faturou ${formatarDinheiro(d.valor)} do oponente! (Taxa da Arena: R$ 5.000)` : `Você perdeu ${formatarDinheiro(d.valor)} na aposta. (Taxa da Arena: R$ 5.000)`;
        } else {
            let nomeGanho = isDesafiante ? d.dados_adv.nome : d.dados_meu.nome;
            let nomePerdido = isDesafiante ? d.dados_meu.nome : d.dados_adv.nome;
            txtFim = isVitoriaMinha ? `O passe de ${nomeGanho} agora é seu! (Taxa da Arena: R$ 5.000)` : `Adeus! Seu jogador ${nomePerdido} fez as malas. (Taxa da Arena: R$ 5.000)`;
        }
    }

    // Toca a transmissão! (O isIADuel aqui vai como false, pois a DB já foi atualizada acima).
    reproduzirTransmissaoX1(mandante, visitante, d.linhaDoTempo, d.golsM, d.golsV, isVitoriaMinha, txtFim, false, {});
};

function reproduzirTransmissaoX1(mandante, visitante, linhaTempo, golsM_final, golsV_final, venci, txtFim, isIADuel, apostaValidadaIA) {
    let modal = document.getElementById('modal-arena-x1');

    modal.style.backgroundColor = "#000";
    // 🟢 Gradiente clareado também na Arena X1!
    modal.style.backgroundImage = `linear-gradient(rgba(10,10,10,0.40), rgba(10,10,10,0.70)), url('${getEstadio(mandante)}')`;
    modal.style.backgroundPosition = "center";
    modal.style.backgroundSize = "cover";

    modal.innerHTML = `
        <div style="width:90%; max-width:600px; border-radius:12px; border:2px solid rgba(255,140,0,0.5); padding:20px; text-align:center; box-shadow: 0 0 40px rgba(0,0,0,0.8); background: rgba(0,0,0,0.6); backdrop-filter: blur(5px);">
            <h2 style="color:#ff8c00; margin-top:0; text-shadow: 2px 2px 4px #000;">🔴 TRANSMISSÃO AO VIVO</h2>

            <div style="display:flex; justify-content:space-between; align-items:center; background:linear-gradient(180deg, #111, #000); padding:15px; border-radius:8px; border:1px solid #333; margin-bottom:15px; box-shadow: inset 0 2px 10px rgba(255,255,255,0.05);">
                <div style="flex:1; text-align:right; font-weight:bold; color:var(--verde-campo); font-size:15px; text-shadow: 1px 1px 2px #000; min-width: 0;">
                    <div style="display:flex; justify-content:flex-end; align-items:center; gap:6px;">
                        <div style="display:flex; flex-direction:column; line-height:1.2;">
                            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${mandante.replace(/_/g, ' ')}</span>
                            <span style="font-size:10px; color:#ff8c00; margin-top:2px;">${window.treinadoresGlobais && window.treinadoresGlobais[mandante] ? '👤 ' + window.treinadoresGlobais[mandante] : '🤖 IA'}</span>
                        </div>
                        <img src="${getEscudo(mandante)}" onerror="this.src='esculdos/default.png'" style="width:30px; height:30px; object-fit:contain; flex-shrink:0;">
                    </div>
                    <div id="x1-placar-m" style="font-size:36px; margin-top:5px; line-height:1;">0</div>
                </div>

                <div style="display:flex; flex-direction:column; align-items:center; margin: 0 10px; flex-shrink:0;">
                    <div style="width:60px; font-size:22px; color:#aaa; font-weight:bold; background:#222; padding:5px; border-radius:6px; border:1px solid #444; margin-bottom:5px;">
                        <span id="x1-relogio">0'</span>
                    </div>
                    <div style="display:flex; gap:3px;">
                        <button onclick="mudarVelocidadeSimulacao(1)" id="btn-vel-1" style="background:var(--verde-campo); color:#fff; border:none; border-radius:3px; font-size:10px; cursor:pointer; padding:2px 5px;">1x</button>
                        <button onclick="mudarVelocidadeSimulacao(2)" id="btn-vel-2" style="background:#333; color:#fff; border:none; border-radius:3px; font-size:10px; cursor:pointer; padding:2px 5px;">2x</button>
                        <button onclick="mudarVelocidadeSimulacao(3)" id="btn-vel-3" style="background:#333; color:#fff; border:none; border-radius:3px; font-size:10px; cursor:pointer; padding:2px 5px;">3x</button>
                    </div>
                </div>

                <div style="flex:1; text-align:left; font-weight:bold; color:#dc3545; font-size:15px; text-shadow: 1px 1px 2px #000; min-width: 0;">
                    <div style="display:flex; justify-content:flex-start; align-items:center; gap:6px;">
                        <img src="${getEscudo(visitante)}" onerror="this.src='esculdos/default.png'" style="width:30px; height:30px; object-fit:contain; flex-shrink:0;">
                        <div style="display:flex; flex-direction:column; line-height:1.2;">
                            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${visitante.replace(/_/g, ' ')}</span>
                            <span style="font-size:10px; color:#ff8c00; margin-top:2px;">${window.treinadoresGlobais && window.treinadoresGlobais[visitante] ? '👤 ' + window.treinadoresGlobais[visitante] : '🤖 IA'}</span>
                        </div>
                    </div>
                    <div id="x1-placar-v" style="font-size:36px; margin-top:5px; line-height:1;">0</div>
                </div>
            </div>

            <div id="x1-lances" style="background:rgba(0,0,0,0.7); border:1px solid #333; border-radius:8px; padding:15px; height:180px; overflow-y:auto; font-size:14px; text-align:left; color:#ccc; scroll-behavior: smooth;">
                <div style="color:#888;">📡 Conectando satélite ao estádio...</div>
            </div>
        </div>
    `;

    // 🔊 DINÂMICA DE ÁUDIO DUPLO (Casa vs Fora)
    window.x1Audios.torcidaM.src = getTorcida(mandante);
    window.x1Audios.torcidaV.src = getTorcida(visitante);
    window.x1Audios.gol.src = 'sounds/gol_generico.mp3';
    window.x1Audios.fim.src = 'sounds/final_do_jogo.mp3';
    window.x1Audios.apito.src = 'sounds/apito_arbitro.mp3';

    window.x1Audios.torcidaM.loop = true; window.x1Audios.torcidaV.loop = true;
    window.x1Audios.torcidaM.play().catch(()=>{}); window.x1Audios.torcidaV.play().catch(()=>{});

    let somTorcidaM = window.x1Audios.torcidaM;
    let somTorcidaV = window.x1Audios.torcidaV;
    let somGol = window.x1Audios.gol;
    let somApito = window.x1Audios.apito;
    let somFim = window.x1Audios.fim;
    let canalHino = window.x1Audios.hino; // Unificado

    let minutoAtual = 0;
    let placarM_tela = 0; let placarV_tela = 0;
    let divLances = document.getElementById('x1-lances');
    let relogio = document.getElementById('x1-relogio');

    let filaNarracao = [];
    let narradorOcupado = false;

    // 🧠 INTELIGÊNCIA DE VOLUME (Guerra de Torcidas)
    function atualizarTorcidas() {
        if (placarM_tela > placarV_tela) { somTorcidaM.volume = 0.5; somTorcidaV.volume = 0.1; } // Casa ganhando
        else if (placarV_tela > placarM_tela) { somTorcidaM.volume = 0.1; somTorcidaV.volume = 0.5; } // Fora ganhando
        else { somTorcidaM.volume = 0.4; somTorcidaV.volume = 0.2; } // Empate (Leve vantagem pra Casa)
    }
    atualizarTorcidas();

    function narrarProximoLance() {
        if (narradorOcupado || filaNarracao.length === 0) return;
        let lance = filaNarracao.shift();
        narradorOcupado = true;

        let cor = '#ccc';
        if (lance.tipo.includes('ataque_m')) cor = 'var(--verde-campo)';
        if (lance.tipo.includes('ataque_v')) cor = '#ffc107';
        if (lance.tipo.includes('gol_m')) cor = 'var(--verde-campo)';
        if (lance.tipo.includes('gol_v')) cor = '#dc3545';
        if (lance.tipo === 'penaltis') cor = '#ff8c00';
        if (lance.tipo === 'intervalo' || lance.tipo === 'inicio') cor = '#007bff';

        divLances.innerHTML += `<div style="margin-top:10px; border-bottom:1px dashed #333; padding-bottom:8px;"><strong style="color:${cor}; font-size:15px;">${lance.minuto}'</strong> <span style="margin-left:5px; color:${lance.tipo.includes('gol') ? '#fff' : '#ccc'}; font-weight:${lance.tipo.includes('gol') ? 'bold' : 'normal'};">${lance.texto}</span></div>`;
        divLances.scrollTop = divLances.scrollHeight;

        let velo = window.velocidadeSimulacao || 1;

        if (velo === 1 && lance.tipo === 'inicio') somApito.play().catch(()=>{});

        // ⚽ GOL MANDANTE
        if (lance.tipo === 'gol_m') {
            placarM_tela++; document.getElementById('x1-placar-m').innerText = placarM_tela;
            if (velo === 1) {
                somTorcidaM.volume = 1.0; somTorcidaV.volume = 0.0;
                somGol.play().catch(()=>{});
                window.mostrarLetreiroGol(mandante); // ✨ Chama o Letreiro Gigante!
                setTimeout(() => { canalHino.src = getHino(mandante); canalHino.volume = 0.4; canalHino.play().catch(()=>{}); }, 1500);
                setTimeout(() => { canalHino.pause(); canalHino.currentTime = 0; atualizarTorcidas(); narradorOcupado = false; }, 12000);
            } else {
                setTimeout(() => { narradorOcupado = false; }, 400 / velo); // ⚡ Rápido e mudo
            }
        }
        // ⚽ GOL VISITANTE
        else if (lance.tipo === 'gol_v') {
            placarV_tela++; document.getElementById('x1-placar-v').innerText = placarV_tela;
            if (velo === 1) {
                somTorcidaM.volume = 0.0; somTorcidaV.volume = 1.0;
                somGol.play().catch(()=>{});
                window.mostrarLetreiroGol(visitante); // ✨ Chama o Letreiro Gigante!
                setTimeout(() => { canalHino.src = getHino(visitante); canalHino.volume = 0.3; canalHino.play().catch(()=>{}); }, 1500);
                setTimeout(() => { canalHino.pause(); canalHino.currentTime = 0; atualizarTorcidas(); narradorOcupado = false; }, 12000);
            } else {
                setTimeout(() => { narradorOcupado = false; }, 400 / velo); // ⚡ Rápido e mudo
            }
        }
        // LANCES NORMAIS (Ataque, Pênalti, Fim)
        else {
            if (velo === 1) {
                if (lance.tipo === 'ataque_m') { somTorcidaM.volume = 0.8; }
                if (lance.tipo === 'ataque_v') { somTorcidaV.volume = 0.8; }
                setTimeout(() => { atualizarTorcidas(); narradorOcupado = false; }, 3500);
            } else {
                setTimeout(() => { narradorOcupado = false; }, 400 / velo); // ⚡ Rápido e mudo
            }
        }
    }

    // ⌚ LOOP DO CRONÔMETRO DINÂMICO
    window.velocidadeSimulacao = 1;

    async function tickRelogioX1() {
        if (!document.getElementById('x1-lances')) return; // Aborta se modal fechar

        narrarProximoLance();
        let velo = window.velocidadeSimulacao || 1;

        if (narradorOcupado) {
            setTimeout(tickRelogioX1, velo === 1 ? 1000 : 200 / velo);
            return;
        }

        minutoAtual++;

        if (minutoAtual === 46 && velo === 1) { somTorcidaM.volume = 0.1; somTorcidaV.volume = 0.1; }
        else if (minutoAtual === 47) {
            if (velo === 1) atualizarTorcidas();
            divLances.innerHTML += `<div style="margin-top:8px; border-bottom:1px solid #222; padding-bottom:5px; color:#aaa;">🟢 Rola a bola para o segundo tempo!</div>`;
        }

        if (minutoAtual <= 90 || minutoAtual === 95 || minutoAtual === 99) {
            if (relogio) relogio.innerText = minutoAtual + "'";
        }

        let lancesAgora = linhaTempo.filter(l => l.minuto === minutoAtual);
        if (lancesAgora.length > 0) filaNarracao.push(...lancesAgora);

        // 🏁 FIM DE JOGO
        if (minutoAtual > 99 || (minutoAtual >= 90 && golsM_final !== golsV_final && !linhaTempo.some(l => l.minuto > minutoAtual))) {
            if (velo === 1) {
                somTorcidaM.pause(); somTorcidaV.pause();
                canalHino.pause(); canalHino.currentTime = 0;
                somFim.play().catch(()=>{});
            }

            if (relogio) { relogio.innerText = "FIM"; relogio.style.color = "#ff8c00"; }

            let empateFim = (golsM_final === golsV_final);

            if (velo === 1 && !empateFim) {
                setTimeout(() => {
                    let campeao = (golsM_final > golsV_final) ? mandante : visitante;
                    canalHino.src = getHino(campeao);
                    canalHino.currentTime = 0; canalHino.volume = 0.2; canalHino.loop = true;
                    canalHino.play().catch(()=>{});
                }, 1500);
            }

            // Gravação no Banco (Para combates contra IA)
            if (isIADuel && apostaValidadaIA) {
                let updates = {};
                let taxaFinal = empateFim ? 10000 : (apostaValidadaIA.taxa || 5000);

                if (empateFim) {
                    updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = (dadosUsuario.caixaClube || 0) - taxaFinal;
                } else if (apostaValidadaIA.tipo === 'dinheiro') {
                    let v = apostaValidadaIA.valor;
                    if (venci) updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = (dadosUsuario.caixaClube || 0) + v - taxaFinal;
                    else updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = (dadosUsuario.caixaClube || 0) - v - taxaFinal;
                    // Vitória contra IA também dá ticket
                    if (venci) updates[`ligas/${ligaLogada}/usuarios/${userLogado}/tickets_liberacao`] = (dadosUsuario.tickets_liberacao||0)+1;
                } else {
                    updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = (dadosUsuario.caixaClube || 0) - taxaFinal;
                    if (venci) {
                        updates[`banco_global_times/${visitante}/jogadores/${apostaValidadaIA.id_adv}`] = null;
                        updates[`banco_global_times/${mandante}/jogadores/${apostaValidadaIA.id_adv}`] = apostaValidadaIA.dados_adv;
                    } else {
                        updates[`banco_global_times/${mandante}/jogadores/${apostaValidadaIA.id_meu}`] = null;
                        updates[`banco_global_times/${visitante}/jogadores/${apostaValidadaIA.id_meu}`] = apostaValidadaIA.dados_meu;
                    }
                    // Vitória contra IA também dá ticket
                    if (venci) updates[`ligas/${ligaLogada}/usuarios/${userLogado}/tickets_liberacao`] = (dadosUsuario.tickets_liberacao||0)+1;
                }
                await db.ref().update(updates);
            }

            let corBg = empateFim ? 'rgba(255,140,0,0.3)' : (venci ? 'rgba(0,184,83,0.3)' : 'rgba(220,53,69,0.3)');
            let corBorda = empateFim ? '#ff8c00' : (venci ? 'var(--verde-campo)' : '#dc3545');
            let tituloFim = empateFim ? '⚖️ EMPATE!' : (venci ? '🏆 VITÓRIA!' : '💀 DERROTA!');

            modal.style.flexDirection = "column";
            modal.insertAdjacentHTML('beforeend', `
                <div style="width:90%; max-width:600px; margin-top:15px; padding:15px; background:${corBg}; border:2px solid ${corBorda}; border-radius:8px; box-shadow: 0 0 20px ${corBg.replace('0.3', '0.5')}; backdrop-filter: blur(10px); text-align:center;">
                    <h3 style="color:#fff; margin:0; text-shadow: 1px 1px 3px #000;">${tituloFim}</h3>
                    <p style="color:#ddd; font-size:15px; font-weight:bold;">${txtFim}</p>
                    <button onclick="window.location.reload()" style="padding:12px 25px; background:#fff; color:#000; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:5px; font-size:16px;">Retornar ao Dashboard</button>
                </div>
            `);
            return; // Termina o loop
        }

        setTimeout(tickRelogioX1, velo === 1 ? 1000 : 200 / velo);
    }

    tickRelogioX1(); // Dá a partida no relógio!
}

// FUNÇÃO GLOBAL DE CONTROLE DE VELOCIDADE
window.mudarVelocidadeSimulacao = function(v) {
    window.velocidadeSimulacao = v;
    if(document.getElementById('btn-vel-1')) document.getElementById('btn-vel-1').style.background = v === 1 ? 'var(--verde-campo)' : '#333';
    if(document.getElementById('btn-vel-2')) document.getElementById('btn-vel-2').style.background = v === 2 ? 'var(--verde-campo)' : '#333';
    if(document.getElementById('btn-vel-3')) document.getElementById('btn-vel-3').style.background = v === 3 ? 'var(--verde-campo)' : '#333';

    // Corta os audios se o usuário for impaciente
    if (v > 1 && window.x1Audios) {
        window.x1Audios.torcidaM.volume = 0;
        window.x1Audios.torcidaV.volume = 0;
    }
};

// ========================================================
// 🛡️ SISTEMA DE TREINO SIGILOSO (ANTI-OLHEIRO)
// ========================================================
window.ativarTreinoSigiloso = async function() {
    let cxConf = document.createElement('div');
    cxConf.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
    cxConf.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:2px solid #800080; padding:20px; box-shadow:0 10px 40px rgba(128,0,128,0.3); text-align:center;">
            <div style="font-size:40px; margin-bottom:10px;">🛡️</div>
            <h3 style="color:#800080; margin-top:0;">Treino de Portões Fechados</h3>
            <p style="color:#ccc; font-size:14px; margin-bottom:15px;">Deseja ativar o Treino Sigiloso para bloquear olheiros adversários?</p>
            <div style="background:#111; border:1px dashed #444; padding:10px; border-radius:6px; margin-bottom:20px;">
                <span style="color:#888; font-size:12px;">Custo da Proteção:</span><br>
                <strong style="color:var(--verde-campo); font-size:18px;">R$ 100.000,00</strong>
                <div style="font-size:10px; color:#666; margin-top:5px;">(Vale para a próxima rodada simulada)</div>
            </div>
            <div style="display:flex; gap:10px;">
                <button id="btn-confirma-escudo" style="flex:1; padding:12px; background:#800080; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Sim, Ativar</button>
                <button id="btn-cancela-escudo" style="flex:1; padding:12px; background:#333; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Não, Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(cxConf);

    document.getElementById('btn-cancela-escudo').onclick = () => cxConf.remove();
    document.getElementById('btn-confirma-escudo').onclick = async () => {
        cxConf.remove();
        try {
            const snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
            let u = snapUser.val();

            if(u.caixaClube < 100000) {
                return mostrarAvisoEleganteDash("Você não tem R$ 100.000 em caixa para fechar os portões do CT!", "#dc3545", "💸");
            }

            const snapCal = await db.ref(`ligas/${ligaLogada}/calendario`).once('value');
            let cal = snapCal.val() || {};
            let rodadaAlvo = cal.rodadaAtual || 1;

            // Se já passou das 19h, a proteção vale para o jogo do dia seguinte
            if (new Date().getHours() >= 19) rodadaAlvo += 1;

            if (u.escudo_rodada && u.escudo_rodada.rodada === rodadaAlvo && u.escudo_rodada.ativo) {
                return mostrarAvisoEleganteDash("O seu CT já está com os portões fechados para esta rodada!", "#ff8c00", "🛡️");
            }

            let novoCaixa = u.caixaClube - 100000;
            await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
                caixaClube: novoCaixa,
                escudo_rodada: { rodada: rodadaAlvo, ativo: true }
            });

            // Atualiza o saldo instantaneamente na interface!
            let saldoElem = document.getElementById('saldo-treinador');
            if (saldoElem) {
                saldoElem.innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(novoCaixa);
            }

            mostrarAvisoEleganteDash("Portões trancados! Seu treinamento está em sigilo absoluto para a Rodada " + rodadaAlvo + ".<br><br>(- R$ 100.000)", "#800080", "🔒");
        } catch(e) {
            console.error(e);
            mostrarAvisoEleganteDash("Ocorreu um erro ao comunicar com o servidor.", "#dc3545", "🔌");
        }
    };
};

window.mudarAbaCT = function(aba){
  document.getElementById('area-ct').style.display = aba==='treino'?'flex':'none';
  document.getElementById('area-fisio').style.display = aba==='fisio'?'flex':'none';
  document.getElementById('aba-ct-btn').style.background = aba==='treino'?'#007bff':'#222';
  document.getElementById('aba-ct-btn').style.color = aba==='treino'?'#fff':'#888';
  document.getElementById('aba-fisio-btn').style.background = aba==='fisio'?'#00b853':'#222';
  document.getElementById('aba-fisio-btn').style.color = aba==='fisio'?'#fff':'#888';
  if(aba==='fisio') carregarFisioterapiaDashboard();
};

async function carregarFisioterapiaDashboard(){
  let area = document.getElementById('area-fisio');
  if(!area) return;
  let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
  let eu = snapUser.val()||{};
  let nivel = eu.fisioterapia_nivel||0;
  let cfg = window.fisioConfig[nivel]||{slots:0, tempo:0};
  let slots = eu.fisioterapia_slots||[];
  let snapTime = await db.ref(`banco_global_times/${eu.timeAtual}/jogadores`).once('value');
  let elenco = snapTime.val()||{};
  let fadigados = Object.keys(elenco).filter(id=>(elenco[id].fadiga||0)>0).length;

  area.innerHTML = `
    <div style="display:flex; justify-content:space-between; font-size:12px; color:#ccc; margin-bottom:8px;">
      <span>Nível ${nivel} | ${slots.length}/${cfg.slots} ocupados | ${fadigados} fadigados</span>
      <span style="color:#00b853; cursor:pointer; font-weight:bold;" onclick="abrirModalFisioterapia()">Gerenciar →</span>
    </div>
    <div style="display:flex; gap:5px;">
      <button onclick="abrirModalFisioterapia()" style="flex:1; padding:8px; background:#00b853; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">🏥 Abrir Departamento</button>
    </div>
  `;
}


// ========================================================
// 👁️ SISTEMA DE OLHEIRO (ESPIONAGEM ADVERSÁRIA)
// ========================================================
window.espionarAdversario = async function(timeAlvoId) {
    try {
        const snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
        let eu = snapUser.val();

        const snapCal = await db.ref(`ligas/${ligaLogada}/calendario`).once('value');
        let cal = snapCal.val() || {};
        let rodadaAtual = cal.rodadaAtual || 1;

        // Se já passou das 19h, a espionagem cobra na cota da próxima rodada
        let rodadaCobranca = (new Date().getHours() >= 19) ? rodadaAtual + 1 : rodadaAtual;

        // Calcula o custo (Dobra a cada uso na mesma rodada)
        let olheiroData = eu.uso_olheiro || { rodada: 0, qtd: 0 };
        if (olheiroData.rodada !== rodadaCobranca) {
            olheiroData = { rodada: rodadaCobranca, qtd: 0 };
        }

        let custo = 50000 * Math.pow(2, olheiroData.qtd);

        if(!confirm(`🕵️‍♂️ Enviar Olheiro ao ${timeAlvoId.replace(/_/g, ' ')}?\n\nCusto desta missão: R$ ${formatarDinheiro(custo)}\n(O valor dobra a cada espionagem feita no mesmo dia).`)) return;

        if(eu.caixaClube < custo) return alert(`Caixa insuficiente! Você precisa de ${formatarDinheiro(custo)} para pagar o olheiro.`);

        // 1. Cobra o valor do Caixa
        let novoCaixa = eu.caixaClube - custo;
        olheiroData.qtd += 1;
        await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
            caixaClube: novoCaixa,
            uso_olheiro: olheiroData
        });

        // 2. Tenta Invadir o Sistema do Alvo
        const snapAllUsers = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
        const usuariosGeral = snapAllUsers.val() || {};
        const snapTimes = await db.ref('banco_global_times').once('value');
        const timesGerais = snapTimes.val() || {};

        let donoAlvoObj = null;
        let isIA = true;

        for(let u in usuariosGeral) {
            if(usuariosGeral[u].timeAtual === timeAlvoId) {
                donoAlvoObj = usuariosGeral[u];
                isIA = u.startsWith("IA_");
                break;
            }
        }

        // Verifica o Escudo do adversário
        if (!isIA && donoAlvoObj && donoAlvoObj.escudo_rodada && donoAlvoObj.escudo_rodada.rodada === rodadaCobranca && donoAlvoObj.escudo_rodada.ativo) {
            return alert(`🚨 MISSÃO FRACASSADA!\n\nO técnico do ${timeAlvoId.replace(/_/g, ' ')} ativou o Treino Sigiloso e fechou os portões do CT. Seu olheiro não conseguiu ver nada, mas o dinheiro da missão foi gasto.`);
        }

        // 3. Sucesso! Pega a Escalação
        let tatica = donoAlvoObj ? (donoAlvoObj.mentalidade || "Moderado") : "Moderado";
        let titularesIDs = donoAlvoObj ? (donoAlvoObj.titulares || []) : [];
        let timeDados = timesGerais[timeAlvoId]?.jogadores || {};

        // Se for IA, ela não tem array de titulares salvo, pega os 11 melhores na hora
        if (isIA || titularesIDs.length === 0) {
            let elencoCompleto = Object.values(timeDados).sort((a,b) => {
                let ovrA = (a.atributos.ataque+a.atributos.defesa+a.atributos.forca+a.atributos.velocidade+a.atributos.habilidade);
                let ovrB = (b.atributos.ataque+b.atributos.defesa+b.atributos.forca+b.atributos.velocidade+b.atributos.habilidade);
                return ovrB - ovrA;
            });
            titularesIDs = elencoCompleto.slice(0, 11);
        } else {
            // Mapeia os IDs reais para os objetos de jogador
            titularesIDs = titularesIDs.filter(id => id).map(id => timeDados[id]).filter(j => j);
        }

        let forcaTotal = 0;
        let htmlJogadores = "";

        titularesIDs.forEach(j => {
            let at = j.atributos || {ataque:0, defesa:0, forca:0, velocidade:0, habilidade:0};
            let ovr = Math.round((at.ataque+at.defesa+at.forca+at.velocidade+at.habilidade)/5);
            forcaTotal += (at.ataque+at.defesa+at.forca+at.velocidade+at.habilidade);
            let pos = j.posicoes ? j.posicoes.p.charAt(0) : "N";
            htmlJogadores += `<div style="display:flex; justify-content:space-between; border-bottom:1px dashed #333; padding:4px 0; font-size:13px;"><span><strong style="color:var(--verde-campo);">${pos}</strong> - ${j.nome}</span><strong style="color:#ff8c00;">${ovr}</strong></div>`;
        });

        // 4. Cria o Modal de Relatório
        let modal = document.createElement('div');
        modal.id = 'modal-relatorio-olheiro';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
        modal.innerHTML = `
            <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:2px solid #007bff; padding:20px; box-shadow:0 10px 40px rgba(0,123,255,0.3);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:10px; margin-bottom:15px;">
                    <h2 style="color:#007bff; margin:0; font-size:18px;">🕵️‍♂️ Dossiê Espião</h2>
                    <button onclick="document.getElementById('modal-relatorio-olheiro').remove()" style="background:transparent; border:none; color:#aaa; font-size:24px; cursor:pointer;">&times;</button>
                </div>

                <div style="text-align:center; margin-bottom:15px;">
                    <img src="${getEscudo(timeAlvoId)}" style="width:60px; height:60px; filter:drop-shadow(0 0 5px rgba(255,255,255,0.2));">
                    <h3 style="color:#fff; margin:5px 0 0 0;">${timeAlvoId.replace(/_/g, ' ')}</h3>
                </div>

                <div style="background:#111; padding:12px; border-radius:6px; border:1px solid #333; margin-bottom:15px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span style="color:#aaa;">Mentalidade:</span><strong style="color:#ff8c00;">${tatica}</strong></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#aaa;">Força Bruta do 11:</span><strong style="color:var(--verde-campo);">${forcaTotal}</strong></div>
                </div>

                <h4 style="color:#aaa; border-bottom:1px solid #333; padding-bottom:5px; margin-top:0;">📋 Equipe Titular Identificada</h4>
                <div style="max-height: 200px; overflow-y:auto; padding-right:5px;">
                    ${htmlJogadores || "<span style='color:#666;'>O clube não definiu os titulares.</span>"}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

    } catch(e) { console.error(e); }
};

// ========================================================
// 📖 MANUAL DO JOGO (INJEÇÃO NO MENU)
// ========================================================
window.addEventListener('DOMContentLoaded', () => {
    let sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        let btnSair = sidebar.querySelector('.btn-sair');
        let btnManual = document.createElement('button');
        btnManual.innerHTML = '📖 Manual do Técnico';
        btnManual.style.color = '#007bff';
        btnManual.onclick = abrirManualDoJogo;

        if(btnSair) sidebar.insertBefore(btnManual, btnSair);
        else sidebar.appendChild(btnManual);
    }
});

window.abrirManualDoJogo = function() {
    let modal = document.createElement('div');
    modal.id = 'modal-manual-jogo';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10005; display:flex; justify-content:center; align-items:center;";

    let style = `<style>
        .accordion-btn { background-color: #222; color: #fff; cursor: pointer; padding: 15px; width: 100%; text-align: left; border: none; outline: none; transition: 0.3s; font-size: 15px; font-weight: bold; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
        .accordion-btn:hover { background-color: #333; }
        .accordion-btn:after { content: '\\002B'; color: var(--verde-campo); font-weight: bold; margin-left: 5px; font-size: 18px; }
        .accordion-btn.active:after { content: '\\2212'; color: #ff8c00; }
        .accordion-panel { padding: 0 15px; background-color: #111; max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; color: #ccc; font-size: 14px; line-height: 1.6; }
        .accordion-panel p { margin: 15px 0; }
        .accordion-panel strong { color: #fff; }
    </style>`;

    modal.innerHTML = style + `
        <div style="background:#1a1a1a; width:95%; max-width:700px; height:85vh; border-radius:12px; border:1px solid #444; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,0.8);">
            <div style="padding:15px 20px; border-bottom:1px solid #333; background:#111; display:flex; justify-content:space-between; align-items:center; border-radius: 12px 12px 0 0;">
                <h2 style="color:#007bff; margin:0; font-size:18px;">📖 Manual do Treinador RDM</h2>
                <button onclick="document.getElementById('modal-manual-jogo').remove()" style="background:transparent; border:none; color:#aaa; font-size:26px; cursor:pointer;">&times;</button>
            </div>
            <div style="flex:1; overflow-y:auto; padding-bottom: 20px;">

                <button class="accordion-btn">🏟️ 1. Visão Geral & Horários Oficiais</button>
                <div class="accordion-panel">
                    <p>O jogo roda 100% descentralizado no Firebase. Todo dia:<br>
                    <strong>19h00</strong> → Campeonato (Série A/B) + Mercado (propostas vencem)<br>
                    <strong>20h00</strong> → Copa + Mundial<br>
                    <strong>06h00</strong> → Queda de Moral + Treino do CT + Fim de suspensão<br><br>
                    Se você não escalar, a IA escala automaticamente os 11 melhores OVR disponíveis (respeitando suspensos, CT e Agentes Livres).</p>
                </div>

                <button class="accordion-btn">📋 2. Escalação - Cada Plus Explicado</button>
                <div class="accordion-panel">
                    <p><strong>Formação:</strong> 4-3-3, 4-4-2, etc. Muda a distribuição de ATA/MEI/DEF/GOL no campo.<br><br>
                    <strong>Força do Time (OVR):</strong> Soma dos 5 atributos dos 11 titulares.<br>
                    - <strong>Ataque:</strong> Chance de fazer gol. Peso 3x pra Atacante.<br>
                    - <strong>Defesa:</strong> Evita gol. Peso 3x pra Zagueiro/Goleiro.<br>
                    - <strong>Força:</strong> Disputa física, escanteio, bola aérea.<br>
                    - <strong>Velocidade:</strong> Contra-ataque, drible.<br>
                    - <strong>Habilidade:</strong> Passe, assistência, pênalti.<br><br>
                    <strong>Improvisado:</strong> Se escalar Atacante na zaga, perde 30% da força (overall * 0.7).<br><br>
                    <strong>FADIGA:</strong> Cada jogo como titular = +1 fadiga (máx 35). Reserva = -0.5 por rodada. Fórmula: Força Real = Base * (1 - fadiga*0.015) mínimo 50%. Com 20 fadiga = -30% força!<br>
                    Na tabela você vê 🔋 verde 0-9, 🟡 amarela 10-19, 🔴 vermelha 20+ (precisa rotacionar).</p>
                </div>

                <button class="accordion-btn">🧠 3. Mentalidade + Estilo + Mando</button>
                <div class="accordion-panel">
                    <p><strong>Mentalidade:</strong><br>
                    ⚔️ Ofensivo: Ataque *1.25, Defesa *0.85. Ideal vs time fraco fechado.<br>
                    🛡️ Retranca: Ataque *0.85, Defesa *1.25. Quase não toma gol, mas faz 1 no máximo.<br>
                    ⚖️ Moderado: Ataque *1.05, Defesa *1.05. Padrão.<br><br>
                    <strong>Estilo:</strong><br>
                    Posse de Bola: Meio *1.3, Ataque *1.1<br>
                    Contra-Ataque: Ataque *1.2, Defesa *1.1, Meio *0.9<br>
                    Bola Longa: Ataque *1.15, Defesa *1.05<br><br>
                    <strong>Mando:</strong> Mandante ganha +10% em tudo (clima no relato).<br>
                    <strong>Moral:</strong> 0-100. Fórmula: mult = 0.7 + (moral/100)*0.6. Moral 50 = 100%, Moral 100 = 130% força.<br>
                    <strong>CT e Escudo:</strong> Se CT ativo +5%, Escudo ativo +8%.</p>
                </div>

                <button class="accordion-btn">🔄 4. Rotatividade, Fadiga e CT</button>
                <div class="accordion-panel">
                    <p><strong>Como funciona:</strong><br>
                    - Todo titular ganha +1 fadiga por jogo<br>
                    - Reserva perde -0.5 fadiga por jogo (recupera)<br>
                    - Fadiga 0-9 = 100% a 86% força (ok)<br>
                    - Fadiga 10-19 = 85% a 71% (amarelo, comece a poupar)<br>
                    - Fadiga 20-35 = 70% a 47% (vermelho, time morto)<br><br>
                    <strong>CT (Centro de Treinamento):</strong> Você coloca 1 jogador por vez. Ele não pode ser escalado enquanto treina. Ganha atributos por hora. Se estiver escalado, é removido automático.<br><br>
                    <strong>Dica Pro:</strong> Tenha 14-15 jogadores usáveis. Rode 2-3 por rodada pra manter fadiga abaixo de 12. Jogador com fadiga 25 é pior que reserva com 5.</p>
                </div>

                <button class="accordion-btn">🚫 5. Cartões, Suspensão e Agentes Livres</button>
                <div class="accordion-panel">
                    <p><strong>Cartão Amarelo:</strong> +1 por falta dura. Com 3 amarelos = suspenso 1 jogo automático e zera os amarelos.<br>
                    <strong>Vermelho Direto:</strong> Suspenso 2 jogos.<br>
                    <strong>Onde ver:</strong> Na escalação aparece 🟨🟨 e badge 3 AMARELOS 🚫 ou EXPULSO 🚫. Botão Escalar some.<br>
                    <strong>Agentes Livres:</strong> Se você mandar jogador pra Agentes Livres, ele NÃO pode ser escalado até voltar. Badge cinza Ag. Livres.<br>
                    <strong>Se já estava escalado:</strong> Motor remove automático e escala melhor reserva.</p>
                </div>

                <button class="accordion-btn">🏆 6. Classificação - O que conta?</button>
                <div class="accordion-panel">
                    <p>Tabela só conta Campeonato (Série A/B). Copa não conta.<br>
                    <strong>Artilharia e Assistência:</strong> Só gols_campeonato. Gols da Copa e X1 NÃO contam pro ranking.<br>
                    <strong>Bônus Ranking:</strong> Top 3 artilheiros, assistências e goleiros menos vazados ganham +ataque/habilidade/defesa temporário.<br>
                    Top1 +5 OVR, Top2 +4, Top3 +3, Top4 +2, Top5-10 +1. Dura até próxima rodada.</p>
                </div>

                <button class="accordion-btn">💼 7. Mercado e Diretoria IA</button>
                <div class="accordion-panel">
                    <p>Humano vs Humano = proposta direta.<br>
                    Humano vs IA = IA avalia valor de mercado + se é estrela (blinda). Pode pedir jogador na troca pra abater preço. Empréstimo exige taxa.<br>
                    <strong>Propostas:</strong> Vencem todo dia 19h. Se tiver 2+ propostas no mesmo jogador, vai pro leilão (quem paga mais leva).<br>
                    <strong>Agentes Livres:</strong> Jogadores liberados ficam aqui. Você pode contratar de graça se tiver caixa.</p>
                </div>

                <button class="accordion-btn">🏦 8. Finanças e Cofre</button>
                <div class="accordion-panel">
                    <p>Cofre = Banco Central com juros infinitos mas caros. Outros treinadores podem investir dinheiro no cofre e você pega empréstimo com juros menores (investidor real).<br>
                    Se não pagar dívida na data, penhora: justiça leva seus jogadores pra quitar.</p>
                </div>

                <button class="accordion-btn">🕵️‍♂️ 9. Olheiros e Treino Secreto</button>
                <div class="accordion-panel">
                    <p>👁️ Espiar custa R$ 50k na 1ª vez do dia, dobra a cada uso (100k, 200k...). Reseta no dia seguinte.<br>
                    Mostra tática, formação e 11 titulares do adversário + força total.<br>
                    🛡️ Treino Secreto = tranca CT. Olheiro paga e não vê nada.</p>
                </div>

                <button class="accordion-btn">⚔️ 10. Arena X1 - Tickets e Apostas</button>
                <div class="accordion-panel">
                    <p><strong>O que é:</strong> Desafio 1vs1 instantâneo, fora do calendário. Não conta pra tabela nem artilharia.<br>
                    <strong>Tickets:</strong> Você ganha 1 ticket cada vez que VENCE X1 (empate não ganha). Ticket = moeda pra enviar olheiro atrás de Lendas (custa 1 ticket + R$ 1M por 2h, ou 1 ticket + R$ 500k por 8h). Lendas vão pros Agentes Livres.<br>
                    <strong>Apostas:</strong><br>
                    - Dinheiro: R$ 5k de taxa da arena + valor apostado. Vencedor leva tudo.<br>
                    - Pink Slip (jogador): Aposta o passe de 1 jogador seu vs 1 do adversário. Se perder, perde o jogador. Valor dos jogadores não pode ter diferença absurda.<br>
                    <strong>IA:</strong> IA aceita X1 só se forças forem parecidas. Se você é muito forte e ela muito fraca, rejeita por medo.<br>
                    <strong>Transmissão:</strong> Jogo tem relato lance a lance, placar ao vivo e sons de torcida.</p>
                </div>

                <button class="accordion-btn">📅 11. Calendário e Rodadas</button>
                <div class="accordion-panel">
                    <p>Calendário mostra rodada atual, jogos já jogados (linha do tempo) e próximos. Rodada só avança após simulação das 19h/20h. Se motor travar, qualquer jogador online destrava (lock_simulacao).</p>
                </div>

                <button class="accordion-btn">👤 12. Pro Player e Pelada</button>
                <div class="accordion-panel">
                    <p>Pro Player = seu avatar. Outros treinadores avaliam seu OVR (média dos atributos_base). Quanto mais avaliações, mais preciso o OVR final.<br>
                    Pelada = Sorteio de times balanceados pelo OVR. Modo Snake: distribui melhor, depois pior, etc. para equilibrar coletes. Não interfere no campeonato.</p>
                </div>

            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Faz as abas expandirem
    let acc = modal.querySelectorAll(".accordion-btn");
    for (let i = 0; i < acc.length; i++) {
        acc[i].addEventListener("click", function() {
            this.classList.toggle("active");
            let panel = this.nextElementSibling;
            if (panel.style.maxHeight) {
                panel.style.maxHeight = null;
            } else {
                panel.style.maxHeight = panel.scrollHeight + "px";
            }
        });
    }
};

// ========================================================
// 🏥 DEPARTAMENTO DE FISIOTERAPIA - RECUPERAÇÃO DE FADIGA
// ========================================================
window.fisioConfig = {
  0: { slots: 0, tempo: 0, custo: 0, nome: "Sem Depto" },
  1: { slots: 1, tempo: 7200000, custo: 30000, nome: "Nível 1", upgradeTickets: 10, upgradeDinheiro: 0 }, // 2h = 7200000ms
  2: { slots: 2, tempo: 5400000, custo: 30000, nome: "Nível 2", upgradeTickets: 30, upgradeDinheiro: 500000 }, // 1h30 = 5400000ms
  3: { slots: 3, tempo: 2400000, custo: 30000, nome: "Nível 3", upgradeTickets: 100, upgradeDinheiro: 1000000 } // 40min = 2400000ms
};

window.abrirModalFisioterapia = async function(){
  let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
  let eu = snapUser.val()||{};
  let nivel = eu.fisioterapia_nivel||0;
  let cfg = window.fisioConfig[nivel]||window.fisioConfig[0];
  let cfgProx = window.fisioConfig[nivel+1];

  let snapTime = await db.ref(`banco_global_times/${eu.timeAtual}/jogadores`).once('value');
  let elenco = snapTime.val()||{};
  let listaFadigados = Object.keys(elenco).map(id=>({id,...elenco[id]})).filter(j=> (j.fadiga||0)>0).sort((a,b)=> (b.fadiga||0)-(a.fadiga||0)).slice(0,20);

  let slots = eu.fisioterapia_slots||[];
  let htmlSlots = "";
  slots.forEach((s,i)=>{
    let fim = new Date(s.fim);
    let agora = new Date();
    let diff = Math.max(0, s.fim - agora.getTime());
    let min = Math.floor(diff/60000);
    let seg = Math.floor((diff%60000)/1000);
    let jNome = elenco[s.id_jogador]?.nome || s.id_jogador;
    htmlSlots += `<div style="background:#111; border:1px solid #333; padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="color:#fff; font-size:13px;">${jNome} - 🔋 ${s.fadiga_antes} → ${s.fadiga_antes-1}</span>
      <span style="color:${min>0?'#ff8c00':'#00b853'}; font-size:12px;">${min>0?`${min}m ${seg}s`:'Pronto! ✅'}</span>
    </div>`;
  });
  if(slots.length===0) htmlSlots = `<p style="color:#666; font-size:13px;">Nenhum jogador em recuperação. Bora poupar o elenco!</p>`;

  let htmlJogadores = listaFadigados.map(j=>{
    let fad = j.fadiga||0;
    let cor = fad<=9?"#00b853":fad<=19?"#ffc107":"#dc3545";
    return `<div style="background:#1a1a1a; border:1px solid #333; padding:8px; border-radius:4px; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
      <span style="color:#fff; font-size:12px;">${j.nome} <small style="color:${cor};">🔋 ${fad}</small></span>
      <button onclick="iniciarRecuperacaoFisio('${j.id||Object.keys(elenco).find(k=>elenco[k].nome===j.nome)}')" style="padding:4px 10px; background:#00b853; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px;">Recuperar R$30k</button>
    </div>`;
  }).join('') || `<p style="color:#666;">Elenco 100% zerado! 🔋</p>`;

  let htmlUpgrade = "";
  if(nivel<3 && cfgProx){
    htmlUpgrade = `<div style="background:#222; border:1px dashed #ff8c00; padding:12px; border-radius:6px; margin-top:15px;">
      <strong style="color:#ff8c00;">⬆️ Upgrade para ${cfgProx.nome}</strong><br>
      <span style="color:#ccc; font-size:12px;">${cfgProx.slots} jogadores simultâneos | ${cfgProx.tempo/60000} min por 1 fadiga | Custo: ${cfgProx.upgradeTickets} tickets ${cfgProx.upgradeDinheiro>0?`+ R$ ${cfgProx.upgradeDinheiro.toLocaleString('pt-BR')}`:''}</span><br>
      <button onclick="melhorarNivelFisio()" style="margin-top:8px; padding:8px 15px; background:#ff8c00; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Melhorar Departamento</button>
    </div>`;
  } else if(nivel===3){
    htmlUpgrade = `<div style="background:#111; border:1px solid #00b853; padding:10px; border-radius:6px; margin-top:15px; color:#00b853; text-align:center;">🏥 Departamento Nível Máximo! 3 jogadores a cada 40 min</div>`;
  }

  let modal = document.createElement('div');
  modal.id = 'modal-fisio';
  modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10005; display:flex; justify-content:center; align-items:center;";
  modal.innerHTML = `
    <div style="background:#1a1a1a; width:95%; max-width:600px; max-height:85vh; border-radius:12px; border:1px solid #444; display:flex; flex-direction:column; overflow:hidden;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #333; background:#111;">
        <h2 style="margin:0; color:#00b853;">🏥 Fisioterapia - Nível ${nivel} (${cfg.nome})</h2>
        <button onclick="document.getElementById('modal-fisio').remove()" style="background:transparent; border:none; color:#aaa; font-size:24px; cursor:pointer;">&times;</button>
      </div>
      <div style="overflow-y:auto; flex:1; padding:15px;">
        <div style="background:#111; padding:10px; border-radius:6px; margin-bottom:15px; border-left:3px solid #00b853;">
          <strong style="color:#fff; font-size:13px;">Em Recuperação (${slots.length}/${cfg.slots})</strong>
          <div style="margin-top:8px;">${htmlSlots}</div>
        </div>
        <strong style="color:#fff;">Jogadores Fadigados</strong>
        <div style="max-height:200px; overflow-y:auto; margin-top:8px;">${htmlJogadores}</div>
        ${htmlUpgrade}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Loop de atualização a cada 1s
  if(window.loopFisio) clearInterval(window.loopFisio);
  window.loopFisio = setInterval(async ()=>{
    let sUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let u = sUser.val()||{};
    let agora = Date.now();
    let slotsAtuais = u.fisioterapia_slots||[];
    let novosSlots = [];
    let updates = {};
    let mudou = false;
    for(let s of slotsAtuais){
      if(s.fim <= agora){
        // Recuperou 1 de fadiga
        let snapJog = await db.ref(`banco_global_times/${u.timeAtual}/jogadores/${s.id_jogador}/fadiga`).once('value');
        let fadAtual = snapJog.val()||0;
        let novaFad = Math.max(0, fadAtual-1);
        updates[`banco_global_times/${u.timeAtual}/jogadores/${s.id_jogador}/fadiga`] = novaFad;
        mudou = true;
        // Registra no jornal
        let logJornal = {
          tipo: "fisio",
          texto: `🏥 ${u.timeAtual.replace(/_/g,' ')} recuperou ${s.fadiga_antes-1} de fadiga de jogador no DM!`,
          time: u.timeAtual,
          data: new Date().toISOString()
        };
        await db.ref(`ligas/${ligaLogada}/jornal_fisio/${Date.now()}`).set(logJornal);
      } else {
        novosSlots.push(s);
      }
    }
    if(mudou){
      await db.ref().update(updates);
      await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/fisioterapia_slots`).set(novosSlots);
      // Atualiza modal se aberto
      let modalAberto = document.getElementById('modal-fisio');
      if(modalAberto) { modalAberto.remove(); abrirModalFisioterapia(); }
    }
  }, 5000);
};

window.iniciarRecuperacaoFisio = async function(idJogador){
  let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
  let eu = snapUser.val()||{};
  let nivel = eu.fisioterapia_nivel||0;
  if(nivel===0) return alert("🚫 Você precisa comprar o Nível 1 do Departamento por 10 tickets primeiro!");
  let cfg = window.fisioConfig[nivel];
  let slots = eu.fisioterapia_slots||[];
  if(slots.length >= cfg.slots) return alert(`🚫 Departamento lotado! Nível ${nivel} só permite ${cfg.slots} por vez. Faça upgrade!`);
  if(slots.some(s=>s.id_jogador===idJogador)) return alert("Esse jogador já está em recuperação!");
  if((eu.caixaClube||0) < cfg.custo) return alert(`Sem grana! Custa R$ ${cfg.custo.toLocaleString('pt-BR')}`);

  let snapJog = await db.ref(`banco_global_times/${eu.timeAtual}/jogadores/${idJogador}`).once('value');
  let j = snapJog.val();
  if(!j || (j.fadiga||0)<=0) return alert("Jogador sem fadiga!");

  let novoSlot = {
    id_jogador: idJogador,
    fadiga_antes: j.fadiga,
    inicio: Date.now(),
    fim: Date.now() + cfg.tempo
  };
  slots.push(novoSlot);
  await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
    caixaClube: (eu.caixaClube||0) - cfg.custo,
    fisioterapia_slots: slots
  });
  document.getElementById('modal-fisio')?.remove();
  abrirModalFisioterapia();
};

window.melhorarNivelFisio = async function(){
  let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
  let eu = snapUser.val()||{};
  let nivel = eu.fisioterapia_nivel||0;
  let prox = window.fisioConfig[nivel+1];
  if(!prox) return;
  if((eu.tickets||0) < prox.upgradeTickets) return alert(`Faltam tickets! Precisa ${prox.upgradeTickets}`);
  if((eu.caixaClube||0) < prox.upgradeDinheiro) return alert(`Falta dinheiro! Precisa R$ ${prox.upgradeDinheiro.toLocaleString('pt-BR')}`);

  if(!confirm(`Confirmar upgrade para ${prox.nome}?\nCusto: ${prox.upgradeTickets} tickets ${prox.upgradeDinheiro>0?`+ R$ ${prox.upgradeDinheiro.toLocaleString('pt-BR')}`:''}\nBenefício: ${prox.slots} jogadores, ${prox.tempo/60000}min por fadiga`)) return;

  await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
    fisioterapia_nivel: nivel+1,
    tickets: (eu.tickets||0) - prox.upgradeTickets,
    caixaClube: (eu.caixaClube||0) - prox.upgradeDinheiro
  });
  // Jornal com upgrade
  await db.ref(`ligas/${ligaLogada}/jornal/${Date.now()}_fisio`).set({
    tipo: "upgrade_fisio",
    time: eu.timeAtual,
    texto: `🏥 UPGRADE! O ${eu.timeAtual.replace(/_/g,' ')} investiu pesado e subiu o Depto de Fisioterapia para o ${prox.nome}! Agora recupera ${prox.slots} jogadores em ${prox.tempo/60000}min!`,
    data: new Date().toISOString()
  });
  document.getElementById('modal-fisio')?.remove();
  abrirModalFisioterapia();
  alert(`✅ Departamento melhorado para ${prox.nome}!`);
};



// ========================================================
// 👁️ SISTEMA DE OLHEIRO (ESPIONAGEM ADVERSÁRIA) COM AVISO ELEGANTE
// ========================================================
window.espionarAdversario = async function(timeAlvoId) {
    try {
        const snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
        let eu = snapUser.val();

        const snapCal = await db.ref(`ligas/${ligaLogada}/calendario`).once('value');
        let cal = snapCal.val() || {};
        let rodadaAtual = cal.rodadaAtual || 1;

        // Se já passou das 19h, a espionagem cobra na cota da próxima rodada
        let rodadaCobranca = (new Date().getHours() >= 19) ? rodadaAtual + 1 : rodadaAtual;

        // Calcula o custo (Dobra a cada uso na mesma rodada)
        let olheiroData = eu.uso_olheiro || { rodada: 0, qtd: 0 };
        if (olheiroData.rodada !== rodadaCobranca) {
            olheiroData = { rodada: rodadaCobranca, qtd: 0 };
        }

        let custo = 50000 * Math.pow(2, olheiroData.qtd);

        let formatarDinheiro = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

        // Caixa Modal Customizada (Substitui o Confirm/Alert feio do navegador)
        let cxConf = document.createElement('div');
        cxConf.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
        cxConf.innerHTML = `
            <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:2px solid #ff8c00; padding:20px; box-shadow:0 10px 40px rgba(255,140,0,0.3); text-align:center;">
                <div style="font-size:40px; margin-bottom:10px;">🕵️‍♂️</div>
                <h3 style="color:#ff8c00; margin-top:0;">Missão de Espionagem</h3>
                <p style="color:#ccc; font-size:14px; margin-bottom:20px;">Deseja enviar um olheiro infiltrado ao CT do <strong>${timeAlvoId.replace(/_/g, ' ')}</strong>?</p>
                <div style="background:#111; border:1px dashed #444; padding:10px; border-radius:6px; margin-bottom:20px;">
                    <span style="color:#888; font-size:12px;">Custo desta missão:</span><br>
                    <strong style="color:var(--verde-campo); font-size:18px;">${formatarDinheiro(custo)}</strong>
                    <div style="font-size:10px; color:#666; margin-top:5px;">(O valor dobra a cada espionagem no mesmo dia)</div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="btn-confirma-esp" style="flex:1; padding:10px; background:#ff8c00; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Pagar e Enviar</button>
                    <button id="btn-cancela-esp" style="flex:1; padding:10px; background:#333; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(cxConf);

        // Ações do Modal Customizado
        document.getElementById('btn-cancela-esp').onclick = () => cxConf.remove();
        document.getElementById('btn-confirma-esp').onclick = async () => {
            cxConf.remove();

            if(eu.caixaClube < custo) {
                return mostrarAvisoElegante(`Você não tem R$ ${formatarDinheiro(custo)} em caixa. O olheiro se recusou a trabalhar!`, "#dc3545", "🚨");
            }

            // 1. Cobra o valor do Caixa
            let novoCaixa = eu.caixaClube - custo;
            olheiroData.qtd += 1;
            await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
                caixaClube: novoCaixa,
                uso_olheiro: olheiroData
            });

            // 2. Tenta Invadir o Sistema do Alvo
            const snapAllUsers = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
            const usuariosGeral = snapAllUsers.val() || {};
            const snapTimes = await db.ref('banco_global_times').once('value');
            const timesGerais = snapTimes.val() || {};

            let donoAlvoObj = null;
            let isIA = true;

            for(let u in usuariosGeral) {
                if(usuariosGeral[u].timeAtual === timeAlvoId) {
                    donoAlvoObj = usuariosGeral[u];
                    isIA = u.startsWith("IA_");
                    break;
                }
            }

            // Verifica o Escudo do adversário
            if (!isIA && donoAlvoObj && donoAlvoObj.escudo_rodada && donoAlvoObj.escudo_rodada.rodada === rodadaCobranca && donoAlvoObj.escudo_rodada.ativo) {
                return mostrarAvisoElegante(`MISSÃO FRACASSADA!<br><br>O técnico do ${timeAlvoId.replace(/_/g, ' ')} fechou os portões do CT. Seu olheiro não viu nada, mas o dinheiro da missão foi gasto.`, "#dc3545", "🛡️");
            }

            // 3. Sucesso! Pega a Escalação
            let tatica = donoAlvoObj ? (donoAlvoObj.mentalidade || "Moderado") : "Moderado";
            let titularesIDs = donoAlvoObj ? (donoAlvoObj.titulares || []) : [];
            let timeDados = timesGerais[timeAlvoId]?.jogadores || {};

            if (isIA || titularesIDs.length === 0) {
                let elencoCompleto = Object.values(timeDados).sort((a,b) => {
                    let ovrA = (a.atributos.ataque+a.atributos.defesa+a.atributos.forca+a.atributos.velocidade+a.atributos.habilidade);
                    let ovrB = (b.atributos.ataque+b.atributos.defesa+b.atributos.forca+b.atributos.velocidade+b.atributos.habilidade);
                    return ovrB - ovrA;
                });
                titularesIDs = elencoCompleto.slice(0, 11);
            } else {
                titularesIDs = titularesIDs.filter(id => id).map(id => timeDados[id]).filter(j => j);
            }

            let forcaTotal = 0;
            let htmlJogadores = "";

            titularesIDs.forEach(j => {
                let at = j.atributos || {ataque:0, defesa:0, forca:0, velocidade:0, habilidade:0};
                let ovr = Math.round((at.ataque+at.defesa+at.forca+at.velocidade+at.habilidade)/5);
                forcaTotal += (at.ataque+at.defesa+at.forca+at.velocidade+at.habilidade);
                let pos = j.posicoes ? j.posicoes.p.charAt(0) : "N";
                htmlJogadores += `<div style="display:flex; justify-content:space-between; border-bottom:1px dashed #333; padding:4px 0; font-size:13px;"><span><strong style="color:var(--verde-campo);">${pos}</strong> - ${j.nome}</span><strong style="color:#ff8c00;">${ovr}</strong></div>`;
            });

            // 4. Cria o Modal de Relatório Final
            let modal = document.createElement('div');
            modal.id = 'modal-relatorio-olheiro';
            modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
            modal.innerHTML = `
                <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:2px solid #007bff; padding:20px; box-shadow:0 10px 40px rgba(0,123,255,0.3);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:10px; margin-bottom:15px;">
                        <h2 style="color:#007bff; margin:0; font-size:18px;">🕵️‍♂️ Dossiê Espião</h2>
                        <button onclick="document.getElementById('modal-relatorio-olheiro').remove()" style="background:transparent; border:none; color:#aaa; font-size:24px; cursor:pointer;">&times;</button>
                    </div>

                    <div style="text-align:center; margin-bottom:15px;">
                        <img src="${getEscudo(timeAlvoId)}" onerror="this.src='esculdos/default.png'" style="width:60px; height:60px; filter:drop-shadow(0 0 5px rgba(255,255,255,0.2));">
                        <h3 style="color:#fff; margin:5px 0 0 0;">${timeAlvoId.replace(/_/g, ' ')}</h3>
                    </div>

                    <div style="background:#111; padding:12px; border-radius:6px; border:1px solid #333; margin-bottom:15px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span style="color:#aaa;">Mentalidade:</span><strong style="color:#ff8c00;">${tatica}</strong></div>
                        <div style="display:flex; justify-content:space-between;"><span style="color:#aaa;">Força Bruta do 11:</span><strong style="color:var(--verde-campo);">${forcaTotal}</strong></div>
                    </div>

                    <h4 style="color:#aaa; border-bottom:1px solid #333; padding-bottom:5px; margin-top:0;">📋 Equipe Titular Identificada</h4>
                    <div style="max-height: 200px; overflow-y:auto; padding-right:5px;">
                        ${htmlJogadores || "<span style='color:#666;'>O clube não definiu os titulares.</span>"}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        };

    } catch(e) { console.error(e); }
};

// ========================================================
// 🎭 FUNÇÃO AUXILIAR: MENSAGENS ELEGANTES (NO ALERTS)
// ========================================================
function mostrarAvisoElegante(texto, corBorda, icone) {
    let cx = document.createElement('div');
    cx.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
    cx.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:1px solid ${corBorda}; padding:25px; text-align:center;">
            <div style="font-size:40px; margin-bottom:10px;">${icone}</div>
            <p style="color:#fff; font-size:16px; margin-bottom:20px; line-height:1.4;">${texto}</p>
            <button onclick="this.parentElement.parentElement.remove()" style="width:100%; padding:10px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; font-weight:bold; cursor:pointer;">Fechar</button>
        </div>
    `;
    document.body.appendChild(cx);
}

// AVISO DE JOGADOR NOVO NOS AGENTES LIVRES
async function carregarAvisoNovosJogadores(){
    try{
        let snap = await db.ref(`banco_global_times/Agentes_Livres_${ligaLogada}/jogadores`).once('value');
        let jogadores = snap.val()||{};
        let novos = Object.values(jogadores).filter(j=>{
            if(!j.data_descoberta) return false;
            let diff = Date.now() - new Date(j.data_descoberta).getTime();
            return diff < 24*60*60*1000; // últimas 24h
        }).sort((a,b)=> new Date(b.data_descoberta) - new Date(a.data_descoberta)).slice(0,3);

        if(novos.length===0) return;
        let widget = document.getElementById('widget-avisos');
        let lista = document.getElementById('lista-avisos');
        if(!widget ||!lista) return;

        widget.style.display = 'block';
        novos.forEach(j=>{
            let li = document.createElement('li');
            li.style.cssText = "background:#111; border:1px solid gold; padding:8px; border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;";
            li.innerHTML = `<span>⭐ Novo: <strong style="color:gold;">${j.nome}</strong> nos Agentes Livres! <small style="color:#aaa;">(descoberto há ${Math.floor((Date.now()-new Date(j.data_descoberta).getTime())/3600000)}h)</small></span><button onclick="window.location.href='mercado.html'" style="background:gold; color:#000; border:none; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">Ver</button>`;
            lista.prepend(li);
        });
    }catch(e){ console.log('Erro aviso novos:', e); }
}