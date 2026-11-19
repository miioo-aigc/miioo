import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { syncCanvasTextEdits } from '../src/components/canvas/CanvasTextEdits.js';
import { createCanvasAutosave } from '../src/components/canvas/CanvasAutosave.js';
import { createCanvasSaveSession } from '../src/components/canvas/CanvasSaveSession.js';

globalThis.crypto ||= webcrypto;
const batch = (id, content) => ({id,source:'edit',submitted_at:'2026-11-19T00:00:00Z',completed_at:'2026-11-19T00:00:01Z',sequence:1,request_count:1,results:[{id:id+'-r',index:0,type:'text',assetId:null,content}],task_ids:[],input_snapshot:{}});
function setup() {
 let page={items:[batch('server','old')],current_result_id:'server-r',output_version:1,revision:379,next_cursor:null};
 let node={id:'text',type:'text',data:{content:'new',outputVersion:1,nodeResults:{currentResultId:'local-r'}}};
 const operations=new Map(), calls=[], accepted=[];
 const api={apiGetCanvasTextBatches:async()=>structuredClone(page),apiAppendCanvasTextBatch:async(_,__,body)=>{
  calls.push(body); assert.equal(body.expected_version,page.output_version);
  page={...page,items:[...page.items,{...batch(body.batch_id,body.results[0].content),results:body.results}],current_result_id:body.results[0].id,output_version:2,revision:380};
  return {revision:380};
 }};
 const args={canvasId:'c',nodes:[node],api,operations,accept:n=>accepted.push(n),check:()=>{},apply:(_,synced)=>{node=synced;}};
 return {args,calls,accepted,getNode:()=>node,getPage:()=>page,setPage:p=>{page=p;}};
}
test('编辑先追加服务端历史再PATCH，节点版本和画布版本分别更新',async()=>{
 const x=setup(); const patched=[];
 const session=createCanvasSaveSession(async(_,body)=>{patched.push(body);return {revision:381};},()=> 'save');
 await session.mutate(accept=>syncCanvasTextEdits({...x.args,accept}));
 await session.save('c',379,{node:x.getNode()});
 assert.equal(x.calls.length,1);assert.equal(x.calls[0].source,'edit');assert.equal(x.calls[0].expected_version,1);
 assert.equal(x.getNode().data.outputVersion,2);assert.equal(patched[0].baseRevision,380);
 assert.equal(x.getNode().data.content,'new');assert.equal(x.args.operations.size,0);
});
test('服务端已变化时保留草稿，不追加或覆盖远端结果',async()=>{
 const x=setup();x.setPage({...x.getPage(),output_version:2});
 await assert.rejects(syncCanvasTextEdits(x.args),{status:409,code:'CANVAS_NODE_RESULT_CONFLICT'});
 assert.equal(x.calls.length,0);assert.equal(x.getNode().data.content,'new');
});
test('追加成功但响应丢失，重读确认同一batch，不产生重复编辑',async()=>{
 const x=setup(), append=x.args.api.apiAppendCanvasTextBatch;
 x.args.api.apiAppendCanvasTextBatch=async(...args)=>{await append(...args);throw new Error('network');};
 await assert.rejects(syncCanvasTextEdits(x.args),/network/);
 await syncCanvasTextEdits(x.args);
 assert.equal(x.calls.length,1);assert.equal(x.getNode().data.outputVersion,2);assert.equal(x.args.operations.size,0);
});
test('同步后的节点无需再追加，取消会话不回写',async()=>{
 const x=setup();await syncCanvasTextEdits(x.args);await syncCanvasTextEdits({...x.args,nodes:[x.getNode()]});assert.equal(x.calls.length,1);
 const y=setup(); y.args.check=()=>{throw new Error('ended');};await assert.rejects(syncCanvasTextEdits(y.args),/ended/);assert.equal(y.calls.length,0);
});
test('409后普通重渲染和继续输入均不自动重试，仍保留脏状态',async()=>{
 const jobs=new Map();let id=0,calls=0;
 const saver=createCanvasAutosave({schedule:fn=>{jobs.set(++id,fn);return id;},cancel:id=>jobs.delete(id)});
 const save=async()=>{calls++;throw Object.assign(new Error('conflict'),{status:409});};
 saver.update('old',true,save);saver.update('edit',true,save);
 await assert.rejects(saver.flush(),/conflict/);
 saver.update('edit',true,save);saver.update('next',true,save);
 assert.equal(jobs.size,0);assert.equal(calls,1);assert.equal(saver.dirty(),true);saver.dispose();
});

test('PATCH丢响应先恢复原请求，再允许文本历史变更',async()=>{
 const calls=[];let fail=true;
 const session=createCanvasSaveSession(async(_,body)=>{calls.push(body);if(fail){fail=false;throw new Error('network');}return {revision:10};},()=> 'same');
 await assert.rejects(session.save('c',1,{draft:true}),/network/);
 await session.recover();await session.mutate(accept=>accept(11));await session.save('c',1,{draft:'next'});
 assert.deepEqual(calls[0],calls[1]);assert.equal(calls[2].baseRevision,11);
});
test('普通历史读取不推进画布基线，避免掩盖其他文档修改',async()=>{
 const x=setup();await syncCanvasTextEdits(x.args);x.accepted.length=0;
 await syncCanvasTextEdits({...x.args,nodes:[x.getNode()]});assert.deepEqual(x.accepted,[]);
});
