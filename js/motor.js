// js/motor.js

const ligaMotor = localStorage.getItem('treinadorLiga');
const userLogadoMotor = localStorage.getItem('treinadorUsuario');

// Configuração de Horários Oficiais
const HORA_CAMP = 19;
const HORA_COPA = 20;

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
    setInterval(() => checarRotinas(liga), 180000); // Checa a cada 3 minutos
}

async function checarRotinas(liga) {
    const agora = new Date();
    const hora = agora.getHours();

    const ano = agora.getFullYear();
    const mes = (agora.getMonth() + 1).toString().padStart(2, '0');
    const dia = agora.getDate().toString().padStart(2, '0');
    const dataAtualStr = `${ano}-${mes}-${dia}`;

    const ontem = new Date(agora);
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = `${ontem.getFullYear()}-${(ontem.getMonth() + 1).toString().padStart(2, '0')}-${ontem.getDate().toString().padStart(2, '0')}`;

    try {
        const snapSist = await db.ref(`ligas/${liga}/sistema`).once('value');
        const sis = snapSist.val() || {};

        let ultCamp = sis.ultima_simulacao_camp;
        let ultCopa = sis.ultima_simulacao_copa;

        let rodarCampHoje = (hora >= HORA_CAMP && ultCamp !== dataAtualStr);
        let rodarCopaHoje = (hora >= HORA_COPA && ultCopa !== dataAtualStr);
        let rodarAtrasados = (!ultCamp || ultCamp < ontemStr);

        // 🔍 OLHEIRO DO MERCADO: Verifica se há propostas pendentes que já passaram das 19h ou são de ontem
        const snapPropostas = await db.ref(`ligas/${liga}/mercado_propostas`).once('value');
        const propostasPendentes = snapPropostas.val() || {};
        let temMercadoPendente = false;

        if (Object.keys(propostasPendentes).length > 0) {
            console.log(`📦 [MOTOR] Encontradas ${Object.keys(propostasPendentes).length} propostas na mesa. Verificando as datas...`);
            for (let id in propostasPendentes) {
                let objLances = propostasPendentes[id];
                let primeiraDataStr = Object.values(objLances)[0].data_proposta;

                if (!primeiraDataStr) {
                    console.log(`⚠️ [MOTOR] Proposta ID ${id} não tem data! Pendência de Mercado ativada!`);
                    temMercadoPendente = true;
                    break;
                }

                let dataProp = new Date(primeiraDataStr);
                let isHoje = dataProp.getDate() === agora.getDate() && dataProp.getMonth() === agora.getMonth() && dataProp.getFullYear() === agora.getFullYear();

                if (!isHoje || (isHoje && hora >= 19)) {
                    console.log(`⏳ [MOTOR] Proposta ID ${id} ESTÁ VENCIDA. Pendência de Mercado ativada!`);
                    temMercadoPendente = true;
                    break;
                } else {
                    console.log(`⏰ [MOTOR] Proposta ID ${id} ainda está no prazo. Aguardando dar 19h.`);
                }
            }
        } else {
            console.log(`🧹 [MOTOR] Mesa de negociações está limpa.`);
        }

        console.log(`💤 [MOTOR] Diagnóstico: CampHoje(${rodarCampHoje}) | CopaHoje(${rodarCopaHoje}) | Atrasados(${rodarAtrasados}) | MercadoPendente(${temMercadoPendente})`);

        // Se o Motor está em dia com os Jogos E o Mercado não tem pendências aguardando martelo, ele dorme.
        if (!rodarCampHoje && !rodarCopaHoje && !rodarAtrasados && !temMercadoPendente) return;

        const lockRef = db.ref(`ligas/${liga}/sistema/lock_simulacao`);
        const snapLock = await lockRef.once('value');
        const lockData = snapLock.val();

        // 🔓 ANTI-TRAVAMENTO: Se a tranca for antiga (mais de 1 minuto), o motor ignora o bug e quebra a porta!
        if (lockData && lockData.locked && (Date.now() - lockData.timestamp < 60000)) {
            return; // Outro jogador está processando neste exato segundo, tudo bem.
        }

        // Tranca com a hora exata
        await lockRef.set({ locked: true, timestamp: Date.now() });
        console.log("🔥 MOTOR P2P: Iniciando varredura Oficial e/ou de Mercado!");

        processarTudo(liga, dataAtualStr, ontemStr, lockRef, rodarCampHoje, rodarCopaHoje, rodarAtrasados);

    } catch (e) { console.error("Falha no Motor P2P:", e); }
}

