let db = { clientes: [], vendas: [] };

function salvar() { localStorage.setItem('fiado_db', JSON.stringify(db)); }
function carregar() { const m = localStorage.getItem('fiado_db'); if(m) db = JSON.parse(m); }

function navegar(id) {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    document.getElementById('tela-'+id).style.display = 'flex';
    if(id === 'home') atualizarDashboard();
    if(id === 'venda') carregarSelectClientes();
    if(id === 'historico') renderizarHistorico();
}

function atualizarDashboard() {
    const pendente = db.vendas.filter(v => !v.pago).reduce((acc, v) => acc + v.valor, 0);
    const pago = db.vendas.filter(v => v.pago).reduce((acc, v) => acc + v.valor, 0);
    document.getElementById('total-geral').innerText = `R$ ${pendente.toFixed(2)}`;
    document.getElementById('total-pago').innerText = `R$ ${pago.toFixed(2)}`;
}

document.getElementById('form-cliente').onsubmit = (e) => {
    e.preventDefault();
    db.clientes.push({ 
        nome: document.getElementById('nome-cliente').value, 
        tel: document.getElementById('tel-cliente').value.replace(/\D/g,''),
        email: document.getElementById('email-cliente').value,
        endereco: document.getElementById('end-cliente').value,
        nascimento: document.getElementById('nasc-cliente').value
    });
    salvar();
    e.target.reset();
    alert('Cliente cadastrado!');
    navegar('home');
};

function carregarSelectClientes() {
    const s = document.getElementById('select-cliente');
    s.innerHTML = '<option value="">Selecione o Cliente</option>' + 
                  db.clientes.map((c, i) => `<option value="${i}">${c.nome}</option>`).join('');
}

document.getElementById('form-venda').onsubmit = (e) => {
    e.preventDefault();
    const c = db.clientes[document.getElementById('select-cliente').value];
    db.vendas.push({ 
        nome: c.nome, tel: c.tel, valor: parseFloat(document.getElementById('valor-venda').value), 
        desc: document.getElementById('desc-venda').value, vencimento: document.getElementById('vencimento-venda').value, pago: false 
    });
    salvar(); e.target.reset(); navegar('home');
};

function renderizarHistorico() {
    const container = document.getElementById('lista-historico');
    container.innerHTML = "";
    const hoje = new Date(); hoje.setHours(0,0,0,0);

    db.vendas.forEach((v, i) => {
        const venc = new Date(v.vencimento); venc.setHours(0,0,0,0);
        const diffDays = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
        
        let deveNotificar = false;
        let motivo = "";
        
        if (!v.pago) {
            if (diffDays === 7) { deveNotificar = true; motivo = "FALTA 1 SEMANA"; }
            else if (diffDays === 0) { deveNotificar = true; motivo = "VENCE HOJE"; }
            else if (diffDays < 0 && Math.abs(diffDays) % 7 === 0) { deveNotificar = true; motivo = "COBRANÇA SEMANAL"; }
        }

        const msg = encodeURIComponent(`Olá ${v.nome}, lembrete de sua conta: R$ ${v.valor.toFixed(2)}. Status: ${motivo || 'Pendente'}`);

        container.innerHTML += `
            <div class="item-venda ${deveNotificar ? 'notificar-agora' : ''}">
                <div>
                    <strong>${v.nome}</strong> ${v.pago ? '✅' : ''}<br>
                    <small>${v.desc} | Vence: ${v.vencimento}</small><br>
                    ${deveNotificar ? `<span class="badge">${motivo}</span>` : ''}
                </div>
                <div style="text-align:right">
                    <strong>R$ ${v.valor.toFixed(2)}</strong><br>
                    <div style="display:flex; gap:10px; margin-top:10px; justify-content: flex-end;">
                        ${!v.pago ? `<button onclick="quitar(${i})" style="cursor:pointer; background:#eee; padding:5px 10px; border-radius:5px;">✓</button>` : ''}
                        <a href="https://wa.me/55${v.tel}?text=${msg}" target="_blank" class="btn-wpp"><i class="fab fa-whatsapp"></i></a>
                    </div>
                </div>
            </div>`;
    });
}

function quitar(i) { db.vendas[i].pago = true; salvar(); renderizarHistorico(); atualizarDashboard(); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }
window.onload = () => { carregar(); navegar('home'); };
