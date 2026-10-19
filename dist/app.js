import {inkLength} from './features.js';
import {ParticleArtwork} from './particles.js';

const $=id=>document.getElementById(id);
const canvas=$('drawing'), context=canvas.getContext('2d');
const state={strokes:[],activePointer:null,revision:0,lastSubmitted:-1,busy:false,ready:false,metadata:null,worker:null,engine:null,confirmed:null,sample:null};
const SIDE=600; // Store points in a stable logical square, independent of screen/DPR.
let toastTimeout,loadGeneration=0;
const particles=new ParticleArtwork($('particles'),text=>{$('particle-status').textContent=text;});
function stopParticles() {
  particles.stop();$('canvas-stage').classList.remove('particle-mode');
  $('particle-status').hidden=true;$('particle-actions').hidden=true;
}
function playParticles() {
  cancelPointer();
  if(particles.play(state.strokes)) {
    $('canvas-stage').classList.add('particle-mode');
    $('particle-status').hidden=false;$('particle-actions').hidden=false;
  }
}
$('particle-replay').addEventListener('click',playParticles);
$('particle-return').addEventListener('click',()=>{
  stopParticles();state.confirmed=null;
  $('confirmation').hidden=true;state.lastSubmitted=-1;
});

function notify(text) {
  $('toast').textContent=text;$('toast').hidden=false;
  clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').hidden=true,3200);
}

function fitCanvas() {
  const rectangle=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,3);
  canvas.width=Math.round(rectangle.width*dpr);canvas.height=Math.round(rectangle.height*dpr);
  particles.resize(canvas.width,canvas.height);
  renderDrawing();
}

function renderDrawing(target=context,dimensions=null) {
  const width=dimensions?.width??canvas.width,height=dimensions?.height??canvas.height;
  target.clearRect(0,0,width,height);
  const scale=Math.min(width,height)/SIDE;
  const ox=(width-SIDE*scale)/2,oy=(height-SIDE*scale)/2;
  target.strokeStyle='#30283e';target.fillStyle='#30283e';
  target.lineWidth=4.2*scale;target.lineCap='round';target.lineJoin='round';
  for(const stroke of state.strokes) {
    if(!stroke.length) continue;
    if(stroke.length===1) {target.beginPath();target.arc(ox+stroke[0][0]*scale,oy+stroke[0][1]*scale,2.1*scale,0,Math.PI*2);target.fill();continue;}
    target.beginPath();target.moveTo(ox+stroke[0][0]*scale,oy+stroke[0][1]*scale);
    for(let i=1;i<stroke.length;i++) target.lineTo(ox+stroke[i][0]*scale,oy+stroke[i][1]*scale);
    target.stroke();
  }
}

function logicalPoint(event) {
  const r=canvas.getBoundingClientRect(),scale=Math.min(r.width,r.height)/SIDE;
  return [(event.clientX-r.left-(r.width-SIDE*scale)/2)/scale,(event.clientY-r.top-(r.height-SIDE*scale)/2)/scale];
}

function updateButtons() {
  const hasInk=state.strokes.length>0;
  $('undo').disabled=!hasInk;$('clear').disabled=!hasInk;$('save').disabled=!hasInk;
  $('canvas-hint').hidden=hasInk;$('stroke-count').textContent=`${state.strokes.length} 笔`;
  $('sample-label').hidden=!state.sample;
  if(state.sample) $('sample-label').textContent=`测试集示例 · ${state.sample}`;
}

function resetGuesses() {
  state.confirmed=null;
  $('confirmation').hidden=true;$('predictions').hidden=true;$('predictions').replaceChildren();
  $('prediction-empty').hidden=false;
  $('prediction-empty').querySelector('p').textContent=state.strokes.length?'再添几条线吧':'等待你的第一笔';
  $('guess-title').innerHTML='我在看，<br>你尽管画。';
  $('guess-description').innerHTML='画出几条线，我就开始猜。<br>不用画得完美，有你的风格就好。';
  $('moli-face').classList.remove('thinking','happy');
}

function changed({reset=false}={}) {
  stopParticles();
  state.revision++;
  state.confirmed=null;$('confirmation').hidden=true;
  $('moli-face').classList.remove('happy');
  for(const row of $('predictions').children) row.classList.remove('selected');
  if(reset||inkLength(state.strokes)<12) resetGuesses();
  updateButtons();renderDrawing();
}

