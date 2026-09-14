// js/ranking.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let timesGlobais = {};
let calendarioLiga = null;
let divisaoAtiva = "A";
window.treinadoresGlobais = {}; // 🟢 Mapeamento global de quem controla quem

window.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1º: Primeiro baixa a lista de todos os técnicos
        const snapAllUsers = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
        const allUsers = snapAllUsers.val() || {};
        window.treinadoresGlobais = {};
        for(let key in allUsers) {
            if(allUsers[key].timeAtual && allUsers[key].timeAtual !== "Sem Clube") {
                window.treinadoresGlobais[allUsers[key].timeAtual] = allUsers[key].nome;
            }
        }

        // 2º: Depois carrega o seu usuário
        dadosUsuario = allUsers[userLogado];

        if(!dadosUsuario || dadosUsuario.timeAtual === "Sem Clube") return window.location.href = "dashboard.html";

        document.getElementById('nome-treinador').innerText = dadosUsuario.nome;
        document.getElementById('nome-time').innerText = dadosUsuario.timeAtual.replace(/_/g, ' ');

        const snapMeusDadosTime = await db.ref(`banco_global_times/${dadosUsuario.timeAtual}`).once('value');
        if (snapMeusDadosTime.exists() && snapMeusDadosTime.val().divisao) {
            divisaoAtiva = snapMeusDadosTime.val().divisao;
            atualizarBotoesAba();
        }

        const snapTimes = await db.ref('banco_global_times').once('value');
        timesGlobais = snapTimes.val() || {};

        db.ref(`ligas/${ligaLogada}/calendario`).on('value', snapCal => {
            calendarioLiga = snapCal.val();
            renderizarTabela();
            carregarEstatisticasGerais(); // Dispara a busca de artilheiros
        });

    } catch (e) {
        console.error("Erro ao carregar ranking:", e);
    }
});

function mudarDivisao(divisao) {
    divisaoAtiva = divisao;
    atualizarBotoesAba();
    renderizarTabela();
    carregarEstatisticasGerais(); // Atualiza artilheiros da Série A ou B
}

function atualizarBotoesAba() {
    document.getElementById('btn-div-A').classList.remove('ativo');
    document.getElementById('btn-div-B').classList.remove('ativo');
    document.getElementById(`btn-div-${divisaoAtiva}`).classList.add('ativo');
}

// ========================================================
// 1. CÉREBRO DA CLASSIFICAÇÃO (Com as Zonas de Copa)
// ========================================================
function renderizarTabela() {
    const tbody = document.getElementById('corpo-tabela');

    if (!calendarioLiga) {
        tbody.innerHTML = `<tr><td colspan="10" style="padding: 20px; color: #ff8c00;">A tabela ainda não foi sorteada pelo Administrador.</td></tr>`;
        return;
    }

    let tabela = {};
    for (let t in timesGlobais) {
        if (timesGlobais[t].divisao === divisaoAtiva) {
            tabela[t] = {
                id: t,
                nome: t.replace(/_/g, ' '),
                Pts: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, SG: 0
            };
        }
    }

    const jogosDivisao = divisaoAtiva === "A" ? calendarioLiga.serieA : calendarioLiga.serieB;

    if (jogosDivisao) {
        for (let rodada in jogosDivisao) {
            let jogos = jogosDivisao[rodada];
            for (let idJogo in jogos) {
                let jogo = jogos[idJogo];

                // Pontua se o jogo já foi marcado como jogado OU se já teve simulação hoje
                if (jogo.jogado || jogo.linhaDoTempo) {
                    let mand = jogo.mandante;
                    let vis = jogo.visitante;
                    let gm = jogo.placarMandante;
                    let gv = jogo.placarVisitante;

                    if (mand === "Fantasma" || vis === "Fantasma") continue;

                    if (tabela[mand]) { tabela[mand].J++; tabela[mand].GP += gm; tabela[mand].GC += gv; }
                    if (tabela[vis]) { tabela[vis].J++; tabela[vis].GP += gv; tabela[vis].GC += gm; }

                    if (gm > gv) {
                        if (tabela[mand]) { tabela[mand].Pts += 3; tabela[mand].V++; }
                        if (tabela[vis]) { tabela[vis].D++; }
                    } else if (gv > gm) {
                        if (tabela[vis]) { tabela[vis].Pts += 3; tabela[vis].V++; }
                        if (tabela[mand]) { tabela[mand].D++; }
                    } else {
                        if (tabela[mand]) { tabela[mand].Pts += 1; tabela[mand].E++; }
                        if (tabela[vis]) { tabela[vis].Pts += 1; tabela[vis].E++; }
                    }
                }
            }
        }
    }

    for (let t in tabela) { tabela[t].SG = tabela[t].GP - tabela[t].GC; }

    let arrTabela = Object.values(tabela);
    arrTabela.sort((a, b) => {
        if (b.Pts !== a.Pts) return b.Pts - a.Pts;
        if (b.V !== a.V) return b.V - a.V;
        if (b.SG !== a.SG) return b.SG - a.SG;
        return b.GP - a.GP;
    });

    tbody.innerHTML = "";
    arrTabela.forEach((time, index) => {
        let pos = index + 1;

        // Regras das Zonas (Igual ao da imagem que você mandou)
        // 1 ao 4 = Azul | 5 ao 10 = Verde (Totalizando os Top 10 para Copas) | Últimos 4 = Vermelho
        let classeCSS = "sem-zona";
        if (pos <= 4) classeCSS = "zona-azul";
        else if (pos <= 10) classeCSS = "zona-verde";
        else if (pos >= arrTabela.length - 3) classeCSS = "zona-vermelha";

        let ehMeu = time.id === dadosUsuario.timeAtual;
        let corNome = ehMeu ? "#ff8c00" : "#fff";
        let pesoNome = ehMeu ? "bold" : "normal";
        let nomeDono = window.treinadoresGlobais[time.id] ? `<span style="font-size:10px; color:#aaa; display:block; line-height:1; font-weight:normal; margin-top:2px;">👤 ${window.treinadoresGlobais[time.id]}</span>` : "";

        // 🟢 O Botão de Olheiro!
        let btnEspionar = !ehMeu ? `<button onclick="espionarAdversario('${time.id}')" title="Espionar Escalação" style="background:transparent; border:none; cursor:pointer; font-size:16px; margin-left:5px; padding:0; filter:grayscale(1) brightness(2); transition:0.2s;" onmouseover="this.style.filter='none'" onmouseout="this.style.filter='grayscale(1) brightness(2)'">👁️</button>` : "";

        tbody.innerHTML += `
            <tr class="${classeCSS}">
                <td>${pos}</td>
                <td style="text-align: left; color: ${corNome}; font-weight: ${pesoNome}; line-height:1.1; padding: 6px 0;">
                    <div style="display:flex; align-items:center;">
                        <img src="${getEscudo(time.id)}" onerror="this.src='esculdos/default.png'" class="escudo-mini" style="margin-right: 6px;">
                        <div style="display:flex; flex-direction:column;">
                            <div style="display:flex; align-items:center;">
                                <span>${time.nome}</span>
                                ${btnEspionar}
                            </div>
                            ${nomeDono}
                        </div>
                    </div>
                </td>
                <td class="col-pts">${time.Pts}</td>
                <td>${time.J}</td>
                <td>${time.V}</td>
                <td>${time.E}</td>
                <td>${time.D}</td>
                <td>${time.GP}</td>
                <td>${time.GC}</td>
                <td style="color: ${time.SG > 0 ? 'var(--verde-campo)' : (time.SG < 0 ? '#dc3545' : '#888')}; font-weight: bold;">
                    ${time.SG > 0 ? '+' : ''}${time.SG}
                </td>
            </tr>
        `;
    });
}

