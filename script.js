let frotaAtiva = JSON.parse(localStorage.getItem('logisData')) || [];
let frotaTemporaria = [];

// ==========================================
// 1. INICIALIZAÇÃO E RENDERIZAÇÃO
// ==========================================
function salvarDados() {
    localStorage.setItem('logisData', JSON.stringify(frotaAtiva));
    initDashboard();
}

function initDashboard() {
    const total = frotaAtiva.length;
    const emRota = frotaAtiva.filter(v => v.tipo === "Rota" || v.tipo === "Comercial").length;
    const noPatio = frotaAtiva.filter(v => v.tipo === "Pátio").length;
    const backlog = frotaAtiva.filter(v => v.tipo === "Backlog").length;
    const ociosos = frotaAtiva.filter(v => v.tempo === "Atrasado" || v.tempo === "Crítico").length;

    document.getElementById('kpi-rota').textContent = emRota;
    document.getElementById('kpi-patio').textContent = noPatio;
    document.getElementById('kpi-backlog').textContent = backlog;
    document.getElementById('kpi-ociosos').textContent = ociosos;

    const pctOcupacao = total > 0 ? Math.round(((total - ociosos) / total) * 100) : 0;
    const pctOciosidade = total > 0 ? Math.round((ociosos / total) * 100) : 0;

    renderizarGrafico(pctOcupacao, pctOciosidade);
    renderizarCobrancas();
    renderizarTabelaCompleta(); // <-- NOVA CHAMADA
}

// ==========================================
// 2. TABELA DE MONITORAMENTO E TROCA DE PLACA
// ==========================================
function renderizarTabelaCompleta() {
    const tbody = document.getElementById('tabela-dashboard-body');
    tbody.innerHTML = '';

    frotaAtiva.forEach((v, index) => {
        // Estiliza a cor do status baseado no texto
        let statusClass = "bg-success"; 
        if (v.status.toLowerCase().includes("atrasado") || v.status.toLowerCase().includes("sem previsão")) statusClass = "bg-red";
        else if (v.status.toLowerCase().includes("finalizado")) statusClass = "bg-gray";
        
        let motivoHtml = v.motivoTroca ? `<span class="motivo-texto"><i class="fa-solid fa-triangle-exclamation"></i> ${v.motivoTroca}</span>` : "-";

        tbody.innerHTML += `
            <tr>
                <td>
                    <button class="btn-icon" onclick="abrirModalPlaca(${index}, '${v.placa}')" title="Trocar Placa">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                </td>
                <td><strong>${v.placa}</strong></td>
                <td>${v.transp}</td>
                <td>${v.cliente}</td>
                <td><span class="badge ${statusClass}">${v.status}</span></td>
                <td>${motivoHtml}</td>
            </tr>
        `;
    });
}

function abrirModalPlaca(index, placaAtual) {
    document.getElementById('modal-id-veiculo').value = index;
    document.getElementById('placa-atual-texto').textContent = `Placa Atual: ${placaAtual}`;
    document.getElementById('nova-placa').value = '';
    document.getElementById('modal-placa').classList.remove('hidden');
}

function fecharModal() { document.getElementById('modal-placa').classList.add('hidden'); }

function salvarTrocaPlaca() {
    const index = document.getElementById('modal-id-veiculo').value;
    const novaPlaca = document.getElementById('nova-placa').value;
    const motivo = document.getElementById('motivo-troca').value;

    if (novaPlaca.trim() !== "") {
        frotaAtiva[index].placa = novaPlaca.toUpperCase();
        frotaAtiva[index].motivoTroca = motivo;
        salvarDados();
        fecharModal();
        mostrarToast(`Placa alterada para ${novaPlaca.toUpperCase()}`);
    }
}

// ==========================================
// 3. NOTIFICAR COMERCIAL (Gera o Relatório)
// ==========================================
window.enviarPlanilhaComercial = function() {
    let textoComercial = "*RESUMO OPERACIONAL - MONITORAMENTO*\n\n";
    
    let pendentes = frotaAtiva.filter(v => !v.status.toLowerCase().includes("finalizado"));
    
    if (pendentes.length === 0) {
        textoComercial += "✅ Todas as rotas estão finalizadas no momento.\n";
    } else {
        pendentes.forEach(v => {
            textoComercial += `🚚 *${v.cliente}* (Transp: ${v.transp})\n`;
            textoComercial += `📍 Placa: ${v.placa} | Status: ${v.status}\n`;
            if (v.motivoTroca) textoComercial += `⚠️ Obs: Troca de placa por ${v.motivoTroca}\n`;
            textoComercial += `--------------------------\n`;
        });
    }

    navigator.clipboard.writeText(textoComercial).then(() => {
        mostrarToast("Resumo copiado! Cole no Teams ou E-mail do Comercial.");
    });
}

