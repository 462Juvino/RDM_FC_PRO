// js/firebase-config.js

const firebaseConfig = {
    apiKey: "AIzaSyAnVVKO8HdwFnytvz4BwxYQ6xiClZyIW3g",
    authDomain: "rdmfcpro.firebaseapp.com",
    databaseURL: "https://rdmfcpro-default-rtdb.firebaseio.com",
    projectId: "rdmfcpro",
    storageBucket: "rdmfcpro.firebasestorage.app",
    messagingSenderId: "626480220792",
    appId: "1:626480220792:web:82f199d14b802f0ba13b8d",
    measurementId: "G-97EWWJEHHV"
};

// Inicializa o Firebase (formato compatível)
firebase.initializeApp(firebaseConfig);
const db = firebase.database(); // Conecta ao Realtime Database
const auth = firebase.auth();   // Conecta ao Sistema de Autenticação

// ========================================================
// REFINAMENTO VISUAL GLOBAL: CABEÇALHO FINO E DELICADO
// ========================================================
(function otimizarCabecalhoGlobal() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Reduz o tamanho geral da barra superior para PC e Mobile */
        header, .topbar {
            padding: 5px 15px !important;
            min-height: 45px !important;
            max-height: 55px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
        }

        /* Deixa o botão de menu (sanduíche) mais discreto */
        .btn-menu {
            font-size: 20px !important;
            padding: 2px 8px !important;
            margin: 0 !important;
            background: transparent !important;
            line-height: 1 !important;
        }

        /* Remove o flexbox daqui para respeitar as quebras de linha normais do HTML */
        .header-infos {
            display: block !important;
            line-height: 1.3 !important;
            margin: 0 !important;
            text-align: left !important;
        }

        /* Formatação base dos textos soltos */
        .header-infos, .header-infos span {
            font-size: 12px !important;
            color: #ccc !important;
        }

        /* Nomes do Treinador e Liga em destaque */
        #nome-treinador, #nome-liga {
            font-size: 13px !important;
            font-weight: bold !important;
            color: #fff !important;
        }

        /* Nome do Time empurrado para a linha de baixo com destaque verde */
        #nome-time {
            font-size: 13px !important;
            font-weight: bold !important;
            color: var(--verde-campo) !important;
            display: block !important;
            margin-top: 2px !important;
        }

        /* Dinheiro em caixa mais elegante e proporcional */
        #saldo-treinador {
            font-size: 15px !important;
            margin: 0 !important;
            font-weight: bold !important;
            color: var(--verde-campo) !important;
        }

        /* Ajustes extremos e delicados para Celulares (Mobile) */
        @media (max-width: 768px) {
            header, .topbar {
                padding: 4px 10px !important;
                min-height: 40px !important;
                max-height: 48px !important;
            }
            .btn-menu { font-size: 18px !important; padding: 2px 5px !important; }
            .header-infos, .header-infos span { font-size: 10px !important; }
            #nome-treinador, #nome-liga { font-size: 11px !important; }
            #nome-time { font-size: 11px !important; margin-top: 1px !important; }
            #saldo-treinador { font-size: 13px !important; }

            .escudo-placar, .escudo-mini {
                width: 14px !important;
                height: 14px !important;
            }
        }
    `;
    document.head.appendChild(style);
})();