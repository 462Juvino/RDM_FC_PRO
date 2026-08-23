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

// ========================================================
// 1. CHECAGEM E RENDERIZAÇÃO DO PRO PLAYER
// ========================================================
function checarMeuProPlayer() {
    db.ref(`ligas/${ligaLogada}/pro_players/${userLogado}`).on('value', snap => {
        const box = document.getElementById('box-criar-player');

        if (snap.exists()) {
            meuProPlayer = snap.val();
            renderizarPainelEvolucao();
        } else {
            // SE NÃO EXISTE, MOSTRA A TELA DE CRIAÇÃO ORIGINAL
            TETO_PONTOS = 300;
            box.innerHTML = `
                <h3 style="color: #ff8c00;">Forjar Promessa (Pro Player)</h3>
                <p style="font-size: 13px; color: #ccc;">Crie um jogador com um teto de <strong>300 pontos</strong> iniciais. Os outros avaliarão seu atleta!</p>
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

function gerarSlidersHTML(a, d, f, v, h) {
    return `
        <div class="atributo-slider"><span>Ataque:</span> <input type="range" id="atr-atq" min="10" max="90" value="${a}" oninput="calcularPontos()"> <span id="val-atq">${a}</span></div>
        <div class="atributo-slider"><span>Defesa:</span> <input type="range" id="atr-def" min="10" max="90" value="${d}" oninput="calcularPontos()"> <span id="val-def">${d}</span></div>
        <div class="atributo-slider"><span>Força:</span> <input type="range" id="atr-for" min="10" max="90" value="${f}" oninput="calcularPontos()"> <span id="val-for">${f}</span></div>
        <div class="atributo-slider"><span>Veloc.:</span> <input type="range" id="atr-vel" min="10" max="90" value="${v}" oninput="calcularPontos()"> <span id="val-vel">${v}</span></div>
        <div class="atributo-slider"><span>Habil.:</span> <input type="range" id="atr-hab" min="10" max="90" value="${h}" oninput="calcularPontos()"> <span id="val-hab">${h}</span></div>
    `;
}

function renderizarPainelEvolucao() {
    const box = document.getElementById('box-criar-player');
    let at = meuProPlayer.atributos_base;
    let qtdVotos = meuProPlayer.avaliacoes ? Object.keys(meuProPlayer.avaliacoes).length : 0;

    // Calcula Média
    let media = 3; // Média padrão neutra
    if (qtdVotos > 0) {
        let soma = 0;
        for(let v in meuProPlayer.avaliacoes) soma += parseInt(meuProPlayer.avaliacoes[v].nota_estrelas);
        media = (soma / qtdVotos).toFixed(1);
    }

    // Lógica de Ganho/Perda de pontos baseado na avaliação da liga
    // Se a liga achou ele craque (> 3.5), ganha até +15 pts. Se achou bagre (< 2.5), perde -15 pts.
    let bonusPontos = 0;
    if (qtdVotos >= 3) { // Só aplica bônus se pelo menos 3 pessoas votaram
        if (media >= 4.0) bonusPontos = 15;
        else if (media >= 3.5) bonusPontos = 10;
        else if (media <= 2.0) bonusPontos = -15;
        else if (media <= 2.5) bonusPontos = -10;
    }

    // Teto novo baseado na reputação
    TETO_PONTOS = 300 + bonusPontos;

    // Dispara a Notificação Visual
    if (qtdVotos >= 3 && !meuProPlayer.ajuste_concluido) {
        document.getElementById('alerta-notificacao').style.display = "block";
        document.getElementById('painel-notificacao').style.display = "block";

        let msg = bonusPontos > 0
            ? `Boas notícias! A liga avaliou seu atleta com média <strong>${media}⭐</strong>. Você ganhou <strong>+${bonusPontos} Pts extras</strong> para distribuir!`
            : (bonusPontos < 0 ? `Má notícia... A liga achou seu atleta fraco (Média <strong>${media}⭐</strong>). O seu teto caiu, remova <strong>${Math.abs(bonusPontos)} Pts</strong> dos atributos!` : `A liga avaliou seu atleta na média. Os pontos estão equilibrados.`);

        document.getElementById('texto-notificacao').innerHTML = msg;
    } else {
        document.getElementById('alerta-notificacao').style.display = "none";
        document.getElementById('painel-notificacao').style.display = "none";
    }

    // Se o usuário já concluiu o ajuste final da temporada, a tela trava!
    if (meuProPlayer.ajuste_concluido) {
        box.innerHTML = `
            <h3 style="color: var(--verde-campo);">Craque Formado: ${meuProPlayer.nome}</h3>
            <div style="background: #111; padding: 15px; border-radius: 8px; border: 1px solid #333; margin-bottom: 15px;">
                <p style="margin-top:0; color:#aaa; font-size:13px;">Posição: <strong>${meuProPlayer.posicao}</strong></p>
                <p style="color:#aaa; font-size:13px;">Força OVR Oficial: <strong style="color:var(--verde-campo);">${at.ataque + at.defesa + at.forca + at.velocidade + at.habilidade}</strong></p>
                <hr style="border-color:#333; margin: 10px 0;">
                <p style="color: #666; font-size: 12px; margin-bottom:0;">O seu atleta já está devidamente registrado na base de dados final e avaliado pela liga. Nenhuma alteração a mais pode ser feita.</p>
            </div>
        `;
    } else {
        // Se ainda não concluiu, exibe os sliders com os valores atuais para ele arrumar
        box.innerHTML = `
            <h3 style="color: var(--verde-campo);">Ajuste seu Craque: ${meuProPlayer.nome}</h3>
            <p style="font-size: 13px; color: #ccc;">Sua reputação na liga: <strong>${qtdVotos > 0 ? media + '⭐' : 'Aguardando votos'}</strong></p>
            <div style="background: #111; padding: 15px; border-radius: 8px; border: 1px dashed #444; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #aaa; font-size: 13px;">Pontos Max: <strong>${TETO_PONTOS}</strong> | Restantes:</span>
                    <strong id="pontos-restantes" style="color: var(--verde-campo);">0</strong>
                </div>
                ${gerarSlidersHTML(at.ataque, at.defesa, at.forca, at.velocidade, at.habilidade)}
            </div>
            <button onclick="salvarProPlayer(false)" style="background: #ff8c00; width: 100%; padding: 10px; border-radius: 6px; font-weight: bold; color: white; border: none; cursor: pointer;">${qtdVotos >= 3 ? "✅ Finalizar e Travar Atleta" : "💾 Atualizar Atributos"}</button>
            ${qtdVotos < 3 ? '<p style="font-size: 11px; color: #666; text-align:center; margin-top: 10px;">Aguarde pelo menos 3 votos da liga para o bloqueio definitivo e liberação no mercado.</p>' : ''}
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

    document.getElementById('val-atq').innerText = atq;
    document.getElementById('val-def').innerText = def;
    document.getElementById('val-for').innerText = forca;
    document.getElementById('val-vel').innerText = vel;
    document.getElementById('val-hab').innerText = hab;

    const soma = atq + def + forca + vel + hab;
    const restantes = TETO_PONTOS - soma;

    const lblPontos = document.getElementById('pontos-restantes');
    lblPontos.innerText = restantes;
    lblPontos.style.color = restantes < 0 ? "#dc3545" : "var(--verde-campo)";
}

function salvarProPlayer(isNovo) {
    const lblPontos = parseInt(document.getElementById('pontos-restantes').innerText);

    if (lblPontos < 0) return alert(`Você ultrapassou o teto! Remova ${Math.abs(lblPontos)} pontos.`);

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

        objAtualizacao = {
            nome: nome,
            posicao: pos,
            criador: userLogado,
            atributos_base: atributosBase,
            status: "avaliando",
            ajuste_concluido: false
        };
    } else {
        // Se está atualizando e já tem 3 votos, ele "trava" o jogador pra sempre
        let qtdVotos = meuProPlayer.avaliacoes ? Object.keys(meuProPlayer.avaliacoes).length : 0;
        if (qtdVotos >= 3) {
            if(!confirm("Atenção! Ao finalizar a evolução, seus atributos serão travados permanentemente na base de dados. Confirmar?")) return;
            objAtualizacao.ajuste_concluido = true;
            objAtualizacao.status = "ativo"; // Pode entrar no mercado!
        }
    }

    db.ref(`ligas/${ligaLogada}/pro_players/${userLogado}`).update(objAtualizacao).then(() => {
        alert("Atleta registrado/atualizado com sucesso!");
    });
}

// ========================================================
// 3. COMUNIDADE: AVALIAR O JOGADOR DOS OUTROS (Inalterado)
// ========================================================
function carregarAvaliacoesPendentes() {
    db.ref(`ligas/${ligaLogada}/pro_players`).on('value', snap => {
        const listaDiv = document.getElementById('lista-avaliacoes');
        const proPlayers = snap.val();

        if (!proPlayers) {
            listaDiv.innerHTML = `<div style="text-align: center; padding: 20px; color: #666;">Nenhum jogador na fila de avaliação.</div>`;
            return;
        }

        listaDiv.innerHTML = "";
        let temPendente = false;

        for (let dono in proPlayers) {
            if (dono === userLogado) continue;
            let player = proPlayers[dono];
            if (player.avaliacoes && player.avaliacoes[userLogado]) continue;

            temPendente = true;
            let baseOvr = player.atributos_base.ataque + player.atributos_base.defesa + player.atributos_base.forca + player.atributos_base.velocidade + player.atributos_base.habilidade;

            listaDiv.innerHTML += `
                <div style="background: #2a2a2a; border: 1px solid #444; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <strong style="color: #fff; font-size: 15px;">${player.nome}</strong><br>
                            <span style="font-size: 11px; color: #888;">Criado por: @${dono} | Pos: ${player.posicao} | Base: ${baseOvr}</span>
                        </div>
                    </div>
                    <p style="font-size: 12px; color: #ccc; margin-top: 0;">Qual o potencial real deste atleta?</p>
                    <div style="display: flex; gap: 5px;">
                        <button onclick="enviarNota('${dono}', 1)" style="flex:1; background: #dc3545; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;">👎 Bagre</button>
                        <button onclick="enviarNota('${dono}', 3)" style="flex:1; background: #ff8c00; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;">😐 Médio</button>
                        <button onclick="enviarNota('${dono}', 5)" style="flex:1; background: #00b853; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;">⭐ Craque</button>
                    </div>
                </div>
            `;
        }

        if (!temPendente) {
            listaDiv.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--verde-campo);">Você já avaliou todos os jogadores pendentes! ✔️</div>`;
        }
    });
}

function enviarNota(donoPlayer, nota) {
    db.ref(`ligas/${ligaLogada}/pro_players/${donoPlayer}/avaliacoes/${userLogado}`).set({
        nota_estrelas: nota,
        data: new Date().toISOString()
    }).then(() => {
        alert("Avaliação enviada!");
    });
}

function toggleMenu() { document.querySelector('.sidebar').classList.toggle('aberta'); }
function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}