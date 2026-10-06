/* ====== CONFIGURAÇÃO ======
   Senha do painel Admin (troque aqui).
   ATENÇÃO: como o site é estático (GitHub Pages), essa senha fica visível no código.
   Serve para uso casual; não protege dados realmente sensíveis. */
const ADMIN_PASSWORD = "admin123";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const DEFAULT_COURSES = [
  { id: 1, nome: "Abordagem Tática", desc: "Procedimentos de abordagem, cobertura e comunicação via rádio." },
  { id: 2, nome: "Direção Defensiva e Escolta", desc: "Condução de viaturas em ocorrência e escolta de comboio." },
  { id: 3, nome: "Primeiros Socorros em Combate", desc: "Atendimento inicial a feridos em cenário operacional." },
  { id: 4, nome: "Negociação de Reféns", desc: "Protocolos de contato, perímetro e tomada de decisão." }
];

let state = {
  courses: load("pb_courses", DEFAULT_COURSES),
  done: load("pb_done", []),
  gallery: load("pb_gallery", []),
  reports: load("pb_reports", []),
  admin: sessionStorage.getItem("pb_admin") === "1"
};

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2400);
}

/* ====== NAVEGAÇÃO ====== */
const pages = $$(".page").map((p) => p.id);
function route() {
  const id = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : "inicio";
  $$(".page").forEach((p) => p.classList.toggle("show", p.id === id));
  document.body.classList.toggle("home", id === "inicio");
  $$(".links a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
  $("#links").classList.remove("open");
  $("#burger").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0 });
}
window.addEventListener("hashchange", route);
window.addEventListener("scroll", () => $("#nav").classList.toggle("scrolled", scrollY > 8), { passive: true });
$("#burger").onclick = () => {
  const open = $("#links").classList.toggle("open");
  $("#burger").setAttribute("aria-expanded", open);
};

/* ====== INÍCIO ====== */
function renderStats() {
  $("#st-rel").textContent = state.reports.length;
  $("#st-cur").textContent = state.done.length;
  $("#st-gal").textContent = state.gallery.length;
}

/* ====== GALERIA ====== */
function renderGallery() {
  const g = $("#gallery");
  if (!state.gallery.length) {
    g.innerHTML = '<p class="empty">Nenhuma foto ainda. Um administrador pode adicionar fotos no painel Admin.</p>';
    return;
  }
  g.innerHTML = state.gallery.map((f, i) =>
    `<button class="shot" data-i="${i}"><img src="${esc(f.url)}" alt="${esc(f.cap || "Foto do batalhão")}" loading="lazy"><em>${esc(f.cap || "")}</em></button>`).join("");
  $$(".shot").forEach((b) => b.onclick = () => {
    const f = state.gallery[b.dataset.i];
    $("#lb img").src = f.url; $("#lb p").textContent = f.cap || "";
    $("#lb").hidden = false;
  });
}
$("#lb").onclick = () => $("#lb").hidden = true;
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#lb").hidden = true; });

/* ====== CURSOS ====== */
function renderCourses() {
  $("#courses").innerHTML = state.courses.map((c) => {
    const ok = state.done.includes(c.id);
    return `<article class="card course ${ok ? "done" : ""}"><div><h3>${esc(c.nome)}</h3><p>${esc(c.desc)}</p></div>
      <button class="btn ${ok ? "ghost" : ""}" data-id="${c.id}">${ok ? "Concluído" : "Marcar como concluído"}</button></article>`;
  }).join("");
  $$("#courses .btn").forEach((b) => b.onclick = () => {
    const id = +b.dataset.id;
    state.done = state.done.includes(id) ? state.done.filter((x) => x !== id) : [...state.done, id];
    save("pb_done", state.done); renderCourses(); renderStats();
  });
  const pct = state.courses.length ? Math.round(state.done.filter((id) => state.courses.some((c) => c.id === id)).length / state.courses.length * 100) : 0;
  $("#bar").style.width = pct + "%";
}

