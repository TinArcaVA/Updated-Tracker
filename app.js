// ===== CONSTANTS =====
const MEMBERS = ['Tin', 'Cesar', 'Kids'];
const MEMBER_EMOJI = { Tin: '👩', Cesar: '👨', Kids: '🧒' };

// ===== DATA STORE =====
let data = { income: [], expenses: [], bills: [], budgets: [] };
let activeFilter = 'all'; // global member filter

function save() { localStorage.setItem('budgetph_v2', JSON.stringify(data)); }

function load() {
  const raw = localStorage.getItem('budgetph_v2');
  if (raw) { try { data = JSON.parse(raw); } catch(e) {} }
  data.income    = data.income    || [];
  data.expenses  = data.expenses  || [];
  data.bills     = data.bills     || [];
  data.budgets   = data.budgets   || [];
}

// ===== FORMAT =====
const fmt = n => '₱' + parseFloat(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate = d => { if(!d) return ''; return new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}); };
const today = () => new Date().toISOString().split('T')[0];
const thisMonth = () => today().slice(0,7);

// ===== MEMBER TOGGLE SETUP =====
function setupToggles(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.mtog').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.mtog').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function getToggleVal(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return 'Tin';
  const active = group.querySelector('.mtog.active');
  return active ? active.dataset.val : 'Tin';
}

// ===== MEMBER FILTER BAR =====
function setupMemberBar() {
  document.querySelectorAll('.member-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.member-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeFilter = pill.dataset.member;
      updateSummary();
      renderBreakdown();
      renderBills();
      renderCalendar();
      renderBudgetOverview();
    });
  });
}

// ===== FILTER HELPERS =====
function filterByMember(arr) {
  if (activeFilter === 'all') return arr;
  return arr.filter(i => i.member === activeFilter);
}

// ===== SUMMARY =====
function updateSummary() {
  const inc  = filterByMember(data.income);
  const exp  = filterByMember(data.expenses);
  const paid = filterByMember(data.bills).filter(b => b.paid);

  const totalInc = inc.reduce((s,i) => s+parseFloat(i.amount||0), 0);
  const totalExp = exp.reduce((s,e) => s+parseFloat(e.amount||0), 0);
  const totalPaid = paid.reduce((s,b) => s+parseFloat(b.amount||0), 0);
  const totalDeducted = totalExp + totalPaid;
  const balance = totalInc - totalDeducted;

  document.getElementById('totalIncome').textContent   = fmt(totalInc);
  document.getElementById('totalExpenses').textContent = fmt(totalDeducted);
  document.getElementById('totalBalance').textContent  = fmt(balance);
  document.getElementById('totalBalance').style.color  = balance >= 0 ? 'var(--green)' : 'var(--accent)';

  renderMemberCards();
}

// ===== MEMBER CARDS =====
function renderMemberCards() {
  const el = document.getElementById('memberCards');
  if (activeFilter !== 'all') { el.innerHTML = ''; return; }

  el.innerHTML = MEMBERS.map(m => {
    const inc  = data.income.filter(i => i.member === m).reduce((s,i) => s+parseFloat(i.amount||0), 0);
    const exp  = data.expenses.filter(e => e.member === m).reduce((s,e) => s+parseFloat(e.amount||0), 0);
    const paid = data.bills.filter(b => b.member === m && b.paid).reduce((s,b) => s+parseFloat(b.amount||0), 0);
    const bal  = inc - exp - paid;
    const emoji = MEMBER_EMOJI[m];

    // Budget info for current month
    const bkey = `${m}_${thisMonth()}`;
    const budget = data.budgets.find(b => b.key === bkey);
    let budgetBar = '';
    if (budget) {
      const spent = exp + paid;
      const pct = Math.min((spent / budget.amount) * 100, 100);
      const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
      budgetBar = `<div style="margin-top:8px">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:4px">
          <span>Budget: ${fmt(budget.amount)}</span><span>Spent: ${fmt(spent)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
      </div>`;
    }

    return `<div class="member-card ${m}">
      <div class="mc-header">
        <div class="mc-name ${m}">${emoji} ${m}</div>
      </div>
      <div class="mc-stats">
        <div class="mc-stat"><div class="mc-stat-label">Income</div><div class="mc-stat-val" style="color:var(--green)">${fmt(inc)}</div></div>
        <div class="mc-stat"><div class="mc-stat-label">Spent</div><div class="mc-stat-val" style="color:var(--accent)">${fmt(exp+paid)}</div></div>
        <div class="mc-stat"><div class="mc-stat-label">Balance</div><div class="mc-stat-val" style="color:${bal>=0?'var(--yellow)':'var(--accent)'}">${fmt(bal)}</div></div>
      </div>
      ${budgetBar}
    </div>`;
  }).join('');
}

