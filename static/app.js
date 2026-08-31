const state = {
  categories: [],
  selectedCategory: null,
  trendPeriod: 'month',
  trendAnchor: new Date().toISOString().slice(0, 10),
  history: [],
  recurring: [],
  planned: [],
};

const ICON_PATHS = {
  utensils: '<path d="M4 2v7M7 2v7M10 2v7M4 6h6M7 9v13"/><path d="M16 2v20M16 2c3 2 4 5 4 8h-4"/>',
  basket: '<path d="m5 10 2-6M19 10l-2-6M3 10h18l-2 10H5L3 10Z"/><path d="M9 14v2M15 14v2"/>',
  coffee: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M16 10h2a3 3 0 0 1 0 6h-2M6 2v3M10 2v3M14 2v3"/>',
  car: '<path d="M5 17h14l1-5-2-5H6l-2 5 1 5Z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M4 12h16"/>',
  fuel: '<path d="M6 22V3h9v19M6 8h9M4 22h13"/><path d="m15 6 3 3v8a2 2 0 0 0 4 0v-6l-2-2"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M8 7h8M8 12h.01M16 12h.01M8 21l3-4M16 21l-3-4"/>',
  house: '<path d="m3 11 9-8 9 8v10H3V11Z"/><path d="M9 21v-6h6v6"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  sparkles: '<path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3ZM5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16ZM19 14l.7 1.8 1.8.7-1.8.7L19 19l-.7-1.8-1.8-.7 1.8-.7L19 14Z"/>',
  tag: '<path d="M20.6 13.6 11 23l-9-9V2h12l6.6 6.6a3.5 3.5 0 0 1 0 5Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
  shopping: '<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
  plane: '<path d="M22 2 9.5 14.5M22 2l-7 20-4-9-9-4 20-7Z"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18"/><path d="M12 8H7.5A2.5 2.5 0 1 1 10 5.5L12 8ZM12 8h4.5A2.5 2.5 0 1 0 14 5.5L12 8Z"/>',
  book: '<path d="M4 4h5a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4V4ZM20 4h-5a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h5V4Z"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L4 17l3 3 8.3-8.3a4 4 0 0 0 5-5L18 9l-2.4-2.4 2.3-2.3a4 4 0 0 0-3.2 2Z"/>',
  paw: '<circle cx="6.5" cy="8" r="2"/><circle cx="12" cy="5.5" r="2"/><circle cx="17.5" cy="8" r="2"/><path d="M7 16c0-3 2.2-5 5-5s5 2 5 5c0 2-1.3 3-3 3-.8 0-1.4-.3-2-.8-.6.5-1.2.8-2 .8-1.7 0-3-1-3-3Z"/>',
  game: '<path d="M7 9h10a5 5 0 0 1 4.7 6.7l-1 3a2 2 0 0 1-3.3.8L15 17H9l-2.4 2.5a2 2 0 0 1-3.3-.8l-1-3A5 5 0 0 1 7 9Z"/><path d="M7 13v4M5 15h4M16 14h.01M19 16h.01"/>',
  bike: '<circle cx="5.5" cy="17" r="4"/><circle cx="18.5" cy="17" r="4"/><path d="M5.5 17 9 10h4l5.5 7M9 10l3 7M8 6h4"/>',
  medical: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
  subscription: '<path d="M20 7h-5V2M4 17h5v5"/><path d="M20 7a8 8 0 0 0-13.7-3L4 7M4 17a8 8 0 0 0 13.7 3L20 17"/>',
  education: '<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5M22 9v6"/>',
  family: '<circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M14 15a5 5 0 0 1 7 4v2"/>',
  other: '<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chart: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/>',
  calendarClock: '<rect x="3" y="5" width="16" height="16" rx="2"/><path d="M7 3v4M15 3v4M3 10h16"/><circle cx="18" cy="17" r="4"/><path d="M18 15v2l1.5 1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  refresh: '<path d="M20 6v5h-5"/><path d="M18.5 15a7 7 0 1 1 .5-7l1 3"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>'
};

