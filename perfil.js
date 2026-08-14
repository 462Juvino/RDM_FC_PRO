// js/perfil.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
const TETO_PONTOS = 300;

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const snapUser = await db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value');
        dadosUsuario = snapUser.val();

        if(!dadosUsuario) return window.location.href = "index.html";

        document.getElementById('nome-treinador').innerText = dadosUsuario.nome;
        document.getElementById('nome-time').innerText = dadosUsuario.timeAtual !== "Sem Clube" ? dadosUsuario.timeAtual.replace(/_/g, ' ') : "Sem Clube";

        // Verifica se eu já criei meu Pro Player
        checarMeuProPlayer();

        // Carrega jogadores dos outros para eu avaliar
        carregarAvaliacoesPendentes();

        calcularPontos(); // Inicializa os sliders
    } catch (e) { console.error(e); }
});

// ========================================================
// 1. CRIAÇÃO DO PRO PLAYER (TETO DE PONTOS)
// ========================================================
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

    if (restantes < 0) {
        lblPontos.style.color = "#dc3545"; // Ficou vermelho, estourou o limite!
    } else {
        lblPontos.style.color = "var(--verde-campo)";
    }
}

function salvarProPlayer() {
    const nome = document.getElementById('pro-nome').value.trim();
    const pos = document.getElementById('pro-posicao').value;
    const lblPontos = parseInt(document.getElementById('pontos-restantes').innerText);

    if (!nome) return alert("Dê um nome para a sua promessa!");
    if (lblPontos < 0) return alert(`Você ultrapassou o teto inicial! Remova ${Math.abs(lblPontos)} pontos.`);

    const atributosBase = {
        ataque: parseInt(document.getElementById('atr-atq').value),
        defesa: parseInt(document.getElementById('atr-def').value),
        forca: parseInt(document.getElementById('atr-for').value),
        velocidade: parseInt(document.getElementById('atr-vel').value),
        habilidade: parseInt(document.getElementById('atr-hab').value)
    };

    const objPlayer = {
        nome: nome,
        posicao: pos,
        criador: userLogado,
        atributos_base: atributosBase,
        status: "avaliando", // Vai pro mercado só na rodada 5
        avaliacoes: {} // Fica aguardando a galera votar
    };

    db.ref(`ligas/${ligaLogada}/pro_players/${userLogado}`).set(objPlayer).then(() => {
        alert("Atleta criado com sucesso! Agora a liga será notificada para avaliar seu potencial.");
        checarMeuProPlayer();
    });
}

function checarMeuProPlayer() {
    db.ref(`ligas/${ligaLogada}/pro_players/${userLogado}`).on('value', snap => {
        if (snap.exists()) {
            const meucraque = snap.val();
            let qtdAvaliacoes = meucraque.avaliacoes ? Object.keys(meucraque.avaliacoes).length : 0;

            document.getElementById('box-criar-player').innerHTML = `
                <h3 style="color: var(--verde-campo);">Seu Craque: ${meucraque.nome}</h3>
                <p style="color: #aaa; font-size: 14px;">Posição: <strong>${meucraque.posicao}</strong></p>
                <div style="background: rgba(0,184,83,0.1); padding: 15px; border-radius: 8px; border: 1px dashed var(--verde-campo); margin-top: 15px; text-align: center;">
                    <h4 style="margin: 0 0 10px 0; color: #fff;">Status: <span style="color: #ff8c00;">Aguardando 5ª Rodada</span></h4>
                    <p style="margin: 0; color: #ccc; font-size: 13px;">${qtdAvaliacoes} treinadores já avaliaram seu jogador.</p>
                </div>
            `;
        }
    });
}

// ========================================================
// 2. COMUNIDADE: AVALIAR O JOGADOR DOS OUTROS
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
            // Não avalia o próprio jogador
            if (dono === userLogado) continue;

            let player = proPlayers[dono];

            // Verifica se EU já votei nesse cara
            if (player.avaliacoes && player.avaliacoes[userLogado]) continue;

            temPendente = true;

            // Soma a base que o cara criou pra mostrar pro Olheiro
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
        alert("Avaliação enviada! A média da liga definirá os atributos finais.");
    });
}

function toggleMenu() { document.querySelector('.sidebar').classList.toggle('aberta'); }
function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}