// ===== MEMBER BADGE HTML =====
const memberBadge = m => m ? `<span class="mbadge ${m}">${MEMBER_EMOJI[m]} ${m}</span>` : '';

// ===== ADD INCOME =====
function addIncome() {
  const desc   = document.getElementById('incDesc').value.trim();
  const amount = parseFloat(document.getElementById('incAmount').value);
  const date   = document.getElementById('incDate').value || today();
  const member = getToggleVal('incMember');

  if (!desc)              { showToast('Please enter a description'); return; }
  if (!amount || amount<=0){ showToast('Please enter a valid amount'); return; }

  data.income.push({ id: Date.now(), desc, amount, date, member });
  save();

  document.getElementById('incDesc').value   = '';
  document.getElementById('incAmount').value = '';

  updateSummary(); renderBreakdown(); renderTransactions(); renderCalendar();
  showToast(`✅ Income added for ${member}!`);
}

// ===== ADD EXPENSE =====
function addExpense() {
  const desc   = document.getElementById('expDesc').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const date   = document.getElementById('expDate').value || today();
  const cat    = document.getElementById('expCat').value;
  const member = getToggleVal('expMember');

  if (!desc)              { showToast('Please enter a description'); return; }
  if (!amount || amount<=0){ showToast('Please enter a valid amount'); return; }

  data.expenses.push({ id: Date.now(), desc, amount, date, cat, member });
  save();

  document.getElementById('expDesc').value   = '';
  document.getElementById('expAmount').value = '';

  updateSummary(); renderBreakdown(); renderTransactions(); renderCalendar(); renderBudgetOverview();
  showToast(`✅ Expense added for ${member}!`);
}

// ===== ADD BILL =====
function addBill() {
  const desc   = document.getElementById('billDesc').value.trim();
  const amount = parseFloat(document.getElementById('billAmount').value);
  const due    = document.getElementById('billDue').value;
  const recur  = document.getElementById('billRecur').value;
  const member = getToggleVal('billMember');

  if (!desc)              { showToast('Please enter a bill name'); return; }
  if (!amount || amount<=0){ showToast('Please enter a valid amount'); return; }
  if (!due)               { showToast('Please select a due date'); return; }

  data.bills.push({ id: Date.now(), desc, amount, due, recur, member, paid: false });
  save();

  document.getElementById('billDesc').value   = '';
  document.getElementById('billAmount').value = '';

  renderBills(); renderCalendar(); checkReminders();
  showToast(`🔔 Bill added for ${member}!`);
}

// ===== TOGGLE BILL PAID =====
function toggleBill(id) {
  const bill = data.bills.find(b => b.id === id);
  if (!bill) return;
  bill.paid = !bill.paid;
  bill.paidDate = bill.paid ? today() : null;
  save(); renderBills(); updateSummary(); renderBudgetOverview();
  showToast(bill.paid ? '✅ Marked as paid!' : '↩️ Marked unpaid');
}

