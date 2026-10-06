"use strict";
const C = window.APP_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ===== Listas de opções ===== */
const IDADES = ["+16", "+18", "+21"];
const ENTRADAS = ["Concurso Público", "Convite Direto", "Membro 25°BPM/M"];
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
function fillSel(sel, opts, labels, ph) {
  sel.innerHTML = (ph ? `<option value="" disabled selected>${esc(ph)}</option>` : "") + opts.map((o) => `<option value="${esc(o)}">${esc(labels ? labels[o] : o)}</option>`).join("");
}
function setSel(sel, v) { if (![...sel.options].some((o) => o.value === v)) sel.add(new Option(v, v)); sel.value = v; }

/* ===== Telas ===== */
function show(name) {
  $$(".view").forEach((v) => v.classList.remove("show"));
  const v = $("#v-" + name); void v.offsetWidth; v.classList.add("show");
}
function closeMenu() { $("#links").classList.remove("open"); $("#burger").setAttribute("aria-expanded", "false"); }
$("#burger").onclick = () => $("#burger").setAttribute("aria-expanded", $("#links").classList.toggle("open"));

const PAGES = ["inicio", "galeria", "sobre", "perfil", "admin"];
const SOON = ["rso", "bopm"];

function buildNav(page) {
  const l = [];
  if (me.status === "aprovado") l.push(["inicio", "Início"], ["galeria", "Galeria"], ["sobre", "Sobre"]);
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
  if (page === "galeria") loadGallery();
  if (page === "sobre") loadCommanders();
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
chips($("#c-idade"), IDADES); chips($("#c-entrada"), ENTRADAS);
fillSel($("#c-posto"), POSTOS, null, "Selecione seu posto ou graduação"); fillSel($("#c-cia"), CIAS, null, "Selecione sua companhia");
$$("[data-tab]").forEach((t) => t.onclick = () => {
  $$("[data-tab]").forEach((x) => x.classList.toggle("on", x === t));
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
  const f = { full_name: $("#c-nome").value.trim().replace(/\s+/g, " "), username: norm($("#c-user").value), age_range: $("#c-idade").dataset.value, entry_type: $("#c-entrada").dataset.value, rank: $("#c-posto").value, company: $("#c-cia").value };
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
  const { error } = await sb.storage.from("perfil").upload(path, file, { contentType: file.type });
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

async function loadUsers() {
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
  setSel($("#e-idade"), u.age_range); setSel($("#e-entrada"), u.entry_type); setSel($("#e-posto"), u.rank); setSel($("#e-cia"), u.company); setSel($("#e-role"), u.role);
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

/* ===== Apoio (Fase 2) ===== */
const TAGS = ["Operações", "Treinamentos", "Solenidades", "Patrulhamento", "Geral"];
const isAnyAdmin = () => me && ["admin_geral", "admin_sargenteante", "admin_relatorios"].includes(me.role);
const fmtDate = (d) => String(d || "").split("-").reverse().join("/");
const fmtTime = (t) => new Date(t).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const imgSrc = (u) => (typeof u === "string" && u.startsWith(C.SUPABASE_URL) ? u : "");
const today = () => new Date().toLocaleDateString("sv-SE");
const heart = '<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
const bubble = '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg>';

function compress(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
      c.toBlob((b) => b ? res(b) : rej(new Error("Falha ao processar a imagem.")), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Imagem inválida ou formato não suportado.")); };
    img.src = u;
  });
}
async function uploadImage(file, folder, max) {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Imagem muito grande (máximo 15 MB).");
  const blob = await compress(file, max);
  const path = `${folder}/${Date.now()}.jpg`;
  const { error } = await sb.storage.from("galeria").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Falha no envio: " + error.message);
  return sb.storage.from("galeria").getPublicUrl(path).data.publicUrl;
}
async function removeFile(url) {
  const m = String(url || "").split("/object/public/galeria/")[1];
  if (m) await sb.storage.from("galeria").remove([decodeURIComponent(m)]);
}
document.addEventListener("click", (e) => { if (e.target.closest("[data-newpost]")) openPost(null); });

/* ===== Galeria ===== */
let posts = [], likes = [], comments = [], gTag = "Todas", gLimit = 20;
const openCm = new Set();

async function loadGallery() {
  const { data, error } = await sb.from("gallery_posts").select("*").order("post_date", { ascending: false }).order("created_at", { ascending: false }).limit(gLimit);
  if (error) return toast("Erro ao carregar a galeria: " + error.message);
  posts = data;
  const ids = posts.map((p) => p.id);
  if (ids.length) {
    const [l, c] = await Promise.all([
      sb.from("gallery_likes").select("post_id,user_id").in("post_id", ids),
      sb.from("gallery_comments").select("id,post_id,user_id,body,created_at,profiles(full_name,rank)").in("post_id", ids).order("created_at")
    ]);
    likes = l.data || []; comments = c.data || [];
  } else { likes = []; comments = []; }
  renderGallery();
}
function postHTML(p, pin) {
  const pl = likes.filter((l) => l.post_id === p.id), liked = pl.some((l) => l.user_id === me.id);
  const pc = comments.filter((c) => c.post_id === p.id), open = openCm.has(p.id);
  const cms = pc.map((c) => `<div class="cm"><b>${esc((c.profiles?.rank ? c.profiles.rank + " " : "") + (c.profiles?.full_name || "Militar"))}</b><small>${fmtTime(c.created_at)}</small>${c.user_id === me.id || isAnyAdmin() ? `<button data-delc="${c.id}">Excluir</button>` : ""}<p>${esc(c.body)}</p></div>`).join("");
  return `<article class="card post${pin ? " pin" : ""}" data-id="${p.id}">
    <div class="phead"><span class="tag ac">${esc(p.tag)}</span><span class="date">${fmtDate(p.post_date)}</span></div>
    <img class="pimg" src="${esc(imgSrc(p.image_url))}" alt="${esc(p.title)}" loading="lazy">
    <div class="pbody2"><h3>${esc(p.title)}</h3>${p.caption ? `<p>${esc(p.caption)}</p>` : ""}
      <div class="pacts"><button class="act${liked ? " on" : ""}" data-like aria-label="Curtir">${heart}${pl.length}</button><button class="act" data-cm aria-label="Comentários">${bubble}${pc.length}</button></div>
      <div class="comments"${open ? "" : " hidden"}>${cms}<div class="cm-form"><input class="cm-in" maxlength="300" placeholder="Escreva um comentário..."><button class="btn small" data-send>Enviar</button></div></div>
    </div></article>`;
}
function renderGallery() {
  $("#g-tags").innerHTML = ["Todas", ...TAGS].map((t) => `<button type="button" class="chip${t === gTag ? " on" : ""}" data-t="${t}">${t}</button>`).join("");
  const list = posts.filter((p) => gTag === "Todas" || p.tag === gTag);
  $("#g-feed").innerHTML = list.length ? list.map((p) => postHTML(p, true)).join("") : `<p class="empty">Nenhuma publicação por aqui ainda.</p>`;
  $("#g-more").hidden = posts.length < gLimit;
  $("#g-new").hidden = !isAnyAdmin();
}
function refreshPost(id) {
  const el = $(`#g-feed .post[data-id="${id}"]`), p = posts.find((x) => x.id === id); if (!el || !p) return;
  const v = $(".cm-in", el)?.value || "";
  el.outerHTML = postHTML(p, false);
  const n = $(`#g-feed .post[data-id="${id}"] .cm-in`); if (n) n.value = v;
}
$("#g-tags").onclick = (e) => { const b = e.target.closest("[data-t]"); if (b) { gTag = b.dataset.t; renderGallery(); } };
$("#g-more").onclick = () => { gLimit += 20; loadGallery(); };

async function toggleLike(id) {
  const mine = likes.find((l) => l.post_id === id && l.user_id === me.id);
  if (mine) {
    likes = likes.filter((l) => l !== mine); refreshPost(id);
    const { error } = await sb.from("gallery_likes").delete().match({ post_id: id, user_id: me.id });
    if (error) { likes.push(mine); refreshPost(id); toast("Não foi possível remover a curtida."); }
  } else {
    const l = { post_id: id, user_id: me.id }; likes.push(l); refreshPost(id);
    const { error } = await sb.from("gallery_likes").insert(l);
    if (error) { likes = likes.filter((x) => x !== l); refreshPost(id); toast("Não foi possível curtir."); }
  }
}
async function sendComment(id, art) {
  const inp = $(".cm-in", art), body = inp.value.trim(); if (!body) return;
  inp.disabled = true;
  const { data, error } = await sb.from("gallery_comments").insert({ post_id: id, user_id: me.id, body }).select("id,post_id,user_id,body,created_at,profiles(full_name,rank)").single();
  if (error) { inp.disabled = false; return toast("Não foi possível comentar: " + error.message); }
  comments.push(data); openCm.add(id); refreshPost(id);
}
async function delComment(id, cid) {
  if (!confirm("Excluir este comentário?")) return;
  const { error } = await sb.from("gallery_comments").delete().eq("id", cid);
  if (error) return toast("Erro ao excluir: " + error.message);
  comments = comments.filter((c) => c.id !== cid); refreshPost(id);
}
$("#g-feed").onclick = (e) => {
  const art = e.target.closest(".post"); if (!art) return; const id = art.dataset.id;
  if (e.target.closest("[data-like]")) return toggleLike(id);
  if (e.target.closest("[data-cm]")) { openCm.has(id) ? openCm.delete(id) : openCm.add(id); return refreshPost(id); }
  if (e.target.closest("[data-send]")) return sendComment(id, art);
  const d = e.target.closest("[data-delc]"); if (d) delComment(id, d.dataset.delc);
};
$("#g-feed").onkeydown = (e) => {
  if (e.key === "Enter" && e.target.classList.contains("cm-in")) { e.preventDefault(); const art = e.target.closest(".post"); sendComment(art.dataset.id, art); }
};

/* Publicar / editar publicação */
let editingPost = null;
fillSel($("#gp-tag"), TAGS);
function openPost(p) {
  editingPost = p; $("#gp-err").hidden = true;
  $("#gp-title").textContent = p ? "Editar publicação" : "Nova publicação";
  $("#gp-t").value = p ? p.title : ""; $("#gp-tag").value = p ? p.tag : "Geral";
  $("#gp-date").value = p ? p.post_date : today(); $("#gp-cap").value = p ? p.caption : "";
  $("#gp-file").value = ""; $("#gp-file-wrap").hidden = !!p; $("#gp-save").textContent = p ? "Salvar" : "Publicar";
  $("#dlg-post").showModal();
}
$("#gp-cancel").onclick = () => $("#dlg-post").close();
$("#f-post").onsubmit = async (e) => {
  e.preventDefault();
  const err = $("#gp-err"); err.hidden = true;
  const f = { title: $("#gp-t").value.trim(), tag: $("#gp-tag").value, post_date: $("#gp-date").value, caption: $("#gp-cap").value.trim() };
  if (!f.title || !f.post_date) return showErr(err, "Preencha o título e a data.");
  const btn = $("#gp-save"); btn.disabled = true;
  try {
    const wasEdit = !!editingPost;
    if (wasEdit) {
      const { error } = await sb.from("gallery_posts").update(f).eq("id", editingPost.id); if (error) throw error;
    } else {
      const file = $("#gp-file").files[0]; if (!file) throw new Error("Escolha uma foto.");
      const url = await uploadImage(file, me.id, 1600);
      const { error } = await sb.from("gallery_posts").insert({ ...f, image_url: url, author_id: me.id });
      if (error) { await removeFile(url); throw error; }
    }
    $("#dlg-post").close(); toast(wasEdit ? "Publicação atualizada." : "Publicado!");
    loadGallery(); if (adminTab === "galeria") loadAdminPosts();
  } catch (ex) { showErr(err, ex.message || "Erro ao salvar."); }
  finally { btn.disabled = false; }
};

/* ===== Mural de comandantes ===== */
let commanders = [], editingCmd = null;
fillSel($("#cd-rank"), POSTOS);
async function loadCommanders() {
  const { data, error } = await sb.from("commanders").select("*").order("position").order("created_at");
  if (error) return toast("Erro ao carregar o mural: " + error.message);
  commanders = data; renderMural(); renderAdminMural();
}
function renderMural() {
  $("#s-mural").innerHTML = commanders.length ? commanders.map((c) => `<article class="card cmd"><div class="photo" style="background-image:${esc(bgUrl(c.photo_url))}">${c.photo_url ? "" : esc(initials(c.name))}</div><h3>${esc(c.name)}</h3><p>${esc(c.rank)}</p></article>`).join("") : `<p class="empty">Nenhum comandante cadastrado ainda.</p>`;
}
function renderAdminMural() {
  $("#am-list").innerHTML = commanders.length ? commanders.map((c) => `<div class="card item"><div class="ava" style="background-image:${esc(bgUrl(c.photo_url))}">${c.photo_url ? "" : esc(initials(c.name))}</div><div class="info"><b>${esc(c.name)}</b><span>${esc(c.rank)} · ordem ${c.position}</span></div><div class="acts"><button class="btn small ghost" data-ce="${c.id}">Editar</button><button class="btn small bad" data-cx="${c.id}">Excluir</button></div></div>`).join("") : `<p class="empty">Nenhum comandante cadastrado.</p>`;
}
function openCmd(c) {
  editingCmd = c; $("#cd-err").hidden = true; $("#cd-title").textContent = c ? "Editar comandante" : "Adicionar comandante";
  $("#cd-name").value = c ? c.name : ""; setSel($("#cd-rank"), c ? c.rank : "Coronel"); $("#cd-pos").value = c ? c.position : commanders.length; $("#cd-file").value = "";
  $("#dlg-cmd").showModal();
}
$("#am-new").onclick = () => openCmd(null);
$("#cd-cancel").onclick = () => $("#dlg-cmd").close();
$("#am-list").onclick = async (e) => {
  const ed = e.target.closest("[data-ce]"), dl = e.target.closest("[data-cx]");
  if (ed) return openCmd(commanders.find((c) => c.id === ed.dataset.ce));
  if (dl) {
    const c = commanders.find((x) => x.id === dl.dataset.cx);
    if (!c || !confirm(`Remover ${c.name} do mural?`)) return;
    const { error } = await sb.from("commanders").delete().eq("id", c.id);
    if (error) return toast("Erro ao remover: " + error.message);
    await removeFile(c.photo_url).catch(() => {}); loadCommanders(); toast("Removido do mural.");
  }
};
$("#f-cmd").onsubmit = async (e) => {
  e.preventDefault();
  const err = $("#cd-err"); err.hidden = true;
  const f = { name: $("#cd-name").value.trim(), rank: $("#cd-rank").value, position: parseInt($("#cd-pos").value, 10) || 0 };
  if (!f.name) return showErr(err, "Informe o nome.");
  const btn = $("#cd-save"); btn.disabled = true;
  try {
    const file = $("#cd-file").files[0]; let oldPhoto = null;
    if (file) { f.photo_url = await uploadImage(file, "mural", 800); oldPhoto = editingCmd?.photo_url; }
    const q = editingCmd ? sb.from("commanders").update(f).eq("id", editingCmd.id) : sb.from("commanders").insert(f);
    const { error } = await q;
    if (error) { if (f.photo_url) await removeFile(f.photo_url); throw error; }
    if (oldPhoto) await removeFile(oldPhoto).catch(() => {});
    $("#dlg-cmd").close(); toast("Mural atualizado."); loadCommanders();
  } catch (ex) { showErr(err, ex.message || "Erro ao salvar."); }
  finally { btn.disabled = false; }
};

/* ===== Painel Admin: abas ===== */
let adminTab = "contas";
function openAdminTab(t) {
  adminTab = t;
  $$("#a-tabs [data-at]").forEach((b) => b.classList.toggle("on", b.dataset.at === t));
  ["contas", "galeria", "mural"].forEach((x) => $("#a-" + x).hidden = x !== t);
  if (t === "contas") loadUsers(); if (t === "galeria") loadAdminPosts(); if (t === "mural") loadCommanders();
}
function loadAdmin() { openAdminTab(adminTab); }
$("#a-tabs").onclick = (e) => { const b = e.target.closest("[data-at]"); if (b) openAdminTab(b.dataset.at); };

let adminPosts = [];
async function loadAdminPosts() {
  const { data, error } = await sb.from("gallery_posts").select("*").order("post_date", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  if (error) return toast("Erro ao carregar publicações: " + error.message);
  adminPosts = data;
  $("#ag-list").innerHTML = data.length ? data.map((p) => `<div class="card item"><div class="thumb" style="background-image:${esc(bgUrl(p.image_url))}"></div><div class="info"><b>${esc(p.title)}</b><span>${esc(p.tag)} · ${fmtDate(p.post_date)}</span></div><div class="acts"><button class="btn small ghost" data-pe="${p.id}">Editar</button><button class="btn small bad" data-px="${p.id}">Excluir</button></div></div>`).join("") : `<p class="empty">Nenhuma publicação.</p>`;
}
$("#ag-list").onclick = async (e) => {
  const ed = e.target.closest("[data-pe]"), dl = e.target.closest("[data-px]");
  if (ed) return openPost(adminPosts.find((p) => p.id === ed.dataset.pe));
  if (dl) {
    const p = adminPosts.find((x) => x.id === dl.dataset.px);
    if (!p || !confirm(`Excluir a publicação "${p.title}"? Curtidas e comentários também serão apagados.`)) return;
    const { error } = await sb.from("gallery_posts").delete().eq("id", p.id);
    if (error) return toast("Erro ao excluir: " + error.message);
    await removeFile(p.image_url).catch(() => {}); loadAdminPosts(); toast("Publicação excluída.");
  }
};

/* ===== Fundo (troca a cada 8 segundos) e animações ===== */
const slides = $$("#bg .slide"); let cur = 0;
setInterval(() => { slides[cur].classList.remove("on"); cur = (cur + 1) % slides.length; slides[cur].classList.add("on"); }, 8000);
const io = "IntersectionObserver" in window ? new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("vis"); io.unobserve(x.target); } }), { threshold: 0.15 }) : null;
$$(".reveal").forEach((el, i) => { el.style.transitionDelay = (i % 5) * 80 + "ms"; io ? io.observe(el) : el.classList.add("vis"); });

if (sb) sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && me) { me = null; route(); } });
boot();
