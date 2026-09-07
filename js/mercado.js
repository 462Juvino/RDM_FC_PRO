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
let fundosInvestimentoGlobais = {}; // 🏦 Guarda o dinheiro de quem investiu!

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
        db.ref(`ligas/${ligaLogada}/usuarios`).once('value'),
        db.ref(`ligas/${ligaLogada}/banco_investidores`).once('value') // 🏦 NOVA BUSCA
    ]).then(([snapBanco, snapPro, snapProp, snapUsers, snapBancoInv]) => {
        const banco = snapBanco.val() || {};
        const pros = snapPro.val() || {};
        const propostas = snapProp.val() || {};
        const usuarios = snapUsers.val() || {};

        fundosInvestimentoGlobais = snapBancoInv.val() || {};
        // Garante que a IA do Banco Central sempre tenha dinheiro infinito para emprestar caso ninguém invista
        if (!fundosInvestimentoGlobais['Banco Central da Liga']) {
            fundosInvestimentoGlobais['Banco Central da Liga'] = { saldo: 500000000, is_ia: true };
        }

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
                    data_proposta: lance.data_proposta,
                    login_comprador: login,
                    tipo_negocio: lance.tipo_negocio || 'compra', // 🤝 Identifica se é aluguel
                    duracao_rodadas: lance.duracao_rodadas || 0
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
    if (selectPos && !document.getElementById('opt-pro')) {
        selectPos.innerHTML += `<option id="opt-pro" value="PRO_PLAYERS" style="color:var(--verde-campo); font-weight:bold;">🌟 Apenas Pro Players</option>`;
    }

    const filtroPos = selectPos ? selectPos.value : "TODOS";
    const tbody = document.getElementById('tabela-mercado');
    tbody.innerHTML = "";

    // Detecta se a tela é de Celular (Mobile)
    let isMobile = window.innerWidth <= 768;

    // Otimiza os Títulos da Tabela se for Mobile
    let theadTr = document.querySelector('thead tr');
    if (theadTr) {
        if (isMobile) {
            theadTr.innerHTML = `
                <th style="text-align: left; padding: 12px;">Atleta</th><th>P</th><th>OVR</th><th>C</th><th>V</th>
            `;
        } else {
            theadTr.innerHTML = `
                <th style="text-align: left; padding: 12px;">Atleta</th><th>Posição</th><th>OVR</th><th>Clube Atual</th><th>Passe (Valor)</th><th>Ação</th>
            `;
        }
    }

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

        let ehDoMeuTime = (j.clube === dadosUsuario.timeAtual.replace(/_/g, ' '));

        // Ação Dinâmica de Clique na Linha (Mobile & Desktop)
        let acaoClick = "";
        if (j.avaliando) acaoClick = `alert('Na Base. Aguarde a formatação deste Pro Player!')`;
        else if (dadosUsuario.timeAtual === "Sem Clube") acaoClick = `alert('Requer Clube para negociar.')`;
        else if (ehDoMeuTime) acaoClick = `abrirOpcoesMeuJogador('${j.id_banco}')`;
        else acaoClick = `fazerProposta('${j.id_banco}')`;

        // Formatação Enxuta (Celular) vs Completa (PC)
        let posF = isMobile ? j.posicao.charAt(0) : j.posicao;
        let clubeF = isMobile ? j.clube.substring(0, 3).toUpperCase() : j.clube;
        let valorF = formatarDinheiro(j.valor);

        if (isMobile && j.valor > 0) {
            valorF = (j.valor / 1000000).toFixed(1) + "M"; // Transforma 10.000.000 em 10.0M
        } else if (j.valor === 0) {
            valorF = "-";
        }

        let btnDesktop = "";
        if (!isMobile) {
            if (j.avaliando) btnDesktop = `<button disabled style="background:#222; border:1px dashed #555; color:#aaa; padding:4px 8px; border-radius:4px; font-size:11px; cursor:not-allowed;">Na Base</button>`;
            else if (dadosUsuario.timeAtual === "Sem Clube") btnDesktop = `<button disabled style="background:#555; border:none; color:#aaa; padding:4px 8px; border-radius:4px; font-size:11px;">Requer Clube</button>`;
            else if (ehDoMeuTime) btnDesktop = `<button onclick="abrirOpcoesMeuJogador('${j.id_banco}')" style="background:#555; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">Seu Atleta</button>`;
            else btnDesktop = `<button onclick="fazerProposta('${j.id_banco}')" style="background:#ff8c00; border:none; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px;">Negociar</button>`;
        }

        tbody.innerHTML += `
            <tr onclick="${acaoClick}" style="border-bottom: 1px solid #333; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#222'" onmouseout="this.style.background='transparent'">
                <td style="text-align: left; padding: 12px; font-weight: bold; color: ${j.isPro ? 'var(--verde-campo)' : '#fff'};">
                    ${j.isPro ? '🌟 ' : ''}${j.nome}
                </td>
                <td style="font-size: 13px;">${posF}</td>
                <td style="color: #ff8c00; font-weight: bold;">${j.forca}</td>
                <td style="font-size: 13px; color: ${j.avaliando ? '#888' : '#aaa'};">${clubeF}</td>
                <td style="color: #ddd; font-size: 13px;">${valorF}</td>
                ${!isMobile ? `<td>${btnDesktop}</td>` : ''}
            </tr>
        `;
        exibidos++;
    }
}

