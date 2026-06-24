 import { useState, useRef } from 'react';
 import ParamTrigger from './ParamTrigger';
 import EditableText from './EditableText';
 
 const PARAM_LABELS = {
   framing: '景别',
   cameraMotion: '运镜',
   angle: '拍摄角度',
   composition: '构图',
   duration: '时长',
 };
 
 function DescriptionCol({ shot, onChange }) {
   const [activeParam, setActiveParam] = useState(null);
   const triggerRefs = useRef({});
 
   function updateParam(field, val) {
     onChange({ ...shot, params: { ...shot.params, [field]: val } });
   }
 
   return (
     <div style={{
       flex: 1,
       minWidth: '300px',
       display: 'flex',
       flexDirection: 'column',
       gap: '8px',
       padding: '12px',
       paddingBottom: '8px',
       borderRight: '1px solid rgba(255,255,255,0.08)',
       overflow: 'hidden',
       alignSelf: 'stretch',
     }}>
       <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', flexShrink: 0 }}>
         画面描述
       </span>
       <EditableText
         value={shot.description}
         onChange={(v) => onChange({ ...shot, description: v })}
         placeholder="描述画面内容…"
       />
       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flexShrink: 0, marginTop: 'auto' }}>
         {Object.entries(PARAM_LABELS).map(([field, label]) => (
           <ParamTrigger
             key={field}
             field={field}
             label={label}
             value={shot.params[field]}
             isActive={activeParam === field}
             triggerRefs={triggerRefs}
             onToggle={() => setActiveParam(activeParam === field ? null : field)}
             onClose={() => setActiveParam(null)}
             onUpdate={(v) => updateParam(field, v)}
           />
         ))}
       </div>
     </div>
   );
 }
 
 export default DescriptionCol;
