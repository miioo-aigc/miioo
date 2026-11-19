import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { canvasLibraryVisiblePage } from '../src/api/CanvasLibraryPresetFolders.js';
import { groupCanvasLibraryProjects } from '../src/utils/CanvasLibraryProjects.js';

const read = (path) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
function library(responses) {
  const calls = [];
  const source = read('api/CanvasAssetLibrary.js').replace(/^import .*;\n/gm, '')
    .replaceAll('import.meta.env.DEV', 'false').replaceAll('import.meta.env.VITE_CANVAS_ASSET_LIBRARY_MOCK', '"false"')
    .replaceAll('import.meta.env.VITE_API_BASE_URL', '""').replaceAll('export ', '');
  const api = runInNewContext(source + '\ncanvasAssetLibrary', {
    URLSearchParams, canvasLibraryVisiblePage,
    authFetch: async (url, options) => { calls.push({ url, options }); const next = responses.shift(); return new Response(JSON.stringify(next.body ?? next), {status: next.status || 200}); },
    withCanvasFolderCounts: async page => page,
  });
  return {api, calls};
}

test('真实目录响应拆包，面包屑与权限保留；不把包装对象当目录', async () => {
  const {api} = library([{folder:{id:'child',name:'子目录',revision:2},ancestors:[{id:'root'}],permissions:{read:true},revision:3,depth:1}]);
  const folder = await api.folder('child');
  assert.equal(folder.id,'child'); assert.equal(folder.revision,3);
  assert.equal(folder.ancestors[0].id,'root'); assert.equal(folder.permissions.read,true);
});

test('目录空页继续取游标，保留旧分类与无url音频，映射稳定资产编号', async () => {
  const {api,calls} = library([{items:[],next_cursor:'next'},{items:[{type:'folder',id:'old',category_key:'audio'},{type:'entry',id:'entry',asset:{id:'asset',media_type:'audio',preview_url:'/audio'}}],next_cursor:null}]);
  const page=await api.list({collection_id:'collection',parent_id:'root'},undefined,{includeCounts:false});
  assert.equal(page.items.length,2); assert.equal(page.items[1].asset_id,'asset');
  assert.match(calls[1].url,/cursor=next/); assert.match(calls[1].url,/parent_id=root/);
});

test('重复游标报错，集合错误保留嵌套业务码，非法集合不伪装为空', async () => {
  const {api}=library([{items:[],next_cursor:'same'},{items:[],next_cursor:'same'}]);
  await assert.rejects(api.list({collection_id:'c',parent_id:'r'}),/游标重复/);
  const denied=library([{status:403,body:{detail:{code:'PERMISSION_DENIED',message:'无权'}}}]);
  await assert.rejects(denied.api.canvasCollections(),{code:'PERMISSION_DENIED',status:403});
  await assert.rejects(library([{items:[{id:'bad'}]}]).api.canvasCollections(),/格式异常/);
});

test('集合完整分页独立于元数据失败，200不是总量上限', async () => {
  const source=read('api/CanvasLibraryProjects.js').replace(/^import .*;\n/gm,'').replaceAll('export ','');
  const cursors=[];
  const api=runInNewContext(source+'\napiReadCanvasLibraryProjects',{
    invalidate:()=>{}, K:{projectsPrefix:()=>''}, groupCanvasLibraryProjects,
    apiListCanvasProjects:async()=>{throw new Error('network');},
    apiListCanvasDocuments:async()=>({items:[],total:0}),
    canvasAssetLibrary:{canvasCollections:async({cursor})=>{cursors.push(cursor); return cursor ? {items:[{id:'old',kind:'canvas',source_project_id:'p'}]} : {items:[{id:'shared',kind:'canvas',source_project_id:'p',bound_canvas_id:null}],next_cursor:'next'};}},
  });
  const result=await api();
  assert.deepEqual(cursors,[undefined,'next']); assert.ok(result.warning);
  assert.deepEqual(result.items[0].canvases.map(x=>x.id),['shared','old']);
});

test('共享目录兼容无detail与画布通知，项目不匹配跳过，卸载清理监听', () => {
  const source=read('components/assets/UseCanvasAssetLibrary.js');
  const start=source.indexOf("    if (typeof window === 'undefined'");
  const end=source.indexOf('  }, [collection.bound_canvas_id',start);
  const listeners=new Map(); const timers=new Map(); let next=0, refreshed=0;
  const context={collection:{source_project_id:'p',bound_canvas_id:null}, CANVAS_ASSETS_CHANGED_EVENT:'canvas-assets-changed',
    window:{addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)},
    document:{visibilityState:'visible',addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)},
    setTimeout:fn=>{timers.set(++next,fn);return next;}, clearTimeout:id=>timers.delete(id), setEpoch:()=>refreshed++};
  const cleanup=runInNewContext('(function(){'+source.slice(start,end)+'})()',context);
  const flush=()=>{for(const fn of timers.values()) fn();timers.clear();};
  listeners.get('canvas-assets-changed')({}); flush();
  listeners.get('canvas-assets-changed')({detail:{canvasId:'other-canvas'}}); flush();
  listeners.get('canvas-assets-changed')({detail:{projectId:'p'}}); flush();
  assert.equal(refreshed,3);
  listeners.get('canvas-assets-changed')({detail:{projectId:'different'}}); flush(); assert.equal(refreshed,3);
  listeners.get('focus')(); listeners.get('focus')(); flush(); assert.equal(refreshed,4);
  cleanup(); assert.equal(listeners.size,0);assert.equal(timers.size,0);
});