// Opções para o Seu Próprio Jogador (Gatilho para o futuro)
window.abrirOpcoesMeuJogador = function(idJogador) {
    let j = todosJogadores.find(x => x.id_banco === idJogador);
    if(!j) return;

    if(confirm(`🛠️ OPÇÕES: ${j.nome}\n\nDeseja colocar este jogador na Lista de Empréstimos?`)) {
        alert("Excelente! O sistema de colocar na vitrine será ativado na próxima Etapa!");
    }
};

function pesquisarJogador() {
    const termo = document.getElementById('busca-jogador').value;
    renderizarMercado(termo);
}

let propostaPendente = { idJogador: null, nome: "", valorBase: 0, clubeDono: "", tipoAtual: "compra", rodadas: 5 };

function fazerProposta(idJogador) {
    let j = todosJogadores.find(x => x.id_banco === idJogador);
    if (!j) return;

    propostaPendente = { idJogador: j.id_banco, nome: j.nome, valorBase: j.valor, clubeDono: j.clube, tipoAtual: "compra", rodadas: 5 };

    // Criamos um modal novinho em folha dinamicamente para suportar o sistema de Abas
    let modal = document.getElementById('modal-proposta-dinamico');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-proposta-dinamico';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center;";
        document.body.appendChild(modal);
    }

    let optionsTroca = '<option value="">Nenhum - Apenas Dinheiro</option>';
    meuElenco.sort((a,b) => b.valor - a.valor).forEach(meuJ => {
        optionsTroca += `<option value="${meuJ.id_banco}">${meuJ.nome} (OVR: ${meuJ.forca})</option>`;
    });

    // Layout Moderno com Abas de Negociação
    modal.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:450px; border-radius:8px; border:1px solid #444; overflow:hidden;">
            <div style="padding:15px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; background:#111;">
                <h2 style="color:#ff8c00; margin:0; font-size:18px;">Negociar: ${j.nome}</h2>
                <button onclick="fecharModalProposta()" style="background:transparent; border:none; color:#aaa; font-size:22px; cursor:pointer;">&times;</button>
            </div>

            <div style="display:flex; border-bottom:1px solid #333;">
                <button id="aba-compra" onclick="mudarAbaProposta('compra')" style="flex:1; padding:12px; background:#2a2a2a; color:#fff; border:none; cursor:pointer; font-weight:bold; border-right:1px solid #333; transition:0.2s;">💰 Compra Definitiva</button>
                <button id="aba-emp" onclick="mudarAbaProposta('emprestimo')" style="flex:1; padding:12px; background:#111; color:#888; border:none; cursor:pointer; font-weight:bold; transition:0.2s;">🤝 Empréstimo</button>
            </div>

            <div id="conteudo-proposta" style="padding:20px;">
                <!-- O JavaScript vai preencher isso baseado na aba clicada -->
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    window.optionsTrocaGlobais = optionsTroca; // Guarda para usar na aba
    window.mudarAbaProposta('compra'); // Abre direto na aba de compra padrão
}

