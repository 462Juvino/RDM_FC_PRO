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
    const dataAtualStr = agora.toISOString().split('T')[0];

    // Verifica se estamos na janela de simulação (ex: depois das 19:30)
    let horaDeRodar = false;
    if (hora === (HORA_PARTIDA - 1) && minuto >= (60 - MINUTOS_PRE_JOGO)) horaDeRodar = true;
    if (hora >= HORA_PARTIDA) horaDeRodar = true;

    if (!horaDeRodar) return; // Ainda é cedo, não faz nada.

    try {
        const snapData = await db.ref(`ligas/${liga}/sistema/ultima_simulacao`).once('value');
        const ultimaData = snapData.val();

        // Se o evento de hoje AINDA NÃO ocorreu...
        if (ultimaData !== dataAtualStr) {
            const lockRef = db.ref(`ligas/${liga}/sistema/lock_simulacao`);

            // Tenta pegar a chave do servidor! (Evita duplicidade se 10 pessoas entrarem às 19:30)
            lockRef.transaction((currentLock) => {
                if (currentLock === true) return; // Alguém já pegou
                return true; // Eu peguei!
            }, (error, committed) => {
                if (committed) {
                    console.log("🔥 MOTOR P2P: Assumindo controle do servidor para a Liga: " + liga);
                    processarTudo(liga, dataAtualStr, lockRef);
                }
            });
        }
    } catch (e) {
        console.error("Falha no Motor P2P:", e);
    }
}