const ICON_OPTIONS = [
  ['utensils','Food'], ['basket','Groceries'], ['coffee','Coffee'], ['car','Car'], ['fuel','Petrol'],
  ['train','Transit'], ['house','Home'], ['receipt','Bills'], ['phone','Mobile'], ['shopping','Shopping'],
  ['heart','Health'], ['game','Fun'], ['plane','Travel'], ['gift','Gifts'], ['book','Education'],
  ['tools','Maintenance'], ['paw','Pets'], ['subscription','Subscription'], ['family','Family'], ['tag','Other']
];

const COLOR_PRESETS = [
  '#ff9f43', '#2ed573', '#54a0ff', '#a66cff', '#2dd4bf',
  '#38bdf8', '#ff6b81', '#f368e0', '#f59e0b', '#94a3b8'
];

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

function rm(value) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 2 }).format(Number(value || 0)).replace('MYR', 'RM');
}
function shortDate(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-MY', { day:'numeric', month:'short' });
}
function fullDate(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric' });
}
function svgIcon(name, className='app-svg-icon') {
  const path = ICON_PATHS[name] || ICON_PATHS.tag;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
}
function wireStaticIcons() {
  $$('[data-ui-icon]').forEach(el => {
    el.innerHTML = svgIcon(el.dataset.uiIcon);
  });
}
function todayISO() { return new Date().toISOString().slice(0,10); }
function esc(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
async function api(url, options={}) {
  const opts = { ...options, headers: { 'Content-Type':'application/json', ...(options.headers || {}) } };
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
let toastTimer;
function toast(message, error=false) {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className='toast', 2600);
}
function empty(message) { return `<div class="empty-state">${esc(message)}</div>`; }
function iconBox(item) {
  return `<div class="row-icon" style="--cat:${esc(item.color || '#54a0ff')}">${svgIcon(item.icon)}</div>`;
}
function categoryOptions(selected=null) {
  return state.categories.filter(c => !c.archived).map(c => `<option value="${c.id}" ${Number(selected)===Number(c.id)?'selected':''}>${esc(c.name)}</option>`).join('');
}
function statusForDate(iso) {
  const today = todayISO();
  if (iso < today) return ['Overdue','status-overdue'];
  if (iso === today) return ['Due today','status-overdue'];
  return [shortDate(iso),'status-upcoming'];
}

function setupGreeting() {
  const h = new Date().getHours();
  $('#greeting').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function switchTab(name) {
  $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === name));
  $$('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  const titles = { add:'Quick add', trends:'Spending trends', planned:'Payments', history:'History', settings:'Settings' };
  $('#pageTitle').textContent = titles[name] || 'Budget';
  window.scrollTo({ top:0, behavior:'instant' });
  if (name === 'trends') loadTrends();
  if (name === 'planned') loadPayments();
  if (name === 'history') loadHistory();
  if (name === 'settings') renderCategorySettings();
}

async function loadBootstrap() {
  const data = await api('/api/bootstrap');
  state.categories = data.categories;
  $('#monthTotal').textContent = rm(data.month_total);
  const active = state.categories.filter(c => !c.archived);
  if (!active.find(c => c.id === state.selectedCategory)) state.selectedCategory = active[0]?.id ?? null;
  renderQuickCategories();
  fillCategorySelects();
  renderTransactions(data.today_transactions, $('#todayTransactions'), true);
  const total = data.today_transactions.reduce((s,t)=>s+Number(t.amount),0);
  $('#todayTotal').textContent = rm(total);
  $('#dueBadge').textContent = data.due_count;
  $('#dueBadge').classList.toggle('hidden', !data.due_count);
}

function renderQuickCategories() {
  const active = state.categories.filter(c=>!c.archived);
  $('#quickCategories').innerHTML = active.map(c => `
    <button class="category-chip ${c.id===state.selectedCategory?'selected':''}" data-category="${c.id}" style="--cat:${esc(c.color)}">
      <span class="cat-icon">${svgIcon(c.icon)}</span><span>${esc(c.name)}</span>
    </button>`).join('') || empty('Create a category first.');
  $$('.category-chip', $('#quickCategories')).forEach(btn => btn.onclick = () => {
    state.selectedCategory = Number(btn.dataset.category);
    renderQuickCategories();
  });
}

function fillCategorySelects() {
  ['#recurringCategory','#plannedCategory','#editTxCategory'].forEach(sel => {
    const el = $(sel); if (el) el.innerHTML = categoryOptions();
  });
}

async function addTransaction() {
  const amount = Number($('#quickAmount').value);
  if (!amount || amount <= 0) return toast('Enter an amount first.', true);
  if (!state.selectedCategory) return toast('Choose a category.', true);
  try {
    await api('/api/transactions', { method:'POST', body:JSON.stringify({
      amount,
      category_id: state.selectedCategory,
      spent_on: $('#quickDate').value || todayISO(),
      note: $('#quickNote').value.trim()
    })});
    $('#quickAmount').value=''; $('#quickNote').value=''; $('#quickNote').classList.add('hidden');
    $('#noteToggle').textContent='+ Add note';
    toast('Spending added.');
    await loadBootstrap();
  } catch(e) { toast(e.message, true); }
}

function renderTransactions(items, root, compact=false) {
  if (!items.length) { root.innerHTML = empty(compact ? 'Nothing logged today.' : 'No transactions in this range.'); return; }
  root.innerHTML = items.map(tx => `
    <div class="tx-row" data-tx="${tx.id}">
      ${iconBox(tx)}
      <div class="row-main"><strong>${esc(tx.category)}</strong><span>${esc(tx.note || (compact ? 'Today' : fullDate(tx.spent_on)))}</span></div>
      <div class="row-amount">${rm(tx.amount)}</div>
      ${compact ? '' : '<button class="row-action edit-tx">Edit</button>'}
    </div>`).join('');
  if (!compact) $$('.edit-tx', root).forEach(btn => btn.onclick = () => openEditTransaction(Number(btn.closest('[data-tx]').dataset.tx)));
}

async function loadHistory() {
  const start = $('#historyStart').value;
  const end = $('#historyEnd').value;
  const qs = new URLSearchParams({limit:'500'});
  if (start) qs.set('start',start); if (end) qs.set('end',end);
  try {
    state.history = await api(`/api/transactions?${qs}`);
    renderTransactions(state.history, $('#historyList'));
  } catch(e) { toast(e.message,true); }
}
function openEditTransaction(id) {
  const tx = state.history.find(t=>t.id===id);
  if (!tx) return;
  $('#editTxId').value=tx.id; $('#editTxAmount').value=Number(tx.amount).toFixed(2); $('#editTxDate').value=tx.spent_on;
  $('#editTxCategory').innerHTML=categoryOptions(tx.category_id); $('#editTxNote').value=tx.note || '';
  $('#editTxModal').showModal();
}

async function loadTrends() {
  try {
    const data = await api(`/api/trends?period=${encodeURIComponent(state.trendPeriod)}&anchor=${encodeURIComponent($('#trendAnchor').value || state.trendAnchor)}`);
    $('#trendLabel').textContent = data.label;
    $('#trendTotal').textContent = rm(data.total);
    if (data.previous_total === 0) $('#trendCompare').textContent='No previous-period spending to compare';
    else {
      const lower = data.delta <= 0;
      $('#trendCompare').textContent = `${lower?'↓':'↑'} ${rm(Math.abs(data.delta))} (${Math.abs(data.percent_change)}%) ${lower?'lower':'higher'} than previous`;
      $('#trendCompare').style.color = lower ? 'var(--good)' : 'var(--bad)';
    }
    renderBars(data.buckets);
    renderCategoryBars(data.categories, data.total);
    $('#trajectoryCard').classList.toggle('hidden', state.trendPeriod !== 'month');
    if (data.trajectory) renderTrajectory(data.trajectory);
  } catch(e) { toast(e.message,true); }
}
function renderBars(buckets) {
  const root = $('#periodChart');
  const max = Math.max(...buckets.map(b=>Number(b.total)), 1);
  root.innerHTML = buckets.map(b => {
    const h = Math.max((Number(b.total)/max)*100, b.total ? 3 : 0);
    return `<div class="bar-col" title="${esc(b.label)}: ${rm(b.total)}"><div class="bar-fill-wrap"><div class="bar-fill" style="height:${h}%"></div></div><small>${esc(b.label)}</small></div>`;
  }).join('');
}
function renderCategoryBars(categories,total) {
  const root=$('#categoryBars');
  if (!categories.length) { root.innerHTML=empty('No category spending for this period.'); return; }
  root.innerHTML=categories.map(c=>{
    const pct=total?Math.max((Number(c.total)/total)*100,1):0;
    return `<div><div class="cat-bar-head"><span class="cat-bar-label">${svgIcon(c.icon, 'inline-svg-icon')}<span>${esc(c.name)}</span></span><strong>${rm(c.total)}</strong></div><div class="cat-bar-track"><div class="cat-bar-fill" style="--cat:${esc(c.color)};width:${pct}%"></div></div></div>`;
  }).join('');
}
function pointsForSeries(series,max,w=720,h=230,pad=14) {
  const available = series.map((v,i)=>v===null?null:{x:pad + (series.length<=1?0:i/(series.length-1))*(w-pad*2), y:h-pad-(Number(v)/max)*(h-pad*2)}).filter(Boolean);
  return available.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}
function renderTrajectory(t) {
  const svg=$('#trajectoryChart');
  const vals=[...(t.current||[]),...(t.typical||[])].filter(v=>v!==null).map(Number);
  const max=Math.max(...vals,1)*1.08;
  const currentPts=pointsForSeries(t.current||[],max); const typicalPts=pointsForSeries(t.typical||[],max);
  let grids=''; for(let i=0;i<5;i++){const y=18+i*50;grids+=`<line class="chart-grid" x1="12" y1="${y}" x2="708" y2="${y}"/>`;}
  svg.innerHTML=`${grids}${typicalPts?`<polyline class="line-typical" points="${typicalPts}"/>`:''}${currentPts?`<polyline class="line-current" points="${currentPts}"/>`:''}`;
  $('#trajectoryMeta').textContent = t.samples ? `Compared with ${t.samples} previous month${t.samples===1?'':'s'}` : 'No previous month data yet';
  $('#projectionText').textContent = t.projected ? `≈ ${rm(t.projected)}` : '';
}

async function loadPayments() {
  try {
    const [up,rec,plan] = await Promise.all([api('/api/upcoming?days=30'),api('/api/recurring'),api('/api/planned')]);
    state.recurring=rec; state.planned=plan;
    $('#upcomingTotal').textContent=rm(up.total);
    renderUpcoming(up.items); renderRecurring(rec); renderPlanned(plan);
  } catch(e) { toast(e.message,true); }
}
function renderUpcoming(items) {
  const root=$('#upcomingList');
  if(!items.length){root.innerHTML=empty('No payments expected in the next 30 days.');return;}
  root.innerHTML=items.map(item=>{
    const [status,cls]=statusForDate(item.due_date);
    return `<div class="list-row">${iconBox(item)}<div class="row-main"><strong>${esc(item.name)}</strong><span>${esc(item.category_name)} · <span class="status-pill ${cls}">${status}</span></span></div><div class="row-amount">${rm(item.amount)}</div><button class="row-action pay" data-pay-kind="${item.kind}" data-pay-id="${item.id}" data-pay-name="${esc(item.name)}" data-pay-amount="${item.amount}">Paid</button></div>`;
  }).join('');
  $$('[data-pay-kind]',root).forEach(b=>b.onclick=()=>openPay(b.dataset.payKind,Number(b.dataset.payId),b.dataset.payName,Number(b.dataset.payAmount)));
}
function renderRecurring(items) {
  const root=$('#recurringList'); const active=items.filter(i=>i.active);
  if(!active.length){root.innerHTML=empty('No recurring payments yet.');return;}
  root.innerHTML=active.map(item=>`<div class="list-row">${iconBox(item)}<div class="row-main"><strong>${esc(item.name)}</strong><span>${esc(item.category_name)} · every ${item.frequency.replace('ly','')}</span></div><div><div class="row-amount">${rm(item.amount)}</div><span class="muted">${shortDate(item.next_due)}</span></div><button class="row-action" data-stop-rec="${item.id}">Stop</button></div>`).join('');
  $$('[data-stop-rec]',root).forEach(b=>b.onclick=async()=>{if(!confirm('Stop this recurring payment? Existing transactions stay untouched.'))return;try{await api(`/api/recurring/${b.dataset.stopRec}`,{method:'DELETE'});toast('Recurring payment stopped.');loadPayments();}catch(e){toast(e.message,true)}});
}
function renderPlanned(items) {
  const root=$('#plannedList'); const active=items.filter(i=>i.status==='upcoming');
  if(!active.length){root.innerHTML=empty('No planned one-off payments yet.');return;}
  root.innerHTML=active.map(item=>`<div class="list-row">${iconBox(item)}<div class="row-main"><strong>${esc(item.name)}</strong><span>${esc(item.category_name)} · ${fullDate(item.due_date)}</span></div><div class="row-amount">${rm(item.estimated_amount)}</div><button class="row-action" data-cancel-plan="${item.id}">Cancel</button></div>`).join('');
  $$('[data-cancel-plan]',root).forEach(b=>b.onclick=async()=>{if(!confirm('Cancel this planned payment?'))return;try{await api(`/api/planned/${b.dataset.cancelPlan}`,{method:'DELETE'});toast('Planned payment cancelled.');loadPayments();}catch(e){toast(e.message,true)}});
}
function openPay(kind,id,name,amount) {
  $('#payKind').value=kind; $('#payId').value=id; $('#payTitle').textContent=`Mark ${name} paid`; $('#payAmount').value=Number(amount).toFixed(2); $('#payDate').value=todayISO(); $('#payNote').value=name;
  $('#payModal').showModal();
}

function resetCategoryForm() {
  $('#categoryEditId').value = "";
  $('#categoryModalTitle').textContent = "New category";
  $('#categorySubmitBtn').textContent = "Create category";
  $('#categoryName').value = "";
  $('#categoryIcon').value = "utensils";
  $('#categoryColor').value = "#54a0ff";
  renderIconPicker();
  renderColorPicker();
}

function openCategoryEditor(category) {
  $('#categoryEditId').value = category.id;
  $('#categoryModalTitle').textContent = "Edit category";
  $('#categorySubmitBtn').textContent = "Save changes";
  $('#categoryName').value = category.name || "";
  $('#categoryIcon').value = category.icon || "utensils";
  $('#categoryColor').value = category.color || "#54a0ff";
  renderIconPicker();
  renderColorPicker();
  $('#categoryModal').showModal();
}

function renderCategorySettings() {
  const root=$('#categorySettings');
  if(!state.categories.length){root.innerHTML=empty('No categories yet.');return;}
  root.innerHTML=state.categories.map(c=>`<div class="list-row category-settings-row" style="opacity:${c.archived?.62:1}">${iconBox(c)}<div class="row-main"><strong>${esc(c.name)}</strong><span>${c.archived?'Archived':'Active'}</span></div><div class="row-actions"><button class="row-action" data-edit-cat="${c.id}">Edit</button>${c.archived?`<button class="row-action" data-restore-cat="${c.id}">Restore</button>`:`<button class="row-action" data-archive-cat="${c.id}">Archive</button>`}</div></div>`).join('');
  $$('[data-edit-cat]',root).forEach(b=>b.onclick=()=>{const c=state.categories.find(x=>x.id===Number(b.dataset.editCat));if(c)openCategoryEditor(c);});
  $$('[data-archive-cat]',root).forEach(b=>b.onclick=async()=>{try{const r=await api(`/api/categories/${b.dataset.archiveCat}`,{method:'DELETE'});toast(r.action==='archived'?'Category archived. History preserved.':'Unused category deleted.');await loadBootstrap();renderCategorySettings();}catch(e){toast(e.message,true)}});
  $$('[data-restore-cat]',root).forEach(b=>b.onclick=async()=>{const c=state.categories.find(x=>x.id===Number(b.dataset.restoreCat));try{await api(`/api/categories/${c.id}`,{method:'PUT',body:JSON.stringify({archived:false})});toast('Category restored.');await loadBootstrap();renderCategorySettings();}catch(e){toast(e.message,true)}});
}

function renderIconPicker() {
  const root = $('#categoryIconPicker');
  const hidden = $('#categoryIcon');
  if (!root || !hidden) return;
  root.innerHTML = ICON_OPTIONS.map(([name, label]) => `
    <button type="button" class="icon-choice ${hidden.value === name ? 'selected' : ''}"
      data-category-icon="${name}" role="radio" aria-checked="${hidden.value === name ? 'true' : 'false'}"
      aria-label="${esc(label)}" title="${esc(label)}">
      ${svgIcon(name)}
    </button>`).join('');
  $$('[data-category-icon]', root).forEach(btn => {
    btn.onclick = () => {
      hidden.value = btn.dataset.categoryIcon;
      renderIconPicker();
    };
  });
}

function renderColorPicker() {
  const root = $('#categoryColorPresets');
  const input = $('#categoryColor');
  if (!root || !input) return;
  root.innerHTML = COLOR_PRESETS.map(color => `
    <button type="button" class="color-choice ${input.value.toLowerCase() === color.toLowerCase() ? 'selected' : ''}"
      data-category-color="${color}" role="radio"
      aria-checked="${input.value.toLowerCase() === color.toLowerCase() ? 'true' : 'false'}"
      aria-label="Use color ${color}" style="--choice-color:${color}"></button>`).join('');
  $$('[data-category-color]', root).forEach(btn => {
    btn.onclick = () => {
      input.value = btn.dataset.categoryColor;
      renderColorPicker();
    };
  });
}

async function saveCategory(e) {
  e.preventDefault();
  const editId = Number($('#categoryEditId').value || 0);
  const payload = {
    name: $('#categoryName').value.trim(),
    color: $('#categoryColor').value,
    icon: $('#categoryIcon').value
  };
  if (!payload.name) return toast('Enter a category name.', true);
  try {
    if (editId) {
      // Update the existing category record in place. Transactions keep their
      // category_id, so historical rows resolve to the new name/icon/color.
      await api(`/api/categories/${editId}`,{method:'PUT',body:JSON.stringify(payload)});
    } else {
      await api('/api/categories',{method:'POST',body:JSON.stringify(payload)});
    }
    $('#categoryModal').close();
    resetCategoryForm();
    toast(editId ? 'Category updated. History follows this category.' : 'Category created.');
    await loadBootstrap();
    renderCategorySettings();
    const activeTab = $('.bottom-nav button.active')?.dataset.tab;
    if (activeTab === 'history') await loadHistory();
    if (activeTab === 'planned') await loadPayments();
    if (activeTab === 'trends') await loadTrends();
  } catch(err){toast(err.message,true)}
}
async function createRecurring(e) {
  e.preventDefault();
  try {
    await api('/api/recurring',{method:'POST',body:JSON.stringify({name:$('#recurringName').value,amount:$('#recurringAmount').value,category_id:$('#recurringCategory').value,frequency:$('#recurringFrequency').value,next_due:$('#recurringDue').value,start_date:$('#recurringDue').value})});
    $('#recurringModal').close(); e.target.reset(); $('#recurringDue').value=todayISO(); toast('Recurring payment added.'); loadPayments();
  }catch(err){toast(err.message,true)}
}
async function createPlanned(e) {
  e.preventDefault();
  try {
    await api('/api/planned',{method:'POST',body:JSON.stringify({name:$('#plannedName').value,estimated_amount:$('#plannedAmount').value,category_id:$('#plannedCategory').value,due_date:$('#plannedDue').value})});
    $('#plannedModal').close(); e.target.reset(); $('#plannedDue').value=todayISO(); toast('Planned payment added.'); loadPayments();
  }catch(err){toast(err.message,true)}
}
async function payItem(e) {
  e.preventDefault(); const kind=$('#payKind').value,id=$('#payId').value;
  try {
    await api(`/api/${kind}/${id}/pay`,{method:'POST',body:JSON.stringify({amount:$('#payAmount').value,paid_on:$('#payDate').value,note:$('#payNote').value})});
    $('#payModal').close(); toast('Payment logged as spending.'); await Promise.all([loadPayments(),loadBootstrap()]);
  }catch(err){toast(err.message,true)}
}
async function saveEditTx(e) {
  e.preventDefault(); const id=$('#editTxId').value;
  try{
    await api(`/api/transactions/${id}`,{method:'PUT',body:JSON.stringify({amount:$('#editTxAmount').value,spent_on:$('#editTxDate').value,category_id:$('#editTxCategory').value,note:$('#editTxNote').value})});
    $('#editTxModal').close();toast('Transaction updated.');await Promise.all([loadHistory(),loadBootstrap()]);
  }catch(err){toast(err.message,true)}
}
async function deleteEditTx(){
  const id=$('#editTxId').value;if(!confirm('Delete this transaction?'))return;
  try{await api(`/api/transactions/${id}`,{method:'DELETE'});$('#editTxModal').close();toast('Transaction deleted.');await Promise.all([loadHistory(),loadBootstrap()]);}catch(err){toast(err.message,true)}
}

function wireUI() {
  setupGreeting();
  $$('.bottom-nav button').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  $('#addTransactionBtn').onclick=addTransaction;
  $('#quickAmount').addEventListener('keydown',e=>{if(e.key==='Enter')addTransaction()});
  $('#noteToggle').onclick=()=>{const n=$('#quickNote');n.classList.toggle('hidden');$('#noteToggle').textContent=n.classList.contains('hidden')?'+ Add note':'− Hide note';if(!n.classList.contains('hidden'))n.focus();};
  $('#refreshBtn').onclick=async()=>{try{await loadBootstrap();const active=$('.bottom-nav button.active')?.dataset.tab;if(active==='trends')await loadTrends();if(active==='planned')await loadPayments();if(active==='history')await loadHistory();toast('Refreshed.');}catch(e){toast(e.message,true)}};
  $$('[data-modal]').forEach(b=>b.onclick=()=>{if(b.dataset.modal==='categoryModal')resetCategoryForm();$('#'+b.dataset.modal).showModal();});
  $$('[data-close-dialog]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('#categoryForm').addEventListener('submit',saveCategory); $('#recurringForm').addEventListener('submit',createRecurring); $('#plannedForm').addEventListener('submit',createPlanned); $('#payForm').addEventListener('submit',payItem); $('#editTxForm').addEventListener('submit',saveEditTx); $('#deleteTxBtn').onclick=deleteEditTx;
  $$('#trendPeriod button').forEach(b=>b.onclick=()=>{state.trendPeriod=b.dataset.period;$$('#trendPeriod button').forEach(x=>x.classList.toggle('active',x===b));loadTrends();});
  $('#trendAnchor').onchange=loadTrends; $('#historyApply').onclick=loadHistory;
  wireStaticIcons();
  renderIconPicker();
  renderColorPicker();
  $('#categoryColor').addEventListener('input', renderColorPicker);
}

document.addEventListener('DOMContentLoaded', async()=>{
  wireUI();
  try { await loadBootstrap(); } catch(e) { toast(e.message,true); }
  if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});}
});