window.mudarAbaProposta = function(tipo) {
    propostaPendente.tipoAtual = tipo;
    document.getElementById('aba-compra').style.background = tipo === 'compra' ? '#2a2a2a' : '#111';
    document.getElementById('aba-compra').style.color = tipo === 'compra' ? '#fff' : '#888';
    document.getElementById('aba-emp').style.background = tipo === 'emprestimo' ? '#2a2a2a' : '#111';
    document.getElementById('aba-emp').style.color = tipo === 'emprestimo' ? '#fff' : '#888';

    const div = document.getElementById('conteudo-proposta');

    if (tipo === 'compra') {
        div.innerHTML = `
            <p style="color:#ccc; font-size:13px; margin-top:0;">Adquira o passe definitivo do jogador para o seu clube.</p>
            <div style="margin-bottom:15px;">
                <label style="color:#888; font-size:12px;">Valor Oferecido (Passe base: ${formatarDinheiro(propostaPendente.valorBase)})</label>
                <input type="number" id="input-valor-proposta" value="${propostaPendente.valorBase}" style="width:100%; padding:10px; background:#111; border:1px solid #333; color:#fff; border-radius:4px; margin-top:5px;">
            </div>
            <div style="margin-bottom:15px;">
                <label style="color:#888; font-size:12px;">Incluir jogador na troca (Opcional)</label>
                <select id="select-jogador-troca" style="width:100%; padding:10px; background:#111; border:1px solid #333; color:#fff; border-radius:4px; margin-top:5px;">
                    ${window.optionsTrocaGlobais}
                </select>
            </div>
            <div style="text-align:right; font-size:12px; color:#aaa; margin-bottom:15px;">Seu Caixa: <strong id="prop-seu-caixa" style="color:var(--verde-campo);">${formatarDinheiro(saldoAtual)}</strong></div>
            <button onclick="confirmarProposta()" style="width:100%; padding:12px; background:#ff8c00; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:14px;">Enviar Proposta de Compra</button>
        `;
    } else {
        // Cálculo Mágico da Diretoria: A IA sugere cobrar 2% do passe por cada rodada emprestada
        let valorEmprestimoSugerido = Math.round(propostaPendente.valorBase * 0.02 * propostaPendente.rodadas);
        if(valorEmprestimoSugerido === 0) valorEmprestimoSugerido = 100000; // Taxa mínima

        div.innerHTML = `
            <p style="color:#ccc; font-size:13px; margin-top:0;">Alugue o jogador temporariamente. (Sem opções de troca)</p>
            <div style="margin-bottom:15px;">
                <label style="color:#888; font-size:12px;">Prazo do Empréstimo (Rodadas)</label>
                <select id="select-rodadas-emp" onchange="atualizarValorEmprestimo()" style="width:100%; padding:10px; background:#111; border:1px solid #333; color:#fff; border-radius:4px; margin-top:5px;">
                    <option value="5">Curto (5 Rodadas)</option>
                    <option value="10">Médio (10 Rodadas)</option>
                    <option value="19">Meio Turno (19 Rodadas)</option>
                    <option value="38">Temporada Cheia (38 Rodadas)</option>
                </select>
            </div>
            <div style="margin-bottom:15px;">
                <label style="color:#888; font-size:12px;">Taxa do Empréstimo (Paga à vista)</label>
                <input type="number" id="input-valor-proposta" value="${valorEmprestimoSugerido}" style="width:100%; padding:10px; background:#111; border:1px solid #333; color:#fff; border-radius:4px; margin-top:5px;">
                <small style="color:#666;">Sugestão da liga: ~2% do passe por rodada.</small>
            </div>
            <div style="text-align:right; font-size:12px; color:#aaa; margin-bottom:15px;">Seu Caixa: <strong id="prop-seu-caixa" style="color:var(--verde-campo);">${formatarDinheiro(saldoAtual)}</strong></div>
            <button onclick="confirmarProposta()" style="width:100%; padding:12px; background:var(--verde-campo); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:14px;">Enviar Oferta de Empréstimo</button>
        `;
        document.getElementById('select-rodadas-emp').value = propostaPendente.rodadas;
    }
};

window.atualizarValorEmprestimo = function() {
    let rodadas = parseInt(document.getElementById('select-rodadas-emp').value);
    propostaPendente.rodadas = rodadas;
    let valorEmprestimoSugerido = Math.round(propostaPendente.valorBase * 0.02 * rodadas);
    if(valorEmprestimoSugerido === 0) valorEmprestimoSugerido = 100000;
    document.getElementById('input-valor-proposta').value = valorEmprestimoSugerido;
};

function fecharModalProposta() {
    const modalDin = document.getElementById('modal-proposta-dinamico');
    if (modalDin) modalDin.style.display = 'none';

    // Oculta o modal antigo caso ele ainda esteja perdido no HTML do usuário
    const modalAntigo = document.getElementById('modal-proposta');
    if (modalAntigo) modalAntigo.style.display = 'none';

    propostaPendente = { idJogador: null, nome: "", valorBase: 0, clubeDono: "", tipoAtual: "compra", rodadas: 5 };
}