// ==========================================
// 4. IMPORTAÇÃO INTELIGENTE (CORREÇÃO DA BAGUNÇA)
// ==========================================
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) processarArquivo(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', function() { if (this.files.length) processarArquivo(this.files[0]); });

function processarArquivo(arquivo) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Lê a partir da linha 3 (range: 2), onde os cabeçalhos reais estão!
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 2, defval: "" });
        mapearColunasExatas(jsonData);
    };
    reader.readAsArrayBuffer(arquivo);
}

function mapearColunasExatas(dadosBrutos) {
    frotaTemporaria = [];
    dadosBrutos.forEach((linha, index) => {
        // Busca cirúrgica pelas colunas com o nome EXATO ou partes óbvias (ignorando CONCATENAR/LOJA solto)
        let placaStr = linha['PLACA'] || linha['Placa'] || getValorSeguro(linha, 'placa');
        let transpStr = linha['TRANSP.'] || linha['Transp'] || linha['TRANSPORTADORA'] || getValorSeguro(linha, 'transp');
        let clienteStr = linha['CLIENTE'] || linha['Cliente'] || getValorSeguro(linha, 'cliente'); 
        let statusStr = linha['STATUS'] || linha['Status'] || getValorSeguro(linha, 'status');

        if(placaStr && clienteStr && placaStr.trim() !== "") {
            let tempoStr = statusStr.toLowerCase().includes('atrasado') ? 'Atrasado' : 'Normal';
            frotaTemporaria.push({
                id: index,
                placa: placaStr,
                transp: transpStr || "N/A",
                cliente: clienteStr,
                status: statusStr || "Em processo",
                tipo: statusStr.toLowerCase().includes('loja') ? 'Comercial' : 'Rota',
                tempo: tempoStr,
                motivoTroca: null // Inicialmente vazio
            });
        }
    });

    if(frotaTemporaria.length > 0) {
        frotaAtiva = frotaTemporaria;
        salvarDados();
        mostrarToast(`Importação perfeita! ${frotaAtiva.length} veículos carregados.`);
        setTimeout(() => document.querySelector('[data-target="aba-dashboard"]').click(), 1000);
    } else {
        alert("Erro: Não encontrei as colunas PLACA e CLIENTE. Verifique a planilha.");
    }
}

// Função auxiliar mais estrita para evitar pegar números do concatenar
function getValorSeguro(obj, chaveAlvo) {
    let chave = Object.keys(obj).find(k => k.toLowerCase().trim() === chaveAlvo.toLowerCase());
    return chave ? obj[chave] : "";
}

// ==========================================
// FUNÇÕES AUXILIARES, GRÁFICOS E MENUS (MANTIDOS)
// ==========================================
document.querySelectorAll('#menu-principal li').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('#menu-principal li').forEach(li => li.classList.remove('active'));
        document.querySelectorAll('.secao-aba').forEach(aba => aba.classList.remove('ativa'));
        this.classList.add('active');
        document.getElementById(this.getAttribute('data-target')).classList.add('ativa');
    });
});

let myChart;
function renderizarGrafico(ocupado, ocioso) {
    const ctx = document.getElementById('operacionalChart').getContext('2d');
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Ocupação', 'Ociosidade'], datasets: [{ data: [ocupado, ocioso], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0, cutout: '70%' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderizarCobrancas() {
    const list = document.getElementById('action-list');
    list.innerHTML = '';
    frotaAtiva.forEach(v => {
        if (v.status.toLowerCase().includes("atrasado") || v.status.toLowerCase().includes("sem previsão")) {
            list.innerHTML += `<div class="alert-item" style="border-left: 4px solid var(--red)">
                <div><strong>${v.cliente}</strong><p style="font-size:0.8rem">${v.placa}</p></div>
            </div>`;
        }
    });
}

function mostrarToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

setInterval(() => document.getElementById('realtime-clock').textContent = new Date().toLocaleTimeString('pt-BR'), 1000);
initDashboard();
