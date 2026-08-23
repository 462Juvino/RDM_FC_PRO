// js/pelada.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let proPlayersDB = []; // Lista de todos do Firebase
let jogadoresSelecionados = []; // Quem vai jogar a pelada

window.addEventListener('DOMContentLoaded', () => {
    db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value').then(snap => {
        let dadosUser = snap.val();
        if(dadosUser) document.getElementById('nome-treinador').innerText = dadosUser.nome;
    });

    carregarProPlayers();
});

function carregarProPlayers() {
    db.ref(`ligas/${ligaLogada}/pro_players`).on('value', snap => {
        const dados = snap.val();
        proPlayersDB = [];

        if (dados) {
            for (let criador in dados) {
                let p = dados[criador];
                // Pega o OVR final (ou calcula o base caso ainda não tenha sido avaliado)
                let forcaBase = p.atributos_base.ataque + p.atributos_base.defesa + p.atributos_base.forca + p.atributos_base.velocidade + p.atributos_base.habilidade;
                let forcaFinal = p.ovr_final ? p.ovr_final : forcaBase;

                proPlayersDB.push({
                    id: criador,
                    nome: p.nome,
                    ovr: forcaFinal,
                    tipo: 'PRO'
                });
            }
        }
        renderizarListaProPlayers();
    });
}

function renderizarListaProPlayers() {
    const listaDiv = document.getElementById('lista-pro-players');
    listaDiv.innerHTML = "";

    if (proPlayersDB.length === 0) {
        listaDiv.innerHTML = `<div style="color: #666; text-align: center;">Nenhum Pro Player criado nesta liga.</div>`;
        return;
    }

    proPlayersDB.forEach(p => {
        // Verifica se ele já está na lista de selecionados
        let taSelecionado = jogadoresSelecionados.some(j => j.id === p.id);

        let corFundo = taSelecionado ? "var(--verde-campo)" : "#1a1a1a";
        let corTexto = taSelecionado ? "#fff" : "#ccc";

        listaDiv.innerHTML += `
            <div onclick="toggleSelecaoProPlayer('${p.id}')" style="background: ${corFundo}; color: ${corTexto}; border: 1px solid #444; padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; cursor: pointer; transition: 0.2s;">
                <strong>${p.nome}</strong>
                <span style="font-size: 12px; opacity: 0.8;">OVR: ${p.ovr}</span>
            </div>
        `;
    });
}

function toggleSelecaoProPlayer(idPlayer) {
    let index = jogadoresSelecionados.findIndex(j => j.id === idPlayer);

    if (index === -1) {
        // Adiciona
        let p = proPlayersDB.find(x => x.id === idPlayer);
        jogadoresSelecionados.push(p);
    } else {
        // Remove
        jogadoresSelecionados.splice(index, 1);
    }

    atualizarPainelSelecionados();
}

function adicionarConvidado() {
    const input = document.getElementById('input-convidado');
    const nomeConvidado = input.value.trim();

    if (!nomeConvidado) return alert("Digite o nome do convidado!");

    jogadoresSelecionados.push({
        id: "CONV_" + Math.random().toString(36).substr(2, 9),
        nome: "(Convidado) " + nomeConvidado,
        ovr: 75, // OVR Médio Padrão de Balanceamento
        tipo: 'CONVIDADO'
    });

    input.value = "";
    atualizarPainelSelecionados();
}

function removerSelecionado(id) {
    jogadoresSelecionados = jogadoresSelecionados.filter(j => j.id !== id);
    atualizarPainelSelecionados();
}

function atualizarPainelSelecionados() {
    renderizarListaProPlayers(); // Atualiza as cores do painel esquerdo

    const painelDir = document.getElementById('lista-selecionados');
    document.getElementById('contador-jogadores').innerText = jogadoresSelecionados.length;

    if (jogadoresSelecionados.length === 0) {
        painelDir.innerHTML = `<span style="color: #666; width: 100%; text-align: center; margin-top: 20px;">Ninguém selecionado ainda.</span>`;
        return;
    }

    painelDir.innerHTML = "";
    jogadoresSelecionados.forEach(j => {
        painelDir.innerHTML += `
            <div style="background: #222; border: 1px solid #444; padding: 5px 10px; border-radius: 20px; font-size: 12px; color: #fff; display: flex; align-items: center; gap: 8px;">
                ${j.nome}
                <button onclick="removerSelecionado('${j.id}')" style="background: transparent; color: #dc3545; border: none; font-size: 14px; cursor: pointer; padding: 0; width: auto; margin: 0;">&times;</button>
            </div>
        `;
    });
}