// ========================================================
// 2. A GRANDE ROTINA: MERCADO + TROCAS + JOGOS
// ========================================================
async function processarTudo(liga, dataAtualStr, lockRef) {
    try {
        const snapTimesGlobais = await db.ref('banco_global_times').once('value');
        const times = snapTimesGlobais.val() || {};

        const snapUsuarios = await db.ref(`ligas/${liga}/usuarios`).once('value');
        const usuarios = snapUsuarios.val() || {};

        let updates = {};

        // --- PASSO A: RESOLVER O MERCADO E TROCAS ---
        const snapPropostas = await db.ref(`ligas/${liga}/mercado_propostas`).once('value');
        const propostas = snapPropostas.val();

        let transferenciasRealizadas = 0;

        if (propostas) {
            for (let idAlvo in propostas) {
                let lances = propostas[idAlvo];
                let maiorScore = 0;
                let lanceVencedor = null;
                let loginVencedor = "";

                // Descobre quem é o alvo e quanto ele vale
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
                let valorMinimoIA = dadosDoAlvo.valor_mercado * 0.9; // IA aceita se for pelo menos 90% do valor

                // AVALIAÇÃO DA IA PARA CADA LANCE
                for (let login in lances) {
                    let lance = lances[login];
                    let scoreLance = lance.valor_oferecido || 0;

                    // Se envolveu troca de jogador, a IA soma o valor de mercado do jogador oferecido!
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

                // EXECUTA A TRANSFERÊNCIA SE ALGUÉM VENCEU
                if (lanceVencedor && usuarios[loginVencedor].caixaClube >= lanceVencedor.valor_oferecido) {
                    let timeNovo = lanceVencedor.time_comprador;
                    transferenciasRealizadas++;

                    // 1. Dinheiro
                    usuarios[loginVencedor].caixaClube -= lanceVencedor.valor_oferecido;
                    updates[`ligas/${liga}/usuarios/${loginVencedor}/caixaClube`] = usuarios[loginVencedor].caixaClube;

                    // Opcional: Deposita o dinheiro no time bot (se você quiser manter economia fechada)
                    // if (!times[timeDoAlvo].bot) times[timeDoAlvo].caixa += lanceVencedor.valor_oferecido;

                    // 2. Move o Jogador Alvo
                    updates[`banco_global_times/${timeDoAlvo}/jogadores/${idAlvo}`] = null;
                    updates[`banco_global_times/${timeNovo}/jogadores/${idAlvo}`] = dadosDoAlvo;

                    // 3. Move o Jogador de Troca (Se existir)
                    if (lanceVencedor.id_jogador_oferecido && lanceVencedor.dados_jogador_oferecido) {
                        updates[`banco_global_times/${timeNovo}/jogadores/${lanceVencedor.id_jogador_oferecido}`] = null;
                        updates[`banco_global_times/${timeDoAlvo}/jogadores/${lanceVencedor.id_jogador_oferecido}`] = lanceVencedor.dados_jogador_oferecido;
                    }
                }
            }
            updates[`ligas/${liga}/mercado_propostas`] = null; // Limpa as propostas
        }

        // --- PASSO B: SIMULAR OS JOGOS DA RODADA DA LIGA ---
        const snapCal = await db.ref(`ligas/${liga}/calendario`).once('value');
        const cal = snapCal.val();

        if (cal) {
            let rodadaNum = cal.rodadaAtual || 1;
            let rodadaKey = `rodada_${rodadaNum}`;

            // Helper para simular uma divisão inteira
            const simularDivisao = (divisaoObj) => {
                if (!divisaoObj || !divisaoObj[rodadaKey]) return;
                let jogos = divisaoObj[rodadaKey];

                for (let idJogo in jogos) {
                    let jogo = jogos[idJogo];
                    if (jogo.jogado || jogo.linhaDoTempo) continue;

                    let forcaM = times[jogo.mandante]?.forca_base || 500;
                    let forcaV = times[jogo.visitante]?.forca_base || 500;

                    let donoM = null;
                    let donoV = null;

                    for (let u in usuarios) {
                        if (usuarios[u].timeAtual === jogo.mandante) {
                            if (usuarios[u].forcaAtual) forcaM = usuarios[u].forcaAtual;
                            donoM = u;
                        }
                        if (usuarios[u].timeAtual === jogo.visitante) {
                            if (usuarios[u].forcaAtual) forcaV = usuarios[u].forcaAtual;
                            donoV = u;
                        }
                    }

                    let golsM = 0; let golsV = 0;
                    let linhaTempo = [];

                    // Simulação Matemática
                    for(let i=0; i<5; i++) {
                        let chanceM = forcaM / (forcaM + forcaV);
                        let chanceV = forcaV / (forcaM + forcaV);

                        if (Math.random() < (chanceM * 0.6)) {
                            golsM++;
                            linhaTempo.push({ minuto: Math.floor(Math.random() * 90)+1, tipo: "gol_mandante", texto: `⚽ GOOOL DO ${jogo.mandante.replace(/_/g,' ')}!`, cor: "#ff8c00" });
                        }
                        if (Math.random() < (chanceV * 0.6)) {
                            golsV++;
                            linhaTempo.push({ minuto: Math.floor(Math.random() * 90)+1, tipo: "gol_visitante", texto: `⚽ GOOOL DO ${jogo.visitante.replace(/_/g,' ')}!`, cor: "#ff8c00" });
                        }
                    }

                    linhaTempo.sort((a,b) => a.minuto - b.minuto);

                    // ==========================================
                    // SISTEMA DE MORAL E BILHETERIA (NOVIDADE)
                    // ==========================================
                    let moralM = donoM && usuarios[donoM].moral !== undefined ? usuarios[donoM].moral : 50;
                    let moralV = donoV && usuarios[donoV].moral !== undefined ? usuarios[donoV].moral : 50;

                    // Ajusta a moral pelo resultado
                    if (golsM > golsV) {
                        moralM = Math.min(100, moralM + 10);
                        moralV = Math.max(0, moralV - 10);
                    } else if (golsV > golsM) {
                        moralM = Math.max(0, moralM - 10);
                        moralV = Math.min(100, moralV + 10);
                    } else {
                        moralM = Math.min(100, moralM + 2);
                        moralV = Math.min(100, moralV + 2);
                    }

                    // Calcula a Bilheteria do Mandante
                    if (donoM) {
                        // Público vai de 15.000 (Moral 0) até 55.000 (Moral 100)
                        let publico = 15000 + (moralM * 400);
                        let ingresso = 60; // Ingresso a R$ 60
                        let renda = publico * ingresso;

                        usuarios[donoM].caixaClube += renda;
                        usuarios[donoM].moral = moralM;
                        updates[`ligas/${liga}/usuarios/${donoM}/caixaClube`] = usuarios[donoM].caixaClube;
                        updates[`ligas/${liga}/usuarios/${donoM}/moral`] = moralM;

                        // O "Minuto 0" é o pré-jogo. A TV vai mostrar isso antes da bola rolar!
                        linhaTempo.unshift({ minuto: 0, tipo: "renda", texto: `🎟️ Renda da Partida: R$ ${renda.toLocaleString('pt-BR')} (${publico.toLocaleString('pt-BR')} pagantes)`, cor: "#888" });
                    }
                    if (donoV) {
                        usuarios[donoV].moral = moralV;
                        updates[`ligas/${liga}/usuarios/${donoV}/moral`] = moralV;
                    }

                    let dataInicio = new Date();
                    dataInicio.setHours(HORA_PARTIDA, 0, 0, 0);

                    jogo.linhaDoTempo = linhaTempo;
                    jogo.horaInicio = dataInicio.getTime();
                    jogo.placarMandante = golsM;
                    jogo.placarVisitante = golsV;
                }
            };

            simularDivisao(cal.serieA);
            simularDivisao(cal.serieB);
            updates[`ligas/${liga}/calendario`] = cal;
        }

        // --- PASSO C: FINALIZAR E AVISAR ---
        updates[`ligas/${liga}/sistema/ultima_simulacao`] = dataAtualStr;
        await db.ref().update(updates);
        await lockRef.set(false);

        console.log("✅ MOTOR P2P: Mercado e Simulações concluídos com sucesso!");

        if (transferenciasRealizadas > 0) {
            dispararNotificacao("Mercado Fechado! 🛒", "As negociações foram encerradas e jogadores foram transferidos. Cheque seu elenco!");
        }
        dispararNotificacao("Fim do Aquecimento! ⚽", "As escalações foram bloqueadas e os times estão prontos no túnel do estádio!");

    } catch (e) {
        console.error("Erro crítico no Motor P2P:", e);
        await lockRef.set(false); // Libera o sistema para outro tentar se esse falhou
    }
}