// ================================================================
//  BudgetPH – app.js  (v3 – monthly view, carryover, edit, cat budgets)
// ================================================================

const MEMBERS      = ['Tin','Cesar','Kids'];
const MEMBER_EMOJI = { Tin:'👩', Cesar:'👨', Kids:'🧒' };
const CATS         = ['Food','Transport','Utilities','Shopping','Health','Entertainment','Other'];
const CAT_ICON     = { Food:'🍔', Transport:'🚌', Utilities:'💡', Shopping:'🛍️', Health:'💊', Entertainment:'🎮', Other:'📦', Total:'💰' };

// ── active state ──────────────────────────────────────────────
let data = { income:[], expenses:[], bills:[], budgets:[] };
let activeFilter = 'all';

// Active display month (year/month only)
let activeYear  = new Date().getFullYear();
let activeMonth = new Date().getMonth(); // 0-indexed

// Calendar display month (can differ)
let calYear  = activeYear;
let calMonth = activeMonth;

// ── persistence ───────────────────────────────────────────────
function save() { localStorage.setItem('budgetph_v3', JSON.stringify(data)); }
function load() {
  const raw = localStorage.getItem('budgetph_v3');
  if (raw) try { data = JSON.parse(raw); } catch(e) {}
  data.income   = data.income   || [];
  data.expenses = data.expenses || [];
  data.bills    = data.bills    || [];
  data.budgets  = data.budgets  || [];
}

// ── format helpers ────────────────────────────────────────────
const fmt     = n  => '₱' + parseFloat(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate = d  => { if(!d) return ''; return new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}); };
const today   = () => new Date().toISOString().split('T')[0];
const padMonth= m  => String(m+1).padStart(2,'0');
const activeMonthStr = () => `${activeYear}-${padMonth(activeMonth)}`;   // e.g. "2025-05"

// ── month navigation ──────────────────────────────────────────
function shiftMonth(dir) {
  activeMonth += dir;
  if (activeMonth > 11) { activeMonth = 0;  activeYear++; }
  if (activeMonth < 0)  { activeMonth = 11; activeYear--; }
  updateMonthLabel();
  refreshAll();
}

function updateMonthLabel() {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('activeMonthLabel').textContent = `${names[activeMonth]} ${activeYear}`;
}

// ── member filter bar ─────────────────────────────────────────
function setupMemberBar() {
  document.querySelectorAll('.member-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.member-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeFilter = pill.dataset.member;
      refreshAll();
    });
  });
}