// ===== SET BUDGET =====
function setBudget() {
  const member = getToggleVal('budgetMember');
  const amount = parseFloat(document.getElementById('budgetAmount').value);
  const month  = document.getElementById('budgetMonth').value;

  if (!amount || amount <= 0) { showToast('Please enter a budget amount'); return; }
  if (!month) { showToast('Please select a month'); return; }

  const key = `${member}_${month}`;
  const existing = data.budgets.findIndex(b => b.key === key);
  if (existing >= 0) data.budgets[existing].amount = amount;
  else data.budgets.push({ key, member, month, amount });

  save();
  document.getElementById('budgetAmount').value = '';
  renderBudgetOverview(); updateSummary();
  showToast(`🎯 Budget set for ${member}!`);
}

// ===== RENDER BUDGET OVERVIEW =====
function renderBudgetOverview() {
  const el = document.getElementById('budgetOverview');
  const budgets = data.budgets.sort((a,b) => b.month.localeCompare(a.month));

  if (!budgets.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div>No budgets set yet</div>`;
    return;
  }

  el.innerHTML = budgets.map(b => {
    const exp  = data.expenses.filter(e => e.member === b.member && e.date && e.date.startsWith(b.month)).reduce((s,e) => s+parseFloat(e.amount||0), 0);
    const paid = data.bills.filter(bl => bl.member === b.member && bl.paid && (bl.paidDate||bl.due||'').startsWith(b.month)).reduce((s,bl) => s+parseFloat(bl.amount||0), 0);
    const spent = exp + paid;
    const pct = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0;
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    const remaining = b.amount - spent;
    const statusText = pct >= 100
      ? `🔴 Over budget by ${fmt(spent - b.amount)}`
      : pct >= 80
      ? `🟡 ${fmt(remaining)} remaining`
      : `🟢 ${fmt(remaining)} remaining`;

    return `<div class="budget-card">
      <div class="bc-header">
        <div class="bc-name ${b.member}">${MEMBER_EMOJI[b.member]} ${b.member}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="bc-month">${b.month}</div>
          <button class="bc-del" onclick="deleteBudget('${b.key}')">🗑</button>
        </div>
      </div>
      <div class="bc-amounts">
        <div>Budget <span>${fmt(b.amount)}</span></div>
        <div>Spent <span style="color:var(--accent)">${fmt(spent)}</span></div>
        <div>Left <span style="color:${remaining>=0?'var(--green)':'var(--accent)'}">${fmt(remaining)}</span></div>
      </div>
      <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="bc-status" style="color:${cls==='over'?'var(--accent)':cls==='warn'?'var(--yellow)':'var(--green)'}">${statusText}</div>
    </div>`;
  }).join('');
}

function deleteBudget(key) {
  data.budgets = data.budgets.filter(b => b.key !== key);
  save(); renderBudgetOverview(); updateSummary();
  showToast('Deleted');
}

// ===== DELETE =====
function deleteIncome(id) {
  data.income = data.income.filter(i => i.id !== id);
  save(); updateSummary(); renderBreakdown(); renderTransactions(); renderCalendar();
  showToast('Deleted');
}
function deleteExpense(id) {
  data.expenses = data.expenses.filter(e => e.id !== id);
  save(); updateSummary(); renderBreakdown(); renderTransactions(); renderCalendar(); renderBudgetOverview();
  showToast('Deleted');
}
function deleteBill(id) {
  data.bills = data.bills.filter(b => b.id !== id);
  save(); renderBills(); renderCalendar(); checkReminders(); updateSummary();
  showToast('Deleted');
}

// ===== RENDER BREAKDOWN =====
function renderBreakdown() {
  const el = document.getElementById('breakdown');
  const inc = filterByMember(data.income).map(i => ({ ...i, type:'income' }));
  const exp = filterByMember(data.expenses).map(e => ({ ...e, type:'expense' }));
  const all = [...inc, ...exp].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0, 20);

  if (!all.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div>No transactions yet</div>`;
    return;
  }

  el.innerHTML = all.map(item => `
    <div class="breakdown-item ${item.type}">
      <div class="bi-left">
        <div class="bi-desc">${item.type==='income'?'💰':getCatIcon(item.cat)} ${item.desc}</div>
        <div class="bi-meta">${fmtDate(item.date)} ${item.cat?'· '+item.cat:''} ${memberBadge(item.member)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <div class="bi-amount">${item.type==='income'?'+':'-'}${fmt(item.amount)}</div>
        <button class="bi-delete" onclick="${item.type==='income'?'deleteIncome':'deleteExpense'}(${item.id})">🗑</button>
      </div>
    </div>`).join('');
}

