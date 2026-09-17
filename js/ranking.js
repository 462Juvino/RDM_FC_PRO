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
};

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
                let golsCamp = j.estatisticas.gols_campeonato ?? j.estatisticas.gols ?? 0;
                let astsCamp = j.estatisticas.assistencias_campeonato ?? j.estatisticas.assistencias ?? 0;
                let gcCamp = j.estatisticas.gols_sofridos_campeonato ?? j.estatisticas.gols_sofridos ?? 0;
                let jogosCamp = j.estatisticas.jogos_campeonato ?? j.estatisticas.jogos ?? 0;
                if(golsCamp>0 || astsCamp>0 || (j.posicoes && j.posicoes.p==="Goleiro" && jogosCamp>0)){
                    todos.push({
                        id: jId,
                        nome: j.nome.split(' ')[0],
                        nomeCompleto: j.nome,
                        time: t.replace(/_/g,' '),
                        timeId: t,
                        gols: golsCamp,
                        asts: astsCamp,
                        gc: gcCamp,
                        jogos: jogosCamp,
                        bonus: j.bonus_ranking||0,
                        isGoleiro: j.posicoes && j.posicoes.p==="Goleiro"
                    });
                }
            }
        }
    }
    function bonusLabel(b){ return b>0? `<span style="background:gold; color:#000; font-size:10px; padding:2px 4px; border-radius:3px; margin-left:5px;">+${b} OVR</span>` : ""; }
    function calcBonus(pos){ if(pos===0) return 5; if(pos===1) return 4; if(pos===2) return 3; if(pos===3) return 2; if(pos===4) return 1; if(pos<=9) return 1; return 0; }
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
    let gols = [...todos].filter(j=>j.isGoleiro && j.jogos>=3).sort((a,b)=>a.gc-b.gc).slice(0,10);
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

// Espião - reutiliza função do dashboard se não existir
if(!window.espionarAdversario){
    window.espionarAdversario = async function(timeAlvoId){
        // Redireciona para dashboard que já tem o modal completo
        localStorage.setItem('espionarAlvo', timeAlvoId);
        window.location.href = 'dashboard.html';
    };
}

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