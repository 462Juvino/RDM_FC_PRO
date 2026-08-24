// js/perfil.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let TETO_PONTOS = 300; // Começa em 300
let meuProPlayer = null;

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
        dadosUsuario = snapUser.val();

        if(!dadosUsuario) return window.location.href = "index.html";

        document.getElementById('nome-treinador').innerText = dadosUsuario.nome;
        document.getElementById('nome-time').innerText = dadosUsuario.timeAtual !== "Sem Clube" ? dadosUsuario.timeAtual.replace(/_/g, ' ') : "Sem Clube";

        checarMeuProPlayer();
        carregarAvaliacoesPendentes();
        carregarHistoricoCampeoes();
    } catch (e) { console.error(e); }
});

// ========================================================
// 0. CARREGAR HALL DA FAMA (HISTÓRICO)
// ========================================================
function carregarHistoricoCampeoes() {
    db.ref(`ligas/${ligaLogada}/historico_campeoes`).on('value', snap => {
        const listaDiv = document.getElementById('lista-historico');
        const hist = snap.val();

        if (!hist) {
            listaDiv.innerHTML = `<div style="text-align: center; padding: 20px; color: #666;">Nenhum campeão registrado ainda. O livro da história está em branco!</div>`;
            return;
        }

        listaDiv.innerHTML = "";
        let html = "";

        // Inverte para os mais recentes ficarem no topo
        const temporadas = Object.keys(hist).reverse();

        temporadas.forEach(tempId => {
            let temporada = hist[tempId];
            let tituloSerieA = temporada.campeao_serie_a ? `🥇 SÉRIE A: <strong>${temporada.campeao_serie_a.treinador}</strong> (${temporada.campeao_serie_a.time})` : "";
            let tituloCopa = temporada.campeao_copa ? `🏆 COPA: <strong>${temporada.campeao_copa.treinador}</strong> (${temporada.campeao_copa.time})` : "";
            let tituloMundial = temporada.campeao_mundial ? `🌍 MUNDIAL: <strong>${temporada.campeao_mundial.treinador}</strong> (${temporada.campeao_mundial.time})` : "";

            html += `
                <div style="background: #1a1a1a; border: 1px solid #333; padding: 15px; border-radius: 8px; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">
                    <div style="color: #ff8c00; font-weight: bold; font-size: 16px; margin-bottom: 8px; border-bottom: 1px dashed #444; padding-bottom: 5px;">${temporada.nome_temporada || tempId}</div>
                    <div style="font-size: 14px; color: #ddd; display: flex; flex-direction: column; gap: 5px;">
                        ${tituloSerieA ? `<span>${tituloSerieA}</span>` : ''}
                        ${tituloCopa ? `<span>${tituloCopa}</span>` : ''}
                        ${tituloMundial ? `<span style="color: var(--verde-campo); margin-top: 5px;">${tituloMundial}</span>` : ''}
                    </div>
                </div>
            `;
        });
        listaDiv.innerHTML = html;
    });
}

// ========================================================
// 1. HELPER DOS BOTÕES DE MAIS E MENOS NO CELULAR
// ========================================================
window.ajustarSlider = function(id, delta, funcName, arg) {
    let el = document.getElementById(id);
    if(el) {
        let newVal = parseInt(el.value) + delta;
        if(newVal >= parseInt(el.min) && newVal <= parseInt(el.max)) {
            el.value = newVal;
            if(funcName === 'calcularPontos') calcularPontos();
            if(funcName === 'calcularPontosAvaliacao') calcularPontosAvaliacao(arg);
        }
    }
};

