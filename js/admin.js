// js/admin.js

// 1. PROTEÇÃO DE ROTA E CARREGAMENTO DE LIGAS
window.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (!user || user.email !== "rafael@adm.com") {
            window.location.href = "index.html";
        } else {
            // Carrega as Ligas para evitar que o ADM precise digitar códigos
            db.ref('ligas').on('value', snap => {
                const ligas = snap.val();
                let options = `<option value="">Selecione a Liga...</option>`;
                for(let l in ligas) {
                    options += `<option value="${l}">${ligas[l].nome_servidor} (${l})</option>`;
                }

                const selectSorteio = document.getElementById('sorteio-liga-id');
                const selectGerenciar = document.getElementById('gerenciar-liga-id');

                if(selectSorteio) selectSorteio.innerHTML = options;
                if(selectGerenciar) selectGerenciar.innerHTML = options;
            });

            // Carrega a lista de Times Globais para o Gerenciador de Escudos
            db.ref('banco_global_times').on('value', snap => {
                const times = snap.val();
                let optionsTimes = `<option value="">Selecione o Time...</option>`;
                if (times) {
                    // Ordena os times por ordem alfabética para facilitar a busca do ADM
                    let arrayTimes = Object.keys(times).sort();
                    arrayTimes.forEach(t => {
                        optionsTimes += `<option value="${t}">${t.replace(/_/g, ' ')}</option>`;
                    });
                }
                const selEscudo = document.getElementById('select-time-escudo');
                if (selEscudo) selEscudo.innerHTML = optionsTimes;
            });
        }
    });
});

// ========================================================
// SISTEMA UNIFICADO DE JANELAS (MODAL)
// ========================================================
function exibirModal(titulo, conteudoHTML) {
    const tituloModal = document.querySelector('#modal-relatorio h3');
    if (tituloModal) tituloModal.innerHTML = titulo;
    document.getElementById('conteudo-relatorio').innerHTML = conteudoHTML;
    document.getElementById('modal-relatorio').style.display = 'flex';
}

function fecharModalRelatorio() {
    document.getElementById('modal-relatorio').style.display = 'none';
}

let acaoPendente = null;
function pedirConfirmacao(mensagem, acaoCallback) {
    document.getElementById('texto-confirmacao').innerText = mensagem;
    document.getElementById('modal-confirmacao').style.display = 'flex';
    acaoPendente = acaoCallback;
}

function fecharConfirmacao() {
    document.getElementById('modal-confirmacao').style.display = 'none';
    acaoPendente = null;
}

function executarConfirmacao() {
    let acaoSalva = acaoPendente; // Guarda a ação ANTES de fechar a tela!
    fecharConfirmacao();
    if (typeof acaoSalva === 'function') acaoSalva();
}

// ========================================================
// FUNÇÕES GERAIS DE LIGA E TIMES
// ========================================================
function criarLiga() {
    const codigo = document.getElementById('adm-codigo-liga').value.trim().toUpperCase();
    const nome = document.getElementById('adm-nome-liga').value.trim();

    if (!codigo || !nome) return exibirModal("⚠️ Atenção", "<p style='text-align:center;'>Preencha o código e o nome da liga!</p>");

    db.ref('ligas/' + codigo).set({
        nome_servidor: nome,
        criadaEm: new Date().toISOString()
    }).then(() => {
        exibirModal("✅ Sucesso", `<p style='text-align:center; color: var(--verde-campo);'>Liga <strong>${nome}</strong> (${codigo}) criada com sucesso!</p>`);
        document.getElementById('adm-codigo-liga').value = "";
        document.getElementById('adm-nome-liga').value = "";
    }).catch(erro => exibirModal("❌ Erro", `<p>Erro ao criar liga: ${erro.message}</p>`));
}

