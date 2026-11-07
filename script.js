const STORAGE_KEY = "todo-list-tasks";
const THEME_KEY = "todo-list-theme";

/* ===================== Stockage ===================== */
function generateId() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function toISODate(timestamp) {
  const d = new Date(timestamp);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/* Compatible avec l'ancien format { id, text, completed, createdAt } */
function normalizeTask(task) {
  const createdAt = Number(task.createdAt) || Date.now();
  const status =
    task.status === "terminee" || task.status === "en-cours"
      ? task.status
      : task.completed
        ? "terminee"
        : "en-cours";
  return {
    id: task.id || generateId(),
    title: String(task.title ?? task.text ?? "").trim() || "Sans titre",
    description: String(task.description ?? ""),
    date: task.date || toISODate(createdAt),
    time: /^\d{2}:\d{2}$/.test(task.time || "") ? task.time : "",
    status,
    createdAt,
  };
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeTask) : [];
  } catch (error) {
    console.warn("Impossible de lire localStorage.", error);
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/* ===================== Utilitaires ===================== */
function formatRemaining(count) {
  if (count === 0) return "Aucune tâche restante";
  if (count === 1) return "1 tâche restante";
  return `${count} tâches restantes`;
}

function nowTime() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function updateCounters(tasks) {
  const remaining = tasks.filter((t) => t.status !== "terminee").length;
  const remainingEl = document.getElementById("remaining");
  const totalBadge = document.getElementById("total-badge");
  if (remainingEl) remainingEl.textContent = formatRemaining(remaining);
  if (totalBadge) totalBadge.textContent = String(tasks.length);
}

/* ===================== Thème clair / sombre ===================== */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
}

function initTheme() {
  let theme = null;
  try {
    theme = localStorage.getItem(THEME_KEY);
  } catch (e) {
    /* ignoré */
  }
  if (!theme) {
    theme =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  }
  applyTheme(theme);

  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const next =
        document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        /* ignoré */
      }
      applyTheme(next);
    });
  }
}

/* ===================== Page d'accueil ===================== */
function initHome() {
  const form = document.getElementById("todo-form");
  const titleInput = document.getElementById("todo-input");
  const descInput = document.getElementById("todo-description");
  const dateInput = document.getElementById("todo-date");
  const timeInput = document.getElementById("todo-time");
  const statusInput = document.getElementById("todo-status");
  const titleError = document.getElementById("title-error");
  const dateError = document.getElementById("date-error");
  const confirmation = document.getElementById("confirmation");
  let hideTimer;

  dateInput.value = toISODate(Date.now());
  timeInput.value = nowTime();
  updateCounters(loadTasks());

  titleInput.addEventListener("input", () => {
    if (titleInput.value.trim()) {
      titleInput.classList.remove("invalid");
      titleError.hidden = true;
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const date = dateInput.value;

    titleError.hidden = Boolean(title);
    dateError.hidden = Boolean(date);
    titleInput.classList.toggle("invalid", !title);
    dateInput.classList.toggle("invalid", !date);
    if (!title || !date) {
      (title ? dateInput : titleInput).focus();
      return;
    }

    const tasks = loadTasks();
    tasks.unshift({
      id: generateId(),
      title,
      description: descInput.value.trim(),
      date,
      time: timeInput.value,
      status: statusInput.value,
      createdAt: Date.now(),
    });
    saveTasks(tasks);
    updateCounters(tasks);

    form.reset();
    dateInput.value = toISODate(Date.now());
    timeInput.value = nowTime();
    titleInput.focus();

    confirmation.hidden = false;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      confirmation.hidden = true;
    }, 8000);
  });
}

