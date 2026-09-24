// js/ranking.js - CORRIGIDO
const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');
if (!ligaLogada ||!userLogado) window.location.href = "index.html";

let divisaoAtual = 'A';
let bancoTimesGlobal = {};
let calendarioGlobal = {};
let treinadoresGlobaisCache = {};
window.treinadoresGlobais = {};

window.addEventListener('DOMContentLoaded', async () => {
    let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let dados = snapUser.val();
    if(dados){
        document.getElementById('nome-treinador').innerText = dados.nome || 'Treinador';
        document.getElementById('nome-time').innerText = (dados.timeAtual||'').replace(/_/g,' ');
    }
    carregarDadosRanking();
});

async function carregarDadosRanking(){
    let [snapTimes, snapCal] = await Promise.all([
        db.ref('banco_global_times').once('value'),
        db.ref(`ligas/${ligaLogada}/calendario`).once('value')
    ]);
        bancoTimesGlobal = snapTimes.val()||{};
    calendarioGlobal = snapCal.val()||{};
    // Carrega nomes dos treinadores para exibir igual no dashboard
    let snapUsers = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
    let users = snapUsers.val()||{};
    for(let k in users){
        if(users[k].timeAtual && users[k].timeAtual!=="Sem Clube"){
            window.treinadoresGlobais[users[k].timeAtual] = users[k].nome;
        }
    }
    mudarDivisao(divisaoAtual);
}

window.mudarDivisao = function(div){
    divisaoAtual = div;
    document.getElementById('btn-div-A').classList.toggle('ativo', div==='A');
    document.getElementById('btn-div-B').classList.toggle('ativo', div==='B');
    renderTabela(div);
    renderArtilharia(div);
    carregarRankingConquistas();
};

async function carregarRankingConquistas(){
    let div = document.getElementById('ranking-conquistas');
    if(!div) return;
    let snap = await db.ref(`ligas/${ligaLogada}/usuarios`).once('value');
    let usuarios = snap.val()||{};
    let rank = [];
    for(let id in usuarios){
        if(id.startsWith('IA_')) continue;
        let u = usuarios[id];
        let total = Object.keys(u.conquistas||{}).length;
        rank.push({ nome: u.nome||id, time: (u.timeAtual||'').replace(/_/g,' '), total: total, caixa: u.caixaClube||0 });
    }
    rank.sort((a,b)=> b.total - a.total || b.caixa - a.caixa);
    div.innerHTML = rank.length ? rank.slice(0,10).map((r,i)=>`<div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #333;"><span>${i+1}º ${r.nome} (${r.time})</span><strong style="color:#00ff88;">${r.total} 🏆</strong></div>`).join('') : '<div style="color:#666; padding:10px;">Nenhum treinador com conquistas ainda</div>';
}

