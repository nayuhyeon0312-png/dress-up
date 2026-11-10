const $ = (id) => document.getElementById(id);
const stageEl = $("stage");
const stage = new Konva.Stage({container:"stage", width:920, height:620});
const layer = new Konva.Layer(); stage.add(layer);
const transformer = new Konva.Transformer({rotateEnabled:true, keepRatio:true, anchorSize:12, borderStroke:"#718166", anchorStroke:"#718166", anchorFill:"#fff", padding:5});
layer.add(transformer);
let selected = null, tool = "select", brushSize = 24, currentCategory = "상의";
let stickers = [], closetItems = [], baseNode = null, drawing = false, lastPoint = null;
let personImageUrl = null;

function setStatus(t){ $("status").textContent=t; }
function fitStage(){
  const w = Math.max(300, stageEl.clientWidth);
  const h = stageEl.clientHeight || 620;
  const scale = Math.min(w/920,h/620);
  stage.width(920*scale); stage.height(620*scale); stage.scale({x:scale,y:scale}); stage.draw();
}
new ResizeObserver(fitStage).observe(stageEl); fitStage();

function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image(); im.onload=()=>resolve(im); im.onerror=reject; im.src=src;});}
function fileData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
function makeMask(w,h){const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);return c;}
function composeSticker(item){
  const c=document.createElement("canvas");c.width=item.original.width;c.height=item.original.height;
  const x=c.getContext("2d");x.drawImage(item.original,0,0);x.globalCompositeOperation="destination-in";x.drawImage(item.mask,0,0);return c;
}
function selectNode(node){selected=node;transformer.nodes(node?[node]:[]);layer.draw();}
function addSticker(src,name,category,addToCloset=true){
  loadImage(src).then(im=>{
    const mask=makeMask(im.naturalWidth||im.width,im.naturalHeight||im.height);
    const item={src,name,category,original:im,mask};
    if(addToCloset){closetItems.push(item);renderCloset();}
    const node=new Konva.Image({image:composeSticker(item),x:300+Math.random()*100,y:100+Math.random()*100,draggable:true,name:"sticker",listening:true});
    const scale=Math.min(230/im.width,260/im.height,1);node.scale({x:scale,y:scale});
    node.setAttr("stickerItem",item);
    node.on("click tap",()=>selectNode(node));
    node.on("dragstart",()=>{if(tool!=="select")node.stopDrag();});
    node.on("dragend",()=>layer.draw());
    stickers.push(node);layer.add(node);selectNode(node);layer.draw();
    setStatus("스티커를 보드에 추가했어!");
  }).catch(()=>setStatus("이미지를 열지 못했어."));
}
function renderCloset(){
  const box=$("closet");box.innerHTML="";
  const filtered=closetItems.filter(x=>x.category===currentCategory);
  if(!filtered.length){box.innerHTML='<div class="empty">이 분류에는 아직 스티커가 없어.</div>';return;}
  filtered.forEach((item)=>{
    const idx=closetItems.indexOf(item);const d=document.createElement("div");d.className="closet-item";
    const im=document.createElement("img");im.src=item.src;
    const b=document.createElement("button");b.textContent="보드에 놓기";b.onclick=()=>addSticker(item.src,item.name,item.category,false);
    d.append(im,b);box.append(d);
  });
}
document.querySelectorAll(".category").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".category").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentCategory=b.dataset.category;renderCloset();}));
$("personInput").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;const src=await fileData(f);personImageUrl=src;addSticker(src,"나의 전신 사진","캐릭터",false);setStatus("전신 사진을 보드에 올렸어. 필요하면 자동 누끼를 해봐.");e.target.value="";});
$("faceInput").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;const src=await fileData(f);$("facePreview").innerHTML="";const im=document.createElement("img");im.src=src;$("facePreview").append(im);e.target.value="";});
$("clothesInput").addEventListener("change",async e=>{for(const f of [...e.target.files]){if(!f.type.startsWith("image/"))continue;const src=await fileData(f);addSticker(src,f.name,currentCategory,true);}e.target.value="";});

