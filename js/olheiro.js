// js/olheiro.js - OLHEIRO DE LENDAS E DIRETOR EXECUTIVO
let olheiroInterval = null;

// Configuração dos Níveis do Diretor Executivo
window.diretorConfig = {
    0: { opcoes: 0, custoTk: 0, custoDin: 0, nome: "Não Contratado" },
    1: { opcoes: 1, custoTk: 2, custoDin: 2000000, nome: "Estagiário (1 Opção de Compra)" },
    2: { opcoes: 2, custoTk: 5, custoDin: 5000000, nome: "Negociador (2 Opções de Compra)" },
    3: { opcoes: 3, custoTk: 10, custoDin: 10000000, nome: "Lobo de Wall Street (3 Opções)" }
};

async function carregarOlheiro(){
    const ligaLogada = localStorage.getItem('treinadorLiga');
    const userLogado = localStorage.getItem('treinadorUsuario');
    if(!ligaLogada || !userLogado) return;

    // Detecta onde está: dashboard ou mercado
    let div = document.getElementById('area-olheiro') || document.getElementById('area-olheiro-mercado');
    let divStatus = document.getElementById('area-olheiro-status-mercado');
    if(!div){
        let areaTrab = document.getElementById('area-trabalho');
        if(!areaTrab) return;
        div = document.createElement('div');
        div.id = 'area-olheiro';
        div.style.cssText = "margin-bottom:15px;";
        areaTrab.prepend(div);
    }

    let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let user = snapUser.val() || {};
    let tickets = user.tickets_liberacao || 0;

    atualizarTicketTopbar(tickets);

    let olheiroLendas = user.olheiro_ativo;
    let dirNivel = user.diretor_nivel || 0;
    let dirAtivo = user.diretor_ativo; // Status da missão do Diretor

    // ==========================================
    // 1. RENDERIZA O OLHEIRO DE LENDAS (ANTIGO)
    // ==========================================
    let htmlLendas = "";
    if(olheiroLendas){
        let falta = olheiroLendas.retornaEm - Date.now();
        if(falta <= 0){
            htmlLendas = `
            <div style="border:2px solid gold; background:#1a1a1a; padding:15px; border-radius:8px; text-align:center; height:100%;">
                <h3 style="color:gold; margin:0 0 10px 0;">🔭 Olheiro Retornou!</h3>
                <p style="color:#fff; font-size:13px;">Encontrou <strong style="color:gold;">${olheiroLendas.lendaNome}</strong> perdido na várzea!</p>
                <p style="color:#aaa; font-size:11px;">Ele foi solto nos Agentes Livres da liga. Corre no Mercado antes que outro pegue!</p>
                <button onclick="resgatarLendaOlheiro()" style="background:gold; color:#000; padding:8px 15px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px;">Liberar nos Agentes Livres</button>
            </div>`;
        } else {
            let min = Math.ceil(falta/60000);
            let h = Math.floor(min/60); let m = min%60;
            htmlLendas = `<div style="background:#111; border:1px solid #333; padding:15px; border-radius:8px; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
                <div style="font-size:30px; margin-bottom:10px;">⏳</div>
                <div style="color:#aaa; font-size:13px;">🔭 Procurando <strong style="color:#fff;">${olheiroLendas.lendaNome}</strong>...<br><br>Retorna em: <strong style="color:var(--verde-campo); font-size:16px;">${h}h ${m}min</strong></div>
            </div>`;
            if(!olheiroInterval) olheiroInterval = setInterval(carregarOlheiro, 30000);
        }
    } else {
        htmlLendas = `
        <div style="background:#111; border:1px solid #333; padding:15px; border-radius:8px; height:100%;">
            <h3 style="margin:0; color:#fff; font-size:15px; display:flex; justify-content:space-between;">🔭 Olheiro de Lendas</h3>
            <p style="margin:5px 0 10px 0; color:#aaa; font-size:11px;">Encontre 1 LENDA e jogue-a nos Agentes Livres.</p>
            <div style="display:flex; gap:8px;">
                <button onclick="enviarOlheiro(2)" style="flex:1; padding:8px; background:#2a2a2a; color:#fff; border:1px solid gold; border-radius:6px; cursor:pointer;"><strong>⚡ 2h</strong><br><small>R$ 1M + 1 Ticket</small></button>
                <button onclick="enviarOlheiro(8)" style="flex:1; padding:8px; background:#2a2a2a; color:#fff; border:1px solid #555; border-radius:6px; cursor:pointer;"><strong>🐢 8h</strong><br><small>R$ 500k + 1 Ticket</small></button>
            </div>
        </div>`;
    }

    // ==========================================
    // 2. RENDERIZA O DIRETOR EXECUTIVO (NOVO)
    // ==========================================
    let htmlDiretor = "";

    if (dirNivel === 0) {
        let prox = window.diretorConfig[1];
        htmlDiretor = `
        <div style="background:#111; border:1px solid #007bff; padding:15px; border-radius:8px; height:100%; text-align:center;">
            <div style="font-size:30px; margin-bottom:5px;">💼</div>
            <h3 style="margin:0; color:#007bff; font-size:15px;">Diretor Executivo</h3>
            <p style="margin:5px 0 10px 0; color:#aaa; font-size:11px;">Contrate um executivo para achar oportunidades de mercado e conseguir <strong>até 50% de desconto</strong> em jogadores!</p>
            <button onclick="evoluirDiretor()" style="width:100%; padding:8px; background:#007bff; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Contratar (${prox.custoTk} 🎫 + R$ ${(prox.custoDin/1000000).toFixed(0)}M)</button>
        </div>`;
    }
    else if (dirAtivo) {
        if (dirAtivo.status === 'buscando') {
            let faltaDir = dirAtivo.retornaEm - Date.now();
            if (faltaDir <= 0) {
                // 🟢 GATILHO DA PARTE 2: O Relatório só vale por 2 HORAS!
                let limiteExpiracao = dirAtivo.retornaEm + (2 * 60 * 60 * 1000);

                if (Date.now() > limiteExpiracao) {
                    htmlDiretor = `
                    <div style="background:#111; border:2px solid #dc3545; padding:15px; border-radius:8px; height:100%; text-align:center; display:flex; flex-direction:column; justify-content:center;">
                        <h3 style="margin:0; color:#dc3545; font-size:15px;">🗑️ Relatório Expirado</h3>
                        <p style="margin:5px 0 10px 0; color:#ccc; font-size:12px;">Você demorou mais de 2 horas para revisar o acordo e as negociações esfriaram com os clubes.</p>
                        <button onclick="limparDiretor()" style="width:100%; padding:10px; background:#333; color:#fff; border:1px solid #555; border-radius:6px; font-weight:bold; cursor:pointer;">Limpar a Mesa</button>
                    </div>`;
                } else {
                    let minExp = Math.ceil((limiteExpiracao - Date.now())/60000);
                    let hE = Math.floor(minExp/60); let mE = minExp%60;
                    htmlDiretor = `
                    <div style="background:#111; border:2px solid #00b853; padding:15px; border-radius:8px; height:100%; text-align:center; display:flex; flex-direction:column; justify-content:center;">
                        <h3 style="margin:0; color:#00b853; font-size:15px;">📞 O Diretor Voltou!</h3>
                        <p style="margin:5px 0 10px 0; color:#ccc; font-size:12px;">Ele tem opções de <strong>${dirAtivo.posicao}</strong> na mesa prontas para fechar.<br><br>Expira em: <span style="color:#ff8c00; font-weight:bold;">${hE}h ${mE}m</span></p>
                        <button onclick="revisarRelatorioDiretor()" style="width:100%; padding:10px; background:var(--verde-campo); color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer; animation: piscar 1.5s infinite;">Revisar Relatório</button>
                    </div>`;
                }
            } else {
                let min = Math.ceil(faltaDir/60000);
                let h = Math.floor(min/60); let m = min%60;
                htmlDiretor = `
                <div style="background:#111; border:1px dashed #007bff; padding:15px; border-radius:8px; height:100%; text-align:center; display:flex; flex-direction:column; justify-content:center;">
                    <div style="font-size:24px; margin-bottom:5px;">✈️</div>
                    <h3 style="margin:0; color:#007bff; font-size:13px;">Buscando ${dirAtivo.posicao}...</h3>
                    <p style="color:#aaa; font-size:12px; margin-top:5px;">O diretor está negociando nos bastidores. Retorna em: <strong style="color:var(--verde-campo);">${h}h ${m}min</strong></p>
                </div>`;
                if(!olheiroInterval) olheiroInterval = setInterval(carregarOlheiro, 30000);
            }
        }
    }
    else {
        let cfg = window.diretorConfig[dirNivel];
        let prox = window.diretorConfig[dirNivel+1];
        let btnEvoluir = prox ? `<button onclick="evoluirDiretor()" style="margin-top:10px; width:100%; font-size:10px; background:#222; border:1px solid #444; color:#aaa; padding:4px; border-radius:4px; cursor:pointer;">⬆️ Evoluir para ${prox.nome} (${prox.custoTk} 🎫 + R$ ${(prox.custoDin/1000000).toFixed(0)}M)</button>` : `<div style="margin-top:10px; font-size:10px; color:#00b853; text-align:center;">Nível Máximo Alcançado!</div>`;

        htmlDiretor = `
        <div style="background:#111; border:1px solid #007bff; padding:15px; border-radius:8px; height:100%;">
            <h3 style="margin:0; color:#007bff; font-size:15px;">💼 Diretor: ${cfg.nome}</h3>

            <div style="margin-top:10px;">
                <select id="diretor-posicao" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:#fff; border-radius:4px; font-size:12px; margin-bottom:8px;">
                    <option value="">Qual posição buscar?</option>
                    <option value="Goleiro">Goleiro</option>
                    <option value="Zagueiro">Zagueiro</option>
                    <option value="Lateral">Lateral</option>
                    <option value="Volante">Volante</option>
                    <option value="Meia">Meia</option>
                    <option value="Atacante">Atacante (ATA/PD/CA)</option>
                </select>
                <input type="number" id="diretor-verba" placeholder="Orçamento Máximo (Ex: 15000000)" style="width:100%; padding:8px; background:#000; border:1px solid #333; color:#var(--verde-campo); border-radius:4px; font-size:12px; margin-bottom:8px;">
                <button onclick="enviarDiretor()" style="width:100%; padding:8px; background:#007bff; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px;">Enviar à Missão (Retorna em 2h)</button>
            </div>
            ${btnEvoluir}
        </div>`;
    }

    // ==========================================
    // MONTAGEM FINAL NA TELA (ABAS INTERNAS)
    // ==========================================
    window.abaOlheiroAtiva = window.abaOlheiroAtiva || 'lendas';

    let btnLendas = window.abaOlheiroAtiva === 'lendas' ? 'background:var(--verde-campo); color:#fff; border-color:var(--verde-campo);' : 'background:#2a2a2a; color:#aaa; border:1px solid #444;';
    let btnDiretor = window.abaOlheiroAtiva === 'diretor' ? 'background:#007bff; color:#fff; border-color:#007bff;' : 'background:#2a2a2a; color:#aaa; border:1px solid #444;';

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h3 style="margin:0; color:#fff; font-size:16px;">Mercado Oculto</h3>
            <div style="color:#ff8c00; font-weight:bold; background:#111; padding:6px 12px; border-radius:20px; border:1px solid #333; font-size:12px;">🎫 Tickets: <span id="qtd-tickets-olheiro">${tickets}</span></div>
        </div>

        <div style="display:flex; gap:5px; margin-bottom:15px;">
            <button onclick="mudarAbaOlheiroInterna('lendas')" style="flex:1; padding:8px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px; transition:0.2s; ${btnLendas}">🔭 Olheiro (Lendas)</button>
            <button onclick="mudarAbaOlheiroInterna('diretor')" style="flex:1; padding:8px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px; transition:0.2s; ${btnDiretor}">💼 Diretor Executivo</button>
        </div>

        <div id="conteudo-aba-olheiro">
            ${window.abaOlheiroAtiva === 'lendas' ? htmlLendas : htmlDiretor}
        </div>
    `;

    if(divStatus) divStatus.innerHTML = '';
}

window.mudarAbaOlheiroInterna = function(aba) {
    window.abaOlheiroAtiva = aba;
    carregarOlheiro(); // Recarrega a tela mostrando apenas a aba selecionada
};

// ----------------------------------------------------
// FUNÇÃO AUXILIAR DE MODAL ELEGANTE
// ----------------------------------------------------
window.mostrarAvisoOlheiro = function(texto, corBorda, icone) {
    let cx = document.createElement('div');
    cx.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
    cx.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:1px solid ${corBorda}; padding:25px; text-align:center; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
            <div style="font-size:40px; margin-bottom:10px;">${icone}</div>
            <p style="color:#fff; font-size:15px; margin-bottom:20px; line-height:1.4;">${texto}</p>
            <button onclick="this.parentElement.parentElement.remove()" style="width:100%; padding:10px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; font-weight:bold; cursor:pointer;">Fechar</button>
        </div>
    `;
    document.body.appendChild(cx);
};

