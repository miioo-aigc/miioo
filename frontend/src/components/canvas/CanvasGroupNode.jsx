/** 组合边框及组名；成员由画布库的父子节点机制渲染。 */
export default function CanvasGroupNode({ data, selected }) {
  return <div className="canvas-group" data-selected={selected}>
    <span className="canvas-group__name" title={data.label}>{data.label}</span>
  </div>;
}