/* ====== RELATÓRIOS ====== */
const fmt = (d) => d ? d.split("-").reverse().join("/") : "";
function reportHTML(r, admin) {
  return `<div class="item"><small>${fmt(r.data)} · ${esc(r.dur)} min</small><b>${esc(r.nome)}</b> — ${esc(r.pat)}<p>${esc(r.atv)}</p>${admin ? `<button data-del="${r.id}">Excluir</button>` : ""}</div>`;
}
function renderReports() {
  const l = $("#r-list");
  l.innerHTML = state.reports.length ? state.reports.slice(0, 5).map((r) => reportHTML(r)).join("") : '<p class="empty">Nenhum relatório enviado neste navegador.</p>';
  const a = $("#a-list");
  a.innerHTML = state.reports.length ? state.reports.map((r) => reportHTML(r, true)).join("") : '<p class="empty">Sem relatórios.</p>';
  $$("[data-del]").forEach((b) => b.onclick = () => {
    state.reports = state.reports.filter((r) => r.id !== +b.dataset.del);
    save("pb_reports", state.reports); renderReports(); renderStats();
  });
}
$("#r-send").onclick = () => {
  const r = { id: Date.now(), nome: $("#r-nome").value.trim(), pat: $("#r-pat").value.trim(), data: $("#r-data").value, dur: $("#r-dur").value, atv: $("#r-atv").value.trim() };
  if (!r.nome || !r.pat || !r.data || !r.atv) return toast("Preencha todos os campos obrigatórios");
  state.reports.unshift(r); save("pb_reports", state.reports);
  ["#r-nome", "#r-pat", "#r-data", "#r-dur", "#r-atv"].forEach((s) => $(s).value = "");
  renderReports(); renderStats(); toast("Relatório enviado");
};

/* ====== ADMIN ====== */
function renderAdmin() {
  $("#gate").hidden = state.admin;
  $("#panel").hidden = !state.admin;
}
$("#a-login").onclick = () => {
  if ($("#a-pass").value === ADMIN_PASSWORD) {
    state.admin = true; sessionStorage.setItem("pb_admin", "1");
    $("#a-err").hidden = true; $("#a-pass").value = ""; renderAdmin();
  } else $("#a-err").hidden = false;
};
$("#a-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#a-login").click(); });
$("#a-out").onclick = () => { state.admin = false; sessionStorage.removeItem("pb_admin"); renderAdmin(); };
$("#g-add").onclick = () => {
  const url = $("#g-url").value.trim();
  if (!/^https?:\/\//.test(url)) return toast("Informe uma URL válida (http/https)");
  state.gallery.unshift({ url, cap: $("#g-cap").value.trim() });
  save("pb_gallery", state.gallery); $("#g-url").value = $("#g-cap").value = "";
  renderGallery(); renderStats(); toast("Foto adicionada");
};
$("#c-add").onclick = () => {
  const nome = $("#c-nome").value.trim();
  if (!nome) return toast("Informe o nome do curso");
  state.courses.push({ id: Date.now(), nome, desc: $("#c-desc").value.trim() });
  save("pb_courses", state.courses); $("#c-nome").value = $("#c-desc").value = "";
  renderCourses(); toast("Curso adicionado");
};
$("#a-export").onclick = () => {
  if (!state.reports.length) return toast("Sem relatórios para exportar");
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = "Data,Nome,Patente,Duracao,Atividades\n" + state.reports.map((r) => [r.data, r.nome, r.pat, r.dur, r.atv].map(q).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
  a.download = "relatorios.csv"; a.click();
};

/* ====== FUNDO DO INÍCIO (troca a cada 8 segundos) ====== */
const slides = $$("#bg .slide");
let cur = 0;
setInterval(() => {
  slides[cur].classList.remove("on");
  cur = (cur + 1) % slides.length;
  slides[cur].classList.add("on");
}, 8000);

/* ====== INICIALIZAÇÃO ====== */
renderStats(); renderGallery(); renderCourses(); renderReports(); renderAdmin(); route();