// ----------------------------------------------------
// LÓGICA DO DIRETOR EXECUTIVO (MODAIS CUSTOMIZADOS)
// ----------------------------------------------------
window.evoluirDiretor = async function() {
    const ligaLogada = localStorage.getItem('treinadorLiga');
    const userLogado = localStorage.getItem('treinadorUsuario');

    let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let u = snapUser.val() || {};

    let nivelAtual = u.diretor_nivel || 0;
    let proxNivel = nivelAtual + 1;
    let cfgProx = window.diretorConfig[proxNivel];

    if (!cfgProx) return mostrarAvisoOlheiro("O seu Diretor Executivo já está no Nível Máximo!", "#007bff", "💼");
    if ((u.tickets_liberacao||0) < cfgProx.custoTk) return mostrarAvisoOlheiro(`Faltam Recursos!<br><br>Precisa de ${cfgProx.custoTk} Tickets do X1 para promover o diretor.`, "#dc3545", "🎫");
    if ((u.caixaClube||0) < cfgProx.custoDin) return mostrarAvisoOlheiro(`Caixa Insuficiente!<br><br>Faltam R$ ${((cfgProx.custoDin - (u.caixaClube||0))/1000000).toFixed(1)}M para o contrato.`, "#dc3545", "💸");

    let cxConf = document.createElement('div');
    cxConf.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
    cxConf.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:2px solid #007bff; padding:20px; text-align:center;">
            <div style="font-size:40px; margin-bottom:10px;">📈</div>
            <h3 style="color:#007bff; margin-top:0;">Assinar Contrato</h3>
            <p style="color:#ccc; font-size:14px; margin-bottom:15px;">Deseja assinar com o <strong>${cfgProx.nome}</strong>?</p>
            <div style="background:#111; padding:10px; border-radius:6px; margin-bottom:20px; font-size:13px; color:#aaa; text-align:left;">
                <strong>Custo:</strong> ${cfgProx.custoTk} Tickets + R$ ${(cfgProx.custoDin/1000000).toFixed(1)}M<br>
                <strong>Benefício:</strong> Traz ${cfgProx.opcoes} opções de negociação em cada viagem.
            </div>
            <div style="display:flex; gap:10px;">
                <button id="btn-conf-dir" style="flex:1; padding:10px; background:#007bff; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Contratar</button>
                <button id="btn-canc-dir" style="flex:1; padding:10px; background:#333; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(cxConf);

    document.getElementById('btn-canc-dir').onclick = () => cxConf.remove();
    document.getElementById('btn-conf-dir').onclick = async () => {
        cxConf.remove();
        await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({
            diretor_nivel: proxNivel,
            caixaClube: u.caixaClube - cfgProx.custoDin,
            tickets_liberacao: u.tickets_liberacao - cfgProx.custoTk
        });
        mostrarAvisoOlheiro("Diretor contratado com sucesso! A diretoria está mais forte.", "var(--verde-campo)", "✅");
        carregarOlheiro();
    };
};