// ===== RENDER BILLS =====
function renderBills() {
  const unpaidEl  = document.getElementById('unpaidBills');
  const paidEl    = document.getElementById('paidBills');
  const paidSumEl = document.getElementById('paidSummary');

  const allFiltered = filterByMember(data.bills);
  const unpaid = allFiltered.filter(b => !b.paid).sort((a,b) => new Date(a.due)-new Date(b.due));
  const paid   = allFiltered.filter(b =>  b.paid).sort((a,b) => new Date(b.paidDate||b.due)-new Date(a.paidDate||a.due));
  const todayStr = today();

  unpaidEl.innerHTML = unpaid.length
    ? unpaid.map(b => {
        const isOverdue = b.due < todayStr;
        const isSoon = !isOverdue && daysDiff(todayStr, b.due) <= 3;
        let tag = '';
        if (isOverdue) tag = `<span class="overdue-tag">⚠️ Overdue</span>`;
        else if (isSoon) tag = `<span class="soon-tag">⏰ Due soon</span>`;
        return `<div class="bill-card ${isOverdue?'overdue':isSoon?'due-soon':''}">
          <div class="bill-check" onclick="toggleBill(${b.id})"></div>
          <div class="bill-info">
            <div class="bill-name">${b.desc}</div>
            <div class="bill-meta">Due: ${fmtDate(b.due)} ${b.recur!=='none'?'· '+b.recur:''} ${tag} ${memberBadge(b.member)}</div>
          </div>
          <div class="bill-amount">${fmt(b.amount)}</div>
          <button class="bill-del" onclick="deleteBill(${b.id})">🗑</button>
        </div>`;
      }).join('')
    : `<div class="empty-state"><div class="empty-icon">🎉</div>No unpaid bills!</div>`;

  const paidTotal = paid.reduce((s,b) => s+parseFloat(b.amount||0), 0);
  paidSumEl.innerHTML = `<div><div class="ps-label">Total Paid Bills</div></div><div class="ps-val">${fmt(paidTotal)}</div>`;

  paidEl.innerHTML = paid.length
    ? paid.map(b => `
        <div class="bill-card paid-card">
          <div class="bill-check" onclick="toggleBill(${b.id})">✓</div>
          <div class="bill-info">
            <div class="bill-name" style="text-decoration:line-through;opacity:0.6">${b.desc}</div>
            <div class="bill-meta">Paid: ${fmtDate(b.paidDate||b.due)} ${memberBadge(b.member)}</div>
          </div>
          <div class="bill-amount" style="color:var(--green)">${fmt(b.amount)}</div>
          <button class="bill-del" onclick="deleteBill(${b.id})">🗑</button>
        </div>`).join('')
    : `<div class="empty-state" style="padding:12px"><div style="font-size:13px;color:var(--text-muted)">No paid bills yet</div></div>`;
}