function gerarSlidersHTML(a, d, f, v, h, isAval = false, dono = "", mxA=90, mxD=90, mxF=90, mxV=90, mxH=90) {
    const func = isAval ? 'calcularPontosAvaliacao' : 'calcularPontos';
    const arg = isAval ? `'${dono}'` : '';
    const suf = isAval ? `_${dono}` : '';

    const makeRow = (lbl, val, id, max) => {
        let valorReal = Math.min(val, max);
        return `
        <div class="atributo-slider" style="margin-bottom: 12px; display: flex; align-items: center; gap: 5px;">
            <span style="width: 55px; font-size: 12px;">${lbl}:</span>
            <button onclick="ajustarSlider('${id}', -1, '${func}', ${arg || 'null'})" style="width:30px; height:30px; background:#444; border:none; color:white; border-radius:4px; font-weight:bold; font-size:16px;">-</button>
            <input type="range" id="${id}" min="10" max="${max}" value="${valorReal}" oninput="${func}(${arg})" style="flex:1;">
            <button onclick="ajustarSlider('${id}', 1, '${func}', ${arg || 'null'})" style="width:30px; height:30px; background:#444; border:none; color:white; border-radius:4px; font-weight:bold; font-size:16px;">+</button>
            <span id="val-${id}" style="width: 25px; text-align: right; color: #ff8c00; font-weight: bold;">${valorReal}</span>
        </div>`;
    };

    return makeRow('Ataque', a, `atr-atq${suf}`, mxA) +
           makeRow('Defesa', d, `atr-def${suf}`, mxD) +
           makeRow('Força',  f, `atr-for${suf}`, mxF) +
           makeRow('Veloc.', v, `atr-vel${suf}`, mxV) +
           makeRow('Habil.', h, `atr-hab${suf}`, mxH);
}

// ========================================================
// 2. CHECAGEM E RENDERIZAÇÃO DO PRO PLAYER
// ========================================================
function checarMeuProPlayer() {
    db.ref(`ligas/${ligaLogada}/pro_players/${userLogado}`).on('value', snap => {
        const box = document.getElementById('box-criar-player');

        if (snap.exists()) {
            meuProPlayer = snap.val();
            renderizarPainelEvolucao();
        } else {
            TETO_PONTOS = 300;
            box.innerHTML = `
                <h3 style="color: #ff8c00;">Forjar Promessa (Pro Player)</h3>
                <p style="font-size: 13px; color: #ccc;">Crie um jogador com <strong>300 pontos</strong>. Os técnicos da liga irão testá-lo e ajustar suas notas reais!</p>
                <input type="text" id="pro-nome" placeholder="Nome do Jogador" style="width: 100%; padding: 10px; background: #1a1a1a; border: 1px solid #555; color: white; border-radius: 6px; margin-bottom: 10px;">
                <select id="pro-posicao" style="width: 100%; padding: 10px; background: #1a1a1a; border: 1px solid #555; color: white; border-radius: 6px; margin-bottom: 15px;">
                    <option value="Atacante">Atacante</option>
                    <option value="Meia">Meia</option>
                    <option value="Volante">Volante</option>
                    <option value="Zagueiro">Zagueiro</option>
                    <option value="Lateral">Lateral</option>
                    <option value="Goleiro">Goleiro</option>
                </select>
                <div style="background: #111; padding: 15px; border-radius: 8px; border: 1px dashed #444; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="color: #aaa; font-size: 13px;">Pontos Disponíveis:</span>
                        <strong id="pontos-restantes" style="color: var(--verde-campo);">300</strong>
                    </div>
                    ${gerarSlidersHTML(60, 60, 60, 60, 60)}
                </div>
                <button onclick="salvarProPlayer(true)" style="background: var(--verde-campo); width: 100%; padding: 10px; border-radius: 6px; font-weight: bold; color: white; border: none; cursor: pointer;">Registrar Atleta</button>
            `;
            calcularPontos();
        }
    });
}

