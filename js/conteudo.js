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
        var paragrafar = function (texto) {
          return String(texto).split(/\n{2,}|\r\n\r\n/).map(function (par) {
            return "<p style='margin-bottom:.8rem'>" + esc(par).replace(/\n/g, "<br>") + "</p>";
          }).join("");
        };
        elPubs.innerHTML = itens.map(function (p, i) {
          return '<article class="card" style="margin-bottom:1.5rem"><h3>' + esc(p.titulo) + "</h3>" +
            '<p style="font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:.8rem">' +
            dataBr(p.criada_em) + " · Dr. Lúcio Adolfo</p>" +
            '<div class="pub-corpo clamp" data-i="' + i + '">' + paragrafar(p.corpo) + "</div>" +
            "</article>";
        }).join("");
        // Mostra o botão só quando o texto realmente passa de 3 linhas na tela
        requestAnimationFrame(function () {
          elPubs.querySelectorAll(".pub-corpo").forEach(function (el) {
            if (el.scrollHeight > el.clientHeight + 4) {
              var b = document.createElement("button");
              b.className = "btn";
              b.style.cssText = "cursor:pointer;background:none;margin-top:.8rem";
              b.textContent = "Leitura completa";
              b.setAttribute("data-ler", el.getAttribute("data-i"));
              el.parentNode.appendChild(b);
            } else {
              el.classList.remove("clamp");
            }
          });
        });
        elPubs.addEventListener("click", function (ev) {
          var b = ev.target.closest("[data-ler]");
          if (!b) return;
          var corpo = elPubs.querySelector('.pub-corpo[data-i="' + b.getAttribute("data-ler") + '"]');
          var recolhido = corpo.classList.toggle("clamp");
          b.textContent = recolhido ? "Leitura completa" : "Fechar leitura";
        });
      })
      .catch(function () {});
  }
})();
