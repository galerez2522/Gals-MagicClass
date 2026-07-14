const STORAGE_KEY = "aharens-math-dashboard-v1";
const SHARED_STATE_PARAM = "data";
const OVERVIEW_VIEW = "__overview__";

const CURRICULUM_STATUSES = [
  { value: "not_started", label: "לא הותחל" },
  { value: "in_progress", label: "בהתקדמות" },
  { value: "completed", label: "הסתיים" },
  { value: "needs_review", label: "דרוש חזרה" },
];

const defaultState = {
  classes: [
    {
      id: crypto.randomUUID(),
      name: "י׳1",
      students: [
        { id: crypto.randomUUID(), name: "נועה כהן", progress: 65, understanding: 72, notes: [] },
        { id: crypto.randomUUID(), name: "עומר לוי", progress: 42, understanding: 55, notes: [] },
      ],
    },
  ],
  tests: [],
  curriculum: [],
  selectedStudent: null,
  selectedView: OVERVIEW_VIEW,
};

let state = resolveInitialState();

const classNav = document.getElementById("classNav");
const mainContent = document.getElementById("mainContent");
const addClassForm = document.getElementById("addClassForm");
const resetDataBtn = document.getElementById("resetDataBtn");
const exportLinkBtn = document.getElementById("exportLinkBtn");

addClassForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(addClassForm);
  const className = String(formData.get("className")).trim();
  if (!className) return;

  const newClass = { id: crypto.randomUUID(), name: className, students: [] };
  state.classes.push(newClass);
  state.selectedView = newClass.id;
  addClassForm.reset();
  renderAll();
});

resetDataBtn.addEventListener("click", () => {
  const shouldReset = window.confirm("לאפס את כל הנתונים? הפעולה תמחק את כל המידע ששמרת.");
  if (!shouldReset) return;

  state = structuredClone(defaultState);
  renderAll();
});

exportLinkBtn.addEventListener("click", async () => {
  const shareLink = buildShareLink();
  if (!shareLink) return;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareLink);
      window.alert("הקישור הועתק ללוח.");
      return;
    } catch (error) {
      console.error("Failed to copy link to clipboard", error);
    }
  }

  window.prompt("העתיקי את הקישור:", shareLink);
});

function renderAll() {
  renderSidebar();
  renderMain();
  saveState();
}

/* ---------- Sidebar ---------- */

function renderSidebar() {
  const overviewActive = state.selectedView === OVERVIEW_VIEW ? "active" : "";
  const classesMarkup = state.classes
    .map((classItem) => {
      const active = state.selectedView === classItem.id ? "active" : "";
      return `
        <button class="nav-item ${active}" data-view="${classItem.id}">
          <span class="nav-icon">🏫</span>
          <span class="nav-label">${classItem.name}</span>
          <span class="nav-count">${classItem.students.length}</span>
        </button>
      `;
    })
    .join("");

  classNav.innerHTML = `
    <button class="nav-item ${overviewActive}" data-view="${OVERVIEW_VIEW}">
      <span class="nav-icon">✨</span>
      <span class="nav-label">סקירה כללית</span>
    </button>
    ${classesMarkup}
  `;

  classNav.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      state.selectedView = item.getAttribute("data-view");
      state.selectedStudent = null;
      renderAll();
    });
  });
}

/* ---------- Main content ---------- */

function renderMain() {
  if (state.selectedView === OVERVIEW_VIEW) {
    renderOverviewView();
  } else {
    const classItem = state.classes.find((item) => item.id === state.selectedView);
    if (!classItem) {
      state.selectedView = OVERVIEW_VIEW;
      renderOverviewView();
      return;
    }
    renderClassView(classItem);
  }
}

