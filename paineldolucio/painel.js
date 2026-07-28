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

// ===== Eventos =====
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-acao]");
  if (!b) return;
  const card = b.closest(".card");
  const acao = b.dataset.acao;
  if (["aprovar", "rejeitar", "remover"].includes(acao)) return agirNoticia(card, acao === "remover" ? "remover" : acao);
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
