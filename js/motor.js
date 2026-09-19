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

// ==========================================
// NOVO - FUNÇÕES COMPLEXAS V2 (FADIGA, TÁTICA, IA COMPETITIVA)
// ==========================================
function calcularForcaRealJogadorV2(j){
    let at = j.atributos||{ataque:5,defesa:5,forca:5,velocidade:5,habilidade:5};
    let base = (at.ataque+at.defesa+at.forca+at.velocidade+at.habilidade)/5;
    let fadiga = j.fadiga||0;
    let mult = 1 - (fadiga*0.006);
    if(mult<0.6) mult=0.6;
    return base*mult;
}
function calcularForcaTimeComplexaV2(titulares, mentalidade, estilo, moral, isMandante, ctAtivo, escudoAtivo, donoObj){
    let atk=0, def=0, meio=0;
    titulares.forEach(j=>{
        let at=j.atributos||{}; let fReal=calcularForcaRealJogadorV2(j); let pos=j.posicoes?.p||"Meia";
        if(["Atacante","Centroavante","Ponta"].includes(pos)) atk += (at.ataque*1.5+at.velocidade+at.habilidade)/3*(fReal/10);
        else if(["Zagueiro","Lateral","Goleiro"].includes(pos)) def += (at.defesa*1.5+at.forca+at.velocidade*0.5)/3*(fReal/10);
        else meio += (at.habilidade*1.2+at.ataque*0.8+at.defesa*0.8)/3*(fReal/10);
    });
    if(mentalidade==="Ofensivo"){ atk*=1.25; def*=0.85; } else if(mentalidade==="Defensivo"||mentalidade==="Retranca"){ atk*=0.85; def*=1.25; } else if(mentalidade==="Equilibrado"){ atk*=1.05; def*=1.05; }
    if(estilo==="Posse de Bola"){ meio*=1.3; atk*=1.1; } else if(estilo==="Contra-Ataque"){ atk*=1.2; def*=1.1; meio*=0.9; } else if(estilo==="Bola Longa"){ atk*=1.15; def*=1.05; }
    let multMoral = 0.7 + (moral/100)*0.6; atk*=multMoral; def*=multMoral; meio*=multMoral;
    if(isMandante){ atk*=1.10; def*=1.10; meio*=1.10; }
    if(ctAtivo){ atk*=1.05; def*=1.05; meio*=1.05; }
    if(escudoAtivo){ atk*=1.08; def*=1.08; }
    // ESCALAÇÃO ATÉ 18:59 -15%
    let multEscalacao = 1;
    if(donoObj &&!String(donoObj.timeAtual||'').startsWith('IA_')){
        let ultima = donoObj.ultima_escalacao_confirmada? new Date(donoObj.ultima_escalacao_confirmada) : null;
        let hoje = new Date();
        if(!ultima || ultima.toDateString()!== hoje.toDateString() || (ultima.getHours()+ultima.getMinutes()/60) >= 18.983){
            multEscalacao = 0.85;
        }
    }
    atk*=multEscalacao; def*=multEscalacao; meio*=multEscalacao;
    return {ataque:atk, defesa:def, meio:meio, total:atk+def+meio, penalidadeEscalacao: multEscalacao < 1};
}
function montarEscalacaoIAInteligenteV2(timeId, elencoObj){
    let elenco = Object.values(elencoObj||{}).map((j, idx)=> ({...j, id: Object.keys(elencoObj)[idx]}));
    if(elenco.length===0) return [];
    let goleiros = elenco.filter(j=> j.posicoes?.p==="Goleiro").sort((a,b)=> calcularForcaRealJogadorV2(b)-calcularForcaRealJogadorV2(a));
    let zagueiros = elenco.filter(j=> j.posicoes?.p==="Zagueiro").sort((a,b)=> calcularForcaRealJogadorV2(b)-calcularForcaRealJogadorV2(a));
    let laterais = elenco.filter(j=> j.posicoes?.p==="Lateral").sort((a,b)=> calcularForcaRealJogadorV2(b)-calcularForcaRealJogadorV2(a));
    let volantes = elenco.filter(j=> j.posicoes?.p==="Volante").sort((a,b)=> calcularForcaRealJogadorV2(b)-calcularForcaRealJogadorV2(a));
    let meias = elenco.filter(j=> j.posicoes?.p==="Meia").sort((a,b)=> calcularForcaRealJogadorV2(b)-calcularForcaRealJogadorV2(a));
    let atacantes = elenco.filter(j=> ["Atacante","Centroavante","Ponta"].includes(j.posicoes?.p)).sort((a,b)=> calcularForcaRealJogadorV2(b)-calcularForcaRealJogadorV2(a));
    let titulares = [];
    if(goleiros[0]) titulares.push(goleiros[0]);
    titulares.push(...zagueiros.slice(0,2));
    titulares.push(...laterais.slice(0,2));
    titulares.push(...volantes.slice(0,1));
    titulares.push(...meias.slice(0,2));
    titulares.push(...atacantes.slice(0,3));
    while(titulares.length<11){
        let restantes = elenco.filter(j=> !titulares.some(t=> t.id===j.id)).sort((a,b)=> calcularForcaRealJogadorV2(b)-calcularForcaRealJogadorV2(a));
        if(restantes[0]) titulares.push(restantes[0]); else break;
    }
    titulares = titulares.map(t=>{
        if((t.fadiga||0)>20){
            let pos = t.posicoes?.p;
            let reserva = elenco.filter(j=> j.posicoes?.p===pos && !titulares.some(tt=>tt.id===j.id) && (j.fadiga||0)<10).sort((a,b)=> calcularForcaRealJogadorV2(b)-calcularForcaRealJogadorV2(a))[0];
            if(reserva && calcularForcaRealJogadorV2(reserva) >= calcularForcaRealJogadorV2(t)*0.85){ return reserva; }
        }
        return t;
    });
    return titulares.slice(0,11);
}
function escolherGoleadorComplexoV2(titulares, tipoGol){
    let candidatos = titulares.filter(j=>!j.expulso);
    if(candidatos.length===0) return null;
    if(tipoGol==="penalti"){
        let ceni = candidatos.find(j=> j.nome.toLowerCase().includes("ceni"));
        if(ceni && Math.random()<0.3) return ceni;
    }
    candidatos = candidatos.filter(j=> j.posicoes?.p!=="Goleiro" || j.nome.toLowerCase().includes("ceni"));
    if(tipoGol.includes("cabecada")){
        let zagueiros = candidatos.filter(j=> ["Zagueiro","Volante","Centroavante"].includes(j.posicoes?.p));
        if(zagueiros.length>0 && Math.random()<0.6) return zagueiros[Math.floor(Math.random()*zagueiros.length)];
    }
    let pesos = candidatos.map(j=>{
        let pos=j.posicoes?.p||"Meia"; let peso=1;
        if(["Atacante","Centroavante","Ponta"].includes(pos)) peso=3;
        else if(["Meia"].includes(pos)) peso=1.8;
        else if(["Volante","Lateral"].includes(pos)) peso=0.8;
        else if(["Zagueiro"].includes(pos)) peso=0.5;
        peso *= (j.atributos?.ataque||5)/10 + (j.atributos?.habilidade||5)/20;
        return peso;
    });
    let total = pesos.reduce((a,b)=>a+b,0); let r=Math.random()*total;
    for(let i=0;i<candidatos.length;i++){ r-=pesos[i]; if(r<=0) return candidatos[i]; }
    return candidatos[0];
}
function gerarLinhaTempoComplexaV2(jogo, forcaM, forcaV, titularesM, titularesV){
    let linha=[]; let golsM=0, golsV=0;
    let climas=["☀️ Céu limpo","⛅ Nublado","🌧️ Chuva"];
    linha.push({minuto:0, tipo:"clima", texto:`🌤️ Clima: ${climas[Math.floor(Math.random()*climas.length)]}. Mando +10% para ${jogo.mandante.replace(/_/g,' ')}`});

    // Cartões tracking
    let amarelosM={}, amarelosV={}, expulsosM=[], expulsosV=[];
    const getMentalidade = (timeAt)=>{
        // tenta pegar do dono real
        try{
            let usuarios = JSON.parse(localStorage.getItem('cache_usuarios')||'{}');
            // fallback usa forca.mentalidade se vier do motor
            return timeAt==="M"? (forcaM.mentalidade||"Moderado") : (forcaV.mentalidade||"Moderado");
        }catch(e){ return "Moderado"; }
    };
    const pesoCartaoPorMentalidade = (ment)=>{
        if(ment==="Retranca"||ment==="Retranca Total") return 0.18; // muito faltoso
        if(ment==="Ofensivo"||ment==="Ultra Ofensiva") return 0.08; // menos faltoso, mais técnico
        return 0.11; // Moderado/Equilibrado
    };
    const mentM = forcaM.mentalidade||"Moderado";
    const mentV = forcaV.mentalidade||"Moderado";

    let minuto=1;
    while(minuto<=90){
        if(Math.random()<0.32){
            let ftM = forcaM.meio+forcaM.ataque; let ftV = forcaV.meio+forcaV.ataque;
            let timeAt = Math.random() < ftM/(ftM+ftV)? "M" : "V";
            let timeDef = timeAt==="M"? "V" : "M";
            let titulares = timeAt==="M"? titularesM : titularesV;
            let titularesDef = timeAt==="M"? titularesV : titularesM;
            let timeNome = timeAt==="M"? jogo.mandante.replace(/_/g,' ') : jogo.visitante.replace(/_/g,' ');
            let timeDefNome = timeDef==="M"? jogo.mandante.replace(/_/g,' ') : jogo.visitante.replace(/_/g,' ');
            // filtra expulsos
            titulares = titulares.filter(j=>!j.expulso &&!expulsosM.includes(j.nome) &&!expulsosV.includes(j.nome));
            titularesDef = titularesDef.filter(j=>!j.expulso);
            if(titulares.length===0){ minuto++; continue; }
            let jogador = titulares[Math.floor(Math.random()*titulares.length)];
            let defensor = titularesDef[Math.floor(Math.random()*titularesDef.length)] || {nome:"zagueiro"};

            let roll=Math.random();
            // Chance gol 5% base, ofensiva aumenta um pouco
            let chanceGol = 0.05;
            if((timeAt==="M" && mentM.includes("Ofens")) || (timeAt==="V" && mentV.includes("Ofens"))) chanceGol=0.07;
            if((timeAt==="M" && mentM.includes("Retranca")) || (timeAt==="V" && mentV.includes("Retranca"))) chanceGol=0.035;

            if(roll<chanceGol){
                let tipoGol = Math.random()<0.2? "cabecada_escanteio" : (Math.random()<0.15? "penalti" : "normal");
                let goleador = escolherGoleadorComplexoV2(titulares, tipoGol);
                if(!goleador){ minuto++; continue; }
                if(tipoGol==="penalti") linha.push({minuto, tipo: timeAt==="M"?"gol_mandante":"gol_visitante", texto:`⚽ GOOOL! ${goleador.nome} (${timeNome}) cobra pênalti e marca!`, jogador:goleador.nome});
                else if(tipoGol.includes("cabecada")) linha.push({minuto, tipo: timeAt==="M"?"gol_mandante":"gol_visitante", texto:`⚽ GOOOL DE CABEÇA! ${goleador.nome} (${timeNome}) sobe mais que a zaga!`, jogador:goleador.nome});
                else linha.push({minuto, tipo: timeAt==="M"?"gol_mandante":"gol_visitante", texto:`⚽ GOOOL DO ${timeNome}! ${goleador.nome} balança as redes!`, jogador:goleador.nome});
                if(timeAt==="M") golsM++; else golsV++;
            } else {
                // FALTA / CARTÃO por mentalidade
                let probCartao = timeAt==="M"? pesoCartaoPorMentalidade(mentV) : pesoCartaoPorMentalidade(mentM); // quem DEFENDE faz falta
                // Retranca faz mais falta, Ofensivo sofre mais falta
                if(Math.random() < probCartao){
                    let amarelados = timeDef==="M"? amarelosM : amarelosV;
                    let expulsos = timeDef==="M"? expulsosM : expulsosV;
                    let qtdAmarelo = amarelados[defensor.nome]||0;
                    if(qtdAmarelo>=1 && Math.random()<0.6){
                        // segundo amarelo = vermelho
                        linha.push({minuto, tipo:"cartao_vermelho", texto:`🟥 VERMELHO! Segundo amarelo! ${defensor.nome} (${timeDefNome}) está EXPULSO! Falta dura em ${jogador.nome}!`, jogador:defensor.nome, time: timeDef});
                        expulsos.push(defensor.nome);
                        defensor.expulso=true;
                    } else if(Math.random()<0.12){
                        // vermelho direto
                        linha.push({minuto, tipo:"cartao_vermelho", texto:`🟥 VERMELHO DIRETO! ${defensor.nome} (${timeDefNome}) faz falta criminosa em ${jogador.nome}!`, jogador:defensor.nome, time: timeDef});
                        expulsos.push(defensor.nome);
                        defensor.expulso=true;
                    } else {
                        amarelados[defensor.nome]= (amarelados[defensor.nome]||0)+1;
                        linha.push({minuto, tipo:"cartao_amarelo", texto:`🟨 CARTÃO AMARELO! ${defensor.nome} (${timeDefNome}) chega atrasado em ${jogador.nome}!`, jogador:defensor.nome, time: timeDef});
                    }
                } else {
                    let tipos=["posse","chute_fora","escanteio","falta","cabecada","defesa","contra_ataque","desarme","impedimento","cruzamento","falta_perigosa"];
                    if(minuto>60) tipos.push("substituicao");
                    let tipo=tipos[Math.floor(Math.random()*tipos.length)];
                    let txt = "";
                    if(tipo==="falta") txt = `🚩 Falta de ${defensor.nome} (${timeDefNome}) em ${jogador.nome}!`;
                    else if(tipo==="falta_perigosa") txt = `⚠️ Falta perigosa! ${defensor.nome} (${timeDefNome}) derruba ${jogador.nome} na entrada da área!`;
                    else if(tipo==="substituicao" && minuto>60) txt = `🔄 Substituição no ${timeNome}: sai ${jogador.nome}, entra um reserva para dar gás!`;
                    else txt = `${tipo.toUpperCase()} - ${jogador.nome} (${timeNome}) tenta contra ${defensor.nome}`;
                    linha.push({minuto, tipo, texto: txt});
                }
            }
        }
        minuto+=Math.floor(Math.random()*4)+1;
    }
    linha.push({minuto:45, tipo:'intervalo', texto:`⏱️ Intervalo: ${golsM} x ${golsV}`});
    linha.push({minuto:46, tipo:'inicio', texto:`🟢 Segundo tempo!`});
    linha.push({minuto:94, tipo:'fim', texto:`🏁 Final: ${jogo.mandante.replace(/_/g,' ')} ${golsM} x ${golsV} ${jogo.visitante.replace(/_/g,' ')}`});
    linha.sort((a,b)=>a.minuto-b.minuto);
    return {linha, golsM, golsV};
}
function aplicarFadigaMotorV2(timeId, titulares, times, updates){
    let elenco = times[timeId]?.jogadores||{};
    for(let id in elenco){
        let j=elenco[id];
        let ehTitular = titulares.some(t=> t.id===id || t.nome===j.nome);
        let seq = j.jogos_seguidos||0;
        let novaFadiga = j.fadiga||0;
        if(ehTitular){
            seq += 1;
            let add = 0;
            if(seq<=2) add = 0;
            else if(seq===3) add = 0.5;
            else add = 1;
            novaFadiga += add;
            if(novaFadiga>25) novaFadiga=25;
            updates[`banco_global_times/${timeId}/jogadores/${id}/jogos_seguidos`]=seq;
        } else {
            seq = 0;
            novaFadiga -= 1.5;
            if(novaFadiga<0) novaFadiga=0;
            updates[`banco_global_times/${timeId}/jogadores/${id}/jogos_seguidos`]=seq;
        }
        updates[`banco_global_times/${timeId}/jogadores/${id}/fadiga`]=novaFadiga;
    }
}

