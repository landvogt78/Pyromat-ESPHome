'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {parseTraceFrame, parseDryRunFrame, changedBytes, traceCsv} = require('../web/dashboard.js');

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

test('write preview only validates a bounded standard frame, never transmits', () => {
  assert.deepEqual(parseDryRunFrame('0x23B','8D 00 7F 00 46 00 CD 01'), {id:0x23B, hexId:'0x23B',data:'8D007F004600CD01'});
  assert.equal(parseDryRunFrame('0x800','00').error,'CAN-ID muss zwischen 0x000 und 0x7FF liegen.');
  assert.ok(parseDryRunFrame('0x23B','11 22 33 44 55 66 77 88 99').error);
  assert.ok(parseDryRunFrame('0x23B','XY').error);
  assert.ok(parseDryRunFrame('0x23B','123').error);
  assert.ok(parseDryRunFrame('','00').error);
});

test('changed bytes indicates only differing octets', () => {
  assert.deepEqual(changedBytes('AABBCC','AABBDD'),[2]);
  assert.deepEqual(changedBytes(null,'AABB'),[]);
  assert.deepEqual(changedBytes('AA','AABB'),[1]);
});

test('CSV uses only validated numeric frame data and complete header', () => {
  const row=parseTraceFrame({seq:10,ms:200,id:0x23B,ext:false,rtr:false,data:'8D007F004600CD01'});
  const csv=traceCsv([row]);
  assert.match(csv,/Zeit_ms;Sequenz;CAN_ID;Format;RTR;Index;Daten_HEX/);
  assert.match(csv,/200;10;0x23B;Standard;Nein;0x008D;8D007F004600CD01/);
});
