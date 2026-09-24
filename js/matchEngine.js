// js/matchEngine.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let divisaoAtual = "A";
let rodadaSistema = 1;
let meuJogoId = null;
let jogoAtual = null;
window.treinadoresGlobais = {}; // 🟢 Mapeamento global de quem controla quem

// ==========================================
// MÁQUINA DE ÁUDIO DINÂMICO (P2P QUEUE)
// ==========================================
let audioLiberado = false;
const canalTorcidaM = new Audio();
const canalTorcidaV = new Audio();
const canalEfeitos = new Audio();
const canalHino = new Audio();
const somApito = { play:()=>Promise.resolve(), pause:()=>{}, addEventListener:()=>{} };
try{ somApito.src = 'sounds/apito_arbitro.mp3'; }catch(e){}
somApito.addEventListener('error', ()=>{ try{ somApito.src=''; }catch(e){} });

canalTorcidaM.loop = true;
canalTorcidaV.loop = true;

let eventosJaTocados = new Set();
let filaNarracaoOficial = [];
let narradorOficialOcupado = false;
let placarNarracaoM = 0;
let placarNarracaoV = 0;

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const narracao = document.getElementById('narracao-container');
        if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 20px;">Buscando sinal do satélite...</div>`;

        // Busca a lista de treinadores para exibir os nomes na tela de transmissão
        const snapAllUsers = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
        const allUsers = snapAllUsers.val() || {};
        for(let k in allUsers) {
            if(allUsers[k].timeAtual && allUsers[k].timeAtual !== "Sem Clube") {
                window.treinadoresGlobais[allUsers[k].timeAtual] = allUsers[k].nome;
            }
        }

        const snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
        dadosUsuario = snapUser.val();
        if(!dadosUsuario || dadosUsuario.timeAtual === "Sem Clube") return window.location.href = "dashboard.html";

        const snapTime = await db.ref(`banco_global_times/${dadosUsuario.timeAtual}`).once('value');
        if (snapTime.exists()) divisaoAtual = snapTime.val().divisao;

        iniciarTransmissao();
    } catch (e) { console.error(e); }
});

function atualizarTorcidasOficiais() {
    if (!audioLiberado) return;
    if (placarNarracaoM > placarNarracaoV) { canalTorcidaM.volume = 0.5; canalTorcidaV.volume = 0.1; }
    else if (placarNarracaoV > placarNarracaoM) { canalTorcidaM.volume = 0.1; canalTorcidaV.volume = 0.5; }
    else { canalTorcidaM.volume = 0.4; canalTorcidaV.volume = 0.2; }
}

window.liberarAudio = function() {
    audioLiberado = true;
    const narracao = document.getElementById('narracao-container');
    if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center;">Áudio e vídeo conectados! Aguardando rolar a bola...</div>`;

    if (jogoAtual && jogoAtual.linhaDoTempo) {
        canalTorcidaM.src = getTorcida(jogoAtual.mandante);
        canalTorcidaV.src = getTorcida(jogoAtual.visitante);
        canalTorcidaM.play().catch(()=>{});
        canalTorcidaV.play().catch(()=>{});
        atualizarTorcidasOficiais();

        reproduzirLinhaDoTempo(jogoAtual.linhaDoTempo, jogoAtual.horaInicio, jogoAtual.placarMandante, jogoAtual.placarVisitante);
    }
}

// ==========================================
// LÓGICA DE TRANSMISSÃO COM SELETOR DE RODADAS (CAMP E COPA)
// ==========================================
let calGlobal = null;
let rodadaExibicao = null;

function iniciarTransmissao() {
    db.ref(`ligas/${ligaLogada}/calendario`).on('value', (snapCal) => {
        calGlobal = snapCal.val();
        if (!calGlobal) return;

        rodadaSistema = calGlobal.rodadaAtual || 1;

        // 🟢 CORREÇÃO: Força a rodada atual baseando-se na data real de hoje!
        let dataHoje = new Date();
        let hojeDT = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), dataHoje.getDate());

        if (calGlobal.serieA) {
            for (let r = 1; r <= 38; r++) {
                let rodadaData = calGlobal.serieA[`rodada_${r}`];
                if (rodadaData) {
                    let jogoExemplo = Object.values(rodadaData)[0];
                    if (jogoExemplo && jogoExemplo.data_jogo) {
                        let [dJ, mJ] = jogoExemplo.data_jogo.split(' ')[0].split('/');
                        let jogoDT = new Date(dataHoje.getFullYear(), parseInt(mJ)-1, parseInt(dJ));
                        // Se a data do jogo já chegou, libera a rodada no filtro!
                        if (jogoDT <= hojeDT) rodadaSistema = r;
                    }
                }
            }
        }

        renderizarPartida();
    });

    // GATILHO: só atualiza se NÃO estiver narrando ao vivo
    if (!window.loopDestravaTV) {
        window.loopDestravaTV = setInterval(() => {
            if (calGlobal &&!window.narrandoAoVivo) renderizarPartida();
        }, 10000);
    }
}

let ultimoJogoNarrado = null;
function reproduzirLinhaDoTempo(linha, horaInicio, pm, pv){
    if(ultimoJogoNarrado === meuJogoId && document.getElementById('narracao-container')?.children.length>0) return; // já está narrando
    ultimoJogoNarrado = meuJogoId;
    window.narrandoAoVivo = true;
    let el = document.getElementById('narracao-container');
    if(el) el.innerHTML = '';
    let idx=0;
    placarNarracaoM = 0; placarNarracaoV = 0;
    function tocarProx(){
        if(idx>=linha.length){ window.narrandoAoVivo=false; return; }
        let ev = linha[idx];
        if(el){
            let div = document.createElement('div');
            div.style.cssText = "border-left:3px solid "+(ev.tipo.includes('gol')?'gold':'#444')+"; padding:5px 10px; margin:5px 0; background:#111;";
            div.innerHTML = `<strong>${ev.minuto}'</strong> - ${ev.texto}`;
            el.appendChild(div); // append, não prepend, pra linha do tempo ir na ordem
            if(ev.tipo.includes('gol')){
                if(ev.tipo.includes('mandante')) placarNarracaoM++; else placarNarracaoV++;
                document.getElementById('gols-mandante').innerText = placarNarracaoM;
                document.getElementById('gols-visitante').innerText = placarNarracaoV;
                mostrarLetreiroGol(ev.texto.includes('MANDANTE')||ev.texto.includes(jogoAtual.mandante.replace(/_/g,' '))? jogoAtual.mandante : jogoAtual.visitante);
            }
        }
        idx++;
        setTimeout(tocarProx, 1500);
    }
    tocarProx();
}

window.mudarRodadaTransmissao = function(novaRodada) {
    rodadaExibicao = novaRodada;
    canalTorcidaM.pause(); canalTorcidaV.pause();
    eventosJaTocados.clear(); filaNarracaoOficial = []; narradorOficialOcupado = false;
    placarNarracaoM = 0; placarNarracaoV = 0;
    renderizarPartida();
};