function renderizarPainelEvolucao() {
    const box = document.getElementById('box-criar-player');
    let at = meuProPlayer.atributos_base;
    let qtdVotos = meuProPlayer.avaliacoes ? Object.keys(meuProPlayer.avaliacoes).length : 0;

    let mxA = 90, mxD = 90, mxF = 90, mxV = 90, mxH = 90;

    // Lógica Inteligente: A Média da Comunidade vira o "Limite" do jogador
    if (qtdVotos > 0) {
        let sA=0, sD=0, sF=0, sV=0, sH=0;
        for(let v in meuProPlayer.avaliacoes) {
            let av = meuProPlayer.avaliacoes[v];
            // Se for uma nota antiga de estrela, assume 60 para não quebrar a conta (NaN)
            sA += av.ataque || 60;
            sD += av.defesa || 60;
            sF += av.forca || 60;
            sV += av.velocidade || 60;
            sH += av.habilidade || 60;
        }
        mxA = Math.round(sA / qtdVotos); mxD = Math.round(sD / qtdVotos);
        mxF = Math.round(sF / qtdVotos); mxV = Math.round(sV / qtdVotos); mxH = Math.round(sH / qtdVotos);

        TETO_PONTOS = mxA + mxD + mxF + mxV + mxH; // O Teto total se ajusta à media

        if (!meuProPlayer.ajuste_concluido) {
            document.getElementById('painel-notificacao').style.display = "block";
            document.getElementById('texto-notificacao').innerHTML = `A liga reavaliou o seu atleta! Os seus novos limites de atributos agora são baseados na média da comunidade. Você possui <strong>${TETO_PONTOS} pts</strong> permitidos para redistribuir!`;
        }
    } else {
        TETO_PONTOS = 300;
    }

    if (meuProPlayer.ajuste_concluido) {
        box.innerHTML = `
            <h3 style="color: var(--verde-campo);">Craque Formado: ${meuProPlayer.nome}</h3>
            <div style="background: #111; padding: 15px; border-radius: 8px; border: 1px solid #333; margin-bottom: 15px;">
                <p style="margin-top:0; color:#aaa; font-size:13px;">Posição: <strong>${meuProPlayer.posicao}</strong></p>
                <p style="color:#aaa; font-size:13px;">Força OVR Oficial: <strong style="color:var(--verde-campo);">${at.ataque + at.defesa + at.forca + at.velocidade + at.habilidade}</strong></p>
                <hr style="border-color:#333; margin: 10px 0;">
                <p style="color: #666; font-size: 12px; margin-bottom:0;">O seu atleta já está devidamente registrado no mercado. Nenhuma alteração a mais pode ser feita.</p>
            </div>
        `;
    } else {
        box.innerHTML = `
            <h3 style="color: var(--verde-campo);">Ajuste seu Craque: ${meuProPlayer.nome}</h3>
            <p style="font-size: 13px; color: #ccc;">Avaliações recebidas: <strong>${qtdVotos} Olheiro(s)</strong></p>
            <div style="background: #111; padding: 15px; border-radius: 8px; border: 1px dashed #444; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #aaa; font-size: 13px;">Novo Teto: <strong>${TETO_PONTOS}</strong> | Restantes:</span>
                    <strong id="pontos-restantes" style="color: var(--verde-campo);">0</strong>
                </div>
                ${gerarSlidersHTML(at.ataque, at.defesa, at.forca, at.velocidade, at.habilidade, false, "", mxA, mxD, mxF, mxV, mxH)}
            </div>
            <button onclick="salvarProPlayer(false)" style="background: #ff8c00; width: 100%; padding: 10px; border-radius: 6px; font-weight: bold; color: white; border: none; cursor: pointer;">${qtdVotos >= 3 ? "✅ Aceitar Limites e Travar Atleta" : "💾 Atualizar Atributos"}</button>
            ${qtdVotos < 3 ? '<p style="font-size: 11px; color: #666; text-align:center; margin-top: 10px;">Aguarde 3 votos para poder confirmar a versão final pro mercado.</p>' : ''}
        `;
        calcularPontos();
    }
}

