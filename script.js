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