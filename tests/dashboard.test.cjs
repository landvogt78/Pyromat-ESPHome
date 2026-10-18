const test = require('node:test');
const assert = require('node:assert/strict');
const dashboard = require('../web/dashboard.js');

test('SSE states with current name-based IDs and legacy IDs reach the same sensor', () => {
  assert.equal(typeof dashboard.entityKey, 'function');
  assert.equal(dashboard.entityKey('sensor/Kesseltemperatur'), 'kesseltemperatur');
  assert.equal(dashboard.entityKey('sensor-kesseltemperatur'), 'kesseltemperatur');
  assert.equal(dashboard.entityKey('text_sensor/Kesseluhr'), 'kesseluhr');
});
test('missing, null, empty and unavailable numeric values never display as zero', () => {
  assert.equal(typeof dashboard.numeric, 'function');
  for (const value of [null, undefined, '', 'NaN', 'unknown', 'unavailable', '  ']) {
    assert.equal(dashboard.numeric(value), null);
  }
  assert.equal(dashboard.numeric('0'), 0);
  assert.equal(dashboard.numeric(47.8), 47.8);
});
test('stale CAN data marks otherwise recent temperature readings as stale', () => {
  assert.equal(typeof dashboard.reading, 'function');
  const model = {kesseltemperatur:{value:47.8, at:1000}, can_datenalter:{value:75, at:1000}};
  assert.deepEqual(dashboard.reading(model, 'kesseltemperatur', 1100), {value:47.8, stale:true});
  assert.deepEqual(dashboard.reading({}, 'kesseltemperatur', 1100), {value:null, stale:true});
});
test('old individual measurements stay stale while other CAN packets keep arriving', () => {
  const model = {kesseltemperatur:{value:47.8, at:1000}, can_datenalter:{value:0, at:70000}};
  assert.deepEqual(dashboard.reading(model, 'kesseltemperatur', 70000), {value:47.8, stale:true});
  model.kesseltemperatur.at=69000;
  assert.deepEqual(dashboard.reading(model, 'kesseltemperatur', 70000), {value:47.8, stale:false});
});
test('formatted unavailable readings use a dash, actual zero is retained', () => {
  assert.equal(typeof dashboard.format, 'function');
  assert.equal(dashboard.format(null, 1), '—');
  assert.equal(dashboard.format(0, 1), '0,0');
  assert.equal(dashboard.format(47.8, 1), '47,8');
});
test('unchanged event-driven diagnostics remain valid while their transport is fresh', () => {
  const model={ip_adresse:{value:'192.168.1.42',at:0}, can_empfang:{value:true,at:0}, can_datenalter:{value:1,at:70000}};
  assert.deepEqual(dashboard.eventReading(model,'ip_adresse',true,false,70000),{value:'192.168.1.42',stale:false});
  assert.deepEqual(dashboard.eventReading(model,'can_empfang',true,true,70000),{value:true,stale:false});
  assert.equal(dashboard.eventReading(model,'ip_adresse',false,false,70000).stale,true);
  model.can_datenalter.value=45;
  assert.equal(dashboard.eventReading(model,'can_empfang',true,true,70000).stale,true);
});
test('returning from the browser history cache reloads a stopped connection', () => {
  const listeners={};let stopped=0,reloaded=0;
  const page={addEventListener:(event,handler)=>{listeners[event]=handler;},location:{reload:()=>reloaded++}};
  dashboard.bindPageLifecycle(page,()=>stopped++);
  listeners.pagehide({persisted:true});
  assert.equal(stopped,1);
  listeners.pageshow({persisted:false});
  assert.equal(reloaded,0);
  listeners.pageshow({persisted:true});
  assert.equal(reloaded,1);
});
test('preview restart cannot send a command to the device', async () => {
  assert.equal(typeof dashboard.restartRequest, 'function');
  let requests=0;
  const result=await dashboard.restartRequest(true,async()=>{requests++;return new Response('');});
  assert.equal(result,'preview');
  assert.equal(requests,0);
});
test('restart uses the configured button name and reports HTTP failures', async () => {
  assert.equal(typeof dashboard.restartRequest, 'function');
  await assert.rejects(dashboard.restartRequest(false,async(url,options)=>{
    assert.equal(url,'/button/ESP%20neu%20starten/press');
    assert.equal(options.method,'POST');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response('',{status:503});
  }),/503/);
});
