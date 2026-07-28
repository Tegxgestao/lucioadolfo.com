// Painel do Lucio — aprovação de notícias e publicações.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const cfg = window.PAINEL_CONFIG;
const $ = (s) => document.querySelector(s);
const conteudo = $("#conteudo");
let sb = null;
let abaAtual = "fila";

function aviso(msg) {
  const el = $("#aviso");
  el.textContent = msg;
  el.classList.add("ver");
  setTimeout(() => el.classList.remove("ver"), 2600);
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
  const id = card.dataset.id;
  const campos =
    acao === "aprovar"
      ? { titulo: card.querySelector(".t").value.trim(), descricao: card.querySelector(".d").value.trim(), status: "aprovada", aprovada_em: new Date().toISOString() }
      : { status: acao === "rejeitar" ? "rejeitada" : "removida" };
  const { error } = await sb.from("noticias").update(campos).eq("id", id);
  if (error) return aviso("Erro: " + error.message);
  card.remove();
  aviso(acao === "aprovar" ? "Aprovada — já está no site." : acao === "rejeitar" ? "Rejeitada." : "Removida do site.");
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
  const lista = data
    .map(
      (p) => `<div class="card" data-id="${p.id}">
      <div class="fonte">${p.status === "publicada" ? "No site" : "Despublicada"} · ${dataBr(p.criada_em)}</div>
      <input class="t" value="${esc(p.titulo)}">
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
      <textarea class="d corpo" placeholder="Escreva aqui o seu texto…"></textarea>
      <div class="acoes"><button class="b b-gold" data-acao="publicar" style="color:#181614">Publicar no site</button></div>
    </div>` + (lista || '<div class="vazio">Nenhuma publicação ainda — a primeira é sua, Dr. Lúcio.</div>');
}

async function agirPublicacao(card, acao) {
  if (acao === "publicar") {
    const titulo = card.querySelector(".t").value.trim();
    const corpo = card.querySelector(".d").value.trim();
    if (!titulo || !corpo) return aviso("Preencha título e texto.");
    const { error } = await sb.from("publicacoes").insert({ titulo, corpo, status: "publicada" });
    if (error) return aviso("Erro: " + error.message);
    aviso("Publicado no site.");
    return mostrar("publicacoes");
  }
  const id = card.dataset.id;
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
      <div class="fonte">${l.status === "publicado" ? "No site" : "Oculto"} · ordem ${l.ordem}</div>
      <div class="capa-linha">
        ${l.capa_url ? `<img class="capa-mini" src="${esc(l.capa_url)}" alt="">` : '<div class="capa-vazia">sem capa</div>'}
        <div style="flex:1">
          <input class="t" value="${esc(l.titulo)}" placeholder="Título">
          <input class="s" value="${esc(l.selo)}" placeholder="Editora / selo">
          <input class="o" type="number" value="${l.ordem}" placeholder="Ordem" style="max-width:7rem">
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
      <textarea class="d" placeholder="Comentário / sinopse do livro"></textarea>
      <div class="acoes"><button class="b b-gold" data-acao="novo-livro" style="color:#181614">Adicionar livro</button></div>
      <p style="font-size:.78rem;color:var(--muted);margin-top:.5rem">Depois de adicionar, envie a foto da capa no cartão do livro.</p>
    </div>` + data.map(cartao).join("");
}

async function agirLivro(card, acao) {
  const id = card.dataset.id;
  if (acao === "novo-livro") {
    const titulo = card.querySelector(".t").value.trim();
    if (!titulo) return aviso("Dê um título ao livro.");
    const { error } = await sb.from("livros").insert({
      titulo, selo: card.querySelector(".s").value.trim(), sinopse: card.querySelector(".d").value.trim(),
    });
    if (error) return aviso("Erro: " + error.message);
    aviso("Livro adicionado ao site.");
    return mostrar("livros");
  }
  if (acao === "salvar-livro") {
    const { error } = await sb.from("livros").update({
      titulo: card.querySelector(".t").value.trim(),
      selo: card.querySelector(".s").value.trim(),
      sinopse: card.querySelector(".d").value.trim(),
      ordem: parseInt(card.querySelector(".o").value, 10) || 100,
      atualizada_em: new Date().toISOString(),
    }).eq("id", id);
    return error ? aviso("Erro: " + error.message) : aviso("Livro salvo.");
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
  if (!id) return aviso("Adicione o livro primeiro; depois envie a capa.");
  aviso("Enviando capa…");
  const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const caminho = `livro-${id}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("capas").upload(caminho, arquivo, { upsert: true });
  if (error) return aviso("Erro no envio: " + error.message);
  const { data } = sb.storage.from("capas").getPublicUrl(caminho);
  const { error: e2 } = await sb.from("livros").update({ capa_url: data.publicUrl, atualizada_em: new Date().toISOString() }).eq("id", id);
  if (e2) return aviso("Erro: " + e2.message);
  aviso("Capa atualizada no site.");
  mostrar("livros");
}

document.addEventListener("change", (e) => {
  if (!e.target.classList.contains("arquivo-capa")) return;
  const card = e.target.closest(".card");
  if (e.target.files && e.target.files[0]) enviarCapa(card, e.target.files[0]);
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
