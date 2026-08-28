// js/motor.js

const ligaMotor = localStorage.getItem('treinadorLiga');
const userLogadoMotor = localStorage.getItem('treinadorUsuario');

// Configuração de Horários (Partida às 20:00, Lock às 19:30)
const HORA_PARTIDA = 20;
const MINUTOS_PRE_JOGO = 30; // Minutos antes da HORA_PARTIDA para travar tudo e simular

if (ligaMotor && userLogadoMotor) {
    solicitarPermissaoNotificacao();
    iniciarMotorDescentralizado(ligaMotor);
}

function solicitarPermissaoNotificacao() {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

function dispararNotificacao(titulo, mensagem) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(titulo, { body: mensagem });
    }
}

// ========================================================
// 1. LOOP DO MOTOR P2P (GATILHO DE TEMPO)
// ========================================================
function iniciarMotorDescentralizado(liga) {
    checarRotinas(liga);
    // Checa silenciosamente a cada 3 minutos se a aba ficar aberta
    setInterval(() => checarRotinas(liga), 180000);
}

async function checarRotinas(liga) {
    const agora = new Date();
    const hora = agora.getHours();
    const minuto = agora.getMinutes();

    const ano = agora.getFullYear();
    const mes = (agora.getMonth() + 1).toString().padStart(2, '0');
    const dia = agora.getDate().toString().padStart(2, '0');
    const dataAtualStr = `${ano}-${mes}-${dia}`;

    let horaDeRodar = false;
    if (hora === (HORA_PARTIDA - 1) && minuto >= (60 - MINUTOS_PRE_JOGO)) horaDeRodar = true;
    if (hora >= HORA_PARTIDA) horaDeRodar = true;

    try {
        const snapData = await db.ref(`ligas/${liga}/sistema/ultima_simulacao`).once('value');
        const ultimaData = snapData.val();

        // Descobre a data de "Ontem"
        const ontem = new Date(agora);
        ontem.setDate(ontem.getDate() - 1);
        const ontemStr = `${ontem.getFullYear()}-${(ontem.getMonth() + 1).toString().padStart(2, '0')}-${ontem.getDate().toString().padStart(2, '0')}`;

        // DECISÃO DE RODAR O MOTOR:
        let rodarHoje = (horaDeRodar && ultimaData !== dataAtualStr); // Dá a hora e faz as coisas de hoje
        let rodarAtrasados = (!ultimaData || ultimaData < ontemStr);  // Abriu o site e tá devendo jogo

        if (!rodarHoje && !rodarAtrasados) return; // Se tá tudo em dia, descansa.

        const lockRef = db.ref(`ligas/${liga}/sistema/lock_simulacao`);
        lockRef.transaction((currentLock) => {
            if (currentLock === true) return;
            return true;
        }, (error, committed) => {
            if (committed) {
                console.log("🔥 MOTOR P2P: Iniciando varredura (Atrasados ou Rotina de Hoje)...");
                // Manda as variáveis novas para a função que faz a mágica
                processarTudo(liga, dataAtualStr, ontemStr, lockRef, horaDeRodar);
            }
        });
    } catch (e) {
        console.error("Falha no Motor P2P:", e);
    }
}
// ATENÇÃO: Mudamos a primeira linha (assinatura) da função!
async function processarTudo(liga, dataAtualStr, ontemStr, lockRef, horaDeRodar) {
    try {
        const snapTimesGlobais = await db.ref('banco_global_times').once('value');
        const times = snapTimesGlobais.val() || {};

        const snapUsuarios = await db.ref(`ligas/${liga}/usuarios`).once('value');
        const usuarios = snapUsuarios.val() || {};

        const snapCal = await db.ref(`ligas/${liga}/calendario`).once('value');
        const cal = snapCal.val();

        let updates = {};

        // --- PASSO A: RESOLVER O MERCADO E TROCAS ---
        const snapPropostas = await db.ref(`ligas/${liga}/mercado_propostas`).once('value');
        const propostas = snapPropostas.val();

        let transferenciasRealizadas = 0;

        // Roda o mercado apenas no horário oficial da noite
        if (propostas && horaDeRodar) {
            for (let idAlvo in propostas) {
                let lances = propostas[idAlvo];
                let maiorScore = 0;
                let lanceVencedor = null;
                let loginVencedor = "";

                let timeDoAlvo = null;
                let dadosDoAlvo = null;
                for (let t in times) {
                    if (times[t].jogadores && times[t].jogadores[idAlvo]) {
                        timeDoAlvo = t;
                        dadosDoAlvo = times[t].jogadores[idAlvo];
                        break;
                    }
                }

                if (!dadosDoAlvo) continue;
                let valorMinimoIA = dadosDoAlvo.valor_mercado * 0.9;

                for (let login in lances) {
                    let lance = lances[login];
                    let scoreLance = lance.valor_oferecido || 0;

                    let dadosJogadorOferecido = null;
                    if (lance.id_jogador_oferecido) {
                        dadosJogadorOferecido = times[lance.time_comprador].jogadores[lance.id_jogador_oferecido];
                        if (dadosJogadorOferecido) {
                            scoreLance += dadosJogadorOferecido.valor_mercado;
                        }
                    }

                    if (scoreLance > maiorScore && scoreLance >= valorMinimoIA) {
                        maiorScore = scoreLance;
                        lanceVencedor = lance;
                        loginVencedor = login;
                        lanceVencedor.dados_jogador_oferecido = dadosJogadorOferecido;
                    }
                }

                if (lanceVencedor && usuarios[loginVencedor].caixaClube >= lanceVencedor.valor_oferecido) {
                    let timeNovo = lanceVencedor.time_comprador;
                    transferenciasRealizadas++;

                    usuarios[loginVencedor].caixaClube -= lanceVencedor.valor_oferecido;
                    updates[`ligas/${liga}/usuarios/${loginVencedor}/caixaClube`] = usuarios[loginVencedor].caixaClube;

                    updates[`banco_global_times/${timeDoAlvo}/jogadores/${idAlvo}`] = null;
                    updates[`banco_global_times/${timeNovo}/jogadores/${idAlvo}`] = dadosDoAlvo;

                    if (lanceVencedor.id_jogador_oferecido && lanceVencedor.dados_jogador_oferecido) {
                        updates[`banco_global_times/${timeNovo}/jogadores/${lanceVencedor.id_jogador_oferecido}`] = null;
                        updates[`banco_global_times/${timeDoAlvo}/jogadores/${lanceVencedor.id_jogador_oferecido}`] = lanceVencedor.dados_jogador_oferecido;
                    }
                }
            }
            updates[`ligas/${liga}/mercado_propostas`] = null;
        }

        // --- PASSO B: FORMATURA DOS PRO PLAYERS (A PARTIR DA 5ª RODADA) ---
        let rodadaAtual = cal ? (cal.rodadaAtual || 1) : 1;

        if (rodadaAtual >= 5 && horaDeRodar) {
            const snapProPlayers = await db.ref(`ligas/${liga}/pro_players`).once('value');
            const proPlayers = snapProPlayers.val();

            if (proPlayers) {
                for (let criador in proPlayers) {
                    let p = proPlayers[criador];

                    if (p.status === "avaliando") {
                        let at = p.atributos_base;

                        // O Criador conta como o voto número 1
                        let qtdVotos = 1;
                        let sA = at.ataque, sD = at.defesa, sF = at.forca, sV = at.velocidade, sH = at.habilidade;

                        if (p.avaliacoes) {
                            for (let v in p.avaliacoes) {
                                sA += p.avaliacoes[v].ataque || 60;
                                sD += p.avaliacoes[v].defesa || 60;
                                sF += p.avaliacoes[v].forca || 60;
                                sV += p.avaliacoes[v].velocidade || 60;
                                sH += p.avaliacoes[v].habilidade || 60;
                                qtdVotos++;
                            }
                        }

                        // Calcula a média exata (Criador + Comunidade)
                        let finalAtq = Math.round(sA / qtdVotos);
                        let finalDef = Math.round(sD / qtdVotos);
                        let finalFor = Math.round(sF / qtdVotos);
                        let finalVel = Math.round(sV / qtdVotos);
                        let finalHab = Math.round(sH / qtdVotos);

                        let ovrFinal = finalAtq + finalDef + finalFor + finalVel + finalHab;
                        let valorMercado = ovrFinal * 150000;

                        let jogadorPronto = {
                            nome: p.nome + " (PRO)",
                            posicoes: { p: p.posicao, s: "IND", t: "IND" },
                            atributos: { ataque: finalAtq, defesa: finalDef, forca: finalFor, velocidade: finalVel, habilidade: finalHab },
                            valor_mercado: valorMercado,
                            pro_player: true
                        };

                        let idUnico = "PRO_" + criador;
                        updates[`banco_global_times/Agentes_Livres/divisao`] = "Livre";
                        updates[`banco_global_times/Agentes_Livres/jogadores/${idUnico}`] = jogadorPronto;

                        let notaConvertida = (ovrFinal / 300) * 5;
                        updates[`ligas/${liga}/pro_players/${criador}/status`] = "mercado";
                        updates[`ligas/${liga}/pro_players/${criador}/ovr_final`] = ovrFinal;
                        updates[`ligas/${liga}/pro_players/${criador}/nota_comunidade`] = notaConvertida.toFixed(1);
                    }
                }
            }
        }

        // --- PASSO C: MOTOR DE CALENDÁRIO INTELIGENTE ---
        if (cal) {
            const agoraDT = new Date();
            let teveJogoLiga = false;

            const processarPartidaAoVivo = (jogo, isMataMata = false) => {
                if (jogo.jogado) return;

                let donoM = null; let donoV = null;
                let forcaM = times[jogo.mandante]?.forca_base || 500;
                let forcaV = times[jogo.visitante]?.forca_base || 500;
                let mentM = "Moderado"; let mentV = "Moderado";

                for (let u in usuarios) {
                    if (usuarios[u].timeAtual === jogo.mandante) { if (usuarios[u].forcaAtual) forcaM = usuarios[u].forcaAtual; mentM = usuarios[u].mentalidade || "Moderado"; donoM = u; }
                    if (usuarios[u].timeAtual === jogo.visitante) { if (usuarios[u].forcaAtual) forcaV = usuarios[u].forcaAtual; mentV = usuarios[u].mentalidade || "Moderado"; donoV = u; }
                }

                let fadigaM = (times[jogo.mandante]?.jogadores && Object.keys(times[jogo.mandante].jogadores).length > 11) ? 1.0 : 0.85;
                let fadigaV = (times[jogo.visitante]?.jogadores && Object.keys(times[jogo.visitante].jogadores).length > 11) ? 1.0 : 0.85;

                let modM = 1.0 * fadigaM; let modV = 1.0 * fadigaV;
                let capGolsM = 99; let capGolsV = 99;

                if (mentM === "Retranca") { modM *= 0.7; modV *= 0.5; capGolsM = 1; }
                if (mentM === "Ofensivo") { modM *= 1.3; modV *= 1.2; }
                if (mentV === "Retranca") { modV *= 0.7; modM *= 0.5; capGolsV = 1; }
                if (mentV === "Ofensivo") { modV *= 1.3; modM *= 1.2; }

                let golsM = 0; let golsV = 0;
                let linhaTempo = [];

                if (fadigaM === 1.0) linhaTempo.push({ minuto: Math.floor(Math.random() * 10) + 60, tipo: "sub", texto: `🔄 Substituição no ${jogo.mandante.replace(/_/g,' ')}: Fôlego novo vindo do banco!`, cor: "#aaa" });
                if (fadigaV === 1.0) linhaTempo.push({ minuto: Math.floor(Math.random() * 10) + 60, tipo: "sub", texto: `🔄 Substituição no ${jogo.visitante.replace(/_/g,' ')}: Alteração para dar gás na equipe!`, cor: "#aaa" });

                const sortearAtleta = (tId) => { let el = times[tId]?.jogadores ? Object.keys(times[tId].jogadores) : []; return el.length ? el[Math.floor(Math.random() * el.length)] : null; };

                // NOVO: Identifica os goleiros da partida para registrar a estatística
                let gkM_id = Object.keys(times[jogo.mandante]?.jogadores || {}).find(k => times[jogo.mandante].jogadores[k].posicoes?.p === "Goleiro");
                let gkV_id = Object.keys(times[jogo.visitante]?.jogadores || {}).find(k => times[jogo.visitante].jogadores[k].posicoes?.p === "Goleiro");

                if (gkM_id) {
                    let gkM = times[jogo.mandante].jogadores[gkM_id];
                    gkM.estatisticas = gkM.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0};
                    gkM.estatisticas.jogos = (gkM.estatisticas.jogos || 0) + 1;
                    updates[`banco_global_times/${jogo.mandante}/jogadores/${gkM_id}`] = gkM;
                }
                if (gkV_id) {
                    let gkV = times[jogo.visitante].jogadores[gkV_id];
                    gkV.estatisticas = gkV.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0};
                    gkV.estatisticas.jogos = (gkV.estatisticas.jogos || 0) + 1;
                    updates[`banco_global_times/${jogo.visitante}/jogadores/${gkV_id}`] = gkV;
                }

                for(let i=0; i<5; i++) {
                    if (golsM < capGolsM && Math.random() < ((forcaM / (forcaM + forcaV)) * modM * 0.6)) {
                        golsM++;

                        // Punição pro Goleiro Visitante
                        if (gkV_id) {
                            let gkV = times[jogo.visitante].jogadores[gkV_id];
                            gkV.estatisticas.gols_sofridos = (gkV.estatisticas.gols_sofridos || 0) + 1;
                            updates[`banco_global_times/${jogo.visitante}/jogadores/${gkV_id}`] = gkV;
                        }

                        let idA = sortearAtleta(jogo.mandante);
                        let nA = idA ? times[jogo.mandante].jogadores[idA].nome : "Jogador";
                        if(idA) {
                            let jg = times[jogo.mandante].jogadores[idA];
                            jg.estatisticas = jg.estatisticas || {gols:0, assistencias:0}; jg.estatisticas.gols++; jg.valor_mercado = (jg.valor_mercado||1000000) + 1000000;

                            // Assistência Mandante
                            if (Math.random() > 0.4) {
                                let idAst = sortearAtleta(jogo.mandante);
                                if (idAst && idAst !== idA) {
                                    let jgAst = times[jogo.mandante].jogadores[idAst];
                                    jgAst.estatisticas = jgAst.estatisticas || {gols:0, assistencias:0}; jgAst.estatisticas.assistencias++;
                                    updates[`banco_global_times/${jogo.mandante}/jogadores/${idAst}`] = jgAst;
                                }
                            }
                            updates[`banco_global_times/${jogo.mandante}/jogadores/${idA}`] = jg;
                        }
                        linhaTempo.push({ minuto: Math.floor(Math.random()*90)+1, tipo: "gol_mandante", texto: `⚽ GOOOL DO ${jogo.mandante.replace(/_/g,' ')}! (${nA})`, cor: "#ff8c00" });
                    }
                    if (golsV < capGolsV && Math.random() < ((forcaV / (forcaM + forcaV)) * modV * 0.6)) {
                        golsV++;
                        let idA = sortearAtleta(jogo.visitante);
                        let nA = idA ? times[jogo.visitante].jogadores[idA].nome : "Jogador";
                        if(idA) {
                            let jg = times[jogo.visitante].jogadores[idA];
                            jg.estatisticas = jg.estatisticas || {gols:0, assistencias:0}; jg.estatisticas.gols++; jg.valor_mercado = (jg.valor_mercado||1000000) + 1000000;

                            // Assistência Visitante
                            if (Math.random() > 0.4) {
                                let idAst = sortearAtleta(jogo.visitante);
                                if (idAst && idAst !== idA) {
                                    let jgAst = times[jogo.visitante].jogadores[idAst];
                                    jgAst.estatisticas = jgAst.estatisticas || {gols:0, assistencias:0}; jgAst.estatisticas.assistencias++;
                                    updates[`banco_global_times/${jogo.visitante}/jogadores/${idAst}`] = jgAst;
                                }
                            }
                            updates[`banco_global_times/${jogo.visitante}/jogadores/${idA}`] = jg;
                        }
                        linhaTempo.push({ minuto: Math.floor(Math.random()*90)+1, tipo: "gol_visitante", texto: `⚽ GOOOL DO ${jogo.visitante.replace(/_/g,' ')}! (${nA})`, cor: "#ff8c00" });
                    }

                    if (gkM_id) {
                        let gkM = times[jogo.mandante].jogadores[gkM_id];
                        gkM.estatisticas.gols_sofridos = (gkM.estatisticas.gols_sofridos || 0) + 1;
                        updates[`banco_global_times/${jogo.mandante}/jogadores/${gkM_id}`] = gkM;
                    }
                }

                if (isMataMata && golsM === golsV) {
                    linhaTempo.push({ minuto: 95, tipo: "penaltis", texto: `⚖️ Fim de Jogo Empatado! A decisão vai para os PÊNALTIS!`, cor: "#dc3545" });
                    if (Math.random() > 0.5) { golsM++; linhaTempo.push({ minuto: 99, tipo: "penaltis_vence", texto: `🏆 O ${jogo.mandante.replace(/_/g,' ')} VENCEU A DISPUTA DE PÊNALTIS!`, cor: "var(--verde-campo)" }); }
                    else { golsV++; linhaTempo.push({ minuto: 99, tipo: "penaltis_vence", texto: `🏆 O ${jogo.visitante.replace(/_/g,' ')} VENCEU A DISPUTA DE PÊNALTIS!`, cor: "var(--verde-campo)" }); }
                }

                linhaTempo.sort((a,b) => a.minuto - b.minuto);

                if (donoM) {
                    let pub = 15000 + ((usuarios[donoM].moral||50) * 400); let ren = pub * 60;
                    usuarios[donoM].caixaClube += ren; updates[`ligas/${liga}/usuarios/${donoM}/caixaClube`] = usuarios[donoM].caixaClube;
                    linhaTempo.unshift({ minuto: 0, tipo: "renda", texto: `🎟️ Renda: R$ ${ren.toLocaleString('pt-BR')} (${pub.toLocaleString('pt-BR')} pagantes)`, cor: "#888" });
                }

                if (golsM > golsV) { if(donoM) updates[`ligas/${liga}/usuarios/${donoM}/moral`] = Math.min(100, (usuarios[donoM].moral||50)+10); if(donoV) updates[`ligas/${liga}/usuarios/${donoV}/moral`] = Math.max(0, (usuarios[donoV].moral||50)-10); }
                else if (golsV > golsM) { if(donoV) updates[`ligas/${liga}/usuarios/${donoV}/moral`] = Math.min(100, (usuarios[donoV].moral||50)+10); if(donoM) updates[`ligas/${liga}/usuarios/${donoM}/moral`] = Math.max(0, (usuarios[donoM].moral||50)-10); }

                let dataInicio = new Date(); dataInicio.setHours(HORA_PARTIDA, 0, 0, 0);
                jogo.linhaDoTempo = linhaTempo; jogo.horaInicio = dataInicio.getTime();
                jogo.placarMandante = golsM; jogo.placarVisitante = golsV;
                jogo.jogado = true; // JOGO OFICIALIZADO E ENCERRADO!
            };

            let proximaRodada = cal.rodadaAtual || 1;
            const hojeDT = new Date(); hojeDT.setHours(0,0,0,0);

            // 1. VARRE A LIGA (Inteligência: Atrados rodam agora. O de hoje respeita a hora)
            for (let r = 1; r <= 38; r++) {
                let rodadaKey = `rodada_${r}`;

                const checarE_Simular = (divisaoObj) => {
                    if (!divisaoObj || !divisaoObj[rodadaKey]) return;
                    for (let j in divisaoObj[rodadaKey]) {
                        let jogo = divisaoObj[rodadaKey][j];

                        // Ajuste para não deixar jogo órfão do "limbo"
                        if (jogo.linhaDoTempo && jogo.jogado === false) jogo.jogado = true;

                        if (!jogo.jogado && !jogo.linhaDoTempo && jogo.data_jogo) {
                            let dataJogoStr = jogo.data_jogo.split(' ')[0];
                            let [dJ, mJ] = dataJogoStr.split('/');
                            let jogoDT = new Date(hojeDT.getFullYear(), parseInt(mJ) - 1, parseInt(dJ));
                            jogoDT.setHours(0,0,0,0);

                            // O TRATOR: Se for de ONTEM pra trás (Atrasado), RODA NA HORA. Se for de HOJE, só se 'horaDeRodar' for true.
                            if (jogoDT < hojeDT || (jogoDT.getTime() === hojeDT.getTime() && horaDeRodar)) {
                                processarPartidaAoVivo(jogo, false);
                                teveJogoLiga = true;
                                if (r >= proximaRodada) proximaRodada = r + 1;
                            }
                        }
                    }
                };
                checarE_Simular(cal.serieA);
                checarE_Simular(cal.serieB);
            }

            if (teveJogoLiga && proximaRodada <= 38) {
                cal.rodadaAtual = proximaRodada;
            }

            // 2. VARRE A COPA
            if (cal.copa) {
                let fasesMata = ["oitavas", "quartas", "semis", "final", "mundial"];
                for (let f of fasesMata) {
                    if (cal.copa[f]) {
                        for (let idJ in cal.copa[f]) {
                            let jogo = cal.copa[f][idJ];

                            if (!jogo.jogado && !jogo.linhaDoTempo && jogo.data_jogo && !jogo.mandante.includes("Vencedor") && !jogo.visitante.includes("Vencedor")) {
                                let dataJogoStr = jogo.data_jogo.split(' ')[0];
                                let [dJ, mJ] = dataJogoStr.split('/');
                                let jogoDT = new Date(hojeDT.getFullYear(), parseInt(mJ) - 1, parseInt(dJ));
                                jogoDT.setHours(0,0,0,0);

                                if (jogoDT < hojeDT || (jogoDT.getTime() === hojeDT.getTime() && horaDeRodar)) {
                                    processarPartidaAoVivo(jogo, true); // True = Pênaltis

                                    let vencedor = jogo.placarMandante > jogo.placarVisitante ? jogo.mandante : jogo.visitante;
                                    let num = parseInt(idJ.split('_')[1]);

                                    if (f === "oitavas" && cal.copa.quartas) { let tgt = `jogo_${9 + Math.floor((num-1)/2)}`; num%2!==0 ? cal.copa.quartas[tgt].mandante = vencedor : cal.copa.quartas[tgt].visitante = vencedor; }
                                    else if (f === "quartas" && cal.copa.semis) { let tgt = `jogo_${13 + Math.floor((num-9)/2)}`; num%2!==0 ? cal.copa.semis[tgt].mandante = vencedor : cal.copa.semis[tgt].visitante = vencedor; }
                                    else if (f === "semis" && cal.copa.final) { let tgt = `jogo_15`; num===13 ? cal.copa.final[tgt].mandante = vencedor : cal.copa.final[tgt].visitante = vencedor; }
                                    else if (f === "final") { cal.sistema_campeao_copa = vencedor; }
                                }
                            }
                        }
                    }
                }
            }
            let rodadaFinalJogada = (cal.serieA && cal.serieA["rodada_38"]) ? Object.values(cal.serieA["rodada_38"]).every(x => x.jogado === true) : false;
            let copaFinalJogada = (cal.copa && cal.copa.final && cal.copa.final["jogo_15"]) ? cal.copa.final["jogo_15"].jogado === true : false;

            if (rodadaFinalJogada && copaFinalJogada && !cal.temporada_encerrada && cal.copa && cal.copa.mundial) {
                let mundial = cal.copa.mundial["jogo_mundial"];

                if (mundial.mandante === "Campeão Nacional") {
                    // Calcula o Campeão da Liga baseada em pontos da rodada 38
                    let pts={};
                    for(let r=1; r<=38; r++) {
                        for(let k in cal.serieA[`rodada_${r}`]) {
                            let jj = cal.serieA[`rodada_${r}`][k];
                            if(jj.jogado && jj.mandante!=="Fantasma") {
                                if(!pts[jj.mandante]) pts[jj.mandante] = {p:0, v:0, sg:0}; if(!pts[jj.visitante]) pts[jj.visitante] = {p:0, v:0, sg:0};
                                if(jj.placarMandante>jj.placarVisitante){ pts[jj.mandante].p+=3; pts[jj.mandante].v++; }
                                else if(jj.placarVisitante>jj.placarMandante){ pts[jj.visitante].p+=3; pts[jj.visitante].v++; }
                                else { pts[jj.mandante].p+=1; pts[jj.visitante].p+=1; }
                                pts[jj.mandante].sg += (jj.placarMandante - jj.placarVisitante);
                                pts[jj.visitante].sg += (jj.placarVisitante - jj.placarMandante);
                            }
                        }
                    }
                    let campeaoLiga = Object.keys(pts).sort((a,b) => pts[b].p - pts[a].p || pts[b].v - pts[a].v || pts[b].sg - pts[a].sg)[0];
                    let campeaoCopa = cal.sistema_campeao_copa;

                    if (campeaoLiga === campeaoCopa) {
                        mundial.jogado = true; mundial.mandante = campeaoLiga; mundial.visitante = "N/A (Coroa Dupla)";
                        registrarHallDaFama(liga, campeaoLiga, campeaoCopa, campeaoLiga, usuarios);
                        cal.temporada_encerrada = true;
                    } else {
                        mundial.mandante = campeaoLiga; mundial.visitante = campeaoCopa;
                    }
                } else if (mundial.jogado === true && !cal.temporada_encerrada) {
                    let vencedorMundial = mundial.placarMandante > mundial.placarVisitante ? mundial.mandante : mundial.visitante;
                    registrarHallDaFama(liga, mundial.mandante, mundial.visitante, vencedorMundial, usuarios);
                    cal.temporada_encerrada = true;
                }

                // 🏆 SISTEMA DE RECOMPENSAS (BÔNUS DE +5 PONTOS)
                if (cal.temporada_encerrada) {
                    let todosJgs = [];
                    for (let t in times) {
                        if (times[t].jogadores) {
                            for (let j in times[t].jogadores) {
                                let jog = times[t].jogadores[j];
                                jog.idBanco = j; jog.timeBanco = t;
                                todosJgs.push(jog);
                            }
                        }
                    }

                    // 1. Top 3 Artilheiros (+5 Ataque)
                    let arts = [...todosJgs].filter(j => j.estatisticas && j.estatisticas.gols > 0).sort((a,b) => b.estatisticas.gols - a.estatisticas.gols).slice(0, 3);
                    arts.forEach(j => {
                        let novoValor = Math.min(99, (j.atributos.ataque || 60) + 5);
                        updates[`banco_global_times/${j.timeBanco}/jogadores/${j.idBanco}/atributos/ataque`] = novoValor;
                    });

                    // 2. Top 3 Assistências (+5 Habilidade)
                    let asts = [...todosJgs].filter(j => j.estatisticas && j.estatisticas.assistencias > 0).sort((a,b) => b.estatisticas.assistencias - a.estatisticas.assistencias).slice(0, 3);
                    asts.forEach(j => {
                        let novoValor = Math.min(99, (j.atributos.habilidade || 60) + 5);
                        updates[`banco_global_times/${j.timeBanco}/jogadores/${j.idBanco}/atributos/habilidade`] = novoValor;
                    });

                    // 3. Top 3 Goleiros Menos Vazados (+5 Defesa) -> Precisa ter jogado pelo menos 5 partidas
                    let gks = [...todosJgs].filter(j => j.posicoes && j.posicoes.p === "Goleiro" && j.estatisticas && j.estatisticas.jogos >= 5);
                    gks.sort((a,b) => (a.estatisticas.gols_sofridos || 0) - (b.estatisticas.gols_sofridos || 0)).slice(0, 3).forEach(j => {
                        let novoValor = Math.min(99, (j.atributos.defesa || 60) + 5);
                        updates[`banco_global_times/${j.timeBanco}/jogadores/${j.idBanco}/atributos/defesa`] = novoValor;
                    });
                }
            }

            updates[`ligas/${liga}/calendario`] = cal;
        }

        // --- PASSO D: FINALIZAR E AVISAR ---
        if (horaDeRodar) {
            updates[`ligas/${liga}/sistema/ultima_simulacao`] = dataAtualStr;
        } else {
            updates[`ligas/${liga}/sistema/ultima_simulacao`] = ontemStr;
        }
        await db.ref().update(updates);
        await lockRef.set(false);

        console.log("✅ MOTOR P2P: Rotinas noturnas concluídas com sucesso!");

        if (transferenciasRealizadas > 0) {
            dispararNotificacao("Mercado Fechado! 🛒", "As negociações foram encerradas e jogadores foram transferidos.");
        }
        dispararNotificacao("Fim do Aquecimento! ⚽", "As escalações foram bloqueadas e os times estão prontos no túnel do estádio!");

    } catch (e) {
        console.error("Erro crítico no Motor P2P:", e);
        await lockRef.set(false);
    }
}

