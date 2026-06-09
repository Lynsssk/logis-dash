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
// 2. SISTEMA DE EXCLUSÃO (NOVO)
// ==========================================
window.excluirItem = function(idStr) {
    if(confirm("Tem certeza que deseja excluir esta carga específica?")) {
        frotaAtiva = frotaAtiva.filter(v => String(v.id) !== String(idStr));
        salvarEAtualizar("Carga excluída com sucesso!");
    }
}

window.limparTodosOsDados = function() {
    if(confirm("ATENÇÃO: Isso vai apagar TODAS as cargas do sistema. Tem certeza que deseja zerar para importar um novo dia?")) {
        frotaAtiva = [];
        localStorage.removeItem('logisProData_0806');
        salvarEAtualizar("Sistema completamente zerado!");
    }
}

// ==========================================
// 3. IMPORTAÇÃO INTELIGENTE (EXCEL)
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
        
        let nomeAba = workbook.SheetNames.includes('GRANDES CONTAS') ? 'GRANDES CONTAS' : (workbook.SheetNames.length >= 4 ? workbook.SheetNames[3] : workbook.SheetNames[0]);
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[nomeAba], { defval: "" });
        processarImportacao(jsonData, "Excel");
    };
    reader.readAsArrayBuffer(arquivo);
}