// ── member toggle buttons in forms ───────────────────────────
function setupToggles(groupId) {
  const g = document.getElementById(groupId);
  if (!g) return;
  g.querySelectorAll('.mtog').forEach(btn => {
    btn.addEventListener('click', () => {
      g.querySelectorAll('.mtog').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}
function getToggle(groupId) {
  const g = document.getElementById(groupId);
  if (!g) return 'Tin';
  const a = g.querySelector('.mtog.active');
  return a ? a.dataset.val : 'Tin';
}
function setToggle(groupId, val) {
  const g = document.getElementById(groupId);
  if (!g) return;
  g.querySelectorAll('.mtog').forEach(b => { b.classList.toggle('active', b.dataset.val === val); });
}

// ── filter helpers ────────────────────────────────────────────
function byMember(arr)  { return activeFilter === 'all' ? arr : arr.filter(x => x.member === activeFilter); }
function byMonth(arr, ms) { return arr.filter(x => x.date && x.date.startsWith(ms)); }
function byMemberMonth(arr, ms) { return byMonth(byMember(arr), ms); }

// ── CARRYOVER BALANCE ─────────────────────────────────────────
// Sum balance of all months before activeMonthStr, for the active member filter
function calcCarryover() {
  const ms = activeMonthStr();
  // all entries before this month
  const prevIncome = byMember(data.income).filter(i => i.date && i.date < ms.slice(0,7)+'-32');
  const prevExp    = byMember(data.expenses).filter(e => e.date && e.date.slice(0,7) < ms);
  const prevPaid   = byMember(data.bills).filter(b => b.paid && b.paidDate && b.paidDate.slice(0,7) < ms);

  const inc  = prevIncome.filter(i => i.date.slice(0,7) < ms).reduce((s,i) => s+parseFloat(i.amount||0), 0);
  const exp  = prevExp.reduce((s,e) => s+parseFloat(e.amount||0), 0);
  const paid = prevPaid.reduce((s,b) => s+parseFloat(b.amount||0), 0);
  return inc - exp - paid;
}

// ── SUMMARY ───────────────────────────────────────────────────
function updateSummary() {
  const ms   = activeMonthStr();
  const inc  = byMemberMonth(data.income,   ms);
  const exp  = byMemberMonth(data.expenses, ms);
  const paid = byMember(data.bills).filter(b => b.paid && b.paidDate && b.paidDate.startsWith(ms));

  const totalInc  = inc.reduce((s,i)  => s+parseFloat(i.amount||0), 0);
  const totalExp  = exp.reduce((s,e)  => s+parseFloat(e.amount||0), 0);
  const totalPaid = paid.reduce((s,b) => s+parseFloat(b.amount||0), 0);
  const totalDeducted = totalExp + totalPaid;

  const carryover = calcCarryover();
  const balance   = carryover + totalInc - totalDeducted;

  document.getElementById('totalIncome').textContent   = fmt(totalInc);
  document.getElementById('totalExpenses').textContent = fmt(totalDeducted);
  document.getElementById('totalBalance').textContent  = fmt(balance);
  document.getElementById('totalBalance').style.color  = balance >= 0 ? 'var(--green)' : 'var(--accent)';

  // Carryover banner
  const banner = document.getElementById('carryoverBanner');
  if (carryover !== 0) {
    banner.classList.remove('hidden');
    banner.innerHTML = `<span class="co-label">🔁 Carryover from previous months:</span><span class="co-val">${fmt(carryover)}</span>`;
  } else {
    banner.classList.add('hidden');
  }

  renderMemberCards();
}

// ── MEMBER CARDS ──────────────────────────────────────────────
function renderMemberCards() {
  const el = document.getElementById('memberCards');
  if (activeFilter !== 'all') { el.innerHTML = ''; return; }

  const ms = activeMonthStr();
  el.innerHTML = MEMBERS.map(m => {
    const inc  = byMonth(data.income.filter(i   => i.member===m), ms).reduce((s,i) => s+parseFloat(i.amount||0), 0);
    const exp  = byMonth(data.expenses.filter(e => e.member===m), ms).reduce((s,e) => s+parseFloat(e.amount||0), 0);
    const paid = data.bills.filter(b => b.member===m && b.paid && b.paidDate && b.paidDate.startsWith(ms)).reduce((s,b) => s+parseFloat(b.amount||0), 0);

    // carryover for this member
    const prevInc  = data.income.filter(i   => i.member===m && i.date && i.date.slice(0,7) < ms).reduce((s,i) => s+parseFloat(i.amount||0), 0);
    const prevExp  = data.expenses.filter(e => e.member===m && e.date && e.date.slice(0,7) < ms).reduce((s,e) => s+parseFloat(e.amount||0), 0);
    const prevPaid = data.bills.filter(b    => b.member===m && b.paid && b.paidDate && b.paidDate.slice(0,7) < ms).reduce((s,b) => s+parseFloat(b.amount||0), 0);
    const carry = prevInc - prevExp - prevPaid;
    const bal = carry + inc - exp - paid;

    // Overall budget bar for this month
    const bkey = `${m}_Total_${ms}`;
    const budget = data.budgets.find(b => b.key === bkey);
    let budgetBar = '';
    if (budget) {
      const spent = exp + paid;
      const pct = budget.amount > 0 ? Math.min((spent/budget.amount)*100, 100) : 0;
      const cls  = pct>=100?'over':pct>=80?'warn':'ok';
      budgetBar = `<div style="margin-top:8px">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:4px">
          <span>Budget ${fmt(budget.amount)}</span><span>Spent ${fmt(spent)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
      </div>`;
    }

    return `<div class="member-card ${m}">
      <div class="mc-name ${m}">${MEMBER_EMOJI[m]} ${m}</div>
      <div class="mc-stats">
        <div class="mc-stat"><div class="mc-stat-label">Income</div><div class="mc-stat-val" style="color:var(--green)">${fmt(inc)}</div></div>
        <div class="mc-stat"><div class="mc-stat-label">Spent</div><div class="mc-stat-val" style="color:var(--accent)">${fmt(exp+paid)}</div></div>
        <div class="mc-stat"><div class="mc-stat-label">Balance</div><div class="mc-stat-val" style="color:${bal>=0?'var(--yellow)':'var(--accent)'}">${fmt(bal)}</div></div>
      </div>
      ${budgetBar}
    </div>`;
  }).join('');
}

const memberBadge = m => m ? `<span class="mbadge ${m}">${MEMBER_EMOJI[m]} ${m}</span>` : '';

// ── ADD INCOME ────────────────────────────────────────────────
function addIncome() {
  const desc   = document.getElementById('incDesc').value.trim();
  const amount = parseFloat(document.getElementById('incAmount').value);
  const date   = document.getElementById('incDate').value || today();
  const member = getToggle('incMember');
  if (!desc)          return showToast('Enter a description');
  if (!(amount > 0))  return showToast('Enter a valid amount');
  data.income.push({ id:Date.now(), desc, amount, date, member });
  save();
  document.getElementById('incDesc').value = '';
  document.getElementById('incAmount').value = '';
  refreshAll();
  showToast(`✅ Income added for ${member}!`);
}

// ── ADD EXPENSE ───────────────────────────────────────────────
function addExpense() {
  const desc   = document.getElementById('expDesc').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const date   = document.getElementById('expDate').value || today();
  const cat    = document.getElementById('expCat').value;
  const member = getToggle('expMember');
  if (!desc)          return showToast('Enter a description');
  if (!(amount > 0))  return showToast('Enter a valid amount');
  data.expenses.push({ id:Date.now(), desc, amount, date, cat, member });
  save();
  document.getElementById('expDesc').value = '';
  document.getElementById('expAmount').value = '';
  refreshAll();
  showToast(`✅ Expense added for ${member}!`);
}

// ── ADD BILL ──────────────────────────────────────────────────
function addBill() {
  const desc   = document.getElementById('billDesc').value.trim();
  const amount = parseFloat(document.getElementById('billAmount').value);
  const due    = document.getElementById('billDue').value;
  const recur  = document.getElementById('billRecur').value;
  const member = getToggle('billMember');
  if (!desc)          return showToast('Enter a bill name');
  if (!(amount > 0))  return showToast('Enter a valid amount');
  if (!due)           return showToast('Select a due date');
  data.bills.push({ id:Date.now(), desc, amount, due, recur, member, paid:false });
  save();
  document.getElementById('billDesc').value = '';
  document.getElementById('billAmount').value = '';
  refreshAll();
  checkReminders();
  showToast(`🔔 Bill added for ${member}!`);
}

// ── TOGGLE BILL PAID ──────────────────────────────────────────
function toggleBill(id) {
  const b = data.bills.find(x => x.id === id);
  if (!b) return;
  b.paid = !b.paid;
  b.paidDate = b.paid ? today() : null;
  save(); refreshAll(); checkReminders();
  showToast(b.paid ? '✅ Marked as paid!' : '↩️ Marked unpaid');
}

// ── SET BUDGET ────────────────────────────────────────────────
function setBudget() {
  const member = getToggle('budgetMember');
  const cat    = document.getElementById('budgetCat').value;
  const amount = parseFloat(document.getElementById('budgetAmount').value);
  const month  = document.getElementById('budgetMonth').value;
  if (!(amount > 0)) return showToast('Enter a budget amount');
  if (!month)        return showToast('Select a month');
  const key = `${member}_${cat}_${month}`;
  const idx = data.budgets.findIndex(b => b.key === key);
  if (idx >= 0) data.budgets[idx].amount = amount;
  else data.budgets.push({ key, member, cat, month, amount });
  save();
  document.getElementById('budgetAmount').value = '';
  renderBudgetOverview();
  updateSummary();
  showToast(`🎯 Budget set for ${member} – ${cat}!`);
}

// ── DELETE ────────────────────────────────────────────────────
function deleteIncome(id)  { data.income   = data.income.filter(i  => i.id!==id);   save(); refreshAll(); showToast('Deleted'); }
function deleteExpense(id) { data.expenses = data.expenses.filter(e => e.id!==id);  save(); refreshAll(); showToast('Deleted'); }
function deleteBill(id)    { data.bills    = data.bills.filter(b   => b.id!==id);   save(); refreshAll(); checkReminders(); showToast('Deleted'); }
function deleteBudget(key) { data.budgets  = data.budgets.filter(b => b.key!==key); save(); renderBudgetOverview(); updateSummary(); showToast('Deleted'); }

// ── EDIT MODALS ───────────────────────────────────────────────
function openEditModal(title, bodyHTML) {
  document.getElementById('editModalTitle').textContent = title;
  document.getElementById('editModalBody').innerHTML = bodyHTML;
  document.getElementById('editModal').classList.remove('hidden');
  // Re-bind member toggles inside modal
  ['editMember','editBillMember'].forEach(setupToggles);
}
function closeEditModal() { document.getElementById('editModal').classList.add('hidden'); }

function editIncome(id) {
  const item = data.income.find(i => i.id === id);
  if (!item) return;
  openEditModal('✏️ Edit Income', `
    <label class="modal-label">Description</label>
    <input id="eDesc"   value="${item.desc}"/>
    <label class="modal-label">Amount (₱)</label>
    <input id="eAmount" type="number" value="${item.amount}" min="0" step="0.01"/>
    <label class="modal-label">Date</label>
    <input id="eDate"   type="date"   value="${item.date}"/>
    <label class="modal-label">For</label>
    <div class="mtog-group" id="editMember">
      <button class="mtog tin   ${item.member==='Tin'  ?'active':''}" data-val="Tin">👩 Tin</button>
      <button class="mtog cesar ${item.member==='Cesar'?'active':''}" data-val="Cesar">👨 Cesar</button>
      <button class="mtog kids  ${item.member==='Kids' ?'active':''}" data-val="Kids">🧒 Kids</button>
    </div>
    <button class="btn primary" onclick="saveIncome(${id})">💾 Save</button>
  `);
}
function saveIncome(id) {
  const item = data.income.find(i => i.id === id);
  if (!item) return;
  const desc   = document.getElementById('eDesc').value.trim();
  const amount = parseFloat(document.getElementById('eAmount').value);
  const date   = document.getElementById('eDate').value;
  const member = getToggle('editMember');
  if (!desc || !(amount>0)) return showToast('Fill all fields');
  Object.assign(item, { desc, amount, date, member });
  save(); closeEditModal(); refreshAll();
  showToast('✅ Income updated!');
}

function editExpense(id) {
  const item = data.expenses.find(e => e.id === id);
  if (!item) return;
  const catOpts = ['Food','Transport','Utilities','Shopping','Health','Entertainment','Other']
    .map(c => `<option value="${c}" ${item.cat===c?'selected':''}>${CAT_ICON[c]} ${c}</option>`).join('');
  openEditModal('✏️ Edit Expense', `
    <label class="modal-label">Description</label>
    <input id="eDesc"   value="${item.desc}"/>
    <label class="modal-label">Amount (₱)</label>
    <input id="eAmount" type="number" value="${item.amount}" min="0" step="0.01"/>
    <label class="modal-label">Date</label>
    <input id="eDate"   type="date"   value="${item.date}"/>
    <label class="modal-label">Category</label>
    <select id="eCat">${catOpts}</select>
    <label class="modal-label">For</label>
    <div class="mtog-group" id="editMember">
      <button class="mtog tin   ${item.member==='Tin'  ?'active':''}" data-val="Tin">👩 Tin</button>
      <button class="mtog cesar ${item.member==='Cesar'?'active':''}" data-val="Cesar">👨 Cesar</button>
      <button class="mtog kids  ${item.member==='Kids' ?'active':''}" data-val="Kids">🧒 Kids</button>
    </div>
    <button class="btn accent" onclick="saveExpense(${id})">💾 Save</button>
  `);
}
function saveExpense(id) {
  const item = data.expenses.find(e => e.id === id);
  if (!item) return;
  const desc   = document.getElementById('eDesc').value.trim();
  const amount = parseFloat(document.getElementById('eAmount').value);
  const date   = document.getElementById('eDate').value;
  const cat    = document.getElementById('eCat').value;
  const member = getToggle('editMember');
  if (!desc || !(amount>0)) return showToast('Fill all fields');
  Object.assign(item, { desc, amount, date, cat, member });
  save(); closeEditModal(); refreshAll();
  showToast('✅ Expense updated!');
}

function editBill(id) {
  const item = data.bills.find(b => b.id === id);
  if (!item) return;
  openEditModal('✏️ Edit Bill', `
    <label class="modal-label">Bill Name</label>
    <input id="eBillDesc"   value="${item.desc}"/>
    <label class="modal-label">Amount (₱)</label>
    <input id="eBillAmount" type="number" value="${item.amount}" min="0" step="0.01"/>
    <label class="modal-label">Due Date</label>
    <input id="eBillDue"    type="date"   value="${item.due}"/>
    <label class="modal-label">Recurrence</label>
    <select id="eBillRecur">
      <option value="none"    ${item.recur==='none'   ?'selected':''}>One-time</option>
      <option value="monthly" ${item.recur==='monthly'?'selected':''}>Monthly</option>
      <option value="weekly"  ${item.recur==='weekly' ?'selected':''}>Weekly</option>
    </select>
    <label class="modal-label">For</label>
    <div class="mtog-group" id="editBillMember">
      <button class="mtog tin   ${item.member==='Tin'  ?'active':''}" data-val="Tin">👩 Tin</button>
      <button class="mtog cesar ${item.member==='Cesar'?'active':''}" data-val="Cesar">👨 Cesar</button>
      <button class="mtog kids  ${item.member==='Kids' ?'active':''}" data-val="Kids">🧒 Kids</button>
    </div>
    <button class="btn warning" onclick="saveBill(${id})">💾 Save</button>
  `);
}
function saveBill(id) {
  const item = data.bills.find(b => b.id === id);
  if (!item) return;
  const desc   = document.getElementById('eBillDesc').value.trim();
  const amount = parseFloat(document.getElementById('eBillAmount').value);
  const due    = document.getElementById('eBillDue').value;
  const recur  = document.getElementById('eBillRecur').value;
  const member = getToggle('editBillMember');
  if (!desc || !(amount>0) || !due) return showToast('Fill all fields');
  Object.assign(item, { desc, amount, due, recur, member });
  save(); closeEditModal(); refreshAll();
  showToast('✅ Bill updated!');
}

// ── RENDER DASHBOARD BREAKDOWN ────────────────────────────────
function renderBreakdown() {
  const el = document.getElementById('breakdown');
  const ms = activeMonthStr();
  const inc = byMemberMonth(data.income,   ms).map(i => ({...i, type:'income'}));
  const exp = byMemberMonth(data.expenses, ms).map(e => ({...e, type:'expense'}));
  const all = [...inc, ...exp].sort((a,b) => new Date(b.date)-new Date(a.date));

  if (!all.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div>No transactions for this month</div>`;
    return;
  }
  el.innerHTML = all.map(item => `
    <div class="breakdown-item ${item.type}">
      <div class="bi-left">
        <div class="bi-desc">${item.type==='income'?'💰':CAT_ICON[item.cat]||'📦'} ${item.desc}</div>
        <div class="bi-meta">${fmtDate(item.date)} ${item.cat?'· '+item.cat:''} ${memberBadge(item.member)}</div>
      </div>
      <div class="bi-actions">
        <div class="bi-amount">${item.type==='income'?'+':'-'}${fmt(item.amount)}</div>
        <button class="bi-btn" onclick="${item.type==='income'?'editIncome':'editExpense'}(${item.id})">✏️</button>
        <button class="bi-btn" onclick="${item.type==='income'?'deleteIncome':'deleteExpense'}(${item.id})">🗑</button>
      </div>
    </div>`).join('');
}

// ── RENDER BILLS ──────────────────────────────────────────────
function renderBills() {
  const unpaidEl  = document.getElementById('unpaidBills');
  const paidEl    = document.getElementById('paidBills');
  const paidSumEl = document.getElementById('paidSummary');
  const todayStr  = today();
  const ms        = activeMonthStr();

  // Show bills for active month (due date in that month) or unpaid bills from any month
  const allFiltered = byMember(data.bills);
  const unpaid = allFiltered.filter(b => !b.paid).sort((a,b) => new Date(a.due)-new Date(b.due));
  const paid   = allFiltered.filter(b =>  b.paid && b.paidDate && b.paidDate.startsWith(ms))
                             .sort((a,b) => new Date(b.paidDate)-new Date(a.paidDate));

  unpaidEl.innerHTML = unpaid.length ? unpaid.map(b => {
    const isOverdue = b.due < todayStr;
    const isSoon    = !isOverdue && daysDiff(todayStr, b.due) <= 3;
    const tag       = isOverdue ? `<span class="overdue-tag">⚠️ Overdue</span>` : isSoon ? `<span class="soon-tag">⏰ Due soon</span>` : '';
    return `<div class="bill-card ${isOverdue?'overdue':isSoon?'due-soon':''}">
      <div class="bill-check" onclick="toggleBill(${b.id})"></div>
      <div class="bill-info">
        <div class="bill-name">${b.desc}</div>
        <div class="bill-meta">Due: ${fmtDate(b.due)} ${b.recur!=='none'?'· '+b.recur:''} ${tag} ${memberBadge(b.member)}</div>
      </div>
      <div class="bill-amount">${fmt(b.amount)}</div>
      <div class="bill-actions">
        <button class="bill-btn" onclick="editBill(${b.id})">✏️</button>
        <button class="bill-btn" onclick="deleteBill(${b.id})">🗑</button>
      </div>
    </div>`;
  }).join('') : `<div class="empty-state"><div class="empty-icon">🎉</div>No unpaid bills!</div>`;

  const paidTotal = paid.reduce((s,b) => s+parseFloat(b.amount||0), 0);
  paidSumEl.innerHTML = `<div><div class="ps-label">Paid this month</div></div><div class="ps-val">${fmt(paidTotal)}</div>`;

  paidEl.innerHTML = paid.length ? paid.map(b => `
    <div class="bill-card paid-card">
      <div class="bill-check" onclick="toggleBill(${b.id})">✓</div>
      <div class="bill-info">
        <div class="bill-name" style="text-decoration:line-through;opacity:.6">${b.desc}</div>
        <div class="bill-meta">Paid: ${fmtDate(b.paidDate)} ${memberBadge(b.member)}</div>
      </div>
      <div class="bill-amount" style="color:var(--green)">${fmt(b.amount)}</div>
      <div class="bill-actions">
        <button class="bill-btn" onclick="editBill(${b.id})">✏️</button>
        <button class="bill-btn" onclick="deleteBill(${b.id})">🗑</button>
      </div>
    </div>`).join('')
  : `<div class="empty-state" style="padding:12px"><div style="font-size:13px;color:var(--text-muted)">No paid bills this month</div></div>`;
}

// ── RENDER HISTORY ────────────────────────────────────────────
function renderHistory() {
  const filterType   = document.getElementById('filterType').value;
  const filterMember = document.getElementById('filterMemberTx').value;
  const filterMonth  = document.getElementById('filterMonth').value;
  const el = document.getElementById('historyList');

  let all = [
    ...data.income.map(i   => ({...i, type:'income'})),
    ...data.expenses.map(e => ({...e, type:'expense'}))
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
        <div class="tx-desc">${item.type==='income'?'💰':CAT_ICON[item.cat]||'📦'} ${item.desc}</div>
        <div class="tx-meta">${fmtDate(item.date)} ${item.cat?'· '+item.cat:''} ${memberBadge(item.member)}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${item.type}">${item.type==='income'?'+':'-'}${fmt(item.amount)}</div>
        <button class="tx-btn" onclick="${item.type==='income'?'editIncome':'editExpense'}(${item.id})">✏️</button>
        <button class="tx-btn" onclick="${item.type==='income'?'deleteIncome':'deleteExpense'}(${item.id})">🗑</button>
      </div>
    </div>`).join('');
}

// ── BUDGET OVERVIEW ───────────────────────────────────────────
function renderBudgetOverview() {
  const el  = document.getElementById('budgetOverview');
  const lbl = document.getElementById('budgetMonthLabel');
  const ms  = activeMonthStr();
  lbl.textContent = `– ${ms}`;

  // Show budgets for the active month
  const budgets = data.budgets.filter(b => b.month === ms)
                               .sort((a,b) => a.member.localeCompare(b.member) || a.cat.localeCompare(b.cat));

  if (!budgets.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div>No budgets set for ${ms}</div>`;
    return;
  }

  el.innerHTML = budgets.map(b => {
    let spent = 0;
    if (b.cat === 'Total') {
      // All expenses + paid bills for this member this month
      spent = byMonth(data.expenses.filter(e => e.member===b.member), ms).reduce((s,e) => s+parseFloat(e.amount||0), 0)
            + data.bills.filter(bl => bl.member===b.member && bl.paid && bl.paidDate && bl.paidDate.startsWith(ms)).reduce((s,bl) => s+parseFloat(bl.amount||0), 0);
    } else {
      // Only matching category expenses this month
      spent = byMonth(data.expenses.filter(e => e.member===b.member && e.cat===b.cat), ms).reduce((s,e) => s+parseFloat(e.amount||0), 0);
    }

    const pct = b.amount > 0 ? Math.min((spent/b.amount)*100, 100) : 0;
    const cls = pct>=100?'over':pct>=80?'warn':'ok';
    const remaining = b.amount - spent;
    const statusText = pct>=100
      ? `🔴 Over by ${fmt(spent-b.amount)}`
      : pct>=80 ? `🟡 ${fmt(remaining)} left` : `🟢 ${fmt(remaining)} left`;

    return `<div class="budget-card">
      <div class="bc-header">
        <div class="bc-title">
          <span>${CAT_ICON[b.cat]||'📦'}</span>
          <div>
            <div class="bc-cat">${b.cat === 'Total' ? 'Overall Budget' : b.cat}</div>
            <div class="bc-month-label bc-name ${b.member}">${MEMBER_EMOJI[b.member]} ${b.member}</div>
          </div>
        </div>
        <button class="bc-del" onclick="deleteBudget('${b.key}')">🗑</button>
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

// ── CALENDAR ──────────────────────────────────────────────────
function renderCalendar() {
  const el    = document.getElementById('calGrid');
  const label = document.getElementById('calMonthYear');
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  label.textContent = `${names[calMonth]} ${calYear}`;

  const todayStr    = today();
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();

  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i=0; i<firstDay; i++) html += `<div class="cal-day empty"></div>`;

  for (let d=1; d<=daysInMonth; d++) {
    const ds  = `${calYear}-${padMonth(calMonth)}-${String(d).padStart(2,'0')}`;
    const bls = data.bills.filter(b => b.due===ds && !b.paid);
    const inc = data.income.filter(i => i.date===ds);
    const exp = data.expenses.filter(e => e.date===ds);
    const dots = [
      ...bls.map(b  => `<div class="dot bill"></div>`),
      ...inc.map(i  => `<div class="dot ${i.member||'income'}"></div>`),
      ...exp.map(e  => `<div class="dot ${e.member||'expense'}"></div>`)
    ].slice(0,5).join('');
    html += `<div class="cal-day ${ds===todayStr?'today':''}" onclick="showDayDetail('${ds}')">${d}<div class="dot-row">${dots}</div></div>`;
  }
  el.innerHTML = html;
}

function prevCal() { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); document.getElementById('calDayDetail').classList.add('hidden'); }
function nextCal() { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); document.getElementById('calDayDetail').classList.add('hidden'); }

function showDayDetail(ds) {
  const el  = document.getElementById('calDayDetail');
  const bls = data.bills.filter(b => b.due===ds);
  const inc = data.income.filter(i => i.date===ds);
  const exp = data.expenses.filter(e => e.date===ds);

  if (!bls.length && !inc.length && !exp.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:8px">${fmtDate(ds)} — No entries</div>`;
  } else {
    let html = `<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text-muted)">${fmtDate(ds)}</div>`;
    if (bls.length) { html += `<div style="font-size:10px;color:var(--yellow);font-weight:700;text-transform:uppercase;margin-bottom:5px">Bills</div>` + bls.map(b => `<div class="breakdown-item" style="margin-bottom:5px"><div class="bi-left"><div class="bi-desc">🧾 ${b.desc}</div><div class="bi-meta">${b.paid?'✅ Paid':'⏳ Unpaid'} ${memberBadge(b.member)}</div></div><div class="bi-amount" style="color:var(--yellow)">${fmt(b.amount)}</div></div>`).join(''); }
    if (inc.length) { html += `<div style="font-size:10px;color:var(--green);font-weight:700;text-transform:uppercase;margin:8px 0 5px">Income</div>` + inc.map(i => `<div class="breakdown-item income" style="margin-bottom:5px"><div class="bi-left"><div class="bi-desc">💰 ${i.desc}</div><div class="bi-meta">${memberBadge(i.member)}</div></div><div class="bi-amount">+${fmt(i.amount)}</div></div>`).join(''); }
    if (exp.length) { html += `<div style="font-size:10px;color:var(--accent);font-weight:700;text-transform:uppercase;margin:8px 0 5px">Expenses</div>` + exp.map(e => `<div class="breakdown-item expense" style="margin-bottom:5px"><div class="bi-left"><div class="bi-desc">${CAT_ICON[e.cat]||'📦'} ${e.desc}</div><div class="bi-meta">${memberBadge(e.member)}</div></div><div class="bi-amount">-${fmt(e.amount)}</div></div>`).join(''); }
    el.innerHTML = html;
  }
  el.classList.remove('hidden');
}

// ── REMINDERS ─────────────────────────────────────────────────
function checkReminders() {
  const todayStr = today();
  const due = data.bills.filter(b => b.due===todayStr && !b.paid);
  const badge = document.getElementById('reminderBadge');
  if (due.length) {
    badge.textContent = `🔔 ${due.length} bill${due.length>1?'s':''} due today!`;
    badge.classList.remove('hidden');
    badge.onclick = () => { switchTab('bills'); badge.classList.add('hidden'); };
    if (Notification.permission==='granted') due.forEach(b => new Notification('BudgetPH – Bill Due!',{body:`${b.desc}: ${fmt(b.amount)} (${b.member||''})`,icon:'/icon-192.png'}));
  } else { badge.classList.add('hidden'); }
}
function requestNotifications() {
  if ('Notification' in window && Notification.permission==='default') Notification.requestPermission().then(p => p==='granted'&&showToast('🔔 Notifications enabled!'));
  else if (Notification.permission==='granted') { showToast('Notifications already enabled'); checkReminders(); }
  else showToast('Notifications blocked – check browser settings');
}

// ── CLEAR DATA ────────────────────────────────────────────────
document.getElementById('clearBtn').onclick = () => document.getElementById('confirmModal').classList.remove('hidden');
function confirmClear() {
  data = { income:[], expenses:[], bills:[], budgets:[] };
  localStorage.removeItem('budgetph_v3');
  closeConfirm(); refreshAll(); checkReminders();
  showToast('🗑️ All data cleared');
}
function closeConfirm() { document.getElementById('confirmModal').classList.add('hidden'); }

// ── TABS ──────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  document.getElementById(`page-${name}`).classList.add('active');
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}

// ── HELPERS ───────────────────────────────────────────────────
function daysDiff(from, to) { return Math.round((new Date(to)-new Date(from))/86400000); }

// ── REFRESH ALL ───────────────────────────────────────────────
function refreshAll() {
  updateSummary();
  renderBreakdown();
  renderBills();
  renderHistory();
  renderCalendar();
  renderBudgetOverview();
}

// ── INIT ──────────────────────────────────────────────────────
function init() {
  load();

  const todayStr = today();
  document.getElementById('incDate').value     = todayStr;
  document.getElementById('expDate').value     = todayStr;
  document.getElementById('billDue').value     = todayStr;
  document.getElementById('budgetMonth').value = todayStr.slice(0,7);
  document.getElementById('filterMonth').value = todayStr.slice(0,7);

  ['incMember','expMember','billMember','budgetMember'].forEach(setupToggles);
  setupMemberBar();

  document.getElementById('notifBtn').onclick = requestNotifications;

  updateMonthLabel();
  refreshAll();
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
