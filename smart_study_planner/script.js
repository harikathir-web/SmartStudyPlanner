/* FocusFlow - Smart Study Planner & Focus Dashboard
   Frontend-only project. Data is stored in this browser using localStorage. */

"use strict";

const STORAGE_KEYS = {
  tasks: "focusflow_tasks_v1",
  sessions: "focusflow_sessions_v1",
  goal: "focusflow_daily_goal_v1"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  taskList: $("#taskList"),
  emptyState: $("#emptyState"),
  taskDialog: $("#taskDialog"),
  taskForm: $("#taskForm"),
  taskId: $("#taskId"),
  taskTitle: $("#taskTitle"),
  taskSubject: $("#taskSubject"),
  taskPriority: $("#taskPriority"),
  taskDue: $("#taskDue"),
  taskDuration: $("#taskDuration"),
  taskNotes: $("#taskNotes"),
  searchInput: $("#searchInput"),
  filterSelect: $("#filterSelect"),
  toast: $("#toast")
};

let tasks = readStorage(STORAGE_KEYS.tasks, []);
let sessions = readStorage(STORAGE_KEYS.sessions, []);
let dailyGoal = Number(readStorage(STORAGE_KEYS.goal, 120)) || 120;
let chart = null;
let toastTimeout = null;

const timer = {
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  intervalId: null,
  running: false,
  mode: "focus"
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn(`Could not read ${key} from localStorage.`, error);
    return fallback;
  }
}

function saveStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
    localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
    localStorage.setItem(STORAGE_KEYS.goal, JSON.stringify(dailyGoal));
  } catch (error) {
    showToast("Could not save data. Check your browser storage settings.");
    console.error("Saving failed:", error);
  }
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString, options = { month: "short", day: "numeric" }) {
  if (!dateString) return "No date";
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString(undefined, options);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => elements.toast.classList.remove("show"), 2800);
}

function getTodaySessions() {
  const today = localDateString();
  return sessions.filter((session) => session.date === today);
}

function getTodayFocusMinutes() {
  return getTodaySessions().reduce((sum, session) => sum + session.minutes, 0);
}

function getVisibleTasks() {
  const search = elements.searchInput.value.trim().toLowerCase();
  const filter = elements.filterSelect.value;
  return tasks
    .filter((task) => {
      const matchesSearch = `${task.title} ${task.subject} ${task.notes || ""}`.toLowerCase().includes(search);
      if (!matchesSearch) return false;
      if (filter === "active") return !task.completed;
      if (filter === "completed") return task.completed;
      if (filter === "today") return task.due === localDateString();
      return true;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      const priorityRank = { high: 0, medium: 1, low: 2 };
      return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) || a.due.localeCompare(b.due);
    });
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();
  elements.taskList.innerHTML = visibleTasks.map((task) => {
    const overdue = !task.completed && task.due < localDateString();
    const dueLabel = task.due === localDateString() ? "Today" : formatDate(task.due);
    return `
      <article class="task-item ${task.completed ? "is-complete" : ""}" data-id="${escapeHTML(task.id)}">
        <input class="task-check" type="checkbox" data-action="toggle" aria-label="Mark ${escapeHTML(task.title)} complete" ${task.completed ? "checked" : ""}>
        <div class="task-main">
          <p class="task-title">${escapeHTML(task.title)}</p>
          <div class="task-meta">
            <span class="subject-tag">${escapeHTML(task.subject)}</span>
            <span class="priority-tag priority-${escapeHTML(task.priority)}">${escapeHTML(task.priority)}</span>
            <span class="task-due ${overdue ? "overdue" : ""}">${overdue ? "Overdue · " : "Due · "}${escapeHTML(dueLabel)}</span>
            <span>${Number(task.duration)} min</span>
          </div>
          ${task.notes ? `<div class="task-meta" style="margin-top:6px">${escapeHTML(task.notes)}</div>` : ""}
        </div>
        <div class="task-actions">
          <button type="button" data-action="edit" aria-label="Edit ${escapeHTML(task.title)}" title="Edit task">✎</button>
          <button type="button" data-action="delete" aria-label="Delete ${escapeHTML(task.title)}" title="Delete task">×</button>
        </div>
      </article>`;
  }).join("");

  const hasTasks = visibleTasks.length > 0;
  elements.emptyState.classList.toggle("visible", !hasTasks);
  elements.taskList.style.display = hasTasks ? "grid" : "none";
  $("#taskSummary").textContent = `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"} shown`;
  $("#navTaskCount").textContent = tasks.filter((task) => !task.completed).length;
}

