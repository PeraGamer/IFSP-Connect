
// ==========================================
// 1. CONFIGURAÇÕES INICIAIS
// ==========================================

let modoDinamico = false;

// Guarda a cor original do fundo da página
const corOriginal = getComputedStyle(document.body).backgroundColor;

// Identifica o switch do HTML
const botao = document.getElementById("modoDinamico");


// ==========================================
// 2. CONTROLE DO FUNDO DINÂMICO
// ==========================================

botao.addEventListener("change", function() {

    modoDinamico = botao.checked;

    // Se desativar, retorna à cor original
    if (!modoDinamico) {
        document.body.style.backgroundColor = corOriginal;
    }

});


// ==========================================
// 3. CONEXÃO COM O ARDUINO
// ==========================================

async function conectarArduino() {

    try {

        const porta = await navigator.serial.requestPort();

        await porta.open({ baudRate: 9600 });

        const decoder = new TextDecoderStream();

        porta.readable.pipeTo(decoder.writable);

        const reader = decoder.readable.getReader();


        // ==========================================
        // 4. RECEBIMENTO DOS DADOS
        // ==========================================

        while (true) {

            const { value, done } = await reader.read();

            if (done) break;

            if (value) {

                const dados = value.trim();

                // Extrai as informações enviadas pelo Arduino
                const adc = dados.match(/Leitura ADC: (\d+)/);
                const resistencia = dados.match(/Resistencia LDR: ([\d.]+)/);
                const lux = dados.match(/Iluminancia estimada: ([\d.]+)/);


                // Verifica se os dados foram recebidos corretamente
                if (adc && resistencia && lux) {

                    const intensidade = Number(adc[1]);
                    const valorResistencia = Number(resistencia[1]);
                    const valorLux = Number(lux[1]);


                    // ==========================================
                    // 5. ATUALIZAÇÃO DOS DADOS NO HTML
                    // ==========================================

                    document.getElementById("valor").innerText = intensidade;

                    document.getElementById("resistencia").innerText =
                        valorResistencia + " Ω";

                    document.getElementById("lux").innerText =
                        valorLux + " lux";


                    // ==========================================
                    // 6. FUNDO DINÂMICO
                    // ==========================================

                    if (modoDinamico) {

                        const luminosidade = intensidade / 1023;

                        const cor = Math.round(255 * luminosidade);

                        document.body.style.backgroundColor =
                            `rgb(${cor}, ${cor}, ${cor})`;

                    }

                }

            }

        }

    } catch (erro) {

        console.error("Erro na conexão com o Arduino:", erro);

    }

}