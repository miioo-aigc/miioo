import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCanvasLibraryProjects } from '../src/utils/CanvasLibraryProjects.js';
test('项目名称独立、同项目多画布合并、排除工作流及子画布', () => {
 const projects = [{id:'p',name:'新项目名',project_type:'canvas',created_at:'2026-01-01'},{id:'q',project_type:'canvas',created_at:'2026-02-01'},{id:'w',project_type:'video'}];
 const canvases = [{id:'a',project_id:'p',title:'画布甲'},{id:'b',project_id:'p',title:'画布乙'},{id:'c',project_id:'w'},{id:'d',project_id:'p',parent_canvas_id:'a'}];
 const collections = canvases.map(c=>({id:'col-'+c.id,bound_canvas_id:c.id,kind:'canvas',name:'旧名称'}));
 const result=groupCanvasLibraryProjects(projects,canvases,collections);
 assert.deepEqual(result.map(p=>p.id),['q','p']);
 assert.equal(result[1].name,'新项目名');
 assert.deepEqual(result[1].canvases.map(c=>[c.id,c.name]),[['col-a','画布甲'],['col-b','画布乙']]);
 assert.equal(result[0].canvases.length,0);
});

import { readFileSync } from 'node:fs';
test('树中跨项目切换画布原子更新项目与集合，非法编号不影响当前内容', () => {
 const source = readFileSync(new URL('../src/components/assets/UseCanvasLibraryProjects.js', import.meta.url), 'utf8');
 const start = source.indexOf('  const selectCanvas =');
 const end = source.indexOf('  return { ...state', start);
 let state = { owner: 'u', selectedId: 'p', collectionId: 'a', items: [{id:'p',canvases:[{id:'a'}]},{id:'q',canvases:[{id:'b'}]}] };
 const saved=[];
 const select = new Function('state','saveCollectionMemory','setState',source.slice(start,end)+'; return selectCanvas;')(state,(...args)=>saved.push(args),update=>{state=update(state);});
 select('b');
 assert.equal(state.selectedId,'q');
 assert.equal(state.collectionId,'b');
 assert.deepEqual(saved,[['u','b']]);
 select('unknown');
 assert.equal(state.collectionId,'b');
 assert.equal(saved.length,1);
});