// ===== RENDER TRANSACTIONS =====
function renderTransactions() {
  const filterType   = document.getElementById('filterType').value;
  const filterMember = document.getElementById('filterMemberTx').value;
  const filterMonth  = document.getElementById('filterMonth').value;
  const el = document.getElementById('transactionList');

  let all = [
    ...data.income.map(i  => ({ ...i, type:'income' })),
    ...data.expenses.map(e => ({ ...e, type:'expense' }))
  ];

  if (filterType   !== 'all') all = all.filter(i => i.type   === filterType);
  if (filterMember !== 'all') all = all.filter(i => i.member === filterMember);
  if (filterMonth)             all = all.filter(i => i.date && i.date.startsWith(filterMonth));

  all.sort((a,b) => new Date(b.date)-new Date(a.date));

  if (!all.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div>No transactions found</div>`;
    return;
  }

  el.innerHTML = all.map(item => `
    <div class="tx-item">
      <div class="tx-left">
        <div class="tx-desc">${item.type==='income'?'💰':getCatIcon(item.cat)} ${item.desc}</div>
        <div class="tx-meta">${fmtDate(item.date)} ${item.cat?'· '+item.cat:''} ${memberBadge(item.member)}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${item.type}">${item.type==='income'?'+':'-'}${fmt(item.amount)}</div>
        <button class="tx-del" onclick="${item.type==='income'?'deleteIncome':'deleteExpense'}(${item.id})">🗑</button>
      </div>
    </div>`).join('');
}

// ===== CALENDAR =====
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

function renderCalendar() {
  const el    = document.getElementById('calGrid');
  const label = document.getElementById('calMonthYear');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  label.textContent = `${months[calMonth]} ${calYear}`;

  const todayStr   = today();
  const firstDay   = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();

  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i=0; i<firstDay; i++) html += `<div class="cal-day empty"></div>`;

  for (let d=1; d<=daysInMonth; d++) {
    const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const bills  = data.bills.filter(b => b.due===ds && !b.paid);
    const incomes = data.income.filter(i => i.date===ds);
    const exps   = data.expenses.filter(e => e.date===ds);
    const isToday = ds === todayStr;

    // Show member-colored dots
    const dots = [
      ...bills.map(b  => `<div class="dot bill" title="${b.desc}"></div>`),
      ...incomes.map(i => `<div class="dot ${i.member||'income'}" title="${i.desc}"></div>`),
      ...exps.map(e   => `<div class="dot ${e.member||'expense'}" title="${e.desc}"></div>`)
    ].slice(0,4).join('');

    html += `<div class="cal-day ${isToday?'today':''}" onclick="showDayDetail('${ds}')">
      ${d}<div class="dot-row">${dots}</div>
    </div>`;
  }
  el.innerHTML = html;
}

function prevMonth() { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); document.getElementById('calDayDetail').classList.add('hidden'); }
function nextMonth() { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); document.getElementById('calDayDetail').classList.add('hidden'); }

function showDayDetail(ds) {
  const el     = document.getElementById('calDayDetail');
  const bills  = data.bills.filter(b => b.due===ds);
  const incomes = data.income.filter(i => i.date===ds);
  const exps   = data.expenses.filter(e => e.date===ds);

  if (!bills.length && !incomes.length && !exps.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:8px">${fmtDate(ds)} — No entries</div>`;
  } else {
    let html = `<div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text-muted)">${fmtDate(ds)}</div>`;

    if (bills.length) {
      html += `<div style="font-size:10px;color:var(--yellow);text-transform:uppercase;font-weight:700;margin-bottom:6px">Bills Due</div>`;
      html += bills.map(b => `<div class="breakdown-item" style="margin-bottom:6px">
        <div class="bi-left"><div class="bi-desc">🧾 ${b.desc}</div><div class="bi-meta">${b.paid?'✅ Paid':'⏳ Unpaid'} ${memberBadge(b.member)}</div></div>
        <div class="bi-amount" style="color:var(--yellow)">${fmt(b.amount)}</div></div>`).join('');
    }
    if (incomes.length) {
      html += `<div style="font-size:10px;color:var(--green);text-transform:uppercase;font-weight:700;margin:10px 0 6px">Income</div>`;
      html += incomes.map(i => `<div class="breakdown-item income" style="margin-bottom:6px">
        <div class="bi-left"><div class="bi-desc">💰 ${i.desc}</div><div class="bi-meta">${memberBadge(i.member)}</div></div>
        <div class="bi-amount">+${fmt(i.amount)}</div></div>`).join('');
    }
    if (exps.length) {
      html += `<div style="font-size:10px;color:var(--accent);text-transform:uppercase;font-weight:700;margin:10px 0 6px">Expenses</div>`;
      html += exps.map(e => `<div class="breakdown-item expense" style="margin-bottom:6px">
        <div class="bi-left"><div class="bi-desc">${getCatIcon(e.cat)} ${e.desc}</div><div class="bi-meta">${memberBadge(e.member)}</div></div>
        <div class="bi-amount">-${fmt(e.amount)}</div></div>`).join('');
    }
    el.innerHTML = html;
  }
  el.classList.remove('hidden');
}

