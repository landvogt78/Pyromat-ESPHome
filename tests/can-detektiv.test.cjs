'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {parseTraceFrame, changedBytes, traceCsv, traceStorageState, traceEntries} = require('../web/dashboard.js');

test('valid raw CAN frame decodes 16-bit little-endian index only for our known IDs', () => {
  const frame=parseTraceFrame({seq:1,ms:10,id:0x23B,ext:false,rtr:false,data:'8D00007F4600CD01'});
  assert.equal(frame.index, 0x008d);
  assert.equal(frame.data,'8D00007F4600CD01');
  assert.equal(parseTraceFrame({...frame,id:0x77}).index,null);
  assert.equal(parseTraceFrame({...frame,ext:true}).index,null);
  assert.equal(parseTraceFrame({...frame,data:'8D008'}),null);
  assert.equal(parseTraceFrame({...frame,id:0x800,ext:false}),null);
  assert.equal(parseTraceFrame({...frame,data:'GG'}),null);
});

test('changed bytes indicates only differing octets', () => {
  assert.deepEqual(changedBytes('AABBCC','AABBDD'),[2]);
  assert.deepEqual(changedBytes(null,'AABB'),[]);
  assert.deepEqual(changedBytes('AA','AABB'),[1]);
});

test('markers divide newest-first frames after their recorded sequence, including filtered gaps', () => {
  const frames=[{seq:10},{seq:20},{seq:30}];
  const markers=[{number:1,sequence:15},{number:2,sequence:20},{number:3,sequence:20}];
  assert.deepEqual(traceEntries(frames,markers),[
    {type:'frame',frame:frames[2]},
    {type:'marker',marker:markers[2]},
    {type:'marker',marker:markers[1]},
    {type:'frame',frame:frames[1]},
    {type:'marker',marker:markers[0]},
    {type:'frame',frame:frames[0]}
  ]);
});

test('frame limit keeps marker boundaries inside the visible window without using frame slots', () => {
  const frames=[{seq:1},{seq:2},{seq:3},{seq:4}];
  const markers=[{number:1,sequence:1},{number:2,sequence:3},{number:3,sequence:4}];
  assert.deepEqual(traceEntries(frames,markers,2),[
    {type:'marker',marker:markers[2]},
    {type:'frame',frame:frames[3]},
    {type:'marker',marker:markers[1]},
    {type:'frame',frame:frames[2]}
  ]);
  assert.deepEqual(frames,[{seq:1},{seq:2},{seq:3},{seq:4}]);
  assert.deepEqual(markers,[{number:1,sequence:1},{number:2,sequence:3},{number:3,sequence:4}]);
});

test('markers remain visible without matching frames and before the first received frame', () => {
  const marker={number:1,sequence:0};
  assert.deepEqual(traceEntries([], [marker]), [{type:'marker',marker}]);
  assert.deepEqual(traceEntries([{seq:1}], [marker]), [
    {type:'frame',frame:{seq:1}}, {type:'marker',marker}
  ]);
  assert.deepEqual(traceEntries([], []), []);
});

test('initial trace response preserves a marker set before polling completes', async () => {
  const nodes=new Map();
  const el=id=>{
    if(!nodes.has(id))nodes.set(id,{
      hidden:false,value:'',checked:false,listeners:{},
      addEventListener(event,handler){this.listeners[event]=handler;}
    });
    return nodes.get(id);
  };
  let poll;
  const context={
    window:{PyromatDashboard:require('../web/dashboard.js'),addEventListener(){}},
    document:{hidden:false,documentElement:{dataset:{}},getElementById:el,addEventListener(){}},
    setInterval(handler){poll=handler;return 1;},clearInterval(){},
    setTimeout(){return 1;},clearTimeout(){},AbortController,
    fetch:async()=>({ok:true,json:async()=>({
      running:false,generation:0,overwritten:0,missed:0,frames:[]
    })})
  };
  const source=require('node:fs').readFileSync(require.resolve('../web/dashboard.js'),'utf8');
  require('node:vm').runInNewContext(source.slice(source.indexOf('/* CAN trace UI:')),context);
  el('trace-marker').listeners.click();
  assert.match(el('trace-rows').innerHTML,/<strong>Markierung 1<\/strong>/);
  await poll();
  assert.match(el('trace-rows').innerHTML,/<strong>Markierung 1<\/strong>/);
});

test('CSV uses only validated numeric frame data and complete header', () => {
  const row=parseTraceFrame({seq:10,ms:200,id:0x23B,ext:false,rtr:false,data:'8D007F004600CD01'});
  const csv=traceCsv([row]);
  assert.match(csv,/Zeit_ms;Sequenz;CAN_ID;Format;RTR;Index;Daten_HEX/);
  assert.match(csv,/200;10;0x23B;Standard;Nein;0x008D;8D007F004600CD01/);
});

test('CSV preserves numbered markers as UTC comments even with no matching frames', () => {
  const markers=[{number:1,sequence:12,at:'2026-10-21T07:08:02.676Z'}];
  assert.equal(traceCsv([],markers),
    'Zeit_ms;Sequenz;CAN_ID;Format;RTR;Index;Daten_HEX\r\n'+
    '# Markierung 1 bei Sequenz 12 (2026-10-21T07:08:02.676Z)\r\n');
});


test('trace memory display distinguishes rolling ESP ring and browser capacity', () => {
  const storage=traceStorageState({espBuffered:1024,espCapacity:2048,browserUsed:15000,browserCapacity:30000,browserPruned:0});
  assert.equal(storage.espPercent,50);
  assert.equal(storage.browserPercent,50);
  assert.equal(storage.level,'normal');
  assert.equal(storage.message,'');
});

test('browser warns at 80% and urgently at 95%, before any frame is discarded', () => {
  const base={espBuffered:2048,espCapacity:2048,browserCapacity:30000,browserPruned:0};
  assert.equal(traceStorageState({...base,browserUsed:23999}).level,'normal');
  const warning=traceStorageState({...base,browserUsed:24000});
  assert.equal(warning.level,'warning');
  assert.match(warning.message,/CSV/);
  assert.equal(traceStorageState({...base,browserUsed:28499}).level,'warning');
  const urgent=traceStorageState({...base,browserUsed:28500});
  assert.equal(urgent.level,'critical');
  assert.match(urgent.message,/CSV/);
});

test('browser overflow warning survives rollover and counters stay bounded', () => {
  const state=traceStorageState({espBuffered:2050,espCapacity:2048,browserUsed:30010,browserCapacity:30000,browserPruned:15});
  assert.equal(state.espPercent,100);
  assert.equal(state.browserPercent,100);
  assert.equal(state.level,'overflow');
  assert.match(state.message,/15/);
});
