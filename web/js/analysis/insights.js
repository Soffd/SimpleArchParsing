// Pure summary calculation; weights are supplied through the shared ACC helpers.
function judgedNotes(s) { return s.perfect+s.earlyGood+s.lateGood+s.earlyBad+s.lateBad+s.miss; }
function isZeroMiss(s) { return judgedNotes(s)>0 && s.miss===0; }
function isAP(s) { return judgedNotes(s)>0 && s.perfect===judgedNotes(s); }
function analyzeScores(scores) {
  const valid = scores.filter(s => judgedNotes(s)>0);
  const groups = [0,1,2,3].map(hard => {
    const rows = valid.filter(s => s.hard===hard);
    return {hard,count:rows.length,acc:aggAcc(rows),fc:rows.filter(isZeroMiss).length};
  });
  const bands = [{label:'99–100%',min:.99,max:Infinity},{label:'98–99%',min:.98,max:.99},{label:'95–98%',min:.95,max:.98},{label:'90–95%',min:.90,max:.95},{label:'低于 90%',min:0,max:.90}].map(b=>({...b,count:valid.filter(s=>accOf(s)>=b.min && accOf(s)<b.max).length}));
  const early=valid.reduce((n,s)=>n+s.earlyGood+s.earlyBad,0);
  const late=valid.reduce((n,s)=>n+s.lateGood+s.lateBad,0);
  const candidates=valid.map(s=>({score:s,loss:((1-state.wG)*(s.earlyGood+s.lateGood)+(1-state.wB)*(s.earlyBad+s.lateBad)+s.miss)/accDen(s)})).filter(x=>x.loss>0).sort((a,b)=>b.loss-a.loss).slice(0,3);
  return {valid,groups,bands,early,late,candidates,ap:valid.filter(isAP).length};
}
