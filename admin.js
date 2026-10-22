let content;
let inquiries = [];
let pendingDelete;

const $ = (selector, root = document) => root.querySelector(selector);
const sectionsRoot = $("#sections");

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "İşlem başarısız");
  return data;
}

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

function imageTitle(src) {
  return decodeURIComponent(src.split("/").pop()).replace(/\.[^.]+$/, "");
}

function notice(message, error = false) {
  const element = $("#notice");
  element.textContent = message;
  element.className = `notice${error ? " error-note" : ""}`;
  setTimeout(() => element.classList.add("hidden"), 4500);
}

async function loadInquiries() {
  inquiries = await request("/api/inquiries");
  renderInquiries();
}

function renderInquiries() {
  const root = $("#inquiries");
  const unread = inquiries.filter(item => !item.read).length;
  $("#inquiry-count").textContent = unread;
  $("#nav-inquiry-count").textContent = unread;
  if (!inquiries.length) {
    root.innerHTML = '<p class="empty">Henüz bir istek bulunmuyor.</p>';
    return;
  }
  root.innerHTML = inquiries.map(item => `
    <article class="inquiry ${item.read ? "" : "unread"}" data-inquiry="${item.id}">
      <div class="inquiry-top"><div><h3>${escapeHtml(item.name)}</h3><a class="inquiry-email" href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a></div><time>${new Date(item.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</time></div>
      <p class="inquiry-message">${escapeHtml(item.message)}</p>
      <div class="inquiry-actions"><a href="mailto:${escapeHtml(item.email)}?subject=Lagom Architecture">E-posta ile yanıtla</a><button data-inquiry-action="toggle-read">${item.read ? "Okunmadı yap" : "Okundu yap"}</button><button class="delete-inquiry" data-inquiry-action="delete">Sil</button></div>
    </article>`).join("");
}

function getBoundValue(path) {
  return path.split(".").reduce((value, key) => value[key], content);
}

function setBoundValue(path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((object, key) => object[key], content)[last] = value;
}

function bindGeneralFields() {
  document.querySelectorAll("[data-bind]").forEach(input => {
    input.value = getBoundValue(input.dataset.bind) || "";
    input.oninput = () => setBoundValue(input.dataset.bind, input.value);
  });
}

function render() {
  sectionsRoot.innerHTML = content.sections.map((section, sectionIndex) => `
    <section class="section-card" data-section="${sectionIndex}">
      <div class="section-top">
        <div class="section-fields">
          <label>Bölüm adı<input data-field="label" value="${escapeHtml(section.label)}"></label>
          <div class="drag-actions">
            <button class="icon" data-action="section-up" title="Yukarı taşı">↑</button>
            <button class="icon" data-action="section-down" title="Aşağı taşı">↓</button>
            <button class="icon" data-action="delete-section" title="Bölümü kaldır">×</button>
          </div>
        </div>
      </div>
      <div class="projects">
        ${section.projects.map((project, projectIndex) => projectTemplate(project, projectIndex)).join("")}
      </div>
      <button class="secondary add-project" data-action="add-project">+ Bu bölüme proje ekle</button>
    </section>`).join("");
}

function projectTemplate(project, projectIndex) {
  return `<article class="project" data-project="${projectIndex}">
    <div class="project-head"><h3>${escapeHtml(project.name || "Yeni proje")}</h3><div class="drag-actions"><button class="icon" data-action="project-up" title="Yukarı taşı">↑</button><button class="icon" data-action="project-down" title="Aşağı taşı">↓</button><button class="icon" data-action="delete-project" title="Projeyi kaldır">×</button></div></div>
    <div class="project-body">
      <div class="project-fields"><label>Proje adı<input data-project-field="name" value="${escapeHtml(project.name)}"></label><label>Yıl<input data-project-field="year" value="${escapeHtml(project.year)}"></label><label class="wide">Kısa açıklama<textarea data-project-field="description">${escapeHtml(project.description)}</textarea></label></div>
      <div class="images">${project.images.map((src, imageIndex) => `<div class="image-item" data-image="${imageIndex}"><img src="/${escapeHtml(src)}" alt="${escapeHtml(imageTitle(src))}"><div class="image-tools"><button data-action="image-left" title="Sola taşı">←</button><button data-action="image-right" title="Sağa taşı">→</button><button data-action="delete-image" title="Fotoğrafı kaldır">×</button></div></div>`).join("")}</div>
      <div class="upload"><label>+ Fotoğraf seç<input type="file" data-upload multiple accept="image/jpeg,image/png,image/webp"></label><small>Birden fazla fotoğraf seçebilirsiniz. Görseller otomatik olarak yüksek kaliteli WebP biçiminde hazırlanır.</small></div>
    </div>
  </article>`;
}

function move(array, from, to) {
  if (to < 0 || to >= array.length) return;
  array.splice(to, 0, array.splice(from, 1)[0]);
  render();
}

function askDelete(text, action) {
  $("#confirm-text").textContent = text;
  $("#confirm").classList.remove("hidden");
  pendingDelete = action;
}

