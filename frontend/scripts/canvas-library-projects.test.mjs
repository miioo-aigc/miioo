import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCanvasLibraryProjects, removeCanvasLibraryCollection, removeCanvasLibraryProject } from '../src/utils/CanvasLibraryProjects.js';
test('集合为权威，画布过滤不隐藏已返回集合', () => {
 const projects = [{id:'p',name:'新项目名',project_type:'canvas',created_at:'2026-01-01'},{id:'q',project_type:'canvas',created_at:'2026-02-01'},{id:'w',project_type:'video'}];
 const canvases = [{id:'a',project_id:'p',title:'画布甲'},{id:'b',project_id:'p',title:'画布乙'},{id:'c',project_id:'w'},{id:'d',project_id:'p',parent_canvas_id:'a'}];
 const collections = canvases.map(c=>({id:'col-'+c.id,bound_canvas_id:c.id,kind:'canvas',name:'旧名称'}));
 const result=groupCanvasLibraryProjects(projects,canvases,collections);
 assert.deepEqual(result.map(p=>p.id),['q','p','w']);
 assert.equal(result[1].name,'新项目名');
 assert.deepEqual(result[1].canvases.map(c=>[c.id,c.name]),[['col-a','旧名称'],['col-b','旧名称'],['col-d','旧名称']]);
 assert.equal(result[0].canvases.length,0);
});

import { readFileSync } from 'node:fs';
test('树中跨项目切换画布原子更新项目与集合，非法编号不影响当前内容', () => {
 const source = readFileSync(new URL('../src/components/assets/UseCanvasLibraryProjects.js', import.meta.url), 'utf8');
 const start = source.indexOf('  const selectCanvas =');
 const end = source.indexOf('  const forgetProject =', start);
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

test('删除当前项目会同步清空失效画布，删除其他项目保留当前选择', () => {
 const first = { id: 'p1', canvases: [{ id: 'c1' }] };
 const second = { id: 'p2', canvases: [{ id: 'c2' }] };
 const state = { items: [first, second], selectedId: first.id, collectionId: 'c1', loading: false, error: '', owner: 'u' };
 const next = removeCanvasLibraryProject(state, first.id);
 assert.deepEqual(next.items, [second]);
 assert.equal(next.selectedId, second.id);
 assert.equal(next.collectionId, 'c2');
 const preserved = removeCanvasLibraryProject(next, first.id);
 assert.equal(preserved.selectedId, second.id);
 assert.equal(preserved.collectionId, 'c2');
 const empty = removeCanvasLibraryProject(next, second.id);
 assert.equal(empty.selectedId, null);
 assert.equal(empty.collectionId, null);
});

test('删除当前集合时优先切换同项目下一画布，空项目再回退到其他项目', () => {
 const first = { id: 'p1', canvases: [{ id: 'c1' }, { id: 'c2' }] };
 const second = { id: 'p2', canvases: [{ id: 'c3' }] };
 const state = { items: [first, second], selectedId: first.id, collectionId: 'c1', loading: false, error: '', owner: 'u' };

 const nextCanvas = removeCanvasLibraryCollection(state, 'c1');
 assert.deepEqual(nextCanvas.items[0].canvases, [{ id: 'c2' }]);
 assert.equal(nextCanvas.selectedId, 'p1');
 assert.equal(nextCanvas.collectionId, 'c2');

 const nextProject = removeCanvasLibraryCollection(nextCanvas, 'c2');
 assert.deepEqual(nextProject.items, [second]);
 assert.equal(nextProject.selectedId, 'p2');
 assert.equal(nextProject.collectionId, 'c3');

 const empty = removeCanvasLibraryCollection(nextProject, 'c3');
 assert.deepEqual(empty.items, []);
 assert.equal(empty.selectedId, null);
 assert.equal(empty.collectionId, null);
});

test('删除非当前集合并保留当前内容，重复通知不改变状态', () => {
 const state = {
  items: [
   { id: 'p1', canvases: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] },
   { id: 'p2', canvases: [{ id: 'c4' }] },
  ],
  selectedId: 'p1',
  collectionId: 'c3',
  loading: false,
  error: '',
  owner: 'u',
 };
 const next = removeCanvasLibraryCollection(state, 'c1');
 assert.deepEqual(next.items[0].canvases, [{ id: 'c2' }, { id: 'c3' }]);
 assert.equal(next.selectedId, 'p1');
 assert.equal(next.collectionId, 'c3');
 assert.equal(removeCanvasLibraryCollection(next, 'c1'), next);
});

test('集合失效会通知外层丢弃旧集合，并在切换选择后保存新集合', () => {
 const hook = readFileSync(new URL('../src/components/assets/UseCanvasLibraryProjects.js', import.meta.url), 'utf8');
 const reader = readFileSync(new URL('../src/components/assets/UseCanvasAssetLibrary.js', import.meta.url), 'utf8');
 const contents = readFileSync(new URL('../src/components/assets/CanvasLibraryContents.jsx', import.meta.url), 'utf8');
 assert.match(hook, /const forgetCollection = useCallback/);
 assert.match(hook, /removeCanvasLibraryCollection\(old, collectionId\)/);
 assert.match(hook, /saveCollectionMemory\(next\.owner, next\.collectionId\)/);
 assert.match(reader, /cause\.code === 'COLLECTION_NOT_FOUND'/);
 assert.match(reader, /onCollectionUnavailable\?\.\(collection\.id\)/);
 assert.match(contents, /useCanvasAssetLibrary\(collection, onCollectionUnavailable\)/);
});

test('共享集合与旧集合共存，缺失来源保留入口', () => {
 const shared = {id:'s',kind:'canvas',source_project_id:'p',bound_canvas_id:null,root_folder_id:'r'};
 const groups = groupCanvasLibraryProjects([], [], [shared, shared, {id:'old',kind:'canvas',source_project_id:'p',bound_canvas_id:'unknown'}, {id:'orphan',kind:'canvas'}]);
 assert.deepEqual(groups.find(x=>x.id==='p').canvases.map(x=>x.id), ['s','old']);
 assert.equal(groups.find(x=>x.id==='p').canvases[0].root_folder_id,'r');
 assert.equal(groups.find(x=>x.id==='standalone:orphan').projectId,null);
});
