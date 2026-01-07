// 1. INICIALIZAÇÃO DE DADOS
let db = { clientes: [], vendas: [] };

function carregarDados() {
    const memoria = localStorage.getItem('fiado_db');
    if (memoria) db = JSON.parse(memoria);
}

function salvar() {
    localStorage.setItem('fiado_db', JSON.stringify(db));
}

// 2. NAVEGAÇÃO
function navegar(telaId) {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    const destino = document.getElementById('tela-' + telaId);
    if (destino) destino.style.display = 'flex';

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if(sidebar) sidebar.classList.remove('active');
    }

    if (telaId === 'home') atualizarHome();
    if (telaId === 'venda') carregarSelect();
    if (telaId === 'historico') renderizarHistorico();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

// 3. LÓGICA DE NEGÓCIO
function atualizarHome() {
    const total = db.vendas.reduce((acc, v) => acc + v.valor, 0);
    const el = document.getElementById('total-geral');
    if (el) el.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

// Cadastro de Cliente (Sem alerta)
document.getElementById('form-cliente').addEventListener('submit', (e) => {
    e.preventDefault();
    db.clientes.push({
        nome: document.getElementById('nome-cliente').value,
        tel: document.getElementById('tel-cliente').value.replace(/\D/g, '')
    });
    salvar();
    e.target.reset();
    navegar('home'); // Vai direto para o início
});

// Carregar Clientes no Select
function carregarSelect() {
    const s = document.getElementById('select-cliente');
    if (!s) return;
    s.innerHTML = db.clientes.length ? '<option value="">Selecione o Cliente</option>' : '<option>Cadastre um cliente primeiro</option>';
    db.clientes.forEach((c, i) => s.innerHTML += `<option value="${i}">${c.nome}</option>`);
}

// Registro de Venda (Sem alerta)
document.getElementById('form-venda').addEventListener('submit', (e) => {
    e.preventDefault();
    const idx = document.getElementById('select-cliente').value;
    if (idx === "") return;

    db.vendas.push({
        nome: db.clientes[idx].nome,
        tel: db.clientes[idx].tel,
        valor: parseFloat(document.getElementById('valor-venda').value),
        desc: document.getElementById('desc-venda').value,
        data: new Date().toLocaleDateString('pt-br')
    });
    salvar();
    e.target.reset();
    navegar('home'); // Vai direto para o início
});

// Renderizar Histórico
function renderizarHistorico() {
    const container = document.getElementById('lista-historico');
    if (!container) return;
    container.innerHTML = db.vendas.length ? '' : '<p>Sem dívidas ativas.</p>';
    
    [...db.vendas].reverse().forEach((v, i) => {
        const realIdx = db.vendas.length - 1 - i;
        const msg = encodeURIComponent(`Olá ${v.nome}, lembrete de conta: R$ ${v.valor.toFixed(2)}`);
        
        container.innerHTML += `
            <div class="item-venda">
                <div><strong>${v.nome}</strong><br><small>${v.data} - ${v.desc}</small></div>
                <div style="text-align:right">
                    <div style="color:#ef4444; font-weight:bold">R$ ${v.valor.toFixed(2)}</div>
                    <div class="actions">
                        <button class="btn-quitar" onclick="quitar(${realIdx})"><i class="fas fa-check"></i></button>
                        <a href="https://wa.me/55${v.tel}?text=${msg}" target="_blank" class="btn-wpp"><i class="fab fa-whatsapp"></i></a>
                    </div>
                </div>
            </div>`;
    });
}

// Quitar Dívida (Sem confirmação de tela)
function quitar(idx) {
    db.vendas.splice(idx, 1);
    salvar();
    renderizarHistorico();
    atualizarHome();
}

// Inicialização automática
window.onload = () => {
    carregarDados();
    navegar('home');
};
