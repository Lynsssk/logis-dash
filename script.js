let frotaAtiva = JSON.parse(localStorage.getItem('logisProData_0806')) || [];
const clientesReagendamento = ['ATACADAO', 'ATACADÃO', 'WMS'];

// ==========================================
// 1. INICIALIZAÇÃO
// ==========================================
function initApp() {
    atualizarDashboard();
    renderizarMonitoramento();
    renderizarReagendamentos();
    renderizarOciosidade();
}

setInterval(() => document.getElementById('realtime-clock').textContent = new Date().toLocaleTimeString('pt-BR'), 1000);

// ==========================================
// 2. IMPORTAÇÃO INTELIGENTE (EXCEL)
// ==========================================
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); if(e.dataTransfer.files.length) lerPlanilhaExcel(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', function() { if(this.files.length) lerPlanilhaExcel(this.files[0]); });

function lerPlanilhaExcel(arquivo) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Foca na aba GRANDES CONTAS ou a quarta aba se existir
        let nomeAba = workbook.SheetNames.includes('GRANDES CONTAS') ? 'GRANDES CONTAS' : (workbook.SheetNames.length >= 4 ? workbook.SheetNames[3] : workbook.SheetNames[0]);
        
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[nomeAba], { defval: "" });
        processarImportacao(jsonData, "Excel");
    };
    reader.readAsArrayBuffer(arquivo);
}

// ==========================================
// 3. PROCESSAMENTO DO BACKLOG (COLA MANUAL)
// ==========================================
window.processarBacklogManual = function() {
    const texto = document.getElementById('texto-backlog').value;
    if(!texto.trim()) return;

    const linhas = texto.split('\n');
    let backlogProcessado = [];

    linhas.forEach(linha => {
        const colunas = linha.split('\t'); // Separa pelo "TAB" do Excel
        if(colunas.length >= 3) { // Se tiver pelo menos Placa, Transp e Cliente
            backlogProcessado.push({
                PLACA: colunas[0]?.trim(),
                TRANSPORTADORA: colunas[1]?.trim(),
                CLIENTE: colunas[2]?.trim(),
                TRANSPORTE: colunas[3]?.trim() || "S/N",
                STATUS: "BACKLOG",
                GRADE: "08/06/2026"
            });
        }
    });

    if(backlogProcessado.length > 0) {
        processarImportacao(backlogProcessado, "Backlog");
        document.getElementById('texto-backlog').value = ""; // Limpa a caixa
    }
}

// ==========================================
// 4. TRIAGEM DE DADOS (WMS/ATACADAO)
// ==========================================
function processarImportacao(dadosBrutos, origem) {
    let novosRegistros = [];

    dadosBrutos.forEach((linha, index) => {
        let placaStr = linha['PLACA'] || linha['Placa'] || "";
        let transpStr = linha['TRANSP.'] || linha['TRANSPORTADORA'] || linha['Transp'] || "";
        let clienteStr = linha['CLIENTE'] || linha['Cliente'] || "";
        let statusStr = linha['STATUS'] || linha['Status'] || "Aguardando";
        let transporteStr = linha['TRANSPORTE'] || linha['CONCATENAR'] || `MANUAL-${index}`;
        let gradeStr = linha['GRADE'] || linha['DATACHEGADA'] || "";

        if(placaStr && clienteStr) {
            let exigeReag = clientesReagendamento.some(c => clienteStr.toUpperCase().includes(c));
            
            // Classificação automática para a aba de Ociosidade
            let classeOcioso = "Em Rota";
            if (statusStr.toUpperCase().includes("BACKLOG")) classeOcioso = "Backlog";
            else if (statusStr.toUpperCase().includes("OCIOSO")) classeOcioso = "Ocioso";
            else if (statusStr.toUpperCase().includes("AGUARDANDO")) classeOcioso = "Não Ocioso";

            novosRegistros.push({
                id: Date.now() + Math.random(),
                transporte: transporteStr,
                placa: String(placaStr).trim(),
                novaPlaca: "", // Campo para edição na aba Ociosidade
                transp: transpStr,
                cliente: clienteStr,
                status: statusStr,
                grade: gradeStr,
                classificacao: classeOcioso,
                motivoOcioso: "",
                reagStatus: exigeReag ? "Pendente" : "N/A",
                reagCarga: "",
                reagAnexo: null
            });
        }
    });

    if(origem === "Excel") frotaAtiva = novosRegistros; // Excel sobrescreve
    else frotaAtiva = [...frotaAtiva, ...novosRegistros]; // Backlog adiciona à lista

    salvarEAtualizar(`Importação de ${origem} concluída com sucesso!`);
}

