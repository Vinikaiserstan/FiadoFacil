// 1. INICIALIZAÇÃO
let db = { clientes: [], vendas: [] };

function carregarDados() {
    const memoria = localStorage.getItem('fiado_db');
    if (memoria) db = JSON.parse(memoria);
}

function salvar() {
    localStorage.setItem('fiado_db', JSON.stringify(db));
}

// Controle de exibição do campo de parcelas na tela de VENDA
document.getElementById('check-parcelado')?.addEventListener('change', function() {
    document.getElementById('qtd-vezes').style.display = this.checked ? 'block' : 'none';
});

// 2. NAVEGAÇÃO
function navegar(telaId) {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    const destino = document.getElementById('tela-' + telaId);
    if (destino) destino.style.display = 'flex';

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('active');
    }

    if (telaId === 'home') atualizarDashboard();
    if (telaId === 'venda') carregarClientesSelect();
    if (telaId === 'historico') renderizarHistorico();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

// 3. FUNÇÕES DE NEGÓCIO
function atualizarDashboard() {
    const total = db.vendas.reduce((acc, v) => acc + v.valor, 0);
    const el = document.getElementById('total-geral');
    if (el) el.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

// Cadastro do Cliente (Apenas dados fixos)
document.getElementById('form-cliente').addEventListener('submit', (e) => {
    e.preventDefault();
    db.clientes.push({
        nome: document.getElementById('nome-cliente').value,
        tel: document.getElementById('tel-cliente').value.replace(/\D/g, ''),
        endereco: document.getElementById('end-cliente').value,
        email: document.getElementById('email-cliente').value
    });
    salvar();
    e.target.reset();
    navegar('home');
});

function carregarClientesSelect() {
    const s = document.getElementById('select-cliente');
    if (!s) return;
    s.innerHTML = db.clientes.length ? '<option value="">Quem está comprando?</option>' : '<option>Cadastre um cliente primeiro</option>';
    db.clientes.forEach((c, i) => s.innerHTML += `<option value="${i}">${c.nome}</option>`);
}

// Registo de Venda (Onde definimos o Vencimento e Parcelas)
document.getElementById('form-venda').addEventListener('submit', (e) => {
    e.preventDefault();
    const idx = document.getElementById('select-cliente').value;
    if (idx === "") return;

    const cliente = db.clientes[idx];
    const isParcelado = document.getElementById('check-parcelado').checked;
    const parcelas = document.getElementById('qtd-vezes').value || 1;

    db.vendas.push({
        nome: cliente.nome,
        tel: cliente.tel,
        valor: parseFloat(document.getElementById('valor-venda').value),
        desc: document.getElementById('desc-venda').value,
        data: new Date().toLocaleDateString('pt-br'),
        vencimento: document.getElementById('vencimento-venda').value, // Vem da Venda agora
        parcelas: isParcelado ? parcelas : "À vista"
    });

    salvar();
    e.target.reset();
    document.getElementById('qtd-vezes').style.display = 'none';
    navegar('home');
});

function renderizarHistorico() {
    const container = document.getElementById('lista-historico');
    if (!container) return;
    container.innerHTML = db.vendas.length ? '' : '<p>Sem dívidas ativas.</p>';
    
    [...db.vendas].reverse().forEach((v, i) => {
        const indexReal = db.vendas.length - 1 - i;
        const msg = encodeURIComponent(`Olá ${v.nome}, lembrete da sua compra (${v.desc}). Valor: R$ ${v.valor.toFixed(2)}. Vence em: ${v.vencimento}`);
        
        container.innerHTML += `
            <div class="item-venda">
                <div>
                    <strong>${v.nome}</strong><br>
                    <small>Data: ${v.data} | Parcelas: ${v.parcelas}</small><br>
                    <small style="color:var(--accent); font-weight:bold">Vence em: ${v.vencimento}</small>
                </div>
                <div style="text-align:right">
                    <div style="color:var(--danger); font-weight:bold; font-size:1.1rem">R$ ${v.valor.toFixed(2)}</div>
                    <div class="actions">
                        <button class="btn-quitar" onclick="quitar(${indexReal})"><i class="fas fa-check"></i></button>
                        <a href="https://wa.me/55${v.tel}?text=${msg}" target="_blank" class="btn-wpp"><i class="fab fa-whatsapp"></i></a>
                    </div>
                </div>
            </div>`;
    });
}

function quitar(idx) {
    db.vendas.splice(idx, 1);
    salvar();
    renderizarHistorico();
    atualizarDashboard();
}

window.onload = () => {
    carregarDados();
    navegar('home');
};