function renderOverviewView() {
  const allStudents = state.classes.flatMap((classItem) => classItem.students);
  const avgProgress = average(allStudents.map((s) => s.progress));
  const avgUnderstanding = average(allStudents.map((s) => s.understanding));
  const completedCurriculum = state.curriculum.filter((item) => item.status === "completed").length;

  const cards = [
    { label: "כיתות", value: state.classes.length },
    { label: "תלמידים", value: allStudents.length },
    { label: "ממוצע התקדמות", value: `${avgProgress}%` },
    { label: "ממוצע הבנה", value: `${avgUnderstanding}%` },
    { label: "מבחנים", value: state.tests.length },
    { label: "חומר שהושלם", value: `${completedCurriculum}/${state.curriculum.length}` },
  ];

  const classSummaries = state.classes.length
    ? state.classes
        .map((classItem) => {
          const classAvgUnderstanding = average(classItem.students.map((s) => s.understanding));
          const classTests = state.tests.filter((t) => t.classId === classItem.id).length;
          return `
            <button class="class-summary-card" data-view="${classItem.id}">
              <h3>🏫 ${classItem.name}</h3>
              <div class="summary-stats">
                <span>👥 ${classItem.students.length} תלמידים</span>
                <span>🧪 ${classTests} מבחנים</span>
                <span class="status-pill ${getStatusClass(classAvgUnderstanding)}">הבנה: ${classAvgUnderstanding}%</span>
              </div>
            </button>
          `;
        })
        .join("")
    : `<p class="empty-state">אין עדיין כיתות. הוסיפי כיתה בתפריט הצד.</p>`;

  mainContent.innerHTML = `
    <section class="panel">
      <h2>✨ סקירה כללית</h2>
      <div class="overview-cards">
        ${cards.map((card) => `<article class="overview-card"><div class="label">${card.label}</div><div class="value">${card.value}</div></article>`).join("")}
      </div>
    </section>
    <section class="panel">
      <h2>🏫 הכיתות</h2>
      <div class="class-summary-grid">${classSummaries}</div>
    </section>
  `;

  mainContent.querySelectorAll(".class-summary-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedView = card.getAttribute("data-view");
      state.selectedStudent = null;
      renderAll();
    });
  });
}