// ========================================================
// 4. MOTOR DE INJEÇÃO (BASE OFICIAL DO USUÁRIO)
// ========================================================
function injetarTimesIniciais() {
    pedirConfirmacao("Segurança: Injetar a base apagará o banco de times atual e recriará os clubes oficiais da sua base de dados. Tem certeza?", () => {
        exibirModal("⏳ Processando", "<p style='text-align:center;'>Injetando times oficiais e reservas no servidor... Aguarde.</p>");

        // 1. COLE AQUI A SUA CONSTANTE DE TITULARES
        const baseDeTimes = {
            "Athletico-PR":{divisao:"A",forca_base:0,jogadores:{"Mycael":{nome:"Mycael",idade:20,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:7,velocidade:6,habilidade:8},valor_mercado:6000000},"Benavidez":{nome:"Benavídez",idade:26,posicoes:{p:"Lateral",s:"Meia",t:"Ponta"},atributos:{ataque:8,defesa:8,forca:7,velocidade:11,habilidade:8},valor_mercado:7500000},"Aguirre":{nome:"Aguirre",idade:24,posicoes:{p:"Zagueiro",s:"Volante",t:"Lateral"},atributos:{ataque:3,defesa:11,forca:12,velocidade:6,habilidade:4},valor_mercado:8000000},"Arthur_Dias":{nome:"Arthur Dias",idade:22,posicoes:{p:"Zagueiro",s:"Volante",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:11,velocidade:7,habilidade:4},valor_mercado:5000000},"Gilberto":{nome:"Gilberto",idade:31,posicoes:{p:"Lateral",s:"Ponta",t:"Meia"},atributos:{ataque:9,defesa:6,forca:6,velocidade:8,habilidade:9},valor_mercado:4000000},"Jadson":{nome:"Jadson",idade:30,posicoes:{p:"Volante",s:"Zagueiro",t:"Meia"},atributos:{ataque:4,defesa:11,forca:10,velocidade:6,habilidade:7},valor_mercado:6000000},"Luiz_Gustavo":{nome:"Luiz Gustavo",idade:36,posicoes:{p:"Meia",s:"Volante",t:"Nenhuma"},atributos:{ataque:6,defesa:9,forca:8,velocidade:4,habilidade:11},valor_mercado:2500000},"Leo_Derik":{nome:"Léo Derik",idade:21,posicoes:{p:"Meia",s:"Ponta",t:"Atacante"},atributos:{ataque:7,defesa:3,forca:5,velocidade:10,habilidade:11},valor_mercado:9000000},"Mendoza":{nome:"Mendoza",idade:32,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:10,defesa:2,forca:7,velocidade:8,habilidade:9},valor_mercado:4500000},"Leozinho":{nome:"Leozinho",idade:25,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:6,velocidade:11,habilidade:10},valor_mercado:8500000},"Viveros":{nome:"Viveros",idade:27,posicoes:{p:"Atacante",s:"Centroavante",t:"Ponta"},atributos:{ataque:11,defesa:2,forca:9,velocidade:9,habilidade:8},valor_mercado:10000000},}},
            "Atletico-MG":{divisao:"A",forca_base:0,jogadores:{"Everson":{nome:"Éverson",idade:34,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:12,forca:8,velocidade:4,habilidade:9},valor_mercado:5000000},"Saravia":{nome:"Saravia",idade:31,posicoes:{p:"Lateral",s:"Volante",t:"Meia"},atributos:{ataque:7,defesa:9,forca:7,velocidade:8,habilidade:8},valor_mercado:6000000},"Battaglia":{nome:"Battaglia",idade:33,posicoes:{p:"Zagueiro",s:"Volante",t:"Nenhuma"},atributos:{ataque:4,defesa:12,forca:11,velocidade:5,habilidade:7},valor_mercado:7000000},"Junior_Alonso":{nome:"Junior Alonso",idade:31,posicoes:{p:"Zagueiro",s:"Lateral",t:"Volante"},atributos:{ataque:3,defesa:12,forca:10,velocidade:6,habilidade:8},valor_mercado:8500000},"Guilherme_Arana":{nome:"Guilherme Arana",idade:27,posicoes:{p:"Lateral",s:"Meia",t:"Ponta"},atributos:{ataque:10,defesa:8,forca:7,velocidade:11,habilidade:12},valor_mercado:18000000},"Otavio":{nome:"Otávio",idade:30,posicoes:{p:"Volante",s:"Meia",t:"Zagueiro"},atributos:{ataque:4,defesa:11,forca:9,velocidade:7,habilidade:8},valor_mercado:10000000},"Alan_Franco":{nome:"Alan Franco",idade:25,posicoes:{p:"Volante",s:"Meia",t:"Lateral"},atributos:{ataque:6,defesa:10,forca:8,velocidade:8,habilidade:9},valor_mercado:12000000},"Gustavo_Scarpa":{nome:"Gustavo Scarpa",idade:30,posicoes:{p:"Meia",s:"Ponta",t:"Lateral"},atributos:{ataque:9,defesa:4,forca:6,velocidade:7,habilidade:13},valor_mercado:15000000},"Bernard":{nome:"Bernard",idade:31,posicoes:{p:"Meia",s:"Ponta",t:"Atacante"},atributos:{ataque:8,defesa:2,forca:4,velocidade:8,habilidade:12},valor_mercado:9000000},"Paulinho":{nome:"Paulinho",idade:24,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:12,defesa:3,forca:7,velocidade:12,habilidade:11},valor_mercado:22000000},"Hulk":{nome:"Hulk",idade:38,posicoes:{p:"Atacante",s:"Centroavante",t:"Ponta"},atributos:{ataque:13,defesa:2,forca:13,velocidade:5,habilidade:10},valor_mercado:8000000}}},
            "Bahia":{divisao:"A",forca_base:0,jogadores:{"Marcos_Felipe":{nome:"Marcos Felipe",idade:28,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:7,velocidade:6,habilidade:7},valor_mercado:7000000},"Santiago_Arias":{nome:"Santiago Arias",idade:32,posicoes:{p:"Lateral",s:"Volante",t:"Nenhuma"},atributos:{ataque:7,defesa:9,forca:8,velocidade:6,habilidade:8},valor_mercado:5000000},"Gabriel_Xavier":{nome:"Gabriel Xavier",idade:23,posicoes:{p:"Zagueiro",s:"Volante",t:"Nenhuma"},atributos:{ataque:3,defesa:11,forca:11,velocidade:7,habilidade:5},valor_mercado:9000000},"Kanu":{nome:"Kanu",idade:27,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:12,velocidade:6,habilidade:4},valor_mercado:6000000},"Luciano_Juba":{nome:"Luciano Juba",idade:24,posicoes:{p:"Lateral",s:"Ponta",t:"Meia"},atributos:{ataque:10,defesa:6,forca:6,velocidade:11,habilidade:10},valor_mercado:12000000},"Caio_Alexandre":{nome:"Caio Alexandre",idade:25,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:10,forca:8,velocidade:7,habilidade:11},valor_mercado:15000000},"Jean_Lucas":{nome:"Jean Lucas",idade:26,posicoes:{p:"Volante",s:"Meia",t:"Lateral"},atributos:{ataque:7,defesa:9,forca:9,velocidade:8,habilidade:10},valor_mercado:14000000},"Everton_Ribeiro":{nome:"Everton Ribeiro",idade:35,posicoes:{p:"Meia",s:"Ponta",t:"Volante"},atributos:{ataque:8,defesa:4,forca:4,velocidade:5,habilidade:13},valor_mercado:7000000},"Cauly":{nome:"Cauly",idade:28,posicoes:{p:"Meia",s:"Atacante",t:"Ponta"},atributos:{ataque:10,defesa:3,forca:6,velocidade:9,habilidade:12},valor_mercado:18000000},"Thaciano":{nome:"Thaciano",idade:29,posicoes:{p:"Atacante",s:"Meia",t:"Volante"},atributos:{ataque:11,defesa:6,forca:9,velocidade:7,habilidade:9},valor_mercado:11000000},"Everaldo":{nome:"Everaldo",idade:33,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:12,defesa:2,forca:10,velocidade:6,habilidade:8},valor_mercado:6000000}}},
            "Botafogo":{divisao:"A",forca_base:0,jogadores:{"John":{nome:"John",idade:28,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:12,forca:8,velocidade:6,habilidade:8},valor_mercado:9000000},"Vitinho":{nome:"Vitinho",idade:25,posicoes:{p:"Lateral",s:"Ponta",t:"Meia"},atributos:{ataque:9,defesa:7,forca:6,velocidade:12,habilidade:9},valor_mercado:14000000},"Bastos":{nome:"Bastos",idade:32,posicoes:{p:"Zagueiro",s:"Volante",t:"Nenhuma"},atributos:{ataque:3,defesa:12,forca:12,velocidade:5,habilidade:4},valor_mercado:6000000},"Barboza":{nome:"Alexander Barboza",idade:29,posicoes:{p:"Zagueiro",s:"Lateral",t:"Nenhuma"},atributos:{ataque:3,defesa:12,forca:11,velocidade:6,habilidade:5},valor_mercado:10000000},"Alex_Telles":{nome:"Alex Telles",idade:31,posicoes:{p:"Lateral",s:"Meia",t:"Ponta"},atributos:{ataque:9,defesa:8,forca:7,velocidade:8,habilidade:11},valor_mercado:12000000},"Gregore":{nome:"Gregore",idade:30,posicoes:{p:"Volante",s:"Zagueiro",t:"Nenhuma"},atributos:{ataque:3,defesa:12,forca:11,velocidade:6,habilidade:7},valor_mercado:11000000},"Marlon_Freitas":{nome:"Marlon Freitas",idade:29,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:7,defesa:10,forca:9,velocidade:6,habilidade:10},valor_mercado:13000000},"Thiago_Almada":{nome:"Thiago Almada",idade:23,posicoes:{p:"Meia",s:"Ponta",t:"Atacante"},atributos:{ataque:10,defesa:3,forca:5,velocidade:10,habilidade:13},valor_mercado:35000000},"Luiz_Henrique":{nome:"Luiz Henrique",idade:23,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:11,defesa:2,forca:7,velocidade:13,habilidade:12},valor_mercado:25000000},"Savarino":{nome:"Savarino",idade:27,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:10,defesa:3,forca:6,velocidade:11,habilidade:11},valor_mercado:15000000},"Igor_Jesus":{nome:"Igor Jesus",idade:23,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:12,defesa:2,forca:10,velocidade:9,habilidade:9},valor_mercado:18000000}}},
            "Chapecoense":{divisao:"B",forca_base:0,jogadores:{"Cavichioli":{nome:"Cavichioli",idade:33,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:8,forca:7,velocidade:3,habilidade:5},valor_mercado:800000},"Marcelinho":{nome:"Marcelinho",idade:25,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:6,velocidade:8,habilidade:6},valor_mercado:900000},"Bruno_Leonardo":{nome:"Bruno Leonardo",idade:23,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:5,habilidade:4},valor_mercado:1000000},"Eduardo_Doma":{nome:"Eduardo Doma",idade:25,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:8,velocidade:6,habilidade:4},valor_mercado:1100000},"Mancha":{nome:"Mancha",idade:22,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:5,velocidade:8,habilidade:6},valor_mercado:800000},"Auremir":{nome:"Auremir",idade:32,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:8,forca:8,velocidade:4,habilidade:6},valor_mercado:700000},"Foguinho_Chape":{nome:"Foguinho",idade:31,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:7,forca:7,velocidade:5,habilidade:6},valor_mercado:600000},"Giovanni_Augusto":{nome:"Giovanni Augusto",idade:34,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:4,velocidade:4,habilidade:9},valor_mercado:1000000},"Marcinho_Chape":{nome:"Marcinho",idade:28,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:5,velocidade:8,habilidade:7},valor_mercado:1100000},"Perotti":{nome:"Perotti",idade:26,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:8,velocidade:6,habilidade:7},valor_mercado:1300000},"Romulo":{nome:"Romulo",idade:28,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:6,velocidade:8,habilidade:6},valor_mercado:1000000}}},
            "Corinthians":{divisao:"A",forca_base:0,jogadores:{"Hugo_Souza":{nome:"Hugo Souza",idade:25,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:9,velocidade:6,habilidade:6},valor_mercado:8000000},"Matheuzinho":{nome:"Matheuzinho",idade:23,posicoes:{p:"Lateral",s:"Ponta",t:"Meia"},atributos:{ataque:8,defesa:7,forca:6,velocidade:11,habilidade:8},valor_mercado:7500000},"Gabriel_Paulista":{nome:"Gabriel Paulista",idade:33,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:11,forca:12,velocidade:5,habilidade:4},valor_mercado:5000000},"Gustavo_Henrique":{nome:"Gustavo Henrique",idade:31,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:3,defesa:10,forca:12,velocidade:4,habilidade:5},valor_mercado:4000000},"Matheus_Bidu":{nome:"Matheus Bidu",idade:25,posicoes:{p:"Lateral",s:"Meia",t:"Ponta"},atributos:{ataque:7,defesa:8,forca:7,velocidade:10,habilidade:7},valor_mercado:6000000},"Allan":{nome:"Allan",idade:27,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:10,forca:8,velocidade:7,habilidade:9},valor_mercado:9000000},"Andre":{nome:"André",idade:23,posicoes:{p:"Volante",s:"Zagueiro",t:"Nenhuma"},atributos:{ataque:4,defesa:11,forca:9,velocidade:8,habilidade:7},valor_mercado:12000000},"Breno_Bidon":{nome:"Breno Bidon",idade:19,posicoes:{p:"Meia",s:"Volante",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:5,velocidade:9,habilidade:10},valor_mercado:10000000},"Rodrigo_Garro":{nome:"Rodrigo Garro",idade:26,posicoes:{p:"Meia",s:"Ponta",t:"Atacante"},atributos:{ataque:9,defesa:3,forca:6,velocidade:8,habilidade:13},valor_mercado:18000000},"Kaio_Cesar":{nome:"Kaio César",idade:20,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:8,defesa:2,forca:5,velocidade:12,habilidade:10},valor_mercado:8000000},"Yuri_Alberto":{nome:"Yuri Alberto",idade:23,posicoes:{p:"Atacante",s:"Centroavante",t:"Ponta"},atributos:{ataque:11,defesa:2,forca:9,velocidade:10,habilidade:7},valor_mercado:15000000}}},
            "Coritiba":{divisao:"B",forca_base:0,jogadores:{"Pedro_Morisco":{nome:"Pedro Morisco",idade:20,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:9,forca:7,velocidade:5,habilidade:6},valor_mercado:1500000},"Natanael":{nome:"Natanael",idade:22,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:6,velocidade:9,habilidade:7},valor_mercado:2000000},"Thalisson":{nome:"Thalisson",idade:22,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:9,velocidade:6,habilidade:5},valor_mercado:1800000},"Bruno_Melo":{nome:"Bruno Melo",idade:31,posicoes:{p:"Zagueiro",s:"Lateral",t:"Nenhuma"},atributos:{ataque:3,defesa:8,forca:10,velocidade:4,habilidade:5},valor_mercado:1200000},"Rodrigo_Gelado":{nome:"Rodrigo Gelado",idade:20,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:6,velocidade:9,habilidade:6},valor_mercado:1000000},"Sebastian_Gomez":{nome:"Sebastián Gómez",idade:26,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:8,forca:8,velocidade:7,habilidade:7},valor_mercado:2500000},"Matheus_Frizzo":{nome:"Matheus Frizzo",idade:26,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:4,forca:6,velocidade:7,habilidade:8},valor_mercado:2000000},"Vini_Paulista":{nome:"Vini Paulista",idade:23,posicoes:{p:"Meia",s:"Volante",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:6,velocidade:8,habilidade:7},valor_mercado:1500000},"Robson":{nome:"Robson",idade:32,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:7,velocidade:7,habilidade:7},valor_mercado:1200000},"Figueiredo":{nome:"Figueiredo",idade:23,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:6,velocidade:9,habilidade:7},valor_mercado:1400000},"Eberth":{nome:"Eberth",idade:21,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:8,velocidade:7,habilidade:6},valor_mercado:1000000}}},
            "Cruzeiro":{divisao:"A",forca_base:0,jogadores:{"Cassio":{nome:"Cássio",idade:37,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:12,forca:9,velocidade:3,habilidade:8},valor_mercado:3000000},"William":{nome:"William",idade:29,posicoes:{p:"Lateral",s:"Ponta",t:"Meia"},atributos:{ataque:9,defesa:8,forca:6,velocidade:10,habilidade:9},valor_mercado:8000000},"Ze_Ivaldo":{nome:"Zé Ivaldo",idade:27,posicoes:{p:"Zagueiro",s:"Lateral",t:"Volante"},atributos:{ataque:3,defesa:11,forca:11,velocidade:7,habilidade:6},valor_mercado:7000000},"Joao_Marcelo":{nome:"João Marcelo",idade:24,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:11,forca:12,velocidade:6,habilidade:5},valor_mercado:8000000},"Marlon":{nome:"Marlon",idade:27,posicoes:{p:"Lateral",s:"Meia",t:"Nenhuma"},atributos:{ataque:8,defesa:9,forca:7,velocidade:9,habilidade:8},valor_mercado:8500000},"Lucas_Romero":{nome:"Lucas Romero",idade:30,posicoes:{p:"Volante",s:"Meia",t:"Lateral"},atributos:{ataque:5,defesa:11,forca:9,velocidade:7,habilidade:8},valor_mercado:7000000},"Walace":{nome:"Walace",idade:29,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:11,forca:11,velocidade:6,habilidade:7},valor_mercado:9000000},"Matheus_Pereira":{nome:"Matheus Pereira",idade:28,posicoes:{p:"Meia",s:"Ponta",t:"Atacante"},atributos:{ataque:10,defesa:3,forca:5,velocidade:9,habilidade:13},valor_mercado:20000000},"Alvaro_Barreal":{nome:"Álvaro Barreal",idade:23,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:9,defesa:4,forca:6,velocidade:11,habilidade:11},valor_mercado:10000000},"Lautaro_Diaz":{nome:"Lautaro Díaz",idade:26,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:10,defesa:2,forca:7,velocidade:11,habilidade:9},valor_mercado:9000000},"Kaio_Jorge":{nome:"Kaio Jorge",idade:22,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:11,defesa:2,forca:8,velocidade:9,habilidade:9},valor_mercado:12000000}}},
            "Cuiaba":{divisao:"A",forca_base:0,jogadores:{"Walter":{nome:"Walter",idade:36,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:8,velocidade:3,habilidade:7},valor_mercado:2000000},"Matheus_Alexandre":{nome:"Matheus Alexandre",idade:25,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:8,forca:7,velocidade:9,habilidade:6},valor_mercado:3500000},"Marllon":{nome:"Marllon",idade:32,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:11,velocidade:5,habilidade:4},valor_mercado:2000000},"Alan_Empereur":{nome:"Alan Empereur",idade:30,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:10,velocidade:6,habilidade:5},valor_mercado:2500000},"Ramon":{nome:"Ramon",idade:23,posicoes:{p:"Lateral",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:6,velocidade:10,habilidade:7},valor_mercado:3000000},"Lucas_Mineiro":{nome:"Lucas Mineiro",idade:28,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:9,forca:9,velocidade:6,habilidade:7},valor_mercado:2500000},"Denilson":{nome:"Denilson",idade:23,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:8,forca:7,velocidade:7,habilidade:8},valor_mercado:4000000},"Max_Alves":{nome:"Max Alves",idade:23,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:4,forca:6,velocidade:9,habilidade:9},valor_mercado:3500000},"Clayson":{nome:"Clayson",idade:29,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:8,defesa:3,forca:5,velocidade:9,habilidade:10},valor_mercado:3000000},"Gustavo_Sauer":{nome:"Gustavo Sauer",idade:31,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:9,defesa:3,forca:6,velocidade:7,habilidade:10},valor_mercado:3500000},"Isidro_Pitta":{nome:"Isidro Pitta",idade:24,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:11,defesa:2,forca:10,velocidade:8,habilidade:8},valor_mercado:8000000}}},
            "Flamengo":{divisao:"A",forca_base:0,jogadores:{"Agustin_Rossi":{nome:"Agustín Rossi",idade:28,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:12,forca:8,velocidade:6,habilidade:9},valor_mercado:12000000},"Wesley_Franca":{nome:"Wesley França",idade:20,posicoes:{p:"Lateral",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:6,forca:6,velocidade:12,habilidade:8},valor_mercado:10000000},"Leo_Ortiz":{nome:"Léo Ortiz",idade:28,posicoes:{p:"Zagueiro",s:"Volante",t:"Lateral"},atributos:{ataque:2,defesa:12,forca:10,velocidade:7,habilidade:5},valor_mercado:9000000},"Leo_Pereira":{nome:"Léo Pereira",idade:28,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:3,defesa:11,forca:11,velocidade:7,habilidade:6},valor_mercado:8000000},"Ayrton_Lucas":{nome:"Ayrton Lucas",idade:27,posicoes:{p:"Lateral",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:7,forca:7,velocidade:12,habilidade:8},valor_mercado:11000000},"Evertton_Araujo":{nome:"Evertton Araújo",idade:21,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:9,forca:8,velocidade:8,habilidade:7},valor_mercado:6000000},"Nicolas_de_la_Cruz":{nome:"Nicolás de la Cruz",idade:27,posicoes:{p:"Volante",s:"Meia",t:"Ponta"},atributos:{ataque:9,defesa:8,forca:6,velocidade:9,habilidade:12},valor_mercado:20000000},"Giorgian_De_Arrascaeta":{nome:"Giorgian De Arrascaeta",idade:30,posicoes:{p:"Meia",s:"Ponta",t:"Volante"},atributos:{ataque:8,defesa:3,forca:5,velocidade:7,habilidade:13},valor_mercado:15000000},"Gerson":{nome:"Gerson",idade:27,posicoes:{p:"Meia",s:"Volante",t:"Ponta"},atributos:{ataque:8,defesa:8,forca:9,velocidade:8,habilidade:12},valor_mercado:18000000},"Luiz_Araujo":{nome:"Luiz Araújo",idade:28,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:9,defesa:3,forca:6,velocidade:11,habilidade:10},valor_mercado:12000000},"Pedro":{nome:"Pedro",idade:26,posicoes:{p:"Atacante",s:"Centroavante",t:"Ponta"},atributos:{ataque:13,defesa:2,forca:11,velocidade:7,habilidade:6},valor_mercado:18000000}}},
            "Fluminense":{divisao:"A",forca_base:0,jogadores:{"Fabio":{nome:"Fábio",idade:43,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:6,velocidade:2,habilidade:8},valor_mercado:1000000},"Samuel_Xavier":{nome:"Samuel Xavier",idade:33,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:8,forca:7,velocidade:7,habilidade:8},valor_mercado:2000000},"Thiago_Silva":{nome:"Thiago Silva",idade:39,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:13,forca:9,velocidade:4,habilidade:8},valor_mercado:4000000},"Thiago_Santos":{nome:"Thiago Santos",idade:34,posicoes:{p:"Zagueiro",s:"Volante",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:11,velocidade:4,habilidade:4},valor_mercado:1500000},"Diogo_Barbosa":{nome:"Diogo Barbosa",idade:31,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:6,velocidade:8,habilidade:7},valor_mercado:2000000},"Facundo_Bernal":{nome:"Facundo Bernal",idade:20,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:9,forca:8,velocidade:7,habilidade:8},valor_mercado:5000000},"Martinelli":{nome:"Martinelli",idade:22,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:9,forca:7,velocidade:8,habilidade:9},valor_mercado:8000000},"Paulo_Henrique_Ganso":{nome:"Paulo Henrique Ganso",idade:34,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:4,velocidade:4,habilidade:13},valor_mercado:4000000},"Jhon_Arias":{nome:"Jhon Arias",idade:26,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:10,defesa:5,forca:6,velocidade:11,habilidade:12},valor_mercado:18000000},"Kevin_Serna":{nome:"Kevin Serna",idade:26,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:3,forca:6,velocidade:12,habilidade:10},valor_mercado:6000000},"Kaua_Elias":{nome:"Kauã Elias",idade:18,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:10,defesa:2,forca:7,velocidade:9,habilidade:8},valor_mercado:12000000}}},
            "Gremio":{divisao:"A",forca_base:0,jogadores:{"Weverton":{nome:"Weverton",idade:25,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:10,forca:7,velocidade:6,habilidade:6},valor_mercado:3000000},"Diego_Caito":{nome:"Diego Caito",idade:20,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:6,forca:6,velocidade:10,habilidade:7},valor_mercado:2000000},"Gustavo_Martins":{nome:"Gustavo Martins",idade:21,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:10,velocidade:6,habilidade:5},valor_mercado:3000000},"Wallace":{nome:"Wallace",idade:29,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:11,velocidade:5,habilidade:4},valor_mercado:2500000},"Marlon":{nome:"Marlon",idade:27,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:8,forca:7,velocidade:8,habilidade:7},valor_mercado:3000000},"Erick_Noriega":{nome:"Erick Noriega",idade:23,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:8,forca:8,velocidade:7,habilidade:6},valor_mercado:2000000},"Mathias_Villasanti":{nome:"Mathías Villasanti",idade:27,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:7,defesa:11,forca:9,velocidade:7,habilidade:9},valor_mercado:10000000},"Juan_Nardoni":{nome:"Juan Nardoni",idade:21,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:9,forca:7,velocidade:8,habilidade:8},valor_mercado:6000000},"Cristian_Pavon":{nome:"Cristian Pavón",idade:28,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:3,forca:6,velocidade:11,habilidade:10},valor_mercado:7000000},"Francis_Amuzu":{nome:"Francis Amuzu",idade:24,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:5,velocidade:12,habilidade:9},valor_mercado:6000000},"Carlos_Vinicius":{nome:"Carlos Vinícius",idade:29,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:10,defesa:2,forca:10,velocidade:7,habilidade:7},valor_mercado:5000000}}},
            "Internacional":{divisao:"A",forca_base:0,jogadores:{"Matheus_Cunha":{nome:"Matheus Cunha",idade:23,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:10,forca:7,velocidade:7,habilidade:8},valor_mercado:6000000},"Vitinho":{nome:"Vitinho",idade:25,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:8,defesa:7,forca:6,velocidade:10,habilidade:7},valor_mercado:4000000},"Bruno_Gomes":{nome:"Bruno Gomes",idade:23,posicoes:{p:"Zagueiro",s:"Volante",t:"Nenhuma"},atributos:{ataque:4,defesa:9,forca:8,velocidade:7,habilidade:7},valor_mercado:5000000},"Mercado":{nome:"Mercado",idade:37,posicoes:{p:"Zagueiro",s:"Lateral",t:"Nenhuma"},atributos:{ataque:3,defesa:10,forca:10,velocidade:3,habilidade:5},valor_mercado:1000000},"Maripan":{nome:"Maripán",idade:30,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:11,forca:11,velocidade:5,habilidade:5},valor_mercado:6000000},"Matheus_Bahia":{nome:"Matheus Bahia",idade:24,posicoes:{p:"Lateral",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:6,velocidade:9,habilidade:7},valor_mercado:3000000},"Villagra":{nome:"Villagra",idade:23,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:9,forca:8,velocidade:7,habilidade:7},valor_mercado:4000000},"Bruno_Henrique":{nome:"Bruno Henrique",idade:34,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:9,forca:7,velocidade:5,habilidade:9},valor_mercado:2000000},"Alan_Patrick":{nome:"Alan Patrick",idade:33,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:5,velocidade:5,habilidade:12},valor_mercado:5000000},"Carbonero":{nome:"Carbonero",idade:24,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:5,velocidade:11,habilidade:9},valor_mercado:6000000},"Bernabei":{nome:"Bernabei",idade:23,posicoes:{p:"Atacante",s:"Ponta",t:"Lateral"},atributos:{ataque:7,defesa:6,forca:6,velocidade:11,habilidade:8},valor_mercado:5000000}}},
            "Mirassol":{divisao:"B",forca_base:0,jogadores:{"Alex_Muralha":{nome:"Alex Muralha",idade:34,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:9,forca:7,velocidade:4,habilidade:5},valor_mercado:900000},"Lucas_Ramon":{nome:"Lucas Ramon",idade:30,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:6,velocidade:7,habilidade:6},valor_mercado:1000000},"Joao_Victor":{nome:"João Victor",idade:25,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:6,habilidade:4},valor_mercado:1200000},"Luiz_Otavio":{nome:"Luiz Otávio",idade:31,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:10,velocidade:4,habilidade:4},valor_mercado:1100000},"Warley":{nome:"Warley",idade:24,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:6,velocidade:9,habilidade:6},valor_mercado:1000000},"Danielzinho":{nome:"Danielzinho",idade:29,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:7,forca:7,velocidade:6,habilidade:7},valor_mercado:1200000},"Gabriel":{nome:"Gabriel",idade:24,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:8,forca:8,velocidade:6,habilidade:6},valor_mercado:1100000},"Chico_Kim":{nome:"Chico Kim",idade:32,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:4,forca:5,velocidade:5,habilidade:9},valor_mercado:1400000},"Negueba":{nome:"Negueba",idade:23,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:5,velocidade:10,habilidade:8},valor_mercado:1500000},"Fernandinho":{nome:"Fernandinho",idade:26,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:6,velocidade:9,habilidade:7},valor_mercado:1300000},"Dellatorre":{nome:"Dellatorre",idade:32,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:8,velocidade:5,habilidade:7},valor_mercado:1200000}}},

            "Palmeiras":{divisao:"A",forca_base:0,jogadores:{"Carlos_Miguel":{nome:"Carlos Miguel",idade:25,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:9,velocidade:5,habilidade:6},valor_mercado:8000000},"Giay":{nome:"Giay",idade:20,posicoes:{p:"Lateral",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:7,forca:6,velocidade:11,habilidade:8},valor_mercado:6000000},"Murilo":{nome:"Murilo",idade:27,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:3,defesa:12,forca:11,velocidade:6,habilidade:5},valor_mercado:12000000},"Barboza":{nome:"Barboza",idade:29,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:11,forca:12,velocidade:5,habilidade:4},valor_mercado:7000000},"Benedetti":{nome:"Benedetti",idade:20,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:10,velocidade:6,habilidade:4},valor_mercado:3000000},"Allan":{nome:"Allan",idade:27,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:10,forca:8,velocidade:7,habilidade:9},valor_mercado:8000000},"Emiliano_Martinez":{nome:"Emiliano Martínez",idade:24,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:10,forca:9,velocidade:6,habilidade:7},valor_mercado:6000000},"Lucas_Evangelista":{nome:"Lucas Evangelista",idade:29,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:7,defesa:9,forca:7,velocidade:7,habilidade:10},valor_mercado:7000000},"Piquerez":{nome:"Piquerez",idade:25,posicoes:{p:"Lateral",s:"Meia",t:"Nenhuma"},atributos:{ataque:9,defesa:10,forca:9,velocidade:9,habilidade:9},valor_mercado:15000000},"Mauricio":{nome:"Mauricio",idade:22,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:4,forca:5,velocidade:9,habilidade:11},valor_mercado:14000000},"Flaco_Lopez":{nome:"Flaco López",idade:23,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:11,defesa:2,forca:9,velocidade:8,habilidade:8},valor_mercado:12000000}}},
            "Bragantino":{divisao:"A",forca_base:0,jogadores:{"Cleiton":{nome:"Cleiton",idade:26,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:7,velocidade:6,habilidade:7},valor_mercado:7000000},"Andres_Hurtado":{nome:"Andrés Hurtado",idade:22,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:8,forca:7,velocidade:9,habilidade:7},valor_mercado:5000000},"Pedro_Henrique":{nome:"Pedro Henrique",idade:28,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:11,velocidade:6,habilidade:4},valor_mercado:4000000},"Alix_Vinicius":{nome:"Alix Vinícius",idade:24,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:10,velocidade:7,habilidade:4},valor_mercado:4500000},"Juninho_Capixaba":{nome:"Juninho Capixaba",idade:26,posicoes:{p:"Lateral",s:"Ponta",t:"Meia"},atributos:{ataque:9,defesa:8,forca:6,velocidade:10,habilidade:9},valor_mercado:8000000},"Gabriel_Girotto":{nome:"Gabriel Girotto",idade:32,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:10,forca:9,velocidade:5,habilidade:7},valor_mercado:3000000},"Fabinho":{nome:"Fabinho",idade:24,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:9,forca:8,velocidade:7,habilidade:8},valor_mercado:5000000},"Rodriguinho":{nome:"Rodriguinho",idade:20,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:4,forca:5,velocidade:9,habilidade:10},valor_mercado:6000000},"Henry_Mosquera":{nome:"Henry Mosquera",idade:22,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:6,velocidade:12,habilidade:9},valor_mercado:6500000},"Eduardo_Sasha":{nome:"Eduardo Sasha",idade:32,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:10,defesa:3,forca:7,velocidade:7,habilidade:9},valor_mercado:4000000},"Isidro_Pitta":{nome:"Isidro Pitta",idade:24,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:10,defesa:2,forca:10,velocidade:8,habilidade:8},valor_mercado:7000000}}},
            "Remo":{divisao:"A",forca_base:0,jogadores:{"Marcelo_Rangel":{nome:"Marcelo Rangel",idade:20,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:7,velocidade:6,habilidade:8},valor_mercado:6000000},"Thalys":{nome:"Thalys",idade:26,posicoes:{p:"Lateral",s:"Meia",t:"Ponta"},atributos:{ataque:8,defesa:8,forca:7,velocidade:11,habilidade:8},valor_mercado:7500000},"Rafael_Castro":{nome:"Rafael Castro",idade:24,posicoes:{p:"Zagueiro",s:"Volante",t:"Lateral"},atributos:{ataque:3,defesa:11,forca:12,velocidade:6,habilidade:4},valor_mercado:8000000},"Jonilson":{nome:"Jonilson",idade:22,posicoes:{p:"Zagueiro",s:"Volante",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:11,velocidade:7,habilidade:4},valor_mercado:5000000},"Vidal":{nome:"Vidal",idade:31,posicoes:{p:"Lateral",s:"Ponta",t:"Meia"},atributos:{ataque:9,defesa:6,forca:6,velocidade:8,habilidade:9},valor_mercado:4000000},"Jaderson":{nome:"Jáderson",idade:30,posicoes:{p:"Volante",s:"Zagueiro",t:"Meia"},atributos:{ataque:4,defesa:11,forca:10,velocidade:6,habilidade:7},valor_mercado:6000000},"Giovanni_Pavani":{nome:"Giovanni Pavani",idade:36,posicoes:{p:"Meia",s:"Volante",t:"Nenhuma"},atributos:{ataque:6,defesa:9,forca:8,velocidade:4,habilidade:11},valor_mercado:2500000},"Matheus_Anjos":{nome:"Matheus Anjos",idade:21,posicoes:{p:"Meia",s:"Ponta",t:"Atacante"},atributos:{ataque:7,defesa:3,forca:5,velocidade:10,habilidade:11},valor_mercado:9000000},"Pedro_Vitor":{nome:"Pedro Vitor",idade:32,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:10,defesa:2,forca:7,velocidade:8,habilidade:9},valor_mercado:4500000},"Ronald":{nome:"Ronald",idade:25,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:6,velocidade:11,habilidade:10},valor_mercado:8500000},"Ytalo":{nome:"Ytalo",idade:27,posicoes:{p:"Atacante",s:"Centroavante",t:"Ponta"},atributos:{ataque:11,defesa:2,forca:9,velocidade:9,habilidade:8},valor_mercado:10000000}}},
            "Santos":{divisao:"A",forca_base:0,jogadores:{"Gabriel_Brazao":{nome:"Gabriel Brazão",idade:23,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:10,forca:7,velocidade:5,habilidade:6},valor_mercado:3000000},"Igor_Vinicius":{nome:"Igor Vinícius",idade:27,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:6,velocidade:10,habilidade:7},valor_mercado:3500000},"Lucas_Verissimo":{nome:"Lucas Veríssimo",idade:28,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:3,defesa:11,forca:11,velocidade:6,habilidade:6},valor_mercado:7000000},"Joao_Ananias":{nome:"João Ananias",idade:33,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:9,velocidade:4,habilidade:4},valor_mercado:1000000},"Gonzalo_Escobar":{nome:"Gonzalo Escobar",idade:27,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:8,forca:7,velocidade:8,habilidade:6},valor_mercado:2500000},"Willian_Arao":{nome:"Willian Arão",idade:32,posicoes:{p:"Volante",s:"Zagueiro",t:"Nenhuma"},atributos:{ataque:5,defesa:10,forca:9,velocidade:5,habilidade:8},valor_mercado:3000000},"Gabriel_Bontempo":{nome:"Gabriel Bontempo",idade:18,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:7,forca:6,velocidade:7,habilidade:7},valor_mercado:1500000},"Benjamin_Rollheiser":{nome:"Benjamín Rollheiser",idade:24,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:5,velocidade:9,habilidade:10},valor_mercado:6000000},"Alvaro_Barreal":{nome:"Álvaro Barreal",idade:23,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:4,forca:5,velocidade:10,habilidade:10},valor_mercado:5000000},"Neymar":{nome:"Neymar",idade:32,posicoes:{p:"Atacante",s:"Meia",t:"Ponta"},atributos:{ataque:12,defesa:2,forca:5,velocidade:8,habilidade:13},valor_mercado:30000000},"Gabigol":{nome:"Gabigol",idade:27,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:12,defesa:2,forca:8,velocidade:8,habilidade:9},valor_mercado:12000000}}},
            "Sao_Paulo":{divisao:"A",forca_base:0,jogadores:{"Rafael":{nome:"Rafael",idade:34,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:8,velocidade:4,habilidade:7},valor_mercado:4000000},"Lucas_Ramon":{nome:"Lucas Ramon",idade:30,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:8,forca:7,velocidade:8,habilidade:6},valor_mercado:2000000},"Robert_Arboleda":{nome:"Robert Arboleda",idade:32,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:3,defesa:12,forca:12,velocidade:5,habilidade:4},valor_mercado:5000000},"Luis_Osorio":{nome:"Luis Osorio",idade:20,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:6,habilidade:4},valor_mercado:1500000},"Wendell":{nome:"Wendell",idade:30,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:8,forca:7,velocidade:8,habilidade:8},valor_mercado:4000000},"Pablo_Maia":{nome:"Pablo Maia",idade:22,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:11,forca:9,velocidade:7,habilidade:8},valor_mercado:15000000},"Danielzinho":{nome:"Danielzinho",idade:22,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:8,forca:6,velocidade:8,habilidade:9},valor_mercado:4000000},"Marcos_Antonio":{nome:"Marcos Antônio",idade:24,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:7,defesa:8,forca:6,velocidade:8,habilidade:10},valor_mercado:6000000},"Luciano":{nome:"Luciano",idade:31,posicoes:{p:"Meia",s:"Atacante",t:"Nenhuma"},atributos:{ataque:10,defesa:3,forca:7,velocidade:7,habilidade:10},valor_mercado:6000000},"Artur":{nome:"Artur",idade:26,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:3,forca:5,velocidade:11,habilidade:10},valor_mercado:9000000},"Jonathan_Calleri":{nome:"Jonathan Calleri",idade:30,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:13,defesa:3,forca:11,velocidade:6,habilidade:6},valor_mercado:10000000}}},
            "Vasco":{divisao:"A",forca_base:0,jogadores:{"Leo_Jardim":{nome:"Léo Jardim",idade:29,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:7,velocidade:5,habilidade:6},valor_mercado:5000000},"Paulo_Henrique":{nome:"Paulo Henrique",idade:27,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:7,velocidade:10,habilidade:7},valor_mercado:3000000},"Victor_Cuesta":{nome:"Victor Cuesta",idade:35,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:3,defesa:10,forca:11,velocidade:3,habilidade:6},valor_mercado:1500000},"Robert_Renan":{nome:"Robert Renan",idade:20,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:8,velocidade:7,habilidade:7},valor_mercado:8000000},"Cuiabano":{nome:"Cuiabano",idade:21,posicoes:{p:"Lateral",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:7,forca:8,velocidade:11,habilidade:8},valor_mercado:6000000},"Jair":{nome:"Jair",idade:29,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:10,forca:9,velocidade:6,habilidade:8},valor_mercado:4000000},"Tche_Tche":{nome:"Tchê Tchê",idade:31,posicoes:{p:"Volante",s:"Meia",t:"Lateral"},atributos:{ataque:6,defesa:9,forca:7,velocidade:7,habilidade:9},valor_mercado:3500000},"Thiago_Mendes":{nome:"Thiago Mendes",idade:32,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:10,forca:8,velocidade:6,habilidade:9},valor_mercado:4000000},"Andres_Gomez":{nome:"Andrés Gómez",idade:21,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:6,velocidade:11,habilidade:9},valor_mercado:5000000},"Adson":{nome:"Adson",idade:23,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:5,velocidade:11,habilidade:10},valor_mercado:6000000},"Brenner":{nome:"Brenner",idade:24,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:10,defesa:2,forca:7,velocidade:9,habilidade:8},valor_mercado:7000000}}},
            "Vitoria":{divisao:"A",forca_base:0,jogadores:{"Lucas_Arcanjo":{nome:"Lucas Arcanjo",idade:25,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:10,forca:7,velocidade:6,habilidade:5},valor_mercado:3000000},"Jamerson":{nome:"Jamerson",idade:25,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:6,velocidade:9,habilidade:7},valor_mercado:2500000},"Caca":{nome:"Cacá",idade:25,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:11,velocidade:6,habilidade:4},valor_mercado:4000000},"Luan_Candido":{nome:"Luan Cândido",idade:23,posicoes:{p:"Zagueiro",s:"Lateral",t:"Nenhuma"},atributos:{ataque:6,defesa:9,forca:8,velocidade:8,habilidade:6},valor_mercado:5000000},"Ramon":{nome:"Ramon",idade:23,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:7,velocidade:9,habilidade:6},valor_mercado:2000000},"Caique_Goncalves":{nome:"Caíque Gonçalves",idade:28,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:9,forca:9,velocidade:6,habilidade:5},valor_mercado:1500000},"Gabriel_Baralhas":{nome:"Gabriel Baralhas",idade:25,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:9,forca:8,velocidade:7,habilidade:7},valor_mercado:3000000},"Ze_Vitor":{nome:"Zé Vitor",idade:23,posicoes:{p:"Volante",s:"Zagueiro",t:"Nenhuma"},atributos:{ataque:3,defesa:9,forca:10,velocidade:5,habilidade:4},valor_mercado:1500000},"Matheuzinho":{nome:"Matheuzinho",idade:26,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:5,velocidade:10,habilidade:10},valor_mercado:4000000},"Erick":{nome:"Erick",idade:26,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:5,velocidade:11,habilidade:9},valor_mercado:3500000},"Rene":{nome:"Renê",idade:31,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:9,defesa:3,forca:8,velocidade:6,habilidade:7},valor_mercado:2000000}}},

            // ================= SÉRIE B (Demais) =================
            "America-MG":{divisao:"B",forca_base:0,jogadores:{"Elias":{nome:"Elias",idade:28,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:9,forca:7,velocidade:5,habilidade:6},valor_mercado:2000000},"Mateus_Henrique":{nome:"Mateus Henrique",idade:23,posicoes:{p:"Lateral",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:6,forca:6,velocidade:10,habilidade:7},valor_mercado:2500000},"Eder_Ferreira":{nome:"Éder Ferreira",idade:29,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:10,velocidade:5,habilidade:4},valor_mercado:1800000},"Ricardo_Silva":{nome:"Ricardo Silva",idade:31,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:10,velocidade:4,habilidade:3},valor_mercado:1500000},"Marlon_Lopes":{nome:"Marlon Lopes",idade:28,posicoes:{p:"Lateral",s:"Meia",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:6,velocidade:8,habilidade:8},valor_mercado:2200000},"Ale":{nome:"Alê",idade:33,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:8,forca:7,velocidade:5,habilidade:8},valor_mercado:1200000},"Juninho":{nome:"Juninho",idade:36,posicoes:{p:"Volante",s:"Meia",t:"Lateral"},atributos:{ataque:7,defesa:8,forca:7,velocidade:4,habilidade:9},valor_mercado:800000},"Moises":{nome:"Moisés",idade:35,posicoes:{p:"Meia",s:"Volante",t:"Nenhuma"},atributos:{ataque:7,defesa:5,forca:6,velocidade:4,habilidade:10},valor_mercado:900000},"Benitez":{nome:"Benítez",idade:30,posicoes:{p:"Meia",s:"Atacante",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:5,velocidade:6,habilidade:11},valor_mercado:3500000},"Fabinho":{nome:"Fabinho",idade:24,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:6,velocidade:10,habilidade:8},valor_mercado:3000000},"Brenner":{nome:"Brenner",idade:29,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:9,velocidade:6,habilidade:6},valor_mercado:2800000}}},
            "Athletic-Club":{divisao:"B",forca_base:0,jogadores:{"Glauco":{nome:"Glauco",idade:28,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:8,forca:7,velocidade:4,habilidade:5},valor_mercado:1000000},"Ynaia":{nome:"Ynaiã",idade:25,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:6,velocidade:8,habilidade:6},valor_mercado:800000},"Danilo_Cardoso":{nome:"Danilo Cardoso",idade:27,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:5,habilidade:4},valor_mercado:900000},"Reginaldo":{nome:"Reginaldo",idade:31,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:4,habilidade:4},valor_mercado:700000},"Yuri":{nome:"Yuri",idade:28,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:6,velocidade:8,habilidade:6},valor_mercado:800000},"Diego_Fumaca":{nome:"Diego Fumaça",idade:29,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:8,forca:8,velocidade:5,habilidade:6},valor_mercado:900000},"Djalma":{nome:"Djalma",idade:23,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:7,forca:7,velocidade:7,habilidade:7},valor_mercado:1000000},"David_Braga":{nome:"David Braga",idade:22,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:4,forca:5,velocidade:8,habilidade:8},valor_mercado:1200000},"Welinton_Torrao":{nome:"Welinton Torrão",idade:24,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:6,velocidade:9,habilidade:7},valor_mercado:1100000},"Ronaldo_Tavares":{nome:"Ronaldo Tavares",idade:26,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:8,velocidade:7,habilidade:6},valor_mercado:1300000},"Paul_Villero":{nome:"Paul Villero",idade:25,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:6,velocidade:9,habilidade:7},valor_mercado:1000000}}},
            "Atletico-GO":{divisao:"B",forca_base:0,jogadores:{"Ronaldo":{nome:"Ronaldo",idade:27,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:10,forca:7,velocidade:5,habilidade:6},valor_mercado:2500000},"Maguinho":{nome:"Maguinho",idade:32,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:7,velocidade:7,habilidade:6},valor_mercado:1200000},"Alix_Vinicius_GO":{nome:"Alix Vinícius",idade:24,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:10,velocidade:6,habilidade:4},valor_mercado:2000000},"Adriano_Martins":{nome:"Adriano Martins",idade:26,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:10,velocidade:5,habilidade:4},valor_mercado:1800000},"Guilherme_Romao":{nome:"Guilherme Romão",idade:26,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:6,velocidade:9,habilidade:7},valor_mercado:2200000},"Baralhas_GO":{nome:"Baralhas",idade:25,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:9,forca:8,velocidade:7,habilidade:7},valor_mercado:2500000},"Rhaldney":{nome:"Rhaldney",idade:25,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:8,forca:8,velocidade:6,habilidade:7},valor_mercado:2000000},"Shaylon":{nome:"Shaylon",idade:27,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:8,defesa:4,forca:5,velocidade:7,habilidade:10},valor_mercado:3000000},"Luiz_Fernando":{nome:"Luiz Fernando",idade:27,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:3,forca:6,velocidade:9,habilidade:9},valor_mercado:3500000},"Alejo_Cruz":{nome:"Alejo Cruz",idade:23,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:5,velocidade:10,habilidade:8},valor_mercado:2500000},"Gustavo_Coutinho":{nome:"Gustavo Coutinho",idade:25,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:8,velocidade:7,habilidade:7},valor_mercado:2800000}}},
            "Avai":{divisao:"B",forca_base:0,jogadores:{"Cesar_Augusto":{nome:"César Augusto",idade:29,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:9,forca:7,velocidade:4,habilidade:5},valor_mercado:1500000},"Marcos_Vinicius":{nome:"Marcos Vinícius",idade:26,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:6,velocidade:8,habilidade:6},valor_mercado:1200000},"Tiago_Pagnussat":{nome:"Tiago Pagnussat",idade:34,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:10,velocidade:3,habilidade:4},valor_mercado:1000000},"Gustavo_Vilar":{nome:"Gustavo Vilar",idade:24,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:5,habilidade:4},valor_mercado:1100000},"Mario_Sergio":{nome:"Mário Sérgio",idade:28,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:7,velocidade:7,habilidade:6},valor_mercado:1200000},"Willian_Maranhao":{nome:"Willian Maranhão",idade:28,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:9,forca:9,velocidade:6,habilidade:6},valor_mercado:1500000},"Ze_Ricardo":{nome:"Zé Ricardo",idade:25,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:8,forca:7,velocidade:7,habilidade:7},valor_mercado:1800000},"Giovanni":{nome:"Giovanni",idade:30,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:4,forca:5,velocidade:6,habilidade:9},valor_mercado:1600000},"Pedrinho":{nome:"Pedrinho",idade:21,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:5,velocidade:10,habilidade:8},valor_mercado:2000000},"Garcez":{nome:"Garcez",idade:30,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:6,velocidade:8,habilidade:7},valor_mercado:1500000},"Vagner_Love":{nome:"Vagner Love",idade:40,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:7,velocidade:3,habilidade:8},valor_mercado:500000}}},
            "Botafogo-SP":{divisao:"B",forca_base:0,jogadores:{"Joao_Carlos":{nome:"João Carlos",idade:28,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:8,forca:7,velocidade:4,habilidade:5},valor_mercado:1000000},"Matheus_Costa":{nome:"Matheus Costa",idade:25,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:6,velocidade:8,habilidade:6},valor_mercado:900000},"Fabio_Sanches":{nome:"Fábio Sanches",idade:33,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:4,habilidade:4},valor_mercado:700000},"Bernardo_Schappo":{nome:"Bernardo Schappo",idade:25,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:5,habilidade:4},valor_mercado:1000000},"Jean_Victor":{nome:"Jean Victor",idade:29,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:6,velocidade:7,habilidade:6},valor_mercado:900000},"Joao_Costa":{nome:"João Costa",idade:23,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:8,forca:7,velocidade:6,habilidade:6},valor_mercado:1100000},"Morelli":{nome:"Morelli",idade:26,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:8,forca:8,velocidade:6,habilidade:7},valor_mercado:1500000},"Gustavo_Bochecha":{nome:"Gustavo Bochecha",idade:28,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:5,forca:6,velocidade:6,habilidade:8},valor_mercado:1300000},"Douglas_Baggio":{nome:"Douglas Baggio",idade:29,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:6,velocidade:8,habilidade:7},valor_mercado:1200000},"Alex_Sandro":{nome:"Alex Sandro",idade:28,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:7,velocidade:7,habilidade:7},valor_mercado:1400000},"Hygor":{nome:"Hygor",idade:31,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:7,velocidade:7,habilidade:6},valor_mercado:1000000}}},
            "Ceara":{divisao:"B",forca_base:0,jogadores:{"Richard":{nome:"Richard",idade:33,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:10,forca:7,velocidade:5,habilidade:6},valor_mercado:1800000},"Rafael_Ramos":{nome:"Rafael Ramos",idade:29,posicoes:{p:"Lateral",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:6,velocidade:8,habilidade:7},valor_mercado:2200000},"David_Ricardo":{nome:"David Ricardo",idade:21,posicoes:{p:"Zagueiro",s:"Lateral",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:9,velocidade:7,habilidade:5},valor_mercado:3500000},"Matheus_Felipe":{nome:"Matheus Felipe",idade:25,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:10,velocidade:6,habilidade:4},valor_mercado:2500000},"Matheus_Bahia":{nome:"Matheus Bahia",idade:24,posicoes:{p:"Lateral",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:7,forca:6,velocidade:10,habilidade:7},valor_mercado:3000000},"Richardson":{nome:"Richardson",idade:32,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:9,forca:8,velocidade:6,habilidade:6},valor_mercado:1500000},"Lourenco":{nome:"Lourenço",idade:26,posicoes:{p:"Volante",s:"Meia",t:"Lateral"},atributos:{ataque:6,defesa:8,forca:7,velocidade:8,habilidade:8},valor_mercado:2800000},"Mugni":{nome:"Mugni",idade:32,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:4,forca:5,velocidade:6,habilidade:10},valor_mercado:2000000},"Erick_Pulga":{nome:"Erick Pulga",idade:23,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:5,velocidade:12,habilidade:11},valor_mercado:6000000},"Saulo_Mineiro":{nome:"Saulo Mineiro",idade:27,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:3,forca:8,velocidade:10,habilidade:7},valor_mercado:3500000},"Facundo_Barcelo":{nome:"Facundo Barceló",idade:31,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:9,velocidade:6,habilidade:7},valor_mercado:2500000}}},
            "CRB":{divisao:"B",forca_base:0,jogadores:{"Matheus_Albino":{nome:"Matheus Albino",idade:29,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:9,forca:7,velocidade:5,habilidade:6},valor_mercado:1200000},"Hereda":{nome:"Hereda",idade:24,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:6,forca:6,velocidade:9,habilidade:7},valor_mercado:1500000},"Saimon":{nome:"Saimon",idade:33,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:4,habilidade:4},valor_mercado:800000},"Gustavo_Henrique":{nome:"Gustavo Henrique",idade:24,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:6,habilidade:4},valor_mercado:1000000},"Willian_Formiga":{nome:"Willian Formiga",idade:29,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:7,velocidade:7,habilidade:6},valor_mercado:900000},"Falcao":{nome:"Falcão",idade:25,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:8,forca:7,velocidade:6,habilidade:6},valor_mercado:1100000},"Joao_Pedro":{nome:"João Pedro",idade:26,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:7,forca:7,velocidade:7,habilidade:7},valor_mercado:1200000},"Gege":{nome:"Gegê",idade:30,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:4,forca:5,velocidade:6,habilidade:8},valor_mercado:1400000},"Kleiton":{nome:"Kleiton",idade:25,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:6,velocidade:9,habilidade:7},valor_mercado:1300000},"Leo_Pereira":{nome:"Léo Pereira",idade:23,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:6,velocidade:10,habilidade:8},valor_mercado:1600000},"Anselmo_Ramon":{nome:"Anselmo Ramon",idade:36,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:9,velocidade:4,habilidade:8},valor_mercado:1000000}}},
            "Criciuma":{divisao:"A",forca_base:0,jogadores:{"Alisson":{nome:"Alisson",idade:28,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:10,forca:7,velocidade:5,habilidade:6},valor_mercado:3000000},"Marcinho":{nome:"Marcinho",idade:27,posicoes:{p:"Lateral",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:6,velocidade:10,habilidade:8},valor_mercado:3500000},"Rodrigo":{nome:"Rodrigo",idade:30,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:11,velocidade:5,habilidade:4},valor_mercado:2500000},"Luciano_Castan":{nome:"Luciano Castán",idade:34,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:11,velocidade:4,habilidade:3},valor_mercado:1500000},"Marcelo_Hermes":{nome:"Marcelo Hermes",idade:29,posicoes:{p:"Lateral",s:"Meia",t:"Nenhuma"},atributos:{ataque:8,defesa:7,forca:7,velocidade:8,habilidade:8},valor_mercado:3000000},"Jean_Irmer":{nome:"Jean Irmer",idade:29,posicoes:{p:"Volante",s:"Zagueiro",t:"Nenhuma"},atributos:{ataque:4,defesa:9,forca:10,velocidade:5,habilidade:6},valor_mercado:2000000},"Barreto":{nome:"Barreto",idade:28,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:9,forca:8,velocidade:6,habilidade:7},valor_mercado:2500000},"Fellipe_Mateus":{nome:"Fellipe Mateus",idade:33,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:5,forca:6,velocidade:6,habilidade:10},valor_mercado:2000000},"Matheusinho":{nome:"Matheusinho",idade:26,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:4,forca:5,velocidade:9,habilidade:10},valor_mercado:4000000},"Yannick_Bolasie":{nome:"Yannick Bolasie",idade:35,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:8,velocidade:7,habilidade:11},valor_mercado:3000000},"Felipe_Vizeu":{nome:"Felipe Vizeu",idade:27,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:10,defesa:2,forca:9,velocidade:7,habilidade:7},valor_mercado:4000000}}},
            "Cuiaba":{divisao:"A",forca_base:0,jogadores:{"Walter":{nome:"Walter",idade:20,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:7,velocidade:6,habilidade:8},valor_mercado:6000000},"Matheus_Alexandre":{nome:"Matheus Alexandre",idade:26,posicoes:{p:"Lateral",s:"Meia",t:"Ponta"},atributos:{ataque:8,defesa:8,forca:7,velocidade:11,habilidade:8},valor_mercado:7500000},"Marllon":{nome:"Marllon",idade:24,posicoes:{p:"Zagueiro",s:"Volante",t:"Lateral"},atributos:{ataque:3,defesa:11,forca:12,velocidade:6,habilidade:4},valor_mercado:8000000},"Alan_Empereur":{nome:"Alan Empereur",idade:22,posicoes:{p:"Zagueiro",s:"Volante",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:11,velocidade:7,habilidade:4},valor_mercado:5000000},"Ramon":{nome:"Ramon",idade:31,posicoes:{p:"Lateral",s:"Ponta",t:"Meia"},atributos:{ataque:9,defesa:6,forca:6,velocidade:8,habilidade:9},valor_mercado:4000000},"Lucas_Mineiro":{nome:"Lucas Mineiro",idade:30,posicoes:{p:"Volante",s:"Zagueiro",t:"Meia"},atributos:{ataque:4,defesa:11,forca:10,velocidade:6,habilidade:7},valor_mercado:6000000},"Fernando_Sobral":{nome:"Fernando Sobral",idade:36,posicoes:{p:"Meia",s:"Volante",t:"Nenhuma"},atributos:{ataque:6,defesa:9,forca:8,velocidade:4,habilidade:11},valor_mercado:2500000},"Lucas_Fernandes":{nome:"Lucas Fernandes",idade:21,posicoes:{p:"Meia",s:"Ponta",t:"Atacante"},atributos:{ataque:7,defesa:3,forca:5,velocidade:10,habilidade:11},valor_mercado:9000000},"Clayson":{nome:"Clayson",idade:32,posicoes:{p:"Atacante",s:"Ponta",t:"Meia"},atributos:{ataque:10,defesa:2,forca:7,velocidade:8,habilidade:9},valor_mercado:4500000},"Derik_Lacerda":{nome:"Derik Lacerda",idade:25,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:6,velocidade:11,habilidade:10},valor_mercado:8500000},"Isidro_Pitta":{nome:"Isidro Pitta",idade:27,posicoes:{p:"Atacante",s:"Centroavante",t:"Ponta"},atributos:{ataque:11,defesa:2,forca:9,velocidade:9,habilidade:8},valor_mercado:10000000}}},
            "Fortaleza":{divisao:"A",forca_base:0,jogadores:{"Joao_Ricardo":{nome:"João Ricardo",idade:35,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:11,forca:8,velocidade:4,habilidade:6},valor_mercado:3000000},"Tinga":{nome:"Tinga",idade:30,posicoes:{p:"Lateral",s:"Zagueiro",t:"Nenhuma"},atributos:{ataque:7,defesa:10,forca:8,velocidade:8,habilidade:7},valor_mercado:4000000},"Britez":{nome:"Brítez",idade:32,posicoes:{p:"Zagueiro",s:"Lateral",t:"Nenhuma"},atributos:{ataque:3,defesa:11,forca:10,velocidade:6,habilidade:5},valor_mercado:3500000},"Titi":{nome:"Titi",idade:36,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:10,forca:11,velocidade:3,habilidade:4},valor_mercado:1500000},"Bruno_Pacheco":{nome:"Bruno Pacheco",idade:32,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:9,forca:7,velocidade:7,habilidade:7},valor_mercado:3000000},"Lucas_Sasha":{nome:"Lucas Sasha",idade:34,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:10,forca:8,velocidade:5,habilidade:7},valor_mercado:2000000},"Hercules":{nome:"Hércules",idade:23,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:7,defesa:9,forca:8,velocidade:8,habilidade:8},valor_mercado:7000000},"Pochettino":{nome:"Pochettino",idade:28,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:4,forca:6,velocidade:8,habilidade:11},valor_mercado:9000000},"Yago_Pikachu":{nome:"Yago Pikachu",idade:32,posicoes:{p:"Atacante",s:"Lateral",t:"Ponta"},atributos:{ataque:10,defesa:5,forca:6,velocidade:8,habilidade:9},valor_mercado:5000000},"Breno_Lopes":{nome:"Breno Lopes",idade:28,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:9,defesa:3,forca:6,velocidade:10,habilidade:8},valor_mercado:6000000},"Lucero":{nome:"Lucero",idade:32,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:12,defesa:2,forca:9,velocidade:6,habilidade:9},valor_mercado:7000000}}},
            "Goias":{divisao:"B",forca_base:0,jogadores:{"Thiago_Rodrigues":{nome:"Thiago Rodrigues",idade:35,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:9,forca:7,velocidade:4,habilidade:5},valor_mercado:900000},"Rodrigo_Soares":{nome:"Rodrigo Soares",idade:31,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:6,velocidade:7,habilidade:7},valor_mercado:1000000},"Lucas_Ribeiro":{nome:"Lucas Ribeiro",idade:25,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:9,velocidade:6,habilidade:5},valor_mercado:1500000},"Ramon_Menezes":{nome:"Ramon Menezes",idade:29,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:3,defesa:8,forca:10,velocidade:5,habilidade:4},valor_mercado:1200000},"Nicolas":{nome:"Nicolas",idade:34,posicoes:{p:"Lateral",s:"Atacante",t:"Nenhuma"},atributos:{ataque:8,defesa:5,forca:8,velocidade:5,habilidade:7},valor_mercado:1000000},"Filipe_Machado":{nome:"Filipe Machado",idade:28,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:8,forca:7,velocidade:6,habilidade:8},valor_mercado:1800000},"Lourenco":{nome:"Lourenço",idade:26,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:7,forca:7,velocidade:7,habilidade:7},valor_mercado:1400000},"Lucas_Lima":{nome:"Lucas Lima",idade:34,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:4,velocidade:5,habilidade:11},valor_mercado:2000000},"Jean_Carlos":{nome:"Jean Carlos",idade:32,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:6,velocidade:5,habilidade:9},valor_mercado:1800000},"Cadu":{nome:"Cadu",idade:22,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:6,velocidade:9,habilidade:7},valor_mercado:1200000},"Anselmo_Ramon_GO":{nome:"Anselmo Ramon",idade:36,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:9,velocidade:4,habilidade:7},valor_mercado:900000}}},
            "Juventude":{divisao:"A",forca_base:0,jogadores:{"Jandrei":{nome:"Jandrei",idade:31,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:10,forca:7,velocidade:5,habilidade:6},valor_mercado:2000000},"Rai_Ramos":{nome:"Raí Ramos",idade:30,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:7,velocidade:8,habilidade:7},valor_mercado:1800000},"Rodrigo_Sam":{nome:"Rodrigo Sam",idade:28,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:10,velocidade:5,habilidade:4},valor_mercado:1500000},"Messias":{nome:"Messias",idade:29,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:3,defesa:10,forca:11,velocidade:4,habilidade:4},valor_mercado:2000000},"Marcos_Paulo":{nome:"Marcos Paulo",idade:23,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:8,velocidade:6,habilidade:5},valor_mercado:1200000},"Lucas_Mineiro":{nome:"Lucas Mineiro",idade:28,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:5,defesa:9,forca:9,velocidade:6,habilidade:7},valor_mercado:2000000},"Rai_Silva":{nome:"Raí Silva",idade:24,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:8,forca:7,velocidade:7,habilidade:6},valor_mercado:1000000},"Mandaca":{nome:"Mandaca",idade:22,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:8,forca:8,velocidade:7,habilidade:7},valor_mercado:1800000},"Patryck_Lanza":{nome:"Patryck Lanza",idade:21,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:7,forca:6,velocidade:9,habilidade:7},valor_mercado:2500000},"Fabio_Lima":{nome:"Fábio Lima",idade:30,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:6,velocidade:8,habilidade:8},valor_mercado:1500000},"Alisson_Safira":{nome:"Alisson Safira",idade:29,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:9,defesa:2,forca:9,velocidade:6,habilidade:7},valor_mercado:1800000}}},
            "Londrina":{divisao:"B",forca_base:0,jogadores:{"Arthur_Bittencourt":{nome:"Arthur Bittencourt",idade:23,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:8,forca:6,velocidade:6,habilidade:5},valor_mercado:800000},"Thiago_Ennes":{nome:"Thiago Ennes",idade:28,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:6,velocidade:8,habilidade:6},valor_mercado:700000},"Joao_Maistro":{nome:"João Maistro",idade:23,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:8,velocidade:6,habilidade:4},valor_mercado:900000},"Rayan_Ribeiro":{nome:"Rayan Ribeiro",idade:27,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:7,forca:9,velocidade:5,habilidade:4},valor_mercado:800000},"Mauricio_Antonio":{nome:"Maurício Antônio",idade:32,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:7,forca:7,velocidade:6,habilidade:5},valor_mercado:600000},"Kadi":{nome:"Kadi",idade:24,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:7,forca:7,velocidade:7,habilidade:6},valor_mercado:800000},"Taua":{nome:"Tauã",idade:29,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:8,forca:8,velocidade:5,habilidade:5},valor_mercado:750000},"Rafael_Longuine":{nome:"Rafael Longuine",idade:34,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:5,velocidade:4,habilidade:9},valor_mercado:1000000},"Calyson":{nome:"Calyson",idade:31,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:6,velocidade:6,habilidade:7},valor_mercado:900000},"Iago_Teles":{nome:"Iago Teles",idade:23,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:6,velocidade:9,habilidade:7},valor_mercado:1100000},"Daniel_Amorim":{nome:"Daniel Amorim",idade:34,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:9,velocidade:3,habilidade:6},valor_mercado:800000}}},
            "Nautico":{divisao:"B",forca_base:0,jogadores:{"Lucas_Maticoli":{nome:"Lucas Maticoli",idade:27,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:8,forca:7,velocidade:5,habilidade:5},valor_mercado:900000},"Arnaldo":{nome:"Arnaldo",idade:32,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:6,velocidade:6,habilidade:6},valor_mercado:700000},"Joecio":{nome:"Joécio",idade:38,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:3,habilidade:4},valor_mercado:500000},"Iran":{nome:"Iran",idade:25,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:7,forca:8,velocidade:6,habilidade:4},valor_mercado:800000},"Diego_Matos":{nome:"Diego Matos",idade:27,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:6,velocidade:8,habilidade:6},valor_mercado:900000},"Sousa":{nome:"Sousa",idade:29,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:8,forca:8,velocidade:5,habilidade:6},valor_mercado:1000000},"Marco_Antonio":{nome:"Marco Antônio",idade:23,posicoes:{p:"Volante",s:"Meia",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:6,velocidade:8,habilidade:8},valor_mercado:1200000},"Patrick_Allan":{nome:"Patrick Allan",idade:29,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:4,forca:6,velocidade:6,habilidade:8},valor_mercado:1100000},"Gustavo_Maia":{nome:"Gustavo Maia",idade:23,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:5,velocidade:10,habilidade:8},valor_mercado:1400000},"Bruno_Mezenga":{nome:"Bruno Mezenga",idade:35,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:9,velocidade:4,habilidade:7},valor_mercado:900000},"Cleo_Silva":{nome:"Cléo Silva",idade:34,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:6,velocidade:5,habilidade:7},valor_mercado:800000}}},
            "Novorizontino":{divisao:"B",forca_base:0,jogadores:{"Jordi":{nome:"Jordi",idade:30,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:9,forca:7,velocidade:4,habilidade:6},valor_mercado:1300000},"Rodrigo_Soares_NOV":{nome:"Rodrigo Soares",idade:31,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:7,velocidade:7,habilidade:6},valor_mercado:1100000},"Luisao":{nome:"Luisão",idade:23,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:6,habilidade:4},valor_mercado:1200000},"Cesar_Martins":{nome:"César Martins",idade:31,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:3,defesa:9,forca:9,velocidade:4,habilidade:5},valor_mercado:1400000},"Reinaldo":{nome:"Reinaldo",idade:23,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:6,velocidade:9,habilidade:7},valor_mercado:1300000},"Willian_Farias":{nome:"Willian Farias",idade:35,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:9,forca:8,velocidade:3,habilidade:7},valor_mercado:1000000},"Geovane":{nome:"Geovane",idade:25,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:8,forca:7,velocidade:6,habilidade:7},valor_mercado:1500000},"Marlon":{nome:"Marlon",idade:34,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:4,forca:5,velocidade:4,habilidade:9},valor_mercado:1200000},"Waguininho":{nome:"Waguininho",idade:34,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:6,velocidade:5,habilidade:7},valor_mercado:900000},"Fabricio_Daniel":{nome:"Fabrício Daniel",idade:26,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:6,velocidade:8,habilidade:8},valor_mercado:1800000},"Rodolfo":{nome:"Rodolfo",idade:32,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:7,velocidade:6,habilidade:7},valor_mercado:1400000}}},
            "Operario-PR":{divisao:"B",forca_base:0,jogadores:{"Vagner":{nome:"Vagner",idade:34,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:9,forca:7,velocidade:4,habilidade:5},valor_mercado:1000000},"Mikael_Doka":{nome:"Mikael Doka",idade:24,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:6,velocidade:9,habilidade:6},valor_mercado:1100000},"Klaus":{nome:"Klaus",idade:30,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:4,habilidade:4},valor_mercado:1200000},"Miranda":{nome:"Miranda",idade:24,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:8,velocidade:6,habilidade:4},valor_mercado:1100000},"Moraes":{nome:"Moraes",idade:26,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:6,velocidade:8,habilidade:7},valor_mercado:1200000},"Matheus_Trindade":{nome:"Matheus Trindade",idade:28,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:8,forca:8,velocidade:5,habilidade:6},valor_mercado:1000000},"Vinicius_Diniz":{nome:"Vinícius Diniz",idade:24,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:7,forca:7,velocidade:7,habilidade:7},valor_mercado:1300000},"Boschilia":{nome:"Boschilia",idade:28,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:5,velocidade:7,habilidade:9},valor_mercado:1800000},"Berto":{nome:"Berto",idade:22,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:6,velocidade:8,habilidade:7},valor_mercado:1000000},"Pablo":{nome:"Pablo",idade:32,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:7,velocidade:5,habilidade:7},valor_mercado:900000},"Aylon":{nome:"Aylon",idade:32,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:6,velocidade:6,habilidade:7},valor_mercado:1200000}}},
            "Ponte_Preta":{divisao:"B",forca_base:0,jogadores:{"Diogo_Silva":{nome:"Diogo Silva",idade:37,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:9,forca:7,velocidade:3,habilidade:5},valor_mercado:800000},"Lucas_Justen":{nome:"Lucas Justen",idade:20,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:5,velocidade:9,habilidade:6},valor_mercado:900000},"Weverton":{nome:"Weverton",idade:24,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:7,forca:8,velocidade:6,habilidade:4},valor_mercado:1000000},"Marcio_Silva":{nome:"Márcio Silva",idade:23,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:6,habilidade:4},valor_mercado:1100000},"Kevyson":{nome:"Kevyson",idade:20,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:5,velocidade:9,habilidade:7},valor_mercado:1200000},"Andre_Lima":{nome:"André Lima",idade:23,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:7,forca:7,velocidade:7,habilidade:6},valor_mercado:1000000},"Rodrigo_Souza":{nome:"Rodrigo Souza",idade:36,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:8,forca:8,velocidade:3,habilidade:6},valor_mercado:600000},"Danilo_Barcelos":{nome:"Danilo Barcelos",idade:32,posicoes:{p:"Meia",s:"Lateral",t:"Nenhuma"},atributos:{ataque:7,defesa:6,forca:6,velocidade:5,habilidade:8},valor_mercado:1100000},"Diego_Tavares":{nome:"Diego Tavares",idade:32,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:6,defesa:4,forca:6,velocidade:6,habilidade:7},valor_mercado:900000},"Bryan_Mascarenhas":{nome:"Bryan Mascarenhas",idade:27,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:6,velocidade:8,habilidade:7},valor_mercado:1000000},"David":{nome:"David",idade:24,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:7,velocidade:8,habilidade:7},valor_mercado:1100000}}},
            "Sao_Bernardo":{divisao:"B",forca_base:0,jogadores:{"Alex_Alves":{nome:"Alex Alves",idade:37,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:8,forca:6,velocidade:3,habilidade:5},valor_mercado:700000},"Rodrigo_Ferreira":{nome:"Rodrigo Ferreira",idade:29,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:6,velocidade:7,habilidade:6},valor_mercado:900000},"Jemerson":{nome:"Jemerson",idade:31,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:4,habilidade:4},valor_mercado:1200000},"Augusto":{nome:"Augusto",idade:27,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:7,forca:8,velocidade:6,habilidade:4},valor_mercado:1000000},"Para":{nome:"Pará",idade:38,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:7,forca:6,velocidade:3,habilidade:7},valor_mercado:500000},"Romisson":{nome:"Romisson",idade:27,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:7,forca:7,velocidade:7,habilidade:6},valor_mercado:900000},"Foguinho":{nome:"Foguinho",idade:23,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:6,forca:6,velocidade:8,habilidade:6},valor_mercado:1000000},"Dudu_Miraima":{nome:"Dudu Miraíma",idade:24,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:4,forca:6,velocidade:7,habilidade:7},valor_mercado:1100000},"Pedro_Vitor":{nome:"Pedro Vitor",idade:26,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:5,velocidade:9,habilidade:7},valor_mercado:1200000},"Echapora":{nome:"Echaporã",idade:24,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:3,forca:6,velocidade:8,habilidade:7},valor_mercado:1100000},"Felipe_Garcia":{nome:"Felipe Garcia",idade:33,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:8,velocidade:5,habilidade:6},valor_mercado:1000000}}},
            "Sport":{divisao:"B",forca_base:0,jogadores:{"Thiago_Couto":{nome:"Thiago Couto",idade:25,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:9,forca:7,velocidade:6,habilidade:5},valor_mercado:1500000},"Madson":{nome:"Madson",idade:32,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:6,forca:6,velocidade:7,habilidade:6},valor_mercado:1200000},"Marcelo_Benevenuto":{nome:"Marcelo Benevenuto",idade:28,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:9,forca:10,velocidade:5,habilidade:4},valor_mercado:2000000},"Marcelo_Ajul":{nome:"Marcelo Ajul",idade:22,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:8,velocidade:6,habilidade:5},valor_mercado:1300000},"Felipinho":{nome:"Felipinho",idade:27,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:7,velocidade:8,habilidade:6},valor_mercado:1500000},"Biel":{nome:"Biel",idade:22,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:7,forca:7,velocidade:7,habilidade:7},valor_mercado:1600000},"Ze_Lucas":{nome:"Zé Lucas",idade:25,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:5,defesa:8,forca:8,velocidade:6,habilidade:6},valor_mercado:1400000},"Chrystian_Barletta":{nome:"Chrystian Barletta",idade:23,posicoes:{p:"Meia",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:5,velocidade:10,habilidade:9},valor_mercado:3000000},"Carlos_de_Pena":{nome:"Carlos de Pena",idade:32,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:5,forca:6,velocidade:5,habilidade:9},valor_mercado:2500000},"Clayson_Sport":{nome:"Clayson",idade:29,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:5,velocidade:8,habilidade:9},valor_mercado:2200000},"Pedro_Perotti":{nome:"Pedro Perotti",idade:26,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:8,velocidade:7,habilidade:7},valor_mercado:1800000}}},
            "Vila_Nova":{divisao:"B",forca_base:0,jogadores:{"Denis":{nome:"Denis",idade:37,posicoes:{p:"Goleiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:1,defesa:8,forca:6,velocidade:3,habilidade:5},valor_mercado:800000},"Elias":{nome:"Elias",idade:25,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:6,forca:6,velocidade:8,habilidade:6},valor_mercado:1000000},"Juan_Quintero":{nome:"Juan Quintero",idade:29,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:8,forca:9,velocidade:5,habilidade:4},valor_mercado:1200000},"Jemmes":{nome:"Jemmes",idade:23,posicoes:{p:"Zagueiro",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:2,defesa:7,forca:8,velocidade:6,habilidade:4},valor_mercado:900000},"Ericson":{nome:"Ericson",idade:25,posicoes:{p:"Lateral",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:7,forca:6,velocidade:7,habilidade:6},valor_mercado:1100000},"Ralf":{nome:"Ralf",idade:40,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:3,defesa:9,forca:8,velocidade:2,habilidade:6},valor_mercado:500000},"Cristiano":{nome:"Cristiano",idade:25,posicoes:{p:"Volante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:4,defesa:7,forca:7,velocidade:7,habilidade:6},valor_mercado:1000000},"Joao_Lucas":{nome:"João Lucas",idade:25,posicoes:{p:"Meia",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:6,defesa:4,forca:6,velocidade:7,habilidade:7},valor_mercado:1200000},"Alesson":{nome:"Alesson",idade:25,posicoes:{p:"Atacante",s:"Ponta",t:"Nenhuma"},atributos:{ataque:8,defesa:3,forca:6,velocidade:9,habilidade:8},valor_mercado:1600000},"Henrique_Almeida":{nome:"Henrique Almeida",idade:33,posicoes:{p:"Atacante",s:"Centroavante",t:"Nenhuma"},atributos:{ataque:8,defesa:2,forca:8,velocidade:5,habilidade:7},valor_mercado:1100000},"Junior_Todinho":{nome:"Júnior Todinho",idade:30,posicoes:{p:"Atacante",s:"Nenhuma",t:"Nenhuma"},atributos:{ataque:7,defesa:2,forca:7,velocidade:6,habilidade:6},valor_mercado:1000000}}},
        };


        // 2. COLE AQUI A SUA CONSTANTE DE RESERVAS DO ARQUIVO base.txt
        const baseDeReservas = {
            "Athletico-PR": {
            "Leo_Linck": {nome: "Léo Linck", idade: 25, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 9, forca: 6, velocidade: 5, habilidade: 6}, valor_mercado: 2000000},
            "Madson": {nome: "Madson", idade: 34, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 7, forca: 7, velocidade: 7, habilidade: 6}, valor_mercado: 1200000},
            "Kaique_Rocha": {nome: "Kaique Rocha", idade: 25, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 9, forca: 9, velocidade: 6, habilidade: 5}, valor_mercado: 3500000},
            "Felipinho": {nome: "Felipinho", idade: 24, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 8, forca: 7, velocidade: 7, habilidade: 7}, valor_mercado: 2500000},
            "Zapelli": {nome: "Zapelli", idade: 24, posicoes: {p: "Meia", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 4, forca: 5, velocidade: 8, habilidade: 9}, valor_mercado: 5500000},
            "Mastriani": {nome: "Mastriani", idade: 33, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 9, defesa: 2, forca: 8, velocidade: 5, habilidade: 7}, valor_mercado: 2000000}
            },
            "Atletico-MG": {
                "Matheus_Mendes": {nome: "Matheus Mendes", idade: 27, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 9, forca: 7, velocidade: 4, habilidade: 6}, valor_mercado: 1500000},
                "Mariano": {nome: "Mariano", idade: 38, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 7, forca: 6, velocidade: 5, habilidade: 8}, valor_mercado: 500000},
                "Igor_Rabello": {nome: "Igor Rabello", idade: 31, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 9, forca: 10, velocidade: 5, habilidade: 4}, valor_mercado: 2000000},
                "Fausto_Vera": {nome: "Fausto Vera", idade: 26, posicoes: {p: "Volante", s: "Meia", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 9, forca: 8, velocidade: 7, habilidade: 8}, valor_mercado: 7000000},
                "Igor_Gomes": {nome: "Igor Gomes", idade: 27, posicoes: {p: "Meia", s: "Volante", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 5, forca: 6, velocidade: 7, habilidade: 8}, valor_mercado: 4000000},
                "Eduardo_Vargas": {nome: "Eduardo Vargas", idade: 36, posicoes: {p: "Atacante", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 9, defesa: 2, forca: 6, velocidade: 6, habilidade: 9}, valor_mercado: 1000000}
            },
            "Bahia": {
                "Adriel": {nome: "Adriel", idade: 25, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 9, forca: 7, velocidade: 5, habilidade: 6}, valor_mercado: 1800000},
                "Cicinho": {nome: "Cicinho", idade: 35, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 7, forca: 7, velocidade: 6, habilidade: 6}, valor_mercado: 600000},
                "David_Duarte": {nome: "David Duarte", idade: 31, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 9, forca: 9, velocidade: 4, habilidade: 4}, valor_mercado: 1000000},
                "Rezende": {nome: "Rezende", idade: 31, posicoes: {p: "Volante", s: "Zagueiro", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 9, forca: 9, velocidade: 6, habilidade: 6}, valor_mercado: 3000000},
                "Yago_Felipe": {nome: "Yago Felipe", idade: 31, posicoes: {p: "Meia", s: "Volante", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 6, forca: 7, velocidade: 6, habilidade: 8}, valor_mercado: 2000000},
                "Rafael_Ratao": {nome: "Rafael Ratão", idade: 30, posicoes: {p: "Atacante", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 3, forca: 7, velocidade: 8, habilidade: 7}, valor_mercado: 2500000}
            },
            "Botafogo": {
                "Gatito_Fernandez": {nome: "Gatito Fernández", idade: 38, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 10, forca: 7, velocidade: 4, habilidade: 7}, valor_mercado: 500000},
                "Marcal": {nome: "Marçal", idade: 37, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 9, forca: 7, velocidade: 5, habilidade: 8}, valor_mercado: 600000},
                "Lucas_Halter": {nome: "Lucas Halter", idade: 26, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 9, forca: 10, velocidade: 6, habilidade: 5}, valor_mercado: 4000000},
                "Danilo_Barbosa": {nome: "Danilo Barbosa", idade: 30, posicoes: {p: "Volante", s: "Zagueiro", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 9, forca: 9, velocidade: 6, habilidade: 8}, valor_mercado: 3500000},
                "Eduardo": {nome: "Eduardo", idade: 36, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 4, forca: 6, velocidade: 5, habilidade: 10}, valor_mercado: 1500000},
                "Tiquinho_Soares": {nome: "Tiquinho Soares", idade: 35, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 10, defesa: 2, forca: 11, velocidade: 5, habilidade: 8}, valor_mercado: 3000000}
            },
            "Chapecoense": {
                "Gabriel_Gasparotto": {nome: "Gabriel Gasparotto", idade: 32, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 7, forca: 6, velocidade: 4, habilidade: 5}, valor_mercado: 400000},
                "Kelvyn": {nome: "Kelvyn", idade: 27, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 6, forca: 6, velocidade: 7, habilidade: 6}, valor_mercado: 500000},
                "Rodrigo_Moledo": {nome: "Rodrigo Moledo", idade: 38, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 8, forca: 8, velocidade: 3, habilidade: 4}, valor_mercado: 200000},
                "Tariko": {nome: "Tariko", idade: 25, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 6, forca: 6, velocidade: 6, habilidade: 5}, valor_mercado: 300000},
                "Thomás_Bedinelli": {nome: "Thomás", idade: 33, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 3, forca: 4, velocidade: 5, habilidade: 7}, valor_mercado: 400000},
                "Mario_Sergio_Chape": {nome: "Mário Sérgio", idade: 30, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 2, forca: 7, velocidade: 6, habilidade: 6}, valor_mercado: 600000}
            },
            "Corinthians": {
                "Donelli": {nome: "Matheus Donelli", idade: 24, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 9, forca: 7, velocidade: 5, habilidade: 5}, valor_mercado: 1500000},
                "Fagner": {nome: "Fagner", idade: 37, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 7, forca: 7, velocidade: 5, habilidade: 8}, valor_mercado: 800000},
                "Caca_Zac": {nome: "Cacá", idade: 27, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 10, forca: 10, velocidade: 5, habilidade: 5}, valor_mercado: 3500000},
                "Raniele": {nome: "Raniele", idade: 29, posicoes: {p: "Volante", s: "Zagueiro", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 10, forca: 10, velocidade: 6, habilidade: 7}, valor_mercado: 5000000},
                "Coronado": {nome: "Igor Coronado", idade: 34, posicoes: {p: "Meia", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 3, forca: 4, velocidade: 6, habilidade: 11}, valor_mercado: 4000000},
                "Hector_Hernandez": {nome: "Héctor Hernández", idade: 31, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 9, defesa: 2, forca: 8, velocidade: 6, habilidade: 6}, valor_mercado: 2000000}
            },
            "Coritiba": {
                "Benassi": {nome: "Benassi", idade: 22, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 7, forca: 6, velocidade: 5, habilidade: 5}, valor_mercado: 500000},
                "Jhonny": {nome: "Jhonny", idade: 24, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 6, forca: 6, velocidade: 8, habilidade: 5}, valor_mercado: 600000},
                "Benevenuto": {nome: "Marcelo Benevenuto", idade: 30, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 8, forca: 8, velocidade: 5, habilidade: 4}, valor_mercado: 1200000},
                "Morelli_Coxa": {nome: "Morelli", idade: 28, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 8, forca: 7, velocidade: 6, habilidade: 6}, valor_mercado: 1000000},
                "Geovane_Meia": {nome: "Geovane Meia", idade: 25, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 4, forca: 5, velocidade: 6, habilidade: 7}, valor_mercado: 700000},
                "Junior_Brandao": {nome: "Júnior Brandão", idade: 31, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 2, forca: 8, velocidade: 5, habilidade: 6}, valor_mercado: 800000}
            },
            "Cruzeiro": {
                "Anderson_Goleiro": {nome: "Anderson", idade: 28, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 9, forca: 7, velocidade: 5, habilidade: 6}, valor_mercado: 1200000},
                "Kaiki": {nome: "Kaiki Bruno", idade: 23, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 7, forca: 6, velocidade: 9, habilidade: 7}, valor_mercado: 2500000},
                "Jonathan_Jesus": {nome: "Jonathan Jesus", idade: 22, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 8, forca: 8, velocidade: 7, habilidade: 5}, valor_mercado: 2000000},
                "Ramiro": {nome: "Ramiro", idade: 33, posicoes: {p: "Volante", s: "Meia", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 8, forca: 7, velocidade: 6, habilidade: 7}, valor_mercado: 1000000},
                "Mateus_Vital": {nome: "Mateus Vital", idade: 28, posicoes: {p: "Meia", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 4, forca: 5, velocidade: 7, habilidade: 8}, valor_mercado: 2500000},
                "Rafa_Silva": {nome: "Rafa Silva", idade: 34, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 2, forca: 8, velocidade: 6, habilidade: 7}, valor_mercado: 1000000}
            },
            "Cuiaba": {
                "Mateus_Pasinato": {nome: "Mateus Pasinato", idade: 34, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 9, forca: 7, velocidade: 4, habilidade: 6}, valor_mercado: 800000},
                "Railan": {nome: "Railan", idade: 26, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 6, forca: 6, velocidade: 8, habilidade: 6}, valor_mercado: 1500000},
                "Gabriel_Knesowitsch": {nome: "Gabriel Knesowitsch", idade: 23, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 8, forca: 8, velocidade: 6, habilidade: 4}, valor_mercado: 1200000},
                "Filipe_Augusto": {nome: "Filipe Augusto", idade: 33, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 8, forca: 8, velocidade: 5, habilidade: 6}, valor_mercado: 800000},
                "Gustavo_Sauer_Banco": {nome: "Gustavo Sauer", idade: 33, posicoes: {p: "Meia", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 3, forca: 5, velocidade: 6, habilidade: 8}, valor_mercado: 2000000},
                "Eliel": {nome: "Eliel", idade: 23, posicoes: {p: "Atacante", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 2, forca: 7, velocidade: 9, habilidade: 7}, valor_mercado: 1800000}
            },
            "Flamengo": {
                "Matheus_Cunha_Fla": {nome: "Matheus Cunha", idade: 25, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 9, forca: 7, velocidade: 6, habilidade: 7}, valor_mercado: 3500000},
                "Varela": {nome: "Guillermo Varela", idade: 33, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 9, forca: 7, velocidade: 7, habilidade: 7}, valor_mercado: 2000000},
                "David_Luiz": {nome: "David Luiz", idade: 39, posicoes: {p: "Zagueiro", s: "Volante", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 10, forca: 9, velocidade: 4, habilidade: 8}, valor_mercado: 500000},
                "Allan_Fla": {nome: "Allan", idade: 29, posicoes: {p: "Volante", s: "Meia", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 9, forca: 7, velocidade: 7, habilidade: 8}, valor_mercado: 4500000},
                "Alcaraz": {nome: "Charly Alcaraz", idade: 23, posicoes: {p: "Meia", s: "Volante", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 6, forca: 7, velocidade: 8, habilidade: 10}, valor_mercado: 15000000},
                "Bruno_Henrique_Fla": {nome: "Bruno Henrique", idade: 35, posicoes: {p: "Atacante", s: "Ponta", t: "Centroavante"}, atributos: {ataque: 10, defesa: 3, forca: 8, velocidade: 11, habilidade: 9}, valor_mercado: 2000000}
            },
            "Fluminense": {
                "Vitor_Eudes": {nome: "Vitor Eudes", idade: 27, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 8, forca: 7, velocidade: 5, habilidade: 5}, valor_mercado: 600000},
                "Guga": {nome: "Guga", idade: 27, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 7, forca: 6, velocidade: 8, habilidade: 7}, valor_mercado: 3000000},
                "Manoel": {nome: "Manoel", idade: 36, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 9, forca: 10, velocidade: 4, habilidade: 4}, valor_mercado: 400000},
                "Nonato": {nome: "Nonato", idade: 28, posicoes: {p: "Volante", s: "Meia", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 7, forca: 7, velocidade: 6, habilidade: 8}, valor_mercado: 1800000},
                "Renato_Augusto": {nome: "Renato Augusto", idade: 38, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 3, forca: 5, velocidade: 3, habilidade: 11}, valor_mercado: 500000},
                "John_Kennedy": {nome: "John Kennedy", idade: 24, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 9, defesa: 2, forca: 8, velocidade: 9, habilidade: 8}, valor_mercado: 7000000}
            },
            "Gremio": {
                "Marchesin": {nome: "Marchesín", idade: 38, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 9, forca: 7, velocidade: 4, habilidade: 6}, valor_mercado: 800000},
                "Fabio_Gre": {nome: "Fábio", idade: 36, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 7, forca: 6, velocidade: 5, habilidade: 7}, valor_mercado: 400000},
                "Rodrigo_Ely": {nome: "Rodrigo Ely", idade: 32, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 9, forca: 10, velocidade: 5, habilidade: 4}, valor_mercado: 1500000},
                "Dodi": {nome: "Dodi", idade: 30, posicoes: {p: "Volante", s: "Meia", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 8, forca: 7, velocidade: 8, habilidade: 7}, valor_mercado: 2000000},
                "Edenilson": {nome: "Edenílson", idade: 36, posicoes: {p: "Meia", s: "Volante", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 7, forca: 7, velocidade: 6, habilidade: 8}, valor_mercado: 1000000},
                "Diego_Costa": {nome: "Diego Costa", idade: 37, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 9, defesa: 2, forca: 11, velocidade: 4, habilidade: 7}, valor_mercado: 1000000}
            },
            "Internacional": {
                "Anthoni": {nome: "Anthoni", idade: 24, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 8, forca: 6, velocidade: 6, habilidade: 5}, valor_mercado: 800000},
                "Nathan": {nome: "Nathan Santos", idade: 24, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 7, forca: 6, velocidade: 8, habilidade: 6}, valor_mercado: 1500000},
                "Rogel": {nome: "Agustín Rogel", idade: 28, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 9, forca: 10, velocidade: 5, habilidade: 4}, valor_mercado: 2500000},
                "Rômulo_Inter": {nome: "Rômulo", idade: 26, posicoes: {p: "Volante", s: "Lateral", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 8, forca: 7, velocidade: 7, habilidade: 6}, valor_mercado: 2000000},
                "Hyoran": {nome: "Hyoran", idade: 33, posicoes: {p: "Meia", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 7, defense: 4, forca: 5, velocidade: 6, habilidade: 8}, valor_mercado: 1500000},
                "Enner_Valencia": {nome: "Enner Valencia", idade: 36, posicoes: {p: "Atacante", s: "Centroavante", t: "Ponta"}, atributos: {ataque: 9, defesa: 2, forca: 9, velocidade: 8, habilidade: 8}, valor_mercado: 2500000}
            },
            "Mirassol": {
                "Vanderlei": {nome: "Vanderlei", idade: 42, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 7, forca: 6, velocidade: 2, habilidade: 5}, valor_mercado: 100000},
                "Zeca": {nome: "Zeca", idade: 32, posicoes: {p: "Lateral", s: "Meia", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 6, forca: 6, velocidade: 6, habilidade: 7}, valor_mercado: 600000},
                "Henri": {nome: "Henri", idade: 24, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 7, forca: 8, velocidade: 5, habilidade: 4}, valor_mercado: 500000},
                "Rodrigo_Andrade": {nome: "Rodrigo Andrade", idade: 29, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 7, forca: 8, velocidade: 5, habilidade: 6}, valor_mercado: 700000},
                "Isaque": {nome: "Isaque", idade: 29, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 3, forca: 5, velocidade: 6, habilidade: 7}, valor_mercado: 600000},
                "Léo_Gamalho": {nome: "Léo Gamalho", idade: 40, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 1, forca: 9, velocidade: 2, habilidade: 6}, valor_mercado: 200000}
            },
            "Palmeiras": {
                "Marcelo_Lomba": {nome: "Marcelo Lomba", idade: 39, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 9, forca: 7, velocidade: 4, habilidade: 6}, valor_mercado: 300000},
                "Mayke": {nome: "Mayke", idade: 33, posicoes: {p: "Lateral", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 8, forca: 7, velocidade: 9, habilidade: 8}, valor_mercado: 2000000},
                "Naves": {nome: "Naves", idade: 24, posicoes: {p: "Zagueiro", s: "Volante", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 9, forca: 8, velocidade: 7, habilidade: 6}, valor_mercado: 3000000},
                "Fabinho_Verdao": {nome: "Fabinho", idade: 24, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 8, forca: 8, velocidade: 7, habilidade: 7}, valor_mercado: 5000000},
                "Raphael_Veiga": {nome: "Raphael Veiga", idade: 31, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 10, defesa: 4, forca: 7, velocidade: 7, habilidade: 12}, valor_mercado: 12000000},
                "Rony": {nome: "Rony", idade: 31, posicoes: {p: "Atacante", s: "Ponta", t: "Centroavante"}, atributos: {ataque: 9, defesa: 4, forca: 8, velocidade: 10, habilidade: 7}, valor_mercado: 6000000}
            },
            "Bragantino": {
                "Fabricio": {nome: "Fabrício", idade: 26, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 9, forca: 6, velocidade: 5, habilidade: 5}, valor_mercado: 1000000},
                "Luan_Candido_Massa": {nome: "Luan Cândido", idade: 25, posicoes: {p: "Lateral", s: "Zagueiro", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 7, forca: 8, velocidade: 7, habilidade: 7}, valor_mercado: 4000000},
                "Douglas_Mendes": {nome: "Douglas Mendes", idade: 22, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 8, forca: 9, velocidade: 6, habilidade: 4}, valor_mercado: 2500000},
                "Jadsom": {nome: "Jadsom Silva", idade: 25, posicoes: {p: "Volante", s: "Meia", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 8, forca: 7, velocidade: 7, habilidade: 7}, valor_mercado: 3500000},
                "Lincoln": {nome: "Lincoln", idade: 27, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 4, forca: 5, velocidade: 7, habilidade: 9}, valor_mercado: 3000000},
                "Vinicinho": {nome: "Vinicinho", idade: 22, posicoes: {p: "Atacante", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 2, forca: 5, velocidade: 10, habilidade: 7}, valor_mercado: 1500000}
            },
            "Remo": {
                "Leo_Lang": {nome: "Léo Lang", idade: 28, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 8, forca: 6, velocidade: 4, habilidade: 5}, valor_mercado: 400000},
                "Kadu": {nome: "Kadu", idade: 24, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 6, forca: 6, velocidade: 8, habilidade: 5}, valor_mercado: 300000},
                "Bruno_Bispo": {nome: "Bruno Bispo", idade: 30, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 8, forca: 8, velocidade: 5, habilidade: 4}, valor_mercado: 500000},
                "Paul_Andrade": {nome: "Paul Andrade", idade: 26, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 7, forca: 7, velocidade: 6, habilidade: 5}, valor_mercado: 400000},
                "Marco_Antonio_Remo": {nome: "Marco Antônio", idade: 28, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 3, forca: 5, velocidade: 6, habilidade: 7}, valor_mercado: 600000},
                "Ribamar": {nome: "Ribamar", idade: 29, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 2, forca: 9, velocidade: 7, habilidade: 5}, valor_mercado: 500000}
            },
            "Santos": {
                "Renan": {nome: "Renan", idade: 31, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 8, forca: 7, velocidade: 4, habilidade: 5}, valor_mercado: 800000},
                "Aderlan": {nome: "Aderlan", idade: 35, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 7, forca: 7, velocidade: 6, habilidade: 7}, valor_mercado: 500000},
                "Jair_Paula": {nome: "Jair Paula", idade: 21, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 9, forca: 8, velocidade: 7, habilidade: 5}, valor_mercado: 4000000},
                "Sandry": {nome: "Sandry", idade: 23, posicoes: {p: "Volante", s: "Meia", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 8, forca: 6, velocidade: 7, habilidade: 8}, valor_mercado: 3000000},
                "Patrick": {nome: "Patrick", idade: 34, posicoes: {p: "Meia", s: "Ponta", t: "Volante"}, atributos: {ataque: 7, defesa: 6, forca: 8, velocidade: 5, habilidade: 8}, valor_mercado: 1000000},
                "Julio_Furch": {nome: "Julio Furch", idade: 37, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 9, defesa: 1, forca: 10, velocidade: 4, habilidade: 7}, valor_mercado: 800000}
            },
            "Sao_Paulo": {
                "Jandrei_SP": {nome: "Jandrei", idade: 33, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 9, forca: 7, velocidade: 5, habilidade: 6}, valor_mercado: 1000000},
                "Moreira": {nome: "João Moreira", idade: 22, posicoes: {p: "Lateral", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 7, forca: 6, velocidade: 8, habilidade: 7}, valor_mercado: 2500000},
                "Ferraresi": {nome: "Nahuel Ferraresi", idade: 27, posicoes: {p: "Zagueiro", s: "Lateral", t: "Nenhuma"}, atributos: {ataque: 3, defesa: 9, forca: 9, velocidade: 7, habilidade: 6}, valor_mercado: 4500000},
                "Santiago_Longo": {nome: "Santiago Longo", idade: 28, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 9, forca: 8, velocidade: 6, habilidade: 7}, valor_mercado: 3500000},
                "Galoppo": {nome: "Giuliano Galoppo", idade: 27, posicoes: {p: "Meia", s: "Atacante", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 5, forca: 7, velocidade: 6, habilidade: 8}, valor_mercado: 5000000},
                "Ferreirinha": {nome: "Ferreirinha", idade: 28, posicoes: {p: "Atacante", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 9, defesa: 3, forca: 5, velocidade: 10, habilidade: 9}, valor_mercado: 5000000}
            },
            "Vasco": {
                "Keiller": {nome: "Keiller", idade: 29, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 8, forca: 7, velocidade: 5, habilidade: 5}, valor_mercado: 1200000},
                "Puma_Rodriguez": {nome: "Puma Rodríguez", idade: 29, posicoes: {p: "Lateral", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 6, forca: 7, velocidade: 8, habilidade: 7}, valor_mercado: 2500000},
                "Maicon": {nome: "Maicon", idade: 37, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 9, forca: 11, velocidade: 4, habilidade: 4}, valor_mercado: 400000},
                "Galdames": {nome: "Pablo Galdames", idade: 29, posicoes: {p: "Volante", s: "Meia", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 8, forca: 7, velocidade: 6, habilidade: 8}, valor_mercado: 2000000},
                "Payet": {nome: "Dimitri Payet", idade: 39, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 2, forca: 5, velocidade: 4, habilidade: 12}, valor_mercado: 1000000},
                "Alex_Teixeira": {nome: "Alex Teixeira", idade: 36, posicoes: {p: "Atacante", s: "Meia", t: "Ponta"}, atributos: {ataque: 8, defesa: 3, forca: 6, velocidade: 6, habilidade: 8}, valor_mercado: 600000}
            },
            "Vitoria": {
                "Muriel": {nome: "Muriel", idade: 39, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 8, forca: 7, velocidade: 4, habilidade: 5}, valor_mercado: 300000},
                "Willean_Lepu": {nome: "Willean Lepo", idade: 29, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 6, forca: 6, velocidade: 8, habilidade: 6}, valor_mercado: 1500000},
                "Edu": {nome: "Edu", idade: 26, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 8, forca: 9, velocidade: 5, habilidade: 4}, valor_mercado: 1000000},
                "Leo_Naldi": {nome: "Léo Naldi", idade: 24, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 8, forca: 7, velocidade: 7, habilidade: 6}, valor_mercado: 2000000},
                "Jean_Mota": {nome: "Jean Mota", idade: 32, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 4, forca: 5, velocidade: 5, habilidade: 8}, valor_mercado: 1200000},
                "Carlos_Eduardo": {nome: "Carlos Eduardo", idade: 29, posicoes: {p: "Atacante", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 2, forca: 6, velocidade: 9, habilidade: 7}, valor_mercado: 1500000}
            },
            "America-MG": {
                "Jori": {nome: "Jori", idade: 30, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 8, forca: 7, velocidade: 4, habilidade: 5}, valor_mercado: 600000},
                "Daniel_Borges": {nome: "Daniel Borges", idade: 33, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 7, forca: 6, velocidade: 6, habilidade: 7}, valor_mercado: 800000},
                "Lucao": {nome: "Lucão", idade: 24, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 8, forca: 8, velocidade: 5, habilidade: 4}, valor_mercado: 900000},
                "Wallisson": {nome: "Wallisson", idade: 28, posicoes: {p: "Volante", s: "Meia", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 7, forca: 8, velocidade: 7, habilidade: 7}, valor_mercado: 1500000},
                "Rodriguinho_Coelho": {nome: "Rodriguinho", idade: 22, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 4, forca: 5, velocidade: 7, habilidade: 8}, valor_mercado: 1000000},
                "Jonathas": {nome: "Jonathas", idade: 37, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 1, forca: 9, velocidade: 3, habilidade: 6}, valor_mercado: 400000}
            },
            "Athletic-Club": {
                "Jefferson": {nome: "Jefferson", idade: 27, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 7, forca: 6, velocidade: 5, habilidade: 4}, valor_mercado: 300000},
                "Douglas_Pelé": {nome: "Douglas Pelé", idade: 26, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 6, forca: 6, velocidade: 7, habilidade: 5}, valor_mercado: 400000},
                "Marcelo_Serafim": {nome: "Marcelo", idade: 25, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 7, forca: 7, velocidade: 5, habilidade: 4}, valor_mercado: 300000},
                "Fumaça": {nome: "Fumaça", idade: 28, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 3, defesa: 7, forca: 8, velocidade: 5, habilidade: 5}, valor_mercado: 400000},
                "Rafael_Sayão": {nome: "Rafael Sayão", idade: 33, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 3, forca: 5, velocidade: 5, habilidade: 7}, valor_mercado: 300000},
                "Denilson": {nome: "Denilson", idade: 28, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 2, forca: 7, velocidade: 6, habilidade: 5}, valor_mercado: 500000}
            },
            "Atletico-GO": {
                "Pedro_Rangel": {nome: "Pedro Rangel", idade: 26, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 8, forca: 7, velocidade: 5, habilidade: 6}, valor_mercado: 1000000},
                "Bruno_Tubarao": {nome: "Bruno Tubarão", idade: 31, posicoes: {p: "Lateral", s: "Meia", t: "Ponta"}, atributos: {ataque: 7, defesa: 6, forca: 6, velocidade: 8, habilidade: 7}, valor_mercado: 1500000},
                "Marcão": {nome: "Marcão", idade: 24, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 8, forca: 9, velocidade: 5, habilidade: 4}, valor_mercado: 800000},
                "Roni": {nome: "Roni", idade: 27, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 8, forca: 8, velocidade: 6, habilidade: 6}, valor_mercado: 1800000},
                "Jorginho": {nome: "Jorginho", idade: 35, posicoes: {p: "Meia", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 3, forca: 5, velocidade: 5, habilidade: 8}, valor_mercado: 600000},
                "Derek": {nome: "Derek", idade: 28, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 8, defesa: 2, forca: 8, velocidade: 7, habilidade: 6}, valor_mercado: 1200000}
            },
            "Avai": {
                "Otavio_Goleiro": {nome: "Otávio", idade: 23, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 7, forca: 6, velocidade: 5, habilidade: 5}, valor_mercado: 400000},
                "Kevin": {nome: "Kevin", idade: 28, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 6, forca: 6, velocidade: 8, habilidade: 6}, valor_mercado: 1000000},
                "Jonathan_Costa": {nome: "Jonathan Costa", idade: 26, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 8, forca: 8, velocidade: 5, habilidade: 4}, valor_mercado: 800000},
                "Judson": {nome: "Judson", idade: 33, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 8, forca: 7, velocidade: 5, habilidade: 6}, valor_mercado: 500000},
                "Andrey": {nome: "Andrey", idade: 26, posicoes: {p: "Meia", s: "Volante", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 5, forca: 6, velocidade: 7, habilidade: 7}, valor_mercado: 1200000},
                "Hyuri": {nome: "Hyuri", idade: 34, posicoes: {p: "Atacante", s: "Ponta", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 2, forca: 6, velocidade: 7, habilidade: 7}, valor_mercado: 400000}
            },
            "Botafogo-SP": {
                "Michael_Fracaro": {nome: "Michael Fracaro", idade: 31, posicoes: {p: "Goleiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 1, defesa: 7, forca: 7, velocidade: 4, habilidade: 5}, valor_mercado: 500000},
                "Wallison_Lat": {nome: "Wallison", idade: 24, posicoes: {p: "Lateral", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 5, defesa: 6, forca: 6, velocidade: 8, habilidade: 5}, valor_mercado: 600000},
                "Ericson_Zac": {nome: "Ericson", idade: 27, posicoes: {p: "Zagueiro", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 2, defesa: 7, forca: 8, velocidade: 6, habilidade: 4}, valor_mercado: 700000},
                "Carlos_Manuel": {nome: "Carlos Manuel", idade: 26, posicoes: {p: "Volante", s: "Nenhuma", t: "Nenhuma"}, atributos: {ataque: 4, defesa: 7, forca: 7, velocidade: 6, habilidade: 6}, valor_mercado: 800000},
                "Fillipe_Soutto": {nome: "Fillipe Soutto", idade: 35, posicoes: {p: "Meia", s: "Volante", t: "Nenhuma"}, atributos: {ataque: 6, defesa: 5, forca: 6, velocidade: 4, habilidade: 7}, valor_mercado: 300000},
                "Bruno_Marques": {nome: "Bruno Marques", idade: 27, posicoes: {p: "Atacante", s: "Centroavante", t: "Nenhuma"}, atributos: {ataque: 7, defesa: 2, forca: 8, velocidade: 5, habilidade: 6}, valor_mercado: 800000}
            }
        };

        // ==========================================
        // MOTOR DE FUSÃO (Junta os Reservas nos Titulares)
        // ==========================================
        for (let timeId in baseDeReservas) {
            // Se o time existe na base principal e tem a pasta de jogadores
            if (baseDeTimes[timeId] && baseDeTimes[timeId].jogadores) {
                // Ele mescla os reservas junto com os titulares instantaneamente!
                Object.assign(baseDeTimes[timeId].jogadores, baseDeReservas[timeId]);
            }
        }

        // ==========================================
        // CORRETOR DE DIVISÕES
        // ==========================================
        const serieA_correta = ["Sao_Paulo", "Palmeiras", "Corinthians", "Santos", "Flamengo", "Fluminense", "Vasco", "Botafogo", "Cruzeiro", "Atletico-MG", "Gremio", "Internacional", "Athletico-PR", "Coritiba", "Bahia", "Vitoria", "Bragantino", "Chapecoense", "Remo", "Mirassol"];
        const serieB_correta = ["Criciuma", "Juventude", "Fortaleza", "Operario-PR", "Vila_Nova", "Novorizontino", "CRB", "Goias", "Atletico-GO", "Sport", "Athletic-Club", "Sao_Bernardo", "Botafogo-SP", "Nautico", "Cuiaba", "Ceara", "Londrina", "Avai", "America-MG", "Ponte_Preta"];

        serieA_correta.forEach(t => { if(baseDeTimes[t]) baseDeTimes[t].divisao = "A"; });
        serieB_correta.forEach(t => { if(baseDeTimes[t]) baseDeTimes[t].divisao = "B"; });

        // Envia o SUPER ELENCO para o Firebase
        db.ref('banco_global_times').set(baseDeTimes).then(() => {
            exibirModal("✅ Banco Atualizado", "<p style='text-align:center; color: var(--verde-campo);'>A base oficial completa (Titulares + Reservas) foi injetada com sucesso!</p>");
        }).catch(e => exibirModal("❌ Erro", `<p>Falha: ${e.message}</p>`));
    });
}

