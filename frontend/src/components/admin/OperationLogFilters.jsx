import { ActionButton, FieldLabel, SelectInput, TextInput } from './adminShared';

export default function OperationLogFilters({ values, options, onChange, onSearch, onReset, loading }) {
  return <div className="grid gap-[16px] md:grid-cols-2 xl:grid-cols-4 mb-[20px]">
    <div><FieldLabel>用户（昵称 / 手机号）</FieldLabel><TextInput value={values.keyword} onChange={(value) => onChange('keyword', value)} placeholder="输入昵称或手机号" /></div>
    {[
      ['feature', '功能', 'features'], ['action', '动作', 'actions'], ['model', '模型', 'models'], ['result', '结果', 'results'],
    ].map(([key, label, optionKey]) => <div key={key}><FieldLabel>{label}</FieldLabel><SelectInput value={values[key]} onChange={(value) => onChange(key, value)} options={[{ value: '', label: `全部${label}` }, ...(options?.[optionKey] || [])]} /></div>)}
    {['start', 'end'].map((key) => <div key={key}><FieldLabel>{key === 'start' ? '起始时间' : '结束时间'}（北京时间）</FieldLabel><TextInput type="datetime-local" value={values[key]} onChange={(value) => onChange(key, value)} /></div>)}
    <div className="flex items-end gap-[12px]"><ActionButton onClick={onSearch} disabled={loading}>{loading ? '查询中...' : '查询'}</ActionButton><ActionButton variant="secondary" onClick={onReset}>重置</ActionButton></div>
  </div>;
}
