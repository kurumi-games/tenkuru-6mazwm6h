// Offline component checks. jsdom does not perform visual layout or emulate native dialog inertness.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const cssTree=require('css-tree');
const dom=new JSDOM('<!doctype html><body><div id="root"></div></body>',{url:'https://example.test/'});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');
const {createRoot}=require('react-dom/client');
const {act}=React;
let shown=0;
dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');shown++;};
dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1]);
const css=html.slice(html.indexOf('/* ===== v250 PUZZLUX'),html.indexOf('/* ===== v217 パズルクス：絵の中'));
cssTree.parse(css,{onParseError:e=>{throw e;}});
const definitions=html.slice(html.indexOf('const PZX='),html.indexOf('function boostDiff('));
const components=html.slice(html.indexOf('function PzxIcon('),html.indexOf('// ── v234 パズルクス：結果。'));
const context=vm.createContext({React,h:React.createElement,useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,document,STAGES:{areas:[]}});
vm.runInContext(definitions+'\n'+components+'\nthis.api={PzxPanel,PZX,PZX_STAGES,pzxState,pzxCurrent};',context);
const {PzxPanel,PZX,PZX_STAGES,pzxState,pzxCurrent}=context.api;
const root=createRoot(document.getElementById('root'));
const qs=s=>document.querySelector(s);
let battle=-1,resets=0,home=0;
let mounted=false;
function render(got,boss=false){act(()=>root.render(React.createElement(PzxPanel,{save:{pzx:{got,boss}},onBattle:i=>battle=i,onBack:()=>home++,onReset:()=>resets++})));mounted=true;}
function click(selector){const el=qs(selector);assert.ok(el,selector);act(()=>{el.focus();el.click();});}
function close(){click('dialog .pzx-close');assert.equal(qs('dialog'),null);}
for(let n=0;n<=6;n++){
 const got=Array.from({length:n},(_,i)=>i);render(got);
 assert.equal(qs('h1').textContent,n===6?'ネフィラ':'？？？');
 assert.equal(document.querySelectorAll('.pzx-panel .pc').length,n===6?0:n);
 assert.equal(document.querySelectorAll('.pzx-diamonds .on').length,n);
 assert.equal(!!qs('.pzx-panel .cp'),n===6);
 assert.equal(!!qs('.pzx-panel .cracks'),n!==6);
 assert.equal(!!qs('.pzx-mission .pzx-reward'),n!==6);
 if(n<6)assert.equal(qs('.pzx-reward img').getAttribute('src'),PZX.dir+PZX.pieces[n].thumb);
 click('.pzx-battle');assert.equal(battle,Math.min(n,6));
}
render([0,1]);
const before=shown;click('.pzx-mission');assert.equal(shown,before+1);assert.ok(qs('dialog[open]'));
assert.deepEqual([...document.querySelectorAll('.pzx-detail-conditions li')].map(n=>n.textContent),['勝利する','相手にストレートを1回作らせる']);
assert.match(qs('dialog').textContent,/両者の手札1枚が3秒/);
assert.match(qs('dialog').textContent,/クリア報酬/);
assert.equal(qs('dialog .pzx-reward img').getAttribute('src'),PZX.dir+PZX.pieces[2].thumb);
close();assert.equal(document.activeElement,qs('.pzx-mission'));
click('.pzx-panel');assert.equal(qs('dialog h2').textContent,'復元パネル');
assert.equal(document.querySelectorAll('dialog .pc').length,2);close();
click('.pzx-mission');act(()=>qs('dialog').dispatchEvent(new dom.window.Event('cancel',{cancelable:true})));assert.equal(qs('dialog'),null);
click('.pzx-mission');click('.pzx-dialog-x');assert.equal(qs('dialog'),null);
click('.pzx-menu-button');assert.match(qs('dialog').textContent,/はじめから/);
const menuButtons=()=>[...document.querySelectorAll('.pzx-menu-options button')];
act(()=>menuButtons().find(b=>b.textContent==='はじめから').click());assert.equal(resets,0);
act(()=>menuButtons().find(b=>b.textContent==='やめる').click());assert.equal(resets,0);
act(()=>menuButtons().find(b=>b.textContent==='はじめから').click());
act(()=>menuButtons().find(b=>b.textContent==='進行をリセットする').click());assert.equal(resets,1);assert.equal(qs('dialog'),null);
render([0,1,2,3,4,5],true);assert.equal(qs('h1').textContent,'ネフィラ');assert.match(qs('.pzx-mission').textContent,/CLEAR/);assert.equal(qs('.pzx-reward'),null);
click('.pzx-home');assert.equal(home,1);
const legacy={pzx:{got:[0,0,1,7,'2',null],boss:false},stars:{1:3}};
assert.equal(JSON.stringify(pzxState(legacy).got),'[0,1]');assert.equal(pzxCurrent(legacy),2);assert.equal(legacy.pzx.got.length,6);assert.equal(legacy.stars[1],3);
const stats={win:true,bursts:0,tens:[{last:3},{last:3}],dtens:[{voice:'ストレート'}],timeups:0,nines:2};
for(const stage of PZX_STAGES.slice(0,6)){
 assert.equal(stage.mission.check(stats),true,stage.name+' positive');
 assert.equal(stage.mission.check({...stats,win:false}),false,stage.name+' must win');
}
assert.equal(PZX_STAGES[0].mission.check({...stats,bursts:2}),false);
assert.equal(PZX_STAGES[1].mission.check({...stats,tens:[{last:3}]}),false);
assert.equal(PZX_STAGES[2].mission.check({...stats,dtens:[]}),false);
assert.equal(PZX_STAGES[3].mission.check({...stats,timeups:1}),false);
assert.equal(PZX_STAGES[4].mission.check({...stats,bursts:1}),false);
assert.equal(PZX_STAGES[5].mission.check({...stats,nines:1}),false);
for(const p of PZX.pieces){assert.equal(p.w,1024);assert.equal(p.h,1536);for(const f of [p.id+'.webp',p.thumb])assert.ok(fs.existsSync(path.join(__dirname,'..',PZX.dir,f)),f);}
for(const f of [PZX.outline,PZX.complete,PZX.cracks,'v250/background.webp'])assert.ok(fs.existsSync(path.join(__dirname,'..',PZX.dir,f)),f);
if(mounted)act(()=>root.unmount());
console.log('PASS: JS/CSS syntax; 0–6 pieces and boss states; next reward; battle target; modal open/close/focus; reset confirmation; legacy save; all six mission predicates; asset paths.');
console.log('Not covered: real-browser visual layout, touch target reach, native modal focus trap/inert background.');
