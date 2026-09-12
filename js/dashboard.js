// js/dashboard.js

// 1. VERIFICA SEGURANÇA
const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

window.x1Audios = { torcidaM: new Audio(), torcidaV: new Audio(), hino: new Audio(), gol: new Audio(), fim: new Audio(), apito: new Audio() };

if (!ligaLogada || !userLogado) {
    window.location.href = "index.html";
}

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

        if (dadosUsuario.timeAtual === "Sem Clube" || !dadosUsuario.timeAtual) {
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
                    <button onclick="darColetivaImprensa()" style="flex: 1; background: #333; color: #fff; border: 1px solid #555; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">🎤 Dar Coletiva</button>
                    <button onclick="pagarBichoExtra()" style="flex: 1; background: #ff8c00; color: #fff; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">💰 Pagar Bicho Extra</button>
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
                <button class="widget-btn" onclick="window.location.href='mercado.html'">Ir ao Mercado</button>
            </div>

            <!-- WIDGET 5: ARENA X1 -->
            <div class="widget-card" style="border: 1px solid #dc3545; box-shadow: 0 0 15px rgba(220,53,69,0.2);">
                <h3 style="color: #dc3545; margin-bottom: 5px;">Arena X1 ⚔️</h3>
                <p style="color: #aaa; font-size: 12px; margin-top:0; margin-bottom: 15px;">Desafie a Máquina ou outros Players. Aposte dinheiro do caixa ou passes de jogadores em um duelo instantâneo!</p>
                <div style="flex: 1;"></div>
                <button class="widget-btn" onclick="abrirModalX1()" style="background: #dc3545; color: white; border: none; font-weight: bold; width: 100%;">Entrar na Arena</button>
            </div>

            <!-- WIDGET 6: CENTRO DE TREINAMENTO (CT) -->
            <div class="widget-card" style="border: 1px solid #007bff; box-shadow: 0 0 15px rgba(0,123,255,0.1);">
                <h3 style="color: #007bff; margin-bottom: 5px;">CT Intensivo 🏋️‍♂️</h3>
                <div id="area-ct" style="flex: 1; display: flex; flex-direction: column; justify-content: center; margin-top: 5px;">
                    <p style="color:#666; font-size:12px; text-align:center;">Abrindo portões do CT...</p>
                </div>
            </div>
        </div>
    `;

    buscarMeuProximoJogo(timeIdBanco);
    carregarEstatisticasGerais(timeIdBanco);
    carregarMiniTabela(timeIdBanco);
    carregarRadarMercado();
    carregarCentralDeAvisos(timeIdBanco); // 🚨 Inicia a busca por pendências!
    carregarCentroDeTreinamento(timeIdBanco); // 🏋️ Inicia a lógica do CT!

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

// 🎤 SISTEMA DE RETENÇÃO DIÁRIA (MANUTENÇÃO DA MORAL)
window.darColetivaImprensa = async function() {
    let hoje = new Date().toLocaleDateString('pt-BR');
    if (dadosUsuario.ultima_coletiva === hoje) return alert("Você já deu uma coletiva hoje! A mídia e a torcida estão cansadas da sua voz por hoje.");

    let sucesso = Math.random() > 0.4; // 60% chance de sucesso
    let moralAtual = dadosUsuario.moral || 50;
    let novaMoral = sucesso ? Math.min(100, moralAtual + 15) : Math.max(0, moralAtual - 10);

    let msg = sucesso ? "✅ A coletiva foi um sucesso! Você animou os torcedores (+15% Moral)." : "❌ Desastre na coletiva! Você falou besteira e irritou a torcida (-10% Moral).";

    await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
        moral: novaMoral,
        ultima_coletiva: hoje
    });
    alert(msg);
};

window.pagarBichoExtra = async function() {
    let hoje = new Date().toLocaleDateString('pt-BR');
    if (dadosUsuario.ultimo_bicho === hoje) return alert("A diretoria vetou! O Bicho Extra só pode ser pago uma vez ao dia.");

    let caixa = dadosUsuario.caixaClube || 0;
    if (caixa < 500000) return alert("Você não tem R$ 500.000 em caixa para pagar essa premiação!");

    let moralAtual = dadosUsuario.moral || 50;
    let novaMoral = Math.min(100, moralAtual + 25);

    await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
        moral: novaMoral,
        caixaClube: caixa - 500000,
        ultimo_bicho: hoje
    });
    alert("💸 O vestiário virou uma festa! Jogadores ultra motivados (+25% Moral). R$ 500.000 foram descontados do caixa.");
};

async function carregarCentralDeAvisos(meuTimeId) {
    const ul = document.getElementById('lista-avisos');
    const widget = document.getElementById('widget-avisos');
    let avisos = [];

    try {
        const [snapMsgs, snapMercado, snapPros, snapTime] = await Promise.all([
            db.ref(`ligas/${ligaLogada}/caixa_mensagens/${userLogado}`).once('value'),
            db.ref(`ligas/${ligaLogada}/mercado_propostas`).once('value'),
            db.ref(`ligas/${ligaLogada}/pro_players`).once('value'),
            db.ref(`banco_global_times/${meuTimeId}`).once('value')
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

        // 4. Plantel Curto (Crítico!)
        let numJogadores = Object.keys(meuElenco).length;
        if (numJogadores > 0 && numJogadores < 11) {
            avisos.push(`
                <li style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444;">
                    <strong style="color:#dc3545;">🚨 Plantel Incompleto:</strong> <span style="color:#ccc;">Atenção! Seu time tem apenas ${numJogadores} jogadores. Se o campeonato rodar, você perderá por W.O. Vá ao mercado agora!</span>
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
            let donoM = window.treinadoresGlobais[meuJogo.mandante] ? `<br><span style="font-size:10px; color:#ff8c00; font-weight:normal;">👤 ${window.treinadoresGlobais[meuJogo.mandante]}</span>` : `<br><span style="font-size:10px; color:#888; font-weight:normal;">🤖 IA</span>`;
            let donoV = window.treinadoresGlobais[meuJogo.visitante] ? `<br><span style="font-size:10px; color:#ff8c00; font-weight:normal;">👤 ${window.treinadoresGlobais[meuJogo.visitante]}</span>` : `<br><span style="font-size:10px; color:#888; font-weight:normal;">🤖 IA</span>`;

            const mandante = meuJogo.mandante.replace(/_/g, ' ') + donoM;
            const visitante = meuJogo.visitante.replace(/_/g, ' ') + donoV;
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
                let nomeDono = window.treinadoresGlobais[t.id] ? `<span style="font-size:9px; color:#aaa; display:block; line-height:1; font-weight:normal; margin-top:2px;">👤 ${window.treinadoresGlobais[t.id]}</span>` : "";

                html += `
                    <tr style="border-bottom: 1px solid #333; background: ${ehMeu ? 'rgba(255,140,0,0.1)' : 'transparent'};">
                        <td style="padding: 8px 0; color: #aaa;">${i+1}º</td>
                        <td style="text-align: left; color: ${cor}; font-weight: ${peso}; line-height:1.1; padding: 4px 0;">
                            <div style="display:flex; align-items:center;">
                                <img src="${getEscudo(t.id)}" onerror="this.src='esculdos/default.png'" style="width: 16px; height: 16px; margin-right: 6px;">
                                <div style="display:flex; flex-direction:column;">
                                    <span>${t.id.replace(/_/g, ' ')}</span>
                                    ${nomeDono}
                                </div>
                            </div>
                        </td>
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

    // Trava a largura e altura exata do botão para que o clique não "vaze" pelos lados ou para cima
    btn.style.cssText = "background: transparent; color: var(--verde-campo); border: none; padding: 0; margin: 0 5px 0 0; font-size: 14px; cursor: pointer; transition: 0.2s; opacity: 0.8; display: inline-flex; justify-content: center; align-items: center; width: 20px; height: 20px; flex-shrink: 0;";

    btn.onclick = (e) => {
        e.stopPropagation();
        if (hinoAmbiente.paused) {
            hinoAmbiente.play(); torcidaAmbiente.play();
            btn.innerHTML = '🔊';
            btn.style.color = 'var(--verde-campo)';
            btn.style.opacity = '0.8';
        } else {
            hinoAmbiente.pause(); torcidaAmbiente.pause();
            btn.innerHTML = '🔇';
            btn.style.color = '#888';
            btn.style.opacity = '0.5';
        }
    };

    // Procura o elemento do saldo para grudar o botão à ESQUERDA dele!
    let saldoElement = document.getElementById('saldo-treinador');
    if (saldoElement) {
        // Usa beforebegin para colocar antes do saldo, sem mudar o CSS do pai e evitar empurrar a tela!
        saldoElement.insertAdjacentElement('beforebegin', btn);
        saldoElement.style.verticalAlign = "middle";
    } else {
        // Fallback
        btn.style.position = "absolute";
        btn.style.top = "15px";
        btn.style.right = "15px";
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

            // Busca se tem alguém controlando esse time
            let donoNome = "🤖 IA";
            for (let k in arenaDadosGlobais.usuarios) {
                if (arenaDadosGlobais.usuarios[k].timeAtual === t) {
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

                // Descobre o nome do adversário do desafio
                let nomeAdv = "🤖 IA";
                for (let k in arenaDadosGlobais.usuarios) {
                    if (arenaDadosGlobais.usuarios[k].timeAtual === adv) {
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
            } // Fecha o IF
        } // 🟢 Fecha o FOR (Esta é a chave mágica que ressucitará o seu painel!)
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

    if (!oponente) return alert("Selecione um oponente!");

    let forcaM = arenaDadosGlobais.times[meuTime].forca_base || 500;
    let forcaV = arenaDadosGlobais.times[oponente].forca_base || 500;
    let isOponenteIA = !Object.values(arenaDadosGlobais.usuarios).some(u => u.timeAtual === oponente);

    if (isOponenteIA && forcaM > forcaV) {
        return alert(`A Diretoria do ${oponente.replace(/_/g, ' ')} RECUSOU o desafio! A inteligência artificial identificou que seu time é superior e não quer arriscar perder os ativos do clube.`);
    }

    let apostaValidada = {};
    let taxaX1 = 5000; // 🟢 Taxa de manutenção da arena

    if (tipo === 'dinheiro') {
        let valor = parseInt(document.getElementById('x1-valor-aposta').value);
        if (isNaN(valor) || valor <= 0) return alert("Valor de aposta inválido.");

        let caixaM = dadosUsuario.caixaClube || 0;
        let caixaV = isOponenteIA ? 50000000 : 0;
        if (!isOponenteIA) {
            let userAdv = Object.values(arenaDadosGlobais.usuarios).find(u => u.timeAtual === oponente);
            if (userAdv) caixaV = userAdv.caixaClube || 0;
        }

        if (caixaM < (valor + taxaX1)) return alert(`Saldo Insuficiente! Você precisa do valor da aposta + R$ 5.000 da Taxa da Arena.`);
        if (caixaV < (valor + taxaX1)) return alert(`O oponente não tem caixa para a aposta + R$ 5.000 de Taxa.`);

        apostaValidada = { tipo: 'dinheiro', valor: valor, taxa: taxaX1 };
    } else {
        let meuId = document.getElementById('x1-meu-jogador').value;
        let advId = document.getElementById('x1-adv-jogador').value;
        if (!meuId || !advId) return alert("Selecione os dois jogadores da aposta.");

        let caixaM = dadosUsuario.caixaClube || 0;
        let caixaV = isOponenteIA ? 50000000 : 0;
        if (!isOponenteIA) {
            let userAdv = Object.values(arenaDadosGlobais.usuarios).find(u => u.timeAtual === oponente);
            if (userAdv) caixaV = userAdv.caixaClube || 0;
        }

        if (caixaM < taxaX1) return alert(`Você precisa ter pelo menos R$ 5.000 em caixa para pagar a Taxa da Arena.`);
        if (caixaV < taxaX1) return alert(`O oponente não tem R$ 5.000 em caixa para pagar a Taxa da Arena.`);

        let meuJog = arenaDadosGlobais.times[meuTime].jogadores[meuId];
        let advJog = arenaDadosGlobais.times[oponente].jogadores[advId];

        let valorM = meuJog.valor_mercado || 1000000;
        let valorV = advJog.valor_mercado || 1000000;
        let diff = Math.abs(valorM - valorV);
        let maxDiff = Math.max(valorM, valorV) * 0.05;

        if (diff > maxDiff) return alert(`Aposta Rejeitada! A diferença de valor ultrapassa 5%.\nSeu Jogador: ${formatarDinheiro(valorM)}\nAdversário: ${formatarDinheiro(valorV)}`);

        apostaValidada = { tipo: 'jogador', id_meu: meuId, id_adv: advId, dados_meu: meuJog, dados_adv: advJog };
    }

    if (isOponenteIA) {
        // IA SIMULATION INSTANT (Fica pronto na hora)

        // --- INÍCIO DA GERAÇÃO DE LANCES DO X1 ---
        let linhaTempoX1 = [];
        let golsM = 0; let golsV = 0;

        const sortearX1 = (tId, posicoes = null) => {
            let el = arenaDadosGlobais.times[tId]?.jogadores ? Object.values(arenaDadosGlobais.times[tId].jogadores) : [];
            if(posicoes) {
                let filt = el.filter(j => posicoes.includes(j.posicoes?.p));
                if(filt.length > 0) return filt[Math.floor(Math.random() * filt.length)];
            }
            return el.length ? el[Math.floor(Math.random() * el.length)] : {nome: "Jogador"};
        };

        for(let i=0; i<5; i++) {
            if (Math.random() < (forcaM / (forcaM + forcaV)) * 0.6) {
                let nA = sortearX1(meuTime, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
                linhaTempoX1.push({ minuto: Math.floor(Math.random()*89)+1, tipo: 'gol_m', texto: `⚽ GOOOL! Golaço espetacular de ${nA}! A Arena vai à loucura!` });
                golsM++;
            }
            if (Math.random() < (forcaV / (forcaM + forcaV)) * 0.6) {
                let nA = sortearX1(oponente, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
                linhaTempoX1.push({ minuto: Math.floor(Math.random()*89)+1, tipo: 'gol_v', texto: `⚽ GOL DO VISITANTE! ${nA} acha uma brecha na zaga e manda pro fundo da rede!` });
                golsV++;
            }
        }

        for(let i=0; i<16; i++) {
            let minAleatorio = Math.floor(Math.random()*89)+1;
            if (minAleatorio === 45) minAleatorio = 46;

            let isM = Math.random() > 0.5;
            let tAtq = isM ? meuTime : oponente;
            let tDef = isM ? oponente : meuTime;

            let atk = sortearX1(tAtq, ["Atacante", "Ponta", "Centroavante"]).nome.split(" ")[0];
            let mei = sortearX1(tAtq, ["Meia", "Volante"]).nome.split(" ")[0];
            let zag = sortearX1(tDef, ["Zagueiro", "Lateral", "Volante"]).nome.split(" ")[0];
            let gol = sortearX1(tDef, ["Goleiro"]).nome.split(" ")[0];

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

        let venci = golsM > golsV;

        let txtFim = (tipo === 'dinheiro')
            ? (venci ? `Você faturou ${formatarDinheiro(apostaValidada.valor)} em cima da máquina!` : `A máquina limpou ${formatarDinheiro(apostaValidada.valor)} do seu caixa.`)
            : (venci ? `O passe de ${apostaValidada.dados_adv.nome} agora é seu!` : `Adeus! O seu jogador ${apostaValidada.dados_meu.nome} fez as malas.`);

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
        alert("Desafio enviado com sucesso! Aguarde o oponente aceitar na aba 'Enviados'.");
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

    const sortearX1 = (tId, posicoes = null) => {
        let el = arenaDadosGlobais.times[tId]?.jogadores ? Object.values(arenaDadosGlobais.times[tId].jogadores) : [];
        if(posicoes) {
            let filt = el.filter(j => posicoes.includes(j.posicoes?.p));
            if(filt.length > 0) return filt[Math.floor(Math.random() * filt.length)];
        }
        return el.length ? el[Math.floor(Math.random() * el.length)] : {nome: "Jogador"};
    };

    for(let i=0; i<5; i++) {
        if (Math.random() < (forcaM / (forcaM + forcaV)) * 0.6) {
            let nA = sortearX1(mandante, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
            linhaTempo.push({ minuto: Math.floor(Math.random()*89)+1, tipo: 'gol_m', texto: `⚽ GOOOL! Golaço espetacular de ${nA}! A Arena vai à loucura!` });
            golsM++;
        }
        if (Math.random() < (forcaV / (forcaM + forcaV)) * 0.6) {
            let nA = sortearX1(visitante, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
            linhaTempo.push({ minuto: Math.floor(Math.random()*89)+1, tipo: 'gol_v', texto: `⚽ GOL DO VISITANTE! ${nA} acha uma brecha na zaga e manda pro fundo da rede!` });
            golsV++;
        }
    }

    for(let i=0; i<16; i++) {
        let minAleatorio = Math.floor(Math.random()*89)+1;
        if (minAleatorio === 45) minAleatorio = 46;

        let isM = Math.random() > 0.5;
        let tAtq = isM ? mandante : visitante;
        let tDef = isM ? visitante : mandante;

        let atk = sortearX1(tAtq, ["Atacante", "Ponta", "Centroavante"]).nome.split(" ")[0];
        let mei = sortearX1(tAtq, ["Meia", "Volante"]).nome.split(" ")[0];
        let zag = sortearX1(tDef, ["Zagueiro", "Lateral", "Volante"]).nome.split(" ")[0];
        let gol = sortearX1(tDef, ["Goleiro"]).nome.split(" ")[0];

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
    if(!d) return alert("Desafio não existe mais.");

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

        const sortearX1 = (tId, posicoes = null) => {
            let el = arenaDadosGlobais.times[tId]?.jogadores ? Object.values(arenaDadosGlobais.times[tId].jogadores) : [];
            if(posicoes) {
                let filt = el.filter(j => posicoes.includes(j.posicoes?.p));
                if(filt.length > 0) return filt[Math.floor(Math.random() * filt.length)];
            }
            return el.length ? el[Math.floor(Math.random() * el.length)] : {nome: "Jogador"};
        };

        for(let i=0; i<5; i++) {
            if (Math.random() < (forcaM / (forcaM + forcaV)) * 0.6) {
                let nA = sortearX1(mandante, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
                linhaTempoX1.push({ minuto: Math.floor(Math.random()*89)+1, tipo: 'gol_m', texto: `⚽ GOOOL! Golaço espetacular de ${nA}! A Arena vai à loucura!` });
                golsM++;
            }
            if (Math.random() < (forcaV / (forcaM + forcaV)) * 0.6) {
                let nA = sortearX1(visitante, ["Atacante", "Centroavante", "Ponta"]).nome.split(" ")[0];
                linhaTempoX1.push({ minuto: Math.floor(Math.random()*89)+1, tipo: 'gol_v', texto: `⚽ GOL DO VISITANTE! ${nA} acha uma brecha na zaga e manda pro fundo da rede!` });
                golsV++;
            }
        }

        for(let i=0; i<16; i++) {
            let minAleatorio = Math.floor(Math.random()*89)+1;
            if (minAleatorio === 45) minAleatorio = 46;

            let isM = Math.random() > 0.5;
            let tAtq = isM ? mandante : visitante;
            let tDef = isM ? visitante : mandante;

            let atk = sortearX1(tAtq, ["Atacante", "Ponta", "Centroavante"]).nome.split(" ")[0];
            let mei = sortearX1(tAtq, ["Meia", "Volante"]).nome.split(" ")[0];
            let zag = sortearX1(tDef, ["Zagueiro", "Lateral", "Volante"]).nome.split(" ")[0];
            let gol = sortearX1(tDef, ["Goleiro"]).nome.split(" ")[0];

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

    let isVitoriaMinha = isDesafiante ? (d.golsM > d.golsV) : (d.golsV > d.golsM);
    let txtFim = "";
    if (d.tipo === 'dinheiro') {
        txtFim = isVitoriaMinha ? `Você faturou ${formatarDinheiro(d.valor)} do oponente!` : `Você perdeu ${formatarDinheiro(d.valor)} do caixa.`;
    } else {
        let nomeGanho = isDesafiante ? d.dados_adv.nome : d.dados_meu.nome;
        let nomePerdido = isDesafiante ? d.dados_meu.nome : d.dados_adv.nome;
        txtFim = isVitoriaMinha ? `O passe de ${nomeGanho} agora é seu!` : `Adeus! Seu jogador ${nomePerdido} fez as malas.`;
    }

    // Toca a transmissão! (O isIADuel aqui vai como false, pois a DB já foi atualizada acima).
    reproduzirTransmissaoX1(mandante, visitante, d.linhaDoTempo, d.golsM, d.golsV, isVitoriaMinha, txtFim, false, {});
};

function reproduzirTransmissaoX1(mandante, visitante, linhaTempo, golsM_final, golsV_final, venci, txtFim, isIADuel, apostaValidadaIA) {
    let modal = document.getElementById('modal-arena-x1');

    modal.style.background = "transparent";
    modal.style.backgroundImage = `linear-gradient(rgba(10,10,10,0.85), rgba(10,10,10,0.95)), url('${getEstadio(mandante)}')`;
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

            if (velo === 1) {
                setTimeout(() => {
                    let campeao = (golsM_final > golsV_final) ? mandante : visitante;
                    if(golsM_final !== golsV_final) {
                        canalHino.src = getHino(campeao);
                        canalHino.currentTime = 0; canalHino.volume = 0.2; canalHino.loop = true;
                        canalHino.play().catch(()=>{});
                    }
                }, 1500);
            }

            // Gravação no Banco
            if (isIADuel && apostaValidadaIA) {
                let updates = {};
                let v = apostaValidadaIA.valor;
                let taxa = apostaValidadaIA.taxa || 5000;

                if (apostaValidadaIA.tipo === 'dinheiro') {
                    if (venci) updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = (dadosUsuario.caixaClube || 0) + v - taxa;
                    else updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = (dadosUsuario.caixaClube || 0) - v - taxa;
                } else {
                    updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = (dadosUsuario.caixaClube || 0) - taxa;
                    if (venci) {
                        updates[`banco_global_times/${visitante}/jogadores/${apostaValidadaIA.id_adv}`] = null;
                        updates[`banco_global_times/${mandante}/jogadores/${apostaValidadaIA.id_adv}`] = apostaValidadaIA.dados_adv;
                    } else {
                        updates[`banco_global_times/${mandante}/jogadores/${apostaValidadaIA.id_meu}`] = null;
                        updates[`banco_global_times/${visitante}/jogadores/${apostaValidadaIA.id_meu}`] = apostaValidadaIA.dados_meu;
                    }
                }
                await db.ref().update(updates);
            }

            modal.style.flexDirection = "column";
            modal.insertAdjacentHTML('beforeend', `
                <div style="width:90%; max-width:600px; margin-top:15px; padding:15px; background:${venci ? 'rgba(0,184,83,0.3)' : 'rgba(220,53,69,0.3)'}; border:2px solid ${venci ? 'var(--verde-campo)' : '#dc3545'}; border-radius:8px; box-shadow: 0 0 20px ${venci ? 'rgba(0,184,83,0.5)' : 'rgba(220,53,69,0.5)'}; backdrop-filter: blur(10px); text-align:center;">
                    <h3 style="color:#fff; margin:0; text-shadow: 1px 1px 3px #000;">${venci ? '🏆 VITÓRIA!' : '💀 DERROTA!'}</h3>
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