function renderStats() {
  const completed = tasks.filter((task) => task.completed).length;
  const remaining = tasks.length - completed;
  const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const todayTasks = tasks.filter((task) => task.due === localDateString() && !task.completed).length;
  $("#completedStat").innerHTML = `${completed} <small>tasks</small>`;
  $("#focusStat").innerHTML = `${getTodayFocusMinutes()} <small>min</small>`;
  $("#remainingStat").innerHTML = `${remaining} <small>tasks</small>`;
  $("#sessionsStat").innerHTML = `${getTodaySessions().length} <small>sessions</small>`;
  $("#completionRate").textContent = `${rate}% completion`;
  $("#completionMiniBar").style.width = `${rate}%`;
  $("#dueTodayNote").textContent = todayTasks ? `${todayTasks} due today` : "No tasks due today";
  $("#goalMinutesText").textContent = `${getTodayFocusMinutes()} / ${dailyGoal}`;
  const goalPercent = Math.min(100, Math.round((getTodayFocusMinutes() / dailyGoal) * 100));
  $("#goalPercent").textContent = `${goalPercent}%`;
  $("#goalBar").style.width = `${goalPercent}%`;
  $("#dailyGoalInput").value = dailyGoal;
  $("#goalMessage").textContent = goalPercent >= 100
    ? "Daily goal achieved — amazing work! Take a well-earned break."
    : goalPercent >= 50
      ? "You are making good progress. Keep your focus going!"
      : "Every minute counts. Start your next focus session!";
}

function renderChart() {
  const canvas = $("#focusChart");
  if (!canvas || typeof Chart === "undefined") {
    if (canvas) canvas.parentElement.innerHTML = "<p>Chart.js could not load. Check your internet connection.</p>";
    return;
  }

  const labels = [];
  const values = [];
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const dateKey = localDateString(date);
    labels.push(date.toLocaleDateString(undefined, { weekday: "short" }));
    values.push(sessions.filter((session) => session.date === dateKey).reduce((sum, session) => sum + session.minutes, 0));
  }

  if (chart) chart.destroy();
  chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Focus minutes",
        data: values,
        backgroundColor: labels.map((_, index) => index === labels.length - 1 ? "#7565e8" : "#dcd7ff"),
        hoverBackgroundColor: "#7565e8",
        borderRadius: 7,
        borderSkipped: false,
        maxBarThickness: 28
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#292743",
          padding: 10,
          callbacks: { label: (context) => `${context.parsed.y} focus minutes` }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: "#a0a0b3", font: { family: "DM Sans", size: 10 } } },
        y: { beginAtZero: true, suggestedMax: Math.max(60, ...values), grid: { color: "#f0f0f7", drawTicks: false }, border: { display: false }, ticks: { color: "#a0a0b3", precision: 0, stepSize: 30, font: { family: "DM Sans", size: 10 }, padding: 8 } }
      }
    }
  });
}

function renderAll() {
  renderTasks();
  renderStats();
  renderChart();
}

