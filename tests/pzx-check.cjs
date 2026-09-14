// Run: node tests/pzx-check.cjs
// Logic/integration checks using mocked browser/React hooks. Visual QA requires a real browser.
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const report=console.log;

function makeHarness(source){
 let cursor=0,hookSlots=[],nextTimer=1,now=0;const timers=new Map(),disk=new Map();
 const node=()=>new Proxy(function(){},{get(t,k){
   if(k==='getChannelData')return ()=>new Float32Array(64);
   if(k==='getBoundingClientRect')return ()=>({left:0,top:0,width:360,height:100});
   if(k==='then')return undefined;
   if(k==='value')return 0;
   if(k==='getAnimations')return ()=>[];
   if(k==='style')return {setProperty(){}};
   return node();
 },set(){return true;},apply(){return node();}});
 const elem=()=>({style:{setProperty(){}},classList:{add(){},remove(){},contains(){return false;}},getBoundingClientRect(){return {left:0,top:0,width:360,height:100}},appendChild(){},remove(){},setAttribute(){},addEventListener(){},removeEventListener(){},querySelector(){return null},querySelectorAll(){return []},getContext(){return node()},getAnimations(){return []}});
 const document={documentElement:elem(),body:elem(),activeElement:null,addEventListener(){},removeEventListener(){},getElementById:()=>elem(),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>elem()};
 function AC(){this.sampleRate=10;this.currentTime=0;this.state='running';this.destination=node();}
 for(const k of ['createConvolver','createGain','createBuffer','createOscillator','createBiquadFilter','createBufferSource','createDynamicsCompressor','createStereoPanner'])AC.prototype[k]=node;
 AC.prototype.resume=()=>Promise.resolve();
 const window={innerWidth:360,innerHeight:800,devicePixelRatio:1,AudioContext:AC,addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),location:{search:'',href:'https://example.test/'}};
 const localStorage={getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)};
 function Audio(){this.play=()=>Promise.resolve();this.pause=()=>{};this.addEventListener=()=>{};this.load=()=>{};this.paused=true;}
 function Image(){this.complete=true;this.naturalWidth=1672;this.naturalHeight=941;}
 const setTimeout=(fn,delay=0)=>{const id=nextTimer++;timers.set(id,{fn,at:now+delay});return id;};
 const clearTimeout=id=>timers.delete(id);
 const React={
   createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!==false&&x!=null)}),
   useState(init){const i=cursor++;if(!(i in hookSlots))hookSlots[i]=typeof init==='function'?init():init;return [hookSlots[i],v=>{hookSlots[i]=typeof v==='function'?v(hookSlots[i]):v}];},
   useRef(init){const i=cursor++;if(!(i in hookSlots))hookSlots[i]={current:init};return hookSlots[i];},
   useEffect(){cursor++;},useLayoutEffect(){cursor++;},useMemo(fn){cursor++;return fn();},useCallback(fn){cursor++;return fn;},Fragment:'fragment'
 };
 const ReactDOM={createRoot:()=>({render(){}})};
 let js=source.slice(source.indexOf('<script>')+8,source.lastIndexOf('</script>'));
 js=js.replace("  const curStage=stageCtx?", "  window.__pzxHarness={startPzx,startStage,startGame,endGame,goMap,goHome,completeTen,resolvePlay,doTimeUp,doCountdown,recordPzx,pzxStatsR,stageOptsR,saveR,pPtR,dPtR,phaseR,hitFxR,roundTokR,rnR,gkKindR,gkRateR};\n  const curStage=stageCtx?");
 const exports=new Function('React','ReactDOM','window','document','localStorage','Audio','Image','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame','navigator','performance','fetch',js+'\nreturn {App,PzxMap,PzxPanel,PzxBrief,PzxResult,PZX_STAGES,pzxState};')(
  React,ReactDOM,window,document,localStorage,Audio,Image,setTimeout,clearTimeout,()=>0,()=>{},()=>0,()=>{},{userAgent:'test'},{now:()=>now},()=>Promise.resolve({}));
 function render(){cursor=0;return exports.App();}
 function renderComponent(component,props){const prev=hookSlots,prevCursor=cursor;hookSlots=[];cursor=0;try{return component(props);}finally{hookSlots=prev;cursor=prevCursor;}}
 function advance(ms){const target=now+ms;let runs=0;while(true){let next=null;for(const [id,t] of timers){if(t.at<=target&&(!next||t.at<next.t.at))next={id,t};}if(!next)break;if(++runs>2000)throw Error('Timer loop');timers.delete(next.id);now=next.t.at;next.t.fn();}now=target;}
 return {exports,window,disk,render,renderComponent,advance,timers,get api(){return window.__pzxHarness;}};
}