async function optimizeImage(file) {
  if (file.size > 100 * 1024 * 1024) {
    throw new Error(`${file.name} 100 MB sınırını aşıyor`);
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const maxEdge = 2560;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/webp", 0.9);
}

sectionsRoot.addEventListener("input", event => {
  const sectionIndex = +event.target.closest("[data-section]").dataset.section;
  const section = content.sections[sectionIndex];
  if (event.target.dataset.field) section[event.target.dataset.field] = event.target.value;
  if (event.target.dataset.projectField) {
    const projectIndex = +event.target.closest("[data-project]").dataset.project;
    section.projects[projectIndex][event.target.dataset.projectField] = event.target.value;
    if (event.target.dataset.projectField === "name") event.target.closest(".project").querySelector("h3").textContent = event.target.value || "Yeni proje";
  }
});

sectionsRoot.addEventListener("change", async event => {
  if (!event.target.matches("[data-upload]")) return;
  const sectionIndex = +event.target.closest("[data-section]").dataset.section;
  const projectIndex = +event.target.closest("[data-project]").dataset.project;
  const files = [...event.target.files];
  if (!files.length) return;
  notice(`${files.length} fotoğraf yüksek kalitede hazırlanıyor...`);
  try {
    for (const file of files) {
      const data = await optimizeImage(file);
      const result = await request("/api/upload", { method: "POST", body: JSON.stringify({ name: file.name, data }) });
      content.sections[sectionIndex].projects[projectIndex].images.push(result.src);
    }
    render(); notice("Fotoğraflar eklendi. Kalıcı olması için değişiklikleri kaydedin.");
  } catch (error) { notice(error.message, true); }
});

sectionsRoot.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const sectionElement = button.closest("[data-section]");
  const sectionIndex = +sectionElement.dataset.section;
  const section = content.sections[sectionIndex];
  const projectElement = button.closest("[data-project]");
  const projectIndex = projectElement ? +projectElement.dataset.project : -1;
  const project = section.projects[projectIndex];
  const imageElement = button.closest("[data-image]");
  const imageIndex = imageElement ? +imageElement.dataset.image : -1;
  const actions = {
    "section-up": () => move(content.sections, sectionIndex, sectionIndex - 1),
    "section-down": () => move(content.sections, sectionIndex, sectionIndex + 1),
    "project-up": () => move(section.projects, projectIndex, projectIndex - 1),
    "project-down": () => move(section.projects, projectIndex, projectIndex + 1),
    "image-left": () => move(project.images, imageIndex, imageIndex - 1),
    "image-right": () => move(project.images, imageIndex, imageIndex + 1),
    "add-project": () => { section.projects.push({ id: id(), name: "Yeni Proje", year: String(new Date().getFullYear()), description: "", images: [] }); render(); },
    "delete-image": () => askDelete("Bu fotoğraf galeriden kaldırılsın mı?", () => { project.images.splice(imageIndex, 1); render(); }),
    "delete-project": () => askDelete(`“${project.name}” projesi kaldırılsın mı?`, () => { section.projects.splice(projectIndex, 1); render(); }),
    "delete-section": () => askDelete(`“${section.label}” bölümü ve içindeki projeler kaldırılsın mı?`, () => { content.sections.splice(sectionIndex, 1); render(); }),
  };
  actions[button.dataset.action]?.();
});

$("#add-section").onclick = () => {
  content.sections.push({ id: id(), label: "Yeni Bölüm", projects: [] });
  render();
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
};

$("#refresh-inquiries").onclick = () => loadInquiries().catch(error => notice(error.message, true));
document.querySelectorAll(".panel-tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".panel-tab").forEach(item => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".panel-view").forEach(view => view.classList.toggle("hidden", view.id !== tab.dataset.view));
    if (tab.dataset.view === "inquiries-view") loadInquiries().catch(error => notice(error.message, true));
  };
});
$("#inquiries").addEventListener("click", event => {
  const button = event.target.closest("[data-inquiry-action]");
  if (!button) return;
  const item = inquiries.find(entry => entry.id === button.closest("[data-inquiry]").dataset.inquiry);
  if (button.dataset.inquiryAction === "toggle-read") {
    request(`/api/inquiries/${item.id}`, { method: "PATCH", body: JSON.stringify({ read: !item.read }) })
      .then(loadInquiries).catch(error => notice(error.message, true));
  } else {
    askDelete(`“${item.name}” tarafından gönderilen istek silinsin mi?`, async () => {
      try { await request(`/api/inquiries/${item.id}`, { method: "DELETE" }); await loadInquiries(); notice("İstek silindi."); }
      catch (error) { notice(error.message, true); }
    });
  }
});

$("#save").onclick = async () => {
  try { await request("/api/content", { method: "PUT", body: JSON.stringify(content) }); notice("Değişiklikler kaydedildi ve siteye yansıtıldı."); }
  catch (error) { notice(error.message, true); }
};

$("#cancel").onclick = () => $("#confirm").classList.add("hidden");
$("#confirm-delete").onclick = () => { pendingDelete?.(); pendingDelete = null; $("#confirm").classList.add("hidden"); };
document.querySelectorAll(".collapse").forEach(button => button.onclick = () => { const body = button.closest(".box").querySelector(".box-body"); body.classList.toggle("hidden"); button.textContent = body.classList.contains("hidden") ? "+" : "−"; });

$("#login-form").onsubmit = async event => {
  event.preventDefault();
  try { await request("/api/login", { method: "POST", body: JSON.stringify({ username: $("#username").value.trim(), password: $("#password").value }) }); await start(); }
  catch (error) { $("#login-error").textContent = error.message; }
};

$("#logout").onclick = async () => { await request("/api/logout", { method: "POST" }); location.reload(); };

async function start() {
  [content, inquiries] = await Promise.all([request("/api/content"), request("/api/inquiries")]);
  $("#login").classList.add("hidden");
  $("#panel").classList.remove("hidden");
  bindGeneralFields(); render(); renderInquiries();
}

request("/api/session").then(session => session.authenticated && start()).catch(() => {});
