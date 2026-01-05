/**
 * FiadoFácil - Lógica da Aplicação
 * Gestão de dados via LocalStorage
 */

// 1. INICIALIZAÇÃO DE DADOS
// Tenta carregar os dados do navegador; se não existirem, cria uma estrutura vazia.
let db = JSON.parse(localStorage.getItem('fiado_db')) || { clientes: [], vendas: [] };

// 2. CONTROLO DA SIDEBAR (MOBILE)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

// 3. NAVEGAÇÃO ENTRE TELAS
/**
 * @param {string} telaId - O ID da secção que deve ser exibida
 */
function navegar(telaId) {
    // Esconder todas as secções com a classe 'tela'
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    
    // Mostrar a secção desejada
    const telaDestino = document.getElementById('tela-' + telaId);
    if (telaDestino) {
        telaDestino.style.display = 'flex'; // Usamos flex para manter o alinhamento centralizado definido no CSS
    }
    
    // Se estivermos em ecrãs pequenos, fecha a sidebar automaticamente após clicar
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('active');
    }

    // Executar funções específicas de carregamento para cada tela
    if (telaId === 'home') atualizarDashboard();
    if (telaId === 'venda') carregarListaClientesParaVenda();
    if (telaId === 'historico') renderizarHistorico();
}

// 4. PERSISTÊNCIA DE DADOS
function salvarNoStorage() {
    localStorage.setItem('fiado_db', JSON.stringify(db));
}

// 5. GESTÃO DE CLIENTES
document.getElementById('form-cliente').addEventListener('submit', (e) => {
    e.preventDefault();

    const nome = document.getElementById('nome-cliente').value;
    const tel = document.getElementById('tel-cliente').value.replace(/\D/g, ''); // Remove caracteres não numéricos

    // Criar novo objeto de cliente
    const novoCliente = {
        id: Date.now(), // ID único baseado no timestamp
        nome: nome,
        tel: tel
    };

    db.clientes.push(novoCliente);
    salvarNoStorage();

    alert('Cliente registado com sucesso!');
    e.target.reset(); // Limpa o formulário
    navegar('home');  // Volta para o dashboard
});

// 6. GESTÃO DE VENDAS (FIADO)
function carregarListaClientesParaVenda() {
    const select = document.getElementById('select-cliente');
    
    if (db.clientes.length === 0) {
        select.innerHTML = '<option value="">Cadastre um cliente primeiro</option>';
        return;
    }

    select.innerHTML = '<option value="">Selecione o Cliente</option>';
    db.clientes.forEach((cliente, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = cliente.nome;
        select.appendChild(option);
    });
}

document.getElementById('form-venda').addEventListener('submit', (e) => {
    e.preventDefault();

    const indexCliente = document.getElementById('select-cliente').value;
    const valor = parseFloat(document.getElementById('valor-venda').value);
    const descricao = document.getElementById('desc-venda').value;

    if (indexCliente === "") {
        alert("Por favor, selecione um cliente.");
        return;
    }

    const cliente = db.clientes[indexCliente];

    // Criar objeto da venda
    const novaVenda = {
        clienteNome: cliente.nome,
        clienteTel: cliente.tel,
        valor: valor,
        descricao: descricao,
        data: new Date().toLocaleDateString('pt-PT')
    };

    db.vendas.push(novaVenda);
    salvarNoStorage();

    alert('Venda de fiado registada!');
    e.target.reset();
    navegar('home');
});

// 7. DASHBOARD E HISTÓRICO
function atualizarDashboard() {
    // Soma o valor de todas as vendas pendentes no array
    const totalPendente = db.vendas.reduce((acumulador, venda) => acumulador + venda.valor, 0);
    
    const elementoTotal = document.getElementById('total-geral');
    if (elementoTotal) {
        elementoTotal.textContent = `R$ ${totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
}

function renderizarHistorico() {
    const container = document.getElementById('lista-historico');
    container.innerHTML = ''; // Limpa a lista atual

    if (db.vendas.length === 0) {
        container.innerHTML = '<p style="color: #64748b; margin-top: 20px;">Nenhum registo de fiado encontrado.</p>';
        return;
    }

    // Ordenar para mostrar as vendas mais recentes primeiro
    const vendasInvertidas = [...db.vendas].reverse();

    vendasInvertidas.forEach((venda, index) => {
        // Criar a mensagem de cobrança para o WhatsApp
        const mensagemParaWpp = `Olá ${venda.clienteNome}, passando para lembrar da sua pendência no valor de R$ ${venda.valor.toFixed(2)} referente a: ${venda.descricao}.`;
        const urlWpp = `https://wa.me/55${venda.clienteTel}?text=${encodeURIComponent(mensagemParaWpp)}`;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-venda';
        itemDiv.innerHTML = `
            <div>
                <strong style="display: block; font-size: 1.1rem;">${venda.clienteNome}</strong>
                <small style="color: #64748b;">
                    <i class="far fa-calendar-alt"></i> ${venda.data} - ${venda.descricao}
                </small>
            </div>
            <div style="text-align: right;">
                <div style="color: #ef4444; font-weight: 700; font-size: 1.2rem; margin-bottom: 8px;">
                    R$ ${venda.valor.toFixed(2)}
                </div>
                <a href="${urlWpp}" target="_blank" class="btn-wpp">
                    <i class="fab fa-whatsapp"></i> Cobrar
                </a>
            </div>
        `;
        container.appendChild(itemDiv);
    });
}

// 8. INICIALIZAÇÃO AO CARREGAR A PÁGINA
// Garante que o dashboard é atualizado assim que o utilizador abre o site
window.onload = () => {
    atualizarDashboard();
};