function renderizarPartida() {
    const topoRodada = document.getElementById('lbl-rodada-top');

    // 1️⃣ MÁGICA DO FILTRO: Se hoje tem Copa do seu time, já abre na Copa
    if (!rodadaExibicao) {
        let hojeStr = new Date().toLocaleDateString('pt-BR').slice(0,5);
        let faseCopaHoje = null;
        if(calGlobal.copa){
            for(let fase in calGlobal.copa){
                let jogos = calGlobal.copa[fase];
                for(let j in jogos){
                    let jogo = jogos[j];
                    if((jogo.mandante === dadosUsuario.timeAtual || jogo.visitante === dadosUsuario.timeAtual) && jogo.data_jogo && jogo.data_jogo.includes(hojeStr)){
                        faseCopaHoje = fase;
                        break;
                    }
                }
                if(faseCopaHoje) break;
            }
        }
        if(faseCopaHoje){ rodadaExibicao = `copa_${faseCopaHoje}`; }
        else { rodadaExibicao = `camp_rodada_${rodadaSistema}`; }
    }

    if (topoRodada && (!document.getElementById('select-rodada-transmissao'))) {
        let selectHtml = `<select id="select-rodada-transmissao" onchange="mudarRodadaTransmissao(this.value)" style="background:#1a1a1a; color:var(--verde-campo); border:1px solid #444; padding:2px 5px; border-radius:4px; font-weight:bold; outline:none; margin-left: 5px; cursor: pointer;">`;

        for (let r = 1; r <= rodadaSistema; r++) {
            selectHtml += `<option value="camp_rodada_${r}" ${rodadaExibicao === 'camp_rodada_'+r ? 'selected' : ''}>Rodada ${r}</option>`;
        }
        if (calGlobal.copa) {
            for (let f in calGlobal.copa) {
                selectHtml += `<option value="copa_${f}" ${rodadaExibicao === 'copa_'+f ? 'selected' : ''}>Copa: ${f.toUpperCase()}</option>`;
            }
        }
        selectHtml += `</select>`;
        topoRodada.innerHTML = selectHtml;
    }

    let isCopa = rodadaExibicao.startsWith("copa_");
    let chave = rodadaExibicao.replace("camp_", "").replace("copa_", "");

    let jogosDaDivisao = null;
    if (isCopa) jogosDaDivisao = calGlobal.copa[chave];
    else jogosDaDivisao = divisaoAtual === "A" ? calGlobal.serieA[chave] : calGlobal.serieB[chave];

    let jogoAoVivo = null;
    if (jogosDaDivisao) {
        for (let j in jogosDaDivisao) {
            if (jogosDaDivisao[j].mandante === dadosUsuario.timeAtual || jogosDaDivisao[j].visitante === dadosUsuario.timeAtual) {
                meuJogoId = j; jogoAoVivo = jogosDaDivisao[j]; break;
            }
        }
    }

    let jaTerminouDeVerdade = false;
    let tempoPassadoMs = -1;
    const HORA_JOGO = isCopa ? 20 : 19;
    let horaInicioFake = new Date();

    if (jogoAoVivo) {
        let dataHoje = new Date();
        let [diaJ, mesJ] = (jogoAoVivo.data_jogo || "01/01").split(' ')[0].split('/');
        let jogoDT = new Date(dataHoje.getFullYear(), parseInt(mesJ)-1, parseInt(diaJ));
        jogoDT.setHours(0,0,0,0);
        let hojeDT = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), dataHoje.getDate());

        let isAtrasado = jogoDT < hojeDT;
        let isHoje = jogoDT.getTime() === hojeDT.getTime();
        let isFuturo = jogoDT > hojeDT; // Variável nova para bloquear jogos adiantados

        if (jogoAoVivo.horaInicio) {
            tempoPassadoMs = Date.now() - jogoAoVivo.horaInicio;
        }

        // 🟢 Correção de Sincronismo: Ignora tempos negativos para evitar que jogadores com relógio atrasado percam a TV
        let rodandoAoVivo = (jogoAoVivo.jogado && tempoPassadoMs <= 135000);
        jaTerminouDeVerdade = jogoAoVivo.jogado && !rodandoAoVivo;
    }

    const lblMandante = document.getElementById('placar-nome-mandante');
    const lblVisitante = document.getElementById('placar-nome-visitante');
    const cronometro = document.getElementById('tempo-jogo');
    const statusTransmissao = document.getElementById('status-transmissao');
    const narracao = document.getElementById('narracao-container');

    if (jogoAoVivo) {
            jogoAtual = jogoAoVivo;

            // 2️⃣ MÁGICA DA IMERSÃO: Background Absoluto para o Estádio não falhar!
            try {
                document.body.style.backgroundColor = "#000";
                document.body.style.backgroundImage = `linear-gradient(rgba(18, 18, 18, 0.40), rgba(18, 18, 18, 0.70)), url('${getEstadio(jogoAoVivo.mandante)}')`;
                document.body.style.backgroundPosition = "center";
                document.body.style.backgroundSize = "cover";
                document.body.style.backgroundAttachment = "fixed";

                // Removemos os fundos pretos da tela principal
                let containers = document.querySelectorAll('.main-content, .container, main, #app');
                containers.forEach(div => {
                    div.style.setProperty('background', 'transparent', 'important');
                    div.style.setProperty('background-color', 'transparent', 'important');
                });

                // 🟢 CAÇADOR DE JANELAS (Aplica o Efeito Vidro nas caixas da partida)
                let aplicarVidro = (elId) => {
                    let el = document.getElementById(elId);
                    if (!el) return;

                    // Busca a caixa principal em volta do texto/placar
                    let pai = el.closest('div[style*="background"], div[style*="border"]');
                    if (!pai) pai = el.parentElement; // Fallback

                    if (pai) {
                        pai.style.setProperty('background', 'rgba(18, 18, 18, 0.6)', 'important');
                        pai.style.setProperty('background-color', 'rgba(18, 18, 18, 0.6)', 'important');
                        pai.style.setProperty('backdrop-filter', 'blur(5px)', 'important');
                        pai.style.setProperty('-webkit-backdrop-filter', 'blur(5px)', 'important');
                        pai.style.setProperty('box-shadow', '0 8px 32px 0 rgba(0,0,0,0.5)', 'important');
                    }
                };

                // Executa a caçada exatamente onde o Placar e a Narração estão
                aplicarVidro('placar-nome-mandante');
                aplicarVidro('narracao-container');

                // Garante que o interior da lista de texto fique 100% transparente
                let boxNarracao = document.getElementById('narracao-container');
                if (boxNarracao) boxNarracao.style.setProperty('background', 'transparent', 'important');

            } catch(e) {}

        // 3️⃣ MÁGICA DOS ESCUDOS E NOMES DOS PLAYERS:
        if (lblMandante) {
            let donoM = window.treinadoresGlobais[jogoAoVivo.mandante] ? `👤 ${window.treinadoresGlobais[jogoAoVivo.mandante]}` : `🤖 IA`;
            lblMandante.innerHTML = `
                <div style="display:inline-flex; flex-direction:column; align-items:flex-end; vertical-align: middle;">
                    <span style="font-size: 22px; line-height:1;">${jogoAoVivo.mandante.replace(/_/g, ' ')}</span>
                    <span style="font-size: 11px; color:#ff8c00; margin-top:2px;">${donoM}</span>
                </div>
                <img src="${getEscudo(jogoAoVivo.mandante)}" onerror="this.src='esculdos/default.png'" style="width: 40px; height: 40px; object-fit: contain; vertical-align: middle; margin-left: 12px; filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));">
            `;
        }
        if (lblVisitante) {
            let donoV = window.treinadoresGlobais[jogoAoVivo.visitante] ? `👤 ${window.treinadoresGlobais[jogoAoVivo.visitante]}` : `🤖 IA`;
            lblVisitante.innerHTML = `
                <img src="${getEscudo(jogoAoVivo.visitante)}" onerror="this.src='esculdos/default.png'" style="width: 40px; height: 40px; object-fit: contain; vertical-align: middle; margin-right: 12px; filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));">
                <div style="display:inline-flex; flex-direction:column; align-items:flex-start; vertical-align: middle;">
                    <span style="font-size: 22px; line-height:1;">${jogoAoVivo.visitante.replace(/_/g, ' ')}</span>
                    <span style="font-size: 11px; color:#ff8c00; margin-top:2px;">${donoV}</span>
                </div>
            `;
        }

        let linhaObj = jogoAoVivo.linhaDoTempo || [];
        let linhaArray = Array.isArray(linhaObj) ? linhaObj : Object.values(linhaObj);

        let placarMReal = jogoAoVivo.placarMandante !== undefined ? jogoAoVivo.placarMandante : 0;
        let placarVReal = jogoAoVivo.placarVisitante !== undefined ? jogoAoVivo.placarVisitante : 0;

        if (jaTerminouDeVerdade) {
            document.getElementById('gols-mandante').innerText = placarMReal;
            document.getElementById('gols-visitante').innerText = placarVReal;

            if(cronometro) { cronometro.innerText = "FIM"; cronometro.style.color = "#dc3545"; }
            if(statusTransmissao) { statusTransmissao.innerText = "Partida Encerrada 🏁"; statusTransmissao.style.animation = "none"; }

            if(narracao) {
                if (linhaArray.length > 0) {
                    narracao.innerHTML = `<div style="text-align:center; padding: 10px; color:#ff8c00; font-weight:bold; border-bottom:1px solid #333; margin-bottom:10px;">Resumo da Partida:</div>`;
                    linhaArray.forEach(evento => {
                        let escudoID = evento.tipo.includes("mandante") ? jogoAoVivo.mandante : jogoAoVivo.visitante;
                        let escudoHTML = `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" class="escudo-mini">`;

                        let cor = '#ccc';
                        if (evento.tipo.includes('ataque_mandante')) cor = 'var(--verde-campo)';
                        if (evento.tipo.includes('ataque_visitante')) cor = '#ffc107';
                        if (evento.tipo.includes('gol_mandante')) cor = 'var(--verde-campo)';
                        if (evento.tipo.includes('gol_visitante')) cor = '#dc3545';
                        if (evento.tipo === 'penaltis') cor = '#ff8c00';
                        if (evento.tipo === 'intervalo' || evento.tipo === 'inicio') cor = '#007bff';

                        adicionarNarraçao(`${evento.minuto}'`, evento.texto, cor, (evento.tipo !== 'intervalo' && evento.tipo !== 'inicio' && evento.tipo !== 'penaltis') ? escudoID : null);
                    });
                } else { narracao.innerHTML = `<div style="text-align:center; padding: 20px; color:#aaa;">Partida sem lances computados (0x0).</div>`; }
            }

            if(!eventosJaTocados.has(`fim_${rodadaExibicao}`) && audioLiberado) {
                canalEfeitos.src = 'sounds/final_do_jogo.mp3'; canalEfeitos.play().catch(()=>{});
                canalTorcidaM.volume = 0.1; canalTorcidaV.volume = 0.1;
                eventosJaTocados.add(`fim_${rodadaExibicao}`);

                setTimeout(() => {
                    let somCampeao = (placarMReal > placarVReal) ? getHino(jogoAoVivo.mandante) : getHino(jogoAoVivo.visitante);
                    canalHino.src = somCampeao; canalHino.currentTime = 0; canalHino.volume = 0.2; canalHino.loop = true;
                    canalHino.play().catch(()=>{});
                }, 1500);
            }
        }
        else {
            // Variáveis injetadas para decidir o texto da tela
            let dataHoje = new Date();
            let [diaJ, mesJ] = (jogoAoVivo.data_jogo || "01/01").split(' ')[0].split('/');
            let jogoDT = new Date(dataHoje.getFullYear(), parseInt(mesJ)-1, parseInt(diaJ));
            jogoDT.setHours(0,0,0,0);
            let hojeDT = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), dataHoje.getDate());

            let isAtrasado = jogoDT < hojeDT;
            let isHoje = jogoDT.getTime() === hojeDT.getTime();
            let isFuturo = jogoDT > hojeDT;

            let isAntesDaHora = (isHoje && new Date().getHours() < HORA_JOGO);

            if (isFuturo) {
                if(statusTransmissao) statusTransmissao.innerText = "Em Breve 📅";
                if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;"><h3 style="color: #666;">Partida Agendada</h3><p>Este jogo ocorrerá em ${jogoAoVivo.data_jogo}. Volte na data correta!</p></div>`;
            }
            else if (isAntesDaHora && !isAtrasado) {
                const horaAtual = new Date().getHours();
                const minAtual = new Date().getMinutes();
                let portoesAbertos = (horaAtual === (HORA_JOGO - 1) && minAtual >= 40);

                if (portoesAbertos) {
                    if(statusTransmissao) statusTransmissao.innerText = "Aquecimento 🏃‍♂️";
                    if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;">Os jogadores estão aquecendo. A partida começa às ${HORA_JOGO}:00!</div>`;
                } else {
                    if(statusTransmissao) statusTransmissao.innerText = "Aguardando Horário ⏳";
                    if(narracao) narracao.innerHTML = `<div style="color: #aaa; text-align: center; padding: 30px;"><h3 style="color: #666;">Os portões estão fechados.</h3><p>A transmissão abrirá às ${HORA_JOGO - 1}:40.</p></div>`;
                }
            }
            else if (!jogoAoVivo.jogado) {
                // MÁGICA: DEU A HORA OU É UM JOGO ATRASADO. MOSTRA O BOTÃO CERTO!
                let txtBotao = isAtrasado ? "🚜 SIMULAR ATRASADOS" : "⚽ INICIAR PARTIDA";
                if(statusTransmissao) { statusTransmissao.innerText = "Aguardando Início ⏱️"; statusTransmissao.style.animation = "piscar 1s infinite"; }
                if(narracao) narracao.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <h3 style="color: #ff8c00;">As equipes estão preparadas!</h3>
                        <p style="color:#aaa; font-size:14px; margin-bottom:15px;">Seja o primeiro a iniciar a simulação oficial desta rodada.</p>
                        <button onclick="gerarPartidaAoVivo()" style="background: #dc3545; color: white; padding: 12px 25px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; box-shadow: 0 0 15px rgba(220,53,69,0.5);">${txtBotao}</button>
                    </div>`;
            }
            else if (!audioLiberado) {
                if(statusTransmissao) statusTransmissao.innerText = "Sinal Encontrado 📡";
                if(narracao) narracao.innerHTML = `<div style="text-align: center; padding: 30px;"><h3 style="color: #ff8c00;">A bola já está rolando!</h3><button onclick="liberarAudio()" style="background: var(--verde-campo); color: white; padding: 10px 20px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px;">▶️ ENTRAR NO ESTÁDIO</button></div>`;
            }
            else {
                // TRANSMISSÃO AO VIVO COM RELÓGIO ATIVO
                if(statusTransmissao) { statusTransmissao.innerText = "Ao Vivo 🔴"; statusTransmissao.style.animation = "piscar 1s infinite"; }

                // 🟢 Injeta os botões de aceleração acima da caixa de narração
                if(narracao && !document.getElementById('btn-vel-1')) {
                    narracao.insertAdjacentHTML('beforebegin', `
                    <div style="display:flex; justify-content:center; align-items:center; gap:5px; margin-bottom:10px; background:#111; padding:5px; border-radius:6px; border:1px solid #333;">
                        <span style="color:#aaa; font-size:12px; margin-right:5px;">Velocidade:</span>
                        <button onclick="mudarVelocidadeSimulacao(1)" id="btn-vel-1" style="background:var(--verde-campo); color:#fff; border:none; border-radius:3px; font-size:11px; padding:3px 10px; cursor:pointer;">1x</button>
                        <button onclick="mudarVelocidadeSimulacao(2)" id="btn-vel-2" style="background:#333; color:#fff; border:none; border-radius:3px; font-size:11px; padding:3px 10px; cursor:pointer;">2x</button>
                        <button onclick="mudarVelocidadeSimulacao(3)" id="btn-vel-3" style="background:#333; color:#fff; border:none; border-radius:3px; font-size:11px; padding:3px 10px; cursor:pointer;">3x</button>
                    </div>
                    `);
                }

                if (!canalTorcidaM.src || !canalTorcidaM.src.includes(jogoAoVivo.mandante.replace(/_/g, ' '))) {
                    canalTorcidaM.src = getTorcida(jogoAoVivo.mandante);
                    canalTorcidaV.src = getTorcida(jogoAoVivo.visitante);
                    canalTorcidaM.play().catch(()=>{}); canalTorcidaV.play().catch(()=>{});
                }

                // O pulo do gato: A TV agora usa o exato milissegundo em que o botão foi clicado!
                reproduzirLinhaDoTempo(linhaArray, jogoAoVivo.horaInicio, placarMReal, placarVReal);
            }
        }
    } else {
        if(lblMandante) lblMandante.innerHTML = "Folga"; if(lblVisitante) lblVisitante.innerHTML = "Folga";
        document.getElementById('gols-mandante').innerText = "-"; document.getElementById('gols-visitante').innerText = "-";
        if(cronometro) cronometro.innerText = "--'";
        if(statusTransmissao) statusTransmissao.innerText = "Sem Jogo";
        if(narracao) narracao.innerHTML = `<div style="text-align:center; padding: 30px; color:#aaa;">O seu clube não joga nesta rodada ou a fase sorteada ainda não tem confrontos.</div>`;
    }
}

function processarNarradorOficial() {
    if (narradorOficialOcupado || filaNarracaoOficial.length === 0) return;

    let evento = filaNarracaoOficial.shift();
    narradorOficialOcupado = true; // Tranca o narrador e o relógio visual!

    let isMandante = evento.tipo.includes("mandante");
    let isVisitante = evento.tipo.includes("visitante");
    let escudoID = isMandante ? jogoAtual.mandante : (isVisitante ? jogoAtual.visitante : null);

    let cor = '#ccc';
    if (evento.tipo.includes('ataque_mandante')) cor = 'var(--verde-campo)';
    if (evento.tipo.includes('ataque_visitante')) cor = '#ffc107';
    if (evento.tipo.includes('gol_mandante')) cor = 'var(--verde-campo)';
    if (evento.tipo.includes('gol_visitante')) cor = '#dc3545';
    if (evento.tipo === 'penaltis') cor = '#ff8c00';
    if (evento.tipo === 'intervalo' || evento.tipo === 'inicio') cor = '#007bff';
    if (evento.tipo === 'fim') cor = '#dc3545';

    let textoFinal = evento.texto;
    if (escudoID) {
        // Coloca a bandeira redondinha bem no começo do lance!
        let imgHtml = `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" style="width:16px; height:16px; vertical-align:middle; margin-right:5px; border-radius:50%;">`;
        textoFinal = imgHtml + textoFinal.replace("GOOOL DO", "GOOOL DO");
    }

    adicionarNarraçao(`${evento.minuto}'`, evento.texto, cor, (evento.tipo !== 'intervalo' && evento.tipo !== 'inicio' && evento.tipo !== 'penaltis') ? escudoID : null);

    if (evento.tipo === 'inicio') { somApito.play().catch(()=>{}); }

    if (evento.tipo.includes("gol")) {
        if (isMandante) {
            placarNarracaoM++; document.getElementById('gols-mandante').innerText = placarNarracaoM;
            if(audioLiberado) { canalTorcidaM.volume = 1.0; canalTorcidaV.volume = 0.0; }
        } else {
            placarNarracaoV++; document.getElementById('gols-visitante').innerText = placarNarracaoV;
            if(audioLiberado) { canalTorcidaM.volume = 0.0; canalTorcidaV.volume = 1.0; }
        }

        if(audioLiberado) {
            canalEfeitos.src = 'sounds/gol_generico.mp3'; canalEfeitos.play().catch(()=>{});
            setTimeout(() => { canalHino.src = getHino(escudoID); canalHino.volume = 0.4; canalHino.play().catch(()=>{}); }, 1500);

            // Pausa magistral de 12 segundos para o hino e festa no painel
            setTimeout(() => {
                canalHino.pause(); canalHino.currentTime = 0;
                atualizarTorcidasOficiais();
                narradorOficialOcupado = false;
                processarNarradorOficial();
            }, 12000);
        } else {
            setTimeout(() => { narradorOficialOcupado = false; processarNarradorOficial(); }, 2000);
        }
    } else {
        if (audioLiberado && evento.tipo.includes("ataque")) {
            if (isMandante) canalTorcidaM.volume = 0.8; else canalTorcidaV.volume = 0.8;
        }
        setTimeout(() => { atualizarTorcidasOficiais(); narradorOficialOcupado = false; processarNarradorOficial(); }, 3500);
    }
}
function adicionarNarraçao(tempo, texto, cor = "#ccc", escudoID = null) {
    const narracao = document.getElementById('narracao-container');
    if(!narracao) return;

    let imgHtml = escudoID ? `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" style="width:16px; height:16px; vertical-align:middle; margin-right:6px; border-radius:50%;">` : "";

    narracao.innerHTML += `
        <div style="margin-top:10px; border-bottom:1px dashed #333; padding-bottom:8px; display: flex; align-items: flex-start;">
            <strong style="color: ${cor}; font-size:15px; margin-right: 8px; flex-shrink:0;">${tempo}</strong>
            <span style="color: ${texto.includes('GOOOL') ? '#fff' : '#ccc'}; font-weight: ${texto.includes('GOOOL') ? 'bold' : 'normal'}; line-height: 1.4;">
                ${imgHtml}${texto}
            </span>
        </div>`;
    narracao.scrollTop = narracao.scrollHeight;
}

