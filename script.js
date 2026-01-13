import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

let userLogado = null;
let db = { clientes: [], vendas: [] };
let filtro = 'todos';
let chartInstance = null;

// NAVEGAÇÃO
window.navegar = (id) => {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    document.getElementById('tela-' + id).style.display = 'flex';
    if(id === 'home') setTimeout(renderChart, 200);
};

// AUTH
window.toggleAuthMode = () => {
    const btn = document.getElementById('btn-auth');
    btn.innerText = btn.innerText === "Entrar no Sistema" ? "Criar Minha Conta" : "Entrar no Sistema";
};
window.fazerLogin = async () => {
    const e = document.getElementById('auth-email').value;
    const s = document.getElementById('auth-senha').value;
    const mode = document.getElementById('btn-auth').innerText;
    try {
        if(mode === "Entrar no Sistema") await signInWithEmailAndPassword(auth, e, s);
        else await createUserWithEmailAndPassword(auth, e, s);
    } catch (err) { alert("Erro na autenticação!"); }
};
window.fazerLogout = () => signOut(auth);

onAuthStateChanged(auth, user => {
    if(user) {
        userLogado = user;
        document.body.classList.remove('not-logged-in');
        startSync(user.uid);
        window.navegar('home');
    } else { document.body.classList.add('not-logged-in'); }
});

function startSync(uid) {
    onSnapshot(query(collection(db_fire, "clientes"), where("userId", "==", uid)), s => {
        db.clientes = s.docs.map(d => ({id: d.id, ...d.data()}));
        const sel = document.getElementById('select-cliente');
        sel.innerHTML = '<option value="">Selecione o Cliente</option>' + 
            db.clientes.map((c, i) => `<option value="${i}">${c.nome}</option>`).join('');
    });
    onSnapshot(query(collection(db_fire, "vendas"), where("userId", "==", uid)), s => {
        db.vendas = s.docs.map(d => ({id: d.id, ...d.data()}));
        updateDash();
        renderHistorico();
        renderChart();
    });
}

// CLIENTE
document.getElementById('form-cliente').onsubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db_fire, "clientes"), {
        nome: document.getElementById('nome-cliente').value,
        email: document.getElementById('email-cliente').value,
        tel: document.getElementById('tel-cliente').value.replace(/\D/g, ''),
        userId: userLogado.uid
    });
    e.target.reset();
    alert("Cliente Salvo!");
};

// VENDA + PARCELAMENTO
document.getElementById('form-venda').onsubmit = async (e) => {
    e.preventDefault();
    const c = db.clientes[document.getElementById('select-cliente').value];
    const total = parseFloat(document.getElementById('valor-venda').value.replace(",", "."));
    const parcelas = parseInt(document.getElementById('parcelas-venda').value);
    const dataBase = new Date(document.getElementById('vencimento-venda').value + "T12:00:00");

    for(let i = 0; i < parcelas; i++) {
        const d = new Date(dataBase); d.setMonth(d.getMonth() + i);
        await addDoc(collection(db_fire, "vendas"), {
            nome: c.nome, tel: c.tel, valor: total / parcelas,
            desc: `${document.getElementById('desc-venda').value} (${i+1}/${parcelas})`,
            vencimento: d.toISOString().split('T')[0],
            pago: false, userId: userLogado.uid, dataCriacao: new Date().toISOString()
        });
    }
    e.target.reset();
    window.navegar('historico');
};

function renderHistorico() {
    const container = document.getElementById('lista-historico');
    container.innerHTML = "";
    let lista = db.vendas;
    if(filtro === 'pendente') lista = db.vendas.filter(v => !v.pago);
    if(filtro === 'pago') lista = db.vendas.filter(v => v.pago);

    lista.sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(v => {
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const venc = new Date(v.vencimento + "T12:00:00");
        let classeStatus = v.pago ? "status-pago" : (venc < hoje ? "status-vencido" : "status-pendente");
        
        const msg = `Olá ${v.nome}, lembrete de cobrança: ${v.desc} no valor de R$ ${v.valor.toFixed(2)}. Vencimento: ${v.vencimento.split('-').reverse().join('/')}`;

        container.innerHTML += `
            <div class="item-venda ${classeStatus}">
                <div>
                    <strong>${v.nome}</strong><br><small>${v.desc}</small><br>
                    <span style="font-size:0.75rem">${v.vencimento.split('-').reverse().join('/')}</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px">
                    <strong style="margin-right:10px">R$ ${v.valor.toFixed(2)}</strong>
                    ${!v.pago ? `
                        <a href="https://wa.me/55${v.tel}?text=${encodeURIComponent(msg)}" target="_blank" class="btn-wpp"><i class="fab fa-whatsapp"></i></a>
                        <button onclick="window.quitar('${v.id}')" style="background:var(--success); color:white; border:none; padding:10px; border-radius:10px; cursor:pointer"><i class="fas fa-check"></i></button>
                    ` : '✅'}
                </div>
            </div>`;
    });
}

window.quitar = (id) => updateDoc(doc(db_fire, "vendas", id), {pago: true});
window.mudarFiltro = (f, b) => { 
    filtro = f; 
    document.querySelectorAll('.filter-bar button').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); 
    renderHistorico(); 
};

function updateDash() {
    const pen = db.vendas.filter(v => !v.pago).reduce((a,b) => a + b.valor, 0);
    const pag = db.vendas.filter(v => v.pago).reduce((a,b) => a + b.valor, 0);
    document.getElementById('total-geral').innerText = `R$ ${pen.toFixed(2)}`;
    document.getElementById('total-pago').innerText = `R$ ${pag.toFixed(2)}`;
}

function renderChart() {
    const ctx = document.getElementById('graficoVendas').getContext('2d');
    const labels = {};
    db.vendas.filter(v => v.pago).forEach(v => {
        const mes = new Date(v.dataCriacao).toLocaleString('pt-BR', {month:'short'});
        labels[mes] = (labels[mes] || 0) + v.valor;
    });
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: Object.keys(labels), datasets: [{ label: 'Recebido R$', data: Object.values(labels), borderColor: '#2563eb', tension: 0.4, fill: true, backgroundColor: 'rgba(37,99,235,0.05)' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// Máscara Valor
document.getElementById('valor-venda').oninput = (e) => {
    let v = e.target.value.replace(/\D/g,'');
    e.target.value = (v/100).toFixed(2).replace(".",",");
};