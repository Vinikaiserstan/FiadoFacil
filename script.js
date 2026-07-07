import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, doc, updateDoc, deleteDoc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
const storage = getStorage(app);

let userLogado = null, db = { clientes: [], vendas: [] }, filtro = 'todos', vendaIdAtual = null, clienteIdAtual = null;
let isLoginMode = true, clienteSelecionado = null;

// --- LOG DE AÇÕES (LGPD-safe: sem dados pessoais de terceiros) ---
// Registra apenas tipo de ação, tela e timestamp. Nunca nomes, valores ou telefones de clientes.
async function trackUsage(evento, detalhes = {}) {
    if (!userLogado) return;
    try {
        await addDoc(collection(db_fire, "telemetria_uso"), {
            userId: userLogado.uid,
            e: evento,
            t: new Date().toISOString()
        });
    } catch (e) { console.error("Erro no log:", e); }
}

async function log(acao, tela) {
    if (!userLogado) return;
    try {
        await addDoc(collection(db_fire, "log_acoes"), {
            userId: userLogado.uid,
            // Apenas tipo de ação e tela — sem dados pessoais de clientes ou valores
            acao,
            tela,
            t: new Date().toISOString()
        });
    } catch (e) { console.error("Erro no log:", e); }
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
        log('login', 'auth');
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
        mostrarBannerLgpd();
    } else {
        document.body.classList.add('not-logged-in');
    }
});

window.fazerLogout = () => {
    trackUsage("logout");
    log('logout', 'app');
    signOut(auth);
}

// --- BANNER LGPD ---
window.fecharBannerLgpd = (e) => {
    if(e) e.preventDefault();
    document.getElementById('banner-lgpd').style.display = 'none';
    localStorage.setItem('lgpd_ok', '1');
};

function mostrarBannerLgpd() {
    if (!localStorage.getItem('lgpd_ok')) {
        document.getElementById('banner-lgpd').style.display = 'flex';
    }
}

// --- SIDEBAR MOBILE ---
window.toggleSidebar = () => {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    const open = sb.classList.toggle('sidebar-open');
    ov.classList.toggle('active', open);
};

