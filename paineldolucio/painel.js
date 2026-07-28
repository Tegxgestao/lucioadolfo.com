// Painel do Lucio — aprovação de notícias e publicações.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const cfg = window.PAINEL_CONFIG;
const $ = (s) => document.querySelector(s);
const conteudo = $("#conteudo");
let sb = null;
let abaAtual = "fila";

function aviso(msg, ms) {
  const el = $("#aviso");
  el.textContent = msg;
  el.classList.add("ver");
  clearTimeout(aviso._t);
  aviso._t = setTimeout(() => el.classList.remove("ver"), ms || 2600);
}

// Garante sessão válida antes de qualquer ação; reabre a senha se expirou
async function sessaoOk() {
  const { data } = await sb.auth.getSession();
  const s = data && data.session;
  if (s && s.expires_at * 1000 - Date.now() > 60000) return true;
  const r = await sb.auth.refreshSession();
  if (r && r.data && r.data.session) return true;
  $("#telaLogin").style.display = "flex";
  $("#senha").value = "";
  aviso("Sessão expirada — digite a senha novamente.", 6000);
  return false;
}

// Comprime e converte a foto para JPEG no aparelho (rápido e compatível)
function redimensionar(arquivo) {
  return new Promise((res) => {
    try {
      const url = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1400;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > MAX || h > MAX) { const f = Math.min(MAX / w, MAX / h); w = Math.round(w * f); h = Math.round(h * f); }
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          c.toBlob((b) => { URL.revokeObjectURL(url); res(b || arquivo); }, "image/jpeg", 0.85);
        } catch (e) { res(arquivo); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); res(arquivo); };
      img.src = url;
    } catch (e) { res(arquivo); }
  });
}
const esc = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const urlSegura = (u = "") => (/^https?:\/\//i.test(u) ? u : "#");
const dataBr = (iso) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";

// ===== Login =====
async function entrar() {
  const senha = $("#senha").value.trim();
  $("#erroLogin").textContent = "";
  if (!senha) return;
  const { error } = await sb.auth.signInWithPassword({ email: cfg.LOGIN_EMAIL, password: senha });
  if (error) {
    $("#erroLogin").textContent = "Senha incorreta.";
    return;
  }
  $("#telaLogin").style.display = "none";
  mostrar("fila");
}

// Contador de notícias aguardando decisão, exibido na aba
async function atualizarContador() {
  const { count } = await sb.from("noticias").select("id", { count: "exact", head: true }).eq("status", "pendente");
  const b = document.querySelector('.abas button[data-aba="fila"]');
  if (b) b.textContent = "Fila de Notícias" + (count ? ` (${count})` : "");
}

// ===== Fila =====
async function mostrar(aba) {
  abaAtual = aba;
  document.querySelectorAll(".abas button").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === aba));
  conteudo.innerHTML = '<div class="vazio">Carregando…</div>';
  if (aba === "fila") return renderFila();
  if (aba === "historico") return renderHistorico();
  if (aba === "livros") return renderLivros();
  return renderPublicacoes();
}

async function renderFila() {
  atualizarContador();
  const { data, error } = await sb.from("noticias").select("*").eq("status", "pendente").order("criada_em", { ascending: false });
  if (error) return (conteudo.innerHTML = `<div class="vazio">Erro: ${esc(error.message)}</div>`);
  if (!data.length) return (conteudo.innerHTML = '<div class="vazio">Nenhuma notícia aguardando. O robô procura novas de hora em hora.</div>');
  conteudo.innerHTML = data
    .map(
      (n) => `<div class="card" data-id="${n.id}">
      <div class="fonte">${esc(n.fonte)} · ${dataBr(n.criada_em)}</div>
      <input class="t" value="${esc(n.titulo)}">
      <textarea class="d">${esc(n.descricao)}</textarea>
      <div class="acoes">
        <a class="b-link" href="${urlSegura(n.url)}" target="_blank" rel="noopener">Ler original</a>
        <button class="b b-ok" data-acao="aprovar">Aprovar</button>
        <button class="b b-no" data-acao="rejeitar">Rejeitar</button>
      </div></div>`
    )
    .join("");
}