// ========================================================
// 2. PAINEL DE ESTATÍSTICAS DA DIVISÃO
// ========================================================
function carregarEstatisticasGerais() {
    let todosJogadores = [];

    // Vasculha os times apenas da Divisão que o usuário está visualizando
    for (let t in timesGlobais) {
        if (timesGlobais[t].divisao === divisaoAtiva && timesGlobais[t].jogadores) {
            for (let j in timesGlobais[t].jogadores) {
                let jog = timesGlobais[t].jogadores[j];
                jog.timeOrigem = t;
                todosJogadores.push(jog);
            }
        }
    }

    // Top 10 Artilheiros
    let artilheiros = [...todosJogadores]
        .filter(j => j.estatisticas && j.estatisticas.gols > 0)
        .sort((a, b) => b.estatisticas.gols - a.estatisticas.gols)
        .slice(0, 10);

    // Top 10 Assistências
    let assistentes = [...todosJogadores]
        .filter(j => j.estatisticas && j.estatisticas.assistencias > 0)
        .sort((a, b) => b.estatisticas.assistencias - a.estatisticas.assistencias)
        .slice(0, 10);

    // Renderiza HTML
    const listaGols = document.getElementById('lista-artilheiros');
    const listaAst = document.getElementById('lista-assistencias');

    if (artilheiros.length === 0) {
        listaGols.innerHTML = `<li><span style="color: #666;">Nenhum gol registrado nesta divisão.</span></li>`;
    } else {
        listaGols.innerHTML = "";
        artilheiros.forEach((j, i) => {
            let nomeCurto = j.nome.split(" ")[0];
            listaGols.innerHTML += `
                <li>
                    <div style="display: flex; align-items: center;">
                        <span style="color: #888; width: 20px;">${i+1}º</span>
                        <img src="${getEscudo(j.timeOrigem)}" onerror="this.src='esculdos/default.png'" style="width: 16px; height: 16px; margin: 0 8px;">
                        <strong style="color: #fff;">${nomeCurto}</strong>
                    </div>
                    <span style="font-weight: bold; color: #ff8c00;">${j.estatisticas.gols} <span style="font-size:10px;color:#888;">Gols</span></span>
                </li>
            `;
        });
    }

    if (assistentes.length === 0) {
        listaAst.innerHTML = `<li><span style="color: #666;">Nenhuma assistência registrada nesta divisão.</span></li>`;
    } else {
        listaAst.innerHTML = "";
        assistentes.forEach((j, i) => {
            let nomeCurto = j.nome.split(" ")[0];
            listaAst.innerHTML += `
                <li>
                    <div style="display: flex; align-items: center;">
                        <span style="color: #888; width: 20px;">${i+1}º</span>
                        <img src="${getEscudo(j.timeOrigem)}" onerror="this.src='esculdos/default.png'" style="width: 16px; height: 16px; margin: 0 8px;">
                        <strong style="color: #fff;">${nomeCurto}</strong>
                    </div>
                    <span style="font-weight: bold; color: var(--verde-campo);">${j.estatisticas.assistencias} <span style="font-size:10px;color:#888;">Ast</span></span>
                </li>
            `;
        });
    }
}

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
function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}

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