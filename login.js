// Tela de login/criação de conta — cada conta tem seu próprio banco isolado
// (ver colecao() em app.js). Autocadastro aberto: qualquer pessoa pode criar
// a própria conta (decisão do João, 2026-09-26).
let modo = "entrar";
const $ = id => document.getElementById(id);

function trocarModo(m) {
  modo = m;
  $("aba-entrar").classList.toggle("ativa", m === "entrar");
  $("aba-criar").classList.toggle("ativa", m === "criar");
  $("btn-enviar").textContent = m === "entrar" ? "Entrar" : "Criar conta";
  $("f-senha").autocomplete = m === "entrar" ? "current-password" : "new-password";
  $("campo-whatsapp").style.display = m === "criar" ? "" : "none";
  $("login-erro").textContent = "";
}
$("aba-entrar").onclick = () => trocarModo("entrar");
$("aba-criar").onclick = () => trocarModo("criar");

const MENSAGENS_ERRO = {
  "auth/invalid-email": "E-mail inválido.",
  "auth/user-disabled": "Esta conta foi desativada.",
  "auth/user-not-found": "Não existe conta com esse e-mail.",
  "auth/wrong-password": "Senha incorreta.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Toque em \"Entrar\".",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/too-many-requests": "Muitas tentativas — aguarde um pouco e tente de novo.",
  "auth/network-request-failed": "Sem conexão com a internet."
};
function mostrarErro(err, cor) {
  const el = $("login-erro");
  el.style.color = cor || "";
  el.textContent = MENSAGENS_ERRO[err?.code] || (err ? "Erro: " + err.message : "");
}

$("form-login").onsubmit = async e => {
  e.preventDefault();
  if (!auth) { mostrarErro({ message: "Firebase não configurado neste sistema." }); return; }
  const email = $("f-email").value.trim();
  const senha = $("f-senha").value;
  const whatsapp = $("f-whatsapp").value.trim();
  if (modo === "criar" && !whatsapp) { mostrarErro({ message: "Informe seu WhatsApp com DDD." }); return; }
  mostrarErro(null);
  $("btn-enviar").disabled = true;
  try {
    if (modo === "entrar") {
      await auth.signInWithEmailAndPassword(email, senha);
    } else {
      const cred = await auth.createUserWithEmailAndPassword(email, senha);
      // Perfil da conta nova — o "confirmacaoEnviada: false" é o gatilho que o
      // bot de WhatsApp (rodando na mesma VM do GW) fica de olho pra mandar a
      // mensagem de boas-vindas automaticamente (ver CLAUDE.md).
      await db.collection("usuarios").doc(cred.user.uid).set({
        email, whatsapp, criadoEm: new Date().toISOString(), confirmacaoEnviada: false
      });
    }
    window.location.href = "./index.html";
  } catch (err) {
    mostrarErro(err);
    $("btn-enviar").disabled = false;
  }
};

$("link-esqueci").onclick = async e => {
  e.preventDefault();
  if (!auth) return;
  const email = $("f-email").value.trim();
  if (!email) { mostrarErro({ message: "Digite seu e-mail acima primeiro." }); return; }
  try {
    await auth.sendPasswordResetEmail(email);
    mostrarErro({ message: "Enviamos um link de redefinição pro seu e-mail." }, "var(--azul)");
  } catch (err) {
    mostrarErro(err);
  }
};

// Se cair aqui já logado (link salvo, voltar no navegador etc.), manda pro menu.
if (auth) auth.onAuthStateChanged(user => { if (user) window.location.replace("./index.html"); });
