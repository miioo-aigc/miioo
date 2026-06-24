import { useState } from 'react'

const FONT = "'Alibaba PuHuiTi 2.0', system-ui, sans-serif"

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon({ color = '#FFFFFF' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 6.333L8 10.333L4 6.333H12Z" fill={color} stroke={color} strokeWidth="1.333" strokeLinejoin="round" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.5" stroke="#F75F5F" strokeWidth="1.5" />
      <path d="M8 5v4M8 10.5v.5" stroke="#F75F5F" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Suffix: inline button ────────────────────────────────────────────────────

function InlineBtn({ label, disabled }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 24, flexShrink: 0,
      borderRadius: 6, padding: '0 8px',
      backgroundColor: '#161616',
      border: disabled ? 'none' : '1px solid rgba(255,255,255,0.05)',
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      boxShadow: disabled ? 'none' : '3px 3px 8px rgba(0,0,0,0.40)',
      cursor: disabled ? 'default' : 'pointer',
      fontFamily: FONT,
    }}>
      <span style={{ fontSize: 12, color: disabled ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.60)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  )
}

// ─── Suffix: char count ───────────────────────────────────────────────────────

function CharCount({ current, max }) {
  return (
    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: FONT }}>
      {current}/{max}
    </span>
  )
}

// ─── Core Input (interactive — real focus/hover via CSS + React state) ────────

function Input({ placeholder = '请输入内容', value: initValue = '', suffix, disabled = false, wrong = false }) {
  const [value, setValue] = useState(initValue)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)

  const getBorder = () => {
    if (disabled) return 'none'
    if (wrong) return '1px solid #F75F5F'
    if (focused) return '1px solid rgba(45,195,225,0.60)'
    if (hovered) return '1px solid rgba(255,255,255,0.20)'
    return '1px solid rgba(255,255,255,0.08)'
  }

  const getShadow = () => {
    if (focused && !disabled && !wrong) return '0 0 10px rgba(45,195,225,0.10)'
    return 'none'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 36, paddingLeft: 12, paddingRight: 6,
      borderRadius: 8,
      backgroundColor: disabled ? '#131313' : '#1D1E1E',
      border: getBorder(),
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      boxShadow: getShadow(),
      width: '100%',
    }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
          fontSize: 14, fontFamily: FONT,
          color: disabled ? 'rgba(255,255,255,0.40)' : '#FFFFFF',
          caretColor: '#2DC3E1',
        }}
      />
      {suffix}
    </div>
  )
}

// ─── Static Input (for disabled / wrong display) ──────────────────────────────

function InputStatic({ placeholder = '请输入内容', value = '', suffix, disabled = false, wrong = false }) {
  const getBorder = () => {
    if (disabled) return 'none'
    if (wrong) return '1px solid #F75F5F'
    return '1px solid rgba(255,255,255,0.08)'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 36, paddingLeft: 12, paddingRight: 6,
      borderRadius: 8,
      backgroundColor: disabled ? '#131313' : '#1D1E1E',
      border: getBorder(),
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      width: '100%',
    }}>
      <div style={{
        flex: 1, minWidth: 0,
        fontSize: 14, fontFamily: FONT,
        color: (value && !disabled) ? '#FFFFFF' : 'rgba(255,255,255,0.40)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value || placeholder}
      </div>
      {suffix}
    </div>
  )
}

// ─── Textarea (interactive) ───────────────────────────────────────────────────

function Textarea({ placeholder = '请输入内容', disabled = false }) {
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)

  const getBorder = () => {
    if (disabled) return 'none'
    if (focused) return '1px solid rgba(45,195,225,0.60)'
    if (hovered) return '1px solid rgba(255,255,255,0.20)'
    return '1px solid rgba(255,255,255,0.08)'
  }

  return (
    <textarea
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      placeholder={placeholder}
      style={{
        width: '100%', height: 100, padding: '8px 12px',
        borderRadius: 8, resize: 'none',
        backgroundColor: disabled ? '#131313' : '#1D1E1E',
        border: getBorder(),
        outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
        boxShadow: focused && !disabled ? '0 0 10px rgba(45,195,225,0.10)' : 'none',
        fontSize: 14, fontFamily: FONT,
        color: disabled ? 'rgba(255,255,255,0.40)' : '#FFFFFF',
        caretColor: '#2DC3E1',
        boxSizing: 'border-box',
      }}
    />
  )
}

