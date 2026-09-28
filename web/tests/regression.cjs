// Run with: node web/tests/regression.cjs (no dependencies).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({window:{},TextDecoder,Uint8Array,atob,console});
for(const file of ['assets/data/meta.js','js/data.js','js/parser/save-parser.js','js/analysis/statistics.js','js/analysis/insights.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const run=code=>vm.runInContext(code,ctx);
run('state.info=detectAndParse(textToBytes(SAMPLE_CODE))');
assert.ok(run('state.info.scores.length')>0);
// Bundled MockPlayer fixture: 6070 Perfect, 170 Good, 21 Bad, 6285 notes.
assert.ok(Math.abs(run('aggAcc(state.info.scores)')-6174.1/6285)<1e-12);
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