function confirmarProposta() {
    let valorSugerido = parseInt(document.getElementById('input-valor-proposta').value);
    let selectTroca = document.getElementById('select-jogador-troca');
    let idJogadorTroca = selectTroca ? selectTroca.value : "";
    let tipo = propostaPendente.tipoAtual;
    let rodadas = tipo === 'emprestimo' ? parseInt(document.getElementById('select-rodadas-emp').value) : 0;

    if (isNaN(valorSugerido)) valorSugerido = 0;

    document.getElementById('input-valor-proposta').style.borderColor = '#555';
    document.getElementById('prop-seu-caixa').style.color = 'var(--verde-campo)';

    // Validação
    if (valorSugerido <= 0 && (!idJogadorTroca || tipo === 'emprestimo')) {
        document.getElementById('input-valor-proposta').style.borderColor = '#dc3545';
        return;
    }
    if (valorSugerido > saldoAtual) {
        document.getElementById('input-valor-proposta').style.borderColor = '#dc3545';
        document.getElementById('prop-seu-caixa').style.color = '#dc3545';
        return;
    }

    let propostaObj = {
        time_comprador: dadosUsuario.timeAtual,
        valor_oferecido: valorSugerido,
        data_proposta: new Date().toISOString(),
        tipo_negocio: tipo // Agora o banco de dados sabe se é compra ou empréstimo!
    };

    if (tipo === 'compra' && idJogadorTroca) {
        propostaObj.id_jogador_oferecido = idJogadorTroca;
    } else if (tipo === 'emprestimo') {
        propostaObj.duracao_rodadas = rodadas;
    }

    db.ref(`ligas/${ligaLogada}/mercado_propostas/${propostaPendente.idJogador}/${userLogado}`).set(propostaObj).then(() => {
        let textoSucesso = tipo === 'compra'
            ? "A diretoria analisará os valores oferecidos para a compra em definitivo."
            : `A diretoria analisará a taxa proposta para o empréstimo de ${rodadas} rodadas.`;

        let modal = document.getElementById('modal-proposta-dinamico');
        modal.innerHTML = `
            <div style="background: var(--card-bg); width: 100%; max-width: 400px; border-radius: 12px; border: 1px solid #00b853; text-align: center; padding: 30px; background: #1a1a1a;">
                <h2 style="color: #00b853; margin-top: 0;">📄 Oferta Enviada!</h2>
                <p style="color: #ccc;">${textoSucesso}</p>
                <button onclick="window.location.reload()" style="background: #333; color: white; border: 1px solid #555; padding: 8px 20px; border-radius: 6px; margin-top: 15px; cursor: pointer;">Fechar</button>
            </div>
        `;
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
            <div style="display:flex; border-bottom:1px solid #333; overflow-x: auto; white-space: nowrap;">
                <button id="tab-env" onclick="renderListaTransacoes('env')" style="flex:1; padding:12px; background:#2a2a2a; color:#fff; border:none; cursor:pointer; font-weight:bold; border-right:1px solid #333; transition:0.2s; min-width: 120px;">📤 Enviadas</button>
                <button id="tab-rec" onclick="renderListaTransacoes('rec')" style="flex:1; padding:12px; background:#111; color:#888; border:none; cursor:pointer; font-weight:bold; border-right:1px solid #333; transition:0.2s; min-width: 120px;">📥 Recebidas</button>
                <button id="tab-banco" onclick="renderListaTransacoes('banco')" style="flex:1; padding:12px; background:#111; color:#888; border:none; cursor:pointer; font-weight:bold; transition:0.2s; min-width: 120px;">🏦 Cofre</button>
            </div>
            <div id="lista-transacoes-conteudo" style="padding:15px; overflow-y:auto; flex:1; min-height: 250px;">
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    window.renderListaTransacoes('env'); // Começa na aba de Enviadas
}

window.renderListaTransacoes = function(aba) {
    // Controle visual das abas
    document.getElementById('tab-env').style.background = aba === 'env' ? '#2a2a2a' : '#111';
    document.getElementById('tab-env').style.color = aba === 'env' ? '#fff' : '#888';
    document.getElementById('tab-rec').style.background = aba === 'rec' ? '#2a2a2a' : '#111';
    document.getElementById('tab-rec').style.color = aba === 'rec' ? '#fff' : '#888';
    document.getElementById('tab-banco').style.background = aba === 'banco' ? '#2a2a2a' : '#111';
    document.getElementById('tab-banco').style.color = aba === 'banco' ? '#fff' : '#888';

    const div = document.getElementById('lista-transacoes-conteudo');
    let html = "";

    if (aba === 'banco') {
        let meuTime = dadosUsuario.timeAtual;
        let meuSaldoCofre = fundosInvestimentoGlobais[meuTime] ? fundosInvestimentoGlobais[meuTime].saldo : 0;

        let htmlBanco = `
            <div style="background:#111; border:1px solid #333; padding:15px; border-radius:6px; margin-bottom:15px;">
                <h3 style="color:#00b853; margin-top:0; font-size:16px;">💰 Meu Cofre (Fundo do Clube)</h3>
                <p style="color:#888; font-size:12px;">Deposite seu dinheiro aqui. Renderá juros ou outros clubes poderão pedir emprestado!</p>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <span style="color:#ccc; font-size:14px;">Dinheiro Guardado:</span>
                    <strong style="color:#fff; font-size:18px;">${formatarDinheiro(meuSaldoCofre)}</strong>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="abrirModalCaixaEletronico('depositar', ${meuSaldoCofre})" style="flex:1; padding:8px; background:var(--verde-campo); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">📥 Depositar</button>
                    <button onclick="abrirModalCaixaEletronico('sacar', ${meuSaldoCofre})" style="flex:1; padding:8px; background:#444; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">📤 Sacar</button>
                </div>
            </div>

            <h3 style="color:#ff8c00; font-size:14px; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">🤝 Investidores da Liga</h3>
            <p style="color:#666; font-size:11px;">Clubes que possuem dinheiro no cofre disponível para empréstimo.</p>
        `;

        // Varre todos que investiram dinheiro (menos o seu próprio time)
        for (let clube in fundosInvestimentoGlobais) {
            if (clube === meuTime) continue;

            let investidor = fundosInvestimentoGlobais[clube];
            let badgeIA = investidor.is_ia ? `<span style="font-size:10px; color:#aaa;">(Máquina)</span>` : `<span style="font-size:10px; color:#00b853;">(Player)</span>`;

            htmlBanco += `
            <div style="background:#1a1a1a; border:1px solid #333; padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div>
                    <strong style="color:#fff; font-size:14px;">${clube.replace(/_/g, ' ')} ${badgeIA}</strong><br>
                    <span style="color:#00b853; font-size:12px;">Disponível: ${formatarDinheiro(investidor.saldo)}</span>
                </div>
                <button onclick="abrirModalEmprestimoFinanceiro('${clube}', ${investidor.saldo}, ${investidor.is_ia})" style="padding:6px 12px; background:#dc3545; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">Pedir Empréstimo</button>
            </div>`;
        }

        div.innerHTML = htmlBanco;
        return;
    }

    // ==========================================
    // LÓGICA ANTIGA (OFERTAS ENVIADAS E RECEBIDAS)
    // ==========================================
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

        let dataFormatada = "Hoje";
        if (t.data_proposta) {
            let d = new Date(t.data_proposta);
            dataFormatada = d.toLocaleDateString('pt-BR') + " às " + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }

        let badgeTipo = t.tipo_negocio === 'emprestimo'
            ? `<span style="background:#0056b3; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px;">🤝 Aluguel (${t.duracao_rodadas} Rodadas)</span>`
            : `<span style="background:var(--verde-campo); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px;">💰 Compra Definitiva</span>`;

        let txtInfo = `
            <div style="margin-top:6px; margin-bottom: 6px;">${badgeTipo}</div>
            <div style="color:#888; font-size:11px; border-top: 1px dashed #333; padding-top: 6px;">
                📅 Enviada em: ${dataFormatada}<br>⏳ Expira hoje, no fechamento do mercado (20h).
            </div>`;

        let acao = "";
        let nomeEscapado = t.nome_alvo.replace(/'/g, "\\'");

        if (!isRec) {
            acao = `<button onclick="cancelarPropostaAtiva('${t.id_alvo}')" style="margin-top:10px; width:100%; padding:8px; background:rgba(220,53,69,0.1); color:#dc3545; border:1px solid #dc3545; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s;" onmouseover="this.style.background='#dc3545'; this.style.color='#fff';" onmouseout="this.style.background='rgba(220,53,69,0.1)'; this.style.color='#dc3545';">Retirar Oferta</button>`;
        } else {
            acao = `
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <button onclick="aceitarProposta('${t.id_alvo}', '${t.login_comprador}', '${nomeEscapado}')" style="flex:1; padding:8px; background:var(--verde-campo); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; transition:0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">✅ Aceitar</button>
                    <button onclick="recusarProposta('${t.id_alvo}', '${t.login_comprador}', '${nomeEscapado}')" style="flex:1; padding:8px; background:rgba(220,53,69,0.1); color:#dc3545; border:1px solid #dc3545; border-radius:4px; font-weight:bold; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='#dc3545'; this.style.color='#fff';" onmouseout="this.style.background='rgba(220,53,69,0.1)'; this.style.color='#dc3545';">❌ Recusar</button>
                </div>
            `;
        }

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
            carregarMundo();
        });
    }
};

