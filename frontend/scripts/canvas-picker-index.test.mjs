import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sortCanvasPickerProjects } from '../src/components/assets/CanvasPickerAssets.js';

const source=readFileSync(new URL('../src/components/assets/CanvasAssetPickerPanel.jsx',import.meta.url),'utf8');
async function load(result,{projectId=null,canvasId=null,current=true}={}) {
 const start=source.indexOf('    apiReadCanvasLibraryProjects(');
 const end=source.indexOf('    return () => controller.abort();',start);
 let state,project,canvas;
 const deps={apiReadCanvasLibraryProjects:async()=>result,current:()=>current,controller:new AbortController(),
  sortCanvasPickerProjects,projectId,canvasId,setState:value=>{state=value;},setProjectId:id=>{project=id;},setCanvasId:id=>{canvas=id;}};
 new Function(...Object.keys(deps),source.slice(start,end))(...Object.values(deps));
 for(let i=0;i<6;i++) await Promise.resolve();
 return {state,project,canvas};
}
const items=[{id:'empty',name:'空项目',created_at:'2026-11-19',canvases:[]},{id:'p',name:'项目',created_at:'2026-11-18',canvases:[{id:'shared',displayName:'项目共享资产',root_folder_id:'root'}]}];
test('实际弹窗接收items/warning对象，跳过空项目选中共享集合',async()=>{
 const result=await load({items,warning:''});
 assert.equal(result.state.error,'');assert.equal(result.project,'p');assert.equal(result.canvas,'shared');
 assert.equal(result.state.items[1].canvases[0].root_folder_id,'root');
});
test('元数据降级仍展示集合和提示，重试保留有效集合',async()=>{
 const result=await load({items,warning:'部分元数据失败'},{projectId:'p',canvasId:'shared'});
 assert.equal(result.state.warning,'部分元数据失败');assert.equal(result.canvas,'shared');
});
test('空列表正常返回，过期请求不回写',async()=>{
 const empty=await load({items:[],warning:''});assert.equal(empty.state.error,'');assert.equal(empty.canvas,null);
 const stale=await load({items,warning:''},{current:false});assert.equal(stale.state,undefined);
});