/* ===================== Page « Mes tâches » ===================== */
function initTasksPage() {
  const list = document.getElementById("todo-list");
  const emptyState = document.getElementById("empty-state");
  const totalCount = document.getElementById("total-count");
  const visibleCount = document.getElementById("visible-count");
  const chips = document.querySelectorAll(".chip");

  const editDialog = document.getElementById("edit-dialog");
  const editForm = document.getElementById("edit-form");
  const deleteDialog = document.getElementById("delete-dialog");

  let filter = "all";
  let editingId = null;
  let deletingId = null;

  function renderChart(tasks) {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "terminee").length;
    const progress = total - done;
    const pctProgress = total ? Math.round((progress / total) * 100) : 0;
    const pctDone = total ? 100 - pctProgress : 0;
    const pie = document.getElementById("pie");

    pie.classList.toggle("empty", total === 0);
    pie.style.setProperty("--p", total ? (progress / total) * 100 : 0);
    pie.setAttribute(
      "aria-label",
      total
        ? `Diagramme circulaire : ${progress} en cours, ${done} terminées, sur ${total} tâches`
        : "Diagramme circulaire : aucune tâche"
    );
    document.getElementById("count-progress").textContent = String(progress);
    document.getElementById("count-done").textContent = String(done);
    document.getElementById("count-total").textContent = String(total);
    document.getElementById("pct-progress").textContent = String(pctProgress);
    document.getElementById("pct-done").textContent = String(pctDone);
  }

  function render() {
    const tasks = loadTasks();
    renderChart(tasks);
    const visible = tasks.filter((t) => filter === "all" || t.status === filter);

    list.innerHTML = "";
    visible.forEach((task, index) => {
      const done = task.status === "terminee";
      const item = document.createElement("li");
      item.className = `todo-item${done ? " completed" : ""}`;
      item.style.animationDelay = `${Math.min(index, 10) * 40}ms`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = done;
      checkbox.dataset.id = task.id;
      checkbox.setAttribute("aria-label", `Terminer : ${task.title}`);

      const body = document.createElement("div");
      body.className = "todo-body";

      const title = document.createElement("h3");
      title.className = "todo-text";
      title.textContent = task.title;
      body.append(title);

      if (task.description) {
        const desc = document.createElement("p");
        desc.className = "todo-desc";
        desc.textContent = task.description;
        body.append(desc);
      }

      const meta = document.createElement("div");
      meta.className = "todo-meta";
      const date = document.createElement("span");
      date.textContent = `📅 ${formatDate(task.date)}` + (task.time ? ` · 🕒 ${task.time}` : "");
      const badge = document.createElement("span");
      badge.className = "status-badge";
      badge.textContent = done ? "Terminée" : "En cours";
      meta.append(date, badge);
      body.append(meta);

      const actions = document.createElement("div");
      actions.className = "todo-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "edit-btn";
      editBtn.dataset.id = task.id;
      editBtn.setAttribute("aria-label", `Modifier : ${task.title}`);
      editBtn.title = "Modifier";
      editBtn.textContent = "✏️";

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-btn";
      deleteBtn.dataset.id = task.id;
      deleteBtn.setAttribute("aria-label", `Supprimer : ${task.title}`);
      deleteBtn.title = "Supprimer";
      deleteBtn.textContent = "🗑";

      actions.append(editBtn, deleteBtn);
      item.append(checkbox, body, actions);
      list.append(item);
    });

    totalCount.textContent = String(tasks.length);
    visibleCount.textContent = String(visible.length);
    emptyState.hidden = visible.length > 0;
    updateCounters(tasks);
  }

  /* Marquer comme terminée / rouvrir */
  list.addEventListener("change", (event) => {
    const checkbox = event.target.closest('input[type="checkbox"]');
    if (!checkbox) return;
    const tasks = loadTasks();
    const task = tasks.find((t) => t.id === checkbox.dataset.id);
    if (!task) return;
    task.status = checkbox.checked ? "terminee" : "en-cours";
    saveTasks(tasks);
    render();
  });

  /* Modifier / supprimer */
  list.addEventListener("click", (event) => {
    const editBtn = event.target.closest(".edit-btn");
    const deleteBtn = event.target.closest(".delete-btn");

    if (editBtn) {
      const task = loadTasks().find((t) => t.id === editBtn.dataset.id);
      if (!task) return;
      editingId = task.id;
      document.getElementById("edit-title").value = task.title;
      document.getElementById("edit-description").value = task.description;
      document.getElementById("edit-date").value = task.date;
      document.getElementById("edit-time").value = task.time;
      document.getElementById("edit-status").value = task.status;
      document.getElementById("edit-title-error").hidden = true;
      document.getElementById("edit-date-error").hidden = true;
      editDialog.showModal();
    }

    if (deleteBtn) {
      const task = loadTasks().find((t) => t.id === deleteBtn.dataset.id);
      if (!task) return;
      deletingId = task.id;
      document.getElementById("delete-name").textContent = task.title;
      deleteDialog.showModal();
    }
  });

  /* Enregistrer la modification */
  editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = document.getElementById("edit-title").value.trim();
    const date = document.getElementById("edit-date").value;
    document.getElementById("edit-title-error").hidden = Boolean(title);
    document.getElementById("edit-date-error").hidden = Boolean(date);
    if (!title || !date) return;

    const tasks = loadTasks();
    const task = tasks.find((t) => t.id === editingId);
    if (task) {
      task.title = title;
      task.description = document.getElementById("edit-description").value.trim();
      task.date = date;
      task.time = document.getElementById("edit-time").value;
      task.status = document.getElementById("edit-status").value;
      saveTasks(tasks);
    }
    editDialog.close();
    render();
  });
  document.getElementById("edit-cancel").addEventListener("click", () => editDialog.close());

  /* Confirmer la suppression */
  document.getElementById("delete-confirm").addEventListener("click", () => {
    saveTasks(loadTasks().filter((t) => t.id !== deletingId));
    deleteDialog.close();
    render();
  });
  document.getElementById("delete-cancel").addEventListener("click", () => deleteDialog.close());

  /* Filtres */
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      filter = chip.dataset.filter;
      render();
    });
  });

  /* Synchronisation entre onglets */
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) render();
  });

  render();
}

/* ===================== Démarrage ===================== */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  const page = document.body.dataset.page;
  if (page === "home") initHome();
  if (page === "tasks") initTasksPage();
});