function processarNarradorOficial() {
    if (narradorOficialOcupado || filaNarracaoOficial.length === 0) return;

    let evento = filaNarracaoOficial.shift();
    narradorOficialOcupado = true; // Tranca o narrador e o relógio visual!

    let isMandante = evento.tipo.includes("mandante");
    let escudoID = isMandante ? jogoAtual.mandante : jogoAtual.visitante;

    let cor = '#ccc';
    if (evento.tipo.includes('ataque_mandante')) cor = 'var(--verde-campo)';
    if (evento.tipo.includes('ataque_visitante')) cor = '#ffc107';
    if (evento.tipo.includes('gol_mandante')) cor = 'var(--verde-campo)';
    if (evento.tipo.includes('gol_visitante')) cor = '#dc3545';
    if (evento.tipo === 'penaltis') cor = '#ff8c00';
    if (evento.tipo === 'intervalo' || evento.tipo === 'inicio') cor = '#007bff';

    adicionarNarraçao(`${evento.minuto}'`, evento.texto, cor, (evento.tipo !== 'intervalo' && evento.tipo !== 'inicio' && evento.tipo !== 'penaltis') ? escudoID : null);

    let velo = window.velocidadeSimulacao || 1;

    if (velo === 1 && evento.tipo === 'inicio') { somApito.play().catch(()=>{}); }

    if (evento.tipo.includes("gol")) {
        if (isMandante) {
            placarNarracaoM++; document.getElementById('gols-mandante').innerText = placarNarracaoM;
            if (velo === 1 && audioLiberado) { canalTorcidaM.volume = 1.0; canalTorcidaV.volume = 0.0; }
        } else {
            placarNarracaoV++; document.getElementById('gols-visitante').innerText = placarNarracaoV;
            if (velo === 1 && audioLiberado) { canalTorcidaM.volume = 0.0; canalTorcidaV.volume = 1.0; }
        }

        if(velo === 1 && audioLiberado) {
            // ✨ IMPORTA O LETREIRO DE GOL GIGANTE
            if (window.parent && window.parent.mostrarLetreiroGol) window.parent.mostrarLetreiroGol(escudoID);
            else if (window.mostrarLetreiroGol) window.mostrarLetreiroGol(escudoID);

            canalEfeitos.src = 'sounds/gol_generico.mp3'; canalEfeitos.play().catch(()=>{});
            setTimeout(() => { canalHino.src = getHino(escudoID); canalHino.volume = 0.4; canalHino.play().catch(()=>{}); }, 1500);

            setTimeout(() => {
                canalHino.pause(); canalHino.currentTime = 0;
                atualizarTorcidasOficiais();
                narradorOficialOcupado = false;
                processarNarradorOficial();
            }, 12000);
        } else {
            setTimeout(() => { narradorOficialOcupado = false; processarNarradorOficial(); }, 400 / velo); // ⚡ Acelerado e Mudo!
        }
    } else {
        if (velo === 1 && audioLiberado && evento.tipo.includes("ataque")) {
            if (isMandante) canalTorcidaM.volume = 0.8; else canalTorcidaV.volume = 0.8;
            setTimeout(() => { atualizarTorcidasOficiais(); narradorOficialOcupado = false; processarNarradorOficial(); }, 3500);
        } else {
            setTimeout(() => { narradorOficialOcupado = false; processarNarradorOficial(); }, 400 / velo); // ⚡ Acelerado
        }
    }
}

