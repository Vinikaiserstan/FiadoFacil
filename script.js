import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD3bR5q-Lho80p_XAIhsZtolrM8K0-l7EM",
    authDomain: "fiadofacil-6b475.firebaseapp.com",
    projectId: "fiadofacil-6b475",
    storageBucket: "fiadofacil-6b475.firebasestorage.app",
    messagingSenderId: "868058937936",
    appId: "1:868058937936:web:a3511478c0f30e82bbaf55"
};

const app = initializeApp(firebaseConfig);
const db_fire = getFirestore(app);
const auth = getAuth(app);

let userLogado = null, db = { clientes: [], vendas: [] }, filtro = 'todos', vendaIdAtual = null, clienteIdAtual = null;
let isLoginMode = true, clienteSelecionado = null;

// --- TELEMETRIA SILENCIOSA ---
async function trackUsage(evento, detalhes = {}) {
    if (!userLogado) return;
    try {
        await addDoc(collection(db_fire, "telemetria_uso"), {
            userId: userLogado.uid,
            u: userLogado.email,
            e: evento,
            d: detalhes,
            t: new Date().toISOString()
        });
    } catch (e) { console.error("Erro na telemetria:", e); }
}

// --- AUTH ---
window.setAuthMode = (modo, e) => {
    if(e) e.preventDefault();
    isLoginMode = modo === 'login';
    document.getElementById('form-login').style.display = isLoginMode ? 'block' : 'none';
    document.getElementById('form-cadastro').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('form-verificacao').style.display = 'none';
    document.getElementById('tab-login').classList.toggle('active', isLoginMode);
    document.getElementById('tab-cadastro').classList.toggle('active', !isLoginMode);
    document.querySelector('.auth-tabs').style.display = 'flex';
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
};

window.toggleAuthMode = (e) => {
    if(e) e.preventDefault();
    window.setAuthMode(isLoginMode ? 'cadastro' : 'login', null);
};

window.toggleSenhaVis = (inputId, btn) => {
    const inp = document.getElementById(inputId);
    const visible = inp.type === 'text';
    inp.type = visible ? 'password' : 'text';
    btn.querySelector('i').className = visible ? 'fas fa-eye' : 'fas fa-eye-slash';
};

window.fazerLogin = async () => {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    try {
        const cred = await signInWithEmailAndPassword(auth, email, senha);
        trackUsage('login');
        // Login de conta existente: acesso direto, sem exigir verificação
        userLogado = cred.user;
        document.body.classList.remove('not-logged-in');
        startSync(cred.user.uid);
        window.navegar('home');
    } catch (err) { alert('E-mail ou senha incorretos.'); }
};

window.fazerCadastro = async () => {
    const nome = document.getElementById('cad-nome').value.trim();
    const tel = document.getElementById('cad-tel').value.replace(/\D/g,'');
    const estabelecimento = document.getElementById('cad-estabelecimento').value.trim();
    const rua = document.getElementById('cad-rua').value.trim();
    const bairro = document.getElementById('cad-bairro').value.trim();
    const email = document.getElementById('cad-email').value.trim();
    const senha = document.getElementById('cad-senha').value;
    const confirma = document.getElementById('cad-senha-confirm').value;
    const erroDiv = document.getElementById('cad-erro');

    erroDiv.style.display = 'none';
    if (!nome)           { erroDiv.textContent = 'Informe seu nome completo.'; erroDiv.style.display = 'block'; return; }
    if (!tel)            { erroDiv.textContent = 'Informe seu WhatsApp/telefone.'; erroDiv.style.display = 'block'; return; }
    if (!estabelecimento){ erroDiv.textContent = 'Informe o nome do estabelecimento.'; erroDiv.style.display = 'block'; return; }
    if (!rua)            { erroDiv.textContent = 'Informe a rua e número.'; erroDiv.style.display = 'block'; return; }
    if (!bairro)         { erroDiv.textContent = 'Informe o bairro.'; erroDiv.style.display = 'block'; return; }
    if (!email)          { erroDiv.textContent = 'Informe um e-mail válido.'; erroDiv.style.display = 'block'; return; }
    if (senha.length < 6){ erroDiv.textContent = 'A senha deve ter pelo menos 6 caracteres.'; erroDiv.style.display = 'block'; return; }
    if (senha !== confirma){ erroDiv.textContent = 'As senhas não coincidem.'; erroDiv.style.display = 'block'; return; }

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        await sendEmailVerification(cred.user);
        await addDoc(collection(db_fire, 'perfis'), {
            userId: cred.user.uid, nome, tel, estabelecimento,
            endereco: { rua, bairro },
            email, criadoEm: new Date().toISOString()
        });
        trackUsage('cadastro', { nome, estabelecimento });

        // Mostra tela de verificação
        document.getElementById('verif-email-label').textContent = email;
        mostrarVerificacao();
        iniciarPollingVerificacao();
    } catch (err) {
        erroDiv.textContent = err.code === 'auth/email-already-in-use' ? 'Este e-mail já está cadastrado.' : 'Erro ao criar conta. Tente novamente.';
        erroDiv.style.display = 'block';
    }
};

