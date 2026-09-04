// js/mercado.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let todosJogadores = [];
let meuElenco = []; // Adicione esta linha!
let saldoAtual = 0;
let propostasEnviadasGlobais = [];
let propostasRecebidasGlobais = [];
let timesReaisGlobais = [];

window.addEventListener('DOMContentLoaded', () => {
    db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value').then(snapshot => {
        dadosUsuario = snapshot.val();

        if(!dadosUsuario) return window.location.href = "index.html";

        document.getElementById('nome-treinador').innerText = dadosUsuario.nome;
        document.getElementById('nome-time').innerText = dadosUsuario.timeAtual.replace(/_/g, ' ');
        saldoAtual = dadosUsuario.caixaClube || 0;
        document.getElementById('saldo-treinador').innerText = formatarDinheiro(saldoAtual);

        carregarMundo();
    });
});

function carregarMundo() {
    Promise.all([
        db.ref('banco_global_times').once('value'),
        db.ref(`ligas/${ligaLogada}/pro_players`).once('value'),
        db.ref(`ligas/${ligaLogada}/mercado_propostas`).once('value'),
        db.ref(`ligas/${ligaLogada}/usuarios`).once('value')
    ]).then(([snapBanco, snapPro, snapProp, snapUsers]) => {
        const banco = snapBanco.val() || {};
        const pros = snapPro.val() || {};
        const propostas = snapProp.val() || {};
        const usuarios = snapUsers.val() || {};

        todosJogadores = [];
        meuElenco = [];
        propostasEnviadasGlobais = [];
        propostasRecebidasGlobais = [];

        // Mapeia quem são os players reais (Humanos)
        timesReaisGlobais = Object.values(usuarios).map(u => u.timeAtual).filter(t => t && t !== "Sem Clube");

        // 1. CARREGA O MUNDO REAL
        for (let time in banco) {
            if (time.startsWith("Agentes_Livres") && time !== `Agentes_Livres_${ligaLogada}`) continue;

            let elenco = banco[time].jogadores;
            if (!elenco) continue;

            for (let idJog in elenco) {
                let j = elenco[idJog];
                let isPro = j.pro_player || j.nome.includes("(PRO)");
                let at = j.atributos || {ataque:5, defesa:5, forca:5, velocidade:5, habilidade:5};

                let atq = at.ataque || 0; let def = at.defesa || 0; let frc = at.forca || 0; let vel = at.velocidade || 0; let hab = at.habilidade || 0;

                if (isPro && (atq > 20 || def > 20 || frc > 20)) {
                    atq = Math.round(atq / 6); def = Math.round(def / 6); frc = Math.round(frc / 6); vel = Math.round(vel / 6); hab = Math.round(hab / 6);
                }

                let ovrAvg = Math.round((atq + def + frc + vel + hab) / 5);

                let objJogador = {
                    id_banco: idJog,
                    nome: j.nome,
                    idade: j.idade || 20,
                    clube: time.startsWith("Agentes_Livres") ? "Agentes Livres" : time.replace(/_/g, ' '),
                    posicao: j.posicoes ? j.posicoes.p : "N/A",
                    forca: ovrAvg,
                    atributos: { ataque: atq, defesa: def, forca: frc, velocidade: vel, habilidade: hab },
                    valor: j.valor_mercado || 0,
                    isPro: isPro
                };

                todosJogadores.push(objJogador);
                if (time === dadosUsuario.timeAtual) meuElenco.push(objJogador);
            }
        }

        // 2. CARREGA A VITRINE (PRO PLAYERS NA BASE)
        for (let dono in pros) {
            let p = pros[dono];
            if (p.status === "avaliando" || !p.status) {
                let at = p.atributos_base;
                let qtdVotos = 1;
                let sA = at.ataque, sD = at.defesa, sF = at.forca, sV = at.velocidade, sH = at.habilidade;

                if (p.avaliacoes) {
                    for (let v in p.avaliacoes) {
                        let av = p.avaliacoes[v];
                        sA += av.ataque || 60; sD += av.defesa || 60; sF += av.forca || 60; sV += av.velocidade || 60; sH += av.habilidade || 60;
                        qtdVotos++;
                    }
                }

                let mxA = Math.round((sA / qtdVotos) / 6); let mxD = Math.round((sD / qtdVotos) / 6); let mxF = Math.round((sF / qtdVotos) / 6); let mxV = Math.round((sV / qtdVotos) / 6); let mxH = Math.round((sH / qtdVotos) / 6);
                let ovrDinâmico = Math.round((mxA + mxD + mxF + mxV + mxH) / 5);

                todosJogadores.push({
                    id_banco: "PRO_" + dono, nome: p.nome + " (PRO)", idade: 17, clube: "Base (Em Avaliação)", posicao: p.posicao,
                    forca: ovrDinâmico, atributos: { ataque: mxA, defesa: mxD, forca: mxF, velocidade: mxV, habilidade: mxH }, valor: 0, isPro: true, avaliando: true
                });
            }
        }

        todosJogadores.sort((a, b) => b.forca - a.forca);

        // 3. MAPEIA AS TRANSAÇÕES E PROPOSTAS
        for (let idAlvo in propostas) {
            let lances = propostas[idAlvo];
            let alvoEncontrado = todosJogadores.find(j => j.id_banco === idAlvo);
            let donoAlvo = alvoEncontrado ? alvoEncontrado.clube : "Desconhecido";
            let nomeAlvo = alvoEncontrado ? alvoEncontrado.nome : "Jogador";

            for (let login in lances) {
                let lance = lances[login];
                let comp = lance.time_comprador;

                let isCompReal = timesReaisGlobais.includes(comp);
                let isVendReal = timesReaisGlobais.includes(donoAlvo.replace(/ /g, '_'));

                let objLance = {
                    id_alvo: idAlvo, nome_alvo: nomeAlvo, comprador: comp, vendedor: donoAlvo,
                    valor: lance.valor_oferecido, id_troca: lance.id_jogador_oferecido,
                    is_comp_real: isCompReal, is_vend_real: isVendReal,
                    data_proposta: lance.data_proposta // Puxa a data exata da oferta
                };

                if (comp === dadosUsuario.timeAtual) propostasEnviadasGlobais.push(objLance);
                if (donoAlvo === dadosUsuario.timeAtual.replace(/_/g, ' ')) propostasRecebidasGlobais.push(objLance);
            }
        }

        atualizarBotaoTransacoes();
        renderizarMercado();
    });
}