function iniciarMotorDescentralizado(liga) {
    // 🟢 DESTRAVA O SISTEMA: Quebra o cadeado de segurança no Firebase caso o motor tenha travado em erros anteriores!
    db.ref(`ligas/${liga}/sistema/lock_simulacao`).set(false).then(() => {
        checarRotinas(liga);
        setInterval(() => checarRotinas(liga), 180000); // Checa a cada 3 minutos
    });
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

        // Separa as checagens: A liga tem que rodar as 19h e a Copa às 20h!
        let ultCamp = sis.ultima_simulacao_camp;
        let ultCopa = sis.ultima_simulacao_copa;
        let ultMoral = sis.ultima_queda_moral; // 🟢 NOVO: Checagem da Moral

        let rodarCampHoje = (hora >= HORA_CAMP && ultCamp!== dataAtualStr);
        let rodarCopaHoje = (hora >= HORA_COPA && ultCopa!== dataAtualStr);
        let rodarQuedaMoral = (hora >= 6 && ultMoral!== dataAtualStr);

        // TRATOR: Verifica se tem jogo com data <= hoje que não foi jogado e já passou das 20h
        let rodarAtrasados = (!ultCamp || ultCamp < ontemStr);
        if(!rodarAtrasados && hora >= 20){
            try{
                let snapCalCheck = await db.ref(`ligas/${liga}/calendario`).once('value');
                let calCheck = snapCalCheck.val();
                if(calCheck){
                    let hoje = new Date(); hoje.setHours(0,0,0,0);
                    let temAtrasado = false;
                    let checarDiv = (divObj)=>{
                        if(!divObj) return;
                        for(let chave in divObj){
                            for(let jId in divObj[chave]){
                                let j = divObj[chave][jId];
                                if(j.jogado) continue;
                                if(j.data_jogo){
                                    let [d, m] = j.data_jogo.split(' ')[0].split('/');
                                    let dtJogo = new Date(hoje.getFullYear(), parseInt(m)-1, parseInt(d));
                                    dtJogo.setHours(0,0,0,0);
                                    if(dtJogo <= hoje){ temAtrasado = true; break; }
                                }
                            }
                            if(temAtrasado) break;
                        }
                    };
                    checarDiv(calCheck.serieA);
                    checarDiv(calCheck.serieB);
                    if(calCheck.copa) checarDiv(calCheck.copa);
                    if(temAtrasado) rodarAtrasados = true;
                }
            }catch(e){ console.warn('Erro checagem atrasados', e); }
        }

        // 🔍 JANELAS CRUZADAS 12-13 -> 19-20 e 19-20 -> 12-13
        const snapPropostas = await db.ref(`ligas/${liga}/mercado_propostas`).once('value');
        const propostasPendentes = snapPropostas.val() || {};
        let temMercadoPendente = false;
        let propostasParaProcessar = {};
        const agoraCheck = new Date();
        const horaCheck = agoraCheck.getHours();
        const isJanela12 = horaCheck >= 12 && horaCheck < 13;
        const isJanela19 = horaCheck >= 19 && horaCheck < 20;
        if ((isJanela12 || isJanela19) && Object.keys(propostasPendentes).length > 0) {
            for (let idJog in propostasPendentes) {
                let lances = propostasPendentes[idJog];
                for (let loginComprador in lances) {
                    let lance = lances[loginComprador];
                    if (!lance.data_proposta) continue;
                    let dataProp = new Date(lance.data_proposta);
                    let hProp = dataProp.getHours();
                    let origemManha = hProp >= 12 && hProp < 13;
                    let origemNoite = hProp >= 19 && hProp < 20;
                    let isHoje = dataProp.getDate() === agoraCheck.getDate() && dataProp.getMonth() === agoraCheck.getMonth() && dataProp.getFullYear() === agoraCheck.getFullYear();
                    let ontem = new Date(agoraCheck); ontem.setDate(ontem.getDate()-1);
                    let isOntem = dataProp.getDate() === ontem.getDate() && dataProp.getMonth() === ontem.getMonth() && dataProp.getFullYear() === ontem.getFullYear();
                    if (isJanela12 && origemNoite && isOntem) { temMercadoPendente = true; propostasParaProcessar[idJog] = true; }
                    if (isJanela19 && origemManha && isHoje) { temMercadoPendente = true; propostasParaProcessar[idJog] = true; }
                }
            }
        }
        window._propostasParaProcessar = propostasParaProcessar;

        // Se já rodou tudo na hora certa, ele descansa.
        if (!rodarCampHoje && !rodarCopaHoje && !rodarAtrasados && !temMercadoPendente && !rodarQuedaMoral) return;

        const lockRef = db.ref(`ligas/${liga}/sistema/lock_simulacao`);
        lockRef.transaction((currentLock) => {
            if (currentLock === true) return;
            return true;
        }, (error, committed) => {
            if (committed) {
                console.log("🔥 MOTOR P2P: Iniciando varredura Oficial!");
                // Aqui nós CHAMAMOS a função, e não criamos ela!
                processarTudo(liga, dataAtualStr, ontemStr, lockRef, rodarCampHoje, rodarCopaHoje, rodarAtrasados, rodarQuedaMoral);
            }
        });
    } catch (e) { console.error("Falha no Motor P2P:", e); }
}

