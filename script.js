// ---------- 1. Grab elements from the page ----------
const currentEl = document.getElementById("current");
const previousEl = document.getElementById("previous");
const keys = document.querySelector(".keys");

// ---------- 2. Calculator state (the "memory" of the calculator) ----------
let current = "0";          // number being typed (kept as a string)
let previous = "";          // first number, saved when an operator is pressed
let operator = null;        // "+", "−", "×", "÷" or null
let waitingForNext = false; // true after an operator or "=": next digit starts a new number

const MAX_DIGITS = 15;

// ---------- 3. Show the state on screen ----------
function updateDisplay() {
  currentEl.textContent = current;
  previousEl.textContent = operator ? `${previous} ${operator}` : "";
}

// ---------- 4. Actions ----------
function clearAll() {
  current = "0";
  previous = "";
  operator = null;
  waitingForNext = false;
  updateDisplay();
}

function deleteLast() {
  if (current === "Error" || waitingForNext) return;
  const isSingleChar = current.length === 1;
  const isNegativeSingle = current.length === 2 && current.startsWith("-");
  current = isSingleChar || isNegativeSingle ? "0" : current.slice(0, -1);
  updateDisplay();
}

function appendNumber(digit) {
  if (current === "Error" || waitingForNext) {
    current = "0";
    waitingForNext = false;
  }
  if (digit === "." && current.includes(".")) return; // only one decimal point
  if (current.replace("-", "").replace(".", "").length >= MAX_DIGITS) return;

  if (current === "0" && digit !== ".") {
    current = digit;   // replace the leading zero
  } else {
    current += digit;
  }
  updateDisplay();
}

function calculate(a, b, op) {
  const x = parseFloat(a);
  const y = parseFloat(b);
  let result;

  switch (op) {
    case "+": result = x + y; break;
    case "−": result = x - y; break;
    case "×": result = x * y; break;
    case "÷":
      if (y === 0) return null; // can't divide by zero
      result = x / y;
      break;
    default: return null;
  }

  // Fixes floating-point quirks like 0.1 + 0.2 = 0.30000000000000004
  return parseFloat(result.toFixed(10)).toString();
}

function chooseOperator(op) {
  if (current === "Error") return;

  // User changed their mind: "5 +" then "×" just swaps the operator
  if (operator && waitingForNext) {
    operator = op;
    updateDisplay();
    return;
  }

  // Chaining: "5 + 3" then "×" calculates 8 first
  if (operator) {
    const result = calculate(previous, current, operator);
    if (result === null) return showError();
    current = result;
  }

  previous = current;
  operator = op;
  waitingForNext = true;
  updateDisplay();
}

function evaluate() {
  if (!operator || waitingForNext) return;

  const expression = `${previous} ${operator} ${current} =`;
  const result = calculate(previous, current, operator);
  if (result === null) return showError();

  current = result;
  previous = "";
  operator = null;
  waitingForNext = true;
  updateDisplay();
  previousEl.textContent = expression; // keep the finished sum visible
  addToHistory(expression, result);
}

function showError() {
  current = "Error";
  previous = "";
  operator = null;
  waitingForNext = true;
  updateDisplay();
  previousEl.textContent = "Cannot divide by 0";
}

// ---------- 5. Mouse/touch: ONE listener for all buttons (event delegation) ----------
keys.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.number !== undefined) appendNumber(button.dataset.number);
  else if (button.dataset.operator) chooseOperator(button.dataset.operator);
  else if (button.dataset.action === "clear") clearAll();
  else if (button.dataset.action === "delete") deleteLast();
  else if (button.dataset.action === "equals") evaluate();
});

// ---------- 6. Keyboard support ----------
const operatorKeys = { "+": "+", "-": "−", "*": "×", "/": "÷" };

document.addEventListener("keydown", (event) => {
  const key = event.key;

  if ((key >= "0" && key <= "9") || key === ".") {
    appendNumber(key);
  } else if (operatorKeys[key]) {
    event.preventDefault(); // stops "/" opening quick-find in Firefox
    chooseOperator(operatorKeys[key]);
  } else if (key === "Enter" || key === "=") {
    // Let Enter work normally on the theme and history buttons
    if (event.target.closest(".themes, .history")) return;
    event.preventDefault(); // stops Enter from also "clicking" a focused button
    evaluate();
  } else if (key === "Backspace") {
    deleteLast();
  } else if (key === "Escape") {
    clearAll();
  }
});

// ---------- 7. Initial screen ----------
updateDisplay();

// ---------- 8. History tape (saved in the browser with localStorage) ----------
const historyList = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history");
const HISTORY_KEY = "neon-calc-history";
const MAX_HISTORY = 20;

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return []; // storage blocked or data corrupted
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(calcHistory));
  } catch {
    // storage unavailable: history just won't persist
  }
}

let calcHistory = loadHistory();

function renderHistory() {
  historyList.replaceChildren();

  if (calcHistory.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "Your calculations will appear here.";
    historyList.append(empty);
    return;
  }

  calcHistory.forEach((entry, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className = "history-item";
    button.dataset.index = index;
    button.title = "Use this result";

    const expr = document.createElement("span");
    expr.className = "history-expr";
    expr.textContent = entry.expression;

    const res = document.createElement("span");
    res.className = "history-result";
    res.textContent = entry.result;

    button.append(expr, res);
    item.append(button);
    historyList.append(item);
  });
}

function addToHistory(expression, result) {
  calcHistory.unshift({ expression, result }); // newest first
  calcHistory = calcHistory.slice(0, MAX_HISTORY);
  saveHistory();
  renderHistory();
}

// Click an entry to reuse its result
historyList.addEventListener("click", (event) => {
  const button = event.target.closest(".history-item");
  if (!button) return;

  const entry = calcHistory[Number(button.dataset.index)];
  if (!entry) return;

  current = entry.result;
  previous = "";
  operator = null;
  waitingForNext = true;
  updateDisplay();
  button.blur(); // so the keyboard keeps controlling the calculator
});

clearHistoryBtn.addEventListener("click", () => {
  calcHistory = [];
  saveHistory();
  renderHistory();
  clearHistoryBtn.blur();
});

// ---------- 9. Theme switcher ----------
const THEMES = ["neon", "matrix", "amber"];
const THEME_KEY = "neon-calc-theme";
const swatches = document.querySelectorAll(".swatch");

function setTheme(name) {
  if (!THEMES.includes(name)) name = "neon";
  document.documentElement.dataset.theme = name;
  swatches.forEach((swatch) => {
    swatch.setAttribute("aria-pressed", String(swatch.dataset.theme === name));
  });
  try {
    localStorage.setItem(THEME_KEY, name);
  } catch {
    // storage unavailable: theme just won't persist
  }
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "neon";
  } catch {
    return "neon";
  }
}

document.querySelector(".themes").addEventListener("click", (event) => {
  const swatch = event.target.closest(".swatch");
  if (!swatch) return;
  setTheme(swatch.dataset.theme);
  swatch.blur();
});

// ---------- 10. Start up ----------
renderHistory();
setTheme(loadTheme());