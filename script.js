// ==========================================
// 1. BANCO DE DADOS LOCAL (LOCALSTORAGE)
// ==========================================

// Dados simulados baseados na sua operação real para a primeira vez que o sistema abrir
const dadosIniciais = [
    { id: 1, placa: "PDE9J62>>PFL5I16", transp: "OTIMIZAR", cliente: "NOVO ATACADO", status: "Em Loja - Sem Previsão", tipo: "Comercial", tempo: "Atrasado" },
    { id: 2, placa: "KKT9E78", transp: "PAIXÃO", cliente: "ATACADAO SA", status: "Início de descarga", tipo: "Rota", tempo: "Normal" },
    { id: 3, placa: "RLU7I85", transp: "PAIXÃO", cliente: "UNI COMPRA", status: "Carregado (Atrasado)", tipo: "Pátio", tempo: "Atrasado" },
    { id: 4, placa: "QJU1343>>EFV9782", transp: "CARGOSUL", cliente: "CF DISTRIBUIDORA", status: "Fora do Horário", tipo: "Pátio", tempo: "Atrasado" },
    { id: 5, placa: "JSR7I98", transp: "GABRI", cliente: "SENDAS", status: "Reinício (Pernoite)", tipo: "Rota", tempo: "Atenção" },
    { id: 6, placa: "TPE1E93", transp: "DIRETA", cliente: "REDE BOM COMERCIO", status: "Separando", tipo: "Pátio", tempo: "Normal" },
    { id: 7, placa: "SEM PLACA", transp: "A DEFINIR", cliente: "MERCADO LOCAL", status: "Falta de veículo", tipo: "Backlog", tempo: "Crítico" }
];

// Tenta buscar os dados salvos no navegador. Se não existir, usa os dados Iniciais.
let frotaAtiva = JSON.parse(localStorage.getItem('logisData')) || dadosIniciais;

// Função que você usará no futuro para salvar edições/importações
function salvarDados() {
    localStorage.setItem('logisData', JSON.stringify(frotaAtiva));
    initDashboard(); // Atualiza a tela toda vez que salvar algo novo
}


// ==========================================
// 2. INICIALIZAÇÃO DO DASHBOARD E KPIS
// ==========================================
let myChart; // Variável global para o gráfico

function initDashboard() {
    const total = frotaAtiva.length;
    const emRota = frotaAtiva.filter(v => v.tipo === "Rota" || v.tipo === "Comercial").length;
    const noPatio = frotaAtiva.filter(v => v.tipo === "Pátio").length;
    const backlog = frotaAtiva.filter(v => v.tipo === "Backlog").length;
    
    // Ociosidade = Carros atrasados no pátio ou críticos (falta de veículo)
    const ociosos = frotaAtiva.filter(v => v.tempo === "Atrasado" || v.tempo === "Crítico").length;

    // Atualizando os números dos cards (KPIs) no HTML
    document.getElementById('kpi-rota').textContent = emRota;
    document.getElementById('kpi-patio').textContent = noPatio;
    document.getElementById('kpi-backlog').textContent = backlog;
    document.getElementById('kpi-ociosos').textContent = ociosos;

    // Cálculo da Porcentagem para o Gráfico
    const pctOcupacao = total > 0 ? Math.round(((total - ociosos) / total) * 100) : 0;
    const pctOciosidade = total > 0 ? Math.round((ociosos / total) * 100) : 0;

    renderizarGrafico(pctOcupacao, pctOciosidade);
    gerarCobrancas();
}


// ==========================================
// 3. GRÁFICO OPERACIONAL (CHART.JS)
// ==========================================
function renderizarGrafico(ocupado, ocioso) {
    const ctx = document.getElementById('operacionalChart').getContext('2d');
    
    // Destrói o gráfico antigo antes de criar um novo (evita bugar quando atualiza)
    if(myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [`Ocupação (${ocupado}%)`, `Ociosidade (${ocioso}%)`],
            datasets: [{
                data: [ocupado, ocioso],
                backgroundColor: ['#10b981', '#ef4444'], // Verde e Vermelho
                borderWidth: 0,
                cutout: '70%' // Deixa o buraco no meio maior
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f8fafc' } }
            }
        }
    });
}


