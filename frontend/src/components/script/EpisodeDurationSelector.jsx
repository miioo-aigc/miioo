/**
 * @file EpisodeDurationSelector.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   基于 Select 的单集时长自动适应/手动输入选择
 *
 * ─── 数据约定 ───────────────────────────────────────────────────────
 *   null 表示自动适应，正数表示手动输入的秒数
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-21  将单集时长改为与集数一致的自定义下拉菜单
 */
import { useState } from 'react';
import { Button, Select } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi 2.0',system-ui,sans-serif";

function EpisodeDurationSelector({ value, onChange, disabled = false }) {
  const [inputVal, setInputVal] = useState(typeof value === 'number' ? value : 60);
  const label = value == null ? '单集：自动适应' : `单集：${value}s`;

  const handleAutoSelect = (close) => {
    onChange?.(null);
    close();
  };

  const handleManualSelect = (close) => {
    const next = Number.parseInt(inputVal, 10);
    const duration = Number.isInteger(next) && next > 0 ? next : 60;
    setInputVal(duration);
    onChange?.(duration);
    close();
  };

  const adjustDuration = (delta) => {
    const base = typeof inputVal === 'number' ? inputVal : 60;
    const next = Math.max(1, base + delta);
    setInputVal(next);
    onChange?.(next);
  };

  const handleInputChange = (event) => {
    const raw = event.target.value;
    if (raw === '') {
      setInputVal('');
      return;
    }

    const next = Number.parseInt(raw, 10);
    if (Number.isInteger(next) && next > 0) {
      setInputVal(next);
      onChange?.(next);
    }
  };

  const handleInputBlur = () => {
    const next = Number.parseInt(inputVal, 10);
    if (!Number.isInteger(next) || next < 1) {
      setInputVal(60);
      onChange?.(60);
    }
  };

  return (
    <Select
      value={value}
      displayValue={label}
      options={[{ value: '__custom_episode_duration__', label }]}
      width="160px"
      menuPlacement="up"
      disabled={disabled}
      menuContent={({ close }) => (
        <>
          <Button
            variant="secondary"
            type="button"
            onClick={() => handleAutoSelect(close)}
            className={`!h-auto !w-full !justify-start !rounded-md !border-0 !px-[12px] !py-[8px] !shadow-none !text-left ${
              value == null
                ? '!bg-select-item-bg-active !text-select-item-text-active'
                : '!bg-select-item-bg-normal !text-select-item-text-normal hover:!bg-select-item-bg-hover hover:!text-select-item-text-hover'
            }`}
            contentClassName="!w-auto !justify-start !text-left !text-font-size-14"
            style={{ fontFamily: FONT, outline: 'none' }}
          >
            单集：自动适应
          </Button>

          <div
            className={`flex items-center px-[12px] py-[8px] rounded-md gap-[8px] ${
              value != null
                ? 'bg-select-item-bg-active'
                : 'bg-select-item-bg-normal hover:bg-select-item-bg-hover'
            }`}
            role="option"
            aria-selected={value != null}
            onClick={() => handleManualSelect(close)}
          >
            <Button
              variant="secondary"
              size="small"
              type="button"
              aria-label="减少单集时长"
              onClick={(event) => { event.stopPropagation(); adjustDuration(-1); }}
              className="!h-[24px] !w-[20px] !rounded-[4px] !border-0 !bg-transparent !p-0 !shadow-none !text-select-item-text-normal hover:!bg-white-8 hover:!text-white"
              contentClassName="!text-[16px]"
              style={{ outline: 'none' }}
            >
              −
            </Button>
            <input
              aria-label="单集时长，单位秒"
              type="number"
              min="1"
              value={inputVal}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onClick={(event) => {
                event.stopPropagation();
                if (value == null) {
                  const next = Number.parseInt(inputVal, 10);
                  const duration = Number.isInteger(next) && next > 0 ? next : 60;
                  setInputVal(duration);
                  onChange?.(duration);
                }
              }}
              className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none text-select-item-text-normal bg-white-5 border border-stroke-normal rounded-[4px] text-center outline-none text-font-size-14 flex-1 min-w-0"
              style={{ height: '28px', fontFamily: FONT, MozAppearance: 'textfield' }}
            />
            <Button
              variant="secondary"
              size="small"
              type="button"
              aria-label="增加单集时长"
              onClick={(event) => { event.stopPropagation(); adjustDuration(1); }}
              className="!h-[24px] !w-[20px] !rounded-[4px] !border-0 !bg-transparent !p-0 !shadow-none !text-select-item-text-normal hover:!bg-white-8 hover:!text-white"
              contentClassName="!text-[16px]"
              style={{ outline: 'none' }}
            >
              +
            </Button>
          </div>
        </>
      )}
    />
  );
}

export default EpisodeDurationSelector;
