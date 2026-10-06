"use strict";
const C = window.APP_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ===== Listas de opções ===== */
const IDADES = ["+16", "+18", "+21"];
const ENTRADAS = ["Concurso Público", "Convite Direto", "Membro 25°BPM/M", "Founder"];
const POSTOS = ["Aluno Soldado", "Soldado 1°Classe", "Cabo", "Aluno Sargento", "3°Sargento", "2°Sargento", "1°Sargento", "Subtenente", "Aluno Oficial", "Aspirante à Oficial", "2°Tenente", "1°Tenente", "Capitão", "Major", "Tenente Coronel", "Coronel"];
const CIAS = ["1°Cia - RP", "2°Cia - RP", "3°Cia - RP", "4°Cia - RP", "5°Cia - Força Tática", "Comandante do Batalhão"];
const ROLES = { membro: "Membro", admin_geral: "Admin Geral", admin_sargenteante: "Admin Sargenteante", admin_relatorios: "Admin de Relatórios" };
const STATUS = { pendente: ["Pendente", "warn"], aprovado: ["Aprovado", "ok"], reprovado: ["Reprovado", "bad"], vetado: ["Vetado", "bad"] };

const configured = /^https?:\/\//.test(C.SUPABASE_URL || "") && C.SUPABASE_ANON_KEY && !String(C.SUPABASE_ANON_KEY).startsWith("COLE") && window.supabase;
const sb = configured ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
let me = null;

