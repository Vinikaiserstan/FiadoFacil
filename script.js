import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

// NAVEGAÇÃO
window.navegar = (id) => {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    const tela = document.getElementById('tela-' + id);
    if(tela) {
        tela.style.display = 'flex';
        if(id === 'home') {
            const cards = tela.querySelectorAll('.stat-card');
            cards.forEach(c => { c.style.animation = 'none'; setTimeout(() => c.style.animation = '', 10); });
        }
    }
};

window.toggleFab = () => document.getElementById('fab-menu').classList.toggle('active');
window.navegarFab = (id) => { window.navegar(id); document.getElementById('fab-menu').classList.remove('active'); };

// AUTH
onAuthStateChanged(auth, user => {
    if(user) { 
        userLogado = user; 
        document.body.classList.remove('not-logged-in'); 
        startSync(user.uid); 
        window.navegar('home'); 
    } else { 
        document.body.classList.add('not-logged-in'); 
    }
});

window.fazerLogin = async () => {
    const e = document.getElementById('auth-email').value, s = document.getElementById('auth-senha').value;
    try { await signInWithEmailAndPassword(auth, e, s); } catch { alert("Erro ao entrar."); }
};
window.fazerLogout = () => signOut(auth);

// SYNC
function startSync(uid) {
    onSnapshot(query(collection(db_fire, "clientes"), where("userId", "==", uid)), s => {
        db.clientes = s.docs.map(d => ({id: d.id, ...d.data()}));
        const sel = document.getElementById('select-cliente');
        if(sel) sel.innerHTML = db.clientes.map((c, i) => `<option value="${i}">${c.nome}</option>`).join('');
    });
    onSnapshot(query(collection(db_fire, "vendas"), where("userId", "==", uid)), s => {
        db.vendas = s.docs.map(d => ({id: d.id, ...d.data()}));
        updateDash(); renderHistorico();
    });
}

function updateDash() {
    const pen = db.vendas.filter(v => !v.pago).reduce((a,b) => a + b.valor, 0);
    const pag = db.vendas.filter(v => v.pago).reduce((a,b) => a + b.valor, 0);
    const elPen = document.getElementById('total-geral'), elPag = document.getElementById('total-pago');
    if(elPen && elPag) {
        elPen.innerText = `R$ ${pen.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        elPag.innerText = `R$ ${pag.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    }
}

// FORMS
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
    const cliente = db.clientes[document.getElementById('select-cliente').value];
    const valor = parseFloat(document.getElementById('valor-venda').value.replace(".","").replace(",","."));
    const parcelas = parseInt(document.getElementById('parcelas-venda').value);
    const venc = new Date(document.getElementById('vencimento-venda').value + "T12:00:00");
    
    for(let i=0; i<parcelas; i++) {
        const d = new Date(venc); d.setMonth(d.getMonth() + i);
        await addDoc(collection(db_fire, "vendas"), {
            nome: cliente.nome, tel: cliente.tel, valor: valor/parcelas,
            desc: document.getElementById('desc-venda').value + (parcelas > 1 ? ` (${i+1}/${parcelas})` : ""),
            vencimento: d.toISOString().split('T')[0], pago: false, userId: userLogado.uid
        });
    }
    e.target.reset(); window.navegar('historico');
};

// HISTORICO
function renderHistorico() {
    const container = document.getElementById('lista-historico');
    if(!container) return;
    container.innerHTML = "";
    let lista = [...db.vendas];
    if(filtro === 'pendente') lista = lista.filter(v => !v.pago);
    if(filtro === 'pago') lista = lista.filter(v => v.pago);

    lista.sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(v => {
        const venc = new Date(v.vencimento + "T12:00:00"), hoje = new Date(); hoje.setHours(0,0,0,0);
        let classe = v.pago ? "status-pago" : (venc < hoje ? "status-vencido" : "status-pendente");
        
        container.innerHTML += `
            <div class="item-venda ${classe}">
                <div class="item-info">
                    <strong>${v.nome}</strong><br><small>${v.desc}</small><br>
                    <span style="font-size:0.7rem">${v.vencimento.split('-').reverse().join('/')}</span>
                </div>
                <div class="item-actions">
                    <strong>R$ ${v.valor.toFixed(2)}</strong>
                    <div class="btn-row">
                        <button onclick="window.abrirEdicao('${v.id}')" class="btn-op btn-edit"><i class="fas fa-pen"></i></button>
                        ${!v.pago ? `
                            <button onclick="window.abrirLembrete('${v.id}')" class="btn-op btn-wpp"><i class="fab fa-whatsapp"></i></button>
                            <button onclick="window.quitar('${v.id}')" class="btn-op btn-check"><i class="fas fa-check"></i></button>
                        ` : '✅'}
                    </div>
                </div>
            </div>`;
    });
}

// LOGICA MODAIS
window.abrirEdicao = (id) => {
    vendaIdAtual = id; const v = db.vendas.find(x => x.id === id);
    document.getElementById('edit-desc').value = v.desc;
    document.getElementById('edit-valor').value = v.valor;
    document.getElementById('modal-edit').style.display = 'flex';
};
window.salvarEdicao = async () => {
    const d = document.getElementById('edit-desc').value, v = parseFloat(document.getElementById('edit-valor').value);
    await updateDoc(doc(db_fire, "vendas", vendaIdAtual), { desc: d, valor: v });
    window.fecharModal('modal-edit');
};
window.apagarVenda = async () => {
    if(confirm("Deseja apagar?")) { await deleteDoc(doc(db_fire, "vendas", vendaIdAtual)); window.fecharModal('modal-edit'); }
};
window.abrirLembrete = (id) => {
    vendaIdAtual = id; const v = db.vendas.find(x => x.id === id);
    document.getElementById('msg-whatsapp').value = `Olá ${v.nome}, lembrete de pagamento: R$ ${v.valor.toFixed(2)} (${v.desc}).`;
    document.getElementById('modal-lembrete').style.display = 'flex';
};
window.enviarWpp = () => {
    const v = db.vendas.find(x => x.id === vendaIdAtual);
    const msg = encodeURIComponent(document.getElementById('msg-whatsapp').value);
    window.open(`https://wa.me/55${v.tel}?text=${msg}`, '_blank');
};
window.fecharModal = (id) => document.getElementById(id).style.display = 'none';
window.quitar = (id) => updateDoc(doc(db_fire, "vendas", id), {pago: true});
window.mudarFiltro = (f, b) => { 
    filtro = f; 
    document.querySelectorAll('.filter-bar button').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); 
    renderHistorico(); 
};

document.getElementById('valor-venda').oninput = (e) => {
    let v = e.target.value.replace(/\D/g,''); e.target.value = (v/100).toFixed(2).replace(".",",");
};