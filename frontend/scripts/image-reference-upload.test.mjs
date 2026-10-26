import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { assertImageReferenceUrls, buildImageReferences, getImageReferenceUrl, resolveImageReference } from '../src/api/ImageReferences.js';
const id = '11111111-1111-4111-8111-111111111111';
const uploaded = { uploaded_url: '/uploads/original.png', asset_id: id };

test('真实资产只提交身份，临时预览不会发送；原图优先', async () => {
 const result = await buildImageReferences([{ asset_id: id, url: 'blob:preview' }], { upload() { throw Error('不应上传'); } });
 assert.deepEqual(result, { reference_images: [], attachments: [{asset_id:id,asset_type:'image',role:'reference'}] });
 assert.equal(getImageReferenceUrl({original_url:'/original.png',url:'/thumb.png'}),'/original.png');
});
test('本地文件和临时地址先上传并保留绑定；同图去重', async () => {
 let uploads = 0;
 const options = { upload: async (file) => { assert.ok(file instanceof File); uploads++; return uploaded; }, fetchLocal: async () => new Response(new Blob(['png'],{type:'image/png'})) };
 const result = await buildImageReferences([{url:'blob:one'},{url:'blob:one'}],options);
 assert.equal(uploads,1); assert.deepEqual(result.reference_images,['/uploads/original.png']); assert.equal(result.attachments[0].asset_id,id);
 await resolveImageReference(new File(['x'],'x.png',{type:'image/png'}),options);
 assert.equal(uploads,2);
});
test('失败、无资产编号、无地址、本地伪地址、上传中均拒绝', async () => {
 for (const ref of [{url:'file:/a'}, {url:'filesystem:a'}, {url:'local-a'}, {}, {url:'blob:x',uploadStatus:'uploading'}, {url:'blob:x',uploadStatus:'error'}]) {
  await assert.rejects(resolveImageReference(ref,{upload:async()=>uploaded}));
 }
 for (const result of [{}, {uploaded_url:'/uploads/x'}, {asset_id:id,uploaded_url:'blob:x'}]) {
  await assert.rejects(resolveImageReference(new File(['x'],'x.png'),{upload:async()=>result}));
 }
 await assert.rejects(resolveImageReference(new File(['x'],'x.png'),{upload:async()=>{throw Error('上传失败');}}),/上传失败/);
});
test('多图顺序、去重和取消',async()=>{
 const result=await buildImageReferences([{url:'/a.png'},{url:'/b.png'},{url:'/a.png'}],{});
 assert.deepEqual(result.reference_images,['/a.png','/b.png']);
 const controller=new AbortController(); controller.abort();
 await assert.rejects(resolveImageReference({url:'/a.png'},{signal:controller.signal}),{name:'AbortError'});
});
test('接口防线拒绝临时地址，主体兼容真实资产编号',()=>{
 for (const url of ['blob:x','data:image/png,x','file:/x','filesystem:x','local-x','local_x','//host/x','']) assert.throws(()=>assertImageReferenceUrls([url]));
 assertImageReferenceUrls(['/uploads/x','https://cdn.test/x']);
 assertImageReferenceUrls([id],{allowAssetIds:true});
});
const apiSource=readFileSync(new URL('../src/api/creation.js',import.meta.url),'utf8').replace(/^import .*;$/mg,'').replace(/export /g,'').replaceAll('import.meta.env.VITE_API_BASE_URL',JSON.stringify('https://test.invalid'));
function loadApi(fetcher) {
 return runInNewContext(apiSource+String.fromCharCode(10)+'({apiGenerateCreation})',{authFetch:fetcher,File,Blob,FormData,URLSearchParams,URL,setTimeout,clearTimeout,console,buildImageReferences,assertImageReferenceUrls,throwResponseError:async()=>{throw Error('上传失败');}});
}
test('公共生成实际请求：上传失败不得创建任务',async()=>{
 const calls=[];
 const api=loadApi(async(url)=>{calls.push(url);return Response.json({}, {status:500});});
 await assert.rejects(api.apiGenerateCreation({genType:'image',files:[new File(['x'],'x.png')]}),/上传失败/);
 assert.equal(calls.length,1);assert.ok(calls[0].includes('images/upload'));
});
test('公共生成实际请求：真实资产绑定、原图地址和数量',async()=>{
 let body;
 const api=loadApi(async(url,options)=>{body=JSON.parse(options.body); throw Error('捕获生成请求');});
 await assert.rejects(api.apiGenerateCreation({genType:'image',count:4,files:[{asset_id:id,url:'blob:local'},{url:'/thumb.png',originalUrl:'/original.png'}]}),/捕获生成请求/);
 assert.deepEqual(body.reference_images,['/original.png']);assert.equal(body.attachments[0].asset_id,id);assert.equal(body.count,4);assert.equal(body.generation_mode,'reference_image');
});

test('分镜和主体接口在网络请求前拒绝本地地址', async () => {
 for (const [path, name, start] of [
  ['storyboard.js','apiGenerateStoryboardImage','export async function apiGenerateStoryboardImage'],
  ['subject.js','apiGenerateSubjectImage','export async function apiGenerateSubjectImage'],
 ]) {
  const source=readFileSync(new URL('../src/api/'+path,import.meta.url),'utf8');
  const offset=source.indexOf(start);
  const end=source.indexOf('\nexport ',offset+1);
  const body=source.slice(offset,end<0?undefined:end).replace(/^export /,'');
  let calls=0;
  const fn=runInNewContext(body+'\n'+name,{assertImageReferenceUrls, normalizeStoryboardImageSize:v=>v, BASE:'https://test.invalid',authFetch:async()=>{calls++;throw Error('网络已调用');}});
  await assert.rejects(fn('project','item',{reference_images:['blob:local']}),/参考图/);
  assert.equal(calls,0);
  await assert.rejects(fn('project','item',{reference_images:['/uploads/a.png']}),/网络已调用/);
  assert.equal(calls,1);
 }
});

test('图片多任务轮询保留资产编号与空位，不混用创作记录编号',async()=>{
 const api=loadApi(async(url)=>{
  if(url.endsWith('/images/generate')) return Response.json({task_ids:['first','second']});
  return Response.json({status:'completed',images:url.endsWith('/first')
   ? [{id:'record1',asset_id:id,original_url:'/one'},{id:'record2',original_url:'/two'}]
   : [{id:'record3',assetId:'22222222-2222-4222-8222-222222222222',original_url:'/three'}]});
 });
 const result=await api.apiGenerateCreation({genType:'image',count:3});
 assert.deepEqual(Array.from(result.imageAssetIds),[id,null,'22222222-2222-4222-8222-222222222222']);
 assert.deepEqual(Array.from(result.cardIds),['record1','record2','record3']);
 assert.deepEqual(Array.from(result.imageOriginalUrls),['/one','/two','/three']);
});
