
// ==========================================
// 1. CONFIGURAÇÕES INICIAIS
// ==========================================

let modoDinamico = false;

const corOriginal = getComputedStyle(document.body).backgroundColor;

const botao = document.getElementById("modoDinamico");

if (botao) {
    botao.addEventListener("change", function() {
        modoDinamico = botao.checked;

        if (!modoDinamico) {
            document.body.style.backgroundColor = corOriginal;
        }
    });
}


// ==========================================
// 2. CONEXÃO COM O ARDUINO
// ==========================================

let conectando = false;

window.conectarArduino = async function() {

    if (conectando) return;

    conectando = true;

    try {

        if (!("serial" in navigator)) {
            throw new Error("Web Serial não é compatível com este navegador.");
        }

        const porta = await navigator.serial.requestPort();

        await porta.open({ baudRate: 9600 });

        console.log("Arduino conectado!");

        const decoder = new TextDecoderStream();

        const leituraSerial = porta.readable.pipeTo(decoder.writable);

        const reader = decoder.readable.getReader();

        let buffer = "";

        // ==========================================
        // 3. RECEBIMENTO DOS DADOS
        // ==========================================

        while (true) {

            const { value, done } = await reader.read();

            if (done) break;

            if (value) {

                buffer += value;

                const linhas = buffer.split(/\r?\n/);

                buffer = linhas.pop();

                for (const linha of linhas) {

                    const dados = linha.trim();

                    const adc = dados.match(/Leitura ADC: (\d+)/);
                    const resistencia = dados.match(/Resistencia LDR: ([\d.]+)/);
                    const lux = dados.match(/Iluminancia estimada: ([\d.]+)/);

                    if (adc && resistencia && lux) {

                        const intensidade = Number(adc[1]);
                        const valorResistencia = Number(resistencia[1]);
                        const valorLux = Number(lux[1]);

                        // ==========================================
                        // 4. ATUALIZAÇÃO DOS DADOS NO HTML
                        // ==========================================

                        document.getElementById("valor").innerText = intensidade;

                        document.getElementById("resistencia").innerText =
                            valorResistencia + " Ω";

                        document.getElementById("lux").innerText =
                            valorLux + " lux";

                        // ==========================================
                        // 5. FUNDO DINÂMICO
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
        }

        reader.releaseLock();
        await leituraSerial;

        await porta.close();

    } catch (erro) {

        if (erro.name === "NotFoundError") {
            console.log("Seleção da porta cancelada.");
        } else {
            console.error("Erro na conexão com o Arduino:", erro);
        }

    } finally {

        conectando = false;

    }
};