function renderClassView(classItem) {
  const classTests = state.tests
    .filter((test) => test.classId === classItem.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const classCurriculum = state.curriculum.filter((item) => item.classId === classItem.id);

  const avgProgress = average(classItem.students.map((s) => s.progress));
  const avgUnderstanding = average(classItem.students.map((s) => s.understanding));
  const completedCurriculum = classCurriculum.filter((item) => item.status === "completed").length;

  const cards = [
    { label: "תלמידים", value: classItem.students.length },
    { label: "ממוצע התקדמות", value: `${avgProgress}%` },
    { label: "ממוצע הבנה", value: `${avgUnderstanding}%` },
    { label: "מבחנים", value: classTests.length },
    { label: "חומר שהושלם", value: `${completedCurriculum}/${classCurriculum.length}` },
  ];

  const studentsMarkup = classItem.students.length
    ? classItem.students
        .map((student) => {
          const statusClass = getStatusClass(student.understanding);
          const selected =
            state.selectedStudent?.studentId === student.id ? "selected" : "";
          return `
            <article class="student-card ${selected}" data-student-id="${student.id}">
              <h4>${student.name}</h4>
              <span class="status-pill ${statusClass}">הבנה: ${student.understanding}%</span>
              <div class="meter"><span style="width:${student.progress}%"></span></div>
              <small>התקדמות בחומר: ${student.progress}%</small>
            </article>
          `;
        })
        .join("")
    : `<p class="empty-state">אין עדיין תלמידים בכיתה הזו. הוסיפי תלמיד/ה למטה.</p>`;

  const testsMarkup = classTests.length
    ? classTests
        .map((test) => `<tr><td>${test.date}</td><td>${test.topic}</td><td>${test.average}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="empty-state">אין מבחנים עדיין.</td></tr>`;

  const curriculumMarkup = classCurriculum.length
    ? classCurriculum
        .map(
          (item) => `
            <tr>
              <td>${item.topic}</td>
              <td>
                <select class="status-select ${statusSelectClass(item.status)}" data-curriculum-id="${item.id}">
                  ${CURRICULUM_STATUSES.map(
                    (status) =>
                      `<option value="${status.value}" ${item.status === status.value ? "selected" : ""}>${status.label}</option>`,
                  ).join("")}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  class="coverage-input"
                  data-curriculum-id="${item.id}"
                  min="0"
                  max="100"
                  step="5"
                  value="${item.coverage}"
                /> %
              </td>
              <td>${item.note || "-"}</td>
              <td><button class="danger-btn tiny-btn delete-curriculum-btn" data-curriculum-id="${item.id}" title="מחיקת נושא">✕</button></td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="5" class="empty-state">אין פריטי חומר לימודי עדיין.</td></tr>`;

  mainContent.innerHTML = `
    <section class="panel class-header-panel">
      <div class="class-header-row">
        <h2>🏫 כיתה ${classItem.name}</h2>
        <button id="deleteClassBtn" class="danger-btn small-btn">מחיקת כיתה</button>
      </div>
      <div class="overview-cards">
        ${cards.map((card) => `<article class="overview-card"><div class="label">${card.label}</div><div class="value">${card.value}</div></article>`).join("")}
      </div>
    </section>

    <section class="panel">
      <h2>🎨 התלמידים בכיתה</h2>
      <div class="student-grid">${studentsMarkup}</div>
      <form id="addStudentForm" class="inline-form student-add-form">
        <label>
          שם תלמיד/ה
          <input name="studentName" required placeholder="שם מלא" />
        </label>
        <button type="submit">+ הוספת תלמיד/ה</button>
      </form>
    </section>

    <section class="panel">
      <h2>📝 מעקב אישי והערות</h2>
      <div id="studentDetail" class="student-detail"></div>
    </section>

    <section class="panel">
      <h2>🧪 מעקב מבחנים</h2>
      <form id="addTestForm" class="inline-form test-form">
        <label>
          נושא
          <input name="topic" required placeholder="למשל: פונקציות" />
        </label>
        <label>
          תאריך
          <input type="date" name="date" required />
        </label>
        <label>
          ממוצע כיתתי
          <input type="number" name="average" min="0" max="100" step="1" required />
        </label>
        <button type="submit">הוספת מבחן</button>
      </form>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>תאריך</th><th>נושא</th><th>ממוצע</th></tr>
          </thead>
          <tbody>${testsMarkup}</tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>📚 מעקב חומר לימודי</h2>
      <form id="addCurriculumForm" class="inline-form curriculum-form">
        <label>
          נושא חומר
          <input name="topic" required placeholder="למשל: טריגונומטריה" />
        </label>
        <label>
          סטטוס
          <select name="status" required>
            ${CURRICULUM_STATUSES.map((status) => `<option value="${status.value}">${status.label}</option>`).join("")}
          </select>
        </label>
        <label>
          התקדמות %
          <input type="number" name="coverage" min="0" max="100" step="5" value="0" required />
        </label>
        <label class="full-width">
          הערה
          <input name="note" placeholder="למשל: נדרש עוד תרגול בית" />
        </label>
        <button type="submit">הוספת פריט חומר</button>
      </form>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>נושא</th><th>סטטוס</th><th>כיסוי</th><th>הערה</th><th></th></tr>
          </thead>
          <tbody>${curriculumMarkup}</tbody>
        </table>
      </div>
    </section>
  `;

  bindClassViewEvents(classItem);
  renderStudentDetail(classItem);
}

function bindClassViewEvents(classItem) {
  document.getElementById("deleteClassBtn").addEventListener("click", () => {
    const shouldDelete = window.confirm(`למחוק את כיתה ${classItem.name} וכל הנתונים שלה?`);
    if (!shouldDelete) return;

    state.classes = state.classes.filter((item) => item.id !== classItem.id);
    state.tests = state.tests.filter((test) => test.classId !== classItem.id);
    state.curriculum = state.curriculum.filter((item) => item.classId !== classItem.id);
    state.selectedView = OVERVIEW_VIEW;
    state.selectedStudent = null;
    renderAll();
  });

  const addStudentForm = document.getElementById("addStudentForm");
  addStudentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(addStudentForm);
    const studentName = String(formData.get("studentName")).trim();
    if (!studentName) return;

    classItem.students.push({
      id: crypto.randomUUID(),
      name: studentName,
      progress: 0,
      understanding: 0,
      notes: [],
    });

    addStudentForm.reset();
    renderAll();
  });

  const addTestForm = document.getElementById("addTestForm");
  addTestForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(addTestForm);
    const topic = String(formData.get("topic")).trim();
    const date = String(formData.get("date"));
    const testAverage = Number(formData.get("average"));
    if (!topic || !date || Number.isNaN(testAverage)) return;

    state.tests.push({
      id: crypto.randomUUID(),
      classId: classItem.id,
      topic,
      date,
      average: clamp(testAverage, 0, 100),
    });

    addTestForm.reset();
    renderAll();
  });

  const addCurriculumForm = document.getElementById("addCurriculumForm");
  addCurriculumForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(addCurriculumForm);
    const topic = String(formData.get("topic")).trim();
    const status = String(formData.get("status"));
    const coverage = Number(formData.get("coverage"));
    const note = String(formData.get("note")).trim();
    if (!topic || Number.isNaN(coverage)) return;

    state.curriculum.push({
      id: crypto.randomUUID(),
      classId: classItem.id,
      topic,
      status,
      coverage: clamp(coverage, 0, 100),
      note,
    });

    addCurriculumForm.reset();
    renderAll();
  });

  mainContent.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", () => {
      const item = state.curriculum.find((entry) => entry.id === select.getAttribute("data-curriculum-id"));
      if (!item) return;
      item.status = select.value;
      renderAll();
    });
  });

  mainContent.querySelectorAll(".coverage-input").forEach((input) => {
    input.addEventListener("change", () => {
      const item = state.curriculum.find((entry) => entry.id === input.getAttribute("data-curriculum-id"));
      if (!item) return;
      const coverage = Number(input.value);
      if (Number.isNaN(coverage)) return;
      item.coverage = clamp(coverage, 0, 100);
      renderAll();
    });
  });

  mainContent.querySelectorAll(".delete-curriculum-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.getAttribute("data-curriculum-id");
      const item = state.curriculum.find((entry) => entry.id === itemId);
      if (!item) return;
      if (!window.confirm(`למחוק את הנושא "${item.topic}"?`)) return;
      state.curriculum = state.curriculum.filter((entry) => entry.id !== itemId);
      renderAll();
    });
  });

  mainContent.querySelectorAll(".student-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedStudent = {
        classId: classItem.id,
        studentId: card.getAttribute("data-student-id"),
      };
      renderAll();
    });
  });
}