function renderizarMercado(termoBusca = "") {
    const selectPos = document.getElementById('filtro-posicao');

    // Injeta o filtro de PRO Players automaticamente no HTML se ele não existir
    if (selectPos && !document.getElementById('opt-pro')) {
        selectPos.innerHTML += `<option id="opt-pro" value="PRO_PLAYERS" style="color:var(--verde-campo); font-weight:bold;">🌟 Apenas Pro Players</option>`;
    }

    const filtroPos = selectPos ? selectPos.value : "TODOS";
    const tbody = document.getElementById('tabela-mercado');
    tbody.innerHTML = "";

    let exibidos = 0;

    for (let i = 0; i < todosJogadores.length; i++) {
        let j = todosJogadores[i];

        if (filtroPos !== "TODOS") {
            if (filtroPos === "PRO_PLAYERS" && !j.isPro) continue;
            if (filtroPos === "Atacante" && !["Atacante", "Ponta", "Centroavante"].includes(j.posicao)) continue;
            if (filtroPos !== "Atacante" && filtroPos !== "PRO_PLAYERS" && j.posicao !== filtroPos) continue;
        }

        if (termoBusca && !j.nome.toLowerCase().includes(termoBusca.toLowerCase())) continue;
        if (exibidos >= 50) break;

        let btnAcao = "";

        if (j.avaliando) {
            btnAcao = `<button disabled style="background:#222; border:1px dashed #555; color:#aaa; padding:4px 8px; border-radius:4px; font-size:11px; cursor:not-allowed;">Na Base</button>`;
        } else if (dadosUsuario.timeAtual === "Sem Clube") {
            btnAcao = `<button disabled style="background:#555; border:none; color:#aaa; padding:4px 8px; border-radius:4px; font-size:11px; cursor:not-allowed;">Requer Clube</button>`;
        } else {
            let ehDoMeuTime = (j.clube === dadosUsuario.timeAtual.replace(/_/g, ' '));
            btnAcao = ehDoMeuTime
                ? `<button disabled style="background:#555; border:none; padding:4px 8px; border-radius:4px; font-size:11px;">Seu Atleta</button>`
                : `<button onclick="fazerProposta('${j.id_banco}')" style="background:#ff8c00; border:none; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px;">Fazer Proposta</button>`;
        }

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #333;">
                <td style="text-align: left; padding: 12px; font-weight: bold; color: ${j.isPro ? 'var(--verde-campo)' : '#fff'};">
                    ${j.isPro ? '🌟 ' : ''}${j.nome}
                </td>
                <td style="font-size: 13px;">${j.posicao}</td>
                <td style="color: #ff8c00; font-weight: bold;">${j.forca}</td>
                <td style="font-size: 13px; color: ${j.avaliando ? '#888' : '#aaa'};">${j.clube}</td>
                <td style="color: #ddd; font-size: 13px;">${j.valor > 0 ? formatarDinheiro(j.valor) : '-'}</td>
                <td>${btnAcao}</td>
            </tr>
        `;
        exibidos++;
    }
}

function pesquisarJogador() {
    const termo = document.getElementById('busca-jogador').value;
    renderizarMercado(termo);
}

// ========================================================
// NOVO SISTEMA DE PROPOSTAS COM OPÇÃO DE TROCAS
// ========================================================
let propostaPendente = { idJogador: null, nome: "", valorBase: 0, clubeDono: "" };

function fazerProposta(idJogador) {
    let j = todosJogadores.find(x => x.id_banco === idJogador);
    if (!j) return;

    propostaPendente = { idJogador: j.id_banco, nome: j.nome, valorBase: j.valor, clubeDono: j.clube };

    // Preenche o modal com o Raio-X do jogador
    document.getElementById('prop-nome-jogador').innerText = j.nome;
    document.getElementById('prop-clube-dono').innerText = j.clube;
    document.getElementById('prop-idade-jogador').innerText = j.idade + " anos";
    document.getElementById('prop-ovr-jogador').innerText = j.forca;

    document.getElementById('prop-atq').innerText = j.atributos.ataque;
    document.getElementById('prop-def').innerText = j.atributos.defesa;
    document.getElementById('prop-for').innerText = j.atributos.forca;
    document.getElementById('prop-vel').innerText = j.atributos.velocidade;
    document.getElementById('prop-hab').innerText = j.atributos.habilidade;

    document.getElementById('prop-valor-base').innerText = formatarDinheiro(j.valor);
    document.getElementById('prop-seu-caixa').innerText = formatarDinheiro(saldoAtual);

    document.getElementById('input-valor-proposta').value = j.valor;

    // Popula o select com os seus próprios jogadores
    const selectTroca = document.getElementById('select-jogador-troca');
    selectTroca.innerHTML = '<option value="">Nenhum - Apenas Dinheiro</option>';

    // Organiza seu elenco do mais caro pro mais barato pra facilitar a busca
    meuElenco.sort((a,b) => b.valor - a.valor).forEach(j => {
        selectTroca.innerHTML += `<option value="${j.id_banco}">${j.nome} (OVR: ${j.forca}) - Passe: ${formatarDinheiro(j.valor)}</option>`;
    });

    document.getElementById('modal-proposta').style.display = 'flex';
}

function fecharModalProposta() {
    document.getElementById('modal-proposta').style.display = 'none';
    propostaPendente = { idJogador: null, nome: "", valorBase: 0, clubeDono: "" };
}

function confirmarProposta() {
    let valorSugerido = parseInt(document.getElementById('input-valor-proposta').value);
    let idJogadorTroca = document.getElementById('select-jogador-troca').value;

    // Se ele deixou o campo de dinheiro vazio mas ofereceu um jogador, consideramos R$ 0 em dinheiro
    if (isNaN(valorSugerido)) valorSugerido = 0;

    // Remove bordas vermelhas de tentativas anteriores
    document.getElementById('input-valor-proposta').style.borderColor = '#555';
    document.getElementById('prop-seu-caixa').style.color = 'var(--verde-campo)';

    // Validação: Tem que oferecer pelo menos dinheiro OU um jogador
    if (valorSugerido <= 0 && !idJogadorTroca) {
        document.getElementById('input-valor-proposta').style.borderColor = '#dc3545';
        return;
    }

    // Validação: Checa se tem o saldo em caixa
    if (valorSugerido > saldoAtual) {
        document.getElementById('input-valor-proposta').style.borderColor = '#dc3545';
        document.getElementById('prop-seu-caixa').style.color = '#dc3545';
        return;
    }

    // Monta a Proposta (com ou sem jogador)
    let propostaObj = {
        time_comprador: dadosUsuario.timeAtual,
        valor_oferecido: valorSugerido,
        data_proposta: new Date().toISOString()
    };

    if (idJogadorTroca) {
        propostaObj.id_jogador_oferecido = idJogadorTroca;
    }

    // Grava a proposta no Firebase
    db.ref(`ligas/${ligaLogada}/mercado_propostas/${propostaPendente.idJogador}/${userLogado}`).set(propostaObj).then(() => {
        fecharModalProposta();

        // Tela de sucesso imersiva
        const modal = document.getElementById('modal-proposta');
        modal.innerHTML = `
            <div style="background: var(--card-bg); width: 100%; max-width: 400px; border-radius: 12px; border: 1px solid #00b853; text-align: center; padding: 30px;">
                <h2 style="color: #00b853; margin-top: 0;">📄 Oferta Enviada!</h2>
                <p style="color: #ccc;">A diretoria analisará os valores ${idJogadorTroca ? 'e o atleta envolvido na troca' : 'oferecidos'} e responderá no fim do dia (Aguarde o Motor P2P rodar!).</p>
                <button onclick="window.location.reload()" style="background: #333; color: white; border: 1px solid #555; padding: 8px 20px; border-radius: 6px; margin-top: 15px; cursor: pointer;">Fechar</button>
            </div>
        `;
        modal.style.display = 'flex';
    }).catch(erro => console.error("Erro ao enviar proposta:", erro));
}

// UTILIDADES
function formatarDinheiro(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
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
// CENTRAL DE TRANSAÇÕES (VISUAL)
// ========================================================
function atualizarBotaoTransacoes() {
    if (dadosUsuario.timeAtual === "Sem Clube") return;

    let floatBtn = document.getElementById('btn-float-transacoes');
    if (floatBtn) floatBtn.remove();

    let btn = document.getElementById('btn-transacoes-inline');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'btn-transacoes-inline';
        btn.onclick = abrirModalTransacoes;
        btn.style.cssText = "background: #2a2a2a; color: #ccc; border: 1px solid #444; border-radius: 6px; padding: 4px 12px; font-size: 13px; font-weight: normal; cursor: pointer; margin-left: 15px; transition: 0.2s; display: inline-flex; align-items: center; gap: 6px;";
        btn.onmouseover = () => { btn.style.background = "#333"; btn.style.color = "#fff"; };
        btn.onmouseout = () => { btn.style.background = "#2a2a2a"; btn.style.color = "#ccc"; };

        // Radar Inteligente: Procura especificamente o texto "Mercado da Bola"
        let titulos = document.querySelectorAll('h1, h2, h3, h4, h5');
        let tituloCorreto = null;

        for (let t of titulos) {
            if (t.textContent.includes("Mercado da Bola")) {
                tituloCorreto = t;
                break;
            }
        }

        if (tituloCorreto) {
            // Usa Flexbox para alinhar perfeitamente o título e o botão lado a lado
            tituloCorreto.style.display = "flex";
            tituloCorreto.style.alignItems = "center";
            tituloCorreto.appendChild(btn);
        } else {
            document.body.appendChild(btn);
        }
    }

    let total = propostasEnviadasGlobais.length + propostasRecebidasGlobais.length;
    let corBadge = total > 0 ? "var(--verde-campo)" : "#555";
    let corTexto = total > 0 ? "#fff" : "#aaa";

    btn.innerHTML = `💼 Transações <span style="background:${corBadge}; color:${corTexto}; padding:2px 6px; border-radius:10px; font-size:11px; font-weight:bold;">${total}</span>`;
}

function abrirModalTransacoes() {
    let modal = document.getElementById('modal-transacoes-ativas');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-transacoes-ativas';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center;";
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:550px; border-radius:8px; border:1px solid #444; display:flex; flex-direction:column; max-height:80vh;">
            <div style="padding:15px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                <h2 style="color:#ff8c00; margin:0; font-size:18px;">💼 Central de Negociações</h2>
                <button onclick="document.getElementById('modal-transacoes-ativas').style.display='none'" style="background:transparent; border:none; color:#aaa; font-size:22px; cursor:pointer;">&times;</button>
            </div>
            <div style="display:flex; border-bottom:1px solid #333;">
                <button id="tab-env" onclick="renderListaTransacoes('env')" style="flex:1; padding:12px; background:#2a2a2a; color:#fff; border:none; cursor:pointer; font-weight:bold; border-right:1px solid #333; transition:0.2s;">📤 Ofertas Enviadas</button>
                <button id="tab-rec" onclick="renderListaTransacoes('rec')" style="flex:1; padding:12px; background:#222; color:#888; border:none; cursor:pointer; font-weight:bold; transition:0.2s;">📥 Ofertas Recebidas</button>
            </div>
            <div id="lista-transacoes-conteudo" style="padding:15px; overflow-y:auto; flex:1; min-height: 250px;">
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    window.renderListaTransacoes('env');
}

window.renderListaTransacoes = function(aba) {
    document.getElementById('tab-env').style.background = aba === 'env' ? '#2a2a2a' : '#111';
    document.getElementById('tab-env').style.color = aba === 'env' ? '#fff' : '#888';
    document.getElementById('tab-rec').style.background = aba === 'rec' ? '#2a2a2a' : '#111';
    document.getElementById('tab-rec').style.color = aba === 'rec' ? '#fff' : '#888';

    const div = document.getElementById('lista-transacoes-conteudo');
    let html = "";
    let lista = aba === 'env' ? propostasEnviadasGlobais : propostasRecebidasGlobais;

    if (lista.length === 0) {
        div.innerHTML = `<p style="text-align:center; color:#666; margin-top:50px;">Nenhuma transação ${aba==='env'?'enviada':'recebida'} no momento.</p>`;
        return;
    }

    lista.forEach(t => {
        let isRec = aba === 'rec';
        let infoOponente = isRec
            ? `<span style="color:#aaa;">Proposta de:</span> ${t.comprador.replace(/_/g, ' ')} <span style="font-size:10px;">${t.is_comp_real ? '👤 (Player)' : '🤖 (Máquina)'}</span>`
            : `<span style="color:#aaa;">Proposta para:</span> ${t.vendedor} <span style="font-size:10px;">${t.is_vend_real ? '👤 (Player)' : '🤖 (Máquina)'}</span>`;

        let txtTroca = t.id_troca ? `<div style="color:var(--verde-campo); font-size:12px; margin-top:4px;">🔄 Inclui atleta na troca</div>` : '';

        // Formata a data para o padrão Brasileiro
        let dataFormatada = "Hoje";
        if (t.data_proposta) {
            let d = new Date(t.data_proposta);
            dataFormatada = d.toLocaleDateString('pt-BR') + " às " + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }

        let txtInfo = `<div style="color:#888; font-size:11px; margin-top:8px; border-top: 1px dashed #333; padding-top: 6px;">📅 Enviada em: ${dataFormatada}<br>⏳ Expira hoje, no fechamento do mercado (20h).</div>`;

        let acao = !isRec
            ? `<button onclick="cancelarPropostaAtiva('${t.id_alvo}')" style="margin-top:10px; width:100%; padding:8px; background:rgba(220,53,69,0.1); color:#dc3545; border:1px solid #dc3545; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s;" onmouseover="this.style.background='#dc3545'; this.style.color='#fff';" onmouseout="this.style.background='rgba(220,53,69,0.1)'; this.style.color='#dc3545';">Retirar Oferta</button>`
            : `<div style="margin-top:10px; text-align:center; font-size:12px; color:#aaa; padding:6px; background:#222; border-radius:4px;">O Motor P2P aprovará a maior oferta às 20h! ⏳</div>`;

        html += `
            <div style="background:#111; border:1px solid #333; padding:12px; border-radius:6px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #222; padding-bottom:6px; margin-bottom:6px;">
                    <strong style="color:#ff8c00; font-size:16px;">${t.nome_alvo}</strong>
                    <strong style="color:#fff;">${formatarDinheiro(t.valor)}</strong>
                </div>
                <div style="font-size:13px; color:#ddd;">
                    ${infoOponente}
                    ${txtTroca}
                    ${txtInfo}
                </div>
                ${acao}
            </div>
        `;
    });
    div.innerHTML = html;
};

window.cancelarPropostaAtiva = function(idAlvo) {
    if(confirm("Deseja realmente retirar esta oferta da mesa?")) {
        db.ref(`ligas/${ligaLogada}/mercado_propostas/${idAlvo}/${userLogado}`).remove().then(() => {
            alert("Proposta cancelada e verba liberada!");
            document.getElementById('modal-transacoes-ativas').style.display = 'none';
            carregarMundo(); // Recarrega os dados fresquinhos
        });
    }
};