function setTool(t){tool=t;["selectTool","eraseTool","restoreTool"].forEach(id=>$(id).classList.remove("active"));({select:"selectTool",erase:"eraseTool",restore:"restoreTool"}[t]&&$(({select:"selectTool",erase:"eraseTool",restore:"restoreTool"}[t])).classList.add("active"));stage.container().style.cursor=t==="select"?"default":"crosshair";setStatus(t==="erase"?"지울 부분을 문질러 줘.":t==="restore"?"복구할 부분을 문질러 줘.":"선택 모드");}
$("selectTool").onclick=()=>setTool("select");$("eraseTool").onclick=()=>setTool("erase");$("restoreTool").onclick=()=>setTool("restore");
$("brushSize").oninput=e=>{brushSize=Number(e.target.value);$("brushValue").textContent=brushSize;};
function pointerToSticker(pos,node){const tr=node.getAbsoluteTransform().copy();tr.invert();return tr.point(pos);}
stage.on("pointerdown",e=>{
  if(tool==="select")return;
  const node=selected;if(!node)return;
  if(e.target!==node)return;
  drawing=true;lastPoint=pointerToSticker(stage.getPointerPosition(),node);node.draggable(false);
  brushAt(node,lastPoint,null);
});
stage.on("pointermove",e=>{
  if(!drawing||!selected)return;
  const p=pointerToSticker(stage.getPointerPosition(),selected);brushAt(selected,p,lastPoint);lastPoint=p;
});
stage.on("pointerup pointerleave",()=>{if(drawing&&selected)selected.draggable(true);drawing=false;lastPoint=null;layer.draw();});
function brushAt(node,p,from){
  const item=node.getAttr("stickerItem");if(!item)return;
  const ctx=item.mask.getContext("2d");ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=brushSize/(node.scaleX()||1);
  ctx.globalCompositeOperation=tool==="erase"?"destination-out":"source-over";ctx.strokeStyle=tool==="erase"?"rgba(0,0,0,1)":"rgba(255,255,255,1)";
  ctx.beginPath();if(from){ctx.moveTo(from.x,from.y);ctx.lineTo(p.x,p.y);}else{ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.1,p.y+.1);}ctx.stroke();ctx.restore();
  node.image(composeSticker(item));layer.batchDraw();
}
async function removeBackground(src){
  setStatus("자동 누끼 처리 중… 처음에는 AI 모델을 내려받느라 오래 걸릴 수 있어.");
  const mod=await import("https://esm.sh/@imgly/background-removal@1.5.5");
  const blob=await mod.removeBackground(src,{model:"small",output:{format:"image/png"}});
  return await fileData(new File([blob],"cutout.png",{type:"image/png"}));
}
$("removeBgBtn").onclick=async()=>{
  if(!selected){setStatus("먼저 보드의 사진을 선택해 줘.");return;}
  const item=selected.getAttr("stickerItem");if(!item)return;
  try{
    $("removeBgBtn").disabled=true;
    const src=await removeBackground(item.src);
    const im=await loadImage(src);item.original=im;item.mask=makeMask(im.width,im.height);
    selected.image(composeSticker(item));selected.width(im.width);selected.height(im.height);
    selected.scale({x:Math.min(230/im.width,260/im.height,1),y:Math.min(230/im.width,260/im.height,1)});
    layer.draw();setStatus("자동 누끼 완료! 브러시로 가장자리를 다듬어 줘.");
  }catch(err){console.error(err);setStatus("자동 누끼 실패. 인터넷 연결을 확인하고 다시 시도해 줘.");}
  finally{$("removeBgBtn").disabled=false;}
};
$("deleteBtn").onclick=()=>{if(!selected)return;stickers=stickers.filter(n=>n!==selected);selected.destroy();selectNode(null);layer.draw();setStatus("선택한 스티커를 삭제했어.");};
$("frontBtn").onclick=()=>{if(selected){selected.moveToTop();transformer.moveToTop();layer.draw();}};
$("backBtn").onclick=()=>{if(selected){selected.moveDown();layer.draw();}};
$("clearBtn").onclick=()=>{if(!confirm("보드의 사진과 스티커를 모두 지울까?"))return;stickers.forEach(n=>n.destroy());stickers=[];selectNode(null);layer.draw();setStatus("보드를 비웠어.");};
stage.on("click tap",e=>{if(e.target===stage)selectNode(null);});