window.recusarProposta = function(idAlvo, loginComprador, nomeAlvo) {
    if(confirm("Deseja realmente RECUSAR e apagar esta oferta?")) {
        let idMsg = "msg_" + Date.now();
        let updates = {};
        updates[`ligas/${ligaLogada}/mercado_propostas/${idAlvo}/${loginComprador}`] = null;
        // ✉️ Envia a notificação de recusa
        updates[`ligas/${ligaLogada}/caixa_mensagens/${loginComprador}/${idMsg}`] = {
            tipo: 'recusa',
            texto: `A sua oferta por ${nomeAlvo} foi RECUSADA pelo clube dono.`,
            data: new Date().toISOString()
        };

        db.ref().update(updates).then(() => {
            alert("A oferta foi recusada com sucesso.");
            document.getElementById('modal-transacoes-ativas').style.display = 'none';
            carregarMundo();
        });
    }
};

window.aceitarProposta = async function(idAlvo, loginComprador, nomeAlvo) {
    if(!confirm("Atenção! Deseja realmente bater o martelo e aceitar esta proposta?")) return;

    try {
        const snapBanco = await db.ref('banco_global_times').once('value');
        const banco = snapBanco.val();
        const snapUsers = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
        const usuarios = snapUsers.val();
        const snapProposta = await db.ref(`ligas/${ligaLogada}/mercado_propostas/${idAlvo}/${loginComprador}`).once('value');
        const lance = snapProposta.val();

        if(!lance) return alert("Esta proposta já não existe mais.");

        let comprador = usuarios[loginComprador];
        let meuTime = dadosUsuario.timeAtual;
        let timeComprador = lance.time_comprador;

        if(comprador.caixaClube < lance.valor_oferecido) {
            return alert("O clube comprador não tem saldo suficiente para honrar esta proposta!");
        }

        let dadosDoAlvo = banco[meuTime].jogadores[idAlvo];
        let dadosTroca = lance.id_jogador_oferecido ? banco[timeComprador].jogadores[lance.id_jogador_oferecido] : null;

        let updates = {};

        // 1. O Dinheiro troca de mãos (Igual para Compra ou Empréstimo)
        updates[`ligas/${ligaLogada}/usuarios/${loginComprador}/caixaClube`] = comprador.caixaClube - lance.valor_oferecido;
        updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = (dadosUsuario.caixaClube || 0) + lance.valor_oferecido;

        // Limpa a mesa de leilão
        updates[`ligas/${ligaLogada}/mercado_propostas/${idAlvo}`] = null;
        let idMsg = "msg_" + Date.now();

        // 2. A Bifurcação: É compra ou aluguel?
        if (lance.tipo_negocio === 'emprestimo') {
            // 🤝 LÓGICA DE EMPRÉSTIMO

            // Adiciona a "etiqueta de locação" na mala do jogador
            dadosDoAlvo.status_emprestimo = {
                time_origem: meuTime,
                rodadas_restantes: lance.duracao_rodadas
            };

            updates[`banco_global_times/${meuTime}/jogadores/${idAlvo}`] = null;
            updates[`banco_global_times/${timeComprador}/jogadores/${idAlvo}`] = dadosDoAlvo;

            // Registra no Cartório da Liga (Para o Motor P2P saber que tem que devolver depois)
            updates[`ligas/${ligaLogada}/emprestimos_ativos/${idAlvo}`] = {
                jogador_id: idAlvo,
                time_origem: meuTime,
                time_destino: timeComprador,
                rodadas_restantes: lance.duracao_rodadas
            };

            updates[`ligas/${ligaLogada}/caixa_mensagens/${loginComprador}/${idMsg}`] = {
                tipo: 'sucesso',
                texto: `Sua proposta de EMPRÉSTIMO por ${nomeAlvo} foi ACEITA! Ele jogará por ${lance.duracao_rodadas} rodadas pelo seu clube.`,
                data: new Date().toISOString()
            };

        } else {
            // 💰 LÓGICA DE COMPRA DEFINITIVA (Padrão)
            updates[`banco_global_times/${meuTime}/jogadores/${idAlvo}`] = null;
            updates[`banco_global_times/${timeComprador}/jogadores/${idAlvo}`] = dadosDoAlvo;

            if(dadosTroca && lance.id_jogador_oferecido) {
                updates[`banco_global_times/${timeComprador}/jogadores/${lance.id_jogador_oferecido}`] = null;
                updates[`banco_global_times/${meuTime}/jogadores/${lance.id_jogador_oferecido}`] = dadosTroca;
            }

            updates[`ligas/${ligaLogada}/caixa_mensagens/${loginComprador}/${idMsg}`] = {
                tipo: 'sucesso',
                texto: `A sua oferta de COMPRA por ${nomeAlvo} foi ACEITA! O jogador é seu em definitivo.`,
                data: new Date().toISOString()
            };
        }

        await db.ref().update(updates);
        alert(lance.tipo_negocio === 'emprestimo' ? "🤝 Empréstimo Fechado! O dinheiro foi transferido." : "💰 Compra Confirmada! A papelada foi assinada.");
        location.reload();
    } catch(e) {
        console.error(e);
        alert("Erro no servidor ao processar o contrato.");
    }
};