let oficialLoopTimeout;
window.velocidadeSimulacao = 1;



function adicionarNarraçao(tempo, texto, cor = "#ccc", escudoID = null) {
    const narracao = document.getElementById('narracao-container');
    if(!narracao) return;

    let imgHtml = escudoID ? `<img src="${getEscudo(escudoID)}" onerror="this.src='esculdos/default.png'" style="width:16px; height:16px; vertical-align:middle; margin-right:6px; border-radius:50%;">` : "";

    narracao.innerHTML += `
        <div style="margin-top:10px; border-bottom:1px dashed #333; padding-bottom:8px; display: flex; align-items: flex-start;">
            <strong style="color: ${cor}; font-size:15px; margin-right: 8px; flex-shrink:0;">${tempo}</strong>
            <span style="color: ${texto.includes('GOOOL') ? '#fff' : '#ccc'}; font-weight: ${texto.includes('GOOOL') ? 'bold' : 'normal'}; line-height: 1.4;">
                ${imgHtml}${texto}
            </span>
        </div>`;
    narracao.scrollTop = narracao.scrollHeight;
}

// FUNÇÃO GLOBAL DE VELOCIDADE
window.mudarVelocidadeSimulacao = function(v) {
    window.velocidadeSimulacao = v;
    if(document.getElementById('btn-vel-1')) document.getElementById('btn-vel-1').style.background = v === 1 ? 'var(--verde-campo)' : '#333';
    if(document.getElementById('btn-vel-2')) document.getElementById('btn-vel-2').style.background = v === 2 ? 'var(--verde-campo)' : '#333';
    if(document.getElementById('btn-vel-3')) document.getElementById('btn-vel-3').style.background = v === 3 ? 'var(--verde-campo)' : '#333';

    // Muta os audios instantaneamente
    if (v > 1 && typeof canalTorcidaM !== 'undefined') {
        canalTorcidaM.volume = 0;
        canalTorcidaV.volume = 0;
    }
};