canvas.addEventListener('pointerdown',event=>{
  if((event.pointerType==='mouse'&&event.button!==0)||state.activePointer!==null) return;
  if(state.strokes.length>=120) {notify('这幅画已经很丰富了，保存后再开一张吧');return;}
  event.preventDefault();state.activePointer=event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  state.strokes.push([logicalPoint(event)]);state.sample=null;
  changed();
});

canvas.addEventListener('pointermove',event=>{
  if(event.pointerId!==state.activePointer) return;
  const stroke=state.strokes.at(-1);
  if(!stroke) return;
  if(state.strokes.reduce((n,s)=>n+s.length,0)>=6000) {endStroke(event);notify('画作已达到笔画容量，可以保存或清空重画');return;}
  const point=logicalPoint(event),last=stroke.at(-1);
  if(Math.hypot(point[0]-last[0],point[1]-last[1])<1.4) return;
  stroke.push(point);changed();
});

function endStroke(event) {
  if(event.pointerId!==state.activePointer) return;
  state.activePointer=null;
  if(canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}
canvas.addEventListener('pointerup',endStroke);
canvas.addEventListener('pointercancel',endStroke);
canvas.addEventListener('lostpointercapture',event=>{if(state.activePointer===event.pointerId) state.activePointer=null;});

function cancelPointer() {
  if(state.activePointer!==null&&canvas.hasPointerCapture(state.activePointer)) canvas.releasePointerCapture(state.activePointer);
  state.activePointer=null;
}
function undo() {if(!state.strokes.length)return;cancelPointer();state.strokes.pop();state.sample=null;changed({reset:true});}
$('undo').addEventListener('click',undo);
$('clear').addEventListener('click',()=>{cancelPointer();state.strokes=[];state.sample=null;changed({reset:true});});
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!event.shiftKey&&!document.querySelector('dialog[open]')&&!/INPUT|TEXTAREA/.test(event.target.tagName)) {event.preventDefault();undo();}
});

function confirmGuess(index,revision) {
  if(revision!==state.revision) {notify('你刚添了几笔，等我更新一下猜测');return;}
  const category=state.metadata.classes[index];
  state.confirmed=index;
  $('guess-title').textContent=`原来是${category.name}！`;
  $('guess-description').textContent='猜对啦。你的每一笔，都有自己的风格。';
  $('confirmation').textContent='猜对了！你的笔画正在变成星尘。可以保存粒子作品，或返回继续画。';
  $('confirmation').hidden=false;$('moli-face').classList.add('happy');
  for(const row of $('predictions').children) row.classList.toggle('selected',Number(row.dataset.index)===index);
  playParticles();
}

function displayPrediction(scores,id) {
  if(id!==state.revision||!state.strokes.length||state.confirmed!==null) return;
  const ranking=scores.map((score,index)=>({score,index})).sort((a,b)=>b.score-a.score).slice(0,3);
  $('prediction-empty').hidden=true;$('predictions').hidden=false;
  const uncertain=ranking[0].score<.45||ranking[0].score-ranking[1].score<.1;
  $('guess-title').textContent=uncertain?'让我再想想…':`我猜是${state.metadata.classes[ranking[0].index].name}。`;
  $('guess-description').textContent=uncertain?'再添几笔，也许就更清楚了。':'这是我目前的猜测。猜对了，就点一下勾。';
  $('moli-face').classList.toggle('thinking',uncertain);
  const fragment=document.createDocumentFragment();
  ranking.forEach(({score,index},rank)=>{
    const category=state.metadata.classes[index];
    const row=document.createElement('div');row.className='guess-row';row.dataset.index=index;
    // Category names are packaged model labels, never arbitrary HTML.
    const main=document.createElement('div');main.className='guess-row-main';
    const number=document.createElement('span');number.className='guess-rank';number.textContent=`0${rank+1}`;
    const name=document.createElement('span');name.className='guess-name';name.textContent=category.name;
    const value=document.createElement('span');value.className='guess-score';value.textContent=`${(score*100).toFixed(1)}%`;
    const confirm=document.createElement('button');confirm.className='confirm-guess';confirm.setAttribute('aria-label',`确认猜对了：${category.name}`);confirm.title=`就是${category.name}`;
    confirm.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>';
    confirm.addEventListener('click',()=>confirmGuess(index,id));
    main.append(number,name,value,confirm);
    const meter=document.createElement('div');meter.className='guess-meter';meter.setAttribute('aria-hidden','true');
    const fill=document.createElement('span');fill.style.width=`${score*100}%`;meter.append(fill);
    row.append(main,meter);fragment.append(row);
  });
  $('predictions').replaceChildren(fragment);
}