// --- VERIFICAÇÃO DE E-MAIL ---
let pollingInterval = null;

function mostrarVerificacao() {
    document.getElementById('form-login').style.display = 'none';
    document.getElementById('form-cadastro').style.display = 'none';
    document.getElementById('form-verificacao').style.display = 'block';
    document.querySelector('.auth-tabs').style.display = 'none';
}

function iniciarPollingVerificacao() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
        const user = auth.currentUser;
        if (!user) { clearInterval(pollingInterval); return; }
        await user.reload();
        if (user.emailVerified) {
            clearInterval(pollingInterval);
            document.querySelector('.auth-tabs').style.display = 'flex';
            // onAuthStateChanged vai assumir a partir daqui
        }
    }, 3000);
}

window.reenviarVerificacao = async () => {
    const user = auth.currentUser;
    if (user) {
        await sendEmailVerification(user);
        alert('E-mail reenviado! Verifique sua caixa de entrada.');
    }
};

window.cancelarVerificacao = async () => {
    if (pollingInterval) clearInterval(pollingInterval);
    await signOut(auth);
    document.querySelector('.auth-tabs').style.display = 'flex';
    window.setAuthMode('cadastro', null);
};

window.fazerAuth = async () => { window.fazerLogin(); };

onAuthStateChanged(auth, user => {
    if(user) {
        // Se o polling de verificação está ativo, significa que é um cadastro novo aguardando confirmação
        if (pollingInterval) return;
        userLogado = user;
        document.body.classList.remove('not-logged-in');
        startSync(user.uid);
        window.navegar('home');
    } else {
        document.body.classList.add('not-logged-in');
    }
});

window.fazerLogout = () => {
    trackUsage("logout");
    signOut(auth);
}

// --- NAVEGAÇÃO ---
window.navegar = (id) => {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    const tela = document.getElementById('tela-' + id);
    if(tela) {
        tela.style.display = 'flex';
        trackUsage("navegou", { tela: id });
    }
};

window.toggleFab = () => document.getElementById('fab-menu').classList.toggle('active');
window.navegarFab = (id) => { window.navegar(id); document.getElementById('fab-menu').classList.remove('active'); };

// --- AUTOCOMPLETE CLIENTES ---
const inputBusca = document.getElementById('busca-cliente');
const boxSugestoes = document.getElementById('sugestoes-cliente');

if(inputBusca) {
    inputBusca.oninput = () => {
        const termo = inputBusca.value.toLowerCase();
        boxSugestoes.innerHTML = "";
        clienteSelecionado = null;
        if (termo.length < 1) { boxSugestoes.style.display = "none"; return; }
        
        const filtrados = db.clientes.filter(c => c.nome.toLowerCase().includes(termo));
        if (filtrados.length > 0) {
            boxSugestoes.style.display = "block";
            filtrados.forEach(c => {
                const div = document.createElement('div');
                div.className = "sugestao-item";
                div.innerText = c.nome;
                div.onclick = () => {
                    inputBusca.value = c.nome;
                    clienteSelecionado = c;
                    boxSugestoes.style.display = "none";
                };
                boxSugestoes.appendChild(div);
            });
        } else { boxSugestoes.style.display = "none"; }
    };
}

