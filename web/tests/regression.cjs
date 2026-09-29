// Run with: node web/tests/regression.cjs (no dependencies).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({window:{},TextDecoder,Uint8Array,atob,console});
for(const file of ['assets/data/meta.js','js/data.js','js/parser/save-parser.js','js/analysis/statistics.js','js/analysis/insights.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const run=code=>vm.runInContext(code,ctx);
run('state.info=detectAndParse(textToBytes(SAMPLE_CODE))');
assert.ok(run('state.info.scores.length')>0);
assert.equal(run('state.agg'),'game');
assert.equal(run('aggAcc(state.info.scores)'),run('aggAccGame(state.info.scores)'));
run("state.agg='weighted'");
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
for(const [threshold,grade,previous] of [[.85,'D','F'],[.9,'C','D'],[.93,'B','C'],[.96,'A','B'],[.98,'S','A'],[.99,'S+','S'],[1,'P','S+']]) {
  assert.equal(run(`gradeOf(${threshold})[0]`),grade);
  assert.equal(run(`gradeOf(${threshold}-0.000001)[0]`),previous);
}
assert.equal(run('gradeOf(0)[0]'),'F');
assert.equal(run('gradeOf(0.999)[0]'),'S+');
assert.equal(run('gradeOf(1-Number.EPSILON)[0]'),'S+');
assert.equal(run('scoreOf(settlement(0,0,0,0,0,0))'),0);
run('state.wG=0;state.wB=1');
assert.equal(run('scoreOf(settlement(532,2,0,0,534,534))'),1098500);
assert.equal(run("gradeOf(gameAccOf(settlement(532,2,0,0,534,534)))[0]"),'S+');
run('state.wG=.6;state.wB=0');
assert.equal(run("sortedChartScores(sortFixture,'score',-1)[0].musicName"),'Truly');
assert.equal(run("sortedChartScores(sortFixture,'grade',-1)[0].musicName"),'Truly');
console.log('PASS: three settlement fixtures, grade boundaries, truncated ACC, fixed score/grade weights, score/grade ordering.');

// Anonymized judgment counts from the reported 1.2.0 save; no player identifiers.
const aggregateFixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/aggregate-1.2.0.json'),'utf8'));
ctx.aggregateFixture=aggregateFixture;
run("state.agg='game'");
assert.equal(run('fmtAggPct(aggAcc(aggregateFixture))'),'94.61%');
assert.ok(Math.abs(run('aggAccGame(aggregateFixture)')-0.946073)<0.000001);
run('state.wG=0;state.wB=1');
assert.equal(run('fmtAggPct(aggAcc(aggregateFixture))'),'94.61%');
run("state.wG=.6;state.wB=0;state.agg='weighted'");
assert.equal(run('fmtAggPct(aggAcc(aggregateFixture))'),'93.35%');
run("state.agg='mean'");
assert.equal(run('fmtAggPct(aggAcc(aggregateFixture))'),'95.46%');
run("state.agg='game'");
// Best ACC per chart: worse duplicates must not reduce the profile result.
assert.equal(run('aggAccGame([...aggregateFixture,{...aggregateFixture[0],perfect:0}])'),run('aggAccGame(aggregateFixture)'));
assert.equal(run('aggAccGame([...aggregateFixture,{...aggregateFixture[0],hard:9}])'),run('aggAccGame(aggregateFixture)'));
assert.equal(run('aggAccGame([])'),0);
assert.equal(run('aggAccGame([{...parseSongScore(new Uint8Array()),musicName:"empty"}])'),1);
assert.equal(run('fmtAggPct(aggAccGame([{...settlement(100,0,0,0,100,100),hard:0},{...settlement(0,0,0,100,100,0),hard:3}]))'),'11.11%');
console.log('PASS: game difficulty weights, per-chart truncation, 94.61% reported sample, duplicate charts, empty input, independent analysis modes.');
