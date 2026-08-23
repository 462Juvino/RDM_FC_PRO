// js/midia.js

const mapaMidia = {
    // SÉRIE A
    "Sao_Paulo": { escudo: "São_Paulo.png", estadio: "Morumbi(São_Paulo)São_Paulo.webp", hino: "São_Paulo_Hino.mp3", torcida: "São_Paulo_torcida.mp3" },
    "Palmeiras": { escudo: "Palmeiras.png", estadio: "Allianz_Parque(São_Paulo)Palmeiras.webp", hino: "Palmeiras_Hino.mp3", torcida: "Palmeiras_torcida.mp3" },
    "Corinthians": { escudo: "Corinthians.png", estadio: "Neo_Química_Arena(São_Paulo)Corinthians.webp", hino: "Corinthians_Hino.mp3", torcida: "Corinthians_torcida.mp3" },
    "Santos": { escudo: "Santos.png", estadio: "Vila_Belmiro(Santos)Santos.webp", hino: "Santos_Hino.mp3", torcida: "Santos_torcida.mp3" },
    "Flamengo": { escudo: "Flamengo.png", estadio: "Maracanã(Rio_de_Janeiro)Flamengo.webp", hino: "Flamengo_Hino.mp3", torcida: "Flamengo_torcida.mp3" },
    "Fluminense": { escudo: "Fluminense.png", estadio: "Maracanã(Rio_de_Janeiro)Fluminense.webp", hino: "Fluminense_Hino.mp3", torcida: "Fluminense_torcida.mp3" },
    "Vasco": { escudo: "Vasco.png", estadio: "São_Januário(Rio_de_Janeiro)Vasco.webp", hino: "Vasco_Hino.mp3", torcida: "Vasco_torcida.mp3" },
    "Botafogo": { escudo: "Botafogo.png", estadio: "Estádio_Nilton_Santos(Rio_de_Janeiro)Botafogo.webp", hino: "Botafogo_Hino.mp3", torcida: "Botafogo_torcida.mp3" },
    "Cruzeiro": { escudo: "Cruzeiro.png", estadio: "Mineirão(Belo_Horizonte)Cruzeiro.webp", hino: "Cruzeiro_Hino.mp3", torcida: "Cruzeiro_torcida.mp3" },
    "Atletico-MG": { escudo: "Atletico_mineiro.png", estadio: "Arena_MRV(Belo_Horizonte)Atlético-MG.webp", hino: "Atlético_Mineiro_Hino.mp3", torcida: "Atlético_Mineiro_torcida.mp3" },
    "Gremio": { escudo: "Gremio.png", estadio: "Arena_do_Grêmio(Porto_Alegre)Grêmio.webp", hino: "Grêmio_Hino.mp3", torcida: "Grêmio_torcida.mp3" },
    "Internacional": { escudo: "Internacional.png", estadio: "Beira-Rio(Porto_Alegre)Internacional.webp", hino: "Internacional_Hino.mp3", torcida: "Internacional_torcida.mp3" },
    "Athletico-PR": { escudo: "Atletico_paranaense.png", estadio: "Arena_da_Baixada(Curitiba)Athletico-PR.webp", hino: "Atlético_Paranaense_Hino.mp3", torcida: "Atlético_Paranaense_torcida.mp3" },
    "Coritiba": { escudo: "Coritiba.png", estadio: "Couto_Pereira(Curitiba)Coritiba.webp", hino: "Coritiba_Hino.mp3", torcida: "Coritiba_torcida.mp3" },
    "Bahia": { escudo: "Bahia.png", estadio: "Arena_Fonte_Nova(Salvador)Bahia.webp", hino: "Bahia_Hino.mp3", torcida: "Bahia_torcida.mp3" },
    "Vitoria": { escudo: "Vitoria.png", estadio: "Barradão(Salvador)Vitória.webp", hino: "Vitória_Hino.mp3", torcida: "Vitória_torcida.mp3" },
    "Bragantino": { escudo: "Bragantino.png", estadio: "Nabi_Abi_Chedid.webp", hino: "Bragantino_Hino.mp3", torcida: "Bragantino_torcida.mp3" },
    "Chapecoense": { escudo: "Chapecoense.png", estadio: "Arena_Condá(Chapecó)Chapecoense.webp", hino: "Chapecoense_Hino.mp3", torcida: "Chapecoense_torcida.mp3" },
    "Remo": { escudo: "Remo.png", estadio: "Mangueirão(Belém)Remo.webp", hino: "Remo_Hino.mp3", torcida: "Remo_torcida.mp3" },
    "Mirassol": { escudo: "Mirassol.png", estadio: "Campos_Maia(Mirassol)Mirassol.webp", hino: "Mirassol_Hino.mp3", torcida: "Mirassol_torcida.mp3" },

    // SÉRIE B
    "Criciuma": { escudo: "Criciuma.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Juventude": { escudo: "Juventude.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Fortaleza": { escudo: "Fortaleza.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Operario-PR": { escudo: "Operario.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Vila_Nova": { escudo: "Vila_Nova.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Novorizontino": { escudo: "Novorizontino.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "CRB": { escudo: "CRB.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Goias": { escudo: "Goias.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Atletico-GO": { escudo: "Atletico_GO.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Sport": { escudo: "Sport.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Athletic-Club": { escudo: "Athletic.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Sao_Bernardo": { escudo: "Sao_Bernardo.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Botafogo-SP": { escudo: "Botafogo_SP.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Nautico": { escudo: "Nautico.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Cuiaba": { escudo: "Cuiaba.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Ceara": { escudo: "Ceara.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Londrina": { escudo: "Londrina.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Avai": { escudo: "Avai.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "America-MG": { escudo: "America_MG.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" },
    "Ponte_Preta": { escudo: "Ponte_Preta.png", estadio: "default.webp", hino: "gol_generico.mp3", torcida: "torcida_generica.mp3" }
};

// Funções tradutoras com Fallback
function getEscudo(id) {
    if (mapaMidia[id] && mapaMidia[id].escudo) {
        return `esculdos/${mapaMidia[id].escudo}`;
    }
    // Formata nomes velhos removendo espaços e hifens para tentar não quebrar
    let safeId = id.replace(/[\s-]/g, '_');
    return `esculdos/${safeId}.png`;
}

function getEstadio(id) {
    if (mapaMidia[id] && mapaMidia[id].estadio) {
        return `estadios/${mapaMidia[id].estadio}`;
    }
    return `estadios/default.webp`;
}

function getHino(id) {
    if (mapaMidia[id] && mapaMidia[id].hino) {
        return `sounds/${mapaMidia[id].hino}`;
    }
    return `sounds/gol_generico.mp3`;
}

function getTorcida(id) {
    if (mapaMidia[id] && mapaMidia[id].torcida) {
        return `sounds/${mapaMidia[id].torcida}`;
    }
    return `sounds/torcida_generica.mp3`;
}