export default function CanvasFileInput({ inputRef, onChange }) {
  return <input ref={inputRef} type="file" accept=".json,.miioo" aria-label="导入画布文件" hidden onChange={onChange} />;
}
