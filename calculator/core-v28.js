(()=>{
const $=s=>document.querySelector(s),calc=$('#calc'),disp=$('#disp'),home=$('#home'),app=$('#app'),toastEl=$('#toast');
if(!calc||!disp||!home||!app)return;
let expr='',quickUnlock='',justEvaluated=false;
const projects=[
{id:'ava',name:'Ava',icon:'✦',cls:'ava',url:'https://chatgpt.com/'},
{id:'ninja',name:'Ninja',icon:'🥷',cls:'ninja',url:'https://ninja-y-game.cwhit.chatgpt.site/'},
{id:'ninjay',name:'Ninja Y',icon:'Y',cls:'ninjay',url:'https://ninja-y-game.cwhit.chatgpt.site/'},
{id:'x',name:'X',icon:'X',cls:'xapp'},
{id:'mowing',name:"Malachi's Mowing",icon:'MM',cls:'mowing',url:'https://malachis-mowing-fort-scott.cwhit.chatgpt.site/'},
{id:'brainrot',name:'Brainrot Movie Maker',icon:'🎬',cls:'brainrot',url:'https://brainrot-movie-maker.cwhit.chatgpt.site/'},
{id:'deepscope',name:'Deep Scope',icon:'◉',cls:'scope',url:'https://deepscope-research.cwhit.chatgpt.site/'}];
const builtins=[
{id:'photos',name:'Photos',icon:'<span class="photos-mark">●</span>',cls:'photos'},
{id:'notes',name:'Notes',icon:'<span class="notes-mark"><b>Notes</b><i></i><i></i><i></i></span>',cls:'notes'},
{id:'files',name:'Files',icon:'<span class="files-mark"></span>',cls:'files'},
{id:'sketch',name:'Sketch',icon:'<span class="sketch-mark">✎</span>',cls:'sketch'},
{id:'clock',name:'Clock',icon:'<span class="clock-mark"><b class="n12">12</b><b class="n3">3</b><b class="n6">6</b><b class="n9">9</b><i class="hour-hand"></i><i class="minute-hand"></i><em></em></span>',cls:'clock'},
{id:'game',name:'Tic-Tac-Toe',icon:'<span class="game-mark">X O<br>O X</span>',cls:'game'},
{id:'bible',name:'Bible',icon:'BIBLE',cls:'pro-bible'},
{id:'browser',name:'Browser',icon:'<span class="browser-mark"><b></b><i></i></span>',cls:'browser'},
{id:'store',name:'App Store',icon:'<span class="store-mark">A</span>',cls:'store'},
{id:'second',name:'Second Space',icon:'<span class="space-mark"><b></b><i></i></span>',cls:'space'},
{id:'settings',name:'Settings',icon:'<span class="settings-mark">⚙</span>',cls:'settings'}];
const dockIds=['browser','notes','store','settings'];
function show(el){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));el.classList.add('active')}
function toast(t){if(!toastEl)return;toastEl.textContent=t;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),1100)}
function lock(){expr='';quickUnlock='';justEvaluated=false;disp.textContent='0';document.getElementById('calcCallOverlay')?.remove();show(calc)}
function enterPrivateHome(){expr='';quickUnlock='';justEvaluated=false;disp.textContent='0';show(home);window.dispatchEvent(new CustomEvent('calculator-private-home'))}
function unlock(){if(expr!==(localStorage.getItem('main-code')||'5963'))return false;enterPrivateHome();return true}
function cleanNumber(n){if(!Number.isFinite(n))throw 0;const rounded=Math.abs(n)<1e-12?0:Number.parseFloat(n.toPrecision(12));return Math.abs(rounded)>=1e12?rounded.toExponential(7):String(rounded)}
function currentNumberRange(){let start=expr.length;while(start>0&&/[0-9.]/.test(expr[start-1]))start--;return{start,value:expr.slice(start)}}
function percent(){const part=currentNumberRange();if(!part.value)return;const amount=Number(part.value);if(!Number.isFinite(amount))return;let replacement=amount/100;const op=expr[part.start-1];if(op==='+'||op==='−'){const left=expr.slice(0,part.start-1).replace(/−/g,'-').replace(/×/g,'*').replace(/÷/g,'/');if(/^[0-9+\-*/.() ]+$/.test(left)){try{const base=Function('"use strict";return ('+left+')')();if(Number.isFinite(base))replacement=base*amount/100}catch{}}}expr=expr.slice(0,part.start)+cleanNumber(replacement);disp.textContent=expr}
function evaluate(){try{const ready=expr.replace(/[+−×÷.]$/,'');if(!ready)throw 0;const s=ready.replace(/−/g,'-').replace(/×/g,'*').replace(/÷/g,'/');if(!/^[0-9+\-*/.() ]+$/.test(s))throw 0;const n=Function('"use strict";return ('+s+')')();expr=cleanNumber(n);disp.textContent=expr;justEvaluated=true}catch{expr='';justEvaluated=false;disp.textContent='Error'}}
function pressKey(button){
 if(!button)return;
 if(button.dataset.a==='clear'){expr='';quickUnlock='';justEvaluated=false;disp.textContent='0';return}
 if((button.dataset.a==='eq'||button.dataset.v==='+')&&unlock())return;
 if(button.dataset.a==='eq'){evaluate();return}
 const value=button.dataset.v;
 quickUnlock=(quickUnlock+value).slice(-3);
 if(quickUnlock==='÷×6'){enterPrivateHome();return}
 if(value==='%'){percent();justEvaluated=false;return}
 if(value==='+/-'){const part=currentNumberRange();if(part.value){const sign=expr[part.start-1]==='−'&&(part.start-1===0||/[+−×÷]/.test(expr[part.start-2]||''));expr=sign?expr.slice(0,part.start-1)+part.value:expr.slice(0,part.start)+'−'+part.value}}
 else if(/[+−×÷]/.test(value)){justEvaluated=false;if(!expr){if(value==='−')expr='−'}else if(/[+−×÷]$/.test(expr))expr=expr.slice(0,-1)+value;else expr+=value}
 else if(value==='.'){if(justEvaluated){expr='';justEvaluated=false}const part=currentNumberRange();if(!part.value.includes('.'))expr+=part.value?'0'.slice(0,0)+'.':'0.'}
 else {if(justEvaluated){expr='';justEvaluated=false}if(expr.length<30){const part=currentNumberRange();if(part.value==='0'&&value==='0'){}else if(part.value==='0')expr=expr.slice(0,-1)+value;else expr+=value}}
 disp.textContent=expr||'0';
}
// Bind directly to each calculator key. Touch devices receive pointerup first;
// the following synthetic click is ignored so a touch can never enter twice.
let lastPointerButton=null,lastPointerTime=0;
calc.querySelectorAll('.key').forEach(button=>{
 button.addEventListener('pointerup',()=>{lastPointerButton=button;lastPointerTime=Date.now();pressKey(button)});
 button.addEventListener('click',()=>{if(lastPointerButton===button&&Date.now()-lastPointerTime<750)return;pressKey(button)});
});
document.addEventListener('keydown',event=>{if(!calc.classList.contains('active'))return;const map={Enter:'=',Escape:'AC',Backspace:'back','*':'×','/':'÷','-':'−'};const value=map[event.key]||event.key;if(value==='back'){expr=expr.slice(0,-1);justEvaluated=false;disp.textContent=expr||'0';event.preventDefault();return}const button=[...calc.querySelectorAll('.key')].find(x=>x.textContent.trim()===value||x.dataset.v===value||(value==='='&&x.dataset.a==='eq')||(value==='AC'&&x.dataset.a==='clear'));if(button){pressKey(button);event.preventDefault()}});
function icon(d,fn){const b=document.createElement('button');b.className='phone-app';b.type='button';b.dataset.appId=d.id;b.innerHTML=`<span class="phone-icon ${d.cls}">${d.icon}</span><span class="phone-label"></span>`;b.querySelector('.phone-label').textContent=d.name;b.onclick=fn;return b}
function shell(title){app.innerHTML='';const p=document.createElement('div');p.className='page';const h=document.createElement('div');h.className='head';const b=document.createElement('button');b.className='back';b.textContent='‹ Home';b.onclick=()=>show(home);const t=document.createElement('h2');t.textContent=title;h.append(b,t);p.append(h);app.append(p);show(app);return p}
function project(d){const u=d.url||window.CalculatorProjectLinks?.[d.id]||localStorage.getItem('project-url-'+d.id);const p=shell(d.name);if(!u){const c=document.createElement('div');c.className='card';c.textContent='This app has not been connected yet.';p.append(c);return}p.classList.add('project-web-app');const tools=document.createElement('div');tools.className='project-web-tools';const status=document.createElement('span');status.textContent='Opening app…';const external=document.createElement('a');external.href=u;external.target='_blank';external.rel='noopener noreferrer';external.textContent='Open separately';tools.append(status,external);const frame=document.createElement('iframe');frame.className='project-web-frame';frame.title=d.name;frame.src=u;frame.setAttribute('allow','camera; microphone; clipboard-read; clipboard-write; fullscreen');frame.onload=()=>status.textContent=d.name;p.append(tools,frame)}
function notes(){const p=shell('Notes'),ta=document.createElement('textarea');ta.className='note';ta.value=localStorage.getItem('note')||'';ta.placeholder='Write something…';ta.oninput=()=>localStorage.setItem('note',ta.value);p.append(ta)}
function clock(){const p=shell('Clock'),f=document.createElement('div');f.className='clockface';p.append(f);const tick=()=>f.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'});tick();setInterval(tick,1000)}
function browser(){const p=shell('Browser');p.classList.add('calculator-browser-page');const intro=document.createElement('div');intro.className='browser-intro';intro.innerHTML='<strong>Calculator Browser</strong><span>Search without leaving Calculator. Recent results are saved for offline reading.</span>';const bar=document.createElement('div');bar.className='url browser-url';const i=document.createElement('input');i.placeholder='Search or enter a website';i.autocomplete='off';const b=document.createElement('button');b.className='go';b.textContent='Search';const view=document.createElement('div');view.className='browser-view';const KEY='calculator-browser-library-v1';function library(){try{return JSON.parse(localStorage.getItem(KEY)||'{"searches":{},"articles":{}}')}catch{return{searches:{},articles:{}}}}function save(data){try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}}function message(title,text){view.innerHTML='';const card=document.createElement('div');card.className='browser-message';const strong=document.createElement('strong');strong.textContent=title;const span=document.createElement('span');span.textContent=text;card.append(strong,span);view.append(card)}async function article(title,back){const data=library();let text=data.articles?.[title];message(title,text?'Opening saved copy…':'Loading article…');if(!text&&navigator.onLine){try{const url='https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&origin=*&titles='+encodeURIComponent(title);const json=await fetch(url).then(r=>{if(!r.ok)throw Error();return r.json()});text=Object.values(json.query?.pages||{})[0]?.extract||'';if(text){data.articles=data.articles||{};data.articles[title]=text;save(data)}}catch{}}view.innerHTML='';const card=document.createElement('article');card.className='browser-article';const backButton=document.createElement('button');backButton.className='browser-back';backButton.textContent='‹ Search results';backButton.onclick=back;const heading=document.createElement('h3');heading.textContent=title;const body=document.createElement('div');body.textContent=text||'This article is not saved yet. Connect to the internet once, then open it again to keep an offline copy.';card.append(backButton,heading,body);view.append(card)}function renderResults(query,items,saved=false){view.innerHTML='';const status=document.createElement('div');status.className='browser-status';status.textContent=saved?'Offline saved results for “'+query+'”':'Results for “'+query+'”';view.append(status);if(!items.length){message('No results','Try different words.');return}items.forEach(item=>{const row=document.createElement('button');row.className='browser-result';const title=document.createElement('strong');title.textContent=item.title;const snippet=document.createElement('span');snippet.textContent=item.snippet;row.append(title,snippet);row.onclick=()=>article(item.title,()=>renderResults(query,items,saved));view.append(row)})}async function search(query){const key=query.toLowerCase();const data=library(),saved=data.searches?.[key];if(!navigator.onLine){if(saved)return renderResults(query,saved,true);return message('You are offline','This search has not been downloaded yet. Reconnect once and search for it to save the results.')}message('Searching inside Calculator…','Results are kept here and the latest search is saved for offline use.');try{const url='https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrnamespace=0&gsrlimit=12&gsrsearch='+encodeURIComponent(query)+'&prop=extracts&exintro=1&explaintext=1&exsentences=2&format=json&origin=*';const json=await fetch(url).then(r=>{if(!r.ok)throw Error();return r.json()});const items=Object.values(json.query?.pages||{}).sort((a,z)=>(a.index||0)-(z.index||0)).map(x=>({title:x.title,snippet:x.extract||'Open to read this result.'}));data.searches=data.searches||{};data.searches[key]=items;const keys=Object.keys(data.searches);while(keys.length>15)delete data.searches[keys.shift()];save(data);renderResults(query,items)}catch{if(saved)renderResults(query,saved,true);else message('Search could not connect','Check your internet connection and try again.')}}function website(value){let url=value;if(!/^https?:\/\//i.test(url))url='https://'+url;view.innerHTML='';const status=document.createElement('div');status.className='browser-status';status.textContent='Opening inside Calculator. Some websites do not allow embedded viewing.';const frame=document.createElement('iframe');frame.className='calculator-browser-frame';frame.title='Calculator Browser website';frame.src=url;frame.setAttribute('sandbox','allow-forms allow-scripts allow-same-origin');view.append(status,frame)}const go=()=>{const value=i.value.trim();if(!value)return;if(value.includes('.')&&!value.includes(' '))website(value);else search(value)};b.onclick=go;i.onkeydown=e=>{if(e.key==='Enter')go()};bar.append(i,b);p.append(intro,bar,view);message('Search from Calculator','Enter a topic above. Searches use Wikipedia information—not Google—and saved results can be reopened offline.')}
function restoreDefaults(){
  const keys=['phone-app-order','calculator-installed-v36','phone-wallpaper-preset','phone-wallpaper-image'];
  keys.forEach((key)=>{localStorage.removeItem(key)});
  localStorage.removeItem('pics');
  window.CalculatorPersonalize?.apply?.();
  window.CalculatorProApps?.syncHome?.();
  renderPhone();
  toast('Everything restored to default');
}
function settings(){
 const p=shell('Settings'),c=document.createElement('div');
 c.className='card';
 c.innerHTML='<strong>Calculator</strong><div class="muted">Your project apps and phone features are connected here.</div>';
 const tools=document.createElement('div');
 tools.style.cssText='display:grid;gap:10px;margin-top:12px';
 const restore=document.createElement('button');
 restore.className='primary';
 restore.textContent='Restore Everything to Default';
 restore.onclick=()=>{
   if(!confirm('Reset home layout, installed apps, and wallpaper to the latest default set?')) return;
   restoreDefaults();
   c.textContent='Restoring defaults...';
   c.append(document.createElement('div')).className='muted';
   c.lastElementChild.textContent='All defaults are back.';
 };
 const open=document.createElement('button');
 open.className='reset';
 open.textContent='Open App Store';
 open.onclick=()=>open({id:'store',name:'App Store'});
 tools.append(restore,open);
 p.append(c,tools);
}
function simple(name){const p=shell(name),c=document.createElement('div');c.className='card';c.textContent=name;p.append(c)}
function open(d){if(projects.some(x=>x.id===d.id))return project(d);if(d.id==='bible')return window.CalculatorBible?.open();if(d.id==='notes')return notes();if(d.id==='clock')return clock();if(d.id==='browser')return browser();if(d.id==='settings')return settings();return simple(d.name)}
function renderPhone(){const pages=$('#phonePages'),dots=$('#pageDots'),dock=$('#phoneDock');if(!pages||!dots||!dock)return;pages.innerHTML='';dots.innerHTML='';dock.innerHTML='';const all=builtins.filter(x=>!dockIds.includes(x.id)),groups=[];for(let i=0;i<all.length;i+=12)groups.push(all.slice(i,i+12));if(groups.length<2)groups.push([]);groups.forEach((g,n)=>{const page=document.createElement('div');page.className='phone-page';const grid=document.createElement('div');grid.className='phone-grid';g.forEach(d=>grid.append(icon(d,()=>open(d))));page.append(grid);pages.append(page);const dot=document.createElement('span');dot.className='page-dot'+(n===0?' active':'');dots.append(dot)});dockIds.forEach(id=>{const d=builtins.find(x=>x.id===id);dock.append(icon(d,()=>open(d)))});window.dispatchEvent(new CustomEvent('calculator-home-rendered'))}
function time(){const now=new Date(),e=$('#phoneTime');if(e)e.textContent=now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).replace(' ','');const face=$('.clock-mark');if(face){face.style.setProperty('--hour-angle',(now.getHours()%12*30+now.getMinutes()*.5)+'deg');face.style.setProperty('--minute-angle',(now.getMinutes()*6)+'deg')}}
renderPhone();time();setInterval(time,30000);window.CalculatorCore={show,home,app,renderPhone,toast,lock,openProject:project};
})();
