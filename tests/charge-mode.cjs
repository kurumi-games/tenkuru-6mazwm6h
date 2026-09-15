// Exercise the shipped game functions with the same deterministic offline harness.
const assert=require('node:assert/strict');
const {engine}=require('./rush-mode.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function start(){const e=engine();e.app.startChargeBattle('hard');while(e.app.countNumR.current>=0)e.clock.advance(1);return e;}
const walk=(x,out=[])=>{if(x&&typeof x==='object'){out.push(x);(x.children||[]).flat(Infinity).forEach(y=>walk(y,out));}return out;};
{
 const e=engine();let clicked=0;
 walk(e.api.TitleScreen({onCharge:()=>clicked++})).find(n=>n.children[0]==='60秒チャージ').props.onClick();
 walk(e.api.ChargeScreen({onBattle:d=>{assert.equal(d,'normal');clicked++;}})).find(n=>n.children[0]==='チャレンジする').props.onClick();assert.equal(clicked,2);
 for(const who of ['player','dealer']){const meter=e.api.ChargeMeter({who,value:2.5});assert.equal(meter.props.role,'meter');assert.equal(meter.props['aria-valuenow'],2.5);}
 for(const winner of ['player','dealer','draw']){const t=e.api.ChargeResult({data:{winner,pPt:5,dPt:3,charge:{tens:2,bursts:1}},onRetry:()=>clicked++,onBack:()=>clicked++});const buttons=walk(t).filter(n=>n.type==='button');buttons.forEach(n=>n.props.onClick());}assert.equal(clicked,8);
 assert.equal(e.api.chargeStage('hard').rush,false);assert.equal(e.api.chargeStage('hard').charge,true);
}
// Countdown cannot replenish energy; each side starts with precisely two cards.
{
 const e=start();near(e.app.chargeR.current.player,2);near(e.app.chargeR.current.dealer,2);near(e.app.timeLeftR.current,60);
 e.app.dealPlayer([2,2,3,3]);e.app.playCard(0);e.app.playCard(1);e.app.playCard(2);
 assert.equal(e.app.fieldR.current.join(','),'2,2');assert.equal(e.app.pHR.current[2],3);near(e.app.chargeR.current.player,0);
 e.clock.advance(1499);e.app.playCard(2);assert.equal(e.app.fieldR.current.length,2);
 e.clock.advance(1);e.app.playCard(2);assert.equal(e.app.fieldR.current.join(','),'2,2,3');near(e.app.chargeR.current.player,0);near(e.app.chargeR.current.dealer,3);
 e.clock.advance(6000);near(e.app.chargeR.current.player,4);near(e.app.chargeR.current.dealer,4);
 e.app.playCard(3);assert.equal(e.app.pPtR.current,3);near(e.app.chargeR.current.player,3);assert.equal(e.app.pHR.current.filter(v=>v!==null).length,10);
 const deadline=e.app.rushDeadlineR.current;e.clock.advance(200);assert.equal(e.app.rushDeadlineR.current,deadline);assert.equal(e.app.rnR.current,1);
}
// Invalid taps and empty slots never cost energy; overflow at maximum is discarded.
{
 const e=start();e.app.dealPlayer([1,1,1,null]);e.app.playCard(0);e.app.playCard(1);e.clock.advance(3000);const before=e.app.chargeR.current.player;
 e.app.playCard(2);e.app.playCard(3);near(e.app.chargeR.current.player,before);
 const p=e.api.chargeAdvance({player:4,dealer:4,at:0},30000);p.player--;near(e.api.chargeAdvance(p,30750).player,3.5);
}
// Dealer spends the same budget; a returned flight refunds once only.
{
 const e=start();e.app.setDealer([2,2,3,3]);
 for(let i=0;i<2;i++){e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:2},1);e.clock.advance(300);}
 near(e.app.chargeR.current.dealer,0.4);e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:3},1);assert.equal(e.app.flyR.current,null);assert.equal(e.app.fieldR.current.join(','),'2,2');
 e.clock.advance(900);e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:3},1);const flight=e.app.flyR.current;assert.ok(flight);near(e.app.chargeR.current.dealer,0);
 e.app.completeTen([5,5],'player',1);near(e.app.chargeR.current.dealer,1);e.app.refundCharge(flight);near(e.app.chargeR.current.dealer,1);assert.equal(e.app.dHR.current.length,2);
 e.clock.advance(300);near(e.app.chargeR.current.dealer,1.2);assert.equal(e.app.fieldR.current.length,0);
}
// A collision on the dealer's final card must not create an extra ten-card refill.
{
 const e=start();e.app.setDealer([5]);e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:5},1);
 e.clock.advance(250);e.app.fieldR.current=[4,3];e.app.fieldSumR.current=7;e.app.pLandAtR.current=e.clock.now();e.clock.advance(50);
 assert.equal(e.app.dHR.current.length,1);near(e.app.chargeR.current.dealer,2.2);assert.equal(e.app.dPtR.current,0);
}
// One uninterrupted 60-second score contest; role points, bursts, and tie support.
for(const winner of ['player','dealer','draw']){
 const e=start();const before=JSON.stringify(e.app.saveR.current);
 if(winner!=='draw')e.app.completeTen([1,2,3,4],winner,1);
 e.clock.advance(10000);assert.equal(e.app.phaseR.current,'playing');assert.equal(e.app.rnR.current,1);assert.equal(e.app.rushMatchR.current.history.length,0);
 e.clock.advance(49950);assert.equal(e.app.phaseR.current,'playing');e.clock.advance(50);assert.equal(e.app.phaseR.current,'gameEnd');assert.equal(e.app.rushClosedR.current,true);near(e.app.timeLeftR.current,0);
 assert.equal(JSON.stringify(e.app.saveR.current),before);const pts=e.app.pPtR.current;e.app.completeTen([1,2,3,4],'player',1);assert.equal(e.app.pPtR.current,pts);
}
{
 const e=start();e.app.resolvePlay(5,[3,4],7,'player',1);assert.equal(e.app.dPtR.current,1);assert.equal(e.app.matchStatsR.current.bursts,1);e.clock.advance(200);assert.equal(e.app.fieldR.current.length,0);
 e.clock.jump(59800);e.app.completeTen([1,2,3,4],'player',1);assert.equal(e.app.pPtR.current,0);assert.equal(e.app.phaseR.current,'gameEnd');
}
// Pausing beyond the old deadline cannot end the match or accrue charge.
{
 const e=start();e.app.dealPlayer([2,2]);e.app.playCard(0);e.clock.advance(725);e.app.togglePause();const before={...e.app.chargeR.current},left=e.app.timeLeftR.current;
 assert.equal(e.app.pausedR.current,true);e.clock.advance(70000);e.app.playCard(1);e.app.updateCharge();near(e.app.chargeR.current.player,before.player);near(e.app.timeLeftR.current,left);assert.equal(e.app.phaseR.current,'playing');
 e.app.togglePause();assert.equal(e.app.pausedR.current,false);near(e.app.chargeR.current.player,before.player);e.clock.advance(750);e.app.updateCharge();near(e.app.chargeR.current.player,before.player+0.5);
}
// Countdown/settlement cancellation and a clean retry with two energy.
for(const when of ['countdown','settlement']){
 const e=when==='countdown'?engine():start();if(when==='countdown')e.app.startChargeBattle('normal');else e.app.completeTen([5,5],'player',1);
 e.app.goHome();e.clock.advance(70000);assert.equal(e.app.phaseR.current,'charge');assert.equal(e.app.stageOptsR.current,null);
 e.app.startChargeBattle('normal');while(e.app.countNumR.current>=0)e.clock.advance(1);near(e.app.chargeR.current.player,2);near(e.app.chargeR.current.dealer,2);near(e.app.timeLeftR.current,60);assert.equal(e.app.pPtR.current,0);
}
// Run the actual CPU scheduler/cursor/flight sequence across repeated regeneration.
for(const diff of ['normal','hard']){
 const e=engine({ai:true});e.app.startChargeBattle(diff);while(e.app.countNumR.current>=0)e.clock.advance(1);
 e.app.dealPlayer(Array(10).fill(5));e.app.setDealer(Array(10).fill(5));
 e.clock.advance(30000);assert.ok(e.app.dPtR.current>=3,'CPU must keep playing after using initial energy');assert.equal(e.app.phaseR.current,'playing');assert.ok(e.app.chargeR.current.dealer>=0&&e.app.chargeR.current.dealer<=4);
 e.clock.advance(30000);assert.equal(e.app.phaseR.current,'gameEnd');
}
console.log('PASS: charge entry/gauges/results; equal energy budgets; rapid taps; refill/cap/refunds; uninterrupted 60 seconds; deadline; pause/resume; retry; save isolation.');
