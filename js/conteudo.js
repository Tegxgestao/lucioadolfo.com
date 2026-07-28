// Conteúdo dinâmico do site (notícias aprovadas e publicações do Dr. Lúcio).
// Lê do Supabase com a chave pública (anon) — a RLS garante que só o
// aprovado/publicado é visível. Se a API falhar, a página segue com o conteúdo fixo.
(function () {
  var cfg = window.PAINEL_CONFIG;
  if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

  var esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  var urlSegura = function (u) { return /^https?:\/\//i.test(u || "") ? u : "#"; };
  var dataBr = function (iso) {
    try {
      return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    } catch (e) { return ""; }
  };
  function buscar(caminho) {
    return fetch(cfg.SUPABASE_URL + "/rest/v1/" + caminho, {
      headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY }
    }).then(function (r) { return r.ok ? r.json() : []; });
  }

  var elNoticias = document.getElementById("noticias-dinamicas");
  if (elNoticias) {
    buscar("noticias?status=eq.aprovada&select=titulo,descricao,url,fonte,aprovada_em&order=aprovada_em.desc&limit=40")
      .then(function (itens) {
        if (!itens.length) return;
        elNoticias.innerHTML =
          '<h2>Selecionadas pelo Dr. Lúcio</h2><div class="grid grid-2">' +
          itens.map(function (n) {
            return '<a class="card" href="' + urlSegura(n.url) + '" target="_blank" rel="noopener">' +
              "<h3>" + esc(n.titulo) + "</h3>" +
              '<p>' + esc(n.descricao) + "</p>" +
              '<p style="margin-top:.6rem;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)">' +
              esc(n.fonte) + " · " + dataBr(n.aprovada_em) + "</p></a>";
          }).join("") + "</div>";
      })
      .catch(function () {});
  }

  var elPubs = document.getElementById("publicacoes-dinamicas");
  if (elPubs) {
    buscar("publicacoes?status=eq.publicada&select=titulo,corpo,criada_em&order=criada_em.desc")
      .then(function (itens) {
        if (!itens.length) return;
        var embreve = document.getElementById("card-embreve");
        if (embreve) embreve.style.display = "none";
        elPubs.innerHTML = itens.map(function (p) {
          var paragrafos = String(p.corpo).split(/\n{2,}|\r\n\r\n/).map(function (par) {
            return "<p>" + esc(par).replace(/\n/g, "<br>") + "</p>";
          }).join("");
          return '<article class="card" style="margin-bottom:1.5rem"><h3>' + esc(p.titulo) + "</h3>" +
            '<p style="font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:.8rem">' +
            dataBr(p.criada_em) + " · Dr. Lúcio Adolfo</p>" + paragrafos + "</article>";
        }).join("");
      })
      .catch(function () {});
  }
})();