window.enviarDiretor = async function() {
    const ligaLogada = localStorage.getItem('treinadorLiga');
    const userLogado = localStorage.getItem('treinadorUsuario');

    let pos = document.getElementById('diretor-posicao').value;
    let verbaStr = document.getElementById('diretor-verba').value;
    let verba = parseInt(verbaStr);

    if(!pos) return mostrarAvisoOlheiro("Escolha a posição que o Diretor deve procurar!", "#dc3545", "🎯");
    if(isNaN(verba) || verba < 1000000) return mostrarAvisoOlheiro("A diretoria exige uma verba mínima de R$ 1.000.000 para autorizar a viagem.", "#dc3545", "💰");

    let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let u = snapUser.val() || {};

    if (verba > (u.caixaClube || 0)) {
        return mostrarAvisoOlheiro(`A diretoria vetou!<br><br>Você não tem dinheiro em caixa para cobrir esse orçamento.`, "#dc3545", "🚫");
    }

    let cxConf = document.createElement('div');
    cxConf.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center;";
    cxConf.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:400px; border-radius:12px; border:2px solid #007bff; padding:20px; text-align:center;">
            <div style="font-size:40px; margin-bottom:10px;">✈️</div>
            <h3 style="color:#007bff; margin-top:0;">Enviar Diretor</h3>
            <p style="color:#ccc; font-size:14px; margin-bottom:20px;">Deseja enviar o seu Diretor Executivo em busca de um <strong>${pos}</strong>?</p>
            <div style="background:#111; padding:10px; border-radius:6px; margin-bottom:20px; font-size:13px; color:#aaa; text-align:left;">
                • Verba Disponibilizada: <strong style="color:var(--verde-campo);">${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(verba)}</strong><br>
                • Tempo da Missão: <strong>2 Horas</strong>
            </div>
            <div style="display:flex; gap:10px;">
                <button id="btn-conf-viagem" style="flex:1; padding:10px; background:#007bff; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Autorizar Viagem</button>
                <button id="btn-canc-viagem" style="flex:1; padding:10px; background:#333; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(cxConf);

    document.getElementById('btn-canc-viagem').onclick = () => cxConf.remove();
    document.getElementById('btn-conf-viagem').onclick = async () => {
        cxConf.remove();
        await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/diretor_ativo`).set({
            status: 'buscando',
            posicao: pos,
            verba: verba,
            retornaEm: Date.now() + (2 * 60 * 60 * 1000) // 2 Horas
        });
        carregarOlheiro();
    };
};

// ----------------------------------------------------
// FUNÇÕES ANTIGAS DO OLHEIRO (AGORA BLINDADAS)
// ----------------------------------------------------
function atualizarTicketTopbar(qtd){
    let el = document.getElementById('qtd-tickets-topbar');
    if(!el){
        let saldo = document.getElementById('saldo-treinador');
        if(saldo){
            let span = document.createElement('span');
            span.id = 'qtd-tickets-topbar';
            span.style.cssText = "margin-left:10px; background:#111; border:1px solid #ff8c00; color:#ff8c00; padding:4px 8px; border-radius:12px; font-size:12px;";
            saldo.parentNode.insertBefore(span, saldo.nextSibling);
            el = span;
        }
    }
    if(el) el.innerText = `🎫 ${qtd} Ticket${qtd!==1?'s':''}`;
}

async function pedirConfirmacaoOlheiro(msg, onSim){
    let modal = document.createElement('div');
    modal.id = 'modal-confirma-olheiro';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10006; display:flex; justify-content:center; align-items:center;";
    modal.innerHTML = `<div style="background:#1a1a1a; border:1px solid gold; padding:20px; border-radius:10px; max-width:350px; text-align:center;">
        <h3 style="color:gold; margin:0 0 10px 0;">🔭 Confirmar Olheiro?</h3>
        <p style="color:#ccc; font-size:14px;">${msg}</p>
        <div style="display:flex; gap:10px; margin-top:15px;">
            <button id="btn-sim-olheiro" style="flex:1; background:gold; color:#000; border:none; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer;">SIM</button>
            <button id="btn-nao-olheiro" style="flex:1; background:#333; color:#fff; border:1px solid #555; padding:10px; border-radius:6px; cursor:pointer;">NÃO</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('btn-nao-olheiro').onclick = ()=> modal.remove();
    document.getElementById('btn-sim-olheiro').onclick = async ()=>{
        modal.remove();
        if(onSim) await onSim();
    };
}

async function enviarOlheiro(horas){
    const ligaLogada = localStorage.getItem('treinadorLiga');
    const userLogado = localStorage.getItem('treinadorUsuario');
    if(!ligaLogada || !userLogado) return mostrarAvisoOlheiro('Liga não encontrada', "#dc3545", "❌");

    let custo = horas===2? 1000000 : 500000;
    let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let dados = snapUser.val()||{};
    let tickets = dados.tickets_liberacao||0;
    let caixa = dados.caixaClube||0;

    if((dados.olheiro_ativo)) return mostrarAvisoOlheiro('Você já tem 1 olheiro em campo! Espere ele voltar.', "#ff8c00", "🔭");
    if(tickets < 1) return mostrarAvisoOlheiro('Faltam Tickets!<br><br>Você precisa de 1 Ticket da Liga. Vença batalhas X1 para ganhá-los.', "#dc3545", "🎫");
    if(caixa < custo) return mostrarAvisoOlheiro('Dinheiro insuficiente no caixa!', "#dc3545", "💸");

    let msg = `Enviar olheiro por ${horas}h?<br>Custo: <strong style="color:gold;">${(custo/1000000).toFixed(1)}M + 1 Ticket</strong><br>Saldo atual: ${(caixa/1000000).toFixed(1)}M | Tickets: ${tickets}`;
    pedirConfirmacaoOlheiro(msg, async ()=>{
        let keys = Object.keys(BANCO_LENDAS);
        let id = keys[Math.floor(Math.random()*keys.length)];
        await db.ref().update({
            [`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`]: caixa - custo,
            [`ligas/${ligaLogada}/usuarios/${userLogado}/tickets_liberacao`]: tickets - 1,
            [`ligas/${ligaLogada}/usuarios/${userLogado}/olheiro_ativo`]: {
                lendaId: id, lendaNome: BANCO_LENDAS[id].nome,
                retornaEm: Date.now() + horas*60*60*1000,
                duracao: horas
            }
        });
        carregarOlheiro();
    });
}

async function resgatarLendaOlheiro(){
    const ligaLogada = localStorage.getItem('treinadorLiga');
    const userLogado = localStorage.getItem('treinadorUsuario');
    if(!ligaLogada || !userLogado) return;

    let snap = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/olheiro_ativo`).once('value');
    let ativo = snap.val();
    if(!ativo) return;

    let lenda = BANCO_LENDAS[ativo.lendaId];
    if(!lenda) return mostrarAvisoOlheiro('Lenda não encontrada no banco de dados!', "#dc3545", "❌");

    await db.ref().update({
        [`banco_global_times/Agentes_Livres_${ligaLogada}/jogadores/${ativo.lendaId}_LENDA_${Date.now()}`]: {
          ...lenda,
            nome: lenda.nome + (lenda.nome.includes('(Lenda)')?'':' (Lenda)'),
            valor_mercado: lenda.valor_mercado,
            pro_player: false,
            origem_olheiro: userLogado,
            data_descoberta: new Date().toISOString()
        },
        [`banco_global_times/Agentes_Livres_${ligaLogada}/divisao`]: "Livre",
        [`ligas/${ligaLogada}/usuarios/${userLogado}/olheiro_ativo`]: null
    });

    mostrarAvisoOlheiro(`⭐ ${lenda.nome} foi liberado nos Agentes Livres!<br><br>Corra na aba de Mercado para contratá-lo antes dos outros treinadores.`, "gold", "🎉");

    db.ref(`banco_global_times/Agentes_Livres_${ligaLogada}/jogadores/${ativo.lendaId}_LENDA_${Date.now()}/leilao_ate`).set(Date.now()+5*60*1000);
    if(olheiroInterval){ clearInterval(olheiroInterval); olheiroInterval=null; }
    carregarOlheiro();
}

setTimeout(carregarOlheiro, 1500);

window.limparDiretor = async function() {
    const ligaLogada = localStorage.getItem('treinadorLiga');
    const userLogado = localStorage.getItem('treinadorUsuario');
    await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/diretor_ativo`).remove();
    carregarOlheiro();
};

