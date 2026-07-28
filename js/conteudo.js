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
    buscar("noticias?status=eq.aprovada&select=titulo,descricao,url,fonte,aprovada_em&order=aprovada_em.desc&limit=500")
      .then(function (itens) {
        if (!itens.length) return;
        var PORPAG = 12;
        var totalPag = Math.ceil(itens.length / PORPAG);
        var pagina = 1;
        function render() {
          var lote = itens.slice((pagina - 1) * PORPAG, pagina * PORPAG);
          var html = '<div class="grid grid-2 grid-noticias">' + lote.map(function (n) {
            var destino = "leitura.html?u=" + encodeURIComponent(urlSegura(n.url)) +
              "&f=" + encodeURIComponent(n.fonte || "");
            return '<a class="card" href="' + destino + '">' +
              "<h3>" + esc(n.titulo) + "</h3>" +
              "<p>" + esc(n.descricao) + "</p>" +
              '<p style="margin-top:.6rem;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)">' +
              esc(n.fonte) + " · " + dataBr(n.aprovada_em) + "</p></a>";
          }).join("") + "</div>";
          if (totalPag > 1) {
            html += '<div class="paginacao">';
            for (var p = 1; p <= totalPag; p++) {
              html += '<button data-pag="' + p + '"' + (p === pagina ? ' class="atual"' : "") + ">" + p + "</button>";
            }
            html += "</div>";
          }
          elNoticias.innerHTML = html;
        }
        elNoticias.addEventListener("click", function (ev) {
          var b = ev.target.closest("[data-pag]");
          if (!b) return;
          pagina = parseInt(b.getAttribute("data-pag"), 10);
          render();
          elNoticias.scrollIntoView({ behavior: "smooth" });
        });
        render();
      })
      .catch(function () {});
  }

  var elLivros = document.getElementById("lista-livros");
  if (elLivros) {
    buscar("livros?status=eq.publicado&select=titulo,selo,sinopse,capa_url,estoque&order=ordem.asc,id.asc")
      .then(function (itens) {
        if (!itens.length) return;
        elLivros.innerHTML = itens.map(function (l, i) {
          var capa = /^https?:\/\//i.test(l.capa_url || "")
            ? '<img src="' + esc(l.capa_url) + '" alt="Capa do livro ' + esc(l.titulo) + '" class="capa-zoom" style="width:100%;aspect-ratio:2/3;object-fit:cover;border:1px solid var(--gold-soft);display:block">'
            : '<div class="cover"><span>' + esc(l.titulo) + "</span></div>";
          var zap = "https://wa.me/5531999237641?text=" +
            encodeURIComponent("Olá! Tenho interesse no livro " + l.titulo + ".");
          var acaoLivro = function (cls) {
            return (l.estoque > 0)
              ? '<a class="btn btn-livro ' + cls + '" href="' + zap + '" target="_blank" rel="noopener">Quero este livro</a>'
              : '<span class="btn btn-livro esgotado ' + cls + '">Esgotado</span>';
          };
          var btnDet = function (cls) {
            return '<button class="btn btn-livro btn-ler ' + cls + '" data-ler-livro="' + i + '" style="margin-top:0">Mais detalhes</button>';
          };
          return '<div class="book"><div class="col-capa">' + capa + acaoLivro("d-only") + btnDet("d-only") +
            '</div><div class="col-info">' +
            "<h3>" + esc(l.titulo) + "</h3>" +
            (l.selo ? '<p class="pub">' + esc(l.selo) + "</p>" : "") +
            acaoLivro("m-only") + btnDet("m-only") +
            '</div><div class="sin-wrap">' +
            '<div class="pub-corpo clamp sin-livro" data-li="' + i + '"><p>' + esc(l.sinopse) + "</p></div>" +
            "</div></div>";
        }).join("");
        // A descrição recolhida desce até a linha do botão "Mais detalhes".
        // Remede sempre que capas e fontes terminam de carregar.
        function ajustarLivros() {
          var mobile = window.matchMedia("(max-width:820px)").matches;
          elLivros.querySelectorAll(".book").forEach(function (book) {
            var col = book.querySelector(".col-capa");
            var el = book.querySelector(".sin-livro");
            var botoes = book.querySelectorAll("[data-ler-livro]");
            if (!col || !el || el.dataset.aberto === "1") return;
            el.classList.add("clamp");
            var alvo;
            if (mobile) {
              // No celular: 4 linhas por padrão
              alvo = Math.round((parseFloat(getComputedStyle(el).lineHeight) || 27) * 4);
            } else {
              alvo = Math.max(80, Math.round(col.getBoundingClientRect().bottom - el.getBoundingClientRect().top));
            }
            el.dataset.alvo = alvo;
            el.style.maxHeight = alvo + "px";
            var cabe = el.scrollHeight <= alvo + 4;
            if (cabe) {
              el.classList.remove("clamp");
              el.style.maxHeight = "none";
            }
            botoes.forEach(function (b) { b.style.visibility = cabe ? "hidden" : "visible"; });
          });
        }
        requestAnimationFrame(ajustarLivros);
        window.addEventListener("load", ajustarLivros);
        window.addEventListener("resize", ajustarLivros);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarLivros);
        elLivros.querySelectorAll(".col-capa img").forEach(function (im) {
          im.addEventListener("load", ajustarLivros);
        });
        elLivros.addEventListener("click", function (ev) {
          var capaZoom = ev.target.closest(".capa-zoom");
          if (capaZoom) {
            var lb = document.createElement("div");
            lb.className = "lightbox";
            var grande = document.createElement("img");
            grande.src = capaZoom.src;
            grande.alt = capaZoom.alt || "";
            var x = document.createElement("button");
            x.className = "fechar";
            x.setAttribute("aria-label", "Fechar");
            x.textContent = "✕";
            lb.appendChild(x);
            lb.appendChild(grande);
            lb.addEventListener("click", function (e) {
              if (e.target !== grande) lb.remove();
            });
            document.body.appendChild(lb);
            return;
          }
          var b = ev.target.closest("[data-ler-livro]");
          if (!b) return;
          var idx = b.getAttribute("data-ler-livro");
          var el = elLivros.querySelector('.sin-livro[data-li="' + idx + '"]');
          var abrir = el.classList.contains("clamp");
          if (abrir) {
            el.classList.remove("clamp");
            el.style.maxHeight = "none";
            el.dataset.aberto = "1";
          } else {
            el.dataset.aberto = "";
            el.classList.add("clamp");
            el.style.maxHeight = el.dataset.alvo + "px";
          }
          elLivros.querySelectorAll('[data-ler-livro="' + idx + '"]').forEach(function (x) {
            x.textContent = abrir ? "Menos detalhes" : "Mais detalhes";
          });
        });
      })
      .catch(function () {});
  }

  var elPubs = document.getElementById("publicacoes-dinamicas");
  if (elPubs) {
    buscar("publicacoes?status=eq.publicada&select=titulo,corpo,criada_em,foto_url&order=criada_em.desc")
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
            (/^https?:\/\//i.test(p.foto_url || "") ? '<img class="pub-foto" src="' + esc(p.foto_url) + '" alt="">' : "") +
            '<div class="pub-corpo clamp" data-i="' + i + '">' + paragrafar(p.corpo) + "</div>" +
            "</article>";
        }).join("");
        // Mostra o botão só quando o texto realmente passa de 3 linhas na tela
        requestAnimationFrame(function () {
          elPubs.querySelectorAll(".pub-corpo").forEach(function (el) {
            if (el.scrollHeight > el.clientHeight + 4) {
              var b = document.createElement("button");
              b.className = "btn btn-ler";
              b.textContent = "Leitura completa";
              b.setAttribute("data-ler", el.getAttribute("data-i"));
              el.parentNode.appendChild(b);
            } else {
              el.classList.remove("clamp");
            }
          });
        });
        // Foto horizontal ocupa toda a largura; vertical mantém o formato 3x4
        elPubs.querySelectorAll(".pub-foto").forEach(function (im) {
          var ajustar = function () {
            if (im.naturalWidth > im.naturalHeight) im.classList.add("larga");
          };
          if (im.complete && im.naturalWidth) ajustar();
          else im.addEventListener("load", ajustar);
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