// ==========================================
// 4. PROCESSAMENTO DO BACKLOG (COLA MANUAL)
// ==========================================
window.processarBacklogManual = function() {
    const texto = document.getElementById('texto-backlog').value;
    if(!texto.trim()) return;

    const linhas = texto.split('\n');
    let backlogProcessado = [];

    linhas.forEach(linha => {
        const colunas = linha.split('\t'); 
        if(colunas.length >= 3) { 
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
        document.getElementById('texto-backlog').value = ""; 
    }
}

// ==========================================
// 5. TRIAGEM DE DADOS
// ==========================================
// ==========================================
// 5. TRIAGEM DE DADOS
// ==========================================
function processarImportacao(dadosBrutos, origem) {
    let novosRegistros = [];

    dadosBrutos.forEach((linha, index) => {
        let placaStr = linha['PLACA'] || linha['Placa'] || "";
        // AQUI ESTÁ A CORREÇÃO:
        let transpStr = linha['TRANSP'] || linha['TRANSP.'] || linha['TRANSPORTADORA'] || linha['Transp'] || "";
        
        let clienteStr = linha['CLIENTE'] || linha['Cliente'] || "";
        let statusStr = linha['STATUS'] || linha['Status'] || "Aguardando";
        let transporteStr = linha['TRANSPORTE'] || linha['CONCATENAR'] || `MANUAL-${index}`;
        let gradeStr = linha['GRADE'] || linha['DATACHEGADA'] || "";

        if(placaStr && clienteStr) {
            let exigeReag = clientesReagendamento.some(c => clienteStr.toUpperCase().includes(c));
            
            let classeOcioso = "Em Rota";
            if (statusStr.toUpperCase().includes("BACKLOG")) classeOcioso = "Backlog";
            else if (statusStr.toUpperCase().includes("OCIOSO")) classeOcioso = "Ocioso";
            else if (statusStr.toUpperCase().includes("AGUARDANDO")) classeOcioso = "Não Ocioso";

            novosRegistros.push({
                id: Date.now() + Math.random(),
                transporte: transporteStr,
                placa: String(placaStr).trim(),
                novaPlaca: "", 
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

    if(origem === "Excel") frotaAtiva = novosRegistros; 
    else frotaAtiva = [...frotaAtiva, ...novosRegistros]; 

    salvarEAtualizar(`Importação de ${origem} concluída com sucesso!`);
}
// ==========================================
// 6. RENDERIZAÇÃO DAS ABAS (COM BOTÃO DE LIXEIRA)
// ==========================================
// ==========================================
// 6. RENDERIZAÇÃO, BUSCA E FILTROS (ATUALIZADO)
// ==========================================

// Variáveis para guardar o que você está pesquisando/filtrando
let termoBusca = "";
let statusSelecionado = "";
let transpSelecionada = "";

// Escuta o que você digita na barra de pesquisa
document.getElementById('global-search')?.addEventListener('input', function(e) {
    termoBusca = e.target.value.toLowerCase();
    aplicarFiltrosTela();
});

// Função chamada quando você mexe nos selects (dropdowns)
window.aplicarFiltrosTela = function() {
    statusSelecionado = document.getElementById('filtro-status').value;
    transpSelecionada = document.getElementById('filtro-transp').value;
    
    renderizarMonitoramento();
    renderizarReagendamentos();
    renderizarOciosidade();
}

function filtrarDados(dados) {
    return dados.filter(v => {
        // 1. Busca por texto (qualquer campo)
        let textoCarro = Object.values(v).join(" ").toLowerCase();
        let bateBusca = textoCarro.includes(termoBusca);

        // 2. Filtro de Status
        let bateStatus = true;
        if (statusSelecionado === "FINALIZADO") bateStatus = v.status.toUpperCase().includes("FINALIZADO");
        else if (statusSelecionado === "AGUARDANDO") bateStatus = v.status.toUpperCase().includes("AGUARDANDO") || v.status.toUpperCase().includes("BACKLOG");
        else if (statusSelecionado === "ROTA") bateStatus = !v.status.toUpperCase().includes("FINALIZADO") && !v.status.toUpperCase().includes("AGUARDANDO") && !v.status.toUpperCase().includes("BACKLOG");

        // 3. Filtro de Transportadora
        let bateTransp = true;
        if (transpSelecionada !== "") bateTransp = v.transp.toUpperCase() === transpSelecionada.toUpperCase();

        return bateBusca && bateStatus && bateTransp;
    });
}

// Preenche o filtro de transportadoras automaticamente sem repetir nomes
function atualizarFiltrosDinamicos() {
    const selectTransp = document.getElementById('filtro-transp');
    if(!selectTransp) return;
    
    // Pega todas as transportadoras únicas
    const transportadorasUnicas = [...new Set(frotaAtiva.map(v => v.transp.toUpperCase()))].filter(t => t !== "");
    
    // Limpa as opções antigas e recria
    selectTransp.innerHTML = '<option value="">Todas as Transportadoras</option>';
    transportadorasUnicas.forEach(t => {
        selectTransp.innerHTML += `<option value="${t}">${t}</option>`;
    });
}

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
    atualizarFiltrosDinamicos(); // Atualiza a lista de transportadoras no filtro
}

function renderizarMonitoramento() {
    const tbody = document.getElementById('tbody-monitoramento');
    tbody.innerHTML = '';
    
    // Passa os dados pelo filtro antes de desenhar a tabela
    let dadosFiltrados = filtrarDados(frotaAtiva);
    
    if(dadosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Nenhum dado encontrado com esses filtros.</td></tr>';
        return;
    }

    dadosFiltrados.forEach(v => {
        let badgeClass = v.status.toUpperCase().includes("FINALIZADO") ? "bg-gray" : "bg-success";
        tbody.innerHTML += `
        <tr>
            <td><button class="btn-icon" style="color: var(--red);" onclick="excluirItem('${v.id}')" title="Excluir Carga"><i class="fa-solid fa-trash"></i></button></td>
            <td>${v.transporte}</td>
            <td><strong>${v.novaPlaca || v.placa}</strong></td>
            <td>${v.transp}</td>
            <td>${v.cliente}</td>
            <td><span class="badge ${badgeClass}">${v.status}</span></td>
            <td>${v.grade}</td>
        </tr>`;
    });
}

function renderizarReagendamentos() {
    const tbody = document.getElementById('tbody-reagendamentos');
    tbody.innerHTML = '';
    
    let dadosFiltrados = filtrarDados(frotaAtiva);
    let wmsAtacadao = dadosFiltrados.filter(v => v.reagStatus !== "N/A" && !v.status.toUpperCase().includes("FINALIZADO"));
    
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

    let dadosFiltrados = filtrarDados(frotaAtiva);
    let painelOciosos = dadosFiltrados.filter(v => ["Backlog", "Ocioso", "Não Ocioso"].includes(v.classificacao));

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
// 7. EDIÇÃO E EXPORTAÇÃO DA PLANILHA
// ==========================================
window.atualizarCampo = function(idStr, campo, valor) {
    let index = frotaAtiva.findIndex(v => String(v.id) === String(idStr));
    if(index > -1) {
        frotaAtiva[index][campo] = valor.toUpperCase();
        salvarEAtualizar(""); // Atualiza silenciosamente
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
    XLSX.writeFile(workbook, `Relatorio_Patio.xlsx`);
    mostrarToast("Planilha exportada com sucesso!");
}

// ==========================================
// 8. LÓGICA DO MODAL E WHATSAPP
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
    let texto = `*Torre de Controle Operacional*\nData: Hoje\n\n*Resumo de Rotas:*\n🚚 Em andamento: ${pendentes.length}\n✅ Finalizados: ${frotaAtiva.length - pendentes.length}\n\n`;
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
function salvarEAtualizar(msg) { localStorage.setItem('logisProData_0806', JSON.stringify(frotaAtiva)); atualizarDashboard(); renderizarMonitoramento(); renderizarReagendamentos(); renderizarOciosidade(); if(msg) mostrarToast(msg); }
function mostrarToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'), 3000); }

// Navegação Padrão
document.querySelectorAll('#menu-principal li').forEach(item => { item.addEventListener('click', function() { document.querySelectorAll('#menu-principal li').forEach(li => li.classList.remove('active')); document.querySelectorAll('.secao-aba').forEach(aba => aba.classList.remove('ativa')); this.classList.add('active'); document.getElementById(this.getAttribute('data-target')).classList.add('ativa'); }); });

window.abrirLogTratativa = function(idStr) {
    const v = frotaAtiva.find(v => String(v.id) === String(idStr));
    document.getElementById('reag-id').value = idStr; // Reutilizando o input hidden do modal anterior ou crie um novo
    document.getElementById('log-transporte').textContent = `Carga: ${v.transporte} | Placa: ${v.placa}`;
    document.getElementById('texto-log').value = v.historicoLog || "";
    document.getElementById('modal-log').classList.remove('hidden');
}

window.salvarLog = function() {
    const idStr = document.getElementById('reag-id').value;
    const texto = document.getElementById('texto-log').value;
    const index = frotaAtiva.findIndex(v => String(v.id) === String(idStr));
    
    frotaAtiva[index].historicoLog = `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} - ${texto}`;
    salvarEAtualizar("Tratativa registrada!");
    fecharModais();
}
initApp();