async function agirNoticia(card, acao) {
  if (!(await sessaoOk())) return;
  const id = card.dataset.id;
  const campos =
    acao === "aprovar"
      ? { titulo: card.querySelector(".t").value.trim(), descricao: card.querySelector(".d").value.trim(), status: "aprovada", aprovada_em: new Date().toISOString() }
      : { status: acao === "rejeitar" ? "rejeitada" : "removida" };
  const { error } = await sb.from("noticias").update(campos).eq("id", id);
  if (error) return aviso("Erro: " + error.message);
  card.remove();
  aviso(acao === "aprovar" ? "Aprovada — já está no site." : acao === "rejeitar" ? "Rejeitada." : "Removida do site.");
  atualizarContador();
  if (!conteudo.querySelector(".card")) mostrar(abaAtual);
}

// ===== Histórico =====
async function renderHistorico() {
  const { data, error } = await sb.from("noticias").select("*").eq("status", "aprovada").order("aprovada_em", { ascending: false });
  if (error) return (conteudo.innerHTML = `<div class="vazio">Erro: ${esc(error.message)}</div>`);
  if (!data.length) return (conteudo.innerHTML = '<div class="vazio">Nenhuma notícia aprovada ainda.</div>');
  conteudo.innerHTML = data
    .map(
      (n) => `<div class="card" data-id="${n.id}">
      <div class="fonte">${esc(n.fonte)} · aprovada em ${dataBr(n.aprovada_em)}</div>
      <strong>${esc(n.titulo)}</strong>
      <p style="color:var(--muted);font-size:.92rem;margin:.4rem 0 .8rem">${esc(n.descricao)}</p>
      <div class="acoes">
        <a class="b-link" href="${urlSegura(n.url)}" target="_blank" rel="noopener">Ler original</a>
        <button class="b b-no" data-acao="remover">Remover do site</button>
      </div></div>`
    )
    .join("");
}

// ===== Publicações =====
async function renderPublicacoes() {
  const { data, error } = await sb.from("publicacoes").select("*").order("criada_em", { ascending: false });
  if (error) return (conteudo.innerHTML = `<div class="vazio">Erro: ${esc(error.message)}</div>`);
  const blocoFoto = (p) => `<div class="capa-linha">
      ${p.foto_url ? `<img class="capa-mini" style="aspect-ratio:3/4" src="${esc(p.foto_url)}" alt="">` : '<div class="capa-vazia" style="aspect-ratio:3/4">sem foto</div>'}
      <div style="flex:1">
        <input type="file" class="arquivo-foto" accept="image/*">
        ${p.foto_url ? '<button class="b b-no" data-acao="remover-foto" style="margin-top:.5rem;flex:none">Remover foto</button>' : ""}
      </div></div>`;
  const lista = data
    .map(
      (p) => `<div class="card" data-id="${p.id}">
      <div class="fonte">${p.status === "publicada" ? "No site" : "Despublicada"} · ${dataBr(p.criada_em)}</div>
      <input class="t" value="${esc(p.titulo)}">
      ${blocoFoto(p)}
      <textarea class="d corpo">${esc(p.corpo)}</textarea>
      <div class="acoes">
        <button class="b b-ok" data-acao="salvar">Salvar edição</button>
        <button class="b ${p.status === "publicada" ? "b-no" : "b-ok"}" data-acao="alternar" data-status="${p.status}">
          ${p.status === "publicada" ? "Despublicar" : "Republicar"}</button>
      </div></div>`
    )
    .join("");
  conteudo.innerHTML = `<div class="card" id="novaPub">
      <div class="fonte">Nova publicação</div>
      <input class="t" placeholder="Título">
      <p style="font-size:.78rem;color:var(--muted);margin-bottom:.4rem">Foto (opcional): anexe uma imagem ou tire uma foto — aparece abaixo do título.</p>
      <input type="file" class="arquivo-foto" accept="image/*" style="margin-bottom:.6rem">
      <textarea class="d corpo" placeholder="Escreva aqui o seu texto…"></textarea>
      <div class="acoes"><button class="b b-gold" data-acao="publicar" style="color:#181614">Publicar no site</button></div>
    </div>` + (lista || '<div class="vazio">Nenhuma publicação ainda — a primeira é sua, Dr. Lúcio.</div>');
}

async function enviarFotoPub(id, arquivo) {
  if (!(await sessaoOk())) return false;
  aviso("Enviando foto…", 8000);
  const blob = await redimensionar(arquivo);
  const caminho = `pub-${id}-${Date.now()}.jpg`;
  const { error } = await sb.storage.from("capas").upload(caminho, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) { aviso("Erro no envio da foto: " + error.message, 6000); return false; }
  const { data } = sb.storage.from("capas").getPublicUrl(caminho);
  const { error: e2 } = await sb.from("publicacoes").update({ foto_url: data.publicUrl, atualizada_em: new Date().toISOString() }).eq("id", id);
  if (e2) { aviso("Erro: " + e2.message); return false; }
  return true;
}