async function predict() {
  if(!state.ready||state.busy||state.revision===state.lastSubmitted||state.confirmed!==null) return;
  if(inkLength(state.strokes)<12) return;
  const id=state.revision;
  state.lastSubmitted=id;state.busy=true;
  const strokes=state.strokes.map(s=>s.map(p=>[...p]));
  if(state.engine==='browser') {state.worker.postMessage({type:'predict',id,strokes});return;}
  try {
    const response=await fetch('./api/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strokes}),signal:AbortSignal.timeout(5000)});
    const result=await response.json();
    if(!response.ok) throw new Error(result.error||'识别暂时失败');
    displayPrediction(result.scores,id);
  } catch(error) {
    if(id===state.revision) {
      $('guess-title').textContent='连接暂时中断';
      $('guess-description').textContent='请检查本地服务，或点下面的按钮重新连接。';
      $('predictions').hidden=true;$('retry').hidden=false;
      $('engine-status').textContent='连接中断';$('live-badge').className='live-badge error';
      $('ready-dot').classList.remove('ready');$('runtime-note').textContent='本地服务连接中断，画作仍保留在画板中';
      state.ready=false;
    }
  } finally {state.busy=false;}
}
setInterval(predict,500);

function modelReady(metadata,engine) {
  state.metadata=metadata;state.engine=engine;state.ready=true;state.lastSubmitted=-1;
  $('engine-status').textContent='实时识别';$('live-badge').className='live-badge ready';
  $('ready-dot').classList.add('ready');$('retry').hidden=true;
  const mode=engine==='python'?'Python 本地后端':'浏览器本地模型';
  $('runtime-note').textContent=`${mode}已就绪 · 画作不上传第三方`;
  $('about-engine').textContent=mode;
  $('test-accuracy').textContent=`${(metadata.test_accuracy*100).toFixed(1)}% · ${metadata.test_count.toLocaleString()} 张图`;
  const chips=document.createDocumentFragment(),options=document.createDocumentFragment();
  for(const category of metadata.classes) {
    const chip=document.createElement('div');chip.className='category-chip';
    const emoji=document.createElement('span');emoji.textContent=category.icon;emoji.setAttribute('aria-hidden','true');
    chip.append(emoji,document.createTextNode(category.name));chips.append(chip);
    const option=document.createElement('option');option.value=category.id;option.textContent=category.name;options.append(option);
  }
  $('category-list').replaceChildren(chips);$('sample-select').replaceChildren(options);
}

function modelError(message) {
  state.ready=false;state.busy=false;
  $('engine-status').textContent='加载失败';$('live-badge').className='live-badge error';
  $('ready-dot').classList.remove('ready');$('runtime-note').textContent='模型暂不可用，画板仍可使用';
  $('guess-title').textContent='稍等，我还没准备好';$('guess-description').textContent=message;
  $('retry').hidden=false;
}

async function initializeModel() {
  const generation=++loadGeneration;
  state.ready=false;state.busy=false;
  state.worker?.terminate();state.worker=null;
  $('retry').hidden=true;$('engine-status').textContent='准备中';
  try {
    // Static hosting has no Python API, so use the identical model in a Worker.
    const response=await fetch('./api/health',{signal:AbortSignal.timeout(1500)});
    if(response.ok&&response.headers.get('content-type')?.includes('application/json')) {
      const health=await response.json();
      if(generation!==loadGeneration)return;
      if(health.ready&&health.engine==='python') {modelReady(health.metadata,'python');resetGuesses();return;}
    }
  } catch { /* Browser inference is the supported standalone mode. */ }
  if(generation!==loadGeneration)return;
  try {
    const worker=new Worker(new URL('./predict-worker.js',import.meta.url),{type:'module'});
    state.worker=worker;
    const timer=setTimeout(()=>{if(!state.ready&&generation===loadGeneration){worker.terminate();modelError('模型加载超时，请检查网络后重试。');}},15000);
    worker.onmessage=({data})=>{
      if(generation!==loadGeneration)return;
      if(data.type==='ready'){clearTimeout(timer);modelReady(data.metadata,'browser');resetGuesses();}
      if(data.type==='prediction'){state.busy=false;displayPrediction(data.scores,data.id);}
      if(data.type==='error'){clearTimeout(timer);modelError(data.message);}
    };
    worker.onerror=()=>{clearTimeout(timer);modelError('模型启动失败，请通过启动脚本打开页面，或检查模型文件。');};
    worker.postMessage({type:'load'});
  } catch(error){modelError(error.message);}
}
$('retry').addEventListener('click',initializeModel);

$('save').addEventListener('click',()=>{
  const out=document.createElement('canvas');out.width=1200;
  const pictureHeight=Math.round(1200*canvas.height/canvas.width);
  out.height=pictureHeight+65;
  const drawing=out.getContext('2d');renderDrawing(drawing,{width:1200,height:pictureHeight});
  if(particles.active){drawing.clearRect(0,0,out.width,out.height);drawing.drawImage($('particles'),0,0,1200,pictureHeight);}
  drawing.globalCompositeOperation='destination-over';drawing.fillStyle=particles.active?'#191526':'#fff';drawing.fillRect(0,0,out.width,out.height);
  drawing.globalCompositeOperation='source-over';drawing.fillStyle='#a297ac';drawing.font='18px sans-serif';
  drawing.fillText(`墨粒 · ${identity.name} ${identity.id}`,35,out.height-25);
  out.toBlob(blob=>{
    if(!blob){notify('保存失败，请稍后重试');return;}
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`墨粒作品-${Date.now()}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
    notify('作品已保存为 PNG');
  });
});

for(const [button,dialog] of [['categories-button','categories-dialog'],['identity-button','identity-dialog'],['about-button','about-dialog']]) {
  $(button).addEventListener('click',()=>$(dialog).showModal());
}
for(const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();});
}

$('load-sample').addEventListener('click',async()=>{
  if(!state.ready){notify('模型还在准备，请稍后再试');return;}
  try {
    const response=await fetch('./assets/examples.json');if(!response.ok)throw new Error('示例加载失败');
    const examples=await response.json(),example=examples.find(item=>item.category===$('sample-select').value);
    if(!example)throw new Error('没有找到这个类别的示例');
    const points=example.strokes.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(...xs)-minX,h=Math.max(...ys)-minY;
    const scale=360/Math.max(w,h,1),ox=(SIDE-w*scale)/2,oy=(SIDE-h*scale)/2;
    cancelPointer();state.strokes=example.strokes.map(s=>s.map(([x,y])=>[(x-minX)*scale+ox,(y-minY)*scale+oy]));
    state.sample=example.name;changed({reset:true});$('categories-dialog').close();
  }catch(error){notify(error.message);}
});

let identity={name:'倪悦雅',id:'202421114060'};
try {const saved=JSON.parse(localStorage.getItem('moli.identity'));if(saved&&typeof saved.name==='string'&&typeof saved.id==='string')identity={name:saved.name.slice(0,30),id:saved.id.slice(0,30)};}catch{}
function showIdentity() {
  const small=document.createElement('small');small.textContent=identity.id;
  $('identity-text').replaceChildren(document.createTextNode(identity.name+' '),small);
  document.querySelector('.avatar').textContent=identity.name.slice(0,1);
  $('student-name').value=identity.name;$('student-id').value=identity.id;
}
$('identity-form').addEventListener('submit',event=>{
  event.preventDefault();
  const name=$('student-name').value.trim(),id=$('student-id').value.trim();
  if(!name||!id){notify('请填写姓名和学号');return;}
  identity={name,id};showIdentity();
  try{localStorage.setItem('moli.identity',JSON.stringify(identity));}catch{}
  $('identity-dialog').close();notify('署名已更新');
});
showIdentity();
new ResizeObserver(fitCanvas).observe($('canvas-stage'));
updateButtons();initializeModel();