// ========================================================
// O CÉREBRO: ALGORITMO SNAKE PARA BALANCEAMENTO DE TIMES
// ========================================================
function sortearTimesPelada() {
    if (jogadoresSelecionados.length < 2) {
        return alert("Você precisa de pelo menos 2 jogadores para formar times!");
    }

    // Define a quantidade de times (Times de até 5 pessoas)
    let qtdTimes = Math.ceil(jogadoresSelecionados.length / 5);

    // Cria os times vazios
    let times = Array.from({length: qtdTimes}, (_, i) => ({
        nome: `Equipe ${i + 1}`,
        jogadores: [],
        forcaTotal: 0
    }));

    // Ordena os jogadores do MELHOR para o PIOR
    let pool = [...jogadoresSelecionados].sort((a, b) => b.ovr - a.ovr);

    // Distribuição "Snake" (Serpente): 1, 2, 3 -> 3, 2, 1 -> 1, 2, 3...
    let direcao = 1;
    let indexTime = 0;

    for (let i = 0; i < pool.length; i++) {
        times[indexTime].jogadores.push(pool[i]);
        times[indexTime].forcaTotal += pool[i].ovr;

        if (direcao === 1) {
            indexTime++;
            if (indexTime >= qtdTimes) {
                indexTime = qtdTimes - 1; // Para no último
                direcao = -1; // Começa a voltar
            }
        } else {
            indexTime--;
            if (indexTime < 0) {
                indexTime = 0; // Para no primeiro
                direcao = 1; // Começa a subir de novo
            }
        }
    }

    renderizarResultadoSorteio(times);
}

function renderizarResultadoSorteio(times) {
    document.getElementById('container-resultados').style.display = "block";
    const grid = document.getElementById('grid-times');
    grid.innerHTML = "";

    // Paleta de cores para os coletes
    const cores = ["#00b853", "#007bff", "#dc3545", "#ffc107", "#6f42c1", "#e83e8c"];

    times.forEach((t, index) => {
        let corColete = cores[index % cores.length];

        // Calcula OVR Médio do Time para exibir
        let mediaTime = t.jogadores.length > 0 ? Math.round(t.forcaTotal / t.jogadores.length) : 0;

        let listaHTML = "";
        t.jogadores.forEach(j => {
            let ehConvidado = j.tipo === 'CONVIDADO' ? `<span style="font-size:10px; color:#888;">(Convidado)</span>` : `<span style="font-size:10px; color:#ff8c00;">(PRO - ${j.ovr})</span>`;
            listaHTML += `<li style="padding: 6px 0; border-bottom: 1px dashed #444; display: flex; justify-content: space-between;"> <span style="color: #ddd;">${j.nome.replace('(Convidado) ', '')}</span> ${ehConvidado}</li>`;
        });

        grid.innerHTML += `
            <div style="background: var(--card-bg); border-top: 4px solid ${corColete}; border-radius: 8px; padding: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0; color: ${corColete}; text-transform: uppercase;">${t.nome}</h3>
                    <span style="background: #111; border: 1px solid #333; padding: 3px 8px; border-radius: 4px; font-size: 11px; color: #ccc;">Nível Médio: ${mediaTime}</span>
                </div>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    ${listaHTML}
                </ul>
            </div>
        `;
    });

    // Rola a tela para baixo para ver os resultados suavemente
    document.getElementById('container-resultados').scrollIntoView({ behavior: "smooth" });
}

function toggleMenu() { document.querySelector('.sidebar').classList.toggle('aberta'); }
function deslogar() {
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}