async function agirPublicacao(card, acao) {
  if (!(await sessaoOk())) return;
  if (acao === "publicar") {
    const titulo = card.querySelector(".t").value.trim();
    const corpo = card.querySelector(".d").value.trim();
    if (!titulo || !corpo) return aviso("Preencha título e texto.");
    const arquivo = card.querySelector(".arquivo-foto")?.files?.[0] || null;
    const { data: nova, error } = await sb.from("publicacoes").insert({ titulo, corpo, status: "publicada" }).select("id").single();
    if (error) return aviso("Erro: " + error.message);
    if (arquivo) await enviarFotoPub(nova.id, arquivo);
    aviso("Publicado no site.");
    return mostrar("publicacoes");
  }
  const id = card.dataset.id;
  if (acao === "remover-foto") {
    const { error } = await sb.from("publicacoes").update({ foto_url: "", atualizada_em: new Date().toISOString() }).eq("id", id);
    if (error) return aviso("Erro: " + error.message);
    aviso("Foto removida.");
    return mostrar("publicacoes");
  }
  if (acao === "salvar") {
    const { error } = await sb.from("publicacoes").update({
      titulo: card.querySelector(".t").value.trim(),
      corpo: card.querySelector(".d").value.trim(),
      atualizada_em: new Date().toISOString(),
    }).eq("id", id);
    return error ? aviso("Erro: " + error.message) : aviso("Edição salva.");
  }
  if (acao === "alternar") {
    const novo = card.querySelector('[data-acao="alternar"]').dataset.status === "publicada" ? "despublicada" : "publicada";
    const { error } = await sb.from("publicacoes").update({ status: novo, atualizada_em: new Date().toISOString() }).eq("id", id);
    if (error) return aviso("Erro: " + error.message);
    aviso(novo === "publicada" ? "De volta ao site." : "Removida do site.");
    return mostrar("publicacoes");
  }
}

// ===== Livros =====
async function renderLivros() {
  const { data, error } = await sb.from("livros").select("*").order("ordem", { ascending: true }).order("id", { ascending: true });
  if (error) return (conteudo.innerHTML = `<div class="vazio">Erro: ${esc(error.message)}</div>`);
  const cartao = (l) => `<div class="card" data-id="${l.id}">
      <div class="fonte">${l.status === "publicado" ? "No site" : "Oculto"} · ordem ${l.ordem} · ${l.estoque > 0 ? "estoque: " + l.estoque : "ESGOTADO"}</div>
      <div class="capa-linha">
        ${l.capa_url ? `<img class="capa-mini" src="${esc(l.capa_url)}" alt="">` : '<div class="capa-vazia">sem capa</div>'}
        <div style="flex:1">
          <input class="t" value="${esc(l.titulo)}" placeholder="Título">
          <input class="s" value="${esc(l.selo)}" placeholder="Editora / selo">
          <label style="font-size:.72rem;color:var(--muted)">Ordem no site</label>
          <input class="o" type="number" value="${l.ordem}" style="max-width:7rem">
          <label style="font-size:.72rem;color:var(--muted)">Livros em estoque (0 = esgotado)</label>
          <input class="e" type="number" min="0" value="${l.estoque}" style="max-width:7rem">
        </div>
      </div>
      <textarea class="d">${esc(l.sinopse)}</textarea>
      <input type="file" class="arquivo-capa" accept="image/*">
      <div class="acoes" style="margin-top:.6rem">
        <button class="b b-ok" data-acao="salvar-livro">Salvar</button>
        <button class="b ${l.status === "publicado" ? "b-no" : "b-ok"}" data-acao="alternar-livro" data-status="${l.status}">
          ${l.status === "publicado" ? "Ocultar do site" : "Mostrar no site"}</button>
      </div></div>`;
  conteudo.innerHTML = `<div class="card" id="novoLivro">
      <div class="fonte">Novo livro</div>
      <input class="t" placeholder="Título">
      <input class="s" placeholder="Editora / selo">
      <input class="e" type="number" min="0" placeholder="Livros em estoque" style="max-width:12rem">
      <textarea class="d" placeholder="Comentário / sinopse do livro"></textarea>
      <div class="acoes"><button class="b b-gold" data-acao="novo-livro" style="color:#181614">Adicionar livro</button></div>
      <p style="font-size:.78rem;color:var(--muted);margin-top:.5rem">Depois de adicionar, envie a foto da capa no cartão do livro.</p>
    </div>` + data.map(cartao).join("");
}