// --- SYNC ---
function startSync(uid) {
    onSnapshot(query(collection(db_fire, "clientes"), where("userId", "==", uid)), s => {
        db.clientes = s.docs.map(d => ({id: d.id, ...d.data()}));
        renderTabelaClientes();
    });
    onSnapshot(query(collection(db_fire, "vendas"), where("userId", "==", uid)), s => {
        db.vendas = s.docs.map(d => ({id: d.id, ...d.data()}));
        const pen = db.vendas.filter(v => !v.pago).reduce((a,b) => a + b.valor, 0);
        const pag = db.vendas.filter(v => v.pago).reduce((a,b) => a + b.valor, 0);
        document.getElementById('total-geral').innerText = `R$ ${pen.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('total-pago').innerText = `R$ ${pag.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        renderHistorico();
    });
}

// --- FORMS ---
document.getElementById('form-cliente').onsubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db_fire, "clientes"), {
        nome: document.getElementById('nome-cliente').value,
        tel: document.getElementById('tel-cliente').value.replace(/\D/g, ''),
        userId: userLogado.uid
    });
    e.target.reset(); alert("Cliente Salvo!");
};

document.getElementById('form-venda').onsubmit = async (e) => {
    e.preventDefault();
    if (!clienteSelecionado) return alert("Selecione um cliente da lista!");
    
    const valor = parseFloat(document.getElementById('valor-venda').value.replace(".","").replace(",","."));
    const parcelas = parseInt(document.getElementById('parcelas-venda').value);
    const venc = new Date(document.getElementById('vencimento-venda').value + "T12:00:00");
    
    for(let i=0; i<parcelas; i++) {
        const d = new Date(venc); d.setMonth(d.getMonth() + i);
        await addDoc(collection(db_fire, "vendas"), {
            nome: clienteSelecionado.nome, tel: clienteSelecionado.tel, valor: valor/parcelas,
            desc: document.getElementById('desc-venda').value + (parcelas > 1 ? ` (${i+1}/${parcelas})` : ""),
            vencimento: d.toISOString().split('T')[0], pago: false, userId: userLogado.uid
        });
    }
    e.target.reset(); inputBusca.value = ""; clienteSelecionado = null; window.navegar('historico');
};

// --- GESTÃO DE CLIENTES ---
function renderTabelaClientes() {
    const container = document.getElementById('tabela-clientes');
    if(!container) return;
    container.innerHTML = "";
    db.clientes.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(c => {
        container.innerHTML += `
            <div class="item-venda">
                <div class="item-info">
                    <strong class="venda-nome">${c.nome}</strong>
                    <small class="venda-desc"><i class="fab fa-whatsapp"></i> ${c.tel}</small>
                </div>
                <div class="item-actions">
                    <button onclick="window.abrirEdicaoCliente('${c.id}')" class="btn-op btn-edit"><i class="fas fa-user-pen"></i></button>
                </div>
            </div>`;
    });
}

window.abrirEdicaoCliente = (id) => {
    clienteIdAtual = id;
    const c = db.clientes.find(x => x.id === id);
    document.getElementById('edit-cliente-nome').value = c.nome;
    document.getElementById('edit-cliente-tel').value = c.tel;
    document.getElementById('modal-edit-cliente').style.display = 'flex';
};

window.salvarEdicaoCliente = async () => {
    await updateDoc(doc(db_fire, "clientes", clienteIdAtual), { 
        nome: document.getElementById('edit-cliente-nome').value, 
        tel: document.getElementById('edit-cliente-tel').value.replace(/\D/g, '')
    });
    window.fecharModal('modal-edit-cliente');
};

