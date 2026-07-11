const STORAGE_KEY = "aharens-math-dashboard-v1";
const SHARED_STATE_PARAM = "data";

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
};

let state = resolveInitialState();

const overviewCards = document.getElementById("overviewCards");
const classVisualBoard = document.getElementById("classVisualBoard");
const studentDetail = document.getElementById("studentDetail");
const testsTableBody = document.getElementById("testsTableBody");
const curriculumTableBody = document.getElementById("curriculumTableBody");

const addClassForm = document.getElementById("addClassForm");
const addStudentForm = document.getElementById("addStudentForm");
const addTestForm = document.getElementById("addTestForm");
const addCurriculumForm = document.getElementById("addCurriculumForm");

const studentClassSelect = document.getElementById("studentClassSelect");
const testClassSelect = document.getElementById("testClassSelect");
const curriculumClassSelect = document.getElementById("curriculumClassSelect");
const resetDataBtn = document.getElementById("resetDataBtn");
const exportLinkBtn = document.getElementById("exportLinkBtn");

addClassForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(addClassForm);
  const className = String(formData.get("className")).trim();
  if (!className) return;

  state.classes.push({ id: crypto.randomUUID(), name: className, students: [] });
  addClassForm.reset();
  renderAll();
});

addStudentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(addStudentForm);
  const classId = String(formData.get("classId"));
  const studentName = String(formData.get("studentName")).trim();
  if (!classId || !studentName) return;

  const classItem = state.classes.find((item) => item.id === classId);
  if (!classItem) return;

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

addTestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(addTestForm);
  const classId = String(formData.get("classId"));
  const topic = String(formData.get("topic")).trim();
  const date = String(formData.get("date"));
  const average = Number(formData.get("average"));
  if (!classId || !topic || !date || Number.isNaN(average)) return;

  state.tests.push({
    id: crypto.randomUUID(),
    classId,
    topic,
    date,
    average: clamp(average, 0, 100),
  });

  addTestForm.reset();
  renderAll();
});

addCurriculumForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(addCurriculumForm);
  const classId = String(formData.get("classId"));
  const topic = String(formData.get("topic")).trim();
  const status = String(formData.get("status"));
  const coverage = Number(formData.get("coverage"));
  const note = String(formData.get("note")).trim();
  if (!topic || Number.isNaN(coverage)) return;

  state.curriculum.push({
    id: crypto.randomUUID(),
    classId: classId || null,
    topic,
    status,
    coverage: clamp(coverage, 0, 100),
    note,
  });

  addCurriculumForm.reset();
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
  renderSelects();
  renderOverview();
  renderClassBoard();
  renderStudentDetail();
  renderTestsTable();
  renderCurriculumTable();
  saveState();
}

function renderSelects() {
  const classOptions = state.classes.map((classItem) => `<option value="${classItem.id}">${classItem.name}</option>`).join("");
  studentClassSelect.innerHTML = classOptions;
  testClassSelect.innerHTML = classOptions;
  curriculumClassSelect.innerHTML = `<option value="">כללי</option>${classOptions}`;
}

function renderOverview() {
  const allStudents = state.classes.flatMap((classItem) => classItem.students);
  const avgProgress = allStudents.length
    ? Math.round(allStudents.reduce((sum, student) => sum + student.progress, 0) / allStudents.length)
    : 0;
  const avgUnderstanding = allStudents.length
    ? Math.round(allStudents.reduce((sum, student) => sum + student.understanding, 0) / allStudents.length)
    : 0;
  const completedCurriculum = state.curriculum.filter((item) => item.status === "completed").length;

  const cards = [
    { label: "כיתות", value: state.classes.length },
    { label: "תלמידים", value: allStudents.length },
    { label: "ממוצע התקדמות", value: `${avgProgress}%` },
    { label: "ממוצע הבנה", value: `${avgUnderstanding}%` },
    { label: "מבחנים", value: state.tests.length },
    { label: "חומר שהושלם", value: `${completedCurriculum}/${state.curriculum.length}` },
  ];

  overviewCards.innerHTML = cards
    .map((card) => `<article class="overview-card"><div class="label">${card.label}</div><div class="value">${card.value}</div></article>`)
    .join("");
}