function renderStudentDetail(classItem) {
  const studentDetail = document.getElementById("studentDetail");
  if (!studentDetail) return;

  const student =
    state.selectedStudent?.classId === classItem.id
      ? classItem.students.find((item) => item.id === state.selectedStudent.studentId)
      : null;

  if (!student) {
    studentDetail.className = "student-detail";
    studentDetail.innerHTML = `<p class="empty-state">בחרי תלמיד/ה מהרשימה למעלה כדי לעדכן התקדמות והערות.</p>`;
    return;
  }

  const notesMarkup = student.notes.length
    ? `<ul class="note-list">${student.notes.map((note) => `<li>${note}</li>`).join("")}</ul>`
    : `<p class="empty-state">אין הערות עדיין.</p>`;

  studentDetail.className = "student-detail";
  studentDetail.innerHTML = `
    <div>
      <h3>${student.name}</h3>
      <p>עדכני התקדמות, רמת הבנה והוסיפי הערות שוטפות.</p>
    </div>
    <form id="studentUpdateForm" class="inline-form">
      <label>
        התקדמות %
        <input type="number" name="progress" min="0" max="100" value="${student.progress}" required />
      </label>
      <label>
        הבנה %
        <input type="number" name="understanding" min="0" max="100" value="${student.understanding}" required />
      </label>
      <label>
        הערה חדשה
        <textarea name="newNote" rows="2" placeholder="כתבי תצפית/הערה להמשך מעקב"></textarea>
      </label>
      <div class="form-actions">
        <button type="submit">שמירת עדכון</button>
        <button type="button" id="removeStudentBtn" class="danger-btn">הסרת תלמיד/ה</button>
      </div>
    </form>
    <section>
      <h4>הערות קודמות</h4>
      ${notesMarkup}
    </section>
  `;

  const studentUpdateForm = document.getElementById("studentUpdateForm");
  studentUpdateForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(studentUpdateForm);
    const progress = Number(formData.get("progress"));
    const understanding = Number(formData.get("understanding"));
    const newNote = String(formData.get("newNote")).trim();

    student.progress = clamp(progress, 0, 100);
    student.understanding = clamp(understanding, 0, 100);
    if (newNote) {
      const timestamp = new Date().toLocaleDateString("he-IL");
      student.notes.unshift(`${timestamp}: ${newNote}`);
    }

    renderAll();
  });

  document.getElementById("removeStudentBtn").addEventListener("click", () => {
    const shouldRemove = window.confirm(`להסיר את ${student.name} מהכיתה?`);
    if (!shouldRemove) return;

    classItem.students = classItem.students.filter((item) => item.id !== student.id);
    state.selectedStudent = null;
    renderAll();
  });
}