window.apagarCliente = async () => {
    if(confirm("Deseja excluir este cliente?")) { 
        await deleteDoc(doc(db_fire, "clientes", clienteIdAtual)); 
        window.fecharModal('modal-edit-cliente'); 
    }
};

// --- HISTÓRICO ---
function renderHistorico() {
    const container = document.getElementById('lista-historico');
    if(!container) return; container.innerHTML = "";
    let lista = [...db.vendas];
    if(filtro === 'pendente') lista = lista.filter(v => !v.pago);
    if(filtro === 'pago') lista = lista.filter(v => v.pago);
    
    lista.sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(v => {
        const venc = new Date(v.vencimento + "T12:00:00"), hoje = new Date(); hoje.setHours(0,0,0,0);
        let classe = v.pago ? "status-pago" : (venc < hoje ? "status-vencido" : "status-pendente");
        container.innerHTML += `
            <div class="item-venda ${classe}">
                <div class="item-info">
                    <span class="venda-data">${v.vencimento.split('-').reverse().join('/')}</span>
                    <strong class="venda-nome">${v.nome}</strong>
                    <small class="venda-desc">${v.desc}</small>
                </div>
                <div class="item-actions">
                    <span class="venda-valor">R$ ${v.valor.toFixed(2)}</span>
                    <div class="btn-row">
                        <button onclick="window.abrirEdicao('${v.id}')" class="btn-op btn-edit"><i class="fas fa-pen"></i></button>
                        ${!v.pago ? `
                            <button onclick="window.abrirLembrete('${v.id}')" class="btn-op btn-wpp"><i class="fab fa-whatsapp"></i></button>
                            <button onclick="window.quitar('${v.id}')" class="btn-op btn-check"><i class="fas fa-check"></i></button>
                        ` : '<span class="pago-label">PAGO</span>'}
                    </div>
                </div>
            </div>`;
    });
}

// --- AÇÕES VENDAS ---
window.quitar = (id) => updateDoc(doc(db_fire, "vendas", id), {pago: true});
window.abrirLembrete = (id) => {
    vendaIdAtual = id; const v = db.vendas.find(x => x.id === id);
    document.getElementById('msg-whatsapp').value = `Olá ${v.nome}, lembrete de cobrança: R$ ${v.valor.toFixed(2)} (${v.desc}).`;
    document.getElementById('modal-lembrete').style.display = 'flex';
};
window.enviarWpp = () => {
    const v = db.vendas.find(x => x.id === vendaIdAtual);
    const msg = encodeURIComponent(document.getElementById('msg-whatsapp').value);
    window.open(`https://wa.me/55${v.tel}?text=${msg}`, '_blank');
};
window.abrirEdicao = (id) => {
    vendaIdAtual = id; const v = db.vendas.find(x => x.id === id);
    document.getElementById('edit-desc').value = v.desc;
    document.getElementById('edit-valor').value = v.valor;
    document.getElementById('modal-edit').style.display = 'flex';
};
window.salvarEdicao = async () => {
    await updateDoc(doc(db_fire, "vendas", vendaIdAtual), { 
        desc: document.getElementById('edit-desc').value, 
        valor: parseFloat(document.getElementById('edit-valor').value) 
    });
    window.fecharModal('modal-edit');
};
window.apagarVenda = async () => {
    if(confirm("Deseja apagar esta cobrança?")) { 
        await deleteDoc(doc(db_fire, "vendas", vendaIdAtual)); 
        window.fecharModal('modal-edit'); 
    }
};
window.fecharModal = (id) => document.getElementById(id).style.display = 'none';
window.mudarFiltro = (f, b) => { 
    filtro = f; 
    document.querySelectorAll('.filter-bar button').forEach(x => x.classList.remove('active')); 
    b.classList.add('active'); 
    renderHistorico(); 
};

// Formatação de valor
const inputValor = document.getElementById('valor-venda');
if(inputValor) {
    inputValor.oninput = (e) => {
        let v = e.target.value.replace(/\D/g,'');
        e.target.value = (v/100).toFixed(2).replace(".",",");
    };
}