function calcularPontos() {
    const atq = parseInt(document.getElementById('atr-atq').value);
    const def = parseInt(document.getElementById('atr-def').value);
    const forca = parseInt(document.getElementById('atr-for').value);
    const vel = parseInt(document.getElementById('atr-vel').value);
    const hab = parseInt(document.getElementById('atr-hab').value);

    document.getElementById('val-atr-atq').innerText = atq;
    document.getElementById('val-atr-def').innerText = def;
    document.getElementById('val-atr-for').innerText = forca;
    document.getElementById('val-atr-vel').innerText = vel;
    document.getElementById('val-atr-hab').innerText = hab;

    const soma = atq + def + forca + vel + hab;
    const restantes = TETO_PONTOS - soma;

    const lblPontos = document.getElementById('pontos-restantes');
    lblPontos.innerText = restantes;
    lblPontos.style.color = restantes < 0 ? "#dc3545" : "var(--verde-campo)";
}

function salvarProPlayer(isNovo) {
    const lblPontos = parseInt(document.getElementById('pontos-restantes').innerText);
    if (lblPontos < 0) return alert(`Você ultrapassou o teto da comunidade! Remova ${Math.abs(lblPontos)} pontos.`);

    const atributosBase = {
        ataque: parseInt(document.getElementById('atr-atq').value),
        defesa: parseInt(document.getElementById('atr-def').value),
        forca: parseInt(document.getElementById('atr-for').value),
        velocidade: parseInt(document.getElementById('atr-vel').value),
        habilidade: parseInt(document.getElementById('atr-hab').value)
    };

    let objAtualizacao = { atributos_base: atributosBase };

    if (isNovo) {
        const nome = document.getElementById('pro-nome').value.trim();
        const pos = document.getElementById('pro-posicao').value;
        if (!nome) return alert("Dê um nome para a sua promessa!");

        objAtualizacao = { nome: nome, posicao: pos, criador: userLogado, atributos_base: atributosBase, status: "avaliando", ajuste_concluido: false };
    } else {
        let qtdVotos = meuProPlayer.avaliacoes ? Object.keys(meuProPlayer.avaliacoes).length : 0;
        if (qtdVotos >= 3) {
            if(!confirm("Atenção! Seus atributos serão travados permanentemente na base de dados para ir a leilão. Confirmar?")) return;
            objAtualizacao.ajuste_concluido = true;
            objAtualizacao.status = "ativo";
        }
    }

    db.ref(`ligas/${ligaLogada}/pro_players/${userLogado}`).update(objAtualizacao).then(() => {
        alert("Atleta registrado com sucesso!");
    });
}

// ========================================================
// 3. COMUNIDADE: AVALIAÇÃO DETALHADA (MODAL)
// ========================================================
let proPlayersAvaliacao = {};

function carregarAvaliacoesPendentes() {
    db.ref(`ligas/${ligaLogada}/pro_players`).on('value', snap => {
        const listaDiv = document.getElementById('lista-avaliacoes');
        proPlayersAvaliacao = snap.val();

        if (!proPlayersAvaliacao) { listaDiv.innerHTML = `<div style="text-align: center; padding: 20px; color: #666;">Fila vazia.</div>`; return; }

        listaDiv.innerHTML = ""; let temPendente = false;

        for (let dono in proPlayersAvaliacao) {
            if (dono === userLogado) continue;
            let player = proPlayersAvaliacao[dono];
            if (player.avaliacoes && player.avaliacoes[userLogado]) continue;

            temPendente = true;

            listaDiv.innerHTML += `
                <div style="background: #2a2a2a; border: 1px solid #444; padding: 10px; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #fff; font-size: 14px;">${player.nome}</strong><br>
                        <span style="font-size: 11px; color: #888;">Criador: @${dono} | Pos: ${player.posicao}</span>
                    </div>
                    <button onclick="abrirModalAvaliacao('${dono}')" style="background: var(--verde-campo); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight:bold;">Avaliar 🔎</button>
                </div>
            `;
        }

        if (!temPendente) {
            listaDiv.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--verde-campo);">Você já avaliou todos os jogadores pendentes! ✔️</div>`;
        }
    });
}

