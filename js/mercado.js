// js/mercado.js

const ligaLogada = localStorage.getItem('treinadorLiga');
const userLogado = localStorage.getItem('treinadorUsuario');

if (!ligaLogada || !userLogado) window.location.href = "index.html";

let dadosUsuario = {};
let todosJogadores = [];
let meuElenco = []; // Adicione esta linha!
let saldoAtual = 0;

window.addEventListener('DOMContentLoaded', () => {
    db.ref(`ligas/${ligaLogada}/usuarios/${userLogado}`).once('value').then(snapshot => {
        dadosUsuario = snapshot.val();

        if(!dadosUsuario || dadosUsuario.timeAtual === "Sem Clube") {
            alert("Assine com um clube antes de entrar no mercado!");
            return window.location.href = "dashboard.html";
        }

        document.getElementById('nome-treinador').innerText = dadosUsuario.nome;
        document.getElementById('nome-time').innerText = dadosUsuario.timeAtual.replace(/_/g, ' ');
        saldoAtual = dadosUsuario.caixaClube || 0;
        document.getElementById('saldo-treinador').innerText = formatarDinheiro(saldoAtual);

        carregarMundo();
    });
});

function carregarMundo() {
    db.ref('banco_global_times').once('value').then(snap => {
        const banco = snap.val();
        todosJogadores = [];
        meuElenco = []; // Limpa o elenco

        for (let time in banco) {
            let elenco = banco[time].jogadores;
            for (let idJog in elenco) {
                let j = elenco[idJog];
                let at = j.atributos;
                let ovr = at.ataque + at.defesa + at.forca + at.velocidade + at.habilidade;

                let objJogador = {
                    id_banco: idJog,
                    nome: j.nome,
                    idade: j.idade || 20, // Puxa a idade do banco
                    clube: time.replace(/_/g, ' '),
                    posicao: j.posicoes.p,
                    forca: ovr,
                    atributos: at,
                    valor: j.valor_mercado
                };

                todosJogadores.push(objJogador);

                // Se o time do loop for o MEU TIME, salva o jogador na lista privada de trocas
                if (time === dadosUsuario.timeAtual) {
                    meuElenco.push(objJogador);
                }
            }
        }
        todosJogadores.sort((a, b) => b.forca - a.forca);
        renderizarMercado();
    });
}