// ========================================================
// REFINAMENTO DE UI: CABEÇALHO RETRÁTIL & ANIMAÇÕES
// ========================================================
(function otimizarInterfaceMobile() {
    // 1. Cabeçalho Inteligente (Some ao descer, aparece ao subir)
    let lastScrollTop = 0;
    window.addEventListener("scroll", function() {
        let currentScroll = window.pageYOffset || document.documentElement.scrollTop;

        // Busca a barra do topo (Tenta achar pelas tags/classes mais comuns)
        let header = document.querySelector('header') || document.querySelector('.topbar') || document.body.firstElementChild;

        if (header && window.innerWidth <= 768) {
            header.style.transition = "margin-top 0.3s ease-in-out";
            header.style.position = "sticky";
            header.style.top = "0";
            header.style.zIndex = "999";

            if (currentScroll > lastScrollTop && currentScroll > 60) {
                header.style.marginTop = `-${header.offsetHeight}px`; // Esconde
            } else {
                header.style.marginTop = "0px"; // Mostra
            }
        }
        lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
    }, false);

    // 2. Feedback Visual para o Cálculo de Empréstimo
    let oldAtualizarValor = window.atualizarValorEmprestimo;
    if (oldAtualizarValor) {
        window.atualizarValorEmprestimo = function() {
            oldAtualizarValor(); // Executa o cálculo original
            let inputBox = document.getElementById('input-valor-proposta');
            if (inputBox) {
                // Efeito piscar verde para indicar que o preço mudou automaticamente!
                inputBox.style.transition = "background 0.3s";
                inputBox.style.background = "rgba(0, 184, 83, 0.3)";
                setTimeout(() => inputBox.style.background = "#111", 400);
            }
        };
    }
})();