// A função que faz a mágica acontecer!
async function processarTudo(liga, dataAtualStr, ontemStr, lockRef, rodarCampHoje, rodarCopaHoje, rodarAtrasados) {
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
        let propostas = snapPropostas.val() || {}; // Alterado para 'let' para a IA poder injetar propostas

        // ============================================
        // --- PASSO A.0: IA ATIVA NO MERCADO E FINANÇAS ---
        // ============================================
        let timesHumanos = Object.values(usuarios).map(u => u.timeAtual).filter(t => t && t !== "Sem Clube");
        let timesIA = Object.keys(times).filter(t => !t.startsWith("Agentes_Livres") && t !== "Fantasma" && !timesHumanos.includes(t));

        // 🧠 A IA só toma novas iniciativas (pegar empréstimo, enviar proposta) se for hora oficial do campeonato
        // Isso evita que a IA torre todo o dinheiro dela fazendo leilões a cada 3 minutos!
        if (rodarCampHoje || rodarAtrasados) {
            for (let t of timesIA) {
                let loginIA = `IA_${t}`;

                // 🤖 Cria uma "Conta Bancária Virtual" para a Máquina operar no jogo
                if (!usuarios[loginIA]) {
                    usuarios[loginIA] = { nome: `Diretoria ${t.replace(/_/g,' ')}`, timeAtual: t, caixaClube: 30000000 };
                    updates[`ligas/${liga}/usuarios/${loginIA}`] = usuarios[loginIA];
                }

                let caixaClubeIA = usuarios[loginIA].caixaClube || 0;

                // 🎲 25% de chance da Diretoria da IA agir nesta rodada
                if (Math.random() < 0.25) {

                    // AÇÃO 1: Pegar Empréstimo se estiver à beira da falência (Caixa < 5M)
                    if (caixaClubeIA < 5000000) {
                        let valorPedido = 15000000;
                        let rodadas = 10;
                        let parcela = Math.round((valorPedido * 1.5) / rodadas);

                        caixaClubeIA += valorPedido;
                        usuarios[loginIA].caixaClube = caixaClubeIA;
                        updates[`ligas/${liga}/usuarios/${loginIA}/caixaClube`] = caixaClubeIA;

                        updates[`ligas/${liga}/dividas_financeiras/divida_ia_${t}_${Date.now()}`] = {
                            devedor: t, credor: 'Banco Central da Liga', valor_total: valorPedido * 1.5, parcela_rodada: parcela, rodadas_restantes: rodadas
                        };
                    }

                    // AÇÃO 2: Comprar ou Alugar Jogadores (Se tiver grana razoável)
                    else if (caixaClubeIA >= 10000000 && caixaClubeIA <= 40000000) {
                        let todosAlvos = [];
                        for (let outroT in times) {
                            if (outroT !== t && times[outroT].jogadores && !outroT.startsWith("Agentes_Livres")) {
                                for (let idJog in times[outroT].jogadores) {
                                    todosAlvos.push({ id: idJog, time: outroT, dados: times[outroT].jogadores[idJog] });
                                }
                            }
                        }

                        if (todosAlvos.length > 0) {
                            let alvosBons = todosAlvos.filter(x => x.dados.valor_mercado > 1000000 && x.dados.valor_mercado <= (caixaClubeIA * 0.7));

                            if (alvosBons.length > 0) {
                                let alvo = alvosBons[Math.floor(Math.random() * alvosBons.length)];
                                let isCompra = Math.random() < 0.7;

                                let valorOferecido = isCompra ? Math.round(alvo.dados.valor_mercado * 1.05) : Math.round((alvo.dados.valor_mercado * 0.02) * 10);
                                let duracao = isCompra ? 0 : 10;

                                if (!propostas[alvo.id]) propostas[alvo.id] = {};

                                propostas[alvo.id][loginIA] = {
                                    time_comprador: t,
                                    valor_oferecido: valorOferecido,
                                    data_proposta: new Date().toISOString(),
                                    tipo_negocio: isCompra ? 'compra' : 'emprestimo',
                                    duracao_rodadas: duracao
                                };

                                updates[`ligas/${liga}/mercado_propostas/${alvo.id}/${loginIA}`] = propostas[alvo.id][loginIA];
                            }
                        }
                    }

                    // AÇÃO 3: Virar Investidor Agiota (Se estiver super rica > 40M)
                    else if (caixaClubeIA > 40000000 && Math.random() < 0.2) {
                        const snapBanc = await db.ref(`ligas/${liga}/banco_investidores/${t}`).once('value');
                        let invAtual = snapBanc.val() ? snapBanc.val().saldo : 0;

                        let valorInvestido = 10000000;
                        caixaClubeIA -= valorInvestido;
                        usuarios[loginIA].caixaClube = caixaClubeIA;
                        updates[`ligas/${liga}/usuarios/${loginIA}/caixaClube`] = caixaClubeIA;

                        updates[`ligas/${liga}/banco_investidores/${t}`] = {
                            saldo: invAtual + valorInvestido, dono_login: loginIA, is_ia: true
                        };
                    }
                }
            }
        }

        let transferenciasRealizadas = 0;

        // Se o mercado tiver propostas de Humanos ou IAs, resolve a briga
        if (Object.keys(propostas).length > 0) {
            console.log(`🔨 [MERCADO] Iniciando o julgamento de ${Object.keys(propostas).length} jogador(es) na mesa...`);
            for (let idAlvo in propostas) {
                let lances = propostas[idAlvo];
                let timeDoAlvo = null;
                let dadosDoAlvo = null;
                console.log(`▶️ [MERCADO] Avaliando situação do Alvo ID: ${idAlvo}`);

                for (let t in times) {
                    if (times[t].jogadores && times[t].jogadores[idAlvo]) {
                        timeDoAlvo = t;
                        dadosDoAlvo = times[t].jogadores[idAlvo];
                        break;
                    }
                }

                if (!dadosDoAlvo) {
                    updates[`ligas/${liga}/mercado_propostas/${idAlvo}`] = null;
                    continue;
                }

                // ============================================
                // ⏰ REGRAS TEMPORAIS E BLINDAGEM CONTRA BUGS
                // ============================================
                let primeiraDataStr = Object.values(lances)[0].data_proposta;
                // Se a proposta não tem data, trata como de 1970 para ser encerrada Imediatamente!
                let dataProp = primeiraDataStr ? new Date(primeiraDataStr) : new Date(0);
                let agora = new Date();

                let isHoje = dataProp.getDate() === agora.getDate() && dataProp.getMonth() === agora.getMonth() && dataProp.getFullYear() === agora.getFullYear();
                let horaAtual = agora.getHours();

                if (isHoje && horaAtual < 19) {
                    continue;
                }

                let isDonoHumano = false;
                for (let u in usuarios) {
                    if (usuarios[u].timeAtual === timeDoAlvo) { isDonoHumano = true; break; }
                }

                if (isDonoHumano) {
                    for (let login in lances) {
                        if (!login.startsWith('IA_')) {
                            updates[`ligas/${liga}/caixa_mensagens/${login}/msg_expirou_${Date.now()}_${Math.floor(Math.random()*1000)}`] = {
                                tipo: 'recusa', texto: `Sua oferta por ${dadosDoAlvo.nome} EXPIROU. O treinador do ${timeDoAlvo.replace(/_/g,' ')} não respondeu a tempo.`, data: new Date().toISOString()
                            };
                        }
                    }
                    updates[`ligas/${liga}/mercado_propostas/${idAlvo}`] = null;
                    continue;
                }

                let maiorScore = 0;
                let lanceVencedor = null;
                let loginVencedor = "";

                let elencoIA = Object.values(times[timeDoAlvo].jogadores || {}).sort((a,b) => (b.valor_mercado || 0) - (a.valor_mercado || 0));
                let isTitularIA = false;
                if (elencoIA.length >= 14) {
                    let indexTop = elencoIA.findIndex(jx => jx.nome === dadosDoAlvo.nome);
                    if (indexTop !== -1 && indexTop < 14) isTitularIA = true;
                }

                let valorMinimoIA = dadosDoAlvo.valor_mercado * 0.9;

                for (let login in lances) {
                    let lance = lances[login];
                    let scoreLance = lance.valor_oferecido || 0;

                    if (lance.tipo_negocio === 'emprestimo') {
                        if (isTitularIA) continue;
                        let taxaMinima = (dadosDoAlvo.valor_mercado * 0.015) * lance.duracao_rodadas;
                        if (scoreLance >= taxaMinima && scoreLance > maiorScore) {
                            maiorScore = scoreLance;
                            lanceVencedor = lance;
                            loginVencedor = login;
                        }
                    } else {
                        let dadosJogadorOferecido = null;
                        if (lance.id_jogador_oferecido) {
                            // Proteção de sintaxe para clubes que já apagaram todos os jogadores (evita quebrar o Motor)
                            dadosJogadorOferecido = times[lance.time_comprador]?.jogadores?.[lance.id_jogador_oferecido];
                            if (dadosJogadorOferecido) scoreLance += dadosJogadorOferecido.valor_mercado;
                        }

                        if (scoreLance > maiorScore && scoreLance >= valorMinimoIA) {
                            maiorScore = scoreLance;
                            lanceVencedor = lance;
                            loginVencedor = login;
                            lanceVencedor.dados_jogador_oferecido = dadosJogadorOferecido;
                        }
                    }
                }

                if (lanceVencedor && usuarios[loginVencedor] && usuarios[loginVencedor].caixaClube >= lanceVencedor.valor_oferecido) {
                    let timeNovo = lanceVencedor.time_comprador;
                    transferenciasRealizadas++;

                    usuarios[loginVencedor].caixaClube -= lanceVencedor.valor_oferecido;
                    updates[`ligas/${liga}/usuarios/${loginVencedor}/caixaClube`] = usuarios[loginVencedor].caixaClube;

                    let loginVendedor = `IA_${timeDoAlvo}`;
                    if (usuarios[loginVendedor]) {
                        usuarios[loginVendedor].caixaClube += lanceVencedor.valor_oferecido;
                        updates[`ligas/${liga}/usuarios/${loginVendedor}/caixaClube`] = usuarios[loginVendedor].caixaClube;
                    }

                    if (lanceVencedor.tipo_negocio === 'emprestimo') {
                        dadosDoAlvo.status_emprestimo = { time_origem: timeDoAlvo, rodadas_restantes: lanceVencedor.duracao_rodadas };
                        updates[`banco_global_times/${timeDoAlvo}/jogadores/${idAlvo}`] = null;
                        updates[`banco_global_times/${timeNovo}/jogadores/${idAlvo}`] = dadosDoAlvo;
                        updates[`ligas/${liga}/emprestimos_ativos/${idAlvo}`] = { jogador_id: idAlvo, time_origem: timeDoAlvo, time_destino: timeNovo, rodadas_restantes: lanceVencedor.duracao_rodadas };
                    } else {
                        updates[`banco_global_times/${timeDoAlvo}/jogadores/${idAlvo}`] = null;
                        updates[`banco_global_times/${timeNovo}/jogadores/${idAlvo}`] = dadosDoAlvo;
                        if (lanceVencedor.id_jogador_oferecido && lanceVencedor.dados_jogador_oferecido) {
                            updates[`banco_global_times/${timeNovo}/jogadores/${lanceVencedor.id_jogador_oferecido}`] = null;
                            updates[`banco_global_times/${timeDoAlvo}/jogadores/${lanceVencedor.id_jogador_oferecido}`] = lanceVencedor.dados_jogador_oferecido;
                        }
                    }

                    if (!loginVencedor.startsWith('IA_')) {
                        updates[`ligas/${liga}/caixa_mensagens/${loginVencedor}/msg_compra_${Date.now()}`] = {
                            tipo: 'sucesso', texto: `A diretoria do ${timeDoAlvo.replace(/_/g,' ')} ACEITOU sua oferta. ${dadosDoAlvo.nome} se juntou ao elenco!`, data: new Date().toISOString()
                        };
                    }
                    for (let login in lances) {
                        if (login !== loginVencedor && !login.startsWith('IA_')) {
                            updates[`ligas/${liga}/caixa_mensagens/${login}/msg_perda_${Date.now()}_${Math.floor(Math.random() * 1000)}`] = {
                                tipo: 'recusa', texto: `Você perdeu o leilão por ${dadosDoAlvo.nome}. Outro clube cobriu sua oferta final.`, data: new Date().toISOString()
                            };
                        }
                    }

                } else {
                    for (let login in lances) {
                        if (!login.startsWith('IA_')) {
                            updates[`ligas/${liga}/caixa_mensagens/${login}/msg_recusa_${Date.now()}_${Math.floor(Math.random() * 1000)}`] = {
                                tipo: 'recusa', texto: `A diretoria do ${timeDoAlvo.replace(/_/g,' ')} RECUSOU sua proposta por ${dadosDoAlvo.nome}. Os valores ficaram abaixo da pedida.`, data: new Date().toISOString()
                            };
                        }
                    }
                }
                updates[`ligas/${liga}/mercado_propostas/${idAlvo}`] = null;
            }
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
                        let at = p.atributos_base;
                        let qtdVotos = 1;
                        let sA = at.ataque, sD = at.defesa, sF = at.forca, sV = at.velocidade, sH = at.habilidade;

                        if (p.avaliacoes) {
                            for (let v in p.avaliacoes) {
                                sA += p.avaliacoes[v].ataque || 60; sD += p.avaliacoes[v].defesa || 60; sF += p.avaliacoes[v].forca || 60; sV += p.avaliacoes[v].velocidade || 60; sH += p.avaliacoes[v].habilidade || 60;
                                qtdVotos++;
                            }
                        }

                        let finalAtq = Math.round((sA / qtdVotos) / 6); let finalDef = Math.round((sD / qtdVotos) / 6); let finalFor = Math.round((sF / qtdVotos) / 6); let finalVel = Math.round((sV / qtdVotos) / 6); let finalHab = Math.round((sH / qtdVotos) / 6);
                        let ovrFinal = Math.round((finalAtq + finalDef + finalFor + finalVel + finalHab) / 5);
                        let valorMercado = ovrFinal * 2500000;

                        let jogadorPronto = {
                            nome: p.nome + " (PRO)", posicoes: { p: p.posicao, s: "IND", t: "IND" },
                            atributos: { ataque: finalAtq, defesa: finalDef, forca: finalFor, velocidade: finalVel, habilidade: finalHab },
                            valor_mercado: valorMercado, pro_player: true
                        };

                        let idUnico = "PRO_" + criador;
                        let timeAgentes = `Agentes_Livres_${liga}`;

                        updates[`banco_global_times/${timeAgentes}/divisao`] = "Livre";
                        updates[`banco_global_times/${timeAgentes}/jogadores/${idUnico}`] = jogadorPronto;

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
            const horaMotor = agoraDT.getHours();
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

                linhaTempo.push({ minuto: 1, tipo: 'inicio', texto: `🟢 APITA O ÁRBITRO! Rola a bola para a partida oficial!` });

                if (fadigaM === 1.0) linhaTempo.push({ minuto: Math.floor(Math.random() * 10) + 60, tipo: "sub", texto: `🔄 Substituição no ${jogo.mandante.replace(/_/g,' ')}: Fôlego novo!`, cor: "#aaa" });
                if (fadigaV === 1.0) linhaTempo.push({ minuto: Math.floor(Math.random() * 10) + 60, tipo: "sub", texto: `🔄 Substituição no ${jogo.visitante.replace(/_/g,' ')}: Alteração tática!`, cor: "#aaa" });

                const narracoesM = ["🔥 UUUHH! O atacante chuta forte e a bola raspa a trave!", "🛡️ Bela roubada de bola da zaga, desarmando com classe.", "👟 Troca de passes envolvente. O time procura espaço.", "🎯 Cruzamento venenoso na área, mas o atacante cabeceia por cima!"];
                const narracoesV = ["⚠️ PERIGO! O visitante ataca com velocidade, mas o chute vai fora.", "🧤 MILAGRE! O goleiro se estica todo e salva um gol certo!", "👟 O visitante domina a posse de bola no meio campo.", "🥅 Chute de muito longe, a bola passa assustando!"];

                for(let i=0; i<16; i++) {
                    let minAleatorio = Math.floor(Math.random()*89)+1;
                    if (minAleatorio === 45) minAleatorio = 46;
                    if (Math.random() > 0.5) linhaTempo.push({ minuto: minAleatorio, tipo: 'ataque_mandante', texto: narracoesM[Math.floor(Math.random()*narracoesM.length)] });
                    else linhaTempo.push({ minuto: minAleatorio, tipo: 'ataque_visitante', texto: narracoesV[Math.floor(Math.random()*narracoesV.length)] });
                }

                const sortearAtleta = (tId) => { let el = times[tId]?.jogadores ? Object.keys(times[tId].jogadores) : []; return el.length ? el[Math.floor(Math.random() * el.length)] : null; };

                let gkM_id = Object.keys(times[jogo.mandante]?.jogadores || {}).find(k => times[jogo.mandante].jogadores[k].posicoes?.p === "Goleiro");
                let gkV_id = Object.keys(times[jogo.visitante]?.jogadores || {}).find(k => times[jogo.visitante].jogadores[k].posicoes?.p === "Goleiro");

                if (gkM_id) { let gkM = times[jogo.mandante].jogadores[gkM_id]; gkM.estatisticas = gkM.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0}; gkM.estatisticas.jogos = (gkM.estatisticas.jogos || 0) + 1; updates[`banco_global_times/${jogo.mandante}/jogadores/${gkM_id}`] = gkM; }
                if (gkV_id) { let gkV = times[jogo.visitante].jogadores[gkV_id]; gkV.estatisticas = gkV.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0}; gkV.estatisticas.jogos = (gkV.estatisticas.jogos || 0) + 1; updates[`banco_global_times/${jogo.visitante}/jogadores/${gkV_id}`] = gkV; }

                for(let i=0; i<5; i++) {
                    if (golsM < capGolsM && Math.random() < ((forcaM / (forcaM + forcaV)) * modM * 0.6)) {
                        golsM++;
                        if (gkV_id) { let gkV = times[jogo.visitante].jogadores[gkV_id]; gkV.estatisticas.gols_sofridos = (gkV.estatisticas.gols_sofridos || 0) + 1; updates[`banco_global_times/${jogo.visitante}/jogadores/${gkV_id}`] = gkV; }
                        let idA = sortearAtleta(jogo.mandante); let nA = idA ? times[jogo.mandante].jogadores[idA].nome : "Jogador";
                        if(idA) {
                            let jg = times[jogo.mandante].jogadores[idA]; jg.estatisticas = jg.estatisticas || {gols:0, assistencias:0}; jg.estatisticas.gols++; jg.valor_mercado = (jg.valor_mercado||1000000) + 1000000;
                            if (Math.random() > 0.4) { let idAst = sortearAtleta(jogo.mandante); if (idAst && idAst !== idA) { let jgAst = times[jogo.mandante].jogadores[idAst]; jgAst.estatisticas = jgAst.estatisticas || {gols:0, assistencias:0}; jgAst.estatisticas.assistencias++; updates[`banco_global_times/${jogo.mandante}/jogadores/${idAst}`] = jgAst; } }
                            updates[`banco_global_times/${jogo.mandante}/jogadores/${idA}`] = jg;
                        }
                        linhaTempo.push({ minuto: Math.floor(Math.random()*89)+1, tipo: "gol_mandante", texto: `⚽ GOOOL DO ${jogo.mandante.replace(/_/g,' ')}! (${nA})` });
                    }
                    if (golsV < capGolsV && Math.random() < ((forcaV / (forcaM + forcaV)) * modV * 0.6)) {
                        golsV++;
                        let idA = sortearAtleta(jogo.visitante); let nA = idA ? times[jogo.visitante].jogadores[idA].nome : "Jogador";
                        if(idA) {
                            let jg = times[jogo.visitante].jogadores[idA]; jg.estatisticas = jg.estatisticas || {gols:0, assistencias:0}; jg.estatisticas.gols++; jg.valor_mercado = (jg.valor_mercado||1000000) + 1000000;
                            if (Math.random() > 0.4) { let idAst = sortearAtleta(jogo.visitante); if (idAst && idAst !== idA) { let jgAst = times[jogo.visitante].jogadores[idAst]; jgAst.estatisticas = jgAst.estatisticas || {gols:0, assistencias:0}; jgAst.estatisticas.assistencias++; updates[`banco_global_times/${jogo.visitante}/jogadores/${idAst}`] = jgAst; } }
                            updates[`banco_global_times/${jogo.visitante}/jogadores/${idA}`] = jg;
                        }
                        linhaTempo.push({ minuto: Math.floor(Math.random()*89)+1, tipo: "gol_visitante", texto: `⚽ GOOOL DO ${jogo.visitante.replace(/_/g,' ')}! (${nA})` });
                    }
                    if (gkM_id) { let gkM = times[jogo.mandante].jogadores[gkM_id]; gkM.estatisticas.gols_sofridos = (gkM.estatisticas.gols_sofridos || 0) + 1; updates[`banco_global_times/${jogo.mandante}/jogadores/${gkM_id}`] = gkM; }
                }

                if (!linhaTempo.some(l => l.minuto === 45 && l.tipo.includes('gol'))) {
                    linhaTempo.push({ minuto: 45, tipo: 'intervalo', texto: `⏱️ Fim do Primeiro Tempo! Os jogadores vão para o vestiário.` });
                }

                if (isMataMata && golsM === golsV) {
                    linhaTempo.push({ minuto: 95, tipo: "penaltis", texto: `⚖️ Fim de Jogo Empatado! A decisão vai para os PÊNALTIS!` });
                    if (Math.random() > 0.5) { golsM++; linhaTempo.push({ minuto: 99, tipo: "gol_mandante", texto: `🏆 O ${jogo.mandante.replace(/_/g,' ')} VENCEU A DISPUTA DE PÊNALTIS!` }); }
                    else { golsV++; linhaTempo.push({ minuto: 99, tipo: "gol_visitante", texto: `🏆 O ${jogo.visitante.replace(/_/g,' ')} VENCEU A DISPUTA DE PÊNALTIS!` }); }
                }

                linhaTempo.sort((a,b) => a.minuto - b.minuto);

                if (donoM) {
                    let pub = 15000 + ((usuarios[donoM].moral||50) * 400); let ren = pub * 60;
                    usuarios[donoM].caixaClube += ren; updates[`ligas/${liga}/usuarios/${donoM}/caixaClube`] = usuarios[donoM].caixaClube;
                    linhaTempo.unshift({ minuto: 0, tipo: "renda", texto: `🎟️ Renda: R$ ${ren.toLocaleString('pt-BR')} (${pub.toLocaleString('pt-BR')} pagantes)` });
                }

                if (golsM > golsV) { if(donoM) updates[`ligas/${liga}/usuarios/${donoM}/moral`] = Math.min(100, (usuarios[donoM].moral||50)+10); if(donoV) updates[`ligas/${liga}/usuarios/${donoV}/moral`] = Math.max(0, (usuarios[donoV].moral||50)-10); }
                else if (golsV > golsM) { if(donoV) updates[`ligas/${liga}/usuarios/${donoV}/moral`] = Math.min(100, (usuarios[donoV].moral||50)+10); if(donoM) updates[`ligas/${liga}/usuarios/${donoM}/moral`] = Math.max(0, (usuarios[donoM].moral||50)-10); }

                let dataInicio = new Date(); dataInicio.setHours(isMataMata ? HORA_COPA : HORA_CAMP, 0, 0, 0);
                jogo.linhaDoTempo = linhaTempo; jogo.horaInicio = dataInicio.getTime();
                jogo.placarMandante = golsM; jogo.placarVisitante = golsV;
                jogo.jogado = true;
            };

            let proximaRodada = cal.rodadaAtual || 1;
            const hojeDT = new Date(); hojeDT.setHours(0,0,0,0);

            for (let r = 1; r <= 38; r++) {
                let rodadaKey = `rodada_${r}`;

                const checarE_Simular = (divisaoObj) => {
                    if (!divisaoObj || !divisaoObj[rodadaKey]) return;
                    for (let j in divisaoObj[rodadaKey]) {
                        let jogo = divisaoObj[rodadaKey][j];

                        if (jogo.linhaDoTempo && jogo.jogado === false) jogo.jogado = true;

                        if (!jogo.jogado && !jogo.linhaDoTempo && jogo.data_jogo) {
                            let dataJogoStr = jogo.data_jogo.split(' ')[0];
                            let [dJ, mJ] = dataJogoStr.split('/');
                            let jogoDT = new Date(hojeDT.getFullYear(), parseInt(mJ) - 1, parseInt(dJ));
                            jogoDT.setHours(0,0,0,0);

                            if (jogoDT < hojeDT) {
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

                                if (jogoDT < hojeDT) {
                                    processarPartidaAoVivo(jogo, true);

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

                    let arts = [...todosJgs].filter(j => j.estatisticas && j.estatisticas.gols > 0).sort((a,b) => b.estatisticas.gols - a.estatisticas.gols).slice(0, 3);
                    arts.forEach(j => { let novoValor = Math.min(99, (j.atributos.ataque || 60) + 5); updates[`banco_global_times/${j.timeBanco}/jogadores/${j.idBanco}/atributos/ataque`] = novoValor; });

                    let asts = [...todosJgs].filter(j => j.estatisticas && j.estatisticas.assistencias > 0).sort((a,b) => b.estatisticas.assistencias - a.estatisticas.assistencias).slice(0, 3);
                    asts.forEach(j => { let novoValor = Math.min(99, (j.atributos.habilidade || 60) + 5); updates[`banco_global_times/${j.timeBanco}/jogadores/${j.idBanco}/atributos/habilidade`] = novoValor; });

                    let gks = [...todosJgs].filter(j => j.posicoes && j.posicoes.p === "Goleiro" && j.estatisticas && j.estatisticas.jogos >= 5);
                    gks.sort((a,b) => (a.estatisticas.gols_sofridos || 0) - (b.estatisticas.gols_sofridos || 0)).slice(0, 3).forEach(j => {
                        let novoValor = Math.min(99, (j.atributos.defesa || 60) + 5);
                        updates[`banco_global_times/${j.timeBanco}/jogadores/${j.idBanco}/atributos/defesa`] = novoValor;
                    });
                }
            }

            updates[`ligas/${liga}/calendario`] = cal;
        }

        // --- PASSO C.2: FISCALIZAÇÃO DOS CONTRATOS DE EMPRÉSTIMO ---
        let novaRodadaAtual = cal ? (cal.rodadaAtual || 1) : 1;
        let rodadasAvancadas = novaRodadaAtual - rodadaAtual;

        if (rodadasAvancadas > 0) {
            const snapEmp = await db.ref(`ligas/${liga}/emprestimos_ativos`).once('value');
            const emprestimos = snapEmp.val();

            if (emprestimos) {
                for (let idJog in emprestimos) {
                    let emp = emprestimos[idJog];
                    emp.rodadas_restantes -= rodadasAvancadas;

                    if (emp.rodadas_restantes <= 0) {
                        let tLocatario = emp.time_destino;
                        let tDono = emp.time_origem;
                        let dJog = null;

                        if (times[tLocatario] && times[tLocatario].jogadores && times[tLocatario].jogadores[idJog]) {
                            dJog = times[tLocatario].jogadores[idJog];
                        }

                        if (dJog) {
                            delete dJog.status_emprestimo;
                            updates[`banco_global_times/${tLocatario}/jogadores/${idJog}`] = null;
                            updates[`banco_global_times/${tDono}/jogadores/${idJog}`] = dJog;

                            let idMsgE = "msg_emp_" + Date.now() + Math.floor(Math.random()*1000);
                            for (let u in usuarios) {
                                if (usuarios[u].timeAtual === tLocatario) {
                                    updates[`ligas/${liga}/caixa_mensagens/${u}/${idMsgE}_1`] = { tipo: 'recusa', texto: `O contrato de empréstimo de ${dJog.nome} encerrou. Ele arrumou as malas e voltou ao ${tDono.replace(/_/g,' ')}.`, data: new Date().toISOString() };
                                }
                                if (usuarios[u].timeAtual === tDono) {
                                    updates[`ligas/${liga}/caixa_mensagens/${u}/${idMsgE}_2`] = { tipo: 'sucesso', texto: `O empréstimo acabou! ${dJog.nome} está de volta e já se apresentou no seu CT.`, data: new Date().toISOString() };
                                }
                            }
                        }
                        updates[`ligas/${liga}/emprestimos_ativos/${idJog}`] = null;
                    } else {
                        updates[`ligas/${liga}/emprestimos_ativos/${idJog}/rodadas_restantes`] = emp.rodadas_restantes;
                        updates[`banco_global_times/${emp.time_destino}/jogadores/${idJog}/status_emprestimo/rodadas_restantes`] = emp.rodadas_restantes;
                    }
                }
            }
        }

        // ========================================================
        // 🏆 SISTEMA DE FASE (MOMENTO) - BÔNUS AO VIVO TOP 10
        // ========================================================
        let todosParaRanking = [];
        for (let t in times) {
            if (times[t].jogadores) {
                for (let idJog in times[t].jogadores) {
                    todosParaRanking.push({ time: t, id: idJog, dados: times[t].jogadores[idJog] });
                }
            }
        }

        todosParaRanking.forEach(jog => {
            let j = jog.dados;
            if (j.bonus_ranking_ativo) {
                if(j.atributos) {
                    j.atributos.ataque = Math.max(1, (j.atributos.ataque || 0) - (j.bonus_ranking_ativo.ataque || 0));
                    j.atributos.habilidade = Math.max(1, (j.atributos.habilidade || 0) - (j.bonus_ranking_ativo.habilidade || 0));
                }
                j.bonus_ranking_ativo = null;
            }
        });

        let topGols = [...todosParaRanking].filter(j => j.dados.estatisticas && j.dados.estatisticas.gols > 0)
            .sort((a,b) => b.dados.estatisticas.gols - a.dados.estatisticas.gols).slice(0, 10);

        let topAsts = [...todosParaRanking].filter(j => j.dados.estatisticas && j.dados.estatisticas.assistencias > 0)
            .sort((a,b) => b.dados.estatisticas.assistencias - a.dados.estatisticas.assistencias).slice(0, 10);

        topGols.forEach((jog, i) => {
            let bonus = 5.0 - (i * 0.5);
            jog.dados.bonus_ranking_ativo = jog.dados.bonus_ranking_ativo || { ataque: 0, habilidade: 0 };
            jog.dados.bonus_ranking_ativo.ataque = bonus;
            jog.dados.atributos.ataque = (jog.dados.atributos.ataque || 0) + bonus;
        });

        topAsts.forEach((jog, i) => {
            let bonus = 5.0 - (i * 0.5);
            jog.dados.bonus_ranking_ativo = jog.dados.bonus_ranking_ativo || { ataque: 0, habilidade: 0 };
            jog.dados.bonus_ranking_ativo.habilidade = bonus;
            jog.dados.atributos.habilidade = (jog.dados.atributos.habilidade || 0) + bonus;
        });

        // 4. A Regra de Ouro: O Valor de Mercado obedece ao OVR Dinâmico
        todosParaRanking.forEach(jog => {
            let j = jog.dados;
            let at = j.atributos || {};

            let atq = at.ataque || 5; let def = at.defesa || 5; let frc = at.forca || 5; let vel = at.velocidade || 5; let hab = at.habilidade || 5;

            if ((j.pro_player || (j.nome && j.nome.includes("(PRO)"))) && (atq > 20 || def > 20)) {
                atq /= 6; def /= 6; frc /= 6; vel /= 6; hab /= 6;
            }

            let ovrMercado = (atq + def + frc + vel + hab) / 5;
            j.valor_mercado = Math.round(ovrMercado * 2500000);

            // 🛡️ PROTEÇÃO: Se o jogador foi VENDIDO hoje, não ressuscite ele no time antigo!
            if (updates[`banco_global_times/${jog.time}/jogadores/${jog.id}`] !== null) {
                updates[`banco_global_times/${jog.time}/jogadores/${jog.id}`] = j;
            }
        });

        // ========================================================
        // --- PASSO C.3: BANCO CENTRAL (COBRANÇAS E PENHORAS) ---
        // ========================================================
        let novaRodadaCobranca = cal ? (cal.rodadaAtual || 1) : 1;
        let rodadasParaCobrar = novaRodadaCobranca - (rodadaAtual || 1); // Garante cobrar retroativo se ficou dias sem logar

        if (rodadasParaCobrar > 0) {
            const snapDividas = await db.ref(`ligas/${liga}/dividas_financeiras`).once('value');
            const dividas = snapDividas.val();

            if (dividas) {
                // Precisamos buscar o estado atual dos cofres para pagar os investidores
                const snapCofres = await db.ref(`ligas/${liga}/banco_investidores`).once('value');
                let cofres = snapCofres.val() || {};

                for (let idDivida in dividas) {
                    let div = dividas[idDivida];
                    let devedor = div.devedor;
                    let credor = div.credor;
                    let parcelaBase = div.parcela_rodada;

                    // Multiplica a parcela pelos dias atrasados
                    let totalCobradoNaRodada = parcelaBase * rodadasParaCobrar;

                    let loginDevedor = null;
                    for (let u in usuarios) { if (usuarios[u].timeAtual === devedor) { loginDevedor = u; break; } }

                    if (loginDevedor && usuarios[loginDevedor]) {
                        if (usuarios[loginDevedor].caixaClube >= totalCobradoNaRodada) {
                            // 🟢 PAGAMENTO EM DIA
                            usuarios[loginDevedor].caixaClube -= totalCobradoNaRodada;
                            updates[`ligas/${liga}/usuarios/${loginDevedor}/caixaClube`] = usuarios[loginDevedor].caixaClube;

                            // Repassa ao Credor (se não for o Banco Central)
                            if (credor !== 'Banco Central da Liga') {
                                if (!cofres[credor]) cofres[credor] = { saldo: 0 };
                                cofres[credor].saldo += totalCobradoNaRodada;
                                updates[`ligas/${liga}/banco_investidores/${credor}/saldo`] = cofres[credor].saldo;
                            }

                            div.rodadas_restantes -= rodadasParaCobrar;
                            div.valor_total -= totalCobradoNaRodada;

                            if (div.rodadas_restantes <= 0 || div.valor_total <= 0) {
                                updates[`ligas/${liga}/dividas_financeiras/${idDivida}`] = null; // Dívida Quitada!
                            } else {
                                updates[`ligas/${liga}/dividas_financeiras/${idDivida}/rodadas_restantes`] = div.rodadas_restantes;
                                updates[`ligas/${liga}/dividas_financeiras/${idDivida}/valor_total`] = div.valor_total;
                            }
                        } else {
                            // 🔴 CALOTE! MODO OFICIAL DE JUSTIÇA (PENHORA)
                            let elencoDevedor = times[devedor] && times[devedor].jogadores ? Object.values(times[devedor].jogadores) : [];

                            if (elencoDevedor.length > 0) {
                                // Pega o jogador mais barato do time
                                let piorJogador = elencoDevedor.sort((a,b) => (a.valor_mercado||0) - (b.valor_mercado||0))[0];
                                let idBagre = Object.keys(times[devedor].jogadores).find(k => times[devedor].jogadores[k].nome === piorJogador.nome);

                                if (idBagre) {
                                    updates[`banco_global_times/${devedor}/jogadores/${idBagre}`] = null; // Tira do devedor

                                    // Para onde vai o jogador? Se for Banco Central, vira Agente Livre. Se for Player, vai pro time dele!
                                    let destinoPenhora = credor === 'Banco Central da Liga' ? `Agentes_Livres_${liga}` : credor;
                                    updates[`banco_global_times/${destinoPenhora}/jogadores/${idBagre}`] = piorJogador;

                                    let valorAbatido = piorJogador.valor_mercado || 1000000;
                                    div.valor_total -= valorAbatido;

                                    // Envia o telegrama assustador pro devedor
                                    let idMsg = "msg_penhora_" + Date.now() + Math.floor(Math.random()*1000);
                                    updates[`ligas/${liga}/caixa_mensagens/${loginDevedor}/${idMsg}`] = {
                                        tipo: 'recusa',
                                        texto: `🚨 PENHORA! Sem dinheiro para pagar a dívida com ${credor.replace(/_/g,' ')}, a justiça confiscou seu jogador ${piorJogador.nome} (Abateu ${formatarDinheiro(valorAbatido)}).`,
                                        data: new Date().toISOString()
                                    };

                                    // Se o jogador era mais caro que a dívida, quita tudo. Senão, ajusta o saldo.
                                    if (div.valor_total <= 0) {
                                        updates[`ligas/${liga}/dividas_financeiras/${idDivida}`] = null;
                                    } else {
                                        div.parcela_rodada = Math.round(div.valor_total / (div.rodadas_restantes || 1)); // Recalcula a parcela
                                        updates[`ligas/${liga}/dividas_financeiras/${idDivida}`] = div;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- PASSO D: FINALIZAR E AVISAR ---
        if (rodarCampHoje) updates[`ligas/${liga}/sistema/ultima_simulacao_camp`] = dataAtualStr;
        if (rodarCopaHoje) updates[`ligas/${liga}/sistema/ultima_simulacao_copa`] = dataAtualStr;
        if (rodarAtrasados) {
            if (!updates[`ligas/${liga}/sistema/ultima_simulacao_camp`]) updates[`ligas/${liga}/sistema/ultima_simulacao_camp`] = ontemStr;
            if (!updates[`ligas/${liga}/sistema/ultima_simulacao_copa`]) updates[`ligas/${liga}/sistema/ultima_simulacao_copa`] = ontemStr;
        }

        console.log(`📝 [FIREBASE] Pacote de atualizações montado! Total de itens a alterar: ${Object.keys(updates).length}`);
        console.log(`🔍 [FIREBASE] Espiando o pacote:`, updates);

        try {
            // Dispara todos os dados para o Firebase!
            await db.ref().update(updates);
            console.log("✅ [FIREBASE] Banco de dados atualizado com sucesso. Nenhuma rejeição!");
        } catch (errDb) {
            console.error("❌ [FIREBASE] ERRO CRÍTICO! A nuvem recusou o pacote. Motivo:", errDb);
        }

        // 🔓 Libera a tranca de forma segura para o próximo ciclo
        await lockRef.set({ locked: false, timestamp: 0 });

        console.log("✅ MOTOR P2P: O Trator terminou o serviço.");

        if (transferenciasRealizadas > 0) {
            dispararNotificacao("Mercado Fechado! 🛒", "Negociações e avaliações de propostas encerradas.");
        }

        // Corrige a variável antiga e mostra o aviso correto!
        if (rodarCampHoje || rodarCopaHoje) {
            dispararNotificacao("Fim do Aquecimento! ⚽", "As escalações foram bloqueadas e a bola vai rolar!");
        } else if (rodarAtrasados) {
            dispararNotificacao("🚜 Trator Acionado!", "O sistema simulou rodadas ou limpezas de mercado que estavam pendentes.");
        }

    } catch (e) {
        console.error("Erro crítico no Motor P2P:", e);
        // Em caso de falha severa, garante que a porta NUNCA fique trancada
        if (lockRef) await lockRef.set({ locked: false, timestamp: 0 });
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

        // CHECAGEM 3: CAIXA DE MENSAGENS (Alertas de Transferência)
        if (ligaDados.caixa_mensagens && ligaDados.caixa_mensagens[userLogadoMotor]) {
            let msgs = ligaDados.caixa_mensagens[userLogadoMotor];
            for (let m in msgs) {
                let msg = msgs[m];
                countNotif++;
                let cor = msg.tipo === 'sucesso' ? '#00b853' : '#dc3545';

                htmlNotif += `<div onclick="marcarMensagemLida('${m}')" style="background: #1a1a1a; padding: 10px; border-radius: 4px; border-left: 3px solid ${cor}; cursor: pointer; transition: 0.2s; margin-top: 5px;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#1a1a1a'">
                    <strong style="color:${cor}; font-size:12px;">Retorno do Mercado</strong><br>
                    <span style="color:#ccc; font-size:11px;">${msg.texto}</span>
                    <div style="text-align:right; margin-top:4px;"><small style="color:#666;">Clique para apagar aviso</small></div>
                </div>`;
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

// Apaga a mensagem quando o usuário clica nela!
window.marcarMensagemLida = function(idMsg) {
    db.ref(`ligas/${ligaMotor}/caixa_mensagens/${userLogadoMotor}/${idMsg}`).remove();
};

function formatarDinheiro(v){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v); }

        // ========================================================
        // --- PASSO C.3: BANCO CENTRAL (COBRANÇAS E PENHORAS) ---
        // ========================================================
        let novaRodadaCobranca = cal ? (cal.rodadaAtual || 1) : 1;
        let rodadasParaCobrar = novaRodadaCobranca - (rodadaAtual || 1); // Garante cobrar retroativo se ficou dias sem logar

        if (rodadasParaCobrar > 0) {
            const snapDividas = await db.ref(`ligas/${liga}/dividas_financeiras`).once('value');
            const dividas = snapDividas.val();

            if (dividas) {
                // Precisamos buscar o estado atual dos cofres para pagar os investidores
                const snapCofres = await db.ref(`ligas/${liga}/banco_investidores`).once('value');
                let cofres = snapCofres.val() || {};

                for (let idDivida in dividas) {
                    let div = dividas[idDivida];
                    let devedor = div.devedor;
                    let credor = div.credor;
                    let parcelaBase = div.parcela_rodada;

                    // Multiplica a parcela pelos dias atrasados
                    let totalCobradoNaRodada = parcelaBase * rodadasParaCobrar;

                    let loginDevedor = null;
                    for (let u in usuarios) { if (usuarios[u].timeAtual === devedor) { loginDevedor = u; break; } }

                    if (loginDevedor && usuarios[loginDevedor]) {
                        if (usuarios[loginDevedor].caixaClube >= totalCobradoNaRodada) {
                            // 🟢 PAGAMENTO EM DIA
                            usuarios[loginDevedor].caixaClube -= totalCobradoNaRodada;
                            updates[`ligas/${liga}/usuarios/${loginDevedor}/caixaClube`] = usuarios[loginDevedor].caixaClube;

                            // Repassa ao Credor (se não for o Banco Central)
                            if (credor !== 'Banco Central da Liga') {
                                if (!cofres[credor]) cofres[credor] = { saldo: 0 };
                                cofres[credor].saldo += totalCobradoNaRodada;
                                updates[`ligas/${liga}/banco_investidores/${credor}/saldo`] = cofres[credor].saldo;
                            }

                            div.rodadas_restantes -= rodadasParaCobrar;
                            div.valor_total -= totalCobradoNaRodada;

                            if (div.rodadas_restantes <= 0 || div.valor_total <= 0) {
                                updates[`ligas/${liga}/dividas_financeiras/${idDivida}`] = null; // Dívida Quitada!
                            } else {
                                updates[`ligas/${liga}/dividas_financeiras/${idDivida}/rodadas_restantes`] = div.rodadas_restantes;
                                updates[`ligas/${liga}/dividas_financeiras/${idDivida}/valor_total`] = div.valor_total;
                            }
                        } else {
                            // 🔴 CALOTE! MODO OFICIAL DE JUSTIÇA (PENHORA)
                            let elencoDevedor = times[devedor] && times[devedor].jogadores ? Object.values(times[devedor].jogadores) : [];

                            if (elencoDevedor.length > 0) {
                                // Pega o jogador mais barato do time
                                let piorJogador = elencoDevedor.sort((a,b) => (a.valor_mercado||0) - (b.valor_mercado||0))[0];
                                let idBagre = Object.keys(times[devedor].jogadores).find(k => times[devedor].jogadores[k].nome === piorJogador.nome);

                                if (idBagre) {
                                    updates[`banco_global_times/${devedor}/jogadores/${idBagre}`] = null; // Tira do devedor

                                    // Para onde vai o jogador? Se for Banco Central, vira Agente Livre. Se for Player, vai pro time dele!
                                    let destinoPenhora = credor === 'Banco Central da Liga' ? `Agentes_Livres_${liga}` : credor;
                                    updates[`banco_global_times/${destinoPenhora}/jogadores/${idBagre}`] = piorJogador;

                                    let valorAbatido = piorJogador.valor_mercado || 1000000;
                                    div.valor_total -= valorAbatido;

                                    // Envia o telegrama assustador pro devedor
                                    let idMsg = "msg_penhora_" + Date.now() + Math.floor(Math.random()*1000);
                                    updates[`ligas/${liga}/caixa_mensagens/${loginDevedor}/${idMsg}`] = {
                                        tipo: 'recusa',
                                        texto: `🚨 PENHORA! Sem dinheiro para pagar a dívida com ${credor.replace(/_/g,' ')}, a justiça confiscou seu jogador ${piorJogador.nome} (Abateu ${formatarDinheiro(valorAbatido)}).`,
                                        data: new Date().toISOString()
                                    };

                                    // Se o jogador era mais caro que a dívida, quita tudo. Senão, ajusta o saldo.
                                    if (div.valor_total <= 0) {
                                        updates[`ligas/${liga}/dividas_financeiras/${idDivida}`] = null;
                                    } else {
                                        div.parcela_rodada = Math.round(div.valor_total / (div.rodadas_restantes || 1)); // Recalcula a parcela
                                        updates[`ligas/${liga}/dividas_financeiras/${idDivida}`] = div;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- PASSO D: FINALIZAR E AVISAR ---
        if (rodarCampHoje) updates[`ligas/${liga}/sistema/ultima_simulacao_camp`] = dataAtualStr;
        if (rodarCopaHoje) updates[`ligas/${liga}/sistema/ultima_simulacao_copa`] = dataAtualStr;
        if (rodarAtrasados) {
            if (!updates[`ligas/${liga}/sistema/ultima_simulacao_camp`]) updates[`ligas/${liga}/sistema/ultima_simulacao_camp`] = ontemStr;
            if (!updates[`ligas/${liga}/sistema/ultima_simulacao_copa`]) updates[`ligas/${liga}/sistema/ultima_simulacao_copa`] = ontemStr;
        }

        // Dispara todos os dados para o Firebase!
        await db.ref().update(updates);

        // 🔓 Libera a tranca de forma segura para o próximo ciclo
        await lockRef.set({ locked: false, timestamp: 0 });

        console.log("✅ MOTOR P2P: Rotinas noturnas concluídas com sucesso!");

        if (transferenciasRealizadas > 0) {
            dispararNotificacao("Mercado Fechado! 🛒", "Negociações e avaliações de propostas encerradas.");
        }

        // Corrige a variável antiga e mostra o aviso correto!
        if (rodarCampHoje || rodarCopaHoje) {
            dispararNotificacao("Fim do Aquecimento! ⚽", "As escalações foram bloqueadas e a bola vai rolar!");
        } else if (rodarAtrasados) {
            dispararNotificacao("🚜 Trator Acionado!", "O sistema simulou rodadas ou limpezas de mercado que estavam pendentes.");
        }

    } catch (e) {
        console.error("Erro crítico no Motor P2P:", e);
        // Em caso de falha severa, garante que a porta NUNCA fique trancada
        if (lockRef) await lockRef.set({ locked: false, timestamp: 0 });
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

        // CHECAGEM 3: CAIXA DE MENSAGENS (Alertas de Transferência)
        if (ligaDados.caixa_mensagens && ligaDados.caixa_mensagens[userLogadoMotor]) {
            let msgs = ligaDados.caixa_mensagens[userLogadoMotor];
            for (let m in msgs) {
                let msg = msgs[m];
                countNotif++;
                let cor = msg.tipo === 'sucesso' ? '#00b853' : '#dc3545';

                htmlNotif += `<div onclick="marcarMensagemLida('${m}')" style="background: #1a1a1a; padding: 10px; border-radius: 4px; border-left: 3px solid ${cor}; cursor: pointer; transition: 0.2s; margin-top: 5px;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#1a1a1a'">
                    <strong style="color:${cor}; font-size:12px;">Retorno do Mercado</strong><br>
                    <span style="color:#ccc; font-size:11px;">${msg.texto}</span>
                    <div style="text-align:right; margin-top:4px;"><small style="color:#666;">Clique para apagar aviso</small></div>
                </div>`;
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

// Apaga a mensagem quando o usuário clica nela!
window.marcarMensagemLida = function(idMsg) {
    db.ref(`ligas/${ligaMotor}/caixa_mensagens/${userLogadoMotor}/${idMsg}`).remove();
};
            badge.innerText = countNotif;
            lista.innerHTML = htmlNotif;
        } else {
            badge.style.display = 'none';
            lista.innerHTML = `<span style="color:#888; font-size:12px;">Nenhuma novidade.</span>`;
        }
    });
}

function formatarDinheiro(v){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v); }