window.revisarRelatorioDiretor = async function() {
    const ligaLogada = localStorage.getItem('treinadorLiga');
    const userLogado = localStorage.getItem('treinadorUsuario');

    let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let u = snapUser.val();
    let dirAtivo = u.diretor_ativo;
    let nivel = u.diretor_nivel || 1;
    let cfg = window.diretorConfig[nivel];

    // 🧠 GERA AS OPÇÕES APENAS 1 VEZ POR VIAGEM (Para evitar reroll infinito)
    if (!dirAtivo.opcoes_geradas) {
        let snapTimes = await db.ref('banco_global_times').once('value');
        let times = snapTimes.val() || {};

        let candidatos = [];
        for (let t in times) {
            // O Diretor vasculha Clubes (Players e IAs) e os Agentes Livres! (Ignora Fantasmas e Lendas Base)
            if (t === u.timeAtual || t === 'Fantasma' || t === 'Lendas_Futebol') continue;
            let jogadores = times[t].jogadores || {};
            for (let jId in jogadores) {
                let j = jogadores[jId];
                if (j.posicoes && j.posicoes.p === dirAtivo.posicao && (j.valor_mercado||0) <= dirAtivo.verba) {
                    candidatos.push({ id: jId, time: t, dados: j });
                }
            }
        }

        // Randomiza os candidatos achados
        candidatos.sort(() => Math.random() - 0.5);
        let selecionados = candidatos.slice(0, cfg.opcoes);
        let opcoesGeradas = {};

        selecionados.forEach((cand, index) => {
            let j = cand.dados;
            let at = j.atributos || {ataque:5,defesa:5,forca:5,velocidade:5,habilidade:5};
            let ovr = Math.round((at.ataque+at.defesa+at.forca+at.velocidade+at.habilidade)/5);

            // 💰 ALGORITMO DO DESCONTO (O nível de dificuldade)
            let desconto = Math.floor(Math.random() * 41) + 10; // Sorteio base: 10% a 50% de desconto

            // Penalidade por status e OVR do jogador
            if (ovr > 85) desconto -= 15; // Estrela é difícil
            if (ovr > 90) desconto -= 10; // Super Estrela é muito difícil
            if (j.pro_player || (j.nome && j.nome.includes('Lenda'))) desconto -= 20; // Lenda e ProPlayer a IA não quer soltar

            // Trava o desconto entre 5% e 50% para não quebrar a economia
            if (desconto < 5) desconto = 5;
            if (desconto > 50) desconto = 50;

            let valorComDesconto = Math.round(j.valor_mercado * (1 - (desconto/100)));

            opcoesGeradas[`opcao_${index}`] = {
                id_jogador: cand.id,
                time_origem: cand.time,
                nome: j.nome,
                ovr: ovr,
                valor_original: j.valor_mercado,
                valor_desconto: valorComDesconto,
                desconto_porcento: desconto
            };
        });

        if (Object.keys(opcoesGeradas).length === 0) {
             mostrarAvisoOlheiro("Fracasso!<br><br>O Diretor não encontrou nenhum jogador nessa posição que aceite fechar negócio na verba estipulada.", "#ff8c00", "😕");
             await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/diretor_ativo`).remove();
             carregarOlheiro();
             return;
        }

        dirAtivo.opcoes_geradas = opcoesGeradas;
        await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/diretor_ativo/opcoes_geradas`).set(opcoesGeradas);
    }

    // 🎨 CONSTRÓI O MODAL DE REVISÃO DO RELATÓRIO
    let htmlOpcoes = "";
    for (let k in dirAtivo.opcoes_geradas) {
        let op = dirAtivo.opcoes_geradas[k];
        let formatDinheiro = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

        let btnCompra = "";
        if ((u.caixaClube||0) >= op.valor_desconto) {
            btnCompra = `<button onclick="comprarJogadorDiretor('${k}')" style="width:100%; margin-top:10px; padding:10px; background:#00b853; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Assinar Contrato (${formatDinheiro(op.valor_desconto)})</button>`;
        } else {
            btnCompra = `<button disabled style="width:100%; margin-top:10px; padding:10px; background:#555; color:#aaa; border:none; border-radius:4px; font-weight:bold; cursor:not-allowed;">Faltou Dinheiro</button>`;
        }

        htmlOpcoes += `
            <div style="background:#111; border:1px solid #333; padding:15px; border-radius:8px; margin-bottom:15px; position:relative; overflow:hidden;">
                <div style="position:absolute; top:10px; right:10px; background:var(--verde-campo); color:#fff; padding:3px 8px; border-radius:10px; font-size:11px; font-weight:bold;">-${op.desconto_porcento}% OFF</div>
                <h4 style="margin:0 0 5px 0; color:#fff; font-size:16px;">${op.nome}</h4>
                <div style="color:#aaa; font-size:12px; margin-bottom:10px;">OVR <strong style="color:#ff8c00;">${op.ovr}</strong> | Clube: ${op.time_origem.replace(/_/g,' ').replace('Agentes Livres', 'Ag. Livres')}</div>
                <div style="display:flex; justify-content:space-between; align-items:center; background:#000; padding:8px; border-radius:4px;">
                    <div style="text-decoration:line-through; color:#dc3545; font-size:11px;">${formatDinheiro(op.valor_original)}</div>
                    <div style="color:var(--verde-campo); font-size:16px; font-weight:bold;">${formatDinheiro(op.valor_desconto)}</div>
                </div>
                ${btnCompra}
            </div>
        `;
    }

    let cxRelatorio = document.createElement('div');
    cxRelatorio.id = 'modal-relatorio-diretor';
    cxRelatorio.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10006; display:flex; justify-content:center; align-items:center;";
    cxRelatorio.innerHTML = `
        <div style="background:#1a1a1a; width:95%; max-width:500px; border-radius:12px; border:2px solid #00b853; display:flex; flex-direction:column; max-height:85vh; box-shadow:0 10px 40px rgba(0,184,83,0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 20px; border-bottom:1px solid #333; background:#111; border-radius:12px 12px 0 0;">
                <h2 style="color:#00b853; margin:0; font-size:18px;">📄 Relatório de Negociações</h2>
                <button onclick="document.getElementById('modal-relatorio-diretor').remove()" style="background:transparent; border:none; color:#aaa; font-size:24px; cursor:pointer;">&times;</button>
            </div>
            <div style="padding:15px; overflow-y:auto; flex:1;">
                <p style="color:#ccc; font-size:13px; margin-top:0;">Seu executivo conseguiu acordos relâmpago. Se você assinar com um deles, as demais propostas são rasgadas.</p>
                ${htmlOpcoes}
            </div>
            <div style="padding:15px; border-top:1px solid #333; display:flex; gap:10px; background:#111; border-radius:0 0 12px 12px;">
                <button onclick="document.getElementById('modal-relatorio-diretor').remove()" style="flex:1; padding:12px; background:#333; color:#fff; border:1px solid #555; border-radius:6px; font-weight:bold; cursor:pointer;">Pensar Mais</button>
                <button onclick="limparDiretor(); document.getElementById('modal-relatorio-diretor').remove()" style="flex:1; padding:12px; background:#dc3545; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Rejeitar Relatório</button>
            </div>
        </div>
    `;
    document.body.appendChild(cxRelatorio);
};