// A função que faz a mágica acontecer!
async function processarTudo(liga, dataAtualStr, ontemStr, lockRef, rodarCampHoje, rodarCopaHoje, rodarAtrasados, rodarQuedaMoral) {
    try {
        const snapTimesGlobais = await db.ref('banco_global_times').once('value');
        const times = snapTimesGlobais.val() || {};

        // 🔍 AUDITOR AUTOMÁTICO - restaura quem sumiu + quem tá com SEM indevido
        try{
            const snapBackup = await db.ref('banco_original_backup').once('value');
            const baseADM = snapBackup.val() || null;
            if(baseADM){
                let todosIds = {};
                for(let t in times){
                    if(t==='Fantasma') continue;
                    for(let id in (times[t].jogadores||{})) todosIds[id]=t;
                }
                let fix = {};
                let qtd = 0;
                // 1 - Quem sumiu de tudo
                for(let timeOrig in baseADM){
                    if(timeOrig.startsWith('Agentes_Livres')||timeOrig==='Fantasma'||timeOrig==='Lendas_Futebol') continue;
                    let elenco = baseADM[timeOrig].jogadores || baseADM[timeOrig];
                    for(let idJog in elenco){
                        let dados = elenco[idJog];
                        if(!dados?.nome) continue;
                        if(!todosIds[idJog]){
                            fix[`banco_global_times/${timeOrig}/jogadores/${idJog}`] = dados;
                            qtd++;
                        }
                    }
                }
                // 2 - Quem tá em Agentes Livres com SEM mas NÃO é do Banco (tem que voltar pro time original)
                let chaveLivres = `Agentes_Livres_${liga}`;
                let livres = times[chaveLivres] && times[chaveLivres].jogadores? times[chaveLivres].jogadores : {};
                for(let idLivre in livres){
                    let j = livres[idLivre];
                    if(j.origem_banco || j.clube_banco) continue; // é penhora do Banco, deixa com dono Banco
                    // Acha time original no backup
                    let timeOriginal = null;
                    let dadosOriginais = null;
                    for(let tOrig in baseADM){
                        if(tOrig.startsWith('Agentes_Livres')||tOrig==='Fantasma'||tOrig==='Lendas_Futebol') continue;
                        let elenco = baseADM[tOrig].jogadores || baseADM[tOrig];
                        if(elenco[idLivre]){ timeOriginal = tOrig; dadosOriginais = elenco[idLivre]; break; }
                    }
                    if(timeOriginal && dadosOriginais){
                        fix[`banco_global_times/${chaveLivres}/jogadores/${idLivre}`] = null;
                        fix[`banco_global_times/${timeOriginal}/jogadores/${idLivre}`] = dadosOriginais;
                        qtd++;
                    }
                }
                if(qtd>0){
                    console.log(`♻️ AUDITOR: ${qtd} restaurados (sumidos + SEM)`);
                    await db.ref().update(fix);
                    for(let p in fix){
                        if(fix[p]===null) continue;
                        let t = p.split('/')[1]; let id = p.split('/')[3];
                        if(!times[t]) times[t]={jogadores:{}};
                        if(!times[t].jogadores) times[t].jogadores={};
                        times[t].jogadores[id]=fix[p];
                    }
                    // Limpa nulls dos livres
                    for(let p in fix){
                        if(fix[p]===null){
                            let t = p.split('/')[1]; let id = p.split('/')[3];
                            if(times[t] && times[t].jogadores) delete times[t].jogadores[id];
                        }
                    }
                }
            }
        }catch(e){ console.warn('Auditor falhou', e); }

        const snapUsuarios = await db.ref(`ligas/${liga}/usuarios`).once('value');
        const usuarios = snapUsuarios.val() || {};

        const snapCal = await db.ref(`ligas/${liga}/calendario`).once('value');
        const cal = snapCal.val();

        // 🟢 BUSCA AS PROPOSTAS NA NUVEM ANTES DE AVALIÁ-LAS! (Isso corrige o Crash)
        const snapPropostas = await db.ref(`ligas/${liga}/mercado_propostas`).once('value');
        let propostas = snapPropostas.val() || {};

        let updates = {};



        // ============================================
        // --- PASSO A.0: IA ATIVA NO MERCADO E FINANÇAS ---
        // ============================================
        let timesHumanos = Object.values(usuarios).map(u => u.timeAtual).filter(t => t && t !== "Sem Clube");
        let timesIA = Object.keys(times).filter(t => !t.startsWith("Agentes_Livres") && t !== "Fantasma" && !timesHumanos.includes(t));

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
                    let parcela = Math.round((valorPedido * 1.5) / rodadas); // O Banco cobra 50% de juros da IA

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
                        // IA não tenta comprar do próprio time nem varre os Agentes Livres (ainda)
                        if (outroT !== t && times[outroT].jogadores && !outroT.startsWith("Agentes_Livres")) {
                            for (let idJog in times[outroT].jogadores) {
                                todosAlvos.push({ id: idJog, time: outroT, dados: times[outroT].jogadores[idJog] });
                            }
                        }
                    }

                    if (todosAlvos.length > 0) {
                        // A máquina procura jogadores que não quebrem o cofre (Custa no máximo 70% do que ela tem)
                        let alvosBons = todosAlvos.filter(x => x.dados.valor_mercado > 1000000 && x.dados.valor_mercado <= (caixaClubeIA * 0.7));

                        if (alvosBons.length > 0) {
                            let alvo = alvosBons[Math.floor(Math.random() * alvosBons.length)];
                            let isCompra = Math.random() < 0.7; // 70% de chance de tentar Comprar Definitivo

                            // Oferece 5% a mais do passe na compra, ou paga as 10 rodadas justas no aluguel
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

                            // Registra a proposta na mesa do leilão!
                            updates[`ligas/${liga}/mercado_propostas/${alvo.id}/${loginIA}`] = propostas[alvo.id][loginIA];
                        }
                    }
                }

                // AÇÃO 3: Virar Investidor Agiota (Se estiver super rica > 40M)
                else if (caixaClubeIA > 40000000 && Math.random() < 0.2) {
                    const snapBanc = await db.ref(`ligas/${liga}/banco_investidores/${t}`).once('value');
                    let invAtual = snapBanc.val() ? snapBanc.val().saldo : 0;

                    let valorInvestido = 10000000; // Guarda 10 Milhões no banco para players pegarem!
                    caixaClubeIA -= valorInvestido;
                    usuarios[loginIA].caixaClube = caixaClubeIA;
                    updates[`ligas/${liga}/usuarios/${loginIA}/caixaClube`] = caixaClubeIA;

                    updates[`ligas/${liga}/banco_investidores/${t}`] = {
                        saldo: invAtual + valorInvestido, dono_login: loginIA, is_ia: true
                    };
                }
            }
        }

        // ============================================
        // --- PASSO A.1: IA GERENCIA AGENTES LIVRES (NOVO) ---
        // ============================================
        // IA coloca jogadores excedentes nos Agentes Livres com 20% desconto
        for(let t of timesIA){
            let elenco = times[t]?.jogadores||{};
            let qtd = Object.keys(elenco).length;
            if(qtd > 25){
                // Pega os 3 piores com fadiga alta ou OVR baixo
                let piores = Object.keys(elenco).map(id=> ({id,...elenco[id]}))
                  .filter(j=> j && j.atributos)
                  .sort((a,b)=>{
                        let fadA = a.fadiga||0, fadB = b.fadiga||0;
                        let atA = a.atributos||{ataque:5,defesa:5,forca:5,velocidade:5,habilidade:5};
                        let atB = b.atributos||{ataque:5,defesa:5,forca:5,velocidade:5,habilidade:5};
                        let ovrA = (atA.ataque+atA.defesa+atA.forca+atA.velocidade+atA.habilidade);
                        let ovrB = (atB.ataque+atB.defesa+atB.forca+atB.velocidade+atB.habilidade);
                        return (ovrA - fadA*10) - (ovrB - fadB*10);
                    }).slice(0,2);

                for(let p of piores){
                    if(Math.random()<0.5){
                        let valorDesconto = Math.round((p.valor_mercado||1000000)*0.8);
                        let jogadorLivre = {...p, valor_mercado: valorDesconto, time_origem: t, origem_livre: `IA_${t}`, data_entrada_livre: new Date().toISOString()};
                        delete jogadorLivre.id;
                        updates[`banco_global_times/${t}/jogadores/${p.id}`] = null;
                        updates[`banco_global_times/Agentes_Livres_${liga}/jogadores/${p.id}`] = jogadorLivre;
                        updates[`banco_global_times/Agentes_Livres_${liga}/divisao`] = "Livre";
                    }
                }
            }
        }

        // 🔍 AUDITOR ADM - Restaura jogadores sumidos
        try{
          if(window.BANCO_ADM){
            let jogadoresNoBanco = {};
            for(let t in times){
              if(t==='Fantasma') continue;
              for(let id in (times[t].jogadores||{})) jogadoresNoBanco[id]=t;
            }
            for(let timeOrig in window.BANCO_ADM){
              if(timeOrig.startsWith('Agentes_Livres')||timeOrig==='Fantasma') continue;
              let elencoADM = window.BANCO_ADM[timeOrig].jogadores || window.BANCO_ADM[timeOrig];
              for(let idJog in elencoADM){
                let dados = elencoADM[idJog];
                if(!dados?.nome) continue;
                if(!jogadoresNoBanco[idJog]){
                  console.log(`♻️ Auditor: ${dados.nome} sumiu, voltando pra ${timeOrig}`);
                  updates[`banco_global_times/${timeOrig}/jogadores/${idJog}`] = dados;
                }
              }
            }
          }
        }catch(e){ console.warn('Auditor falhou', e); }

        // IA tenta comprar dos Agentes Livres com 50% do valor
        let snapLivres = await db.ref(`banco_global_times/Agentes_Livres_${liga}/jogadores`).once('value');
        let livres = snapLivres.val()||{};
        for(let idLivre in livres){
            let jLivre = livres[idLivre];
            if(jLivre.origem_livre && jLivre.origem_livre.startsWith("IA_")) continue; // IA não compra dela mesma
            if(Math.random()<0.15){ // 15% chance de IA tentar comprar cada livre por rodada
                let timeIALogin = `IA_${timesIA[Math.floor(Math.random()*timesIA.length)]}`;
                let timeIA = usuarios[timeIALogin]?.timeAtual;
                if(!timeIA) continue;
                let oferta50 = Math.round((jLivre.valor_mercado||0)*0.5);
                let jaTemProposta = propostas[idLivre] && propostas[idLivre][timeIALogin];
                if(!jaTemProposta){
                    if(!propostas[idLivre]) propostas[idLivre] = {};
                    propostas[idLivre][timeIALogin] = {
                        time_comprador: timeIA,
                        valor_oferecido: oferta50,
                        data_proposta: new Date().toISOString(),
                        tipo_negocio: 'compra',
                        is_agentes_livres: true,
                        valor_original_mercado: jLivre.valor_mercado
                    };
                    updates[`ligas/${liga}/mercado_propostas/${idLivre}/${timeIALogin}`] = propostas[idLivre][timeIALogin];
                }
            }
        }

        let transferenciasRealizadas = 0;

        // Se o mercado tiver propostas de Humanos ou IAs, resolve a briga
        if (Object.keys(propostas).length > 0) {

            // Variáveis de Relógio Globais da Rodada de Mercado
            let horaExecucao = new Date().getHours();
            let dataExecucaoFormatada = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;

            for (let idAlvo in propostas) {
                if (window._propostasParaProcessar && Object.keys(window._propostasParaProcessar).length > 0) {
                    if (!window._propostasParaProcessar[idAlvo]) continue;
                }
                let lances = propostas[idAlvo];
                let timeDoAlvo = null;
                let dadosDoAlvo = null;

                for (let t in times) {
                    if (times[t].jogadores && times[t].jogadores[idAlvo]) {
                        timeDoAlvo = t;
                        dadosDoAlvo = times[t].jogadores[idAlvo];
                        break;
                    }
                }

                if (!dadosDoAlvo || !timeDoAlvo) {
                    // 🟢 APAGA CIRURGICAMENTE: Evita o erro 'Ancestor' no Firebase
                    Object.keys(lances).forEach(l => updates[`ligas/${liga}/mercado_propostas/${idAlvo}/${l}`] = null);
                    continue;
                }

                // ============================================
                // ⏰ REGRA DE GATILHO (AVALIAÇÃO DA DATA/HORA)
                // ============================================
                let arrayDeLances = Object.values(lances);
                if (arrayDeLances.length === 0) {
                    Object.keys(lances).forEach(l => updates[`ligas/${liga}/mercado_propostas/${idAlvo}/${l}`] = null);
                    continue;
                }

                let dataLanceISO = arrayDeLances[0].data_proposta;
                let isVelho = true;

                if (dataLanceISO) {
                    let d = new Date(dataLanceISO);
                    let dataLanceStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
                    if (dataLanceStr === dataExecucaoFormatada) {
                        isVelho = false; // Foi feito HOJE
                    }
                }

                // 🚦 LÓGICA DE BARREIRA: Se a proposta é de hoje e AINDA NÃO SÃO 19h (e não foi forçado o trator), DEIXA NA MESA!
                if (!isVelho && horaExecucao < HORA_CAMP && !rodarAtrasados) {
                    console.log(`⏳ A proposta por ${dadosDoAlvo.nome} ainda está no prazo. Aguardando 19h.`);
                    continue;
                }

                // ============================================
                // 🛡️ O DONO DO CLUBE É HUMANO OU IA?
                // ============================================
                let isDonoHumano = false;
                for (let u in usuarios) {
                    // 🟢 CORREÇÃO: Garante que a conta tem "timeAtual", bate com o alvo e NÃO começa com 'IA_'
                    if (usuarios[u].timeAtual === timeDoAlvo && !u.startsWith('IA_')) {
                        isDonoHumano = true;
                        break;
                    }
                }

                // Se o dono for HUMANO REAL e o tempo acabou (19h), a proposta expira sem resolução.
                if (isDonoHumano) {
                    for (let login in lances) {
                        if (!login.startsWith('IA_')) {
                            let rnd = Math.floor(Math.random()*1000);
                            updates[`ligas/${liga}/caixa_mensagens/${login}/msg_expirou_${Date.now()}_${rnd}`] = {
                                tipo: 'recusa',
                                texto: `Sua oferta por ${dadosDoAlvo.nome} EXPIROU. O treinador do ${timeDoAlvo.replace(/_/g,' ')} não abriu a mesa de negociação a tempo.`,
                                data: new Date().toISOString()
                            };
                        }
                    }
                    Object.keys(lances).forEach(l => updates[`ligas/${liga}/mercado_propostas/${idAlvo}/${l}`] = null);
                    continue; // 🚨 PULA! (Não entra no leilão da IA)
                }

                // 🚨 SE CHEGOU AQUI: O dono é a MÁQUINA (IA) e ela VAI resolver a parada!

                // ============================================
                // 🤖 IA AVALIANDO AS PROPOSTAS (A BRIGA)
                // ============================================
                let maiorScore = 0;
                let lanceVencedor = null;
                let loginVencedor = "";

                // Verifica se é Agentes Livres
                let isAgentesLivres = timeDoAlvo && timeDoAlvo.includes("Agentes_Livres");

                // Verifica se o jogador alvo é intocável (Top 5 Força do clube da IA) - só vale se NÃO for Agentes Livres
                let elencoOVRList = Object.values(times[timeDoAlvo]?.jogadores || {}).map(j => {
                    let at = j.atributos || {ataque:0, defesa:0, forca:0, velocidade:0, habilidade:0};
                    return { nome: j.nome, ovr: at.ataque + at.defesa + at.forca + at.velocidade + at.habilidade };
                });

                elencoOVRList.sort((a,b) => b.ovr - a.ovr);

                let isTop5 = false;
                if(!isAgentesLivres){
                    for (let idx = 0; idx < Math.min(5, elencoOVRList.length); idx++) {
                        if (elencoOVRList[idx].nome === dadosDoAlvo.nome) {
                            isTop5 = true; break;
                        }
                    }
                }

                let precoMercado = dadosDoAlvo.valor_mercado || 1000000;
                let precoMinimoAceitavel = isAgentesLivres? (precoMercado * 0.5) : (isTop5? (precoMercado * 2) : (precoMercado * 0.95));

                for (let login in lances) {
                    let lance = lances[login];
                    let scoreLance = lance.valor_oferecido || 0;
                    let ehContra = lance.tipo_negocio === 'contraproposta' || lance.is_contra;

                    // REGRA NOVA AGENTES LIVRES - CONTRA-PROPOSTA 80%
                    if(isAgentesLivres && ehContra){
                        if(scoreLance > precoMercado * 0.8){
                            // Mais que 80% - IA recusa e finaliza
                            for(let l in lances){
                                if(!l.startsWith('IA_')){
                                    updates[`ligas/${liga}/caixa_mensagens/${l}/msg_recusa_${Date.now()}_${Math.floor(Math.random()*1000)}`] = {
                                        tipo: 'recusa',
                                        texto: `❌ IA do ${timeDoAlvo.replace(/_/g,' ')} RECUSOU sua contra-proposta de ${formatarDinheiro(scoreLance)} por ${dadosDoAlvo.nome}. Você pediu mais que 80% do valor (${formatarDinheiro(precoMercado*0.8)}). Negociação finalizada.`,
                                        data: new Date().toISOString()
                                    };
                                }
                            }
                            Object.keys(lances).forEach(l=> updates[`ligas/${liga}/mercado_propostas/${idAlvo}/${l}`] = null);
                            lanceVencedor = null;
                            break;
                        } else {
                            // Até 80% - IA aceita
                            if(scoreLance > maiorScore){
                                maiorScore = scoreLance;
                                lanceVencedor = lance;
                                loginVencedor = login;
                            }
                            continue;
                        }
                    }

                    if (lance.tipo_negocio === 'emprestimo') {
                        if (isTop5) continue;

                        let taxaIdeal = (precoMercado * 0.015) * (lance.duracao_rodadas || 5);
                        if (scoreLance >= taxaIdeal && scoreLance > maiorScore) {
                            maiorScore = scoreLance;
                            lanceVencedor = lance;
                            loginVencedor = login;
                        }
                    } else {
                        let dadosJogTroca = null;
                        if (lance.id_jogador_oferecido) {
                            dadosJogTroca = times[lance.time_comprador]?.jogadores?.[lance.id_jogador_oferecido];
                            if (dadosJogTroca) scoreLance += (dadosJogTroca.valor_mercado || 0);
                        }

                        if (scoreLance > maiorScore && scoreLance >= precoMinimoAceitavel) {
                            maiorScore = scoreLance;
                            lanceVencedor = lance;
                            loginVencedor = login;
                            lanceVencedor.dados_jogador_oferecido = dadosJogTroca;
                        }
                    }
                }

                // ============================================
                // 🏆 RESOLVE A NEGOCIAÇÃO E NOTIFICA O POVO
                // ============================================
                if (lanceVencedor && usuarios[loginVencedor] && (usuarios[loginVencedor].caixaClube || 0) >= lanceVencedor.valor_oferecido) {

                    let timeQueComprou = lanceVencedor.time_comprador;
                    transferenciasRealizadas++;

                    // 1. Tira do Caixa do Comprador
                    usuarios[loginVencedor].caixaClube -= lanceVencedor.valor_oferecido;
                    updates[`ligas/${liga}/usuarios/${loginVencedor}/caixaClube`] = usuarios[loginVencedor].caixaClube;

                    // 2. Paga o vendedor - Se for Agentes Livres, paga quem colocou lá
                    if(isAgentesLivres && dadosDoAlvo.origem_livre){
                        let loginOrigem = dadosDoAlvo.origem_livre;
                        if(usuarios[loginOrigem]){
                            usuarios[loginOrigem].caixaClube = (usuarios[loginOrigem].caixaClube||0) + lanceVencedor.valor_oferecido;
                            updates[`ligas/${liga}/usuarios/${loginOrigem}/caixaClube`] = usuarios[loginOrigem].caixaClube;
                        }
                    } else {
                        let loginIAVendedora = `IA_${timeDoAlvo}`;
                        if (usuarios[loginIAVendedora]) {
                            usuarios[loginIAVendedora].caixaClube += lanceVencedor.valor_oferecido;
                            updates[`ligas/${liga}/usuarios/${loginIAVendedora}/caixaClube`] = usuarios[loginIAVendedora].caixaClube;
                        }
                    }

                    // 3. Papelada dos Jogadores
                    if (lanceVencedor.tipo_negocio === 'emprestimo') {
                        dadosDoAlvo.status_emprestimo = { time_origem: timeDoAlvo, rodadas_restantes: lanceVencedor.duracao_rodadas };
                        updates[`banco_global_times/${timeDoAlvo}/jogadores/${idAlvo}`] = null;
                        updates[`banco_global_times/${timeQueComprou}/jogadores/${idAlvo}`] = dadosDoAlvo;
                        updates[`ligas/${liga}/emprestimos_ativos/${idAlvo}`] = { jogador_id: idAlvo, time_origem: timeDoAlvo, time_destino: timeQueComprou, rodadas_restantes: lanceVencedor.duracao_rodadas };
                    } else {
                        // Venda definitiva - CORRIGIDO: remove de TODOS os times antes de adicionar e limpa trava de livres
                        for(let tCheck in times){
                            if(times[tCheck].jogadores && times[tCheck].jogadores[idAlvo]){
                                updates[`banco_global_times/${tCheck}/jogadores/${idAlvo}`] = null;
                            }
                        }
                        // Limpa campos de Agentes Livres pra não travar na escalação
                        let jogadorLimpo = {...dadosDoAlvo};
                        delete jogadorLimpo.origem_livre;
                        delete jogadorLimpo.time_origem;
                        delete jogadorLimpo.origem_olheiro;
                        delete jogadorLimpo.data_entrada_livre;
                        delete jogadorLimpo.data_descoberta;
                        updates[`banco_global_times/${timeQueComprou}/jogadores/${idAlvo}`] = jogadorLimpo;
                        // Limpa todas as propostas deste jogador
                        Object.keys(lances).forEach(l=> updates[`ligas/${liga}/mercado_propostas/${idAlvo}/${l}`] = null);

                        // Executa a Troca se houver o jogador na mala
                        if (lanceVencedor.id_jogador_oferecido && lanceVencedor.dados_jogador_oferecido) {
                            updates[`banco_global_times/${timeQueComprou}/jogadores/${lanceVencedor.id_jogador_oferecido}`] = null;
                            updates[`banco_global_times/${timeDoAlvo}/jogadores/${lanceVencedor.id_jogador_oferecido}`] = lanceVencedor.dados_jogador_oferecido;
                        }
                    }

                    // Manda Carta de Vitória
                    if (!loginVencedor.startsWith('IA_')) {
                        updates[`ligas/${liga}/caixa_mensagens/${loginVencedor}/msg_compra_${Date.now()}`] = {
                            tipo: 'sucesso',
                            texto: `A diretoria do ${timeDoAlvo.replace(/_/g,' ')} ACEITOU sua oferta. ${dadosDoAlvo.nome} se juntou ao elenco!`,
                            data: new Date().toISOString()
                        };
                    }

                    // 📜 HISTÓRICO - REGISTRA TRANSFERÊNCIA
                    updates[`ligas/${liga}/historico_transferencias/${Date.now()}_${Math.floor(Math.random()*1000)}`] = {
                        jogador_nome: dadosDoAlvo.nome,
                        jogador_id: idAlvo,
                        time_origem: timeDoAlvo,
                        time_destino: timeQueComprou,
                        valor: lanceVencedor.valor_oferecido,
                        tipo: lanceVencedor.tipo_negocio || 'compra',
                        data: new Date().toISOString()
                    };

                    // Manda Carta de Derrota pra quem perdeu
                    for (let login in lances) {
                        if (login !== loginVencedor && !login.startsWith('IA_')) {
                            updates[`ligas/${liga}/caixa_mensagens/${login}/msg_perda_${Date.now()}_${Math.floor(Math.random()*1000)}`] = {
                                tipo: 'recusa',
                                texto: `Você perdeu o leilão por ${dadosDoAlvo.nome}. Outro clube cobriu sua oferta final.`,
                                data: new Date().toISOString()
                            };
                        }
                    }

                } else {
                    // ❌ NINGUÉM ATINGIU O PREÇO DE RESERVA DA IA
                    for (let login in lances) {
                        if (!login.startsWith('IA_')) {
                            updates[`ligas/${liga}/caixa_mensagens/${login}/msg_recusa_${Date.now()}_${Math.floor(Math.random()*1000)}`] = {
                                tipo: 'recusa',
                                texto: `A diretoria do ${timeDoAlvo.replace(/_/g,' ')} RECUSOU sua proposta por ${dadosDoAlvo.nome}. Os valores não agradaram.`,
                                data: new Date().toISOString()
                            };
                        }
                    }
                }

                // 🧹 🟢 APAGA CIRURGICAMENTE APENAS AS PROPOSTAS VELHAS DO RADAR!
                Object.keys(lances).forEach(l => updates[`ligas/${liga}/mercado_propostas/${idAlvo}/${l}`] = null);
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

                        // O Criador conta como o voto número 1
                        let qtdVotos = 1;
                        let sA = at.ataque, sD = at.defesa, sF = at.forca, sV = at.velocidade, sH = at.habilidade;

                        if (p.avaliacoes) {
                            for (let v in p.avaliacoes) {
                                sA += p.avaliacoes[v].ataque || 60;
                                sD += p.avaliacoes[v].defesa || 60;
                                sF += p.avaliacoes[v].forca || 60;
                                sV += p.avaliacoes[v].velocidade || 60;
                                sH += p.avaliacoes[v].habilidade || 60;
                                qtdVotos++;
                            }
                        }

                        // Calcula a média exata e CONVERTE para a Escala 1-15 (Divide por 6)
                        let finalAtq = Math.round((sA / qtdVotos) / 6);
                        let finalDef = Math.round((sD / qtdVotos) / 6);
                        let finalFor = Math.round((sF / qtdVotos) / 6);
                        let finalVel = Math.round((sV / qtdVotos) / 6);
                        let finalHab = Math.round((sH / qtdVotos) / 6);

                        // OVR é a Média!
                        let ovrFinal = Math.round((finalAtq + finalDef + finalFor + finalVel + finalHab) / 5);

                        // Adequa o valor de mercado (Ex: OVR 10 = R$ 25.000.000)
                        let valorMercado = Math.max(40000000, ovrFinal * 4500000);

                        let jogadorPronto = {
                            nome: p.nome + " (PRO)",
                            posicoes: { p: p.posicao, s: "IND", t: "IND" },
                            atributos: { ataque: finalAtq, defesa: finalDef, forca: finalFor, velocidade: finalVel, habilidade: finalHab },
                            valor_mercado: valorMercado,
                            pro_player: true
                        };

                        let idUnico = "PRO_" + criador;
                        let timeAgentes = `Agentes_Livres_${liga}`; // Isolamento da Liga!

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
            const horaMotor = agoraDT.getHours(); // O Relógio interno do Motor
            let teveJogoLiga = false;

            const processarPartidaAoVivo = (jogo, isMataMata = false) => {
                if (jogo.jogado) return;

                                let donoM = null; let donoV = null;
                let forcaM = 500; let forcaV = 500;
                let mentM = "Moderado"; let mentV = "Moderado";

                for (let u in usuarios) {
                    if (usuarios[u].timeAtual === jogo.mandante) {
                        if (usuarios[u].forcaAtual) forcaM = usuarios[u].forcaAtual;
                        mentM = usuarios[u].mentalidade || "Moderado"; donoM = u;
                    }
                    if (usuarios[u].timeAtual === jogo.visitante) {
                        if (usuarios[u].forcaAtual) forcaV = usuarios[u].forcaAtual;
                        mentV = usuarios[u].mentalidade || "Moderado"; donoV = u;
                    }
                }

                // NOVO CÁLCULO ATAQUE vs DEFESA
                function calcularForcaAtaqueDefesa(timeId, times, usuarios) {
                    let time = times[timeId];
                    if (!time ||!time.jogadores) return {ataque: 50, defesa: 50, forcaTotal: 500};
                    let dono = Object.values(usuarios).find(u => u.timeAtual === timeId);
                    let titularesIds = dono?.titulares? Object.values(dono.titulares).filter(Boolean) : Object.keys(time.jogadores);
                    let titularesObjs = titularesIds.map(id=> time.jogadores[id]).filter(Boolean).map((j,i)=> ({...j, id: titularesIds[i]}));
                    if(titularesObjs.length===0){
                        titularesObjs = montarEscalacaoIAInteligenteV2(timeId, time.jogadores);
                    }
                    let res = calcularForcaTimeComplexaV2(titularesObjs, dono?.mentalidade||"Moderado", dono?.estilo||"Equilibrado", dono?.moral||50, false, dono?.ct_ativo, dono?.escudo_rodada, dono);
                    return {ataque: Math.round(res.ataque), defesa: Math.round(res.defesa), forcaTotal: Math.round(res.total)};
                }


                let statsM = calcularForcaAtaqueDefesa(jogo.mandante, times, usuarios);
                let statsV = calcularForcaAtaqueDefesa(jogo.visitante, times, usuarios);
                forcaM = statsM.forcaTotal; forcaV = statsV.forcaTotal;

                let fadigaM = Object.keys(times[jogo.mandante]?.jogadores||{}).length>11?1.0:0.85;
                let fadigaV = Object.keys(times[jogo.visitante]?.jogadores||{}).length>11?1.0:0.85;
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

                // INJEÇÃO DO MOTOR NARRATIVO PARA TRANSMISSÃO AO VIVO
                const narracoesM = ["🔥 UUUHH! O atacante chuta forte e a bola raspa a trave!", "🛡️ Bela roubada de bola da zaga, desarmando com classe.", "👟 Troca de passes envolvente. O time procura espaço.", "🎯 Cruzamento venenoso na área, mas o atacante cabeceia por cima!"];
                const narracoesV = ["⚠️ PERIGO! O visitante ataca com velocidade, mas o chute vai fora.", "🧤 MILAGRE! O goleiro se estica todo e salva um gol certo!", "👟 O visitante domina a posse de bola no meio campo.", "🥅 Chute de muito longe, a bola passa assustando!"];

                for(let i=0; i<16; i++) {
                    let minAleatorio = Math.floor(Math.random()*89)+1;
                    if (minAleatorio === 45) minAleatorio = 46;
                    if (Math.random() > 0.5) linhaTempo.push({ minuto: minAleatorio, tipo: 'ataque_mandante', texto: narracoesM[Math.floor(Math.random()*narracoesM.length)] });
                    else linhaTempo.push({ minuto: minAleatorio, tipo: 'ataque_visitante', texto: narracoesV[Math.floor(Math.random()*narracoesV.length)] });
                }

                // 🟢 INTELIGÊNCIA: Goleiro não faz gol nem dá assistência!
                const sortearAtletaGol = (tId) => {
                    let chaves = times[tId]?.jogadores ? Object.keys(times[tId].jogadores) : [];
                    let linhaFrente = chaves.filter(k => times[tId].jogadores[k].posicoes?.p !== "Goleiro");
                    if(linhaFrente.length > 0) return linhaFrente[Math.floor(Math.random() * linhaFrente.length)];
                    return chaves.length ? chaves[Math.floor(Math.random() * chaves.length)] : null;
                };

                let gkM_id = Object.keys(times[jogo.mandante]?.jogadores || {}).find(k => times[jogo.mandante].jogadores[k].posicoes?.p === "Goleiro");
                let gkV_id = Object.keys(times[jogo.visitante]?.jogadores || {}).find(k => times[jogo.visitante].jogadores[k].posicoes?.p === "Goleiro");

                if (gkM_id) { let gkM = times[jogo.mandante].jogadores[gkM_id]; gkM.estatisticas = gkM.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0}; gkM.estatisticas.jogos = (gkM.estatisticas.jogos || 0) + 1; updates[`banco_global_times/${jogo.mandante}/jogadores/${gkM_id}`] = gkM; }
                if (gkV_id) { let gkV = times[jogo.visitante].jogadores[gkV_id]; gkV.estatisticas = gkV.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0}; gkV.estatisticas.jogos = (gkV.estatisticas.jogos || 0) + 1; updates[`banco_global_times/${jogo.visitante}/jogadores/${gkV_id}`] = gkV; }

                // --- CORRIGIDO: chance realista (0.18 = média 0.9 gol por time a cada 5 tentativas) ---
                // isMataMata = true se for Copa, false se for Campeonato
                let isCopa = isMataMata || (typeof caminhoDivisao!== 'undefined' && caminhoDivisao.includes('copa'));
                let isCampeonato =!isCopa;

                for(let i=0; i<5; i++) {
                    if (golsM < capGolsM && Math.random() < ((statsM.ataque / (statsM.ataque + statsV.defesa)) * modM * 0.18)) {
                        golsM++;
                        if (gkV_id) {
                            let gkV = times[jogo.visitante].jogadores[gkV_id];
                            gkV.estatisticas = gkV.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0, gols_campeonato:0, assistencias_campeonato:0, gols_sofridos_campeonato:0, jogos_campeonato:0, gols_copa:0};
                            gkV.estatisticas.gols_sofridos = (gkV.estatisticas.gols_sofridos || 0) + 1;
                            gkV.estatisticas.jogos = (gkV.estatisticas.jogos || 0) + (isCampeonato?1:0);
                            if(isCampeonato){
                                gkV.estatisticas.gols_sofridos_campeonato = (gkV.estatisticas.gols_sofridos_campeonato||0)+1;
                                gkV.estatisticas.jogos_campeonato = (gkV.estatisticas.jogos_campeonato||0)+1;
                            } else {
                                gkV.estatisticas.gols_sofridos_copa = (gkV.estatisticas.gols_sofridos_copa||0)+1;
                            }
                            updates[`banco_global_times/${jogo.visitante}/jogadores/${gkV_id}`] = gkV;
                        }
                        let idA = sortearAtletaGol(jogo.mandante); let nA = idA? times[jogo.mandante].jogadores[idA].nome : "Jogador";
                        if(idA) {
                            let jg = times[jogo.mandante].jogadores[idA];
                            jg.estatisticas = jg.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0, gols_campeonato:0, assistencias_campeonato:0, jogos_campeonato:0};
                            jg.estatisticas.gols = (jg.estatisticas.gols||0)+1;
                            jg.estatisticas.jogos = (jg.estatisticas.jogos||0)+1;
                            if(isCampeonato){
                                jg.estatisticas.gols_campeonato = (jg.estatisticas.gols_campeonato||0)+1;
                                jg.estatisticas.jogos_campeonato = (jg.estatisticas.jogos_campeonato||0)+1;
                            } else {
                                jg.estatisticas.gols_copa = (jg.estatisticas.gols_copa||0)+1;
                            }
                            jg.valor_mercado = (jg.valor_mercado||1000000) + (isCampeonato?250000:100000);
                            if (Math.random() > 0.5) {
                                let idAst = sortearAtletaGol(jogo.mandante);
                                if (idAst && idAst!== idA) {
                                    let jgAst = times[jogo.mandante].jogadores[idAst];
                                    jgAst.estatisticas = jgAst.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0, gols_campeonato:0, assistencias_campeonato:0, jogos_campeonato:0};
                                    jgAst.estatisticas.assistencias = (jgAst.estatisticas.assistencias||0)+1;
                                    if(isCampeonato){
                                        jgAst.estatisticas.assistencias_campeonato = (jgAst.estatisticas.assistencias_campeonato||0)+1;
                                    } else {
                                        jgAst.estatisticas.assistencias_copa = (jgAst.estatisticas.assistencias_copa||0)+1;
                                    }
                                    updates[`banco_global_times/${jogo.mandante}/jogadores/${idAst}`] = jgAst;
                                }
                            }
                            updates[`banco_global_times/${jogo.mandante}/jogadores/${idA}`] = jg;
                        }
                        linhaTempo.push({ minuto: Math.floor(Math.random()*89)+1, tipo: "gol_mandante", texto: `⚽ GOOOL DO ${jogo.mandante.replace(/_/g,' ')}! (${nA})` });
                    }
                    if (golsV < capGolsV && Math.random() < ((statsV.ataque / (statsV.ataque + statsM.defesa)) * modV * 0.18)) {
                        golsV++;
                        if (gkM_id) {
                            let gkM = times[jogo.mandante].jogadores[gkM_id];
                            gkM.estatisticas = gkM.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0, gols_campeonato:0, gols_sofridos_campeonato:0, jogos_campeonato:0};
                            gkM.estatisticas.gols_sofridos = (gkM.estatisticas.gols_sofridos || 0) + 1;
                            gkM.estatisticas.jogos = (gkM.estatisticas.jogos || 0) + (isCampeonato?1:0);
                            if(isCampeonato){
                                gkM.estatisticas.gols_sofridos_campeonato = (gkM.estatisticas.gols_sofridos_campeonato||0)+1;
                                gkM.estatisticas.jogos_campeonato = (gkM.estatisticas.jogos_campeonato||0)+1;
                            }
                            updates[`banco_global_times/${jogo.mandante}/jogadores/${gkM_id}`] = gkM;
                        }
                        let idA = sortearAtletaGol(jogo.visitante); let nA = idA? times[jogo.visitante].jogadores[idA].nome : "Jogador";
                        if(idA) {
                            let jg = times[jogo.visitante].jogadores[idA];
                            jg.estatisticas = jg.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0, gols_campeonato:0, assistencias_campeonato:0, jogos_campeonato:0};
                            jg.estatisticas.gols = (jg.estatisticas.gols||0)+1;
                            jg.estatisticas.jogos = (jg.estatisticas.jogos||0)+1;
                            if(isCampeonato){
                                jg.estatisticas.gols_campeonato = (jg.estatisticas.gols_campeonato||0)+1;
                                jg.estatisticas.jogos_campeonato = (jg.estatisticas.jogos_campeonato||0)+1;
                            } else {
                                jg.estatisticas.gols_copa = (jg.estatisticas.gols_copa||0)+1;
                            }
                            jg.valor_mercado = (jg.valor_mercado||1000000) + (isCampeonato?250000:100000);
                            if (Math.random() > 0.5) {
                                let idAst = sortearAtletaGol(jogo.visitante);
                                if (idAst && idAst!== idA) {
                                    let jgAst = times[jogo.visitante].jogadores[idAst];
                                    jgAst.estatisticas = jgAst.estatisticas || {gols:0, assistencias:0, gols_sofridos:0, jogos:0, assistencias_campeonato:0};
                                    jgAst.estatisticas.assistencias = (jgAst.estatisticas.assistencias||0)+1;
                                    if(isCampeonato){
                                        jgAst.estatisticas.assistencias_campeonato = (jgAst.estatisticas.assistencias_campeonato||0)+1;
                                    }
                                    updates[`banco_global_times/${jogo.visitante}/jogadores/${idAst}`] = jgAst;
                                }
                            }
                            updates[`banco_global_times/${jogo.visitante}/jogadores/${idA}`] = jg;
                        }
                        linhaTempo.push({ minuto: Math.floor(Math.random()*89)+1, tipo: "gol_visitante", texto: `⚽ GOOOL DO ${jogo.visitante.replace(/_/g,' ')}! (${nA})` });
                    }
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

            // 1. VARRE O CAMPEONATO (Atrados ou hoje após 19h)
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

                            // O TRATOR: Apenas simula caso o jogo esteja atrasado (Ontem para trás)
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

            // 2. VARRE A COPA (Atrasados ou hoje após 20h)
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

                                // O TRATOR: Apenas simula caso a Copa esteja atrasada
                                if (jogoDT < hojeDT) {
                                    processarPartidaAoVivo(jogo, true); // True = Pênaltis

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
                    arts.forEach(j => {
                        let novo = Math.min(99, (j.atributos.ataque || 60) + 5);
                        if(times[j.timeBanco]?.jogadores?.[j.idBanco]) times[j.timeBanco].jogadores[j.idBanco].atributos.ataque = novo;
                    });

                    let asts = [...todosJgs].filter(j => j.estatisticas && j.estatisticas.assistencias > 0).sort((a,b) => b.estatisticas.assistencias - a.estatisticas.assistencias).slice(0, 3);
                    asts.forEach(j => {
                        let novo = Math.min(99, (j.atributos.habilidade || 60) + 5);
                        if(times[j.timeBanco]?.jogadores?.[j.idBanco]) times[j.timeBanco].jogadores[j.idBanco].atributos.habilidade = novo;
                    });

                    let gks = [...todosJgs].filter(j => j.posicoes && j.posicoes.p === "Goleiro" && j.estatisticas && j.estatisticas.jogos >= 5);
                    gks.sort((a,b) => (a.estatisticas.gols_sofridos || 0) - (b.estatisticas.gols_sofridos || 0)).slice(0, 3).forEach(j => {
                        let novo = Math.min(99, (j.atributos.defesa || 60) + 5);
                        if(times[j.timeBanco]?.jogadores?.[j.idBanco]) times[j.timeBanco].jogadores[j.idBanco].atributos.defesa = novo;
                    });
                }
            }

            // ============================================
            // 🏆 BÔNUS TOP 10 - GOLS, ASSISTÊNCIAS E GOLEIRO
            // ============================================
            // Top1 +5, Top2 +4, Top3 +3, Top4 +2, Top5-10 +1 - Aumenta OVR e valor de venda
            let todosParaBonus = [];
            for(let t in times){
                if(t.startsWith("Agentes") || t==="Fantasma" || t==="Lendas_Futebol") continue;
                if(!times[t].jogadores) continue;
                for(let jId in times[t].jogadores){
                    let j = times[t].jogadores[jId];
                    if(j.estatisticas && ((j.estatisticas.gols||0)>0 || (j.estatisticas.assistencias||0)>0 || (j.posicoes && j.posicoes.p==="Goleiro"))){
                        todosParaBonus.push({timeId:t, jogadorId:jId, dados:j});
                    }
                }
            }
            let topGols = [...todosParaBonus].filter(x=> (x.dados.estatisticas.gols||0)>0).sort((a,b)=> b.dados.estatisticas.gols - a.dados.estatisticas.gols).slice(0,10);
            let topAsts = [...todosParaBonus].filter(x=> (x.dados.estatisticas.assistencias||0)>0).sort((a,b)=> b.dados.estatisticas.assistencias - a.dados.estatisticas.assistencias).slice(0,10);
            let topGks = [...todosParaBonus].filter(x=> x.dados.posicoes && x.dados.posicoes.p==="Goleiro" && (x.dados.estatisticas.jogos||0)>=3).sort((a,b)=> (a.dados.estatisticas.gols_sofridos||0) - (b.dados.estatisticas.gols_sofridos||0)).slice(0,10);

            function aplicarBonusTop10(lista, tipo){
                lista.forEach((item, idx)=>{
                    let bonus = idx===0?5: idx===1?4: idx===2?3: idx===3?2: 1;
                    let jAtual = times[item.timeId].jogadores[item.jogadorId];
                    if(!jAtual) return;
                    let bonusAnt = jAtual.bonus_ranking||0;
                    if(bonus>bonusAnt){
                        let diff = bonus-bonusAnt;
                        let novosAtr = {...(jAtual.atributos||{})};
                        for(let k in novosAtr){ novosAtr[k]=Math.min(20, (novosAtr[k]||5)+diff); }
                        let novoValor = Math.round((jAtual.valor_mercado||0)*(1+diff*0.15));
                        updates[`banco_global_times/${item.timeId}/jogadores/${item.jogadorId}/atributos`] = novosAtr;
                        updates[`banco_global_times/${item.timeId}/jogadores/${item.jogadorId}/valor_mercado`] = novoValor;
                        updates[`banco_global_times/${item.timeId}/jogadores/${item.jogadorId}/bonus_ranking`] = bonus;
                        updates[`banco_global_times/${item.timeId}/jogadores/${item.jogadorId}/bonus_tipo`] = tipo;
                    }
                });
            }
            aplicarBonusTop10(topGols, 'artilheiro');
            aplicarBonusTop10(topAsts, 'assistencia');
            aplicarBonusTop10(topGks, 'goleiro_menos_vazado');

            updates[`ligas/${liga}/calendario`] = cal;
        }

        // --- PASSO C.2: FISCALIZAÇÃO DOS CONTRATOS DE EMPRÉSTIMO ---
        // Calcula quantas rodadas avançaram hoje (1 rodada ao vivo, ou várias se o trator puxou atrasos)
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
                        // 🚨 ACABOU O CONTRATO! O Trator confisca o jogador de volta para a casa.
                        let tLocatario = emp.time_destino;
                        let tDono = emp.time_origem;
                        let dJog = null;

                        // Pega o jogador do time que alugou
                        if (times[tLocatario] && times[tLocatario].jogadores && times[tLocatario].jogadores[idJog]) {
                            dJog = times[tLocatario].jogadores[idJog];
                        }

                        if (dJog) {
                            delete dJog.status_emprestimo; // Arranca a etiqueta de locação
                            updates[`banco_global_times/${tLocatario}/jogadores/${idJog}`] = null;
                            updates[`banco_global_times/${tDono}/jogadores/${idJog}`] = dJog;

                            // Avisa os Técnicos (Caso sejam humanos) na Caixa de Entrada
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
                        // Apaga o registro do cartório
                        updates[`ligas/${liga}/emprestimos_ativos/${idJog}`] = null;
                    } else {
                        // Contrato segue ativo: Atualiza os dias restantes no Cartório e no Perfil do Atleta!
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

        // 1. Limpa o bônus da rodada anterior (Se cair de posição, perde a força)
        todosParaRanking.forEach(jog => {
            let j = jog.dados;
            if (j.bonus_ranking_ativo) {
                if(j.atributos) {
                    j.atributos.ataque = Math.max(1, (j.atributos.ataque || 0) - (j.bonus_ranking_ativo.ataque || 0));
                    j.atributos.habilidade = Math.max(1, (j.atributos.habilidade || 0) - (j.bonus_ranking_ativo.habilidade || 0));
                    j.atributos.defesa = Math.max(1, (j.atributos.defesa || 0) - (j.bonus_ranking_ativo.defesa || 0));
                }
                j.bonus_ranking_ativo = null;
            }
        });

        // 2. Lê a Tabela Atual e encontra os 10 melhores
        let topGols = [...todosParaRanking].filter(j => j.dados.estatisticas && j.dados.estatisticas.gols > 0)
            .sort((a,b) => b.dados.estatisticas.gols - a.dados.estatisticas.gols).slice(0, 10);

        let topAsts = [...todosParaRanking].filter(j => j.dados.estatisticas && j.dados.estatisticas.assistencias > 0)
            .sort((a,b) => b.dados.estatisticas.assistencias - a.dados.estatisticas.assistencias).slice(0, 10);

        let topGks = [...todosParaRanking].filter(j => j.dados.posicoes && j.dados.posicoes.p === "Goleiro" && j.dados.estatisticas && j.dados.estatisticas.jogos > 0)
            .sort((a,b) => (a.dados.estatisticas.gols_sofridos || 0) - (b.dados.estatisticas.gols_sofridos || 0)).slice(0, 10);

        // 3. Injeta a Bonificação (1º ganha 5.0, caindo 0.5 até o 10º ganhar 0.5)
        topGols.forEach((jog, i) => {
            let bonus = 5.0 - (i * 0.5);
            jog.dados.bonus_ranking_ativo = jog.dados.bonus_ranking_ativo || { ataque: 0, habilidade: 0, defesa: 0 };
            jog.dados.bonus_ranking_ativo.ataque = bonus;
            jog.dados.atributos.ataque = (jog.dados.atributos.ataque || 0) + bonus;
        });

        topAsts.forEach((jog, i) => {
            let bonus = 5.0 - (i * 0.5);
            jog.dados.bonus_ranking_ativo = jog.dados.bonus_ranking_ativo || { ataque: 0, habilidade: 0, defesa: 0 };
            jog.dados.bonus_ranking_ativo.habilidade = bonus;
            jog.dados.atributos.habilidade = (jog.dados.atributos.habilidade || 0) + bonus;
        });

        topGks.forEach((jog, i) => {
            let bonus = 5.0 - (i * 0.5);
            jog.dados.bonus_ranking_ativo = jog.dados.bonus_ranking_ativo || { ataque: 0, habilidade: 0, defesa: 0 };
            jog.dados.bonus_ranking_ativo.defesa = bonus;
            jog.dados.atributos.defesa = (jog.dados.atributos.defesa || 0) + bonus;
        });

        // 4. A Regra de Ouro: O Valor de Mercado obedece ao OVR Dinâmico (Lenda não entra)
        todosParaRanking.forEach(jog => {
            let j = jog.dados;
            if(j.nome && j.nome.includes("(Lenda)")) return;
            if(jog.time === "Lendas_Futebol") return;
            let at = j.atributos || {};

            let atq = at.ataque || 5; let def = at.defesa || 5; let frc = at.forca || 5; let vel = at.velocidade || 5; let hab = at.habilidade || 5;

            if ((j.pro_player || (j.nome && j.nome.includes("(PRO)")) ) && (atq > 20 || def > 20)) {
                atq /= 6; def /= 6; frc /= 6; vel /= 6; hab /= 6;
            }

            let ovrMercado = (atq + def + frc + vel + hab) / 5;
            j.valor_mercado = Math.round(ovrMercado * 2500000);
            updates[`banco_global_times/${jog.time}/jogadores/${jog.id}`] = j;
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

                                    // Para onde vai o jogador? Se for Banco Central, vira Agente Livre com dono Banco. Se for Player, vai pro time dele!
                                    let destinoPenhora = credor === 'Banco Central da Liga'? `Agentes_Livres_${liga}` : credor;
                                    let jogadorPenhora = {...piorJogador};
                                    if(credor === 'Banco Central da Liga'){
                                        jogadorPenhora.origem_banco = true;
                                        jogadorPenhora.clube_banco = 'Banco Central da Liga';
                                        jogadorPenhora.data_penhora = new Date().toISOString();
                                    }
                                    updates[`banco_global_times/${destinoPenhora}/jogadores/${idBagre}`] = jogadorPenhora;
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

        // 🟢 Aplica a queda de moral matinal (10% a menos APENAS para HUMANOS)
        if (rodarQuedaMoral) {
            for (let u in usuarios) {
                // A trava mágica: ignora quem tiver "IA_" no login!
                if (!u.startsWith('IA_') && usuarios[u].timeAtual && usuarios[u].timeAtual !== "Sem Clube") {
                    let moralAtual = usuarios[u].moral || 50;
                    updates[`ligas/${liga}/usuarios/${u}/moral`] = Math.max(0, moralAtual - 10);
                }
            }
            updates[`ligas/${liga}/sistema/ultima_queda_moral`] = dataAtualStr;
        }
        if (rodarAtrasados) {
            if (!updates[`ligas/${liga}/sistema/ultima_simulacao_camp`]) updates[`ligas/${liga}/sistema/ultima_simulacao_camp`] = ontemStr;
            if (!updates[`ligas/${liga}/sistema/ultima_simulacao_copa`]) updates[`ligas/${liga}/sistema/ultima_simulacao_copa`] = ontemStr;
        }
        // FIX: Remove conflito de ancestral - se tem /jogadores/ID e /jogadores/ID/atributos no mesmo update, apaga o filho e mantém só o pai
        let chaves = Object.keys(updates);
        for(let pai of chaves){
            for(let filho of chaves){
                if(filho!== pai && filho.startsWith(pai + '/')){
                    // Se o pai é o objeto completo do jogador, mergeia o filho nele
                    if(typeof updates[pai] === 'object' && updates[pai]!== null &&!Array.isArray(updates[pai])){
                        let subPath = filho.replace(pai + '/', '').split('/');
                        let alvo = updates[pai];
                        for(let i=0;i<subPath.length-1;i++){
                            alvo[subPath[i]] = alvo[subPath[i]] || {};
                            alvo = alvo[subPath[i]];
                        }
                        alvo[subPath[subPath.length-1]] = updates[filho];
                    }
                    delete updates[filho];
                }
            }
        }

        await db.ref().update(updates);
        await lockRef.set(false);

        console.log("✅ MOTOR P2P: Rotinas noturnas concluídas com sucesso!");

        if (transferenciasRealizadas > 0) {
            dispararNotificacao("Mercado Fechado! 🛒", "As negociações foram encerradas e jogadores foram transferidos.");
        }

        // Verifica se o motor rodou ao vivo ou se o Trator foi acionado para cobrir o atraso
        if (rodarCampHoje || rodarCopaHoje) {
            dispararNotificacao("Fim do Aquecimento! ⚽", "As escalações foram bloqueadas e a bola vai rolar!");
        } else if (rodarAtrasados) {
            dispararNotificacao("🚜 Trator Acionado!", "O sistema simulou todas as rodadas e transações que estavam atrasadas no calendário.");
        }

    } catch (e) {
        console.error("Erro crítico no Motor P2P:", e);
        await lockRef.set(false);
    }
}

// FIX 2: BÔNUS TOP 10 - Ranking de Gols, Assistências e Goleiro Menos Vazado
// Adicione estas funções no FINAL do motor.js (motor_final.js) e chame dentro de processarTudo após simular a rodada

// Calcula bônus: Top1 +5, Top2 +4, Top3 +3, Top4 +2, Top5 +1, Top6-10 +0.5 arredondado para 1
function calcularBonusPorPosicao(pos){
    if(pos===0) return 5;
    if(pos===1) return 4;
    if(pos===2) return 3;
    if(pos===3) return 2;
    if(pos===4) return 1;
    if(pos>=5 && pos<=9) return 1;
    return 0;
}

async function aplicarBonusRankingTop10(liga, times, updates){
    try{
        let todosGols = [];
        let todosAsts = [];
        let todosGoleiros = [];

        for(let tId in times){
            if(tId.startsWith("Agentes") || tId==="Fantasma" || tId==="Lendas_Futebol") continue;
            let jogadores = times[tId].jogadores||{};
            for(let jId in jogadores){
                let j = jogadores[jId];
                let est = j.estatisticas||{};
                if((est.gols||0)>0){
                    todosGols.push({timeId:tId, jogadorId:jId, nome:j.nome, gols:est.gols, asts:est.assistencias||0, valor:j.valor_mercado||0, atributos:j.atributos});
                }
                if((est.assistencias||0)>0){
                    todosAsts.push({timeId:tId, jogadorId:jId, nome:j.nome, gols:est.gols||0, asts:est.assistencias, valor:j.valor_mercado||0, atributos:j.atributos});
                }
                // Goleiros - menos vazado: calcula GC do time / jogos do goleiro
                if(j.posicoes && j.posicoes.p==="Goleiro" && (est.jogos||0)>=3){
                    // GC do time
                    let gcTime = 0;
                    // Vamos pegar da tabela de jogos? Simplificado: usa estatística de GC do goleiro se tiver, senão usa GC do time
                    let gcGoleiro = est.gols_sofridos || 0;
                    todosGoleiros.push({timeId:tId, jogadorId:jId, nome:j.nome, gc:gcGoleiro, jogos:est.jogos||0, valor:j.valor_mercado||0, atributos:j.atributos});
                }
            }
        }

        // Ordena
        todosGols.sort((a,b)=> b.gols - a.gols);
        todosAsts.sort((a,b)=> b.asts - a.asts);
        todosGoleiros.sort((a,b)=> a.gc - b.gc); // menos vazado = menor GC

        let topGols = todosGols.slice(0,10);
        let topAsts = todosAsts.slice(0,10);
        let topGoleiros = todosGoleiros.slice(0,10);

        // Aplica bônus
        function aplicarBonus(lista, tipo){
            lista.forEach((item, idx)=>{
                let bonus = calcularBonusPorPosicao(idx);
                if(bonus<=0) return;
                let timeId = item.timeId;
                let jId = item.jogadorId;
                let jogadorAtual = times[timeId].jogadores[jId];
                if(!jogadorAtual) return;

                let bonusExistente = jogadorAtual.bonus_ranking || 0;
                // Só aumenta se o novo bônus for maior que o existente (não acumula infinitamente)
                if(bonus > bonusExistente){
                    let diff = bonus - bonusExistente;
                    let novosAtributos = {...(jogadorAtual.atributos||{})};
                    // Distribui +diff em todos atributos (ataque/defesa/forca/vel/hab) proporcional
                    for(let at in novosAtributos){
                        novosAtributos[at] = Math.min(20, (novosAtributos[at]||5) + diff);
                    }
                    let novoValor = Math.round((jogadorAtual.valor_mercado||0) * (1 + diff*0.15)); // +15% por ponto de bônus

                    updates[`banco_global_times/${timeId}/jogadores/${jId}/atributos`] = novosAtributos;
                    updates[`banco_global_times/${timeId}/jogadores/${jId}/valor_mercado`] = novoValor;
                    updates[`banco_global_times/${timeId}/jogadores/${jId}/bonus_ranking`] = bonus;
                    updates[`banco_global_times/${timeId}/jogadores/${jId}/bonus_tipo`] = tipo;
                }
            });
        }

        aplicarBonus(topGols, 'artilheiro');
        aplicarBonus(topAsts, 'assistencia');
        aplicarBonus(topGoleiros, 'goleiro_menos_vazado');

        console.log(`🏆 Bônus Top10 aplicado: ${topGols.length} artilheiros, ${topAsts.length} assistências, ${topGoleiros.length} goleiros`);

    }catch(e){ console.error("Erro bônus ranking:", e); }
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

        // CHECAGEM 3.5: ESCALAÇÃO PENDENTE 18:59
        if (ligaDados.usuarios && ligaDados.usuarios[userLogadoMotor]) {
            let meuUser = ligaDados.usuarios[userLogadoMotor];
            let ultima = meuUser.ultima_escalacao_confirmada? new Date(meuUser.ultima_escalacao_confirmada) : null;
            let hoje = new Date();
            let pendente =!ultima || ultima.toDateString()!==hoje.toDateString() || (ultima.getHours()+ultima.getMinutes()/60)>=18.983;
            if(pendente){
                countNotif++;
                htmlNotif += `<div onclick="window.location.href='escalacao.html'" style="background:#1a1a1a; padding:10px; border-radius:4px; border-left:3px solid #dc3545; cursor:pointer; margin-top:5px;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#1a1a1a'">
                    <strong style="color:#dc3545; font-size:12px;">⚠️ Escalação Pendente</strong><br>
                    <span style="color:#ccc; font-size:11px;">Confirme até 18:59 ou -15% no jogo. Clique para escalar.</span>
                </div>`;
            }
        }

        // CHECAGEM 3.6: DÍVIDA PENDENTE
        if (ligaDados.dividas_financeiras) {
            let meuTime = ligaDados.usuarios && ligaDados.usuarios[userLogadoMotor]? ligaDados.usuarios[userLogadoMotor].timeAtual : null;
            let totalDividas=0;
            for(let id in ligaDados.dividas_financeiras){
                if(ligaDados.dividas_financeiras[id].devedor===meuTime) totalDividas++;
            }
            if(totalDividas>0){
                countNotif++;
                htmlNotif += `<div onclick="window.location.href='mercado.html'" style="background:#1a1a1a; padding:10px; border-radius:4px; border-left:3px solid #dc3545; cursor:pointer; margin-top:5px;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#1a1a1a'">
                    <strong style="color:#dc3545; font-size:12px;">💸 Dívida Pendente</strong><br>
                    <span style="color:#ccc; font-size:11px;">Você tem ${totalDividas} dívida(s). Parcela desconta todo jogo. Clique para pagar.</span>
                </div>`;
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