// ==========================================
// 5. RENDERIZAÇÃO DAS ABAS
// ==========================================
function atualizarDashboard() {
    let reagPendentes = frotaAtiva.filter(v => v.reagStatus === "Pendente").length;
    let finalizados = frotaAtiva.filter(v => v.status.toUpperCase().includes("FINALIZADO")).length;
    let backlog = frotaAtiva.filter(v => v.classificacao === "Backlog").length;
    let rota = frotaAtiva.length - finalizados - backlog;

    document.getElementById('kpi-rota').textContent = rota;
    document.getElementById('kpi-fin').textContent = finalizados;
    document.getElementById('kpi-aguard').textContent = backlog;
    document.getElementById('kpi-reag').textContent = reagPendentes;

    renderizarGraficoDash(rota, finalizados, backlog);
}

function renderizarMonitoramento() {
    const tbody = document.getElementById('tbody-monitoramento');
    tbody.innerHTML = '';
    frotaAtiva.forEach(v => {
        let badgeClass = v.status.toUpperCase().includes("FINALIZADO") ? "bg-gray" : "bg-success";
        tbody.innerHTML += `<tr><td>${v.transporte}</td><td><strong>${v.novaPlaca || v.placa}</strong></td><td>${v.transp}</td><td>${v.cliente}</td><td><span class="badge ${badgeClass}">${v.status}</span></td><td>${v.grade}</td></tr>`;
    });
}

function renderizarReagendamentos() {
    const tbody = document.getElementById('tbody-reagendamentos');
    tbody.innerHTML = '';
    
    // Filtra apenas os que são obrigatórios e não estão finalizados
    let wmsAtacadao = frotaAtiva.filter(v => v.reagStatus !== "N/A" && !v.status.toUpperCase().includes("FINALIZADO"));
    
    wmsAtacadao.forEach(v => {
        let badgeClass = v.reagStatus === "Concluído" ? "bg-green" : "bg-red";
        let anexoIco = v.reagAnexo ? `<i class="fa-solid fa-file-pdf text-red"></i>` : "-";
        
        tbody.innerHTML += `
            <tr>
                <td>${v.transporte}</td><td><strong>${v.cliente}</strong></td><td>${v.novaPlaca || v.placa}</td>
                <td>${v.reagCarga || '-'} ${anexoIco}</td><td><span class="badge" style="background:var(--${badgeClass})">${v.reagStatus}</span></td>
                <td><button class="btn-outline" onclick="abrirModalReag('${v.id}')"><i class="fa-solid fa-pen"></i> Tratar</button></td>
            </tr>`;
    });
}

function renderizarOciosidade() {
    const tbody = document.getElementById('tbody-ociosidade');
    tbody.innerHTML = '';

    let painelOciosos = frotaAtiva.filter(v => ["Backlog", "Ocioso", "Não Ocioso"].includes(v.classificacao));

    painelOciosos.forEach(v => {
        let corClasse = v.classificacao === "Backlog" ? "text-red" : (v.classificacao === "Ocioso" ? "text-yellow" : "text-blue");
        
        tbody.innerHTML += `
            <tr>
                <td><strong class="${corClasse}">${v.classificacao}</strong></td>
                <td style="${v.novaPlaca ? 'text-decoration: line-through; color: gray;' : ''}">${v.placa}</td>
                <td><input type="text" class="input-tabela" value="${v.novaPlaca}" placeholder="Ex: RLU7I85" onchange="atualizarCampo('${v.id}', 'novaPlaca', this.value)"></td>
                <td>${v.cliente}</td>
                <td><input type="text" class="input-tabela" value="${v.motivoOcioso}" placeholder="Motivo/Justificativa" onchange="atualizarCampo('${v.id}', 'motivoOcioso', this.value)"></td>
            </tr>`;
    });
}