// CONTROLE DO MENU MOBILE OTIMIZADO
function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    const menuAberto = sidebar.classList.toggle('aberta');
    if (menuAberto) document.body.classList.add('menu-aberto');
    else document.body.classList.remove('menu-aberto');
}

document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('aberta')) {
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('btn-menu')) {
            sidebar.classList.remove('aberta');
            document.body.classList.remove('menu-aberto');
        }
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

// ==========================================
// 🧠 MOTOR DE SIMULAÇÃO TÁTICA (ESTILO OSM)
// ==========================================

function calcularForcaRealJogador(j){
    let at = j.atributos || {ataque:5, defesa:5, forca:5, velocidade:5, habilidade:5};
    let base = (at.ataque + at.defesa + at.forca + at.velocidade + at.habilidade) / 5;
    let fadiga = j.fadiga || 0;
    let mult = 1 - (fadiga * 0.006); // Fadiga penaliza duramente
    return Math.max(base * mult, base * 0.6); // Máximo de 40% de perda por fadiga
}

function calcularForcaTime(titulares, mentalidade, estilo, moral, isMandante, ctAtivo, escudoAtivo) {
    let atk = 0, def = 0, meio = 0;
    let numJogadores = titulares.length || 1;

    // 1. Cálculo Base Setorizado
    titulares.forEach(j => {
        let fReal = calcularForcaRealJogador(j);
        let pos = j.posicoes?.p || "Meia";

        if (["Atacante", "Centroavante", "Ponta"].includes(pos)) {
            atk += fReal * 1.6;
            meio += fReal * 0.3;
        } else if (["Zagueiro", "Lateral"].includes(pos)) {
            def += fReal * 1.6;
            meio += fReal * 0.2;
        } else if (pos === "Goleiro") {
            def += fReal * 2.0; // Goleiro tem peso duplo na Defesa
        } else { // Meia, Volante
            meio += fReal * 1.5;
            atk += fReal * 0.5;
            def += fReal * 0.5;
        }
    });

    // Tira a média para não bugar o motor
    atk = atk / (numJogadores/11);
    def = def / (numJogadores/11);
    meio = meio / (numJogadores/11);

    // 2. Modificadores de Tática (Pedra, Papel e Tesoura)
    if (mentalidade === "Ofensivo" || mentalidade === "Ultra Ofensiva") { atk *= 1.30; def *= 0.80; }
    else if (mentalidade === "Defensivo" || mentalidade === "Retranca") { atk *= 0.80; def *= 1.30; }

    if (estilo === "Posse de Bola") { meio *= 1.30; atk *= 1.05; }
    else if (estilo === "Contra-Ataque") { atk *= 1.20; def *= 1.15; meio *= 0.80; }

    // 3. Modificadores de Condição (Moral e Mando de Campo)
    let multMoral = 0.6 + (moral/100) * 0.6; // 0 moral = 0.6x, 100 moral = 1.2x
    atk *= multMoral; def *= multMoral; meio *= multMoral;

    if (isMandante) { atk *= 1.15; def *= 1.15; meio *= 1.15; } // Caldeirão Ferve

    if (ctAtivo) { atk *= 1.05; def *= 1.05; meio *= 1.05; }
    if (escudoAtivo) { def *= 1.10; } // Treino Secreto foca em fechamento

    return { ataque: atk, defesa: def, meio: meio, total: atk + def + meio };
}

// Inteligência Artificial para Escolher Jogadores na Narração baseada no Setor
function escolherAtor(titulares, setor) {
    let validos = titulares.filter(j => !j.expulso);
    if(validos.length === 0) return { nome: "Jogador Desconhecido" };

    let pesos = validos.map(j => {
        let p = j.posicoes?.p || "Meia";
        if (setor === "Ataque" && ["Atacante", "Centroavante", "Ponta"].includes(p)) return 10;
        if (setor === "Ataque" && ["Meia"].includes(p)) return 3;
        if (setor === "Meio" && ["Meia", "Volante"].includes(p)) return 10;
        if (setor === "Defesa" && ["Zagueiro", "Lateral", "Volante"].includes(p)) return 10;
        if (setor === "Goleiro" && p === "Goleiro") return 100;
        return 1;
    });

    let total = pesos.reduce((a,b) => a+b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < validos.length; i++) {
        r -= pesos[i];
        if (r <= 0) return validos[i];
    }
    return validos[0];
}

