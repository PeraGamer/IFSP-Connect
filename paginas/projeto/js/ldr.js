// ==========================================
// 1. CONFIGURAÇÕES INICIAIS
// ==========================================

// Estado do fundo dinâmico
let modoDinamico = false;

// Última leitura recebida do Arduino
let ultimaIntensidade = null;

// Guarda a cor original da página
const corOriginal = getComputedStyle(document.body).backgroundColor;

// Identifica os elementos do HTML
const botao = document.getElementById("modoDinamico");
const resultado = document.getElementById("resultado");

// Adiciona uma transição suave de cores
document.body.style.transition = "background-color 0.3s ease";

if (resultado) {
    resultado.style.transition = "background-color 0.3s ease";
}

// ==========================================
// 2. FUNÇÃO DO FUNDO DINÂMICO
// ==========================================

function atualizarFundo(intensidade) {

    if (!modoDinamico) return;

    // Normaliza a leitura do sensor entre 0 e 1
    const luminosidade = intensidade / 1023;

    // Converte a leitura em uma escala de cinza
    const cor = Math.round(30 + luminosidade * 200);

    const corFundo = `rgb(${cor}, ${cor}, ${cor})`;

    // Altera o fundo da página
    document.body.style.backgroundColor = corFundo;

    // Altera também o painel de resultados
    if (resultado) {
        resultado.style.backgroundColor = corFundo;
    }
}

// ==========================================
// 3. CONTROLE DO SWITCH
// ==========================================

if (botao) {

    // Considera o estado inicial do switch
    modoDinamico = botao.checked;

    botao.addEventListener("change", function() {

        modoDinamico = botao.checked;

        if (modoDinamico) {

            // Aplica a cor usando a última leitura disponível
            if (ultimaIntensidade !== null) {
                atualizarFundo(ultimaIntensidade);
            }

        } else {

            // Restaura a aparência original
            document.body.style.backgroundColor = corOriginal;

            if (resultado) {
                resultado.style.backgroundColor = "";
            }
        }
    });
}

// ==========================================
// 4. CONEXÃO COM O ARDUINO
// ==========================================

let conectando = false;

window.conectarArduino = async function() {

    if (conectando) return;

    conectando = true;

    let porta = null;
    let reader = null;

    try {

        // Verifica compatibilidade com Web Serial
        if (!("serial" in navigator)) {
            throw new Error(
                "Web Serial não é compatível com este navegador."
            );
        }

        // Solicita a seleção da porta serial
        porta = await navigator.serial.requestPort();

        // Abre a comunicação com o Arduino
        await porta.open({ baudRate: 9600 });

        console.log("Arduino conectado!");

        // Configura a leitura dos dados
        const decoder = new TextDecoderStream();

        const leituraSerial = porta.readable.pipeTo(decoder.writable);

        reader = decoder.readable.getReader();

        let buffer = "";

        // ==========================================
        // 5. RECEBIMENTO DOS DADOS
        // ==========================================

        while (true) {

            const { value, done } = await reader.read();

            if (done) break;

            if (value) {

                // Armazena os dados recebidos
                buffer += value;

                // Separa os dados por linha
                const linhas = buffer.split(/\r?\n/);

                // Guarda eventual linha incompleta
                buffer = linhas.pop();

                for (const linha of linhas) {

                    const dados = linha.trim();

                    // Extrai os valores enviados pelo Arduino
                    const adc = dados.match(/Leitura ADC: (\d+)/);

                    const resistencia = dados.match(
                        /Resistencia LDR: ([\d.]+)/
                    );

                    const lux = dados.match(
                        /Iluminancia estimada: ([\d.]+)/
                    );

                    // Verifica se todos os dados foram recebidos
                    if (adc && resistencia && lux) {

                        const intensidade = Number(adc[1]);

                        const valorResistencia = Number(resistencia[1]);

                        const valorLux = Number(lux[1]);

                        // ==========================================
                        // 6. ATUALIZAÇÃO DOS VALORES NO HTML
                        // ==========================================

                        document.getElementById("valor").innerText =
                            intensidade;

                        document.getElementById("resistencia").innerText =
                            valorResistencia + " Ω";

                        document.getElementById("lux").innerText =
                            valorLux + " lux";

                        // Guarda a última leitura
                        ultimaIntensidade = intensidade;

                        // ==========================================
                        // 7. ATUALIZAÇÃO DO FUNDO DINÂMICO
                        // ==========================================

                        atualizarFundo(intensidade);

                        // ==========================================
                        // 7.1 ATUALIZAÇÃO DO GRÁFICO
                        // ==========================================

                        adicionarPontoGrafico(
                            intensidade,
                            valorResistencia,
                            valorLux
                        );
                    }
                }
            }
        }

        reader.releaseLock();
        reader = null;

        await leituraSerial;

    } catch (erro) {

        if (erro.name === "NotFoundError") {

            console.log("Seleção da porta cancelada.");

        } else {

            console.error(
                "Erro na conexão com o Arduino:",
                erro
            );
        }

    } finally {

        // Libera a leitura serial
        if (reader) {
            try {
                await reader.cancel();
            } catch (erro) {
                console.log("Leitura serial encerrada.");
            }

            try {
                reader.releaseLock();
            } catch (erro) {
                // O bloqueio já pode ter sido liberado
            }
        }

        // Fecha a porta quando a leitura terminar
        if (porta && porta.readable) {
            try {
                await porta.close();
            } catch (erro) {
                console.error("Erro ao fechar a porta:", erro);
            }
        }

        conectando = false;
    }
};