// ==========================================
// FUNÇÕES DO BANCO CENTRAL (UI MODERNA E CONTRATOS)
// ==========================================

// 1. MODAL DE DEPÓSITO E SAQUE (Adeus Prompts feios!)
window.abrirModalCaixaEletronico = function(acao, saldoCofre) {
    let titulo = acao === 'depositar' ? '📥 Depositar no Cofre' : '📤 Sacar do Cofre';
    let max = acao === 'depositar' ? saldoAtual : saldoCofre;
    let desc = acao === 'depositar' ? 'Guarde seu dinheiro para render juros ou emprestar.' : 'Resgate seu fundo de investimento para o caixa do clube.';

    let modal = document.createElement('div');
    modal.id = 'modal-caixa-eletronico';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10001; display:flex; justify-content:center; align-items:center;";

    modal.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:8px; border:1px solid #444; padding:20px;">
            <h2 style="color:${acao === 'depositar' ? 'var(--verde-campo)' : '#ff8c00'}; margin-top:0;">${titulo}</h2>
            <p style="color:#888; font-size:13px;">${desc}</p>
            <div style="margin-bottom:15px;">
                <label style="color:#aaa; font-size:12px;">Valor (Disponível: ${formatarDinheiro(max)})</label>
                <input type="number" id="input-valor-caixa" placeholder="Ex: 5000000" style="width:100%; padding:10px; background:#111; border:1px solid #333; color:#fff; border-radius:4px; margin-top:5px;">
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="confirmarCaixaEletronico('${acao}', ${max}, ${saldoCofre})" style="flex:1; padding:10px; background:var(--verde-campo); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Confirmar</button>
                <button onclick="document.getElementById('modal-caixa-eletronico').remove()" style="flex:1; padding:10px; background:#444; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.confirmarCaixaEletronico = function(acao, maxDisponivel, saldoAtualCofre) {
    let valor = parseInt(document.getElementById('input-valor-caixa').value);
    if (isNaN(valor) || valor <= 0) return alert("Por favor, insira um valor válido.");
    if (valor > maxDisponivel) return alert("Você não tem saldo suficiente para esta operação!");

    let meuTime = dadosUsuario.timeAtual;
    let updates = {};

    if (acao === 'depositar') {
        saldoAtual -= valor; // Atualiza variável global na hora
        updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = saldoAtual;
        updates[`ligas/${ligaLogada}/banco_investidores/${meuTime}`] = { saldo: saldoAtualCofre + valor, dono_login: userLogado, is_ia: false };
    } else {
        saldoAtual += valor;
        updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = saldoAtual;
        if (saldoAtualCofre - valor > 0) {
            updates[`ligas/${ligaLogada}/banco_investidores/${meuTime}/saldo`] = saldoAtualCofre - valor;
        } else {
            updates[`ligas/${ligaLogada}/banco_investidores/${meuTime}`] = null;
        }
    }

    db.ref().update(updates).then(() => {
        document.getElementById('modal-caixa-eletronico').remove();
        document.getElementById('saldo-treinador').innerText = formatarDinheiro(saldoAtual); // Atualiza a tela sem dar F5!

        // Mensagem Customizada de Sucesso
        let divSucesso = document.createElement('div');
        divSucesso.style.cssText = "position:fixed; top:20px; right:20px; background:var(--verde-campo); color:#fff; padding:15px; border-radius:4px; z-index:10002; font-weight:bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3);";
        divSucesso.innerText = "Transação realizada com sucesso!";
        document.body.appendChild(divSucesso);
        setTimeout(() => divSucesso.remove(), 3000);

        carregarMundo(); // Recarrega os dados do modal principal
    });
};