// ─── Small Input (interactive) ────────────────────────────────────────────────

function InputSmall({ placeholder = '请输入内容', disabled = false }) {
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)

  const getBorder = () => {
    if (disabled) return 'none'
    if (focused) return '1px solid rgba(45,195,225,0.60)'
    if (hovered) return '1px solid rgba(255,255,255,0.20)'
    return '1px solid rgba(255,255,255,0.08)'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: 24, paddingLeft: 12, paddingRight: 6,
      borderRadius: 6,
      backgroundColor: disabled ? '#131313' : '#1D1E1E',
      border: getBorder(),
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      flex: 1,
    }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <input
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
          fontSize: 14, fontFamily: FONT,
          color: disabled ? 'rgba(255,255,255,0.40)' : '#FFFFFF',
          caretColor: '#2DC3E1',
        }}
      />
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, desc, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.80)', marginBottom: 2, fontFamily: FONT }}>
          {title}
        </div>
        {desc && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: FONT }}>
            {desc}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Column layout ────────────────────────────────────────────────────────────

const COL_W = 260

function Row({ children }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {children}
    </div>
  )
}

function Col({ children }) {
  return (
    <div style={{ width: COL_W, flexShrink: 0 }}>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const COL_HEADERS = ['交互 Interactive', '禁用 Disabled', '错误 Wrong']

export default function InputShowcase() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.40); }
        input:hover:not(:focus):not(:disabled) {
          /* hover border handled by React state via onMouseEnter would be complex;
             CSS-only hover on wrapper div instead */
        }
        .input-wrap:hover input:not(:focus):not(:disabled) ~ * { opacity: 1; }
      `}</style>

      <div style={{
        backgroundColor: '#111111', minHeight: '100vh',
        padding: '48px 56px', fontFamily: FONT,
      }}>

        {/* Title */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            Input
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.40)' }}>
            Default size · 4 variants · Interactive / Disabled / Wrong
          </p>
        </div>

        {/* Column headers */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, paddingLeft: 0 }}>
          {COL_HEADERS.map(h => (
            <div key={h} style={{
              width: COL_W, flexShrink: 0,
              fontSize: 11, fontWeight: 500,
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {h}
            </div>
          ))}
        </div>

        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 32 }} />

        {/* 1. Plain text */}
        <Section title="纯文本 Plain" desc="无后缀，最基础的输入框">
          <Row>
            <Col><Input placeholder="请输入内容" /></Col>
            <Col><InputStatic placeholder="请输入内容" disabled value="已输入内容" /></Col>
            <Col>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <InputStatic placeholder="请输入内容" wrong value="错误内容" />
                <div style={{ paddingLeft: 12, fontSize: 14, color: '#F75F5F', fontFamily: FONT }}>
                  输入内容不符合要求
                </div>
              </div>
            </Col>
          </Row>
        </Section>

        {/* 2. With inline button */}
        <Section title="内嵌按钮 Inline Button" desc="右侧内嵌 Secondary 小按钮（h-6）">
          <Row>
            <Col>
              <Input
                placeholder="搜索关键词"
                suffix={<InlineBtn label="搜索" />}
              />
            </Col>
            <Col>
              <InputStatic
                placeholder="搜索关键词"
                disabled
                value="已输入内容"
                suffix={<InlineBtn label="搜索" disabled />}
              />
            </Col>
            <Col>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <InputStatic
                  placeholder="搜索关键词"
                  wrong
                  value="错误内容"
                  suffix={<ErrorIcon />}
                />
                <div style={{ paddingLeft: 12, fontSize: 14, color: '#F75F5F', fontFamily: FONT }}>
                  未找到匹配结果
                </div>
              </div>
            </Col>
          </Row>
        </Section>

        {/* 3. With dropdown arrow */}
        <Section title="下拉箭头 Dropdown" desc="右侧下拉箭头图标，颜色跟随状态">
          <Row>
            <Col>
              <Input
                placeholder="请选择"
                suffix={<ChevronIcon color="#FFFFFF" />}
              />
            </Col>
            <Col>
              <InputStatic
                placeholder="请选择"
                disabled
                value="已选择选项"
                suffix={<ChevronIcon color="rgba(255,255,255,0.40)" />}
              />
            </Col>
            <Col>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <InputStatic
                  placeholder="请选择"
                  wrong
                  value="无效选项"
                  suffix={<ChevronIcon color="#F75F5F" />}
                />
                <div style={{ paddingLeft: 12, fontSize: 14, color: '#F75F5F', fontFamily: FONT }}>
                  请选择有效选项
                </div>
              </div>
            </Col>
          </Row>
        </Section>

        {/* 4. With char count */}
        <Section title="字数统计 Char Count" desc="右侧显示当前字数 / 最大字数">
          <Row>
            <Col>
              <InputWithCharCount placeholder="请输入标题" max={30} />
            </Col>
            <Col>
              <InputStatic
                placeholder="请输入标题"
                disabled
                value="已输入内容"
                suffix={<CharCount current={5} max={30} />}
              />
            </Col>
            <Col>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <InputStatic
                  placeholder="请输入标题"
                  wrong
                  value="超出限制的内容超出限制的内容超出"
                  suffix={<CharCount current={31} max={30} />}
                />
                <div style={{ paddingLeft: 12, fontSize: 14, color: '#F75F5F', fontFamily: FONT }}>
                  已超出最大字数限制
                </div>
              </div>
            </Col>
          </Row>
        </Section>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 32 }} />

        {/* 5. Textarea */}
        <Section title="多行输入框 Textarea" desc="固定高度 100px，不可拖拽缩放">
          <Row>
            <Col><Textarea placeholder="请输入详细描述" /></Col>
            <Col><Textarea placeholder="请输入详细描述" disabled /></Col>
            <Col>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <TextareaWrong />
                <div style={{ paddingLeft: 12, fontSize: 14, color: '#F75F5F', fontFamily: FONT }}>
                  内容包含违禁词
                </div>
              </div>
            </Col>
          </Row>
        </Section>

        {/* 6. Small */}
        <Section title="小尺寸 Small" desc="高度 24px，不内嵌按钮，外接 Secondary 小按钮">
          <Row>
            <Col>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <InputSmall placeholder="搜索" />
                <InlineBtn label="搜索" />
              </div>
            </Col>
            <Col>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <InputSmall placeholder="搜索" disabled />
                <InlineBtn label="搜索" disabled />
              </div>
            </Col>
            <Col>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <InputSmallWrong />
                <div style={{ paddingLeft: 12, fontSize: 14, color: '#F75F5F', fontFamily: FONT }}>
                  格式不正确
                </div>
              </div>
            </Col>
          </Row>
        </Section>

      </div>
    </>
  )
}

// ─── Char count input (tracks length internally) ──────────────────────────────

function InputWithCharCount({ placeholder, max }) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)

  const getBorder = () => {
    if (focused) return '1px solid rgba(45,195,225,0.60)'
    if (hovered) return '1px solid rgba(255,255,255,0.20)'
    return '1px solid rgba(255,255,255,0.08)'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 36, paddingLeft: 12, paddingRight: 6,
      borderRadius: 8, backgroundColor: '#1D1E1E',
      border: getBorder(),
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      boxShadow: focused ? '0 0 10px rgba(45,195,225,0.10)' : 'none',
      width: '100%',
    }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <input
        value={value}
        onChange={e => setValue(e.target.value.slice(0, max))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
          fontSize: 14, fontFamily: FONT, color: '#FFFFFF', caretColor: '#2DC3E1',
        }}
      />
      <CharCount current={value.length} max={max} />
    </div>
  )
}

// ─── Static wrong textarea ────────────────────────────────────────────────────

function TextareaWrong() {
  return (
    <div style={{
      width: '100%', height: 100, padding: '8px 12px',
      borderRadius: 8,
      backgroundColor: '#1D1E1E',
      border: '1px solid #F75F5F',
      outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
      fontSize: 14, fontFamily: FONT, color: '#FFFFFF',
      boxSizing: 'border-box',
      display: 'flex', alignItems: 'flex-start',
    }}>
      包含违禁词的内容示例
    </div>
  )
}

// ─── Static wrong small input ─────────────────────────────────────────────────

function InputSmallWrong() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        height: 24, paddingLeft: 12, paddingRight: 6,
        borderRadius: 6, flex: 1,
        backgroundColor: '#1D1E1E',
        border: '1px solid #F75F5F',
        outline: '1px solid rgba(0,0,0,0.50)', outlineOffset: 0,
        fontSize: 14, fontFamily: FONT, color: '#FFFFFF',
      }}>
        错误格式内容
      </div>
    </div>
  )
}
