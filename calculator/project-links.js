(()=>{
const PROJECTS=[
{id:'ninja',name:'Ninja'},
{id:'ninjay',name:'Ninja Y'},
{id:'x',name:'X'},
{id:'mowing',name:"Malachi's Mowing",fixed:'https://malachis-mowing-fort-scott.cwhit.chatgpt.site'},
{id:'brainrot',name:'Brainrot Movie Maker',fixed:'https://brainrot-movie-maker.cwhit.chatgpt.site'},
{id:'deepscope',name:'Deep Scope'}
];
if(!localStorage.getItem('ninjay-link-reset-v1')){localStorage.removeItem('project-url-ninjay');localStorage.setItem('ninjay-link-reset-v1','1')}
const app=document.getElementById('app');if(!app)return;
function toast(m){const t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1200)}
function enhanceSettings(){const h=app.querySelector('.head h2');if(!h||h.textContent!=='Settings'||app.querySelector('.project-link-settings'))return;const page=app.querySelector('.page');if(!page)return;const wrap=document.createElement('div');wrap.className='project-link-settings';const intro=document.createElement('div');intro.className='card';intro.innerHTML='<strong>Project Links</strong><div class="muted">Change the link for any existing app here.</div>';wrap.append(intro);PROJECTS.forEach(p=>{const c=document.createElement('div');c.className='card';const label=document.createElement('strong');label.textContent=p.name;const input=document.createElement('input');input.className='field';input.style.cssText='width:100%;margin-top:9px';input.placeholder='https://…';input.value=p.fixed||localStorage.getItem('project-url-'+p.id)||'';if(p.fixed){input.readOnly=true;input.style.opacity='.7'}const save=document.createElement('button');save.className='primary';save.style.marginTop='9px';save.textContent=p.fixed?'Connected':'Save Link';save.disabled=!!p.fixed;if(p.fixed)save.style.opacity='.55';save.onclick=()=>{const v=input.value.trim();if(!/^https?:\/\//i.test(v))return toast('Paste the full link');localStorage.setItem('project-url-'+p.id,v);toast(p.name+' link saved')};c.append(label,input,save);wrap.append(c)});page.append(wrap)}
new MutationObserver(enhanceSettings).observe(app,{childList:true,subtree:true});enhanceSettings();
})();