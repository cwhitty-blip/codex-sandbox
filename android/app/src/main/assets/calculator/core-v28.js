(()=>{
const $=s=>document.querySelector(s),calc=$('#calc'),disp=$('#disp'),home=$('#home'),app=$('#app'),toastEl=$('#toast');
if(!calc||!disp||!home||!app)return;
let expr='',quickUnlock='';
const projects=[
{id:'ava',name:'Ava',icon:'✦',cls:'ava',url:'https://chatgpt.com/'},
{id:'ninja',name:'Ninja',icon:'🥷',cls:'ninja',url:'https://ninja-y-game.cwhit.chatgpt.site/'},
{id:'ninjay',name:'Ninja Y',icon:'Y',cls:'ninjay',url:'https://ninja-y-game.cwhit.chatgpt.site/'},
{id:'x',name:'X',icon:'X',cls:'xapp'},
{id:'mowing',name:"Malachi's Mowing",icon:'MM',cls:'mowing',url:'https://malachis-mowing-fort-scott.cwhit.chatgpt.site/'},
{id:'brainrot',name:'Brainrot Movie Maker',icon:'🎬',cls:'brainrot',url:'https://brainrot-movie-maker.cwhit.chatgpt.site/'},
{id:'deepscope',name:'Deep Scope',icon:'◉',cls:'scope',url:'https://deepscope-research.cwhit.chatgpt.site/'}];
const builtins=[
{id:'photos',name:'Photos',icon:'🌈',cls:'photos'},{id:'notes',name:'Notes',icon:'📝',cls:'notes'},{id:'files',name:'Files',icon:'📁',cls:'files'},{id:'sketch',name:'Sketch',icon:'✎',cls:'sketch'},{id:'clock',name:'Clock',icon:'◷',cls:'clock'},{id:'game',name:'Tic-Tac-Toe',icon:'✕',cls:'game'},{id:'bible',name:'Bible',icon:'✝',cls:'pro-bible'},{id:'browser',name:'Browser',icon:'🧭',cls:'browser'},{id:'store',name:'App Store',icon:'A',cls:'store'},{id:'second',name:'Second Space',icon:'◉',cls:'space'},{id:'settings',name:'Settings',icon:'⚙',cls:'settings'}];
const dockIds=['browser','notes','store','settings'];
function show(el){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));el.classList.add('active')}
function toast(t){if(!toastEl)return;toastEl.textContent=t;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),1100)}
function lock(){expr='';quickUnlock='';disp.textContent='0';document.getElementById('calcCallOverlay')?.remove();show(calc)}
function enterPrivateHome(){expr='';quickUnlock='';disp.textContent='0';show(home);window.dispatchEvent(new CustomEvent('calculator-private-home'))}
function unlock(){if(expr!==(localStorage.getItem('main-code')||'5963'))return false;enterPrivateHome();return true}
function evaluate(){try{const s=expr.replace(/−/g,'-').replace(/×/g,'*').replace(/÷/g,'/').replace(/%/g,'/100');if(!/^[0-9+\-*/.() ]+$/.test(s))throw 0;const n=Function('"use strict";return ('+s+')')();if(!Number.isFinite(n))throw 0;expr=String(Math.round(n*1e10)/1e10);disp.textContent=expr}catch{expr='';disp.textContent='Error'}}
function pressKey(button){
 if(!button)return;
 if(button.dataset.a==='clear'){expr='';quickUnlock='';disp.textContent='0';return}
 if((button.dataset.a==='eq'||button.dataset.v==='+')&&unlock())return;
 if(button.dataset.a==='eq'){evaluate();return}
 const value=button.dataset.v;
 quickUnlock=(quickUnlock+value).slice(-3);
 if(quickUnlock==='÷×6'){enterPrivateHome();return}
 if(value==='+/-'){if(expr)expr=expr.startsWith('−')?expr.slice(1):'−'+expr}
 else if(expr.length<30)expr+=value;
 disp.textContent=expr||'0';
}
// Bind directly to each calculator key. Touch devices receive pointerup first;
// the following synthetic click is ignored so a touch can never enter twice.
let lastPointerButton=null,lastPointerTime=0;
calc.querySelectorAll('.key').forEach(button=>{
 button.addEventListener('pointerup',()=>{lastPointerButton=button;lastPointerTime=Date.now();pressKey(button)});
 button.addEventListener('click',()=>{if(lastPointerButton===button&&Date.now()-lastPointerTime<750)return;pressKey(button)});
});
function icon(d,fn){const b=document.createElement('button');b.className='phone-app';b.type='button';b.innerHTML=`<span class="phone-icon ${d.cls}">${d.icon}</span><span class="phone-label"></span>`;b.querySelector('.phone-label').textContent=d.name;b.onclick=fn;return b}
function shell(title){app.innerHTML='';const p=document.createElement('div');p.className='page';const h=document.createElement('div');h.className='head';const b=document.createElement('button');b.className='back';b.textContent='‹ Home';b.onclick=()=>show(home);const t=document.createElement('h2');t.textContent=title;h.append(b,t);p.append(h);app.append(p);show(app);return p}
function project(d){const u=d.url||window.CalculatorProjectLinks?.[d.id]||localStorage.getItem('project-url-'+d.id);const p=shell(d.name);if(!u){const c=document.createElement('div');c.className='card';c.textContent='This app has not been connected yet.';p.append(c);return}p.classList.add('project-web-app');const tools=document.createElement('div');tools.className='project-web-tools';const status=document.createElement('span');status.textContent='Opening app…';const external=document.createElement('a');external.href=u;external.target='_blank';external.rel='noopener noreferrer';external.textContent='Open separately';tools.append(status,external);const frame=document.createElement('iframe');frame.className='project-web-frame';frame.title=d.name;frame.src=u;frame.setAttribute('allow','camera; microphone; clipboard-read; clipboard-write; fullscreen');frame.onload=()=>status.textContent=d.name;p.append(tools,frame)}
function notes(){const p=shell('Notes'),ta=document.createElement('textarea');ta.className='note';ta.value=localStorage.getItem('note')||'';ta.placeholder='Write something…';ta.oninput=()=>localStorage.setItem('note',ta.value);p.append(ta)}
function clock(){const p=shell('Clock'),f=document.createElement('div');f.className='clockface';p.append(f);const tick=()=>f.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'});tick();setInterval(tick,1000)}
function browser(){const p=shell('Browser'),bar=document.createElement('div');bar.className='url';const i=document.createElement('input');i.placeholder='Search or enter website';const b=document.createElement('button');b.className='go';b.textContent='Go';const go=()=>{let v=i.value.trim();if(!v)return;if(!/^https?:\/\//i.test(v))v=v.includes('.')&&!v.includes(' ')?'https://'+v:'https://www.google.com/search?q='+encodeURIComponent(v);location.href=v};b.onclick=go;i.onkeydown=e=>{if(e.key==='Enter')go()};bar.append(i,b);p.append(bar)}
function settings(){const p=shell('Settings'),c=document.createElement('div');c.className='card';c.innerHTML='<strong>Calculator</strong><div class="muted">Your project apps and phone features are connected here.</div>';p.append(c)}
function simple(name){const p=shell(name),c=document.createElement('div');c.className='card';c.textContent=name;p.append(c)}
function open(d){if(projects.some(x=>x.id===d.id))return project(d);if(d.id==='bible')return window.CalculatorBible?.open();if(d.id==='notes')return notes();if(d.id==='clock')return clock();if(d.id==='browser')return browser();if(d.id==='settings')return settings();return simple(d.name)}
function renderPhone(){const pages=$('#phonePages'),dots=$('#pageDots'),dock=$('#phoneDock');if(!pages||!dots||!dock)return;pages.innerHTML='';dots.innerHTML='';dock.innerHTML='';const all=builtins.filter(x=>!dockIds.includes(x.id)),groups=[];for(let i=0;i<all.length;i+=12)groups.push(all.slice(i,i+12));if(groups.length<2)groups.push([]);groups.forEach((g,n)=>{const page=document.createElement('div');page.className='phone-page';const grid=document.createElement('div');grid.className='phone-grid';g.forEach(d=>grid.append(icon(d,()=>open(d))));page.append(grid);pages.append(page);const dot=document.createElement('span');dot.className='page-dot'+(n===0?' active':'');dots.append(dot)});dockIds.forEach(id=>{const d=builtins.find(x=>x.id===id);dock.append(icon(d,()=>open(d)))});window.dispatchEvent(new CustomEvent('calculator-home-rendered'))}
function time(){const e=$('#phoneTime');if(e)e.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).replace(' ','')}
renderPhone();time();setInterval(time,30000);window.CalculatorCore={show,home,app,renderPhone,toast,lock,openProject:project};
})();
