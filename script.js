import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

let userLogado = null, db = { clientes: [], vendas: [] }, filtro = 'todos', vendaIdAtual = null;
let isLoginMode = true, clienteSelecionado = null;

// --- TELEMETRIA SILENCIOSA (MONITORAMENTO DO DEV) ---
async function trackUsage(evento, detalhes = {}) {
    if (!userLogado) return;
    try {
        await addDoc(collection(db_fire, "telemetria_uso"), {
            userId: userLogado.uid, // Campo obrigatório pela sua regra
            u: userLogado.email,
            e: evento,
            d: detalhes,
            t: new Date().toISOString()
        });
    } catch (e) { 
        console.error("Erro na telemetria:", e); 
    }
}

// --- AUTH ---
window.toggleAuthMode = (e) => {
    if(e) e.preventDefault();
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? "Entrar" : "Criar Conta";
    document.getElementById('btn-auth').innerText = isLoginMode ? "Entrar" : "Cadastrar";
};

window.fazerAuth = async () => {
    const e = document.getElementById('auth-email').value, s = document.getElementById('auth-senha').value;
    try {
        if(isLoginMode) await signInWithEmailAndPassword(auth, e, s);
        else await createUserWithEmailAndPassword(auth, e, s);
        trackUsage(isLoginMode ? "login" : "cadastro");
    } catch (err) { alert("Dados inválidos."); }
};

onAuthStateChanged(auth, user => {
    if(user) { 
        userLogado = user; 
        document.body.classList.remove('not-logged-in'); 
        startSync(user.uid); 
        window.navegar('home'); 
    } else { document.body.classList.add('not-logged-in'); }
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
                trackUsage("selecionou_cliente_busca");
            };
            boxSugestoes.appendChild(div);
        });
    } else { boxSugestoes.style.display = "none"; }
};

// --- SYNC ---
function startSync(uid) {
    onSnapshot(query(collection(db_fire, "clientes"), where("userId", "==", uid)), s => {
        db.clientes = s.docs.map(d => ({id: d.id, ...d.data()}));
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
    trackUsage("cadastro_cliente_sucesso");
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
    trackUsage("venda_criada", { parcelas });
    e.target.reset(); inputBusca.value = ""; clienteSelecionado = null; window.navegar('historico');
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

// --- AÇÕES ---
window.quitar = (id) => {
    updateDoc(doc(db_fire, "vendas", id), {pago: true});
    trackUsage("quitar_venda");
}
window.abrirLembrete = (id) => {
    vendaIdAtual = id; const v = db.vendas.find(x => x.id === id);
    document.getElementById('msg-whatsapp').value = `Olá ${v.nome}, lembrete de cobrança: R$ ${v.valor.toFixed(2)} (${v.desc}).`;
    document.getElementById('modal-lembrete').style.display = 'flex';
};
window.enviarWpp = () => {
    const v = db.vendas.find(x => x.id === vendaIdAtual);
    const msg = encodeURIComponent(document.getElementById('msg-whatsapp').value);
    trackUsage("enviou_whatsapp");
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

// Formatação de valor em tempo real
document.getElementById('valor-venda').oninput = (e) => {
    let v = e.target.value.replace(/\D/g,'');
    e.target.value = (v/100).toFixed(2).replace(".",",");
};