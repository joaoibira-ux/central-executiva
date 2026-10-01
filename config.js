// Configurações pessoais do usuário — hoje só o bot do Telegram pra escalonar
// alarmes não vistos em 5 minutos (ver alarmes-push.js na VM). Grava direto no
// documento raiz do usuário (usuarios/{uid}), igual pushSubscription em app.js.
const $ = id => document.getElementById(id);

prontoAuth.then(async uid => {
  if (!uid) return;
  const doc = await db.collection("usuarios").doc(uid).get();
  const dados = doc.data() || {};
  if (dados.telegramBotToken) $("f-token").value = dados.telegramBotToken;
  if (dados.telegramChatId) $("f-chatid").value = dados.telegramChatId;
});

$("salvar").onclick = async () => {
  const uid = await prontoAuth;
  if (!uid) return;
  const telegramBotToken = $("f-token").value.trim();
  const telegramChatId = $("f-chatid").value.trim();
  await db.collection("usuarios").doc(uid).set({ telegramBotToken, telegramChatId }, { merge: true });
  $("status-salvo").style.display = "";
  setTimeout(() => { $("status-salvo").style.display = "none"; }, 2500);
};
