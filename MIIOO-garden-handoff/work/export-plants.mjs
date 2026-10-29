import {createPlant} from "../outputs/interactive-garden/plant-models.js";
import {readFile,mkdir,writeFile} from "node:fs/promises";
const directory=new URL("../outputs/interactive-garden/models/",import.meta.url);
await mkdir(directory,{recursive:true});
const specs=JSON.parse(await readFile(new URL("../outputs/interactive-garden/assets/plants.json",import.meta.url)));
for(const [i,spec] of specs.entries()){
 const plant=createPlant(spec,i);let vertices=0,meshes=0;
 plant.traverse(obj=>{if(!obj.geometry)return;meshes++;const a=obj.geometry.attributes.position;vertices+=a.count;for(const v of a.array)if(!Number.isFinite(v))throw Error(spec.name+": invalid vertex");obj.geometry.computeBoundingBox();const size=obj.geometry.boundingBox; if(size.max.z-size.min.z<.1)throw Error(spec.name+": flat geometry");});
 plant.traverse(obj=>{
  if(!obj.geometry||!obj.material.map)return;
  const uv=obj.geometry.attributes.uv;
  if(!uv||uv.count!==obj.geometry.attributes.position.count)throw Error(spec.name+": missing surface coordinates");
  for(const v of uv.array)if(!Number.isFinite(v)||v<0||v>1)throw Error(spec.name+": invalid surface coordinate");
  if(Math.max(...uv.array.slice(0,1000))===0)throw Error(spec.name+": degenerate surface coordinates");
 });
 await writeFile(new URL(spec.name+".three.json",directory),JSON.stringify(plant.toJSON()));
 console.log(spec.name,meshes,"geometry groups",vertices,"finite vertices; volumetric bounds verified");
}