function gerarLinhaDoTempoComplexa(jogo, times, usuarios, titularesM, titularesV, forcaM, forcaV) {
    let linha = [];
    let golsM = 0, golsV = 0;
    let cartoes = { M: [], V: [] };
    let expulsos = { M: [], V: [] };

    let climas = ["☀️ Dia ensolarado perfeito para o futebol", "⛅ Clima agradável, gramado impecável", "🌧️ Chuva forte, o campo está escorregadio!", "❄️ Frio intenso, jogo truncado"];
    linha.push({minuto: 0, tipo: "clima", texto: `🏟️ Estádio lotado! ${climas[Math.floor(Math.random()*climas.length)]}. O ${jogo.mandante.replace(/_/g,' ')} tem a força da torcida a seu favor!`});

    let minuto = 1;
    while (minuto <= 90) {
        minuto += Math.floor(Math.random() * 5) + 3; // Jogo avança de 3 a 7 minutos
        if (minuto > 90) break;

        // ==========================================
        // FASE 1: BATALHA DO MEIO CAMPO (POSSE DE BOLA)
        // ==========================================
        let dominioTotal = forcaM.meio + forcaV.meio;
        let chanceMandanteAtacar = (forcaM.meio / (dominioTotal || 1));

        let atacanteLetra = Math.random() < chanceMandanteAtacar ? "M" : "V";
        let defensorLetra = atacanteLetra === "M" ? "V" : "M";

        // Prepara os Status da Disputa
        let fAtk = atacanteLetra === "M" ? forcaM.ataque : forcaV.ataque;
        let fDef = atacanteLetra === "M" ? forcaV.defesa : forcaM.defesa;

        let titsAtk = atacanteLetra === "M" ? titularesM : titularesV;
        let titsDef = atacanteLetra === "M" ? titularesV : titularesM;

        let nomeAtk = atacanteLetra === "M" ? jogo.mandante.replace(/_/g,' ') : jogo.visitante.replace(/_/g,' ');
        let nomeDef = atacanteLetra === "M" ? jogo.visitante.replace(/_/g,' ') : jogo.mandante.replace(/_/g,' ');

        // Sorteia os Atores da Jogada
        let atorAtaque = escolherAtor(titsAtk, "Ataque");
        let atorMeio = escolherAtor(titsAtk, "Meio");
        let atorDefesa = escolherAtor(titsDef, "Defesa");
        let atorGK = escolherAtor(titsDef, "Goleiro") || {nome: "Goleiro"};

        // ==========================================
        // FASE 2: RESOLUÇÃO DO LANCE (ATAQUE VS DEFESA)
        // ==========================================
        let razaoForca = fAtk / (fDef || 1);
        razaoForca = Math.max(0.4, Math.min(razaoForca, 2.5)); // Limita absurdos matemáticos

        let RNG = Math.random(); // Fator Sorte (0 a 1)
        let poderOfensivoDoLance = razaoForca * RNG; // Equação Final do Lance!

        // 🏆 AVALIAÇÃO DO RESULTADO (Estilo OSM)
        if (poderOfensivoDoLance > 0.82) {
            // GOAL: O Ataque superou completamente a defesa
            let tipoGol = Math.random();
            let txtGol = "";
            if (tipoGol < 0.3) txtGol = `⚽ GOOOL! Que leitura de jogo de ${atorMeio.nome}, enfiando a bola para ${atorAtaque.nome}. Ele sai cara a cara e marca para o ${nomeAtk}!`;
            else if (tipoGol < 0.6) txtGol = `⚽ GOOOL DE CABEÇA! Cruzamento teleguiado pela lateral, ${atorAtaque.nome} sobe no terceiro andar e estufa a rede de ${atorGK.nome}!`;
            else if (tipoGol < 0.85) txtGol = `⚽ GOOOL! Bobeira inacreditável de ${atorDefesa.nome} na saída de bola, ${atorAtaque.nome} intercepta e manda uma bomba de fora da área!`;
            else txtGol = `🎯 PÊNALTI MARCADO! ${atorDefesa.nome} chega atrasado na área. ${atorAtaque.nome} vai para a cobrança, desloca ${atorGK.nome} e é ⚽ GOOOL do ${nomeAtk}!`;

            linha.push({minuto, tipo: atacanteLetra === "M" ? "gol_mandante" : "gol_visitante", texto: txtGol, jogador: atorAtaque.nome});
            if (atacanteLetra === "M") golsM++; else golsV++;

        } else if (poderOfensivoDoLance > 0.65) {
            // CHANCE PERIGOSA: Defesa do Goleiro ou Trave
            let txtQuase = Math.random() < 0.5 ?
                `🧤 DEFESAÇA! ${atorAtaque.nome} (${nomeAtk}) entra na área batendo forte, mas ${atorGK.nome} se estica todo e salva o ${nomeDef} com as pontas dos dedos!` :
                `💥 UUUHH! O ${nomeAtk} troca passes rápidos, ${atorAtaque.nome} arrisca um foguete de longe e a bola explode no travessão!`;
            linha.push({minuto, tipo: "posse", texto: txtQuase});

        } else if (poderOfensivoDoLance > 0.40) {
            // BATALHA FÍSICA: Faltas e Cartões no meio-campo
            if (Math.random() < 0.35) {
                let jaTemAmarelo = cartoes[defensorLetra].includes(atorDefesa.nome);
                if (jaTemAmarelo && Math.random() < 0.4) {
                    linha.push({minuto, tipo: "cartao_vermelho", texto: `🟥 VERMELHO! Segundo cartão! ${atorDefesa.nome} (${nomeDef}) faz falta tática e é expulso de campo!`, jogador: atorDefesa.nome});
                    expulsos[defensorLetra].push(atorDefesa.nome);
                    atorDefesa.expulso = true;
                    // A equipe com a menos é fortemente penalizada!
                    if (defensorLetra === "M") { forcaM.defesa *= 0.8; forcaM.meio *= 0.8; } else { forcaV.defesa *= 0.8; forcaV.meio *= 0.8; }
                } else {
                    linha.push({minuto, tipo: "cartao_amarelo", texto: `🟨 CARTÃO! ${atorDefesa.nome} (${nomeDef}) entra forte em ${atorAtaque.nome} para matar a jogada no meio.`, jogador: atorDefesa.nome});
                    cartoes[defensorLetra].push(atorDefesa.nome);
                }
            } else {
                linha.push({minuto, tipo: "falta", texto: `⚠️ ${atorMeio.nome} cadencia o jogo para o ${nomeAtk}, mas é parado com falta dura por ${atorDefesa.nome}.`});
            }
        } else {
            // DOMÍNIO DEFENSIVO: Desarme ou Impedimento
            let txtDefesa = Math.random() < 0.5 ?
                `🧱 Zaga impenetrável! ${atorAtaque.nome} tenta o drible em velocidade, mas ${atorDefesa.nome} (${nomeDef}) faz o desarme no tempo certo.` :
                `🚩 Impedimento! ${atorMeio.nome} encontra um belo passe, mas ${atorAtaque.nome} estava um passo à frente da linha do ${nomeDef}.`;
            linha.push({minuto, tipo: "posse", texto: txtDefesa});
        }
    }

    linha.push({minuto: 45, tipo: 'intervalo', texto: `⏱️ Fim do Primeiro Tempo! Análise tática nos vestiários. O placar marca ${golsM} x ${golsV}.`});
    linha.push({minuto: 46, tipo: 'inicio', texto: `🟢 Rola a bola para a etapa complementar! Veremos mudanças na postura das equipes?`});
    linha.push({minuto: 94, tipo: 'fim', texto: `🏁 APITO FINAL! As táticas e a força física decidiram o resultado: ${jogo.mandante.replace(/_/g,' ')} ${golsM} x ${golsV} ${jogo.visitante.replace(/_/g,' ')}.`});

    // Organiza a linha cronologicamente e remove falhas
    let unicos = []; let vistos = new Set();
    for(let ev of linha){ let chave = ev.minuto + '_' + ev.texto; if(!vistos.has(chave)){ vistos.add(chave); unicos.push(ev); } }
    unicos.sort((a,b)=> a.minuto - b.minuto);

    return {linha: unicos, golsM, golsV};
}