function carregarFilaSorteio() {
    const liga = document.getElementById('sorteio-liga-id').value;
    const filaDiv = document.getElementById('fila-sorteio');
    if (!liga) return filaDiv.innerHTML = "Selecione uma liga para ver os treinadores.";

    db.ref(`ligas/${liga}/usuarios`).on('value', snap => {
        const usuarios = snap.val() || {};
        let html = "", temGente = false;

        for (let login in usuarios) {
            if (!usuarios[login].timeAtual || usuarios[login].timeAtual === "Sem Clube") {
                html += `
                    <label style="display: flex; align-items: center; gap: 10px; padding: 5px 0; color: #fff; cursor: pointer;">
                        <input type="checkbox" class="chk-sorteio" value="${login}" checked>
                        <span>${usuarios[login].nome} <span style="color: #888; font-size: 11px;">(@${login})</span></span>
                    </label>
                `;
                temGente = true;
            }
        }
        filaDiv.innerHTML = temGente ? html : "<span style='color: var(--verde-campo);'>Todos já possuem clube!</span>";
    });
}

function sortearTimesLiga() {
    const liga = document.getElementById('sorteio-liga-id').value;
    if (!liga) return exibirModal("⚠️ Atenção", "<p style='text-align:center;'>Selecione a liga!</p>");

    // Pega APENAS quem o ADM deixou marcado na caixinha
    const checkboxes = document.querySelectorAll('.chk-sorteio:checked');
    let treinadoresSorteio = Array.from(checkboxes).map(chk => chk.value);

    if(treinadoresSorteio.length === 0) {
        return exibirModal("🎲 Sorteio", "<p style='text-align:center;'>Nenhum treinador selecionado para o sorteio.</p>");
    }

    Promise.all([
        db.ref(`ligas/${liga}/usuarios`).once('value'),
        db.ref('banco_global_times').once('value')
    ]).then((snaps) => {
        const usuarios = snaps[0].val() || {};
        const times = snaps[1].val() || {};

        const timesOcupados = Object.values(usuarios).map(u => u.timeAtual).filter(t => t && t !== "Sem Clube");
        const timesDisponiveis = Object.keys(times).filter(t => !timesOcupados.includes(t));

        let livresSerieA = timesDisponiveis.filter(t => times[t].divisao === "A").sort(() => Math.random() - 0.5);
        let livresSerieB = timesDisponiveis.filter(t => times[t].divisao === "B").sort(() => Math.random() - 0.5);

        let vagasSorteio = livresSerieA.concat(livresSerieB);
        treinadoresSorteio.sort(() => Math.random() - 0.5);

        const updates = {};
        treinadoresSorteio.forEach((login, index) => {
            const timeSorteado = vagasSorteio[index];
            updates[`ligas/${liga}/usuarios/${login}/timeAtual`] = timeSorteado;

            let forcaTotal = 0;
            if (times[timeSorteado] && times[timeSorteado].jogadores) {
                for (let j in times[timeSorteado].jogadores) {
                    let at = times[timeSorteado].jogadores[j].atributos;
                    forcaTotal += (at.ataque + at.defesa + at.forca + at.velocidade + at.habilidade);
                }
            }

            let caixa = 150000000 - (forcaTotal * 100000);
            updates[`ligas/${liga}/usuarios/${login}/caixaClube`] = caixa < 15000000 ? 15000000 : caixa;
            updates[`ligas/${liga}/usuarios/${login}/moral`] = 50;
        });

        db.ref().update(updates).then(() => {
            gerarCalendarioOculto(liga);
            exibirModal("🎲 Sucesso Absoluto!", `<p style='text-align:center;'>Sorteio realizado apenas para os selecionados!</p>`);
        });
    });
}