/* ===== Utilidades ===== */
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 3200);
}
function showErr(el, msg) { el.textContent = msg; el.hidden = false; }
const norm = (u) => String(u || "").trim().replace(/^@/, "").toLowerCase();
const validUser = (u) => u.length >= 3 && /^(?!.*\.\.)[a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?$/.test(u);
const initials = (n) => String(n || "?").split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
const bgUrl = (u) => (typeof u === "string" && u.startsWith(C.SUPABASE_URL) ? `url("${u.replace(/"/g, "%22")}")` : "");
const canAdmin = () => me && ["admin_geral", "admin_sargenteante"].includes(me.role);
const isGeral = () => me && me.role === "admin_geral";

function chips(el, opts, pick) {
  el.dataset.value = "";
  el.innerHTML = opts.map((o) => `<button type="button" class="chip" data-v="${esc(o)}">${esc(o)}</button>`).join("");
  el.onclick = (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    $$(".chip", el).forEach((c) => c.classList.toggle("on", c === b));
    el.dataset.value = b.dataset.v; if (pick) pick(b.dataset.v);
  };
}
function fillSel(sel, opts, labels) {
  sel.innerHTML = opts.map((o) => `<option value="${esc(o)}">${esc(labels ? labels[o] : o)}</option>`).join("");
}

/* ===== Telas ===== */
function show(name) {
  $$(".view").forEach((v) => v.classList.remove("show"));
  const v = $("#v-" + name); void v.offsetWidth; v.classList.add("show");
}
function closeMenu() { $("#links").classList.remove("open"); $("#burger").setAttribute("aria-expanded", "false"); }
$("#burger").onclick = () => $("#burger").setAttribute("aria-expanded", $("#links").classList.toggle("open"));

const PAGES = ["inicio", "perfil", "admin"];
const SOON = ["galeria", "sobre", "rso", "bopm"];

function buildNav(page) {
  const l = [];
  if (me.status === "aprovado") l.push(["inicio", "Início"]);
  l.push(["perfil", "Perfil"]);
  if (me.status === "aprovado" && canAdmin()) l.push(["admin", "Admin"]);
  $("#links").innerHTML = l.map(([h, t]) => `<a href="#${h}" class="${h === page ? "active" : ""}">${t}</a>`).join("") + `<button data-logout>Sair</button>`;
}

function route() {
  closeMenu();
  const blocked = me && ["vetado", "reprovado"].includes(me.status);
  $("#nav").hidden = !me || blocked;
  document.body.classList.toggle("noauth", !me || blocked);
  if (!me) { document.body.classList.add("home"); return show("auth"); }
  if (blocked) {
    document.body.classList.add("home");
    $("#b-title").textContent = me.status === "vetado" ? "Acesso vetado" : "Cadastro reprovado";
    $("#b-text").textContent = me.status === "vetado" ? "Seu acesso ao portal foi vetado pela administração. Procure o comando do 7°BPM/M." : "Seu cadastro não foi aprovado. Procure a Administração do 7°BPM/M.";
    return show("blocked");
  }
  let page = location.hash.slice(1) || "inicio";
  if (me.status !== "aprovado") page = "perfil";
  else if (page === "admin" && !canAdmin()) page = "inicio";
  else if (!PAGES.includes(page) && !SOON.includes(page)) page = "inicio";
  if (location.hash.slice(1) !== page) history.replaceState(null, "", "#" + page);
  document.body.classList.toggle("home", page === "inicio");
  buildNav(page);
  if (page === "perfil") renderProfile();
  if (page === "admin") loadAdmin();
  show(PAGES.includes(page) ? page : "soon");
  window.scrollTo({ top: 0 });
}
window.addEventListener("hashchange", () => me && route());

/* ===== Sessão ===== */
async function fetchProfile(id) {
  const { data, error } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
  return error ? null : data;
}
async function boot() {
  if (!sb) { $("#cfg-warn").hidden = false; return route(); }
  const { data: { session } } = await sb.auth.getSession();
  me = session ? await fetchProfile(session.user.id) : null;
  if (session && !me) await sb.auth.signOut();
  route();
}
async function logout() {
  if (sb) await sb.auth.signOut();
  me = null; history.replaceState(null, "", location.pathname); route();
}
document.addEventListener("click", (e) => { if (e.target.closest("[data-logout]")) logout(); });
// Conta pendente: confere a cada 30s se já foi aprovada
setInterval(async () => {
  if (!sb || !me || me.status === "aprovado") return;
  const p = await fetchProfile(me.id);
  if (p && p.status !== me.status) { me = p; route(); if (p.status === "aprovado") toast("Sua conta foi aprovada!"); }
}, 30000);

/* ===== Login e cadastro ===== */
chips($("#c-idade"), IDADES); chips($("#c-entrada"), ENTRADAS); chips($("#c-posto"), POSTOS); chips($("#c-cia"), CIAS);
$$(".tab").forEach((t) => t.onclick = () => {
  $$(".tab").forEach((x) => x.classList.toggle("on", x === t));
  $("#f-login").hidden = t.dataset.tab !== "login"; $("#f-cad").hidden = t.dataset.tab !== "cadastro";
});

$("#f-login").onsubmit = async (e) => {
  e.preventDefault();
  const err = $("#l-err"); err.hidden = true;
  if (!sb) return showErr(err, "Site ainda não configurado (veja o LEIA-ME.md).");
  const u = norm($("#l-user").value);
  if (!validUser(u)) return showErr(err, "Informe um nome de usuário válido.");
  const btn = $("#l-btn"); btn.disabled = true;
  try {
    const { data: em } = await sb.rpc("login_email", { p_username: u });
    const { error } = await sb.auth.signInWithPassword({ email: em || `${u}@${C.EMAIL_DOMAIN}`, password: $("#l-pass").value });
    if (error) return showErr(err, "Usuário ou senha incorretos.");
    $("#l-pass").value = ""; await boot();
  } catch { showErr(err, "Erro de conexão. Tente novamente."); }
  finally { btn.disabled = false; }
};

$("#f-cad").onsubmit = async (e) => {
  e.preventDefault();
  const err = $("#c-err"); err.hidden = true;
  if (!sb) return showErr(err, "Site ainda não configurado (veja o LEIA-ME.md).");
  const f = { full_name: $("#c-nome").value.trim().replace(/\s+/g, " "), username: norm($("#c-user").value), age_range: $("#c-idade").dataset.value, entry_type: $("#c-entrada").dataset.value, rank: $("#c-posto").dataset.value, company: $("#c-cia").dataset.value };
  const pass = $("#c-pass").value;
  if (!/\S+ \S+/.test(f.full_name)) return showErr(err, "Informe Nome e Sobrenome.");
  if (!validUser(f.username)) return showErr(err, "Usuário inválido: use letras minúsculas, números, ponto, hífen ou underline (mín. 3).");
  if (!f.age_range || !f.entry_type || !f.rank || !f.company) return showErr(err, "Selecione todas as opções (idade, entrada, posto e companhia).");
  if (pass.length < 8) return showErr(err, "A senha deve ter pelo menos 8 caracteres.");
  if (pass !== $("#c-pass2").value) return showErr(err, "As senhas não conferem.");
  const btn = $("#c-btn"); btn.disabled = true;
  try {
    const { data, error } = await sb.auth.signUp({ email: `${f.username}@${C.EMAIL_DOMAIN}`, password: pass, options: { data: f } });
    if (error) {
      if (/database|already|registered|unique|duplicate/i.test(error.message)) return showErr(err, "Já existe uma conta com esse usuário ou esse Nome e Sobrenome.");
      if (/invalid/i.test(error.message) && /email/i.test(error.message)) return showErr(err, "O Supabase recusou o e-mail interno. Altere EMAIL_DOMAIN no config.js.");
      return showErr(err, error.message);
    }
    if (!data.session) return showErr(err, "Conta criada, mas a confirmação de e-mail está ativa no Supabase. Desative 'Confirm email' (veja o LEIA-ME.md).");
    await boot(); toast("Conta criada! Complete seu perfil enquanto aguarda a aprovação.");
  } catch { showErr(err, "Erro de conexão. Tente novamente."); }
  finally { btn.disabled = false; }
};

/* ===== Perfil ===== */
function renderProfile() {
  $("#p-pending").hidden = me.status === "aprovado";
  $("#p-banner").style.backgroundImage = bgUrl(me.banner_url);
  const av = $("#p-avatar"); av.style.backgroundImage = bgUrl(me.avatar_url); av.textContent = me.avatar_url ? "" : initials(me.full_name);
  $("#p-name").textContent = me.full_name; $("#p-user").textContent = "@" + me.username;
  const tags = [`<span class="tag ac">${esc(me.rank)}</span>`, `<span class="tag">${esc(me.company)}</span>`];
  if (me.role !== "membro") tags.push(`<span class="tag ac">${ROLES[me.role]}</span>`);
  if (me.status !== "aprovado") tags.push(`<span class="tag warn">${STATUS[me.status][0]}</span>`);
  $("#p-tags").innerHTML = tags.join("");
  $("#p-bio").value = me.bio || "";
}
async function upload(kind, file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("Escolha um arquivo de imagem.");
  if (file.size > 3 * 1024 * 1024) return toast("Imagem muito grande (máximo 3 MB).");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${me.id}/${kind}-${Date.now()}.${ext}`;
  toast("Enviando...");
  const { error } = await sb.storage.from("perfil").upload(path, file, { upsert: true, contentType: file.type });
  if (error) return toast("Falha no envio: " + error.message);
  const url = sb.storage.from("perfil").getPublicUrl(path).data.publicUrl;
  const { error: e2 } = await sb.from("profiles").update({ [kind + "_url"]: url }).eq("id", me.id);
  if (e2) return toast("Não foi possível salvar: " + e2.message);
  me[kind + "_url"] = url; renderProfile(); toast("Perfil atualizado!");
}
$("#p-avatar-in").onchange = (e) => { upload("avatar", e.target.files[0]); e.target.value = ""; };
$("#p-banner-in").onchange = (e) => { upload("banner", e.target.files[0]); e.target.value = ""; };
$("#p-save").onclick = async () => {
  const bio = $("#p-bio").value.trim().slice(0, 400);
  const { error } = await sb.from("profiles").update({ bio }).eq("id", me.id);
  if (error) return toast("Erro ao salvar: " + error.message);
  me.bio = bio; toast("Biografia salva!");
};

/* ===== Painel Admin ===== */
let users = [], fStatus = "todos", fText = "";
const FILTERS = { todos: "Todos", pendente: "Pendentes", aprovado: "Aprovados", reprovado: "Reprovados", vetado: "Vetados" };

async function loadAdmin() {
  const { data, error } = await sb.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) return toast("Erro ao carregar contas: " + error.message);
  users = data; renderAdmin();
}
function renderAdmin() {
  const f = $("#a-filters");
  f.innerHTML = Object.entries(FILTERS).map(([k, t]) => `<button type="button" class="chip ${k === fStatus ? "on" : ""}" data-k="${k}">${t} (${k === "todos" ? users.length : users.filter((u) => u.status === k).length})</button>`).join("");
  f.onclick = (e) => { const b = e.target.closest(".chip"); if (b) { fStatus = b.dataset.k; renderAdmin(); } };
  const q = fText.toLowerCase();
  const rows = users.filter((u) => (fStatus === "todos" || u.status === fStatus) && (!q || (u.full_name + " " + u.username).toLowerCase().includes(q)));
  $("#a-list").innerHTML = rows.length ? rows.map((u) => {
    const protectedRow = u.role === "admin_geral" && !isGeral();
    const self = u.id === me.id;
    const a = [];
    if (!protectedRow) {
      if (!self) {
        if (u.status !== "aprovado") a.push(["aprovar", u.status === "vetado" ? "Reativar" : "Aprovar", "ok"]);
        if (u.status === "pendente" || u.status === "aprovado") a.push(["reprovar", "Reprovar", "bad"]);
        if (u.status !== "vetado") a.push(["vetar", "Vetar", "bad"]);
      }
      a.push(["editar", "Editar", "ghost"]);
    }
    return `<div class="card item"><div class="ava" style="background-image:${esc(bgUrl(u.avatar_url))}">${u.avatar_url ? "" : esc(initials(u.full_name))}</div>
      <div class="info"><b>${esc(u.full_name)}</b><span>@${esc(u.username)} · ${esc(u.rank)} · ${esc(u.company)} · ${esc(u.age_range)} · ${esc(u.entry_type)}</span>
      <div class="tags"><span class="tag ${STATUS[u.status][1]}">${STATUS[u.status][0]}</span>${u.role !== "membro" ? `<span class="tag ac">${ROLES[u.role]}</span>` : ""}</div></div>
      <div class="acts">${a.map(([k, t, c]) => `<button class="btn small ${c}" data-act="${k}" data-id="${u.id}">${t}</button>`).join("")}</div></div>`;
  }).join("") : `<p class="empty">Nenhuma conta encontrada.</p>`;
}
$("#a-search").oninput = (e) => { fText = e.target.value.trim(); renderAdmin(); };

async function setStatus(u, status) {
  const { error } = await sb.from("profiles").update({ status }).eq("id", u.id);
  if (error) return toast("Erro: " + error.message);
  u.status = status; renderAdmin(); toast(`${u.full_name}: ${STATUS[status][0].toLowerCase()}.`);
}
$("#a-list").onclick = (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const u = users.find((x) => x.id === b.dataset.id); if (!u) return;
  const act = b.dataset.act;
  if (act === "aprovar") setStatus(u, "aprovado");
  else if (act === "reprovar") { if (confirm(`Reprovar a conta de ${u.full_name}?`)) setStatus(u, "reprovado"); }
  else if (act === "vetar") { if (confirm(`Vetar o acesso de ${u.full_name}?`)) setStatus(u, "vetado"); }
  else if (act === "editar") openEdit(u);
};

/* Edição de conta */
let editing = null;
fillSel($("#e-idade"), IDADES); fillSel($("#e-entrada"), ENTRADAS); fillSel($("#e-posto"), POSTOS); fillSel($("#e-cia"), CIAS); fillSel($("#e-role"), Object.keys(ROLES), ROLES);
function openEdit(u) {
  editing = u; $("#e-err").hidden = true;
  $("#e-nome").value = u.full_name; $("#e-user").value = u.username;
  $("#e-idade").value = u.age_range; $("#e-entrada").value = u.entry_type; $("#e-posto").value = u.rank; $("#e-cia").value = u.company; $("#e-role").value = u.role;
  $("#e-role-wrap").hidden = !isGeral();
  $("#dlg").showModal();
}
$("#e-cancel").onclick = () => $("#dlg").close();
$("#f-edit").onsubmit = async (e) => {
  e.preventDefault();
  const err = $("#e-err"); err.hidden = true;
  const patch = { full_name: $("#e-nome").value.trim().replace(/\s+/g, " "), username: norm($("#e-user").value), age_range: $("#e-idade").value, entry_type: $("#e-entrada").value, rank: $("#e-posto").value, company: $("#e-cia").value };
  if (!/\S+ \S+/.test(patch.full_name)) return showErr(err, "Informe Nome e Sobrenome.");
  if (!validUser(patch.username)) return showErr(err, "Usuário inválido.");
  if (isGeral()) patch.role = $("#e-role").value;
  const { error } = await sb.from("profiles").update(patch).eq("id", editing.id);
  if (error) return showErr(err, /duplicate|unique/i.test(error.message) ? "Já existe outra conta com esse usuário ou nome." : error.message);
  Object.assign(editing, patch); $("#dlg").close(); renderAdmin(); toast("Conta atualizada.");
};

/* ===== Fundo (troca a cada 8 segundos) e animações ===== */
const slides = $$("#bg .slide"); let cur = 0;
setInterval(() => { slides[cur].classList.remove("on"); cur = (cur + 1) % slides.length; slides[cur].classList.add("on"); }, 8000);
const io = "IntersectionObserver" in window ? new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("vis"); io.unobserve(x.target); } }), { threshold: 0.15 }) : null;
$$(".reveal").forEach((el, i) => { el.style.transitionDelay = (i % 5) * 80 + "ms"; io ? io.observe(el) : el.classList.add("vis"); });

if (sb) sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && me) { me = null; route(); } });
boot();