/* ---------- Helpers ---------- */

function statusLabel(status) {
  return CURRICULUM_STATUSES.find((item) => item.value === status)?.label ?? "לא הותחל";
}

function statusSelectClass(status) {
  if (status === "completed") return "status-select-good";
  if (status === "in_progress") return "status-select-mid";
  if (status === "needs_review") return "status-select-review";
  return "status-select-none";
}

function normalizeCurriculumStatus(status) {
  // Migrate legacy status values
  if (status === "planned") return "not_started";
  return CURRICULUM_STATUSES.some((item) => item.value === status) ? status : "not_started";
}

function getStatusClass(understanding) {
  if (understanding >= 75) return "status-good";
  if (understanding >= 50) return "status-mid";
  return "status-low";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/* ---------- State persistence & sharing ---------- */

function loadState() {
  const rawState = localStorage.getItem(STORAGE_KEY);
  if (!rawState) return structuredClone(defaultState);
  try {
    return normalizeState(JSON.parse(rawState));
  } catch (error) {
    console.error("Failed to parse saved dashboard state", error);
    return structuredClone(defaultState);
  }
}

function resolveInitialState() {
  const sharedState = loadSharedStateFromUrl();
  return sharedState ?? loadState();
}

function loadSharedStateFromUrl() {
  const encodedState = new URLSearchParams(window.location.search).get(SHARED_STATE_PARAM);
  if (!encodedState) return null;

  const decodedState = decodeSharedState(encodedState);
  if (!decodedState) {
    window.alert("הקישור לשיתוף לא תקין.");
    return null;
  }

  // Remove the share param so future edits/refreshes use localStorage
  // instead of being overridden by the stale URL snapshot.
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete(SHARED_STATE_PARAM);
  window.history.replaceState(null, "", cleanUrl.toString());

  return normalizeState(decodedState);
}

function buildShareLink() {
  const encodedState = encodeSharedState(normalizeState(state));
  if (!encodedState) {
    window.alert("לא ניתן ליצור קישור שיתוף כרגע.");
    return null;
  }

  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set(SHARED_STATE_PARAM, encodedState);
  return shareUrl.toString();
}

function encodeSharedState(stateToEncode) {
  try {
    const json = JSON.stringify(stateToEncode);
    return toBase64Url(json);
  } catch (error) {
    console.error("Failed to encode dashboard state", error);
    return null;
  }
}

function decodeSharedState(encodedState) {
  try {
    const json = fromBase64Url(encodedState);
    return JSON.parse(json);
  } catch (error) {
    console.error("Failed to decode shared dashboard state", error);
    return null;
  }
}

function toBase64Url(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(input) {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeState(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return structuredClone(defaultState);
  }

  const classes = Array.isArray(parsed.classes) ? parsed.classes : structuredClone(defaultState.classes);
  const selectedView =
    parsed.selectedView === OVERVIEW_VIEW || classes.some((item) => item.id === parsed.selectedView)
      ? parsed.selectedView
      : OVERVIEW_VIEW;

  return {
    classes,
    tests: Array.isArray(parsed.tests) ? parsed.tests : [],
    curriculum: (Array.isArray(parsed.curriculum) ? parsed.curriculum : []).map((item) => ({
      ...item,
      status: normalizeCurriculumStatus(item.status),
    })),
    selectedStudent: parsed.selectedStudent ?? null,
    selectedView,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

renderAll();