function renderTabela(div){
    let tabela = {};
    for(let t in bancoTimesGlobal){
        if(bancoTimesGlobal[t].divisao === div &&!t.startsWith('Agentes') && t!=='Fantasma' && t!=='Lendas_Futebol'){
            tabela[t] = { id:t, nome:t.replace(/_/g,' '), Pts:0, J:0, V:0, E:0, D:0, GP:0, GC:0, SG:0 };
        }
    }
    // CORRIGIDO: lê serieA / serieB igual ao dashboard.js
    let jogosDivisao = div === 'A'? calendarioGlobal.serieA : calendarioGlobal.serieB;
    if(jogosDivisao){
        for(let rodada in jogosDivisao){
            for(let idJogo in jogosDivisao[rodada]){
                let jogo = jogosDivisao[rodada][idJogo];
                if(!jogo.jogado &&!jogo.linhaDoTempo) continue;
                let m = jogo.mandante; let v = jogo.visitante;
                let gm = jogo.placarMandante?? jogo.golsM?? 0;
                let gv = jogo.placarVisitante?? jogo.golsV?? 0;
                if(m==="Fantasma" || v==="Fantasma") continue;
                if(!tabela[m]) tabela[m] = { id:m, nome:m.replace(/_/g,' '), Pts:0, J:0, V:0, E:0, D:0, GP:0, GC:0, SG:0 };
                if(!tabela[v]) tabela[v] = { id:v, nome:v.replace(/_/g,' '), Pts:0, J:0, V:0, E:0, D:0, GP:0, GC:0, SG:0 };
                tabela[m].J++; tabela[v].J++;
                tabela[m].GP += gm; tabela[m].GC += gv;
                tabela[v].GP += gv; tabela[v].GC += gm;
                if(gm > gv){ tabela[m].V++; tabela[m].Pts+=3; tabela[v].D++; }
                else if(gv > gm){ tabela[v].V++; tabela[v].Pts+=3; tabela[m].D++; }
                else { tabela[m].E++; tabela[v].E++; tabela[m].Pts++; tabela[v].Pts++; }
            }
        }
    }
    for(let t in tabela) tabela[t].SG = tabela[t].GP - tabela[t].GC;
    let ordenados = Object.values(tabela).sort((a,b)=> b.Pts - a.Pts || b.V - a.V || b.SG - a.SG || b.GP - a.GP);
    let tbody = document.getElementById('corpo-tabela');
    if(ordenados.length===0){
        tbody.innerHTML = '<tr><td colspan="10" style="padding:20px; color:#666;">Nenhum jogo finalizado na Série '+div+' ainda (Rodada '+(calendarioGlobal.rodadaAtual||1)+')</td></tr>';
        return;
    }
    tbody.innerHTML = ordenados.map((time,i)=>{
        let zona = i<4? 'zona-azul' : i>=ordenados.length-4? 'zona-vermelha' : 'sem-zona';
        let nomeDono = window.treinadoresGlobais && window.treinadoresGlobais[time.id]? `<span style="font-size:9px; color:#888; display:block; line-height:1; font-weight:normal;">👤 ${window.treinadoresGlobais[time.id]}</span>` : "";
        let btnEspiao = `<button onclick="espionarAdversario('${time.id}')" title="Espiar ${time.nome}" style="background:transparent; border:none; color:#666; cursor:pointer; font-size:14px; margin-left:8px; opacity:0.5; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; transition:0.2s;" onmouseover="this.style.opacity='1'; this.style.color='#ff8c00'" onmouseout="this.style.opacity='0.5'; this.style.color='#666'">👁️</button>`;
        return `<tr class="${zona}">
            <td>${i+1}º</td>
            <td style="text-align:left; color:#fff;"><div style="display:flex; align-items:center; gap:6px;"><img src="${getEscudo(time.id)}" onerror="this.src='esculdos/default.png'" style="width:18px; height:18px;"><div style="line-height:1.1;">${time.nome}${nomeDono}</div>${btnEspiao}</div></td>
            <td class="col-pts">${time.Pts}</td><td>${time.J}</td><td>${time.V}</td><td>${time.E}</td><td>${time.D}</td><td>${time.GP}</td><td>${time.GC}</td><td>${time.SG}</td>
        </tr>`;
    }).join('');
}