window.comprarJogadorDiretor = async function(chaveOpcao) {
    const ligaLogada = localStorage.getItem('treinadorLiga');
    const userLogado = localStorage.getItem('treinadorUsuario');

    let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let u = snapUser.val();
    let op = u.diretor_ativo.opcoes_geradas[chaveOpcao];

    // Confirmação personalizada
    let modalConf = document.createElement('div');
    modalConf.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10007; display:flex; justify-content:center; align-items:center;";
    modalConf.innerHTML = `
        <div style="background:#1a1a1a; width:90%; max-width:350px; border-radius:12px; border:2px solid #00b853; padding:20px; text-align:center;">
            <div style="font-size:40px; margin-bottom:10px;">🤝</div>
            <h3 style="color:#00b853; margin-top:0;">Bater o Martelo</h3>
            <p style="color:#ccc; font-size:14px; margin-bottom:20px;">Confirma o pagamento da multa rescisória com o desconto aplicado e finalizar a compra de <strong>${op.nome}</strong>?</p>
            <div style="display:flex; gap:10px;">
                <button id="btn-comprar-sim" style="flex:1; padding:10px; background:#00b853; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Sim, Comprar</button>
                <button id="btn-comprar-nao" style="flex:1; padding:10px; background:#333; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Não</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalConf);

    document.getElementById('btn-comprar-nao').onclick = () => modalConf.remove();
    document.getElementById('btn-comprar-sim').onclick = async () => {
        modalConf.remove();

        if((u.caixaClube||0) < op.valor_desconto){
             return mostrarAvisoOlheiro("Você não tem saldo em caixa para honrar o pagamento desta multa.", "#dc3545", "💸");
        }

        // Verifica se o jogador ainda existe no time de origem
        let snapJog = await db.ref(`banco_global_times/${op.time_origem}/jogadores/${op.id_jogador}`).once('value');
        let dadosJog = snapJog.val();

        if(!dadosJog){
            return mostrarAvisoOlheiro("Deu ruim!<br><br>O jogador já foi negociado com outro clube neste meio tempo e o acordo melou.", "#dc3545", "❌");
        }

        let updates = {};

        // Tira o dinheiro
        updates[`ligas/${ligaLogada}/usuarios/${userLogado}/caixaClube`] = u.caixaClube - op.valor_desconto;

        // Paga o clube de origem se for IA/Player
        let snapAllUsers = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
        let todosUsers = snapAllUsers.val() || {};
        let loginVendedor = Object.keys(todosUsers).find(k => todosUsers[k].timeAtual === op.time_origem);
        if (loginVendedor) {
            updates[`ligas/${ligaLogada}/usuarios/${loginVendedor}/caixaClube`] = (todosUsers[loginVendedor].caixaClube||0) + op.valor_desconto;
            updates[`ligas/${ligaLogada}/caixa_mensagens/${loginVendedor}/msg_venda_${Date.now()}`] = {
                tipo: 'sucesso',
                texto: `O clube ${u.timeAtual.replace(/_/g,' ')} pagou a multa rescisória direta do contrato e assinou com ${op.nome} (${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(op.valor_desconto)}).`,
                data: new Date().toISOString()
            };
        }

        // Transfere o jogador
        updates[`banco_global_times/${op.time_origem}/jogadores/${op.id_jogador}`] = null;
        updates[`banco_global_times/${u.timeAtual}/jogadores/${op.id_jogador}`] = dadosJog;

        // Histórico
        updates[`ligas/${ligaLogada}/historico_transferencias/${Date.now()}_${Math.floor(Math.random()*1000)}`] = {
            jogador_nome: dadosJog.nome,
            jogador_id: op.id_jogador,
            time_origem: op.time_origem,
            time_destino: u.timeAtual,
            valor: op.valor_desconto,
            tipo: 'clausula_executivo',
            data: new Date().toISOString()
        };

        // Limpa a missão do diretor
        updates[`ligas/${ligaLogada}/usuarios/${userLogado}/diretor_ativo`] = null;

        // Remove propostas pendentes que esse jogador tinha no mercado (para não travar)
        let snapMerc = await db.ref(`ligas/${ligaLogada}/mercado_propostas/${op.id_jogador}`).once('value');
        if(snapMerc.exists()){
            updates[`ligas/${ligaLogada}/mercado_propostas/${op.id_jogador}`] = null;
        }

        await db.ref().update(updates);

        let m = document.getElementById('modal-relatorio-diretor');
        if(m) m.remove();
        mostrarAvisoOlheiro(`Transferência Concluída!<br><br>${op.nome} já está no seu elenco com um desconto fantástico.`, "var(--verde-campo)", "📸");
        carregarOlheiro();
    };
};