async function gerarCalendarioOculto(liga) {
    try {
        const snapTimes = await db.ref('banco_global_times').once('value');
        const times = snapTimes.val();
        if (!times) return;

        let serieA = [];
        let serieB = [];
        for (let t in times) {
            if (times[t].divisao === "A") serieA.push(t);
            else if (times[t].divisao === "B") serieB.push(t);
        }

        let arrA = serieA.slice();
        let arrB = serieB.slice();

        const calSerieA = criarTabelaBerger(arrA);
        const calSerieB = criarTabelaBerger(arrB);

        // ==========================================
        // LÓGICA DE DATAS INTELIGENTES E MUNDIAL
        // ==========================================
        let dataAtual = new Date();
        dataAtual.setHours(19, 0, 0, 0);

        function obterProximoDia(dataRef, diaSemana, hora) {
            let d = new Date(dataRef);
            d.setDate(d.getDate() + 1);
            while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
            d.setHours(hora, 0, 0, 0);
            return d;
        }

        function formatarData(d) {
            return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} às ${d.getHours().toString().padStart(2,'0')}:00`;
        }

        // Aplica as datas (Campeonato todos os dias, exceto Sábado)
        let diaLiga = new Date(dataAtual);
        for(let i = 1; i <= 38; i++) {
            let strData = formatarData(diaLiga);
            if(calSerieA[`rodada_${i}`]) for(let j in calSerieA[`rodada_${i}`]) calSerieA[`rodada_${i}`][j].data_jogo = strData;
            if(calSerieB[`rodada_${i}`]) for(let j in calSerieB[`rodada_${i}`]) calSerieB[`rodada_${i}`][j].data_jogo = strData;

            diaLiga.setDate(diaLiga.getDate() + 1);
            if (diaLiga.getDay() === 6) diaLiga.setDate(diaLiga.getDate() + 1); // Pula o Sábado
        }

        let sabado1 = obterProximoDia(dataAtual, 6, 19);
        let sabado2 = obterProximoDia(sabado1, 6, 19);
        let sabado3 = obterProximoDia(sabado2, 6, 19);
        let sabado4 = obterProximoDia(sabado3, 6, 19);

        let serieAOrd = serieA.slice().sort((a,b) => ((times[b] && times[b].forca_base) ? times[b].forca_base : 0) - ((times[a] && times[a].forca_base) ? times[a].forca_base : 0));
        let serieBOrd = serieB.slice().sort((a,b) => ((times[b] && times[b].forca_base) ? times[b].forca_base : 0) - ((times[a] && times[a].forca_base) ? times[a].forca_base : 0));

        let oitavasCopa = {};
        for (let i = 0; i < 8; i++) oitavasCopa[`jogo_${i+1}`] = { mandante: serieAOrd[i] || "Fantasma", visitante: serieBOrd[7 - i] || "Fantasma", jogado: false, data_jogo: formatarData(sabado1) };

        let quartasCopa = {};
        for (let i = 0; i < 4; i++) quartasCopa[`jogo_${i+9}`] = { mandante: `Vencedor Jogo ${i*2 + 1}`, visitante: `Vencedor Jogo ${i*2 + 2}`, jogado: false, data_jogo: formatarData(sabado2) };

        let semisCopa = {};
        for (let i = 0; i < 2; i++) semisCopa[`jogo_${i+13}`] = { mandante: `Vencedor Jogo ${i*2 + 9}`, visitante: `Vencedor Jogo ${i*2 + 10}`, jogado: false, data_jogo: formatarData(sabado3) };

        let finalCopa = { "jogo_15": { mandante: "Vencedor Jogo 13", visitante: "Vencedor Jogo 14", jogado: false, data_jogo: formatarData(sabado4) } };

        // MUNDIAL: Acontece no Domingo seguinte à última rodada (diaLiga já representa o dia depois da rodada 38)
        let dataMundial = obterProximoDia(diaLiga, 0, 16);
        let jogoMundial = { "jogo_mundial": { mandante: "Campeão Nacional", visitante: "Campeão da Copa", jogado: false, data_jogo: formatarData(dataMundial) } };

        await db.ref(`ligas/${liga}/calendario`).set({
            serieA: calSerieA,
            serieB: calSerieB,
            copa: { oitavas: oitavasCopa, quartas: quartasCopa, semis: semisCopa, final: finalCopa, mundial: jogoMundial },
            rodadaAtual: 1
        });
    } catch (e) {
        console.error("Erro fatal ao gerar calendário: ", e);
    }
}
function criarTabelaBerger(times) {
    let rodadasIda = [];
    let rodadasVolta = [];
    let numTimes = times.length;
    let metade = numTimes / 2;

    if (numTimes % 2 !== 0) { times.push("Fantasma"); numTimes++; metade = numTimes / 2; }

    let indices = Array.from({length: numTimes}, (v, k) => k);

    for (let i = 0; i < numTimes - 1; i++) {
        let rodadaAtualIda = {};
        let rodadaAtualVolta = {};
        let jogoId = 1;

        for (let j = 0; j < metade; j++) {
            let time1 = times[indices[j]];
            let time2 = times[indices[numTimes - 1 - j]];

            if (time1 !== "Fantasma" && time2 !== "Fantasma") {
                let mandante = (j === 0 && i % 2 !== 0) ? time2 : time1;
                let visitante = (j === 0 && i % 2 !== 0) ? time1 : time2;

                rodadaAtualIda[`jogo_${jogoId}`] = { mandante: mandante, visitante: visitante, jogado: false };
                rodadaAtualVolta[`jogo_${jogoId}`] = { mandante: visitante, visitante: mandante, jogado: false };
                jogoId++;
            }
        }
        rodadasIda.push(rodadaAtualIda);
        rodadasVolta.push(rodadaAtualVolta);

        let ultimo = indices.pop();
        indices.splice(1, 0, ultimo);
    }

    let campeonatoCompleto = rodadasIda.concat(rodadasVolta);
    let objetoCampeonato = {};
    campeonatoCompleto.forEach((rodada, index) => {
        objetoCampeonato[`rodada_${index + 1}`] = rodada;
    });

    return objetoCampeonato;
}

// ========================================================
// CONTROLE DISCIPLINAR (VIGIAR E EXPULSAR)
// ========================================================
function listarTreinadoresADM() {
    const liga = document.getElementById('gerenciar-liga-id').value;
    const tbody = document.getElementById('tabela-treinadores-adm');

    if (!liga) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 10px;">Aguardando seleção...</td></tr>`;
        return;
    }

    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 10px;">Buscando dados no servidor...</td></tr>`;

    db.ref(`ligas/${liga}/usuarios`).on('value', snap => {
        const usuarios = snap.val();
        if (!usuarios) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 10px;">Nenhum treinador nesta liga.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        for (let login in usuarios) {
            let user = usuarios[login];
            let clubeStr = user.timeAtual !== "Sem Clube" ? user.timeAtual.replace(/_/g, ' ') : "Aguardando Sorteio";

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #333;">
                    <td style="padding: 10px 0;"><strong style="color: #fff;">${user.nome}</strong><br><span style="font-size:11px; color:#888;">@${login}</span></td>
                    <td style="color: var(--verde-campo);">${clubeStr}</td>
                    <td style="text-align: right;">
                        <button onclick="expulsarTreinador('${liga}', '${login}', '${user.timeAtual}')" style="background: #dc3545; border: none; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; width: auto; margin: 0;">Expulsar</button>
                    </td>
                </tr>
            `;
        }
    });
}

function expulsarTreinador(liga, login, timeId) {
    pedirConfirmacao(`Tem certeza que deseja banir o usuário @${login}? Ele perderá o acesso e o time ficará sem técnico.`, () => {

        exibirModal("⏳ Processando", "<p style='text-align:center;'>Removendo treinador e limpando dados...</p>");

        let updates = {};
        updates[`ligas/${liga}/usuarios/${login}`] = null;

        db.ref().update(updates).then(() => {
            exibirModal("✅ Usuário Banido", `<p style='text-align:center; color: #dc3545;'>O treinador <strong>@${login}</strong> foi removido do servidor com sucesso.</p>`);
        }).catch(erro => {
            exibirModal("❌ Erro", `<p style='text-align:center;'>Falha ao expulsar: ${erro.message}</p>`);
        });
    });
}

function deslogarADM() {
    auth.signOut().then(() => {
        window.location.href = "index.html";
    });
}

// ========================================================
// GERENCIADOR DE ESCUDOS (INJEÇÃO VIA URL)
// ========================================================
function salvarEscudoBanco() {
    const time = document.getElementById('select-time-escudo').value;
    const url = document.getElementById('url-escudo').value.trim();

    if (!time || !url) return exibirModal("⚠️ Atenção", "<p style='text-align:center;'>Selecione o time e cole a URL da imagem!</p>");

    db.ref(`banco_global_times/${time}/escudo_base64`).set(url).then(() => {
        exibirModal("✅ Sucesso", `<p style='text-align:center; color: var(--verde-campo);'>Escudo do <strong>${time.replace(/_/g, ' ')}</strong> atualizado com sucesso no servidor global!</p>`);
        document.getElementById('url-escudo').value = "";
    }).catch(erro => exibirModal("❌ Erro", `<p>Erro ao salvar escudo: ${erro.message}</p>`));
}

// ========================================================
// 5. MODO DE SEGURANÇA: RESETAR UMA LIGA ATUAL (FORÇADO E DIRETO)
// ========================================================
async function resetarLigaCorrente() {
    const liga = document.getElementById('sorteio-liga-id').value;
    if (!liga) return exibirModal("⚠️ Atenção", "<p style='text-align:center;'>Selecione a liga que deseja resetar!</p>");

    pedirConfirmacao(`Isso vai apagar a tabela e redefinir todos os usuários da liga ${liga}. Deseja recomeçar?`, async () => {
        exibirModal("⏳ Processando", "<p style='text-align:center;'>Limpando os dados da liga no servidor...</p>");

        try {
            await db.ref(`ligas/${liga}/calendario`).set(null);
            await db.ref(`ligas/${liga}/sistema`).set(null);
            await db.ref(`ligas/${liga}/mercado_propostas`).set(null);

            const snap = await db.ref(`ligas/${liga}/usuarios`).once('value');
            const usuarios = snap.val();

            if (usuarios) {
                const updates = {};
                for (let login in usuarios) {
                    updates[`ligas/${liga}/usuarios/${login}/timeAtual`] = "Sem Clube";
                    updates[`ligas/${liga}/usuarios/${login}/caixaClube`] = 50000000;
                    updates[`ligas/${liga}/usuarios/${login}/titulares`] = null;
                    updates[`ligas/${liga}/usuarios/${login}/formacao`] = null;
                    updates[`ligas/${liga}/usuarios/${login}/estilo`] = null;
                    updates[`ligas/${liga}/usuarios/${login}/mentalidade`] = null;
                }
                await db.ref().update(updates);
            }

            exibirModal("✅ Reset Concluído", `<p style='text-align:center; color: var(--verde-campo);'>A liga <strong>${liga}</strong> foi zerada com sucesso! Todos os treinadores estão 'Sem Clube'. <br><br>Agora você PODE e DEVE clicar em <strong>Realizar Sorteio Completo</strong>.</p>`);

        } catch (erro) {
            console.error(erro);
            exibirModal("❌ Erro", `<p>Falha ao limpar a liga: ${erro.message}</p>`);
        }
    });
}

// ========================================================
// 6. FIM DE TEMPORADA (MANTER CLUBES E ELENCOS)
// ========================================================
function novaTemporadaManterClubes() {
    const liga = document.getElementById('sorteio-liga-id').value;
    if (!liga) return exibirModal("⚠️ Atenção", "<p style='text-align:center;'>Selecione a liga!</p>");

    pedirConfirmacao(`Isso vai apagar a tabela e iniciar uma nova temporada para a liga ${liga}, MAS todos manterão seus clubes, táticas e caixas. Confirmar?`, async () => {
        exibirModal("⏳ Processando", "<p style='text-align:center;'>Limpando calendário e propostas do mercado...</p>");

        try {
            // Apaga o calendário, simulações e o mercado antigo
            await db.ref(`ligas/${liga}/calendario`).set(null);
            await db.ref(`ligas/${liga}/sistema`).set(null);
            await db.ref(`ligas/${liga}/mercado_propostas`).set(null);

            // Roda a geração do novo calendário imediatamente (com os times que a galera já tem)
            await gerarCalendarioOculto(liga);

            exibirModal("✅ Nova Temporada Criada", `<p style='text-align:center; color: var(--verde-campo);'>A liga <strong>${liga}</strong> foi renovada! Os clubes foram mantidos e a nova tabela (com a Copa inclusa) já está pronta para jogo.</p>`);
        } catch (erro) {
            exibirModal("❌ Erro", `<p>Falha: ${erro.message}</p>`);
        }
    });
}