// ========================================================
// 3. GRAVAR NO HALL DA FAMA (FIM DA TEMPORADA)
// ========================================================
function registrarHallDaFama(liga, timeLiga, timeCopa, timeMundial, usuarios) {
    let donoL = "Sem Treinador"; let donoC = "Sem Treinador"; let donoM = "Sem Treinador";
    for(let u in usuarios) {
        if(usuarios[u].timeAtual === timeLiga) donoL = usuarios[u].nome || u;
        if(usuarios[u].timeAtual === timeCopa) donoC = usuarios[u].nome || u;
        if(usuarios[u].timeAtual === timeMundial) donoM = usuarios[u].nome || u;
    }
    let idTemp = "Temporada_" + new Date().getFullYear() + "_" + Math.floor(Math.random() * 1000);
    db.ref(`ligas/${liga}/historico_campeoes/${idTemp}`).set({
        nome_temporada: `Temporada Finalizada (${new Date().getFullYear()})`,
        campeao_serie_a: { time: timeLiga.replace(/_/g, ' '), treinador: donoL },
        campeao_copa: { time: timeCopa.replace(/_/g, ' '), treinador: donoC },
        campeao_mundial: { time: timeMundial.replace(/_/g, ' '), treinador: donoM }
    });
}

// ========================================================
// 4. SISTEMA GLOBAL DE NOTIFICAÇÕES (SINO CLICÁVEL)
// ========================================================
window.addEventListener('DOMContentLoaded', () => {
    carregarNotificacoesGlobais();
});