function abrirModalAvaliacao(dono) {
    let player = proPlayersAvaliacao[dono];
    if(!player) return;

    document.getElementById('modal-nome-jogador').innerText = player.nome;
    document.getElementById('modal-pos-jogador').innerText = player.posicao;

    const at = player.atributos_base;
    document.getElementById('modal-sliders').innerHTML = gerarSlidersHTML(at.ataque, at.defesa, at.forca, at.velocidade, at.habilidade, true, dono);

    document.getElementById('btn-confirmar-aval').setAttribute('onclick', `enviarAvaliacaoDetalhada('${dono}')`);

    // Ajusta a interface para o novo limite de Avaliador (Muda o texto dinamicamente)
    const lblPontos = document.getElementById('modal-pontos-restantes');
    if (lblPontos && lblPontos.previousElementSibling) {
        lblPontos.previousElementSibling.innerText = "Total Avaliado (Mín 270 / Máx 330):";
    }

    document.getElementById('modal-avaliacao').style.display = 'flex';
    calcularPontosAvaliacao(dono);
}

function fecharModalAvaliacao() {
    document.getElementById('modal-avaliacao').style.display = 'none';
}

function calcularPontosAvaliacao(dono) {
    const a = parseInt(document.getElementById(`atr-atq_${dono}`).value);
    const d = parseInt(document.getElementById(`atr-def_${dono}`).value);
    const f = parseInt(document.getElementById(`atr-for_${dono}`).value);
    const v = parseInt(document.getElementById(`atr-vel_${dono}`).value);
    const h = parseInt(document.getElementById(`atr-hab_${dono}`).value);

    document.getElementById(`val-atr-atq_${dono}`).innerText = a;
    document.getElementById(`val-atr-def_${dono}`).innerText = d;
    document.getElementById(`val-atr-for_${dono}`).innerText = f;
    document.getElementById(`val-atr-vel_${dono}`).innerText = v;
    document.getElementById(`val-atr-hab_${dono}`).innerText = h;

    const soma = a + d + f + v + h;
    const lbl = document.getElementById(`modal-pontos-restantes`);

    lbl.innerText = soma;
    // Pinta de vermelho se estourar o limite (menos que 270 ou mais que 330)
    lbl.style.color = (soma < 270 || soma > 330) ? "#dc3545" : "var(--verde-campo)";
}

function enviarAvaliacaoDetalhada(dono) {
    let soma = parseInt(document.getElementById(`modal-pontos-restantes`).innerText);

    // Travas exclusivas do Avaliador Comunitário
    if (soma < 270) return alert("A avaliação está muito baixa! Você deve distribuir no mínimo 270 pontos.");
    if (soma > 330) return alert("A avaliação estourou o limite! Você pode distribuir no máximo 330 pontos.");

    let avaliacao = {
        ataque: parseInt(document.getElementById(`atr-atq_${dono}`).value),
        defesa: parseInt(document.getElementById(`atr-def_${dono}`).value),
        forca: parseInt(document.getElementById(`atr-for_${dono}`).value),
        velocidade: parseInt(document.getElementById(`atr-vel_${dono}`).value),
        habilidade: parseInt(document.getElementById(`atr-hab_${dono}`).value),
        data: new Date().toISOString()
    };

    db.ref(`ligas/${ligaLogada}/pro_players/${dono}/avaliacoes/${userLogado}`).set(avaliacao).then(() => {
        fecharModalAvaliacao();
        alert("Avaliação registrada com sucesso!");
    });
}

function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    const menuAberto = sidebar.classList.toggle('aberta');
    if (menuAberto) document.body.classList.add('menu-aberto');
    else document.body.classList.remove('menu-aberto');
}

document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('aberta')) {
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('btn-menu')) {
            sidebar.classList.remove('aberta'); document.body.classList.remove('menu-aberto');
        }
        if (!e.target.closest('.sidebar') && !e.target.closest('.btn-menu')) {
            sidebar.classList.remove('aberta'); document.body.classList.remove('menu-aberto');
        }
    }
});

function deslogar() { localStorage.removeItem('treinadorLiga'); localStorage.removeItem('treinadorUsuario'); window.location.href = "index.html"; }