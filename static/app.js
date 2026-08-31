const state = {
  categories: [],
  selectedCategory: null,
  trendPeriod: 'month',
  trendAnchor: new Date().toISOString().slice(0, 10),
  history: [],
  recurring: [],
  planned: [],
};

const ICONS = {
  utensils: '⌁', basket: '▦', car: '◇', fuel: '◫', house: '⌂', receipt: '≣', heart: '♡',
  sparkles: '✦', tag: '◇', coffee: '◉', phone: '▯', shopping: '▱', plane: '✈', gift: '□',
  book: '▤', tools: '⌘', paw: '◌', game: '⌁', train: '⇥', bike: '◇', medical: '+',
  subscription: '↻', education: 'A', family: '◎', other: '•'
};

const ICON_OPTIONS = [
  ['utensils','Food'], ['basket','Groceries'], ['coffee','Coffee'], ['car','Car'], ['fuel','Petrol'],
  ['train','Transit'], ['house','Home'], ['receipt','Bills'], ['phone','Mobile'], ['shopping','Shopping'],
  ['heart','Health'], ['game','Fun'], ['plane','Travel'], ['gift','Gifts'], ['book','Education'],
  ['tools','Maintenance'], ['paw','Pets'], ['subscription','Subscription'], ['family','Family'], ['tag','Other']
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
function glyph(name) { return ICONS[name] || ICONS.tag; }
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
  return `<div class="row-icon" style="--cat:${esc(item.color || '#54a0ff')}">${esc(glyph(item.icon))}</div>`;
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
      <span class="cat-icon">${esc(glyph(c.icon))}</span><span>${esc(c.name)}</span>
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
    return `<div><div class="cat-bar-head"><span>${esc(glyph(c.icon))} ${esc(c.name)}</span><strong>${rm(c.total)}</strong></div><div class="cat-bar-track"><div class="cat-bar-fill" style="--cat:${esc(c.color)};width:${pct}%"></div></div></div>`;
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

function renderCategorySettings() {
  const root=$('#categorySettings');
  if(!state.categories.length){root.innerHTML=empty('No categories yet.');return;}
  root.innerHTML=state.categories.map(c=>`<div class="list-row" style="opacity:${c.archived?.62:1}">${iconBox(c)}<div class="row-main"><strong>${esc(c.name)}</strong><span>${c.archived?'Archived':'Active'}</span></div>${c.archived?`<button class="row-action" data-restore-cat="${c.id}">Restore</button>`:`<button class="row-action" data-archive-cat="${c.id}">Archive</button>`}</div>`).join('');
  $$('[data-archive-cat]',root).forEach(b=>b.onclick=async()=>{try{const r=await api(`/api/categories/${b.dataset.archiveCat}`,{method:'DELETE'});toast(r.action==='archived'?'Category archived. History preserved.':'Unused category deleted.');await loadBootstrap();renderCategorySettings();}catch(e){toast(e.message,true)}});
  $$('[data-restore-cat]',root).forEach(b=>b.onclick=async()=>{const c=state.categories.find(x=>x.id===Number(b.dataset.restoreCat));try{await api(`/api/categories/${c.id}`,{method:'PUT',body:JSON.stringify({archived:false})});toast('Category restored.');await loadBootstrap();renderCategorySettings();}catch(e){toast(e.message,true)}});
}

async function createCategory(e) {
  e.preventDefault();
  try {
    await api('/api/categories',{method:'POST',body:JSON.stringify({name:$('#categoryName').value,color:$('#categoryColor').value,icon:$('#categoryIcon').value})});
    $('#categoryModal').close(); $('#categoryName').value=''; toast('Category created.'); await loadBootstrap(); renderCategorySettings();
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
  $$('[data-modal]').forEach(b=>b.onclick=()=>$('#'+b.dataset.modal).showModal());
  $$('[data-close-dialog]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('#categoryForm').addEventListener('submit',createCategory); $('#recurringForm').addEventListener('submit',createRecurring); $('#plannedForm').addEventListener('submit',createPlanned); $('#payForm').addEventListener('submit',payItem); $('#editTxForm').addEventListener('submit',saveEditTx); $('#deleteTxBtn').onclick=deleteEditTx;
  $$('#trendPeriod button').forEach(b=>b.onclick=()=>{state.trendPeriod=b.dataset.period;$$('#trendPeriod button').forEach(x=>x.classList.toggle('active',x===b));loadTrends();});
  $('#trendAnchor').onchange=loadTrends; $('#historyApply').onclick=loadHistory;
  const iconSelect=$('#categoryIcon'); iconSelect.innerHTML=ICON_OPTIONS.map(([v,l])=>`<option value="${v}">${glyph(v)} ${l}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', async()=>{
  wireUI();
  try { await loadBootstrap(); } catch(e) { toast(e.message,true); }
  if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});}
});