window.gerarPartida = async function(idJ, chave, isMataMata){
    try{
        if(window._travouSimulacao) return;
        window._travouSimulacao = true;
        let snapCal = await db.ref(`ligas/${ligaLogada}/calendario`).once('value');
        let cal = snapCal.val();
        let snapUsers = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
        let usuarios = snapUsers.val()||{};
        let snapTimes = await db.ref('banco_global_times').once('value');
        let times = snapTimes.val()||{};

        function getTitulares(timeId){
            let donoLogin = Object.keys(usuarios).find(u=> usuarios[u].timeAtual===timeId);
            let dono = donoLogin? usuarios[donoLogin] : null;
            let elenco = times[timeId]?.jogadores||{};
            if((dono?.titulares||[]).length<11) return montarEscalacaoIAInteligente(timeId, elenco);
            let reais = (dono.titulares||[]).map(id=> elenco[id]? {...elenco[id], id}:null).filter(j=>j&&j.atributos);
            return reais.length>=11? reais : montarEscalacaoIAInteligente(timeId, elenco);
        }

        let jogosParaSimular=[];
        if(isMataMata){
            for(let j in (cal.copa?.[chave]||{})){
                if(!cal.copa[chave][j].jogado) jogosParaSimular.push({id:j, caminho:`copa/${chave}`});
            }
        } else {
            let divNome = cal.serieA && cal.serieA[chave]? 'serieA':'serieB';
            let divObj = divNome==='serieA'? cal.serieA:cal.serieB;
            for(let j in (divObj?.[chave]||{})){
                if(!divObj[chave][j].jogado) jogosParaSimular.push({id:j, caminho:`${divNome}/${chave}`});
            }
        }
        if(jogosParaSimular.length===0){ window._travouSimulacao=false; return alert("Rodada já realizada!"); }

        let updates={};
        let tsAgora=Date.now();

        for(let item of jogosParaSimular){
            let caminhoDivisao=item.caminho;
            let idJAtual=item.id;
            let jogo = isMataMata? cal.copa[chave][idJAtual] : (caminhoDivisao.startsWith('serieA')? cal.serieA[chave][idJAtual] : cal.serieB[chave][idJAtual]);
            if(!jogo || jogo.jogado) continue;

            let titularesM=getTitulares(jogo.mandante);
            let titularesV=getTitulares(jogo.visitante);
            let donoMLogin=Object.keys(usuarios).find(u=> usuarios[u].timeAtual===jogo.mandante);
            let donoVLogin=Object.keys(usuarios).find(u=> usuarios[u].timeAtual===jogo.visitante);
            let donoM=donoMLogin? usuarios[donoMLogin]:null;
            let donoV=donoVLogin? usuarios[donoVLogin]:null;
            let forcaM=calcularForcaTime(titularesM, donoM?.mentalidade||"Equilibrado", donoM?.estilo||"Equilibrado", donoM?.moral||50, true, donoM?.ct_ativo, donoM?.escudo_rodada);
            let forcaV=calcularForcaTime(titularesV, donoV?.mentalidade||"Equilibrado", donoV?.estilo||"Equilibrado", donoV?.moral||50, false, donoV?.ct_ativo, donoV?.escudo_rodada);
            let res=gerarLinhaDoTempoComplexa(jogo, times, usuarios, titularesM, titularesV, forcaM, forcaV);

            // 📢 INJEÇÃO DO OFERECIMENTO DOS PATROCINADORES (TV AO VIVO)
            let patM = (donoM && donoM.patrocinio_ativo) ? donoM.patrocinio_ativo.empresa : null;
            let patV = (donoV && donoV.patrocinio_ativo) ? donoV.patrocinio_ativo.empresa : null;
            let txtPatrocinio = patM && patV ? `${patM} e ${patV}` : (patM || patV);

            if (txtPatrocinio) {
                res.linha.push({ minuto: 2, tipo: 'patrocinio', texto: `📺 Oferecimento: ${txtPatrocinio}. As melhores marcas apoiam o futebol nacional!` });
                res.linha.sort((a,b) => a.minuto - b.minuto);
            }

            jogo.linhaDoTempo=res.linha;
            jogo.horaInicio=tsAgora;
            jogo.placarMandante=res.golsM;
            jogo.placarVisitante=res.golsV;
            jogo.jogado=true;
            updates[`ligas/${ligaLogada}/calendario/${caminhoDivisao}/${idJAtual}`]=jogo;

            // 1. PROGRESSÃO DA COPA
            if (isMataMata) {
                let vencedor = res.golsM > res.golsV ? jogo.mandante : jogo.visitante;
                let num = parseInt(idJAtual.split('_')[1]);
                if (chave === "oitavas" && cal.copa.quartas) { let tgt = `jogo_${9 + Math.floor((num-1)/2)}`; num%2!==0 ? updates[`ligas/${ligaLogada}/calendario/copa/quartas/${tgt}/mandante`] = vencedor : updates[`ligas/${ligaLogada}/calendario/copa/quartas/${tgt}/visitante`] = vencedor; }
                else if (chave === "quartas" && cal.copa.semis) { let tgt = `jogo_${13 + Math.floor((num-9)/2)}`; num%2!==0 ? updates[`ligas/${ligaLogada}/calendario/copa/semis/${tgt}/mandante`] = vencedor : updates[`ligas/${ligaLogada}/calendario/copa/semis/${tgt}/visitante`] = vencedor; }
                else if (chave === "semis" && cal.copa.final) { let tgt = `jogo_15`; num===13 ? updates[`ligas/${ligaLogada}/calendario/copa/final/${tgt}/mandante`] = vencedor : updates[`ligas/${ligaLogada}/calendario/copa/final/${tgt}/visitante`] = vencedor; }
                else if (chave === "final") { updates[`ligas/${ligaLogada}/calendario/sistema_campeao_copa`] = vencedor; }
            }

            // 2. PAGAMENTO DE RENDA E PREMIAÇÃO + PATROCINADORES AO VIVO
            const processarPagamentosAoVivo = (loginDono, uObj, isMandante, golsFeitos, golsTomados) => {
                if (!loginDono || loginDono.startsWith('IA_') || !uObj) return;

                let caixaNovo = uObj.caixaClube || 0;

                // Bilheteria
                if (isMandante) {
                    let pub = 15000 + ((uObj.moral || 50) * 400);
                    caixaNovo += (pub * 60);
                }

                // Prêmio Base
                if (golsFeitos > golsTomados) caixaNovo += 3000000;
                else if (golsFeitos === golsTomados) caixaNovo += 1000000;

                // Patrocínio Master
                if (uObj.patrocinio_ativo && uObj.patrocinio_ativo.rodadas_restantes > 0) {
                    let pat = uObj.patrocinio_ativo;
                    let valorPago = (golsFeitos > golsTomados) ? pat.valVitoria : (golsFeitos === golsTomados ? pat.valEmpate : pat.valDerrota);

                    caixaNovo += valorPago;
                    pat.rodadas_restantes -= 1;

                    if (pat.rodadas_restantes <= 0) {
                        updates[`ligas/${ligaLogada}/usuarios/${loginDono}/patrocinio_ativo`] = null;
                        updates[`ligas/${ligaLogada}/caixa_mensagens/${loginDono}/msg_pat_${Date.now()}`] = {
                            tipo: 'recusa',
                            texto: `O seu contrato com a ${pat.empresa} encerrou. As finanças precisam de um novo Master, negocie já!`,
                            data: new Date().toISOString()
                        };
                    } else {
                        updates[`ligas/${ligaLogada}/usuarios/${loginDono}/patrocinio_ativo`] = pat;
                    }
                }

                updates[`ligas/${ligaLogada}/usuarios/${loginDono}/caixaClube`] = caixaNovo;
            };

            processarPagamentosAoVivo(donoMLogin, donoM, true, res.golsM, res.golsV);
            processarPagamentosAoVivo(donoVLogin, donoV, false, res.golsV, res.golsM);

            // 3. ATUALIZAÇÃO RÁPIDA DE ESTATÍSTICAS (Gols e Goleiro)
            let gkM = titularesM.find(j=>j.posicoes?.p==="Goleiro");
            let gkV = titularesV.find(j=>j.posicoes?.p==="Goleiro");

            if (gkM && times[jogo.mandante]?.jogadores?.[gkM.id]) {
                let jg = times[jogo.mandante].jogadores[gkM.id];
                jg.estatisticas = jg.estatisticas || {jogos:0, gols_sofridos:0};
                jg.estatisticas.jogos += 1;
                jg.estatisticas.gols_sofridos += res.golsV;
                updates[`banco_global_times/${jogo.mandante}/jogadores/${gkM.id}`] = jg;
            }
            if (gkV && times[jogo.visitante]?.jogadores?.[gkV.id]) {
                let jg = times[jogo.visitante].jogadores[gkV.id];
                jg.estatisticas = jg.estatisticas || {jogos:0, gols_sofridos:0};
                jg.estatisticas.jogos += 1;
                jg.estatisticas.gols_sofridos += res.golsM;
                updates[`banco_global_times/${jogo.visitante}/jogadores/${gkV.id}`] = jg;
            }

            res.linha.forEach(ev => {
                if (ev.tipo.includes('gol_') && ev.jogador) {
                    let isMandanteGol = ev.tipo.includes('mandante');
                    let timeId = isMandanteGol ? jogo.mandante : jogo.visitante;
                    let tits = isMandanteGol ? titularesM : titularesV;
                    let jogAlvo = tits.find(j => j.nome === ev.jogador);

                    if (jogAlvo && times[timeId]?.jogadores?.[jogAlvo.id]) {
                        let jg = times[timeId].jogadores[jogAlvo.id];
                        jg.estatisticas = jg.estatisticas || {gols:0, assistencias:0};
                        jg.estatisticas.gols = (jg.estatisticas.gols || 0) + 1;
                        jg.valor_mercado = (jg.valor_mercado || 1000000) + 250000;
                        updates[`banco_global_times/${timeId}/jogadores/${jogAlvo.id}`] = jg;
                    }
                }
            });
        }

        // 🛡️ BLINDAGEM ANTI-NAN: Evita o crash de dados antes de enviar para o Firebase!
        for (let chaveUpdate in updates) {
            let valorUpdate = updates[chaveUpdate];
            if (valorUpdate && typeof valorUpdate === "object") {
                if (valorUpdate.estatisticas) {
                    for (let propEstat in valorUpdate.estatisticas) {
                        if (isNaN(valorUpdate.estatisticas[propEstat])) {
                            valorUpdate.estatisticas[propEstat] = 0; // Transforma o veneno em 0!
                        }
                    }
                }
            }
        }

        await db.ref().update(updates);
        window._travouSimulacao=false;
        alert(`✅ Jogo Oficial Finalizado! Estatísticas, Caixa e Copa foram atualizados!`);
        location.reload();
    }catch(e){ window._travouSimulacao=false; console.error(e); alert("Erro: "+e.message); }
};

