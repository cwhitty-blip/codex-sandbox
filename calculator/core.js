(()=>{
const $=s=>document.querySelector(s);
const calc=$('#calc'),disp=$('#disp'),home=$('#home'),app=$('#app'),second=$('#second'),deep=$('#deep'),toastEl=$('#toast');
if(!calc||!disp||!home||!app)return;
let expr='';
const projects=[
 {id:'ninja',name:'Ninja',icon:'🥷',cls:'ninja'},
 {id:'ninjay',name:'Ninja Y',icon:'Y',cls:'ninjay'},
 {id:'x',name:'X',icon:'X',cls:'xapp'},
 {id:'mowing',name:"Malachi's Mowing",icon:'MM',cls:'mowing',url:'https://malachis-mowing-fort-scott.cwhit.chatgpt.site'},
 {id:'deepscope',name:'Deep Scope',icon:'◉',cls:'scope'}
];
const builtins=[
 {id:'photos',name:'Photos',icon:'🌈',cls:'photos'},
 {id:'notes',name:'Notes',icon:'📝',cls:'notes'},
 {id:'files',name:'Files',icon:'📁',cls:'files'},
 {id:'sketch',name:'Sketch',icon:'✎',cls:'sketch'},
 {id:'clock',name:'Clock',icon:'◷',cls:'clock'},
 {id:'game',name:'Tic-Tac-Toe',icon:'✕',cls:'game'},
 {id:'browser',name:'Browser',icon:'🧭',cls:'browser'},
 {id:'store',name:'App Store',icon:'A',cls:'store'},
 {id:'second',name:'Second Space',icon:'◉',cls:'space'},
 {id:'settings',name:'Settings',icon:'⚙',cls:'settings'}
];
const dockIds=['browser','notes','store','settings'];
function isAppMode(){return window.__calculatorStandalone===true||matchMedia('(display-mode: standalone)').matches||navigator.standalone===true||new URL(location.href).searchParams.get('app')==='1'}
function secret(){return localStorage.getItem('main-code')||'5963'}
function show(el){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));el.classList.add('active')}
function toast(t){if(!toastEl)return;toastEl.textContent=t;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),1100)}
function lock(){expr='';disp.textContent='0';document.getElementById('calcCallOverlay')?.remove();show(calc)}
function unlock(){if(!isAppMode()||expr!==secret())return false;expr='';disp.textContent='0';home.style.display='';home.removeAttribute('aria-hidden');show(home);window.dispatchEvent(new CustomEvent('calculator-private-home'));return true}
function evaluate(){try{let s=expr.replace(/−/g,'-').replace(/×/g,'*').replace(/÷/g,'/').replace(/%/g,'/100');if(!/^[0-9+\-*/.() ]+$/.test(s))throw 0;let n=Function('"use strict";return ('+s+')')();if(!Number.isFinite(n))throw 0;expr=String(Math.round(n*1e10)/1e10);disp.textContent=expr}catch{expr='';disp.textContent='Error'}}
calc.addEventListener('click',e=>{
 const b=e.target.closest('.key');if(!b)return;
 if(b.dataset.a==='clear'){expr='';disp.textContent='0';return}
 if((b.dataset.a==='eq'||b.dataset.v==='+')&&unlock()){e.preventDefault();return}
 if(b.dataset.a==='eq'){evaluate();return}
 const v=b.dataset.v;
 if(v==='+/-'){if(expr&&/^-?\d*\.?\d+$/.test(expr.replace(/−/g,'-')))expr=expr.startsWith('−')?expr.slice(1):'−'+expr}
 else if(expr.length<30)expr+=v;
 disp.textContent=expr||'0';
});
function icon(d,fn){const b=document.createElement('button');b.className='phone-app';b.type='button';b.innerHTML=`<span class="phone-icon ${d.cls}">${d.icon}</span><span class="phone-label"></span>`;b.querySelector('.phone-label').textContent=d.name;b.onclick=fn;return b}
function openItem(d){if(projects.some(p=>p.id===d.id))return openProject(d);if(d.id==='notes')return notes();if(d.id==='photos')return photos();if(d.id==='files')return files();if(d.id==='sketch')return sketch();if(d.id==='clock')return clock();if(d.id==='game')return game();if(d.id==='browser')return browser();if(d.id==='store')return store();if(d.id==='second')return secondSpace();if(d.id==='settings')return settings()}
function statusTime(){const e=$('#phoneTime');if(e)e.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).replace(' ','')}
function renderPhone(){
 const pages=$('#phonePages'),dots=$('#pageDots'),dock=$('#phoneDock');if(!pages||!dots||!dock)return;
 pages.innerHTML='';dots.innerHTML='';dock.innerHTML='';
 const all=[...projects,...builtins.filter(x=>!dockIds.includes(x.id))],per=12,groups=[];
 for(let i=0;i<all.length;i+=per)groups.push(all.slice(i,i+per));if(groups.length<2)groups.push([]);
 groups.forEach((group,idx)=>{const page=document.createElement('div');page.className='phone-page';const grid=document.createElement('div');grid.className='phone-grid';group.forEach(d=>grid.append(icon(d,()=>openItem(d))));page.append(grid);pages.append(page);const dot=document.createElement('span');dot.className='page-dot'+(idx===0?' active':'');dots.append(dot)});
 dockIds.forEach(id=>{const d=builtins.find(x=>x.id===id);dock.append(icon(d,()=>openItem(d)))});
 pages.scrollLeft=0;statusTime();clearInterval(renderPhone.timer);renderPhone.timer=setInterval(statusTime,30000);
 pages.onscroll=()=>{const i=Math.round(pages.scrollLeft/pages.clientWidth);[...dots.children].forEach((d,n)=>d.classList.toggle('active',n===i))};
 window.dispatchEvent(new CustomEvent('calculator-home-rendered'));
}
function shell(title,back=()=>show(home)){app.innerHTML='';const p=document.createElement('div');p.className='page';const h=document.createElement('div');h.className='head';const b=document.createElement('button');b.className='back';b.textContent='‹ Home';b.onclick=back;const t=document.createElement('h2');t.textContent=title;h.append(b,t);p.append(h);app.append(p);show(app);return p}
function notes(){const p=shell('Notes'),ta=document.createElement('textarea');ta.className='note';ta.placeholder='Write something…';ta.value=localStorage.getItem('note')||'';ta.oninput=()=>localStorage.setItem('note',ta.value);p.append(ta)}
function getPics(){try{return JSON.parse(localStorage.getItem('pics')||'[]')}catch{return[]}}
function photos(){const p=shell('Photos'),tools=document.createElement('div');tools.className='tools';const lab=document.createElement('label');lab.textContent='Add Photos';const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.multiple=true;inp.hidden=true;lab.append(inp);tools.append(lab);const grid=document.createElement('div');grid.className='pics';const draw=()=>{grid.innerHTML='';getPics().forEach(src=>{const im=document.createElement('img');im.src=src;grid.append(im)})};inp.onchange=async()=>{let a=getPics();for(const f of inp.files){if(a.length>=12)break;const src=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)});a.unshift(src)}try{localStorage.setItem('pics',JSON.stringify(a));draw()}catch{toast('Photo storage full')}};p.append(tools,grid);draw()}
function files(){const p=shell('Files'),c=document.createElement('div');c.className='card';c.innerHTML='<strong>Private Files</strong><div class="muted">Choose files to remember here.</div>';const i=document.createElement('input');i.type='file';i.multiple=true;i.style.marginTop='12px';c.append(i);const l=document.createElement('div');l.className='card';const get=()=>{try{return JSON.parse(localStorage.getItem('filenames')||'[]')}catch{return[]}};const draw=()=>{const a=get();l.innerHTML='';if(!a.length){l.textContent='No files yet.';return}a.forEach(x=>{const row=document.createElement('div');row.style.padding='8px 0';row.textContent='📄 '+x;l.append(row)})};i.onchange=()=>{let a=get();[...i.files].forEach(f=>a.unshift(f.name));localStorage.setItem('filenames',JSON.stringify(a.slice(0,30)));draw()};p.append(c,l);draw()}
function sketch(){const p=shell('Sketch'),w=document.createElement('div');w.className='canvaswrap',c=document.createElement('canvas');w.append(c);p.append(w);const x=c.getContext('2d');let down=false,last;requestAnimationFrame(()=>{const r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=r.width*d;c.height=r.height*d;x.scale(d,d);x.lineWidth=4;x.lineCap='round';x.strokeStyle='#111'});const pt=e=>{const r=c.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};c.onpointerdown=e=>{down=true;last=pt(e)};c.onpointermove=e=>{if(!down)return;const q=pt(e);x.beginPath();x.moveTo(last.x,last.y);x.lineTo(q.x,q.y);x.stroke();last=q};c.onpointerup=c.onpointercancel=()=>down=false}
function browser(){const p=shell('Browser'),bar=document.createElement('div');bar.className='url';const i=document.createElement('input');i.placeholder='Search or enter website';const b=document.createElement('button');b.className='go';b.textContent='Go';const nav=()=>{let v=i.value.trim();if(!v)return;if(!/^https?:\/\//i.test(v))v=v.includes('.')&&!v.includes(' ')?'https://'+v:'https://www.google.com/search?q='+encodeURIComponent(v);location.href=v};b.onclick=nav;i.onkeydown=e=>{if(e.key==='Enter')nav()};bar.append(i,b);p.append(bar)}
function clock(){const p=shell('Clock'),f=document.createElement('div');f.className='clockface',d=document.createElement('div');d.className='clockdate';p.append(f,d);const tick=()=>{const x=new Date();f.textContent=x.toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'});d.textContent=x.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'})};tick();const timer=setInterval(tick,1000);app.addEventListener('DOMNodeRemoved',()=>clearInterval(timer),{once:true})}
function game(){const p=shell('Tic-Tac-Toe'),board=document.createElement('div');board.className='ttt',s=document.createElement('div');s.className='status';let a=Array(9).fill(''),turn='X',done=false;const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];function draw(){board.innerHTML='';a.forEach((v,i)=>{const b=document.createElement('button');b.textContent=v;b.onclick=()=>{if(done||a[i])return;a[i]=turn;if(wins.some(w=>w.every(j=>a[j]===turn))){done=true;s.textContent=turn+' wins!'}else if(a.every(Boolean)){done=true;s.textContent='Draw'}else{turn=turn==='X'?'O':'X';s.textContent=turn+"'s turn"}draw()};board.append(b)})}s.textContent="X's turn";draw();p.append(board,s)}
function store(){const p=shell('Private App Store');[...projects,...builtins].forEach(d=>{const c=document.createElement('div');c.className='card row';const i=document.createElement('div');i.className=`phone-icon ${d.cls}`;i.textContent=d.icon;const g=document.createElement('div');g.className='grow';const strong=document.createElement('strong');strong.textContent=d.name;const small=document.createElement('small');small.textContent=projects.some(x=>x.id===d.id)?'Your project':'Private mini-app';g.append(strong,small);const b=document.createElement('button');b.className='get';b.textContent='OPEN';b.onclick=()=>openItem(d);c.append(i,g,b);p.append(c)})}
function secondSpace(){second.innerHTML='';const w=document.createElement('div');w.className='phone-shell secondbg';w.innerHTML='<div class="phone-status"><span>Second Space</span><button id="sBack" class="status-lock">Back</button></div><div class="phone-grid second-grid"></div>';w.querySelector('#sBack').onclick=()=>show(home);const g=w.querySelector('.second-grid');g.append(icon({name:'Deep Space',icon:'◆',cls:'deep'},deepSpace));g.append(icon({name:'Notes',icon:'📝',cls:'notes'},()=>layerNote(2)));g.append(icon({name:'Files',icon:'📁',cls:'files'},files));second.append(w);show(second)}
function deepSpace(){deep.innerHTML='';const w=document.createElement('div');w.className='phone-shell deepbg';w.innerHTML='<div class="phone-status"><span>Deep Space</span><button id="dBack" class="status-lock">Back</button></div><div class="phone-grid deep-grid"></div>';w.querySelector('#dBack').onclick=secondSpace;const g=w.querySelector('.deep-grid');g.append(icon({name:'Notes',icon:'📝',cls:'notes'},()=>layerNote(3)));g.append(icon({name:'Files',icon:'📁',cls:'files'},files));deep.append(w);show(deep)}
function layerNote(n){const el=n===2?second:deep;el.innerHTML='';const p=document.createElement('div');p.className='page';const ta=document.createElement('textarea');ta.className='note';ta.value=localStorage.getItem('note'+n)||'';ta.oninput=()=>localStorage.setItem('note'+n,ta.value);p.append(ta);el.append(p);show(el)}
function projectUrl(p){return p.url||localStorage.getItem('project-url-'+p.id)||''}
function openProject(p){const u=projectUrl(p);if(u){location.href=u;return}const page=shell(p.name),c=document.createElement('div');c.className='card';const title=document.createElement('div');title.className='project-title';title.textContent=p.name;const muted=document.createElement('div');muted.className='muted';muted.textContent='Connect the original published link once. It stays saved on this phone.';const i=document.createElement('input');i.className='field';i.placeholder='Paste existing app link';i.style.cssText='width:100%;margin:14px 0';const b=document.createElement('button');b.className='primary';b.textContent='Connect Existing App';b.onclick=()=>{const v=i.value.trim();if(!/^https?:\/\//i.test(v))return toast('Paste the full link');localStorage.setItem('project-url-'+p.id,v);toast('Connected')};c.append(title,muted,i,b);page.append(c)}
function settings(){const p=shell('Settings'),c=document.createElement('div');c.className='card';const strong=document.createElement('strong');strong.textContent='Calculator Secret Code';const i=document.createElement('input');i.className='field';i.value=secret();i.inputMode='numeric';i.style.cssText='width:100%;margin:10px 0';const b=document.createElement('button');b.className='primary';b.textContent='Save Code';b.onclick=()=>{if(!/^\d{4,10}$/.test(i.value))return toast('Use 4–10 digits');localStorage.setItem('main-code',i.value);toast('Saved')};c.append(strong,i,b);p.append(c)}
renderPhone();
document.addEventListener('visibilitychange',()=>{if(document.hidden)lock()});window.addEventListener('pagehide',lock);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
window.CalculatorCore={show,home,app,renderPhone,toast,lock};
})();