const assert=(v,msg)=>{if(!v)throw Error(msg);};
const make=makeHarness;
const nodes=t=>!t||typeof t!=='object'?[]:[t,...(t.children||[]).flatMap(nodes)];
let passed=0;
function test(name,fn){fn();passed++;report(name);}
test('既存メニューから通常マップに進める',()=>{
 const h=make(source);h.render().props.onPlay();assert(h.render().type.name==='MapScreen','normal map');
});
test('新マップに7島・6封印・最初の挑戦ボタンがある',()=>{
 const h=make(source);h.render().props.onPuzzlux();h.render().props.onEnter();const t=h.render(),n=nodes(h.renderComponent(t.type,t.props));
 assert(n.filter(x=>x.type==='button'&&x.props.className?.startsWith('pzx-island')).length===7,'islands');
 assert(n.filter(x=>x.props.className==='pzx-seal').length===6,'locks');
 assert(n.some(x=>x.props.className==='pzx-primary'&&!x.props.disabled),'start');
});
test('未開放ボスはハンドラーからも開始できない',()=>{
 const h=make(source);h.render();h.api.startPzx(6);assert(h.render().type.name==='TitleScreen','locked');
});
test('対戦開始で専用設定・条件表示がつながる',()=>{
 const h=make(source);h.render();h.api.startPzx(0);assert(h.render().type.name==='PzxBrief','brief');h.render().props.onStart();const t=h.render();
 assert(t.props.className.includes('pzx-battle'),'battle');assert(nodes(t).some(x=>x.props.className?.startsWith('pzx-live-goal')),'condition');
 assert(h.api.stageOptsR.current.pzx&&h.api.stageOptsR.current.speed===.65,'options');
});
test('条件未達成で勝つと次へ進めるがピースは増えない',()=>{
 const h=make(source);h.render();h.api.startPzx(0);h.render().props.onStart();h.render();h.api.endGame(10,4,false,true);
 const t=h.render();assert(!t.props.data.pzx.met,'goal');assert(h.api.saveR.current.pzx.cleared.includes(0),'cleared');assert(!h.api.saveR.current.pzx.got.length,'no reward');
 assert(JSON.parse(h.disk.get('tenkuru-save')).pzx.cleared.includes(0),'saved');
 t.props.onMap();h.render();h.api.startPzx(1);assert(h.render().props.stage.no===2,'stage2');
});
test('条件の3点境界・再戦の報酬重複・演出前保存',()=>{
 const h=make(source);h.render();h.api.startPzx(0);h.render().props.onStart();h.render();h.api.endGame(10,3,false,true);
 let t=h.render();assert(t.props.data.pzx.newly,'new');t.props.onMap();t=h.render();assert(t.props.reward.piece===0,'animation');assert(t.props.save.pzx.got.includes(0),'already saved');
 h.api.startPzx(0);h.render().props.onStart();h.render();h.api.endGame(10,0,false,true);assert(!h.render().props.data.pzx.newly,'no duplicate');
});
test('敗北でクリア・ピースは増えない',()=>{
 const h=make(source);h.render();h.api.startPzx(0);h.render().props.onStart();h.render();h.api.endGame(2,10,false,true);
 assert(h.render().props.data.winner==='dealer','lost');assert(!h.api.saveR.current.pzx.got.length&&!h.api.saveR.current.pzx.cleared.length,'no reward');
});
test('実際の10完成処理から3枚・4枚・役を記録する',()=>{
 const h=make(source);h.render();h.api.startPzx(0);h.render().props.onStart();h.render();
 h.api.completeTen([2,3,5],'player',1);h.api.completeTen([1,2,3,4],'player',2);
 assert(h.api.pzxStatsR.current.three===1&&h.api.pzxStatsR.current.four===1,'card counts');
 assert(h.api.pzxStatsR.current.roles.includes('ストレート'),'role');
});
test('実際のバーストでノーミス条件が未達成になる',()=>{
 const h=make(source);h.render();h.api.saveR.current={stars:{},pzx:{cleared:[0,1]}};h.api.startPzx(2);h.render().props.onStart();h.render();
 h.api.resolvePlay(5,[3,4],7,'player',1,false,false);h.api.endGame(12,0,false,true);assert(!h.render().props.data.pzx.met,'burst');
});
test('6面クリアだけではボスを開けない',()=>{
 const h=make(source);h.render();h.api.saveR.current={stars:{},pzx:{cleared:[0,1,2,3,4,5]}};h.api.startPzx(6);
 assert(h.render().type.name==='TitleScreen','missing pieces');
});
test('6ピースだけではボスを開けない',()=>{
 const h=make(source);h.render();h.api.saveR.current={stars:{},pzx:{got:[0,1,2,3,4,5]}};h.api.startPzx(6);
 assert(h.render().type.name==='TitleScreen','missing clear');
});
test('重複や不正なピースを保存してもボスは開かない',()=>{
 const h=make(source);h.render();h.api.saveR.current={stars:{},pzx:{cleared:[5],got:[0,0,0,0,0,0,6,-1,'1']}};h.api.startPzx(6);
 assert(h.render().type.name==='TitleScreen','invalid pieces');
});
test('条件をそろえるとボス開始・絵の表示・クリア保存ができる',()=>{
 const h=make(source);h.render();h.api.saveR.current={stars:{14:3},pzx:{cleared:[0,1,2,3,4,5],got:[0,1,2,3,4,5]}};
 h.api.startPzx(6);h.render().props.onStart();const t=h.render();assert(nodes(t).some(x=>x.props.className==='pzx-battle-art'),'art');
 assert(h.api.gkKindR.current==='mix'&&h.api.gkRateR.current===1,'boss rings');
 h.api.endGame(20,15,false,true);h.render();assert(h.api.saveR.current.pzx.bossClear&&h.api.saveR.current.pzx.got.length===6,'boss clear');
 assert(h.api.saveR.current.stars[14]===3,'legacy record');
});
test('カウント中に離脱しても戦闘が勝手に再開しない',()=>{
 const h=make(source);h.render();h.api.startPzx(0);h.render().props.onStart();h.render();h.api.goMap();h.render();h.advance(5000);
 assert(h.api.phaseR.current==='pzxmap','stale countdown');
});
test('決着演出中に離脱しても結果画面へ戻されない',()=>{
 const h=make(source);h.render();h.api.startPzx(0);h.render().props.onStart();h.render();h.api.endGame(10,0);h.api.goMap();h.render();h.advance(5000);
 assert(h.api.phaseR.current==='pzxmap','stale result');
});
test('全7ステージの説明画面を生成できる',()=>{
 const h=make(source);h.render();for(const stage of h.exports.PZX_STAGES)assert(h.renderComponent(h.exports.PzxBrief,{stage,onStart(){},onBack(){}}),'brief');
});
report(passed+' tests passed (mock DOM / React hooks; not a browser playtest)');