// IA INTELIGENTE - monta melhor 11 considerando fadiga
function montarEscalacaoIAInteligente(timeId, elencoObj){
    let elenco = Object.values(elencoObj).map((j, idx)=> ({...j, id: Object.keys(elencoObj)[idx]}));
    // Filtra goleiro
    let goleiros = elenco.filter(j=> j.posicoes?.p==="Goleiro").sort((a,b)=> calcularForcaRealJogador(b)-calcularForcaRealJogador(a));
    let zagueiros = elenco.filter(j=> j.posicoes?.p==="Zagueiro").sort((a,b)=> calcularForcaRealJogador(b)-calcularForcaRealJogador(a));
    let laterais = elenco.filter(j=> j.posicoes?.p==="Lateral").sort((a,b)=> calcularForcaRealJogador(b)-calcularForcaRealJogador(a));
    let volantes = elenco.filter(j=> j.posicoes?.p==="Volante").sort((a,b)=> calcularForcaRealJogador(b)-calcularForcaRealJogador(a));
    let meias = elenco.filter(j=> j.posicoes?.p==="Meia").sort((a,b)=> calcularForcaRealJogador(b)-calcularForcaRealJogador(a));
    let atacantes = elenco.filter(j=> ["Atacante","Centroavante","Ponta"].includes(j.posicoes?.p)).sort((a,b)=> calcularForcaRealJogador(b)-calcularForcaRealJogador(a));

    let titulares = [];
    if(goleiros[0]) titulares.push(goleiros[0]);
    titulares.push(...zagueiros.slice(0,2));
    titulares.push(...laterais.slice(0,2));
    titulares.push(...volantes.slice(0,1));
    titulares.push(...meias.slice(0,2));
    titulares.push(...atacantes.slice(0,3));
    // Completa com melhores restantes se faltar
    while(titulares.length<11 && elenco.length>titulares.length){
        let restantes = elenco.filter(j=> !titulares.some(t=> t.id===j.id)).sort((a,b)=> calcularForcaRealJogador(b)-calcularForcaRealJogador(a));
        if(restantes[0]) titulares.push(restantes[0]); else break;
    }
    return titulares.slice(0,11);
}
window.mostrarLetreiroGol = function(nomeTime) {
    let div = document.createElement('div');
    div.style.cssText = "position:fixed; top:25%; left:0; width:100%; text-align:center; z-index:99999; animation: pulsaGol 0.4s infinite alternate; pointer-events:none; text-shadow: 0 0 20px rgba(0,0,0,0.8);";
    div.innerHTML = `<h1 style="font-size: 80px; color: #fff; margin: 0; text-transform: uppercase; font-style: italic; letter-spacing: 5px;">⚽ GOOOOL!!!</h1><h2 style="font-size: 45px; color: #ffc107; text-shadow: 3px 3px 5px #000; margin: 0; text-transform: uppercase;">${nomeTime.replace(/_/g, ' ')}</h2>`;
    document.body.appendChild(div);
    if (!document.getElementById('style-gol-anim')) {
        let style = document.createElement('style');
        style.id = 'style-gol-anim';
        style.innerHTML = `@keyframes pulsaGol { from { transform: scale(0.95); opacity: 0.9; } to { transform: scale(1.05); opacity: 1; } }`;
        document.head.appendChild(style);
    }
    setTimeout(() => { div.style.transition = "opacity 0.5s"; div.style.opacity = "0"; setTimeout(() => div.remove(), 500); }, 4000);
};

window.gerarPartidaAoVivo = async function(){
  let idJ = meuJogoId;
  let exib = rodadaExibicao || `camp_rodada_${rodadaSistema}`;
  let isMata = exib.startsWith('copa_');
  let chave = isMata? exib.replace('copa_','') : exib.replace('camp_','');
  return await window.gerarPartida(idJ, chave, isMata);
};