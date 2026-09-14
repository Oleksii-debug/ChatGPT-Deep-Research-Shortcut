(() => {
  const api = globalThis.ChatGPTToolPicker, rt = globalThis.AccessibleToolsRuntime;
  if (!api || !rt) return;
  const PICKER_ID='accessible-tools-dialog', TOOL_ORDER=['image','web','research'], OPEN_DEDUPE_MS=350;
  let focusBeforePicker=null, lastOpen=0;

  function toolButtons(d){ return [...d.querySelectorAll('[data-accessible-tool-id]')]; }
  function focusables(d){ return [...d.querySelectorAll('[data-accessible-tool-id],[data-diagnostics-download]')]; }
  function closePicker({restoreFocus=true}={}) {
    const d=document.getElementById(PICKER_ID); if(!d)return; d.remove();
    if(restoreFocus){ const t=focusBeforePicker instanceof HTMLElement&&document.contains(focusBeforePicker)?focusBeforePicker:rt.findComposer(); t?.focus({preventScroll:true}); }
  }
  function move(d,n){ const b=toolButtons(d); if(!b.length)return; const i=Math.max(0,b.indexOf(document.activeElement)); b[(i+n+b.length)%b.length].focus(); }
  function trapTab(d,e){ const f=focusables(d); if(!f.length)return; const i=f.indexOf(document.activeElement); if(e.shiftKey&&i<=0){e.preventDefault();f.at(-1).focus();}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();} }
  function styleButton(b){ Object.assign(b.style,{display:'block',width:'100%',textAlign:'left',padding:'12px 14px',border:'1px solid ButtonText',borderRadius:'8px',background:'ButtonFace',color:'ButtonText',font:'inherit',cursor:'pointer'}); }

  function createPicker(){
    const old=document.getElementById(PICKER_ID); if(old)return old;
    focusBeforePicker=document.activeElement instanceof HTMLElement?document.activeElement:rt.findComposer();
    const d=document.createElement('div'); d.id=PICKER_ID; d.setAttribute(rt.OWNED_ATTR,'true'); d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true'); d.setAttribute('aria-labelledby',`${PICKER_ID}-title`); d.setAttribute('aria-describedby',`${PICKER_ID}-description`);
    Object.assign(d.style,{position:'fixed',inset:'0',zIndex:'2147483647',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.55)',padding:'16px',boxSizing:'border-box'});
    const p=document.createElement('div'); Object.assign(p.style,{width:'min(560px,calc(100vw - 32px))',maxHeight:'min(90vh,calc(100dvh - 32px))',overflow:'auto',background:'Canvas',color:'CanvasText',border:'2px solid ButtonText',borderRadius:'12px',padding:'20px',boxSizing:'border-box'});
    const h=document.createElement('h2'); h.id=`${PICKER_ID}-title`; h.textContent='Доступні інструменти';
    const desc=document.createElement('p'); desc.id=`${PICKER_ID}-description`; desc.textContent='Стрілки вгору і вниз — вибір. Enter — запустити. Tab — діагностика. Escape — закрити.';
    const list=document.createElement('div'); list.setAttribute('role','group'); list.setAttribute('aria-label','Доступні інструменти'); Object.assign(list.style,{display:'grid',gap:'10px'});
    for(const id of TOOL_ORDER){ const tool=api.getTool(id), b=document.createElement('button'); b.type='button'; b.dataset.accessibleToolId=id; b.setAttribute('aria-label',`${tool.label}. ${tool.description}`); styleButton(b); const strong=document.createElement('strong'); strong.textContent=tool.label; strong.style.display='block'; const detail=document.createElement('span'); detail.textContent=tool.description; detail.style.display='block'; b.append(strong,detail); b.addEventListener('click',()=>{closePicker({restoreFocus:false});void rt.activateTool(id);}); list.appendChild(b); }
    const diag=document.createElement('button'); diag.type='button'; diag.dataset.diagnosticsDownload='true'; diag.setAttribute('aria-label','Завантажити діагностичний звіт. Посекундна хронологія останньої спроби без тексту вашого запиту або чату.'); diag.textContent='Завантажити діагностичний звіт'; styleButton(diag); diag.style.marginTop='16px'; diag.addEventListener('click',rt.downloadDiagnostics);
    p.append(h,desc,list,diag); d.appendChild(p);
    d.addEventListener('keydown',(event)=>{ if(event.key==='Escape'){event.preventDefault();closePicker();rt.announce('Вибір інструмента закрито.',false);return;} if(event.key==='ArrowDown'){event.preventDefault();move(d,1);return;} if(event.key==='ArrowUp'){event.preventDefault();move(d,-1);return;} if(event.key==='Home'){event.preventDefault();toolButtons(d)[0]?.focus();return;} if(event.key==='End'){event.preventDefault();toolButtons(d).at(-1)?.focus();return;} if(event.key==='Tab')trapTab(d,event); });
    d.addEventListener('mousedown',(e)=>{if(e.target===d)closePicker();}); document.body.appendChild(d); return d;
  }
  function openPicker(source='unknown'){
    const old=document.getElementById(PICKER_ID); if(old){(old.querySelector('[data-accessible-tool-id]:focus,[data-diagnostics-download]:focus')||toolButtons(old)[0])?.focus({preventScroll:true});return;}
    const now=Date.now(); if(now-lastOpen<OPEN_DEDUPE_MS)return; lastOpen=now; const d=createPicker(); const firstButton=toolButtons(d)[0]; setTimeout(()=>firstButton?.focus({preventScroll:true}),0); rt.announce('Оберіть інструмент: Створити зображення, Пошук в Інтернеті або Глибоке дослідження. Tab після інструментів — завантажити діагностику.',false);
  }
  document.addEventListener('keydown',(event)=>{ if(api.isPickerShortcutEvent(event)){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();openPicker('page-keydown');return;} if(api.isDiagnosticsShortcutEvent?.(event)){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();rt.downloadDiagnostics();} },true);
  chrome.runtime.onMessage.addListener((m)=>{if(m?.type==='OPEN_TOOL_PICKER')openPicker('chrome-command');});
  globalThis.AccessibleToolsPicker=Object.freeze({openPicker,closePicker});
})();