async function agirLivro(card, acao) {
  if (!(await sessaoOk())) return;
  const id = card.dataset.id;
  if (acao === "novo-livro") {
    const titulo = card.querySelector(".t").value.trim();
    if (!titulo) return aviso("Dê um título ao livro.");
    const { error } = await sb.from("livros").insert({
      titulo,
      selo: card.querySelector(".s").value.trim(),
      sinopse: card.querySelector(".d").value.trim(),
      estoque: Math.max(0, parseInt(card.querySelector(".e").value, 10) || 0),
    });
    if (error) return aviso("Erro: " + error.message);
    aviso("Livro adicionado ao site.");
    return mostrar("livros");
  }
  if (acao === "salvar-livro") {
    const estoque = Math.max(0, parseInt(card.querySelector(".e").value, 10) || 0);
    const { error } = await sb.from("livros").update({
      titulo: card.querySelector(".t").value.trim(),
      selo: card.querySelector(".s").value.trim(),
      sinopse: card.querySelector(".d").value.trim(),
      ordem: parseInt(card.querySelector(".o").value, 10) || 100,
      estoque,
      atualizada_em: new Date().toISOString(),
    }).eq("id", id);
    if (error) return aviso("Erro: " + error.message, 6000);
    aviso(estoque > 0 ? "Livro salvo — " + estoque + " em estoque." : "Livro salvo — aparecerá como ESGOTADO no site.");
    return mostrar("livros");
  }
  if (acao === "alternar-livro") {
    const novo = card.querySelector('[data-acao="alternar-livro"]').dataset.status === "publicado" ? "oculto" : "publicado";
    const { error } = await sb.from("livros").update({ status: novo, atualizada_em: new Date().toISOString() }).eq("id", id);
    if (error) return aviso("Erro: " + error.message);
    aviso(novo === "publicado" ? "Livro de volta ao site." : "Livro oculto do site.");
    return mostrar("livros");
  }
}

async function enviarCapa(card, arquivo) {
  const id = card.dataset.id;
  if (!id) return aviso("Adicione o livro primeiro; depois envie a capa.", 5000);
  if (!(await sessaoOk())) return;
  aviso("Enviando capa…", 8000);
  const blob = await redimensionar(arquivo);
  const caminho = `livro-${id}-${Date.now()}.jpg`;
  const { error } = await sb.storage.from("capas").upload(caminho, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) return aviso("Erro no envio da capa: " + error.message, 6000);
  const { data } = sb.storage.from("capas").getPublicUrl(caminho);
  const { error: e2 } = await sb.from("livros").update({ capa_url: data.publicUrl, atualizada_em: new Date().toISOString() }).eq("id", id);
  if (e2) return aviso("Erro: " + e2.message, 6000);
  aviso("Capa atualizada no site.");
  mostrar("livros");
}

document.addEventListener("change", (e) => {
  const card = e.target.closest(".card");
  const arquivo = e.target.files && e.target.files[0];
  if (!card || !arquivo) return;
  if (e.target.classList.contains("arquivo-capa")) return enviarCapa(card, arquivo);
  if (e.target.classList.contains("arquivo-foto") && card.dataset.id) {
    enviarFotoPub(card.dataset.id, arquivo).then((ok) => { if (ok) { aviso("Foto atualizada no site."); mostrar("publicacoes"); } });
  }
});

// ===== Eventos =====
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-acao]");
  if (!b) return;
  const card = b.closest(".card");
  const acao = b.dataset.acao;
  if (["aprovar", "rejeitar", "remover"].includes(acao)) return agirNoticia(card, acao === "remover" ? "remover" : acao);
  if (["novo-livro", "salvar-livro", "alternar-livro"].includes(acao)) return agirLivro(card, acao);
  return agirPublicacao(card, acao);
});
document.querySelectorAll(".abas button").forEach((b) => b.addEventListener("click", () => mostrar(b.dataset.aba)));
$("#btnEntrar").addEventListener("click", entrar);
$("#senha").addEventListener("keydown", (e) => e.key === "Enter" && entrar());
$("#btnSair").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

// ===== Início =====
if (!cfg.SUPABASE_URL) {
  $("#erroLogin").textContent = "Painel ainda não configurado.";
} else {
  sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}