// ==========================================
// 6. EDIÇÃO E EXPORTAÇÃO DA PLANILHA (S/ BACKEND)
// ==========================================
window.atualizarCampo = function(idStr, campo, valor) {
    let index = frotaAtiva.findIndex(v => String(v.id) === String(idStr));
    if(index > -1) {
        frotaAtiva[index][campo] = valor.toUpperCase();
        localStorage.setItem('logisProData_0806', JSON.stringify(frotaAtiva));
        // Atualiza silenciosamente as outras telas se mudou a placa
        if(campo === 'novaPlaca') { renderizarMonitoramento(); renderizarReagendamentos(); }
    }
}

window.exportarPlanilhaOciosidade = function() {
    let dadosExportacao = frotaAtiva
        .filter(v => ["Backlog", "Ocioso", "Não Ocioso"].includes(v.classificacao))
        .map(v => ({
            "CLASSIFICAÇÃO": v.classificacao,
            "PLACA ORIGINAL": v.placa,
            "NOVA PLACA (TROCA)": v.novaPlaca || "-",
            "TRANSPORTADORA": v.transp,
            "CLIENTE / DESTINO": v.cliente,
            "MOTIVO / JUSTIFICATIVA": v.motivoOcioso || "Não informado"
        }));

    if(dadosExportacao.length === 0) { alert("Não há dados de Ociosidade ou Backlog para exportar."); return; }

    const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ociosidade_Backlog");
    
    // Gera e faz download do arquivo
    XLSX.writeFile(workbook, `Relatorio_Patio_08_06.xlsx`);
    mostrarToast("Planilha exportada com sucesso!");
}

// ==========================================
// 7. LÓGICA DO MODAL DE REAGENDAMENTO E STATUS
// ==========================================
window.abrirModalReag = function(idStr) {
    const v = frotaAtiva.find(v => String(v.id) === String(idStr));
    document.getElementById('reag-id').value = idStr;
    document.getElementById('reag-cliente').textContent = `${v.cliente} | Transp: ${v.transporte}`;
    document.getElementById('reag-carga').value = v.reagCarga || '';
    document.getElementById('reag-status').value = v.reagStatus;
    document.getElementById('modal-reagendamento').classList.remove('hidden');
}

window.salvarReagendamento = function() {
    const idStr = document.getElementById('reag-id').value;
    const index = frotaAtiva.findIndex(v => String(v.id) === String(idStr));
    const fileInput = document.getElementById('reag-file');

    frotaAtiva[index].reagCarga = document.getElementById('reag-carga').value;
    frotaAtiva[index].reagStatus = document.getElementById('reag-status').value;
    if (fileInput.files.length > 0) frotaAtiva[index].reagAnexo = fileInput.files[0].name;

    salvarEAtualizar("Portal de agendamento atualizado!");
}

window.enviarWhatsApp = function() {
    let pendentes = frotaAtiva.filter(v => !v.status.toUpperCase().includes("FINALIZADO"));
    let texto = `*Torre de Controle Operacional*\nData: 08/06/2026\n\n*Resumo de Rotas:*\n🚚 Em andamento: ${pendentes.length}\n✅ Finalizados: ${frotaAtiva.length - pendentes.length}\n\n`;
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
}

// Auxiliares Visuais e Gráfico
let chartDash;
function renderizarGraficoDash(r, f, b) {
    if(chartDash) chartDash.destroy();
    const ctx = document.getElementById('operacionalChart').getContext('2d');
    chartDash = new Chart(ctx, { type: 'doughnut', data: { labels: ['Rota/Aguardando', 'Finalizado', 'Backlog'], datasets: [{ data: [r, f, b], backgroundColor: ['#3b82f6', '#94a3b8', '#ef4444'], borderWidth: 0, cutout: '70%' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#f8fafc' } } } } });
}

window.fecharModais = function() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }
function salvarEAtualizar(msg) { localStorage.setItem('logisProData_0806', JSON.stringify(frotaAtiva)); atualizarDashboard(); renderizarMonitoramento(); renderizarReagendamentos(); renderizarOciosidade(); mostrarToast(msg); }
function mostrarToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'), 3000); }

// Navegação Padrão
document.querySelectorAll('#menu-principal li').forEach(item => { item.addEventListener('click', function() { document.querySelectorAll('#menu-principal li').forEach(li => li.classList.remove('active')); document.querySelectorAll('.secao-aba').forEach(aba => aba.classList.remove('ativa')); this.classList.add('active'); document.getElementById(this.getAttribute('data-target')).classList.add('ativa'); }); });

initApp();