let dropdownAberto = false;
function toggleNotificacoes() {
    dropdownAberto = !dropdownAberto;
    const drop = document.getElementById('dropdown-notificacoes');
    if(drop) drop.style.display = dropdownAberto ? 'block' : 'none';
}

async function carregarNotificacoesGlobais() {
    const badge = document.getElementById('badge-notificacao');
    const lista = document.getElementById('lista-notificacoes-drop');

    // Só roda a função se a página atual possuir o ícone do sino nela
    if(!badge || !lista) return;

    db.ref(`ligas/${ligaMotor}`).on('value', async snapLiga => {
        const ligaDados = snapLiga.val();
        if(!ligaDados) return;

        let countNotif = 0;
        let htmlNotif = "";

        // CHECAGEM 1: AVALIAÇÕES PENDENTES (Olheiro)
        if (ligaDados.pro_players) {
            let avaliacoesFaltando = 0;
            for (let dono in ligaDados.pro_players) {
                if (dono === userLogadoMotor) continue; // Pula o seu próprio
                let p = ligaDados.pro_players[dono];
                if (!p.avaliacoes || !p.avaliacoes[userLogadoMotor]) {
                    avaliacoesFaltando++;
                }
            }
            if (avaliacoesFaltando > 0) {
                countNotif++;
                htmlNotif += `<div onclick="window.location.href='perfil.html'" style="background: #1a1a1a; padding: 10px; border-radius: 4px; border-left: 3px solid #00b853; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#1a1a1a'">
                    <strong style="color:#00b853; font-size:12px;">Olheiro Comunitário</strong><br>
                    <span style="color:#ccc; font-size:11px;">Você tem ${avaliacoesFaltando} promessa(s) para avaliar.</span>
                </div>`;
            }
        }

        // CHECAGEM 2: PROPOSTAS DE MERCADO
        if (ligaDados.mercado_propostas) {
            let meuTimeId = ligaDados.usuarios && ligaDados.usuarios[userLogadoMotor] ? ligaDados.usuarios[userLogadoMotor].timeAtual : null;

            if (meuTimeId && meuTimeId !== "Sem Clube") {
                const snapMeuTime = await db.ref(`banco_global_times/${meuTimeId}/jogadores`).once('value');
                const meusJogadores = snapMeuTime.val() || {};
                let propostasRecebidas = 0;

                for (let idJogador in ligaDados.mercado_propostas) {
                    if (meusJogadores[idJogador]) {
                        // Tenho proposta num jogador meu!
                        propostasRecebidas += Object.keys(ligaDados.mercado_propostas[idJogador]).length;
                    }
                }

                if (propostasRecebidas > 0) {
                    countNotif++;
                    htmlNotif += `<div onclick="window.location.href='mercado.html'" style="background: #1a1a1a; padding: 10px; border-radius: 4px; border-left: 3px solid #ff8c00; cursor: pointer; transition: 0.2s; margin-top: 5px;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#1a1a1a'">
                        <strong style="color:#ff8c00; font-size:12px;">Mercado da Bola</strong><br>
                        <span style="color:#ccc; font-size:11px;">O seu clube recebeu ${propostasRecebidas} oferta(s)!</span>
                    </div>`;
                }
            }
        }

        if (countNotif > 0) {
            badge.style.display = 'block';
            badge.innerText = countNotif;
            lista.innerHTML = htmlNotif;
        } else {
            badge.style.display = 'none';
            lista.innerHTML = `<span style="color:#888; font-size:12px;">Nenhuma novidade.</span>`;
        }
    });
}