function renderizarMercado(termoBusca = "") {
    const filtroPos = document.getElementById('filtro-posicao').value;
    const tbody = document.getElementById('tabela-mercado');
    tbody.innerHTML = "";

    let exibidos = 0;

    for (let i = 0; i < todosJogadores.length; i++) {
        let j = todosJogadores[i];

        if (filtroPos !== "TODOS") {
            if (filtroPos === "Atacante" && !["Atacante", "Ponta", "Centroavante"].includes(j.posicao)) continue;
            if (filtroPos !== "Atacante" && j.posicao !== filtroPos) continue;
        }

        if (termoBusca && !j.nome.toLowerCase().includes(termoBusca.toLowerCase())) continue;
        if (exibidos >= 50) break;

        let ehDoMeuTime = (j.clube === dadosUsuario.timeAtual.replace(/_/g, ' '));
        let btnAcao = ehDoMeuTime
            ? `<button disabled style="background:#555; border:none; padding:4px 8px; border-radius:4px; font-size:11px;">Seu Atleta</button>`
            : `<button onclick="fazerProposta('${j.id_banco}')" style="background:#ff8c00; border:none; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px;">Fazer Proposta</button>`;

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #333;">
                <td style="text-align: left; padding: 12px; font-weight: bold; color: #fff;">${j.nome}</td>
                <td style="font-size: 13px;">${j.posicao}</td>
                <td style="color: #ff8c00; font-weight: bold;">${j.forca}</td>
                <td style="font-size: 13px; color: #aaa;">${j.clube}</td>
                <td style="color: #ddd; font-size: 13px;">${formatarDinheiro(j.valor)}</td>
                <td>${btnAcao}</td>
            </tr>
        `;
        exibidos++;
    }
}

function pesquisarJogador() {
    const termo = document.getElementById('busca-jogador').value;
    renderizarMercado(termo);
}

// ========================================================
// NOVO SISTEMA DE PROPOSTAS COM OPÇÃO DE TROCAS
// ========================================================
let propostaPendente = { idJogador: null, nome: "", valorBase: 0, clubeDono: "" };

function fazerProposta(idJogador) {
    let j = todosJogadores.find(x => x.id_banco === idJogador);
    if (!j) return;

    propostaPendente = { idJogador: j.id_banco, nome: j.nome, valorBase: j.valor, clubeDono: j.clube };

    // Preenche o modal com o Raio-X do jogador
    document.getElementById('prop-nome-jogador').innerText = j.nome;
    document.getElementById('prop-clube-dono').innerText = j.clube;
    document.getElementById('prop-idade-jogador').innerText = j.idade + " anos";
    document.getElementById('prop-ovr-jogador').innerText = j.forca;

    document.getElementById('prop-atq').innerText = j.atributos.ataque;
    document.getElementById('prop-def').innerText = j.atributos.defesa;
    document.getElementById('prop-for').innerText = j.atributos.forca;
    document.getElementById('prop-vel').innerText = j.atributos.velocidade;
    document.getElementById('prop-hab').innerText = j.atributos.habilidade;

    document.getElementById('prop-valor-base').innerText = formatarDinheiro(j.valor);
    document.getElementById('prop-seu-caixa').innerText = formatarDinheiro(saldoAtual);

    document.getElementById('input-valor-proposta').value = j.valor;

    // Popula o select com os seus próprios jogadores
    const selectTroca = document.getElementById('select-jogador-troca');
    selectTroca.innerHTML = '<option value="">Nenhum - Apenas Dinheiro</option>';

    // Organiza seu elenco do mais caro pro mais barato pra facilitar a busca
    meuElenco.sort((a,b) => b.valor - a.valor).forEach(j => {
        selectTroca.innerHTML += `<option value="${j.id_banco}">${j.nome} (OVR: ${j.forca}) - Passe: ${formatarDinheiro(j.valor)}</option>`;
    });

    document.getElementById('modal-proposta').style.display = 'flex';
}

function fecharModalProposta() {
    document.getElementById('modal-proposta').style.display = 'none';
    propostaPendente = { idJogador: null, nome: "", valorBase: 0, clubeDono: "" };
}

function confirmarProposta() {
    let valorSugerido = parseInt(document.getElementById('input-valor-proposta').value);
    let idJogadorTroca = document.getElementById('select-jogador-troca').value;

    // Se ele deixou o campo de dinheiro vazio mas ofereceu um jogador, consideramos R$ 0 em dinheiro
    if (isNaN(valorSugerido)) valorSugerido = 0;

    // Remove bordas vermelhas de tentativas anteriores
    document.getElementById('input-valor-proposta').style.borderColor = '#555';
    document.getElementById('prop-seu-caixa').style.color = 'var(--verde-campo)';

    // Validação: Tem que oferecer pelo menos dinheiro OU um jogador
    if (valorSugerido <= 0 && !idJogadorTroca) {
        document.getElementById('input-valor-proposta').style.borderColor = '#dc3545';
        return;
    }

    // Validação: Checa se tem o saldo em caixa
    if (valorSugerido > saldoAtual) {
        document.getElementById('input-valor-proposta').style.borderColor = '#dc3545';
        document.getElementById('prop-seu-caixa').style.color = '#dc3545';
        return;
    }

    // Monta a Proposta (com ou sem jogador)
    let propostaObj = {
        time_comprador: dadosUsuario.timeAtual,
        valor_oferecido: valorSugerido,
        data_proposta: new Date().toISOString()
    };

    if (idJogadorTroca) {
        propostaObj.id_jogador_oferecido = idJogadorTroca;
    }

    // Grava a proposta no Firebase
    db.ref(`ligas/${ligaLogada}/mercado_propostas/${propostaPendente.idJogador}/${userLogado}`).set(propostaObj).then(() => {
        fecharModalProposta();

        // Tela de sucesso imersiva
        const modal = document.getElementById('modal-proposta');
        modal.innerHTML = `
            <div style="background: var(--card-bg); width: 100%; max-width: 400px; border-radius: 12px; border: 1px solid #00b853; text-align: center; padding: 30px;">
                <h2 style="color: #00b853; margin-top: 0;">📄 Oferta Enviada!</h2>
                <p style="color: #ccc;">A diretoria analisará os valores ${idJogadorTroca ? 'e o atleta envolvido na troca' : 'oferecidos'} e responderá no fim do dia (Aguarde o Motor P2P rodar!).</p>
                <button onclick="window.location.reload()" style="background: #333; color: white; border: 1px solid #555; padding: 8px 20px; border-radius: 6px; margin-top: 15px; cursor: pointer;">Fechar</button>
            </div>
        `;
        modal.style.display = 'flex';
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