// FIX RANKING - CORRIGIDO: só campeonato conta - V2
function renderArtilharia(div){
    let todos = [];
    for(let t in bancoTimesGlobal){
        if(bancoTimesGlobal[t].divisao!== div) continue;
        if(t.startsWith('Agentes') || t==='Lendas_Futebol' || t==='Fantasma') continue;
        let jogadores = bancoTimesGlobal[t].jogadores||{};
        for(let jId in jogadores){
            let j = jogadores[jId];
            if(j.estatisticas){
                // 🟢 CORREÇÃO: Pega o histórico COMPLETO do jogador e subtrai os gols exclusivos da Copa
                let golsCamp = (j.estatisticas.gols || 0) - (j.estatisticas.gols_copa || 0);
                let astsCamp = (j.estatisticas.assistencias || 0) - (j.estatisticas.assistencias_copa || 0);
                let gcCamp = (j.estatisticas.gols_sofridos || 0) - (j.estatisticas.gols_sofridos_copa || 0);
                let jogosCamp = j.estatisticas.jogos || 0;

                // Qualquer goleiro que jogou 1 partida já entra!
                if(golsCamp>0 || astsCamp>0 || (j.posicoes && j.posicoes.p==="Goleiro" && jogosCamp>0)){
                    todos.push({
                        id: jId,
                        nome: j.nome.split(' ')[0],
                        nomeCompleto: j.nome,
                        time: t.replace(/_/g,' '),
                        timeId: t,
                        gols: Math.max(0, golsCamp),
                        asts: Math.max(0, astsCamp),
                        gc: Math.max(0, gcCamp),
                        jogos: jogosCamp,
                        bonus: j.bonus_ranking||0,
                        isGoleiro: j.posicoes && j.posicoes.p==="Goleiro"
                    });
                }
            }
        }
    }
    function bonusLabel(b){ return b>0? `<span style="background:gold; color:#000; font-size:10px; padding:2px 4px; border-radius:3px; margin-left:5px;">+${b} OVR</span>` : ""; }

    let art = [...todos].filter(j=>j.gols>0).sort((a,b)=>b.gols-a.gols).slice(0,10);
    let ulGols = document.getElementById('lista-artilheiros');
    if(ulGols){
        ulGols.innerHTML = art.length? art.map((j,i)=> {
            let cor = i===0?'gold': i<3?'#ff8c00':'#fff';
            return `<li style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed #333;"><span style="color:${cor};">${i+1}º ${j.nomeCompleto} ${j.bonus?bonusLabel(j.bonus):''} <small style="color:#888;">(${j.time}) - ${j.jogos}J</small></span><strong style="color:#ff8c00;">${j.gols}</strong></li>`;
        }).join('') : '<li style="color:#666;">Sem gols no campeonato ainda...</li>';
    }
    let ast = [...todos].filter(j=>j.asts>0).sort((a,b)=>b.asts-a.asts).slice(0,10);
    let ulAsts = document.getElementById('lista-assistencias');
    if(ulAsts){
        ulAsts.innerHTML = ast.length? ast.map((j,i)=> {
            return `<li style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed #333;"><span style="color:#fff;">${i+1}º ${j.nomeCompleto} ${j.bonus?bonusLabel(j.bonus):''} <small style="color:#888;">(${j.time})</small></span><strong style="color:#00b853;">${j.asts}</strong></li>`;
        }).join('') : '<li style="color:#666;">Sem assistências no campeonato...</li>';
    }

    // 🟢 CORREÇÃO: Pega qualquer goleiro com 1+ jogos. Se o GC for 0, ele fica em 1º!
    let gols = [...todos].filter(j=>j.isGoleiro && j.jogos>=1).sort((a,b)=>a.gc-b.gc).slice(0,10);
    let ulGolsSof = document.getElementById('lista-goleiros');
    if(ulGolsSof){
        ulGolsSof.innerHTML = gols.length? gols.map((j,i)=> {
            return `<li style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed #333;"><span style="color:#fff;">${i+1}º ${j.nomeCompleto} ${j.bonus?bonusLabel(j.bonus):''} <small style="color:#888;">(${j.time}) - ${j.jogos}J</small></span><strong style="color:#007bff;">${j.gc} GC <small style="color:#888;">(${ (j.gc/j.jogos).toFixed(2) }/J)</small></strong></li>`;
        }).join('') : '<li style="color:#666;">Sem dados de goleiros no campeonato...</li>';
    }
}


// Função auxiliar para escudo (se não tiver global)
function getEscudo(timeId){
    try{
        if(bancoTimesGlobal[timeId] && bancoTimesGlobal[timeId].escudo_base64) return bancoTimesGlobal[timeId].escudo_base64;
    }catch(e){}
    return 'esculdos/default.png';
}

// Helper dinheiro se não existir
if(!window.formatarDinheiro){
  window.formatarDinheiro = function(v){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0); };
}

    // Modal bonitinho padrão