// ==========================================
// 4. CENTRAL DE COBRANÇAS (TEAMS)
// ==========================================
function gerarCobrancas() {
    const list = document.getElementById('action-list');
    list.innerHTML = ''; // Limpa a lista antes de gerar

    frotaAtiva.forEach(v => {
        // Regra para gerar alerta: Atrasado, Crítico ou Sem Previsão
        if (v.tempo === "Atrasado" || v.tempo === "Crítico" || v.status.includes("Sem Previsão")) {
            
            let acaoMsg = "";
            let copyText = "";
            let corBorda = "";

            if (v.tipo === "Comercial") {
                acaoMsg = `Cobrar Comercial/Operação (Loja)`;
                corBorda = "var(--yellow)";
                copyText = `Prezados, o veículo ${v.placa} (${v.transp}) está no cliente ${v.cliente} com status '${v.status}'. Podem intervir junto à loja?`;
            } else {
                acaoMsg = `Cobrar Transportadora: ${v.transp}`;
                corBorda = "var(--red)";
                copyText = `Olá equipe ${v.transp}, identificamos atraso na grade do veículo ${v.placa} (Cliente: ${v.cliente}). Favor posicionar status da operação.`;
            }

            // Cria o card de alerta no HTML
            list.innerHTML += `
                <div class="alert-item" style="border-left: 4px solid ${corBorda}">
                    <div>
                        <strong style="color: white">${v.cliente}</strong> - <span style="color: var(--text-muted); font-size: 0.85rem">${v.placa}</span>
                        <p style="font-size: 0.85rem; color: #cbd5e1; margin-top: 5px;">Ação: ${acaoMsg}</p>
                    </div>
                    <button class="btn-teams" onclick="copiarTeams('${copyText}')">
                        <i class="fa-brands fa-windows"></i> Copiar Texto
                    </button>
                </div>
            `;
        }
    });
}

// Função para copiar o texto e mostrar o aviso verde na tela
window.copiarTeams = function(texto) {
    navigator.clipboard.writeText(texto).then(() => {
        const toast = document.getElementById('toast');
        toast.classList.remove('hidden');
        
        // Esconde o aviso depois de 3 segundos
        setTimeout(() => toast.classList.add('hidden'), 3000);
    });
}


// ==========================================
// 5. MOTOR DE BUSCA ("CADÊ A PLACA?")
// ==========================================
document.getElementById('global-search').addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase();
    const resultSection = document.getElementById('search-results');
    const content = document.getElementById('search-content');
    
    // Só pesquisa se digitar mais de 2 letras
    if(query.length < 2) {
        resultSection.style.display = 'none';
        return;
    }

    // Filtra ignorando maiúsculas e minúsculas
    const filtrados = frotaAtiva.filter(v => 
        v.placa.toLowerCase().includes(query) || 
        v.cliente.toLowerCase().includes(query) ||
        v.transp.toLowerCase().includes(query)
    );

    content.innerHTML = '';
    
    if(filtrados.length > 0) {
        filtrados.forEach(v => {
            content.innerHTML += `
                <div class="search-result-card">
                    <strong>Transportadora:</strong> ${v.transp} | 
                    <strong>Placa:</strong> ${v.placa} <br>
                    <strong>Cliente:</strong> ${v.cliente} | 
                    <strong>Status Atual:</strong> <span class="badge bg-success" style="background: rgba(59,130,246,0.2); color: #60a5fa">${v.status}</span>
                </div>
            `;
        });
        resultSection.style.display = 'block';
    } else {
        content.innerHTML = '<p style="color: var(--text-muted)">Nenhum veículo encontrado com esse termo.</p>';
        resultSection.style.display = 'block';
    }
});


// ==========================================
// 6. FILTROS DA VISÃO COMERCIAL (BOTÕES)
// ==========================================
window.filtrarVisao = function(tipo) {
    // Remove a classe 'active' de todos os botões e coloca no botão clicado
    document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Efeitos visuais baseados no filtro clicado
    if(tipo === 'atacadao') {
        // Pisca a borda amarela (Backlog) para chamar atenção
        const cardBacklog = document.querySelector('.border-yellow');
        cardBacklog.style.boxShadow = "0 0 20px var(--yellow)";
        setTimeout(() => cardBacklog.style.boxShadow = "none", 1500);
    } else if (tipo === 'atrasados') {
        // Pisca a borda vermelha
        const cardOciosos = document.querySelector('.border-red');
        cardOciosos.style.boxShadow = "0 0 20px var(--red)";
        setTimeout(() => cardOciosos.style.boxShadow = "none", 1500);
    }
    // No futuro, ao clicar nesses filtros, podemos filtrar a tabela inteira que for importada do Excel
}


// ==========================================
// 7. RELÓGIO EM TEMPO REAL
// ==========================================
function atualizarRelogio() {
    const now = new Date();
    document.getElementById('realtime-clock').textContent = now.toLocaleTimeString('pt-BR');
}
setInterval(atualizarRelogio, 1000);
atualizarRelogio(); // Chama imediatamente para não esperar 1 segundo