// ===== REMINDERS =====
function checkReminders() {
  const todayStr = today();
  const dueTodayBills = data.bills.filter(b => b.due===todayStr && !b.paid);
  const badge = document.getElementById('reminderBadge');

  if (dueTodayBills.length) {
    badge.textContent = `🔔 ${dueTodayBills.length} bill${dueTodayBills.length>1?'s':''} due today!`;
    badge.classList.remove('hidden');
    badge.onclick = () => { switchTab('bills'); badge.classList.add('hidden'); };
    if (Notification.permission === 'granted') {
      dueTodayBills.forEach(b => new Notification('BudgetPH – Bill Due!', { body: `${b.desc}: ${fmt(b.amount)} (${b.member||''})`, icon: '/icon-192.png' }));
    }
  } else {
    badge.classList.add('hidden');
  }
}

function requestNotifications() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p => p==='granted' ? showToast('🔔 Notifications enabled!') : null);
  } else if (Notification.permission === 'granted') {
    showToast('Notifications already enabled'); checkReminders();
  } else {
    showToast('Notifications blocked in browser settings.');
  }
}

// ===== CLEAR DATA =====
document.getElementById('clearBtn').onclick = () => document.getElementById('confirmModal').classList.remove('hidden');

function confirmClear() {
  data = { income:[], expenses:[], bills:[], budgets:[] };
  localStorage.removeItem('budgetph_v2');
  closeConfirm();
  updateSummary(); renderBreakdown(); renderBills(); renderTransactions(); renderCalendar(); renderBudgetOverview();
  checkReminders();
  showToast('🗑️ All data cleared');
}
function closeConfirm() { document.getElementById('confirmModal').classList.add('hidden'); }

// ===== TABS =====
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`page-${tabName}`).classList.add('active');
}
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

// ===== TOAST =====
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}

// ===== HELPERS =====
function getCatIcon(cat) {
  return { Food:'🍔', Transport:'🚌', Utilities:'💡', Shopping:'🛍️', Health:'💊', Entertainment:'🎮', Other:'📦' }[cat] || '📦';
}
function daysDiff(from, to) { return Math.round((new Date(to)-new Date(from))/86400000); }

// ===== INIT =====
function init() {
  load();

  const todayStr = today();
  document.getElementById('incDate').value   = todayStr;
  document.getElementById('expDate').value   = todayStr;
  document.getElementById('billDue').value   = todayStr;
  document.getElementById('budgetMonth').value = todayStr.slice(0,7);
  document.getElementById('filterMonth').value = todayStr.slice(0,7);

  // Setup toggle groups
  ['incMember','expMember','billMember','budgetMember'].forEach(setupToggles);
  setupMemberBar();

  document.getElementById('notifBtn').onclick = requestNotifications;

  updateSummary();
  renderBreakdown();
  renderBills();
  renderTransactions();
  renderCalendar();
  renderBudgetOverview();

  setTimeout(checkReminders, 600);
  setInterval(checkReminders, 60000);
}

window.addEventListener('load', () => {
  init();
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
  }, 2200);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}