function renderClassBoard() {
  classVisualBoard.innerHTML = state.classes
    .map((classItem) => {
      const studentsMarkup = classItem.students.length
        ? classItem.students
            .map((student) => {
              const statusClass = getStatusClass(student.understanding);
              return `
                <article class="student-card" data-class-id="${classItem.id}" data-student-id="${student.id}">
                  <h4>${student.name}</h4>
                  <span class="status-pill ${statusClass}">הבנה: ${student.understanding}%</span>
                  <div class="meter"><span style="width:${student.progress}%"></span></div>
                  <small>התקדמות בחומר: ${student.progress}%</small>
                </article>
              `;
            })
            .join("")
        : `<p class="empty-state">אין עדיין תלמידים בכיתה הזו.</p>`;

      return `
        <section class="class-board">
          <h3>${classItem.name}</h3>
          <div class="student-grid">${studentsMarkup}</div>
        </section>
      `;
    })
    .join("");

  classVisualBoard.querySelectorAll(".student-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedStudent = {
        classId: card.getAttribute("data-class-id"),
        studentId: card.getAttribute("data-student-id"),
      };
      renderStudentDetail();
      saveState();
    });
  });
}

function renderStudentDetail() {
  if (!state.selectedStudent) {
    studentDetail.className = "student-detail empty-state";
    studentDetail.textContent = "בחרי תלמיד/ה מהתצוגה הוויזואלית כדי לעדכן התקדמות והערות.";
    return;
  }

  const classItem = state.classes.find((item) => item.id === state.selectedStudent.classId);
  const student = classItem?.students.find((item) => item.id === state.selectedStudent.studentId);
  if (!classItem || !student) {
    state.selectedStudent = null;
    renderStudentDetail();
    return;
  }

  const notesMarkup = student.notes.length
    ? `<ul class="note-list">${student.notes.map((note) => `<li>${note}</li>`).join("")}</ul>`
    : `<p class="empty-state">אין הערות עדיין.</p>`;

  studentDetail.className = "student-detail";
  studentDetail.innerHTML = `
    <div>
      <h3>${student.name} · ${classItem.name}</h3>
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
      <button type="submit">שמירת עדכון</button>
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
}

function renderTestsTable() {
  const sortedTests = [...state.tests].sort((a, b) => b.date.localeCompare(a.date));
  testsTableBody.innerHTML = sortedTests.length
    ? sortedTests
        .map((test) => {
          const className = state.classes.find((item) => item.id === test.classId)?.name ?? "לא משויך";
          return `<tr><td>${test.date}</td><td>${className}</td><td>${test.topic}</td><td>${test.average}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="empty-state">אין מבחנים עדיין.</td></tr>`;
}

function renderCurriculumTable() {
  curriculumTableBody.innerHTML = state.curriculum.length
    ? state.curriculum
        .map((item) => {
          const className = item.classId ? state.classes.find((classItem) => classItem.id === item.classId)?.name : "כללי";
          return `
            <tr>
              <td>${className || "כללי"}</td>
              <td>${item.topic}</td>
              <td>${statusLabel(item.status)}</td>
              <td>${item.coverage}%</td>
              <td>${item.note || "-"}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="5" class="empty-state">אין פריטי חומר לימודי עדיין.</td></tr>`;
}

function statusLabel(status) {
  if (status === "completed") return "הושלם";
  if (status === "in_progress") return "בתהליך";
  return "מתוכנן";
}

function getStatusClass(understanding) {
  if (understanding >= 75) return "status-good";
  if (understanding >= 50) return "status-mid";
  return "status-low";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

  return {
    classes: Array.isArray(parsed.classes) ? parsed.classes : structuredClone(defaultState.classes),
    tests: Array.isArray(parsed.tests) ? parsed.tests : [],
    curriculum: Array.isArray(parsed.curriculum) ? parsed.curriculum : [],
    selectedStudent: parsed.selectedStudent ?? null,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

renderAll();
