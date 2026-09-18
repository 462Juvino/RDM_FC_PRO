// js/olheiro.js - OLHEIRO DE LENDAS - 1 por vez, vai para Agentes Livres
let olheiroInterval = null;

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
        div.style.cssText = "background: var(--card-bg); border:1px solid #444; border-radius:8px; padding:15px; margin-bottom:15px;";
        areaTrab.prepend(div);
    }

    let snap = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/olheiro_ativo`).once('value');
    let ativo = snap.val();
    let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let user = snapUser.val()||{};
    let tickets = user.tickets_liberacao||0;
    atualizarTicketTopbar(tickets);

    if(ativo){
        let falta = ativo.retornaEm - Date.now();
        if(falta <= 0){
            div.innerHTML = `<div style="border:2px solid gold; background:#1a1a1a; padding:15px; border-radius:8px; text-align:center;">
                <h3 style="color:gold; margin:0 0 10px 0;">🔭 Olheiro Retornou!</h3>
                <p style="color:#fff;">Encontrou <strong style="color:gold;">${ativo.lendaNome}</strong> perdido na várzea!</p>
                <p style="color:#aaa; font-size:12px;">Ele foi solto nos Agentes Livres da liga. Corre no Mercado antes que outro pegue!</p>
                <button onclick="resgatarLendaOlheiro()" style="background:gold; color:#000; padding:10px 20px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Liberar nos Agentes Livres</button>
            </div>`;
        } else {
            let min = Math.ceil(falta/60000);
            let h = Math.floor(min/60); let m = min%60;
            div.innerHTML = `<div style="color:#aaa;">🔭 Olheiro em missão: procurando <strong style="color:#fff;">${ativo.lendaNome}</strong>...<br>Retorna em: <strong style="color:var(--verde-campo);">${h}h ${m}min</strong> | Tickets: <strong style="color:#ff8c00;">${tickets}</strong></div>`;
            if(!olheiroInterval) olheiroInterval = setInterval(carregarOlheiro, 30000);
        }
    } else {
        let htmlBase = `<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div><h3 style="margin:0; color:#fff;">🔭 Central de Olheiros</h3><p style="margin:5px 0 0 0; color:#aaa; font-size:12px;">Encontre 1 LENDA por vez. Precisa de 1 Ticket + dinheiro. Ticket só ganha vencendo X1 (empate não ganha).</p></div>
            <div style="color:#ff8c00; font-weight:bold; background:#111; padding:6px 12px; border-radius:20px; border:1px solid #333;">🎫 Tickets: <span id="qtd-tickets-olheiro">${tickets}</span></div>
        </div>
        <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
            <button onclick="enviarOlheiro(2)" style="flex:1; min-width:140px; padding:10px; background:#2a2a2a; color:#fff; border:1px solid gold; border-radius:6px; cursor:pointer;"><strong>⚡ 2h</strong><br><small>R$ 1.000.000 + 1 Ticket</small></button>
            <button onclick="enviarOlheiro(8)" style="flex:1; min-width:140px; padding:10px; background:#2a2a2a; color:#fff; border:1px solid #555; border-radius:6px; cursor:pointer;"><strong>🐢 8h</strong><br><small>R$ 500.000 + 1 Ticket</small></button>
        </div>`;
        div.innerHTML = htmlBase;
        // Se estiver no mercado, também replica no status
        if(divStatus) divStatus.innerHTML = '';
    }
}

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
    if(!ligaLogada || !userLogado) return alert('Liga não encontrada');
    let custo = horas===2? 1000000 : 500000;
    let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let dados = snapUser.val()||{};
    let tickets = dados.tickets_liberacao||0;
    let caixa = dados.caixaClube||0;
    if((dados.olheiro_ativo)) return alert('Você já tem 1 olheiro em campo! Espere voltar.');
    if(tickets < 1) return alert('Você precisa de 1 Ticket de Liberação da Liga! Vença batalhas X1 no modo Pelada.');
    if(caixa < custo) return alert('Dinheiro insuficiente!');

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
    if(!ligaLogada || !userLogado) return alert('Liga não encontrada');
    let snap = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}/olheiro_ativo`).once('value');
    let ativo = snap.val(); if(!ativo) return;
    let lenda = BANCO_LENDAS[ativo.lendaId];
    if(!lenda) return alert('Lenda não encontrada no banco!');
    // Joga a lenda nos Agentes Livres da liga para TODOS poderem comprar
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
    alert(`⭐ ${lenda.nome} liberado nos Agentes Livres! Corre no Mercado!`);
    if(olheiroInterval){ clearInterval(olheiroInterval); olheiroInterval=null; }
    carregarOlheiro();
}
setTimeout(carregarOlheiro, 1500);