function openTaskDialog(task = null) {
  elements.taskForm.reset();
  elements.taskId.value = task ? task.id : "";
  $("#dialogTitle").textContent = task ? "Edit study task" : "Create a study task";
  $("#saveTaskBtn").textContent = task ? "Update task" : "Save task";
  elements.taskTitle.value = task?.title || "";
  elements.taskSubject.value = task?.subject || "";
  elements.taskPriority.value = task?.priority || "medium";
  elements.taskDue.value = task?.due || localDateString();
  elements.taskDuration.value = task?.duration || 30;
  elements.taskNotes.value = task?.notes || "";
  elements.taskDialog.showModal();
  setTimeout(() => elements.taskTitle.focus(), 50);
}

function closeTaskDialog() {
  elements.taskDialog.close();
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const title = elements.taskTitle.value.trim();
  const subject = elements.taskSubject.value.trim();
  const due = elements.taskDue.value;
  const duration = Number(elements.taskDuration.value);

  if (!title || !subject || !due || !Number.isFinite(duration) || duration < 5 || duration > 600) {
    showToast("Please check the task details and try again.");
    return;
  }

  const taskData = {
    title,
    subject,
    priority: elements.taskPriority.value,
    due,
    duration,
    notes: elements.taskNotes.value.trim()
  };
  const existingId = elements.taskId.value;

  if (existingId) {
    tasks = tasks.map((task) => task.id === existingId ? { ...task, ...taskData } : task);
    showToast("Task updated successfully.");
  } else {
    tasks.unshift({ id: makeId(), ...taskData, completed: false, createdAt: new Date().toISOString() });
    showToast("New study task added.");
  }

  saveStorage();
  closeTaskDialog();
  renderAll();
}

function handleTaskListClick(event) {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;
  const taskElement = actionElement.closest("[data-id]");
  const task = tasks.find((item) => item.id === taskElement?.dataset.id);
  if (!task) return;

  const action = actionElement.dataset.action;
  if (action === "toggle") return; // Checkboxes are handled by the change event below.
  if (action === "edit") {
    openTaskDialog(task);
  } else if (action === "delete") {
    if (confirm(`Delete "${task.title}"?`)) {
      tasks = tasks.filter((item) => item.id !== task.id);
      saveStorage();
      renderAll();
      showToast("Task deleted.");
    }
  }
}

function setTimerPreset(minutes, mode) {
  stopTimer();
  timer.mode = mode;
  timer.totalSeconds = minutes * 60;
  timer.remainingSeconds = timer.totalSeconds;
  $$(".preset").forEach((button) => button.classList.toggle("active", Number(button.dataset.minutes) === minutes));
  $("#timerMode").textContent = mode === "focus" ? "FOCUS TIME" : "BREAK TIME";
  $("#timerCaption").textContent = mode === "focus" ? "Ready when you are" : "Take a little breather";
  $("#startTimerBtn").textContent = mode === "focus" ? "▶ Start focus" : "▶ Start break";
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const minutes = Math.floor(timer.remainingSeconds / 60);
  const seconds = timer.remainingSeconds % 60;
  $("#timerDisplay").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const circumference = 2 * Math.PI * 96;
  const progress = timer.totalSeconds ? timer.remainingSeconds / timer.totalSeconds : 0;
  $("#timerProgress").style.strokeDasharray = circumference;
  $("#timerProgress").style.strokeDashoffset = circumference * (1 - progress);
}

function startTimer() {
  if (timer.running) {
    stopTimer();
    $("#startTimerBtn").textContent = "▶ Resume";
    $("#timerCaption").textContent = "Paused — resume when ready";
    return;
  }

  if (timer.remainingSeconds <= 0) {
    timer.remainingSeconds = timer.totalSeconds;
  }
  timer.running = true;
  $("#startTimerBtn").textContent = "Ⅱ Pause";
  $("#timerCaption").textContent = "You are in the zone";
  timer.intervalId = setInterval(() => {
    timer.remainingSeconds -= 1;
    updateTimerDisplay();
    if (timer.remainingSeconds <= 0) completeTimer();
  }, 1000);
}

function stopTimer() {
  clearInterval(timer.intervalId);
  timer.intervalId = null;
  timer.running = false;
}

