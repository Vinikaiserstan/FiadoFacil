// 1. DATABASE
let db = { clientes: [], vendas: [] };

function carregarDados() {
    const memoria = localStorage.getItem('fiado_db');
    if (memoria) db = JSON.parse(memoria);
}

function salvar() {
    localStorage.setItem('fiado_db', JSON.stringify(db));
}

document.getElementById('check-parcelado')?.addEventListener('change', function() {
    document.getElementById('qtd-vezes').style.display = this.checked ? 'block' : 'none';
});

// 2. NAVEGAÇÃO
function navegar(telaId) {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    const destino = document.getElementById('tela-' + telaId);
    if (destino) destino.style.display = 'flex';
    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('active');

    if (telaId === 'home') atualizarDashboard();
    if (telaId === 'venda') carregarClientesSelect();
    if (telaId === 'historico') renderizarHistorico();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

// 3. LÓGICA DE NOTIFICAÇÕES (O CORAÇÃO DO SISTEMA)
function calcularStatusNotificacao(dataVencimento) {
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const venc = new Date(dataVencimento);
    venc.setHours(0,0,0,0);
    
    // Diferença em milissegundos convertida para dias
    const diffTime = venc - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 7) return { tipo: 'proximo', msg: "Falta 1 semana para o vencimento." };
    if (diffDays === 0) return { tipo: 'hoje', msg: "Vence HOJE!" };
    if (diffDays < 0) {
        const semanasAtraso = Math.abs(Math.floor(diffDays / 7));
        return { tipo: 'atrasado', msg: `Atrasado há ${Math.abs(diffDays)} dias. Cobrança semanal ativa.` };
    }
    return { tipo: 'normal', msg: "" };
}

function atualizarDashboard() {
    const pendente = db.vendas.filter(v => !v.pago).reduce((acc, v) => acc + v.valor, 0);
    const pago = db.vendas.filter(v => v.pago).reduce((acc, v) => acc + v.valor, 0);
    document.getElementById('total-geral').textContent = `R$ ${pendente.toFixed(2).replace('.', ',')}`;
    document.getElementById('total-pago').textContent = `R$ ${pago.toFixed(2).replace('.', ',')}`;
}

// CADASTRO
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

// VENDA
document.getElementById('form-venda').addEventListener('submit', (e) => {
    e.preventDefault();
    const idx = document.getElementById('select-cliente').value;
    if (idx === "") return;
    const cliente = db.clientes[idx];
    
    db.vendas.push({
        nome: cliente.nome,
        tel: cliente.tel,
        valor: parseFloat(document.getElementById('valor-venda').value),
        desc: document.getElementById('desc-venda').value,
        data: new Date().toLocaleDateString('pt-br'),
        vencimento: document.getElementById('vencimento-venda').value, // Formato YYYY-MM-DD
        parcelas: document.getElementById('check-parcelado').checked ? document.getElementById('qtd-vezes').value : "À vista",
        pago: false
    });
    salvar();
    e.target.reset();
    document.getElementById('qtd-vezes').style.display = 'none';
    navegar('home');
});

// RENDERIZAR HISTÓRICO COM LOGICA DE COBRANÇA
function renderizarHistorico() {
    const container = document.getElementById('lista-historico');
    if (!container) return;
    container.innerHTML = db.vendas.length ? '' : '<p>Sem registros.</p>';
    
    [...db.vendas].reverse().forEach((v, i) => {
        const indexReal = db.vendas.length - 1 - i;
        let classeAlerta = v.pago ? 'status-pago' : '';
        let badgeHTML = '';
        let textoCobrança = `Olá ${v.nome}, lembrete da sua conta de R$ ${v.valor.toFixed(2)}.`;

        if (!v.pago) {
            const status = calcularStatusNotificacao(v.vencimento);
            classeAlerta = status.tipo;
            if (status.msg) {
                badgeHTML = `<span class="badge-alerta">${status.msg}</span>`;
                textoCobrança = `⚠️ COBRANÇA: ${v.nome}, sua conta de R$ ${v.valor.toFixed(2)} ${status.tipo === 'atrasado' ? 'está ATRASADA.' : 'vence em breve.'} Por favor, verifique o pagamento.`;
            }
        }

        const msgWpp = encodeURIComponent(textoCobrança);
        
        container.innerHTML += `
            <div class="item-venda ${classeAlerta}">
                <div class="info-venda">
                    <strong>${v.nome} ${v.pago ? '✅' : ''}</strong><br>
                    <small>${v.data} | ${v.desc}</small><br>
                    <small>Vencimento: ${v.vencimento} | ${v.parcelas}x</small><br>
                    ${badgeHTML}
                </div>
                <div class="valor-acoes">
                    <div class="valor-text">R$ ${v.valor.toFixed(2)}</div>
                    <div class="actions">
                        ${!v.pago ? `<button class="btn-quitar" onclick="quitar(${indexReal})"><i class="fas fa-check"></i></button>` : ''}
                        <a href="https://wa.me/55${v.tel}?text=${msgWpp}" target="_blank" class="btn-wpp"><i class="fab fa-whatsapp"></i></a>
                    </div>
                </div>
            </div>`;
    });
}

function quitar(idx) {
    db.vendas[idx].pago = true;
    salvar();
    renderizarHistorico();
    atualizarDashboard();
}

window.onload = () => {
    carregarDados();
    navegar('home');
};
