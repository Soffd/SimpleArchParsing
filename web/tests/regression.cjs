// Run with: node web/tests/regression.cjs (no dependencies).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({window:{},TextDecoder,Uint8Array,atob,console});
for(const file of ['assets/data/meta.js','js/data.js','js/parser/save-parser.js','js/analysis/statistics.js','js/analysis/insights.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const run=code=>vm.runInContext(code,ctx);
run('state.info=detectAndParse(textToBytes(SAMPLE_CODE))');
assert.ok(run('state.info.scores.length')>0);
// Bundled MockPlayer fixture: 6070 Perfect, 170 Good, 21 Bad, 6285 notes.
assert.ok(Math.abs(run('aggAcc(state.info.scores)')-6172/6285)<1e-12);
assert.equal(run('chartOf(state.info.scores[0]).lv'),'5');
assert.equal(run('JSON.stringify(parsePlayerInfo(textToBytes(hexOf(textToBytes(SAMPLE_CODE)))) )'),run('JSON.stringify(parsePlayerInfo(textToBytes(SAMPLE_CODE)))'));
assert.throws(()=>run('detectAndParse(new Uint8Array())'));
assert.throws(()=>run('parsePlayerInfo(Uint8Array.from([10,127,1]))'));
assert.equal(run('isZeroMiss(parseSongScore(new Uint8Array()))'),false);
assert.equal(run('isAP({...parseSongScore(new Uint8Array()),perfect:100,fullComboCount:100})'),true);
assert.equal(run('analyzeScores([]).candidates.length'),0);
assert.equal(run('analyzeScores(state.info.scores).bands.reduce((n,b)=>n+b.count,0)'),run('analyzeScores(state.info.scores).valid.length'));
run("state.difficulty='3'");
assert.equal(run('filteredScores().every(s=>s.hard===3)'),true);
run("state.difficulty='';state.filter='THIS_DOES_NOT_EXIST'");
assert.equal(run('filteredScores().length'),0);
run(`
  const sortFixture = [
    {musicName:'Liar',hard:2,perfect:90,fullComboCount:100,earlyGood:0,lateGood:0,earlyBad:0,lateBad:0,miss:10},
    {musicName:'Crosstheedge',hard:2,perfect:95,fullComboCount:100,earlyGood:0,lateGood:0,earlyBad:0,lateBad:0,miss:5},
    {musicName:'UnknownChart',hard:2,perfect:99,fullComboCount:100,earlyGood:0,lateGood:0,earlyBad:0,lateBad:0,miss:1},
    {musicName:'Truly',hard:0,perfect:100,fullComboCount:100,earlyGood:0,lateGood:0,earlyBad:0,lateBad:0,miss:0}
  ];
`);
assert.equal(run("sortedChartScores(sortFixture,'hard',1).map(s=>s.musicName).join(',')"),'Truly,Crosstheedge,Liar,UnknownChart');
assert.equal(run("sortedChartScores(sortFixture,'lv',-1).map(s=>s.musicName).join(',')"),'Liar,Crosstheedge,Truly,UnknownChart');
assert.equal(run("sortedChartScores(sortFixture,'acc',1)[0].musicName"),'Liar');
assert.equal(run("sortedChartScores(sortFixture,'acc',-1)[0].musicName"),'Truly');
assert.equal(run('sortFixture[0].musicName'),'Liar');
console.log('PASS: parser, ACC, metadata, filters, chart ordering (difficulty, Lv+, missing Lv, ACC directions), non-mutating sort.');
run(`const settlement = (p,g,b,m,n,c)=>({perfect:p,earlyGood:g,lateGood:0,earlyBad:b,lateBad:0,miss:m,fullComboCount:n,maxComboCount:c});`);
for (const [input, score, acc, grade] of [
  ['settlement(941,30,3,7,981,266)',1004615,'97.75%','A'],
  ['settlement(532,2,0,0,534,534)',1098500,'99.85%','S+'],
  ['settlement(1058,11,4,2,1077,605)',1044574,'99.03%','S+']
]) {
  assert.equal(run(`scoreOf(${input})`),score);
  assert.equal(run(`fmtPct(accOf(${input}))`),acc);
  assert.equal(run(`gradeOf(gameAccOf(${input}))[0]`),grade);
}
for(const [threshold,grade] of [[.6,'D'],[.7,'C'],[.8,'B'],[.9,'A'],[.98,'S'],[.99,'S+'],[.999,'P']]) {
  assert.equal(run(`gradeOf(${threshold})[0]`),grade);
  assert.notEqual(run(`gradeOf(${threshold}-0.000001)[0]`),grade);
}
assert.equal(run('scoreOf(settlement(0,0,0,0,0,0))'),0);
run('state.wG=0;state.wB=1');
assert.equal(run('scoreOf(settlement(532,2,0,0,534,534))'),1098500);
assert.equal(run("gradeOf(gameAccOf(settlement(532,2,0,0,534,534)))[0]"),'S+');
run('state.wG=.6;state.wB=0');
assert.equal(run("sortedChartScores(sortFixture,'score',-1)[0].musicName"),'Truly');
assert.equal(run("sortedChartScores(sortFixture,'grade',-1)[0].musicName"),'Truly');
console.log('PASS: three settlement fixtures, grade boundaries, truncated ACC, fixed score/grade weights, score/grade ordering.');
