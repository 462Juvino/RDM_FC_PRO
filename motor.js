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
// 2. A GRANDE ROTINA: MERCADO + TROCAS + PRO PLAYERS + JOGOS
// ========================================================
async function processarTudo(liga, dataAtualStr, lockRef) {
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

        if (propostas) {
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

        if (rodadaAtual >= 5) {
            const snapProPlayers = await db.ref(`ligas/${liga}/pro_players`).once('value');
            const proPlayers = snapProPlayers.val();

            if (proPlayers) {
                for (let criador in proPlayers) {
                    let p = proPlayers[criador];

                    if (p.status === "avaliando") {
                        let totalEstrelas = 0;
                        let qtdVotos = 0;

                        if (p.avaliacoes) {
                            for (let v in p.avaliacoes) {
                                totalEstrelas += p.avaliacoes[v].nota_estrelas;
                                qtdVotos++;
                            }
                        }

                        // Média 3 se ninguém votar
                        let media = qtdVotos > 0 ? (totalEstrelas / qtdVotos) : 3;

                        // Cálculo do Multiplicador: Média 1 = 0.8x (-20%) | Média 5 = 1.2x (+20%)
                        let mult = 0.8 + ((media - 1) * 0.1);

                        let at = p.atributos_base;
                        let finalAtq = Math.min(99, Math.floor(at.ataque * mult));
                        let finalDef = Math.min(99, Math.floor(at.defesa * mult));
                        let finalFor = Math.min(99, Math.floor(at.forca * mult));
                        let finalVel = Math.min(99, Math.floor(at.velocidade * mult));
                        let finalHab = Math.min(99, Math.floor(at.habilidade * mult));

                        let ovrFinal = finalAtq + finalDef + finalFor + finalVel + finalHab;
                        let valorMercado = ovrFinal * 150000; // Precificação Base

                        let jogadorPronto = {
                            nome: p.nome + " (PRO)",
                            posicoes: { p: p.posicao, s: "IND", t: "IND" },
                            atributos: { ataque: finalAtq, defesa: finalDef, forca: finalFor, velocidade: finalVel, habilidade: finalHab },
                            valor_mercado: valorMercado,
                            pro_player: true
                        };

                        let idUnico = "PRO_" + criador;

                        // Cria o time Agentes_Livres caso não exista para hospedar o jogador
                        updates[`banco_global_times/Agentes_Livres/divisao`] = "Livre";
                        updates[`banco_global_times/Agentes_Livres/jogadores/${idUnico}`] = jogadorPronto;

                        // Atualiza o status do perfil do criador
                        updates[`ligas/${liga}/pro_players/${criador}/status`] = "mercado";
                        updates[`ligas/${liga}/pro_players/${criador}/ovr_final`] = ovrFinal;
                        updates[`ligas/${liga}/pro_players/${criador}/nota_comunidade`] = media.toFixed(1);
                    }
                }
            }
        }

        // --- PASSO C: SIMULAR OS JOGOS DA RODADA DA LIGA ---
        if (cal) {
            let rodadaKey = `rodada_${rodadaAtual}`;

            const simularDivisao = (divisaoObj) => {
                if (!divisaoObj || !divisaoObj[rodadaKey]) return;
                let jogos = divisaoObj[rodadaKey];

                for (let idJogo in jogos) {
                    let jogo = jogos[idJogo];
                    if (jogo.jogado || jogo.linhaDoTempo) continue;

                    let donoM = null; let donoV = null;
                    let forcaM = times[jogo.mandante]?.forca_base || 500;
                    let forcaV = times[jogo.visitante]?.forca_base || 500;

                    let mentM = "Moderado"; let mentV = "Moderado";

                    for (let u in usuarios) {
                        if (usuarios[u].timeAtual === jogo.mandante) {
                            if (usuarios[u].forcaAtual) forcaM = usuarios[u].forcaAtual;
                            mentM = usuarios[u].mentalidade || "Moderado";
                            donoM = u;
                        }
                        if (usuarios[u].timeAtual === jogo.visitante) {
                            if (usuarios[u].forcaAtual) forcaV = usuarios[u].forcaAtual;
                            mentV = usuarios[u].mentalidade || "Moderado";
                            donoV = u;
                        }
                    }

                    // Multiplicadores Táticos
                    let modM = 1.0; let modV = 1.0;
                    let capGolsM = 99; let capGolsV = 99;

                    if (mentM === "Retranca") { modM = 0.7; modV = 0.5; capGolsM = 1; }
                    if (mentM === "Ofensivo") { modM = 1.3; modV = 1.2; }

                    if (mentV === "Retranca") { modV *= 0.7; modM *= 0.5; capGolsV = 1; }
                    if (mentV === "Ofensivo") { modV *= 1.3; modM *= 1.2; }

                    // Função auxiliar para sortear jogador do elenco
                    const sortearAtleta = (timeId) => {
                        let elenco = times[timeId] && times[timeId].jogadores ? Object.keys(times[timeId].jogadores) : [];
                        if (elenco.length === 0) return null;
                        return elenco[Math.floor(Math.random() * elenco.length)];
                    };

                    let golsM = 0; let golsV = 0;
                    let linhaTempo = [];

                    for(let i=0; i<5; i++) {
                        let chanceM = (forcaM / (forcaM + forcaV)) * modM;
                        let chanceV = (forcaV / (forcaM + forcaV)) * modV;

                        // GOL DO MANDANTE
                        if (golsM < capGolsM && Math.random() < (chanceM * 0.6)) {
                            golsM++;
                            let idAutor = sortearAtleta(jogo.mandante);
                            let idAssist = sortearAtleta(jogo.mandante);
                            let nomeAutor = "Jogado Desconhecido";

                            if (idAutor) {
                                let jog = times[jogo.mandante].jogadores[idAutor];
                                nomeAutor = jog.nome;

                                // Estatísticas e Valorização (Gol = + R$ 1.000.000)
                                jog.estatisticas = jog.estatisticas || { gols: 0, assistencias: 0 };
                                jog.estatisticas.gols += 1;
                                jog.valor_mercado = (jog.valor_mercado || 1000000) + 1000000;
                                updates[`banco_global_times/${jogo.mandante}/jogadores/${idAutor}`] = jog;

                                // Assistência (Se não for o mesmo cara)
                                if (idAssist && idAssist !== idAutor) {
                                    let jogAst = times[jogo.mandante].jogadores[idAssist];
                                    jogAst.estatisticas = jogAst.estatisticas || { gols: 0, assistencias: 0 };
                                    jogAst.estatisticas.assistencias += 1;
                                    jogAst.valor_mercado = (jogAst.valor_mercado || 1000000) + 500000; // Assistência = + R$ 500.000
                                    updates[`banco_global_times/${jogo.mandante}/jogadores/${idAssist}`] = jogAst;
                                }
                            }
                            linhaTempo.push({ minuto: Math.floor(Math.random() * 90)+1, tipo: "gol_mandante", texto: `⚽ GOOOL DO ${jogo.mandante.replace(/_/g,' ')}! (${nomeAutor})`, cor: "#ff8c00" });
                        }

                        // GOL DO VISITANTE
                        if (golsV < capGolsV && Math.random() < (chanceV * 0.6)) {
                            golsV++;
                            let idAutor = sortearAtleta(jogo.visitante);
                            let idAssist = sortearAtleta(jogo.visitante);
                            let nomeAutor = "Jogador Desconhecido";

                            if (idAutor) {
                                let jog = times[jogo.visitante].jogadores[idAutor];
                                nomeAutor = jog.nome;

                                jog.estatisticas = jog.estatisticas || { gols: 0, assistencias: 0 };
                                jog.estatisticas.gols += 1;
                                jog.valor_mercado = (jog.valor_mercado || 1000000) + 1000000;
                                updates[`banco_global_times/${jogo.visitante}/jogadores/${idAutor}`] = jog;

                                if (idAssist && idAssist !== idAutor) {
                                    let jogAst = times[jogo.visitante].jogadores[idAssist];
                                    jogAst.estatisticas = jogAst.estatisticas || { gols: 0, assistencias: 0 };
                                    jogAst.estatisticas.assistencias += 1;
                                    jogAst.valor_mercado = (jogAst.valor_mercado || 1000000) + 500000;
                                    updates[`banco_global_times/${jogo.visitante}/jogadores/${idAssist}`] = jogAst;
                                }
                            }
                            linhaTempo.push({ minuto: Math.floor(Math.random() * 90)+1, tipo: "gol_visitante", texto: `⚽ GOOOL DO ${jogo.visitante.replace(/_/g,' ')}! (${nomeAutor})`, cor: "#ff8c00" });
                        }
                    }

                    linhaTempo.sort((a,b) => a.minuto - b.minuto);

                    let moralM = donoM && usuarios[donoM].moral !== undefined ? usuarios[donoM].moral : 50;
                    let moralV = donoV && usuarios[donoV].moral !== undefined ? usuarios[donoV].moral : 50;

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

                    if (donoM) {
                        let publico = 15000 + (moralM * 400);
                        let ingresso = 60;
                        let renda = publico * ingresso;

                        usuarios[donoM].caixaClube += renda;
                        updates[`ligas/${liga}/usuarios/${donoM}/caixaClube`] = usuarios[donoM].caixaClube;
                        updates[`ligas/${liga}/usuarios/${donoM}/moral`] = moralM;

                        linhaTempo.unshift({ minuto: 0, tipo: "renda", texto: `🎟️ Renda da Partida: R$ ${renda.toLocaleString('pt-BR')} (${publico.toLocaleString('pt-BR')} pagantes)`, cor: "#888" });
                    }
                    if (donoV) {
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

        // --- PASSO D: FINALIZAR E AVISAR ---
        updates[`ligas/${liga}/sistema/ultima_simulacao`] = dataAtualStr;
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