// 2. MODAL DE EMPRÉSTIMO (O CONTRATO)
window.abrirModalEmprestimoFinanceiro = function(nomeCredor, maxCredor, isBancoCentral) {
    // Regras Duras do Banco Central vs Investidores Comuns
    let limiteEmprestimo = isBancoCentral ? Math.min(20000000, maxCredor) : maxCredor; // Banco Central limita a 20 Milhões
    let taxaBase = isBancoCentral ? 0.05 : 0.02; // Banco Central cobra 5% por rodada, players cobram 2%
    let infoJuros = isBancoCentral ? "Juros Altos (5% por rodada)" : "Juros Amigáveis (2% por rodada)";

    let modal = document.createElement('div');
    modal.id = 'modal-emprestimo-fin';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10001; display:flex; justify-content:center; align-items:center;";

    modal.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:450px; border-radius:8px; border:1px solid #444; padding:20px;">
            <h2 style="color:#dc3545; margin-top:0;">💸 Contrato de Crédito</h2>
            <p style="color:#888; font-size:12px;">Credor: <strong style="color:#fff;">${nomeCredor.replace(/_/g, ' ')}</strong><br>Regra: ${infoJuros}</p>

            <div style="margin-bottom:15px;">
                <label style="color:#aaa; font-size:12px;">Valor Desejado (Limite: ${formatarDinheiro(limiteEmprestimo)})</label>
                <input type="number" id="input-valor-emp" onkeyup="simularJurosFin(${taxaBase})" placeholder="Ex: 5000000" style="width:100%; padding:10px; background:#111; border:1px solid #333; color:#fff; border-radius:4px; margin-top:5px;">
            </div>

            <div style="margin-bottom:15px;">
                <label style="color:#aaa; font-size:12px;">Prazo de Pagamento (Rodadas)</label>
                <select id="select-prazo-emp" onchange="simularJurosFin(${taxaBase})" style="width:100%; padding:10px; background:#111; border:1px solid #333; color:#fff; border-radius:4px; margin-top:5px;">
                    <option value="5">5 Rodadas</option>
                    <option value="10">10 Rodadas</option>
                    <option value="20">20 Rodadas</option>
                </select>
            </div>

            <div style="background:#111; padding:12px; border-radius:6px; font-size:13px; color:#aaa; margin-bottom:15px; border-left:3px solid #dc3545;">
                Valor a Devolver: <strong id="sim-devolver" style="color:#dc3545;">R$ 0,00</strong><br>
                Desconto por Rodada: <strong id="sim-parcela" style="color:#fff;">R$ 0,00</strong><br>
                <small style="color:#666; display:block; margin-top:5px;">⚠️ Em caso de falência, seus jogadores serão penhorados.</small>
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="confirmarEmprestimoFin('${nomeCredor}', ${limiteEmprestimo}, ${taxaBase})" style="flex:1; padding:10px; background:#dc3545; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Assinar e Receber</button>
                <button onclick="document.getElementById('modal-emprestimo-fin').remove()" style="flex:1; padding:10px; background:#444; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.simularJurosFin = function(taxaBase) {
    let valor = parseInt(document.getElementById('input-valor-emp').value) || 0;
    let rodadas = parseInt(document.getElementById('select-prazo-emp').value) || 5;

    let taxaTotal = taxaBase * rodadas;
    let valorTotal = valor + (valor * taxaTotal);
    let parcela = valorTotal / rodadas;

    document.getElementById('sim-devolver').innerText = formatarDinheiro(valorTotal);
    document.getElementById('sim-parcela').innerText = formatarDinheiro(parcela);
};

window.confirmarEmprestimoFin = function(nomeCredor, maxCredor, taxaBase) {
    let valor = parseInt(document.getElementById('input-valor-emp').value);
    let rodadas = parseInt(document.getElementById('select-prazo-emp').value);

    if (isNaN(valor) || valor <= 0) return alert("Insira um valor válido.");
    if (valor > maxCredor) return alert("Este credor não possui ou não libera este limite.");

    let taxaTotal = taxaBase * rodadas;
    let valorTotalDevido = valor + (valor * taxaTotal);
    let parcela = Math.round(valorTotalDevido / rodadas);

    let updates = {};
    let idDivida = "divida_" + Date.now();
    let meuTime = dadosUsuario.timeAtual;

    // 1. Você recebe o dinheiro na hora
    saldoAtual += valor;
    updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = saldoAtual;

    // 2. Tira o dinheiro do cofre do credor
    let saldoAntigoCredor = fundosInvestimentoGlobais[nomeCredor].saldo;
    updates[`ligas/${ligaLogada}/banco_investidores/${nomeCredor}/saldo`] = saldoAntigoCredor - valor;

    // 3. Registra o Contrato no Cartório (Para o Motor P2P cobrar)
    updates[`ligas/${ligaLogada}/dividas_financeiras/${idDivida}`] = {
        devedor: meuTime,
        credor: nomeCredor,
        valor_total: valorTotalDevido,
        parcela_rodada: parcela,
        rodadas_restantes: rodadas
    };

    db.ref().update(updates).then(() => {
        document.getElementById('modal-emprestimo-fin').remove();
        document.getElementById('saldo-treinador').innerText = formatarDinheiro(saldoAtual); // Atualiza na hora!

        let divSucesso = document.createElement('div');
        divSucesso.style.cssText = "position:fixed; top:20px; right:20px; background:var(--verde-campo); color:#fff; padding:15px; border-radius:4px; z-index:10002; font-weight:bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3);";
        divSucesso.innerText = "Empréstimo Aprovado! O dinheiro já está na conta.";
        document.body.appendChild(divSucesso);
        setTimeout(() => divSucesso.remove(), 4000);

        carregarMundo();
    });
};