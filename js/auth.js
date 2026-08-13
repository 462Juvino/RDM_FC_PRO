// js/auth.js

// 1. AUTO-LOGIN: Executa assim que a página carrega
window.addEventListener('DOMContentLoaded', () => {
    // A) Verifica se o ADM já está logado via Firebase
    auth.onAuthStateChanged(user => {
        if (user && user.email === "rafael@adm.com") {
            window.location.href = "admin.html"; // Joga direto pro painel ADM
        }
    });

    // B) Verifica se um usuário comum já está salvo na memória do celular/PC
    const ligaSalva = localStorage.getItem('treinadorLiga');
    const userSalvo = localStorage.getItem('treinadorUsuario');
    
    if (ligaSalva && userSalvo) {
        document.getElementById('msg-loading').style.display = 'block';
        document.getElementById('form-box').style.display = 'none';
        fazerLoginUsuario(ligaSalva, userSalvo);
    }
});

// 2. PROCESSA O CLIQUE NO BOTÃO
function processarAuth() {
    const loginStr = document.getElementById('loginInput').value.trim();
    const senhaStr = document.getElementById('senhaInput').value.trim();

    if (!loginStr || !senhaStr) return alert("Preencha todos os campos!");

    // Se for o administrador
    if (loginStr.toLowerCase() === "rafael@adm.com") {
        auth.signInWithEmailAndPassword(loginStr, senhaStr)
        .then(() => {
            window.location.href = "admin.html";
        })
        .catch((error) => {
            alert("Erro: E-mail ou senha do ADM incorretos.");
        });
    } 
    // Se for um usuário comum
    else {
        const ligaFormatada = loginStr.toUpperCase(); // Ex: LIGA1
        const usuarioFormatado = senhaStr.toLowerCase(); // Ex: joao
        fazerLoginUsuario(ligaFormatada, usuarioFormatado);
    }
}

// 3. VALIDA O USUÁRIO NO BANCO DE DADOS
function fazerLoginUsuario(liga, usuario) {
    db.ref(`ligas/${liga}/usuarios/${usuario}`).once('value').then(snapshot => {
        if (snapshot.exists()) {
            // Salva na memória do dispositivo para não precisar digitar de novo
            localStorage.setItem('treinadorLiga', liga);
            localStorage.setItem('treinadorUsuario', usuario);
            
            // Redireciona para o jogo
            window.location.href = "dashboard.html";
        } else {
            alert("Acesso Negado: Liga ou Usuário não encontrados no sistema.");
            
            // Se falhou, limpa a memória caso tenha dados antigos errados
            localStorage.removeItem('treinadorLiga');
            localStorage.removeItem('treinadorUsuario');
            
            document.getElementById('msg-loading').style.display = 'none';
            document.getElementById('form-box').style.display = 'block';
        }
    }).catch(erro => {
        alert("Erro ao conectar ao banco de dados.");
        console.error(erro);
    });
}

// 4. FUNÇÃO DE SAIR (Adicione isso no seu dashboard.html e admin.html depois)
function deslogar() {
    auth.signOut();
    localStorage.removeItem('treinadorLiga');
    localStorage.removeItem('treinadorUsuario');
    window.location.href = "index.html";
}

// CONTROLE DAS ABAS DE LOGIN/CADASTRO
function mudarAba(aba) {
    document.getElementById('box-login').style.display = aba === 'login' ? 'block' : 'none';
    document.getElementById('box-cadastro').style.display = aba === 'cadastro' ? 'block' : 'none';

    document.getElementById('tab-login').style.color = aba === 'login' ? 'var(--verde-campo)' : '#888';
    document.getElementById('tab-login').style.borderBottomColor = aba === 'login' ? 'var(--verde-campo)' : 'transparent';

    document.getElementById('tab-cadastro').style.color = aba === 'cadastro' ? 'var(--verde-campo)' : '#888';
    document.getElementById('tab-cadastro').style.borderBottomColor = aba === 'cadastro' ? 'var(--verde-campo)' : 'transparent';
}

// AUTO-CADASTRO DO TREINADOR
function registrarNovoTreinador() {
    const liga = document.getElementById('cad-liga').value.trim().toUpperCase();
    const login = document.getElementById('cad-usuario').value.trim().toLowerCase().replace(/\s/g, '');
    const nome = document.getElementById('cad-nome').value.trim();

    if (!liga || !login || !nome) return alert("Preencha todos os campos para se cadastrar!");

    // 1. Verifica se a liga existe primeiro
    db.ref(`ligas/${liga}`).once('value').then(snap => {
        if (!snap.exists()) return alert("Essa Liga não existe! Verifique o código com o Administrador.");

        // 2. Verifica se o usuário já existe
        db.ref(`ligas/${liga}/usuarios/${login}`).once('value').then(userSnap => {
            if (userSnap.exists()) return alert("Esse login já está em uso nesta liga. Escolha outro!");

            // 3. Cria o usuário e loga automaticamente
            db.ref(`ligas/${liga}/usuarios/${login}`).set({
                nome: nome,
                timeAtual: "Sem Clube",
                caixaClube: 50000000,
                tierMetas: 3
            }).then(() => {
                alert("Conta criada com sucesso! Entrando no jogo...");
                fazerLoginUsuario(liga, login);
            });
        });
    });
}

// ========================================================
// CONTROLE DAS ABAS DE LOGIN/CADASTRO
// ========================================================
function mudarAba(aba) {
    document.getElementById('box-login').style.display = aba === 'login' ? 'block' : 'none';
    document.getElementById('box-cadastro').style.display = aba === 'cadastro' ? 'block' : 'none';

    document.getElementById('tab-login').style.color = aba === 'login' ? 'var(--verde-campo)' : '#888';
    document.getElementById('tab-login').style.borderBottomColor = aba === 'login' ? 'var(--verde-campo)' : 'transparent';

    document.getElementById('tab-cadastro').style.color = aba === 'cadastro' ? 'var(--verde-campo)' : '#888';
    document.getElementById('tab-cadastro').style.borderBottomColor = aba === 'cadastro' ? 'var(--verde-campo)' : 'transparent';
}

// ========================================================
// AUTO-CADASTRO DO TREINADOR
// ========================================================
function registrarNovoTreinador() {
    const liga = document.getElementById('cad-liga').value.trim().toUpperCase();
    const login = document.getElementById('cad-usuario').value.trim().toLowerCase().replace(/\s/g, '');
    const nome = document.getElementById('cad-nome').value.trim();

    if (!liga || !login || !nome) return alert("Preencha todos os campos para se cadastrar!");

    // 1. Verifica se a liga existe primeiro
    db.ref(`ligas/${liga}`).once('value').then(snap => {
        if (!snap.exists()) return alert("Essa Liga não existe! Verifique o código com o Administrador.");

        // 2. Verifica se o usuário já existe
        db.ref(`ligas/${liga}/usuarios/${login}`).once('value').then(userSnap => {
            if (userSnap.exists()) return alert("Esse login já está em uso nesta liga. Escolha outro!");

            // 3. Cria o usuário e loga automaticamente
            db.ref(`ligas/${liga}/usuarios/${login}`).set({
                nome: nome,
                timeAtual: "Sem Clube",
                caixaClube: 50000000,
                tierMetas: 3
            }).then(() => {
                alert("Conta criada com sucesso! Entrando no jogo...");
                fazerLoginUsuario(liga, login);
            });
        });
    });
}