function completeTimer() {
  stopTimer();
  timer.remainingSeconds = 0;
  updateTimerDisplay();
  if (timer.mode === "focus") {
    const minutes = Math.round(timer.totalSeconds / 60);
    sessions.push({ id: makeId(), date: localDateString(), minutes, completedAt: new Date().toISOString() });
    saveStorage();
    renderAll();
    showToast(`Focus session complete! ${minutes} minutes logged.`);
    $("#timerCaption").textContent = "Session complete — well done!";
  } else {
    showToast("Break complete. Ready for another focus session?");
    $("#timerCaption").textContent = "Break complete!";
  }
  $("#startTimerBtn").textContent = "↻ Start again";
}

function resetTimer() {
  stopTimer();
  timer.remainingSeconds = timer.totalSeconds;
  $("#startTimerBtn").textContent = timer.mode === "focus" ? "▶ Start focus" : "▶ Start break";
  $("#timerCaption").textContent = "Ready when you are";
  updateTimerDisplay();
}

function saveDailyGoal() {
  const value = Number($("#dailyGoalInput").value);
  if (!Number.isInteger(value) || value < 15 || value > 720) {
    showToast("Choose a daily goal between 15 and 720 minutes.");
    return;
  }
  dailyGoal = value;
  saveStorage();
  renderStats();
  showToast("Daily goal saved.");
}

function clearAllData() {
  if (!confirm("This will delete all your saved tasks and focus sessions from this browser. Continue?")) return;
  tasks = [];
  sessions = [];
  dailyGoal = 120;
  saveStorage();
  renderAll();
  showToast("All planner data cleared.");
}

function init() {
  $("#dateText").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  $("#todayLabel").textContent = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase();

  // Task dialog controls
  $("#topAddTaskBtn").addEventListener("click", () => openTaskDialog());
  $("#addTaskBtn").addEventListener("click", () => openTaskDialog());
  $("#emptyAddBtn").addEventListener("click", () => openTaskDialog());
  $("#closeDialogBtn").addEventListener("click", closeTaskDialog);
  $("#cancelDialogBtn").addEventListener("click", closeTaskDialog);
  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.taskList.addEventListener("click", handleTaskListClick);
  elements.taskList.addEventListener("change", (event) => {
    if (!event.target.matches('[data-action="toggle"]')) return;
    const taskElement = event.target.closest("[data-id]");
    const task = tasks.find((item) => item.id === taskElement?.dataset.id);
    if (!task) return;
    task.completed = event.target.checked;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    saveStorage();
    renderAll();
    showToast(task.completed ? "Task completed — nice work!" : "Task moved back to in progress.");
  });

  // Search and filters
  elements.searchInput.addEventListener("input", renderTasks);
  elements.filterSelect.addEventListener("change", renderTasks);
  $("#showAllBtn").addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.filterSelect.value = "all";
    renderTasks();
  });

  // Timer controls
  $$(".preset").forEach((button) => {
    button.addEventListener("click", () => {
      const minutes = Number(button.dataset.minutes);
      setTimerPreset(minutes, minutes === 25 ? "focus" : "break");
    });
  });
  $("#startTimerBtn").addEventListener("click", startTimer);
  $("#resetTimerBtn").addEventListener("click", resetTimer);

  // Daily goal, clear data, mobile navigation
  $("#saveGoalBtn").addEventListener("click", saveDailyGoal);
  $("#clearDataBtn").addEventListener("click", clearAllData);
  $("#mobileMenuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $$(".nav-link").forEach((link) => link.addEventListener("click", () => $("#sidebar").classList.remove("open")));

  // Close dialog when the backdrop is clicked.
  elements.taskDialog.addEventListener("click", (event) => {
    if (event.target === elements.taskDialog) closeTaskDialog();
  });

  renderAll();
  updateTimerDisplay();
}

document.addEventListener("DOMContentLoaded", init);