// ==========================================
// 8. GRÁFICO DAS LEITURAS
// ==========================================

// Quantos pontos ficam visíveis e de quanto em quanto tempo entra um novo
const MAX_PONTOS = 60;
const INTERVALO_GRAFICO_MS = 500;

let ultimoPontoGrafico = 0;

// Histórico das três grandezas (o gráfico mostra uma por vez)
const historico = {
    horas: [],
    adc: [],
    resistencia: [],
    lux: []
};

// Configuração de cada grandeza que pode ser exibida
const grandezas = {
    adc:         { rotulo: "Leitura ADC",       max: 1023 },
    resistencia: { rotulo: "Resistência (Ω)",   max: undefined },
    lux:         { rotulo: "Iluminância (lux)", max: undefined }
};

// Identifica os elementos do gráfico no HTML
const canvasGrafico = document.getElementById("graficoLdr");
const seletorGrafico = document.getElementById("grandezaGrafico");

let grafico = null;

// Só cria o gráfico se o canvas existir e o Chart.js tiver carregado
if (canvasGrafico && typeof Chart !== "undefined") {

    Chart.defaults.font.family = '"Rubik", sans-serif';

    grafico = new Chart(canvasGrafico, {
        type: "line",
        data: {
            labels: historico.horas,
            datasets: [{
                label: "",
                data: [],
                borderColor: "#1d7fc4",
                backgroundColor: "rgba(56, 182, 255, 0.15)",
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    title: { display: true, text: "Horário" },
                    ticks: { maxTicksLimit: 8 }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "" }
                }
            }
        }
    });

    aplicarGrandeza();

    if (seletorGrafico) {
        seletorGrafico.addEventListener("change", aplicarGrandeza);
    }
}

// Troca a grandeza mostrada (ADC, resistência ou lux)
function aplicarGrandeza() {

    if (!grafico) return;

    const chave = seletorGrafico ? seletorGrafico.value : "lux";
    const config = grandezas[chave];

    grafico.data.datasets[0].data = historico[chave];
    grafico.data.datasets[0].label = config.rotulo;

    grafico.options.scales.y.title.text = config.rotulo;
    grafico.options.scales.y.max = config.max;

    grafico.update();
}

// Adiciona uma leitura nova ao histórico e ao gráfico
function adicionarPontoGrafico(adc, resistencia, lux) {

    if (!grafico) return;

    // Evita sobrecarregar o gráfico com leituras muito rápidas
    const agora = Date.now();

    if (agora - ultimoPontoGrafico < INTERVALO_GRAFICO_MS) return;

    ultimoPontoGrafico = agora;

    historico.horas.push(new Date().toLocaleTimeString("pt-BR"));
    historico.adc.push(adc);
    historico.resistencia.push(resistencia);
    historico.lux.push(lux);

    // Descarta os pontos mais antigos para o gráfico "rolar"
    if (historico.horas.length > MAX_PONTOS) {
        historico.horas.shift();
        historico.adc.shift();
        historico.resistencia.shift();
        historico.lux.shift();
    }

    grafico.update();
}