function modalAvisoRanking(titulo, texto, cor="#007bff", icone="🕵️‍♂️"){
  let m=document.createElement('div');
  m.id='modal-aviso-ranking';
  m.style.cssText="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10006; display:flex; justify-content:center; align-items:center;";
  m.innerHTML=`
    <div style="background:#1e1e1e; width:90%; max-width:380px; border-radius:12px; border:2px solid ${cor}; padding:20px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
      <div style="font-size:36px; margin-bottom:10px;">${icone}</div>
      <h3 style="color:${cor}; margin:0 0 10px 0;">${titulo}</h3>
      <p style="color:#ccc; font-size:14px; line-height:1.4; margin-bottom:18px;">${texto}</p>
      <button onclick="document.getElementById('modal-aviso-ranking').remove()" style="width:100%; padding:10px; background:#2a2a2a; color:#fff; border:1px solid #444; border-radius:6px; font-weight:bold; cursor:pointer;">Fechar</button>
    </div>`;
  document.body.appendChild(m);
}
function modalConfirmRanking(timeAlvoId, custo, eu, rodadaCobranca, olheiroData){
  let m=document.createElement('div');
  m.id='modal-confirm-ranking';
  m.style.cssText="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10006; display:flex; justify-content:center; align-items:center;";
  m.innerHTML=`
    <div style="background:#1e1e1e; width:90%; max-width:380px; border-radius:12px; border:2px solid #ff8c00; padding:20px; box-shadow:0 10px 30px rgba(255,140,0,0.2);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="color:#ff8c00; margin:0;">🕵️‍♂️ Enviar Olheiro?</h3>
        <button onclick="document.getElementById('modal-confirm-ranking').remove()" style="background:transparent; border:none; color:#666; font-size:22px; cursor:pointer;">&times;</button>
      </div>
      <div style="background:#111; border:1px solid #333; border-radius:8px; padding:12px; margin-bottom:12px; text-align:left;">
        <div style="color:#aaa; font-size:12px;">Alvo</div>
        <div style="color:#fff; font-weight:bold; font-size:15px; margin-bottom:8px;">${timeAlvoId.replace(/_/g,' ')}</div>
        <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:#aaa;">Custo missão</span><strong style="color:#00b853;">${formatarDinheiro(custo)}</strong></div>
        <div style="font-size:11px; color:#666; margin-top:6px;">Valor dobra a cada espionagem no mesmo dia. Uso hoje: ${olheiroData.qtd}x</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button id="btn-cancelar-esp" style="flex:1; padding:10px; background:#2a2a2a; color:#aaa; border:1px solid #444; border-radius:6px; cursor:pointer;">Cancelar</button>
        <button id="btn-confirmar-esp" style="flex:1; padding:10px; background:#ff8c00; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Espionar por ${formatarDinheiro(custo)}</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  document.getElementById('btn-cancelar-esp').onclick=()=>m.remove();
  document.getElementById('btn-confirmar-esp').onclick=async()=>{
    m.remove();
    await executarEspionagemRanking(timeAlvoId, custo, eu, rodadaCobranca, olheiroData);
  };
}

async function executarEspionagemRanking(timeAlvoId, custo, eu, rodadaCobranca, olheiroData){
  try{
    let novoCaixa = eu.caixaClube - custo;
    olheiroData.qtd += 1;
    await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).update({ caixaClube: novoCaixa, uso_olheiro: olheiroData });

    let [snapAllUsers, snapTimes] = await Promise.all([
      db.ref(`ligas/${ligaLogada}/usuarios`).once('value'),
      db.ref('banco_global_times').once('value')
    ]);
    let usuariosGeral = snapAllUsers.val()||{};
    let timesGerais = snapTimes.val()||{};
    let donoAlvoObj = null; let isIA = true;
    for(let u in usuariosGeral){ if(usuariosGeral[u].timeAtual===timeAlvoId){ donoAlvoObj=usuariosGeral[u]; isIA = u.startsWith('IA_'); break; } }

    if(!isIA && donoAlvoObj && donoAlvoObj.escudo_rodada && donoAlvoObj.escudo_rodada.rodada===rodadaCobranca && donoAlvoObj.escudo_rodada.ativo){
      return modalAvisoRanking("Missão Fracassada!", `O técnico do ${timeAlvoId.replace(/_/g,' ')} ativou o <strong style="color:#ff8c00;">Treino Sigiloso</strong> e fechou os portões. Seu olheiro não viu nada, mas o dinheiro foi gasto.`, "#dc3545", "🚨");
    }

    let tatica = donoAlvoObj? (donoAlvoObj.mentalidade||"Moderado") : "Moderado";
    let titularesIDs = donoAlvoObj? (donoAlvoObj.titulares||[]) : [];
    let timeDados = timesGerais[timeAlvoId]?.jogadores||{};

    if(isIA || titularesIDs.length===0){
      let elenco = Object.values(timeDados).sort((a,b)=>{
        let ovrA=(a.atributos.ataque+a.atributos.defesa+a.atributos.forca+a.atributos.velocidade+a.atributos.habilidade);
        let ovrB=(b.atributos.ataque+b.atributos.defesa+b.atributos.forca+b.atributos.velocidade+b.atributos.habilidade);
        return ovrB-ovrA;
      });
      titularesIDs = elenco.slice(0,11);
    } else {
      titularesIDs = titularesIDs.filter(id=>id).map(id=>timeDados[id]).filter(j=>j);
    }

    let forcaTotal = 0; let htmlJogadores = "";
    titularesIDs.forEach(j=>{
      let at=j.atributos||{ataque:0,defesa:0,forca:0,velocidade:0,habilidade:0};
      let ovr=Math.round((at.ataque+at.defesa+at.forca+at.velocidade+at.habilidade)/5);
      forcaTotal += (at.ataque+at.defesa+at.forca+at.velocidade+at.habilidade);
      let pos=j.posicoes? j.posicoes.p.charAt(0) : "N";
      htmlJogadores += `<div style="display:flex; justify-content:space-between; border-bottom:1px dashed #333; padding:6px 0; font-size:13px;"><span><strong style="color:var(--verde-campo);">${pos}</strong> - ${j.nome}</span><strong style="color:#ff8c00;">${ovr}</strong></div>`;
    });

    let modal=document.createElement('div');
    modal.id='modal-relatorio-olheiro';
    modal.style.cssText="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10005; display:flex; justify-content:center; align-items:center; padding:15px; box-sizing:border-box;";
    modal.innerHTML=`
      <div style="background:#1e1e1e; width:100%; max-width:400px; border-radius:12px; border:2px solid #007bff; padding:20px; box-shadow:0 10px 40px rgba(0,123,255,0.3); max-height:90vh; display:flex; flex-direction:column;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:10px; margin-bottom:15px;">
          <h2 style="color:#007bff; margin:0; font-size:18px;">🕵️‍♂️ Dossiê Espião</h2>
          <button onclick="document.getElementById('modal-relatorio-olheiro').remove()" style="background:#2a2a2a; border:1px solid #444; color:#fff; width:32px; height:32px; border-radius:50%; cursor:pointer;">✕</button>
        </div>
        <div style="text-align:center; margin-bottom:15px;">
          <img src="${getEscudo(timeAlvoId)}" onerror="this.src='esculdos/default.png'" style="width:64px; height:64px; background:#111; border-radius:50%; padding:8px; border:1px solid #333;">
          <h3 style="color:#fff; margin:8px 0 0 0;">${timeAlvoId.replace(/_/g,' ')}</h3>
        </div>
        <div style="background:#111; padding:12px; border-radius:8px; border:1px solid #333; margin-bottom:15px; display:flex; justify-content:space-between;">
          <div><div style="color:#666; font-size:11px;">MENTALIDADE</div><strong style="color:#ff8c00;">${tatica}</strong></div>
          <div style="text-align:right;"><div style="color:#666; font-size:11px;">FORÇA DO 11</div><strong style="color:var(--verde-campo);">${forcaTotal}</strong></div>
        </div>
        <div style="flex:1; overflow-y:auto; padding-right:5px;">${htmlJogadores||"<span style='color:#666;'>Sem titulares definidos.</span>"}</div>
      </div>`;
    document.body.appendChild(modal);
  }catch(e){ console.error(e); modalAvisoRanking("Erro", e.message, "#dc3545", "❌"); }
}

window.espionarAdversario = async function(timeAlvoId){
  try{
    let snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
    let eu = snapUser.val()||{};
    let snapCal = await db.ref(`ligas/${ligaLogada}/calendario`).once('value');
    let cal = snapCal.val()||{};
    let rodadaAtual = cal.rodadaAtual||1;
    let rodadaCobranca = (new Date().getHours()>=19)? rodadaAtual+1 : rodadaAtual;
    let olheiroData = eu.uso_olheiro || {rodada:0, qtd:0};
    if(olheiroData.rodada!== rodadaCobranca) olheiroData = {rodada: rodadaCobranca, qtd:0};
    let custo = 50000 * Math.pow(2, olheiroData.qtd);

    if((eu.caixaClube||0) < custo){
      return modalAvisoRanking("Caixa Insuficiente", `Você precisa de <strong>${formatarDinheiro(custo)}</strong> para enviar o olheiro ao ${timeAlvoId.replace(/_/g,' ')}.`, "#dc3545", "💸");
    }
    modalConfirmRanking(timeAlvoId, custo, eu, rodadaCobranca, olheiroData);
  }catch(e){ console.error(e); modalAvisoRanking("Erro", e.message, "#dc3545", "❌"); }
};

// CONTROLE DO MENU MOBILE - COPIADO DO DASHBOARD
function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    const menuAberto = sidebar.classList.toggle('aberta');
    if (menuAberto) {
        document.body.classList.add('menu-aberto');
    } else {
        document.body.classList.remove('menu-aberto');
    }
}
function deslogar(){
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = 'index.html';
}

// MANUAL DO TÉCNICO - INJETA NO MENU LATERAL
document.addEventListener('DOMContentLoaded', () => {
    let sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        if(!sidebar.querySelector('#btn-manual-tecnico')){
            let btnSair = sidebar.querySelector('.btn-sair');
            let btnManual = document.createElement('button');
            btnManual.id = 'btn-manual-tecnico';
            btnManual.innerHTML = '📖 Manual do Técnico';
            btnManual.style.color = '#007bff';
            btnManual.onclick = abrirManualDoJogo;
            if(btnSair) sidebar.insertBefore(btnManual, btnSair);
            else sidebar.appendChild(btnManual);
        }
    }
});

window.abrirManualDoJogo = function() {
    let modal = document.createElement('div');
    modal.id = 'modal-manual-jogo';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10005; display:flex; justify-content:center; align-items:center;";
    let style = `<style>
       .accordion-btn { background-color: #222; color: #fff; cursor: pointer; padding: 15px; width: 100%; text-align: left; border: none; outline: none; transition: 0.3s; font-size: 15px; font-weight: bold; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
       .accordion-btn:hover { background-color: #333; }
       .accordion-btn:after { content: '\\002B'; color: var(--verde-campo); font-weight: bold; margin-left: 5px; font-size: 18px; }
       .accordion-btn.active:after { content: '\\2212'; color: #ff8c00; }
       .accordion-panel { padding: 0 15px; background-color: #111; max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; color: #ccc; font-size: 14px; line-height: 1.6; }
       .accordion-panel p { margin: 15px 0; }
    </style>`;
    modal.innerHTML = style + `
        <div style="background:#1a1a1a; width:95%; max-width:700px; height:85vh; border-radius:12px; border:1px solid #444; display:flex; flex-direction:column; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #333; background:#111;">
                <h2 style="margin:0; color:#007bff;">📖 Manual do Técnico</h2>
                <button onclick="document.getElementById('modal-manual-jogo').remove()" style="background:transparent; border:none; color:#aaa; font-size:24px; cursor:pointer;">&times;</button>
            </div>
            <div style="overflow-y:auto; flex:1; padding:10px;">
                <button class="accordion-btn">📋 1. Visão Geral e Objetivo</button>
                <div class="accordion-panel"><p>Seu objetivo é levar seu clube ao topo. Cada rodada simula os jogos automaticamente. Gerencie finanças, elenco e tática.</p></div>
                <button class="accordion-btn">⚽ 2. Tática e Escalação</button>
                <div class="accordion-panel"><p>A força OVR dos 11 titulares define sua chance de gol. Mantenha elenco saudável para evitar fadiga.</p></div>
                <button class="accordion-btn">🧠 3. Manual da Classificação</button>
                <div class="accordion-panel"><p>Aqui você vê a tabela Série A/B, artilharia e assistências. Use o olho 👁️ para espionar o adversário.</p></div>
                <button class="accordion-btn">🛒 4. Mercado e Olheiros</button>
                <div class="accordion-panel"><p>Use tickets ganhos no X1 para enviar olheiros atrás de Lendas (2h custa 1M, 8h custa 500k).</p></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    let acc = modal.querySelectorAll(".accordion-btn");
    for (let i = 0; i < acc.length; i++) {
        acc[i].addEventListener("click", function() {
            this.classList.toggle("active");
            let panel = this.nextElementSibling;
            if (panel.style.maxHeight) panel.style.maxHeight = null;
            else panel.style.maxHeight = panel.scrollHeight + "px";
        });
    }
};