// --- NAVEGAÇÃO ---
window.navegar = (id) => {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    const tela = document.getElementById('tela-' + id);
    if(tela) {
        tela.style.display = 'flex';
        trackUsage("navegou", { tela: id });
        if (id === 'admin') carregarAdmin();
        log('navegou_para_' + id, id);
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

// =============================================
// ADMIN — troque pelo seu e-mail real
const ADMIN_EMAIL = "viniciusneiva125@gmail.com";
// =============================================

// --- PERFIL ---
let perfilDocId = null;
let perfilCache = {};

function renderPerfil(p) {
    const inicial = (p.nome || userLogado.email || '?')[0].toUpperCase();
    const avatarEl = document.getElementById('perfil-avatar');
    if (p.fotoURL) {
        avatarEl.innerHTML = `<img src="${p.fotoURL}" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
        avatarEl.textContent = inicial;
    }
    document.getElementById('perfil-nome').textContent = p.nome || userLogado.email || '—';
    document.getElementById('perfil-estab').textContent = p.estabelecimento || '—';
    document.getElementById('perfil-tel').textContent = p.tel || '—';
    const end = p.endereco ? [p.endereco.rua, p.endereco.bairro].filter(Boolean).join(', ') : '—';
    document.getElementById('perfil-end').textContent = end || '—';
    document.getElementById('perfil-email').textContent = userLogado.email || '—';
    if (p.criadoEm) {
        const d = new Date(p.criadoEm);
        document.getElementById('perfil-desde').textContent = d.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
    }
}

window.uploadFotoPerfil = async (input) => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Foto muito grande. Máximo 2MB.'); return; }
    const label = document.getElementById('perfil-foto-label');
    label.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const ref = storageRef(storage, `fotos/${userLogado.uid}`);
        await uploadBytes(ref, file);
        const url = await getDownloadURL(ref);
        await updateDoc(doc(db_fire, 'perfis', perfilDocId), { fotoURL: url });
        perfilCache.fotoURL = url;
        renderPerfil(perfilCache);
    } catch(e) { alert('Erro ao enviar foto.'); }
    label.innerHTML = '<i class="fas fa-camera"></i><input type="file" id="perfil-foto-input" accept="image/*" style="display:none" onchange="window.uploadFotoPerfil(this)">';
};

async function carregarPerfil(uid) {
    const snap = await getDocs(query(collection(db_fire, 'perfis'), where('userId', '==', uid)));
    if (!snap.empty) {
        const d = snap.docs[0];
        perfilDocId = d.id;
        perfilCache = d.data();
    } else {
        // Usuário sem perfil ainda (conta antiga) — cria documento vazio
        const ref = await addDoc(collection(db_fire, 'perfis'), {
            userId: uid,
            email: userLogado.email,
            nome: '',
            tel: '',
            estabelecimento: '',
            endereco: { rua: '', bairro: '' },
            criadoEm: new Date().toISOString()
        });
        perfilDocId = ref.id;
        perfilCache = {};
    }
    renderPerfil(perfilCache);
}

window.abrirEditarPerfil = () => {
    // Usa dados já em memória — sem segundo getDocs
    document.getElementById('perf-nome').value = perfilCache.nome || '';
    document.getElementById('perf-tel').value = perfilCache.tel || '';
    document.getElementById('perf-estab').value = perfilCache.estabelecimento || '';
    document.getElementById('perf-rua').value = perfilCache.endereco?.rua || '';
    document.getElementById('perf-bairro').value = perfilCache.endereco?.bairro || '';
    document.getElementById('modal-perfil').style.display = 'flex';
};

window.salvarPerfil = async () => {
    if (!perfilDocId) { alert('Perfil não carregado ainda. Tente novamente.'); return; }
    const dados = {
        nome: document.getElementById('perf-nome').value.trim(),
        tel: document.getElementById('perf-tel').value.replace(/\D/g,''),
        estabelecimento: document.getElementById('perf-estab').value.trim(),
        endereco: {
            rua: document.getElementById('perf-rua').value.trim(),
            bairro: document.getElementById('perf-bairro').value.trim()
        }
    };
    await updateDoc(doc(db_fire, 'perfis', perfilDocId), dados);
    perfilCache = { ...perfilCache, ...dados };
    renderPerfil(perfilCache);
    window.fecharModal('modal-perfil');
};

// --- ADMIN ---
async function carregarAdmin() {
    // Lê telemetria geral (logins/cadastros) e log detalhado de ações
    const [snapGeral, snapLog] = await Promise.all([
        getDocs(collection(db_fire, 'telemetria_uso')),
        getDocs(collection(db_fire, 'log_acoes'))
    ]);
    const geral  = snapGeral.docs.map(d => d.data());
    const acoes  = snapLog.docs.map(d => d.data());
    const tudo   = [...geral, ...acoes];

    const logins    = geral.filter(e => e.e === 'login').length;
    const cadastros = geral.filter(e => e.e === 'cadastro').length;
    const usuarios  = new Set(tudo.map(e => e.userId).filter(Boolean)).size;

    // Contagem de ações detalhadas do log
    const count = (acao) => acoes.filter(e => e.acao === acao).length;

    // Dias únicos com uso nos últimos 30 dias
    const hoje = new Date();
    const diasMap = {};
    for (let i = 29; i >= 0; i--) {
        const d = new Date(hoje);
        d.setDate(hoje.getDate() - i);
        diasMap[d.toISOString().split('T')[0]] = false;
    }
    tudo.forEach(e => {
        const dia = (e.t || '').split('T')[0];
        if (dia in diasMap) diasMap[dia] = true;
    });
    const diasAtivos = Object.values(diasMap).filter(Boolean).length;

    document.getElementById('adm-logins').textContent = logins;
    document.getElementById('adm-cadastros').textContent = cadastros;
    document.getElementById('adm-usuarios').textContent = usuarios;
    document.getElementById('adm-dias-ativos').textContent = diasAtivos;

    // Detalhes de ações
    const detEl = document.getElementById('admin-detalhes');
    if (detEl) {
        const acoesList = [
            { label: 'Novos clientes cadastrados', key: 'novo_cliente' },
            { label: 'Vendas lançadas',            key: 'nova_venda' },
            { label: 'Cobranças quitadas',         key: 'quitar_cobranca' },
            { label: 'Lembretes de cobrança abertos', key: 'abriu_lembrete' },
            { label: 'Lembretes enviados via WhatsApp', key: 'enviou_lembrete_wpp' },
            { label: 'Cobranças editadas',         key: 'editou_cobranca' },
            { label: 'Cobranças excluídas',        key: 'excluiu_cobranca' },
            { label: 'Clientes editados',          key: 'editou_cliente' },
            { label: 'Clientes excluídos',         key: 'excluiu_cliente' },
        ];
        detEl.innerHTML = acoesList.map(a =>
            `<div class="adm-detalhe-item">
                <span class="adm-detalhe-label">${a.label}</span>
                <span class="adm-detalhe-val">${count(a.key)}</span>
            </div>`
        ).join('');
    }

    // Calendário
    const cal = document.getElementById('admin-calendario');
    cal.innerHTML = '';
    Object.entries(diasMap).forEach(([dia, usado]) => {
        const [,m,d] = dia.split('-');
        const el = document.createElement('div');
        el.className = 'cal-dia ' + (usado ? 'cal-ativo' : 'cal-inativo');
        el.innerHTML = `<span class="cal-num">${parseInt(d)}</span><span class="cal-mes">${m}/${dia.split('-')[0].slice(2)}</span>`;
        el.title = dia + (usado ? ' — com atividade' : ' — sem uso');
        cal.appendChild(el);
    });
}

// --- SYNC ---
function startSync(uid) {
    // Perfil
    carregarPerfil(uid);

    // Botão admin — sidebar desktop + FAB mobile
    if (userLogado.email === ADMIN_EMAIL) {
        document.getElementById('btn-admin-nav').style.display = 'flex';

        // Injeta botão admin no FAB mobile se ainda não existe
        if (!document.getElementById('fab-admin-btn')) {
            const fabOptions = document.getElementById('fab-options');
            const adminBtn = document.createElement('button');
            adminBtn.id = 'fab-admin-btn';
            adminBtn.className = 'fab-admin';
            adminBtn.innerHTML = '<i class="fas fa-chart-line"></i>';
            adminBtn.title = 'Painel Admin';
            adminBtn.onclick = () => window.navegarFab('admin');
            // Insere no topo das opções (primeiro filho)
            fabOptions.insertBefore(adminBtn, fabOptions.firstChild);
        }
    }

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
    log('novo_cliente', 'cadastro_cliente');
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
    log('nova_venda', 'venda');
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
    log('editou_cliente', 'modal_edit_cliente');
    await updateDoc(doc(db_fire, "clientes", clienteIdAtual), { 
        nome: document.getElementById('edit-cliente-nome').value, 
        tel: document.getElementById('edit-cliente-tel').value.replace(/\D/g, '')
    });
    window.fecharModal('modal-edit-cliente');
};

window.apagarCliente = async () => {
    if(confirm("Deseja excluir este cliente?")) {
        log('excluiu_cliente', 'modal_edit_cliente');
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
window.quitar = (id) => { log('quitar_cobranca', 'historico'); return updateDoc(doc(db_fire, "vendas", id), {pago: true}); };
window.abrirLembrete = (id) => {
    log('abriu_lembrete', 'historico');
    vendaIdAtual = id; const v = db.vendas.find(x => x.id === id);
    document.getElementById('msg-whatsapp').value = `Olá ${v.nome}, lembrete de cobrança: R$ ${v.valor.toFixed(2)} (${v.desc}).`;
    document.getElementById('modal-lembrete').style.display = 'flex';
};
window.enviarWpp = () => {
    log('enviou_lembrete_wpp', 'modal_lembrete');
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
    log('editou_cobranca', 'modal_edit');
    await updateDoc(doc(db_fire, "vendas", vendaIdAtual), { 
        desc: document.getElementById('edit-desc').value, 
        valor: parseFloat(document.getElementById('edit-valor').value) 
    });
    window.fecharModal('modal-edit');
};
window.apagarVenda = async () => {
    if(confirm("Deseja apagar esta cobrança?")) {
        log('excluiu_cobranca', 'modal_edit');
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