function dataURL(){
  transformer.hide();layer.draw();const url=stage.toDataURL({pixelRatio:2,mimeType:"image/png"});transformer.show();layer.draw();return url;
}
$("exportBtn").onclick=()=>{const a=document.createElement("a");a.href=dataURL();a.download="my-outfit.png";a.click();};
function saveLooks(){try{return JSON.parse(localStorage.getItem("dressupLooks")||"[]");}catch{return[];}}
function renderSaved(){
  const box=$("savedLooks"),arr=saveLooks();box.innerHTML="";
  if(!arr.length){box.innerHTML='<span class="empty">저장한 코디가 여기에 보여.</span>';return;}
  arr.forEach((x,i)=>{const d=document.createElement("div");d.className="saved-look";const im=document.createElement("img");im.src=x.image;const t=document.createElement("div");t.textContent=x.name;d.append(im,t);d.onclick=()=>{const a=document.createElement("a");a.href=x.image;a.download="outfit-"+(i+1)+".png";a.click();};box.append(d);});
}
$("saveBtn").onclick=()=>{const arr=saveLooks();arr.unshift({name:"코디 "+(arr.length+1),image:dataURL()});try{localStorage.setItem("dressupLooks",JSON.stringify(arr.slice(0,12)));setStatus("이 기기에 코디를 저장했어!");renderSaved();}catch{setStatus("저장 공간이 부족해. 이미지로 저장해 줘.");}};
$("refreshSaved").onclick=renderSaved;renderSaved();

// Height/weight-based generic fashion mannequin. This is an approximate illustration,
// not a prediction of an individual's actual body shape.
function createBodyMannequin(heightCm, weightKg){
  const h = Math.max(120, Math.min(220, Number(heightCm)||165));
  const w = Math.max(30, Math.min(200, Number(weightKg)||55));
  const bmi = w / ((h/100)*(h/100));
  // Broad visual range only; intentionally avoids claiming exact body composition.
  const fullness = Math.max(-0.12, Math.min(0.20, (bmi-20)*0.012));
  const legRatio = Math.max(0.48, Math.min(0.56, 0.52 + (h-165)*0.00045));
  const torsoRatio = 1-legRatio;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="620" viewBox="0 0 420 620">
    <defs><linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0cdbb"/><stop offset="1" stop-color="#dba995"/></linearGradient></defs>
    <ellipse cx="210" cy="594" rx="82" ry="9" fill="#e8e4dc"/>
    <g fill="url(#skin)" stroke="#c99683" stroke-width="1.5" stroke-linejoin="round">
      <path d="M186 52 Q210 34 234 52 Q248 72 237 99 Q228 119 210 121 Q192 119 183 99 Q172 72 186 52Z"/>
      <path d="M191 116 Q210 124 229 116 L235 144
        Q${210+58*(1+fullness)} 145 ${210+62*(1+fullness)} 184
        L${210+52*(1+fullness)} 270 Q${210+48*(1+fullness)} 294 210 300
        Q${210-48*(1+fullness)} 294 ${210-52*(1+fullness)} 270
        L${210-62*(1+fullness)} 184 Q${210-58*(1+fullness)} 145 185 144Z"/>
      <path d="M184 139 Q164 145 153 177 L127 265 Q122 281 136 286 Q150 290 157 273 L187 207Z"/>
      <path d="M236 139 Q256 145 267 177 L293 265 Q298 281 284 286 Q270 290 263 273 L233 207Z"/>
      <path d="M${210-48*(1+fullness)} 286 Q${210-50*(1+fullness)} 315 194 343 L188 405
        Q184 430 185 452 L${184-5*(1+fullness)} 556 Q182 575 195 578 Q208 580 211 563
        L${210-5*(1+fullness)} 455 L210 354 L210 300Z"/>
      <path d="M${210+48*(1+fullness)} 286 Q${210+50*(1+fullness)} 315 226 343 L232 405
        Q236 430 235 452 L${236+5*(1+fullness)} 556 Q238 575 225 578 Q212 580 209 563
        L${210+5*(1+fullness)} 455 L210 354 L210 300Z"/>
      <path d="M185 566 Q175 579 166 585 Q158 592 174 594 L205 594 Q213 591 209 579 L207 566Z"/>
      <path d="M235 566 Q245 579 254 585 Q262 592 246 594 L215 594 Q207 591 211 579 L213 566Z"/>
    </g>
    <path d="M194 76 Q210 85 226 76" fill="none" stroke="#b98272" stroke-width="1.4" stroke-linecap="round"/>
    <text x="210" y="615" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#aaa">CUSTOM BODY BASE</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
$("createBodyBtn").onclick=()=>{
  const h=Number($("heightInput").value),w=Number($("weightInput").value);
  if(!h||!w||h<120||h>220||w<30||w>200){setStatus("키는 120~220cm, 몸무게는 30~200kg 범위로 입력해 줘.");return;}
  const src=createBodyMannequin(h,w);
  addSticker(src,`내 체형 캐릭터 (${h}cm)`,`캐릭터`,false);
  setStatus("입력한 키와 몸무게를 바탕으로 기본 캐릭터를 만들었어!");
};

setStatus("사진을 올려서 나만의 코디를 만들어 봐!");
