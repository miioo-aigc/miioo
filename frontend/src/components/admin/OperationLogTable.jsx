import { Fragment, useState } from 'react';
import { ActionButton } from './adminShared';

const RESULT_STYLE = {
  success: 'text-text-success', failed: 'text-text-danger', partial: 'text-text-alert',
  cancelled: 'text-text-hint', running: 'text-text-accent', pending: 'text-text-hint',
};
const SOURCES = { task: '生成任务', user_audit: '审计记录', project_audit: '项目审计' };

export default function OperationLogTable({ items }) {
  const [expanded, setExpanded] = useState(null);
  return <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-font-size-14">
    <thead><tr className="border-b border-stroke-normal text-text-hint">{['时间', '操作者', '功能', '动作', '模型', '结果', '来源', '详情'].map((label) => <th key={label} className="px-[16px] py-[14px] font-normal">{label}</th>)}</tr></thead>
    <tbody>{items.map((item) => {
      const key = `${item.source}:${item.id}`;
      const opened = expanded === key;
      return <Fragment key={key}>
        <tr className="border-b border-stroke-normal align-top text-text-secondary">
          <td className="px-[16px] py-[14px] whitespace-nowrap">{item.createdAt || '未记录'}</td>
          <td className="px-[16px] py-[14px]"><div>{item.actor?.nickname || item.actor?.phone || '未记录'}</div><div className="text-font-size-12 text-text-hint">{item.actor?.phone}</div></td>
          <td className="px-[16px] py-[14px]">{item.featureLabel || '未记录'}</td>
          <td className="px-[16px] py-[14px]"><div>{item.actionLabel || '未记录'}</div>{item.errorMessage && <div title={item.errorMessage} className="max-w-[220px] truncate text-text-danger text-font-size-12">{item.errorMessage}</div>}</td>
          <td className="px-[16px] py-[14px] max-w-[220px] break-words">{item.model || '未记录'}</td>
          <td className={`px-[16px] py-[14px] ${RESULT_STYLE[item.result] || 'text-text-hint'}`}>{item.resultLabel || '未知'}</td>
          <td className="px-[16px] py-[14px]">{SOURCES[item.source] || '其他'}</td>
          <td className="px-[16px] py-[14px]"><ActionButton variant="secondary" onClick={() => setExpanded(opened ? null : key)}>{opened ? '收起' : '详情'}</ActionButton></td>
        </tr>
        {opened && <tr className="border-b border-stroke-normal bg-neutral-200"><td colSpan={8} className="p-[16px]">
          <dl className="grid gap-[12px] md:grid-cols-2 text-font-size-14">
            {[
              ['条目编号', item.id], ['目标类型', item.targetType], ['目标编号', item.targetId],
              ['所属项目', item.projectId], ['模型', item.model], ['供应商', item.provider], ['失败原因', item.errorMessage],
            ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-text-hint text-font-size-12">{label}</dt><dd className="text-text-primary break-all mt-[6px]">{value || '未记录'}</dd></div>)}
          </dl>
          {item.detail && <div className="mt-[16px]"><div className="text-text-hint text-font-size-12">附加信息</div><pre className="mt-[6px] whitespace-pre-wrap break-all text-text-secondary text-font-size-12">{JSON.stringify(item.detail, null, 2)}</pre></div>}
        </td></tr>}
      </Fragment>;
    })}</tbody>
  </table></div>;
}
