// js/motor.js

// Usando var para evitar SyntaxError de conflito com os outros arquivos!
var ligaMotor = localStorage.getItem('treinadorLiga');
var userLogadoMotor = localStorage.getItem('treinadorUsuario');

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

function formDinheiroMotor(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
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

                // Se a proposta é tão velha que nem data tem, é pendência urgente!
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
        let propostas = snapPropostas.val() || {};

        let timesHumanos = Object.values(usuarios).map(u => u.timeAtual).filter(t => t && t !== "Sem Clube");
        let timesIA = Object.keys(times).filter(t => !t.startsWith("Agentes_Livres") && t !== "Fantasma" && !timesHumanos.includes(t));

        // 🧠 A IA só toma novas iniciativas se for hora oficial do campeonato
        if (rodarCampHoje || rodarAtrasados) {
            for (let t of timesIA) {
                let loginIA = `IA_${t}`;
                if (!usuarios[loginIA]) {
                    usuarios[loginIA] = { nome: `Diretoria ${t.replace(/_/g,' ')}`, timeAtual: t, caixaClube: 30000000 };
                    updates[`ligas/${liga}/usuarios/${loginIA}`] = usuarios[loginIA];
                }

                let caixaClubeIA = usuarios[loginIA].caixaClube || 0;

                if (Math.random() < 0.25) {
                    if (caixaClubeIA < 5000000) {
                        let valorPedido = 15000000;
                        let rodadas = 10;
                        let parcela = Math.round((valorPedido * 1.5) / rodadas);
                        caixaClubeIA += valorPedido;
                        usuarios[loginIA].caixaClube = caixaClubeIA;
                        updates[`ligas/${liga}/usuarios/${loginIA}/caixaClube`] = caixaClubeIA;
                        updates[`ligas/${liga}/dividas_financeiras/divida_ia_${t}_${Date.now()}`] = { devedor: t, credor: 'Banco Central da Liga', valor_total: valorPedido * 1.5, parcela_rodada: parcela, rodadas_restantes: rodadas };
                    }
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
                                propostas[alvo.id][loginIA] = { time_comprador: t, valor_oferecido: valorOferecido, data_proposta: new Date().toISOString(), tipo_negocio: isCompra ? 'compra' : 'emprestimo', duracao_rodadas: duracao };
                                updates[`ligas/${liga}/mercado_propostas/${alvo.id}/${loginIA}`] = propostas[alvo.id][loginIA];
                            }
                        }
                    }
                    else if (caixaClubeIA > 40000000 && Math.random() < 0.2) {
                        const snapBanc = await db.ref(`ligas/${liga}/banco_investidores/${t}`).once('value');
                        let invAtual = snapBanc.val() ? snapBanc.val().saldo : 0;
                        let valorInvestido = 10000000;
                        caixaClubeIA -= valorInvestido;
                        usuarios[loginIA].caixaClube = caixaClubeIA;
                        updates[`ligas/${liga}/usuarios/${loginIA}/caixaClube`] = caixaClubeIA;
                        updates[`ligas/${liga}/banco_investidores/${t}`] = { saldo: invAtual + valorInvestido, dono_login: loginIA, is_ia: true };
                    }
                }
            }
        }

        let transferenciasRealizadas = 0;

        if (Object.keys(propostas).length > 0) {
            console.log(`🔨 [MERCADO] Iniciando o julgamento de ${Object.keys(propostas).length} jogador(es) na mesa...`);
            for (let idAlvo in propostas) {
                let lances = propostas[idAlvo];
                let timeDoAlvo = null;
                let dadosDoAlvo = null;

                for (let t in times) {
                    if (times[t].jogadores && times[t].jogadores[idAlvo]) {
                        timeDoAlvo = t; dadosDoAlvo = times[t].jogadores[idAlvo]; break;
                    }
                }

                if (!dadosDoAlvo) { updates[`ligas/${liga}/mercado_propostas/${idAlvo}`] = null; continue; }

                let primeiraDataStr = Object.values(lances)[0].data_proposta;
                // Se não tem data, data base para expirar logo
                let dataProp = primeiraDataStr ? new Date(primeiraDataStr) : new Date(0);
                let agora = new Date();
                let isHoje = dataProp.getDate() === agora.getDate() && dataProp.getMonth() === agora.getMonth() && dataProp.getFullYear() === agora.getFullYear();
                let horaAtual = agora.getHours();

                if (isHoje && horaAtual < 19) continue;

                let isDonoHumano = false;
                for (let u in usuarios) { if (usuarios[u].timeAtual === timeDoAlvo) { isDonoHumano = true; break; } }

                if (isDonoHumano) {
                    for (let login in lances) {
                        if (!login.startsWith('IA_')) {
                            updates[`ligas/${liga}/caixa_mensagens/${login}/msg_expirou_${Date.now()}_${Math.floor(Math.random()*1000)}`] = { tipo: 'recusa', texto: `Sua oferta por ${dadosDoAlvo.nome} EXPIROU. O treinador do ${timeDoAlvo.replace(/_/g,' ')} não respondeu a tempo.`, data: new Date().toISOString() };
                        }
                    }
                    updates[`ligas/${liga}/mercado_propostas/${idAlvo}`] = null;
                    continue;
                }

                let maiorScore = 0; let lanceVencedor = null; let loginVencedor = "";
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
                        if (scoreLance >= taxaMinima && scoreLance > maiorScore) { maiorScore = scoreLance; lanceVencedor = lance; loginVencedor = login; }
                    } else {
                        let dadosJogadorOferecido = null;
                        if (lance.id_jogador_oferecido) {
                            dadosJogadorOferecido = times[lance.time_comprador]?.jogadores?.[lance.id_jogador_oferecido];
                            if (dadosJogadorOferecido) scoreLance += dadosJogadorOferecido.valor_mercado;
                        }
                        if (scoreLance > maiorScore && scoreLance >= valorMinimoIA) { maiorScore = scoreLance; lanceVencedor = lance; loginVencedor = login; lanceVencedor.dados_jogador_oferecido = dadosJogadorOferecido; }
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
                        updates[`ligas/${liga}/caixa_mensagens/${loginVencedor}/msg_compra_${Date.now()}`] = { tipo: 'sucesso', texto: `A diretoria do ${timeDoAlvo.replace(/_/g,' ')} ACEITOU sua oferta. ${dadosDoAlvo.nome} se juntou ao elenco!`, data: new Date().toISOString() };
                    }
                    for (let login in lances) {
                        if (login !== loginVencedor && !login.startsWith('IA_')) {
                            updates[`ligas/${liga}/caixa_mensagens/${login}/msg_perda_${Date.now()}_${Math.floor(Math.random() * 1000)}`] = { tipo: 'recusa', texto: `Você perdeu o leilão por ${dadosDoAlvo.nome}. Outro clube cobriu sua oferta final.`, data: new Date().toISOString() };
                        }
                    }
                } else {
                    for (let login in lances) {
                        if (!login.startsWith('IA_')) {
                            updates[`ligas/${liga}/caixa_mensagens/${login}/msg_recusa_${Date.now()}_${Math.floor(Math.random() * 1000)}`] = { tipo: 'recusa', texto: `A diretoria do ${timeDoAlvo.replace(/_/g,' ')} RECUSOU sua proposta por ${dadosDoAlvo.nome}. Os valores ficaram abaixo da pedida.`, data: new Date().toISOString() };
                        }
                    }
                }
                updates[`ligas/${liga}/mercado_propostas/${idAlvo}`] = null;
            }
        }

        // --- PASSO B: FORMATURA DOS PRO PLAYERS ---
        let rodadaAtual = cal ? (cal.rodadaAtual || 1) : 1;
        if (rodadaAtual >= 5) {
            const snapProPlayers = await db.ref(`ligas/${liga}/pro_players`).once('value');
            const proPlayers = snapProPlayers.val();
            if (proPlayers) {
                for (let criador in proPlayers) {
                    let p = proPlayers[criador];
                    if (p.status === "avaliando") {
                        let at = p.atributos_base; let qtdVotos = 1; let sA = at.ataque, sD = at.defesa, sF = at.forca, sV = at.velocidade, sH = at.habilidade;
                        if (p.avaliacoes) { for (let v in p.avaliacoes) { sA += p.avaliacoes[v].ataque || 60; sD += p.avaliacoes[v].defesa || 60; sF += p.avaliacoes[v].forca || 60; sV += p.avaliacoes[v].velocidade || 60; sH += p.avaliacoes[v].habilidade || 60; qtdVotos++; } }
                        let finalAtq = Math.round((sA / qtdVotos) / 6); let finalDef = Math.round((sD / qtdVotos) / 6); let finalFor = Math.round((sF / qtdVotos) / 6); let finalVel = Math.round((sV / qtdVotos) / 6); let finalHab = Math.round((sH / qtdVotos) / 6);
                        let ovrFinal = Math.round((finalAtq + finalDef + finalFor + finalVel + finalHab) / 5);
                        let valorMercado = ovrFinal * 2500000;
                        let jogadorPronto = { nome: p.nome + " (PRO)", posicoes: { p: p.posicao, s: "IND", t: "IND" }, atributos: { ataque: finalAtq, defesa: finalDef, forca: finalFor, velocidade: finalVel, habilidade: finalHab }, valor_mercado: valorMercado, pro_player: true };
                        let idUnico = "PRO_" + criador; let timeAgentes = `Agentes_Livres_${liga}`;
                        updates[`banco_global_times/${timeAgentes}/divisao`] = "Livre"; updates[`banco_global_times/${timeAgentes}/jogadores/${idUnico}`] = jogadorPronto;
                        let notaConvertida = (ovrFinal / 300) * 5;
                        updates[`ligas/${liga}/pro_players/${criador}/status`] = "mercado"; updates[`ligas/${liga}/pro_players/${criador}/ovr_final`] = ovrFinal; updates[`ligas/${liga}/pro_players/${criador}/nota_comunidade`] = notaConvertida.toFixed(1);
                    }
                }
            }
        }

        // --- PASSO C.2: FISCALIZAÇÃO DOS CONTRATOS DE EMPRÉSTIMO ---
        let novaRodadaAtual = cal ? (cal.rodadaAtual || 1) : 1; let rodadasAvancadas = novaRodadaAtual - rodadaAtual;
        if (rodadasAvancadas > 0) {
            const snapEmp = await db.ref(`ligas/${liga}/emprestimos_ativos`).once('value'); const emprestimos = snapEmp.val();
            if (emprestimos) {
                for (let idJog in emprestimos) {
                    let emp = emprestimos[idJog]; emp.rodadas_restantes -= rodadasAvancadas;
                    if (emp.rodadas_restantes <= 0) {
                        let tLocatario = emp.time_destino; let tDono = emp.time_origem; let dJog = null;
                        if (times[tLocatario] && times[tLocatario].jogadores && times[tLocatario].jogadores[idJog]) dJog = times[tLocatario].jogadores[idJog];
                        if (dJog) { delete dJog.status_emprestimo; updates[`banco_global_times/${tLocatario}/jogadores/${idJog}`] = null; updates[`banco_global_times/${tDono}/jogadores/${idJog}`] = dJog; let idMsgE = "msg_emp_" + Date.now() + Math.floor(Math.random()*1000); for (let u in usuarios) { if (usuarios[u].timeAtual === tLocatario) { updates[`ligas/${liga}/caixa_mensagens/${u}/${idMsgE}_1`] = { tipo: 'recusa', texto: `O contrato de empréstimo de ${dJog.nome} encerrou. Ele arrumou as malas e voltou ao ${tDono.replace(/_/g,' ')}.`, data: new Date().toISOString() }; } if (usuarios[u].timeAtual === tDono) { updates[`ligas/${liga}/caixa_mensagens/${u}/${idMsgE}_2`] = { tipo: 'sucesso', texto: `O empréstimo acabou! ${dJog.nome} está de volta e já se apresentou no seu CT.`, data: new Date().toISOString() }; } } }
                        updates[`ligas/${liga}/emprestimos_ativos/${idJog}`] = null;
                    } else {
                        updates[`ligas/${liga}/emprestimos_ativos/${idJog}/rodadas_restantes`] = emp.rodadas_restantes; updates[`banco_global_times/${emp.time_destino}/jogadores/${idJog}/status_emprestimo/rodadas_restantes`] = emp.rodadas_restantes;
                    }
                }
            }
        }

        // 🏆 SISTEMA DE FASE (MOMENTO) - BÔNUS AO VIVO TOP 10
        let todosParaRanking = []; for (let t in times) { if (times[t].jogadores) { for (let idJog in times[t].jogadores) { todosParaRanking.push({ time: t, id: idJog, dados: times[t].jogadores[idJog] }); } } }
        todosParaRanking.forEach(jog => { let j = jog.dados; if (j.bonus_ranking_ativo) { if(j.atributos) { j.atributos.ataque = Math.max(1, (j.atributos.ataque || 0) - (j.bonus_ranking_ativo.ataque || 0)); j.atributos.habilidade = Math.max(1, (j.atributos.habilidade || 0) - (j.bonus_ranking_ativo.habilidade || 0)); } j.bonus_ranking_ativo = null; } });
        let topGols = [...todosParaRanking].filter(j => j.dados.estatisticas && j.dados.estatisticas.gols > 0).sort((a,b) => b.dados.estatisticas.gols - a.dados.estatisticas.gols).slice(0, 10);
        let topAsts = [...todosParaRanking].filter(j => j.dados.estatisticas && j.dados.estatisticas.assistencias > 0).sort((a,b) => b.dados.estatisticas.assistencias - a.dados.estatisticas.assistencias).slice(0, 10);
        topGols.forEach((jog, i) => { let bonus = 5.0 - (i * 0.5); jog.dados.bonus_ranking_ativo = jog.dados.bonus_ranking_ativo || { ataque: 0, habilidade: 0 }; jog.dados.bonus_ranking_ativo.ataque = bonus; jog.dados.atributos.ataque = (jog.dados.atributos.ataque || 0) + bonus; });
        topAsts.forEach((jog, i) => { let bonus = 5.0 - (i * 0.5); jog.dados.bonus_ranking_ativo = jog.dados.bonus_ranking_ativo || { ataque: 0, habilidade: 0 }; jog.dados.bonus_ranking_ativo.habilidade = bonus; jog.dados.atributos.habilidade = (jog.dados.atributos.habilidade || 0) + bonus; });
        todosParaRanking.forEach(jog => { let j = jog.dados; let at = j.atributos || {}; let atq = at.ataque || 5; let def = at.defesa || 5; let frc = at.forca || 5; let vel = at.velocidade || 5; let hab = at.habilidade || 5; if ((j.pro_player || (j.nome && j.nome.includes("(PRO)"))) && (atq > 20 || def > 20)) { atq /= 6; def /= 6; frc /= 6; vel /= 6; hab /= 6; } let ovrMercado = (atq + def + frc + vel + hab) / 5; j.valor_mercado = Math.round(ovrMercado * 2500000); if (updates[`banco_global_times/${jog.time}/jogadores/${jog.id}`] !== null) { updates[`banco_global_times/${jog.time}/jogadores/${jog.id}`] = j; } });

        // --- PASSO C.3: BANCO CENTRAL (COBRANÇAS E PENHORAS) ---
        let novaRodadaCobranca = cal ? (cal.rodadaAtual || 1) : 1; let rodadasParaCobrar = novaRodadaCobranca - (rodadaAtual || 1);
        if (rodadasParaCobrar > 0) {
            const snapDividas = await db.ref(`ligas/${liga}/dividas_financeiras`).once('value'); const dividas = snapDividas.val();
            if (dividas) {
                const snapCofres = await db.ref(`ligas/${liga}/banco_investidores`).once('value'); let cofres = snapCofres.val() || {};
                for (let idDivida in dividas) {
                    let div = dividas[idDivida]; let devedor = div.devedor; let credor = div.credor; let parcelaBase = div.parcela_rodada; let totalCobradoNaRodada = parcelaBase * rodadasParaCobrar; let loginDevedor = null;
                    for (let u in usuarios) { if (usuarios[u].timeAtual === devedor) { loginDevedor = u; break; } }
                    if (loginDevedor && usuarios[loginDevedor]) {
                        if (usuarios[loginDevedor].caixaClube >= totalCobradoNaRodada) {
                            usuarios[loginDevedor].caixaClube -= totalCobradoNaRodada; updates[`ligas/${liga}/usuarios/${loginDevedor}/caixaClube`] = usuarios[loginDevedor].caixaClube;
                            if (credor !== 'Banco Central da Liga') { if (!cofres[credor]) cofres[credor] = { saldo: 0 }; cofres[credor].saldo += totalCobradoNaRodada; updates[`ligas/${liga}/banco_investidores/${credor}/saldo`] = cofres[credor].saldo; }
                            div.rodadas_restantes -= rodadasParaCobrar; div.valor_total -= totalCobradoNaRodada;
                            if (div.rodadas_restantes <= 0 || div.valor_total <= 0) { updates[`ligas/${liga}/dividas_financeiras/${idDivida}`] = null; } else { updates[`ligas/${liga}/dividas_financeiras/${idDivida}/rodadas_restantes`] = div.rodadas_restantes; updates[`ligas/${liga}/dividas_financeiras/${idDivida}/valor_total`] = div.valor_total; }
                        } else {
                            let elencoDevedor = times[devedor] && times[devedor].jogadores ? Object.values(times[devedor].jogadores) : [];
                            if (elencoDevedor.length > 0) {
                                let piorJogador = elencoDevedor.sort((a,b) => (a.valor_mercado||0) - (b.valor_mercado||0))[0]; let idBagre = Object.keys(times[devedor].jogadores).find(k => times[devedor].jogadores[k].nome === piorJogador.nome);
                                if (idBagre) {
                                    updates[`banco_global_times/${devedor}/jogadores/${idBagre}`] = null; let destinoPenhora = credor === 'Banco Central da Liga' ? `Agentes_Livres_${liga}` : credor; updates[`banco_global_times/${destinoPenhora}/jogadores/${idBagre}`] = piorJogador; let valorAbatido = piorJogador.valor_mercado || 1000000; div.valor_total -= valorAbatido; let idMsg = "msg_penhora_" + Date.now() + Math.floor(Math.random()*1000); updates[`ligas/${liga}/caixa_mensagens/${loginDevedor}/${idMsg}`] = { tipo: 'recusa', texto: `🚨 PENHORA! Sem dinheiro para pagar a dívida com ${credor.replace(/_/g,' ')}, a justiça confiscou seu jogador ${piorJogador.nome} (Abateu ${formDinheiroMotor(valorAbatido)}).`, data: new Date().toISOString() };
                                    if (div.valor_total <= 0) { updates[`ligas/${liga}/dividas_financeiras/${idDivida}`] = null; } else { div.parcela_rodada = Math.round(div.valor_total / (div.rodadas_restantes || 1)); updates[`ligas/${liga}/dividas_financeiras/${idDivida}`] = div; }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (rodarCampHoje) updates[`ligas/${liga}/sistema/ultima_simulacao_camp`] = dataAtualStr;
        if (rodarCopaHoje) updates[`ligas/${liga}/sistema/ultima_simulacao_copa`] = dataAtualStr;
        if (rodarAtrasados) {
            if (!updates[`ligas/${liga}/sistema/ultima_simulacao_camp`]) updates[`ligas/${liga}/sistema/ultima_simulacao_camp`] = ontemStr;
            if (!updates[`ligas/${liga}/sistema/ultima_simulacao_copa`]) updates[`ligas/${liga}/sistema/ultima_simulacao_copa`] = ontemStr;
        }

        console.log(`📝 [FIREBASE] Pacote de atualizações montado! Total de itens a alterar: ${Object.keys(updates).length}`);

        try {
            await db.ref().update(updates);
            console.log("✅ [FIREBASE] Banco de dados atualizado com sucesso. Nenhuma rejeição!");
        } catch (errDb) {
            console.error("❌ [FIREBASE] ERRO CRÍTICO! A nuvem recusou o pacote. Motivo:", errDb);
        }

        await lockRef.set({ locked: false, timestamp: 0 });
        console.log("✅ MOTOR P2P: O Trator terminou o serviço.");

        if (transferenciasRealizadas > 0) dispararNotificacao("Mercado Fechado! 🛒", "Negociações e avaliações de propostas encerradas.");
        if (rodarCampHoje || rodarCopaHoje) dispararNotificacao("Fim do Aquecimento! ⚽", "As escalações foram bloqueadas e a bola vai rolar!");
        else if (rodarAtrasados) dispararNotificacao("🚜 Trator Acionado!", "O sistema simulou rodadas ou limpezas de mercado que estavam pendentes.");

    } catch (e) {
        console.error("Erro crítico no Motor P2P:", e);
        if (lockRef) lockRef.set({ locked: false, timestamp: 0 }).catch(()=>{});
    }
}

function registrarHallDaFama(liga, timeLiga, timeCopa, timeMundial, usuarios) {
    let donoL = "Sem Treinador"; let donoC = "Sem Treinador"; let donoM = "Sem Treinador";
    for(let u in usuarios) { if(usuarios[u].timeAtual === timeLiga) donoL = usuarios[u].nome || u; if(usuarios[u].timeAtual === timeCopa) donoC = usuarios[u].nome || u; if(usuarios[u].timeAtual === timeMundial) donoM = usuarios[u].nome || u; }
    let idTemp = "Temporada_" + new Date().getFullYear() + "_" + Math.floor(Math.random() * 1000);
    db.ref(`ligas/${liga}/historico_campeoes/${idTemp}`).set({ nome_temporada: `Temporada Finalizada (${new Date().getFullYear()})`, campeao_serie_a: { time: timeLiga.replace(/_/g, ' '), treinador: donoL }, campeao_copa: { time: timeCopa.replace(/_/g, ' '), treinador: donoC }, campeao_mundial: { time: timeMundial.replace(/_/g, ' '), treinador: donoM } });
}

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

    if(!badge || !lista) return;

    db.ref(`ligas/${ligaMotor}`).on('value', async snapLiga => {
        const ligaDados = snapLiga.val();
        if(!ligaDados) return;

        let countNotif = 0;
        let htmlNotif = "";

        if (ligaDados.pro_players) {
            let avaliacoesFaltando = 0;
            for (let dono in ligaDados.pro_players) {
                if (dono === userLogadoMotor) continue;
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

        if (ligaDados.mercado_propostas) {
            let meuTimeId = ligaDados.usuarios && ligaDados.usuarios[userLogadoMotor] ? ligaDados.usuarios[userLogadoMotor].timeAtual : null;
            if (meuTimeId && meuTimeId !== "Sem Clube") {
                const snapMeuTime = await db.ref(`banco_global_times/${meuTimeId}/jogadores`).once('value');
                const meusJogadores = snapMeuTime.val() || {};
                let propostasRecebidas = 0;
                for (let idJogador in ligaDados.mercado_propostas) {
                    if (meusJogadores[idJogador]) {
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

window.marcarMensagemLida = function(idMsg) {
    db.ref(`ligas/${ligaMotor}/caixa_mensagens/${userLogadoMotor}/${idMsg}`).remove();
};

function formatarDinheiro(v){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v); }