// Inicia o sistema ao carregar o código
initDashboard();

// ==========================================
// CONTROLE DE NAVEGAÇÃO DE ABAS
// ==========================================
document.querySelectorAll('#menu-principal li').forEach(item => {
    item.addEventListener('click', function() {
        // Remove 'active' de todos os menus e esconde todas as abas
        document.querySelectorAll('#menu-principal li').forEach(li => li.classList.remove('active'));
        document.querySelectorAll('.secao-aba').forEach(aba => aba.classList.remove('ativa'));
        
        // Ativa o menu clicado e mostra a aba correspondente
        this.classList.add('active');
        const targetId = this.getAttribute('data-target');
        document.getElementById(targetId).classList.add('ativa');
    });
});

// ==========================================
// LÓGICA DE IMPORTAÇÃO DE DADOS (EXCEL/CSV)
// ==========================================
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
let frotaTemporaria = []; // Guarda os dados antes de você confirmar

// Efeitos visuais ao arrastar arquivo
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) processarArquivo(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', function() {
    if (this.files.length) processarArquivo(this.files[0]);
});

function processarArquivo(arquivo) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Pega a primeira aba da planilha
        const primeiraAba = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[primeiraAba];
        
        // Converte para JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        mapearColunasInteligente(jsonData);
    };
    
    reader.readAsArrayBuffer(arquivo);
}

function mapearColunasInteligente(dadosBrutos) {
    frotaTemporaria = [];
    
    dadosBrutos.forEach((linha, index) => {
        // Procura os campos independente de estar em maiúsculo/minúsculo no Excel
        let chaves = Object.keys(linha).map(k => k.toLowerCase());
        
        // Pega os valores originais tentando achar a chave correspondente
        let placaStr = getValor(linha, ['placa', 'carro pateado']);
        let transpStr = getValor(linha, ['transp', 'transportadora']);
        let clienteStr = getValor(linha, ['cliente', 'loja', 'destino']);
        let statusStr = getValor(linha, ['status', 'status2', 'ravex']);
        
        if(placaStr && placaStr.trim() !== "") {
            // Lógica de inteligência de status (Você pode calibrar depois)
            let tempoStr = statusStr.toLowerCase().includes('atrasado') ? 'Atrasado' : 'Normal';
            let tipoStr = statusStr.toLowerCase().includes('rota') ? 'Rota' : 'Pátio';

            frotaTemporaria.push({
                id: index,
                placa: placaStr,
                transp: transpStr || "N/A",
                cliente: clienteStr || "A Definir",
                status: statusStr || "Em processo",
                tipo: tipoStr,
                tempo: tempoStr
            });
        }
    });

    if(frotaTemporaria.length > 0) {
        mostrarPreview();
    } else {
        mostrarMensagem('Erro: Não foram encontradas colunas de Placa/Cliente na planilha.', 'erro');
    }
}

// Função auxiliar para achar chaves flexíveis
function getValor(obj, palavrasChave) {
    for (let key in obj) {
        if (palavrasChave.some(pk => key.toLowerCase().includes(pk))) {
            return obj[key];
        }
    }
    return "";
}

function mostrarPreview() {
    const tbody = document.getElementById('tabela-preview-body');
    tbody.innerHTML = '';
    
    // Mostra as 5 primeiras linhas como exemplo
    const amostra = frotaTemporaria.slice(0, 5);
    amostra.forEach(v => {
        tbody.innerHTML += `<tr>
            <td><strong>${v.placa}</strong></td>
            <td>${v.transp}</td>
            <td>${v.cliente}</td>
            <td><span class="badge bg-success">${v.status}</span></td>
        </tr>`;
    });

    document.getElementById('preview-dados').classList.remove('hidden');
    mostrarMensagem(`Planilha lida com sucesso! ${frotaTemporaria.length} veículos encontrados.`, 'sucesso');
}

function mostrarMensagem(texto, tipo) {
    const msgBox = document.getElementById('status-importacao');
    msgBox.textContent = texto;
    msgBox.className = `status-msg ${tipo}`;
}

// Quando clicar em "Confirmar"
document.getElementById('btn-confirmar-importacao').addEventListener('click', () => {
    // Substitui a frota atual do sistema pela nova planilha
    frotaAtiva = frotaTemporaria;
    salvarDados(); // Salva no LocalStorage
    
    mostrarMensagem('Dashboard atualizado! Voltando para a tela inicial...', 'sucesso');
    document.getElementById('preview-dados').classList.add('hidden');
    
    // Volta para a aba Dashboard após 1.5 segundos
    setTimeout(() => {
        document.querySelector('[data-target="aba-dashboard"]').click();
    }, 1500);
});
