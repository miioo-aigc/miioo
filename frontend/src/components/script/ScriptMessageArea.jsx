/**
 * @file ScriptMessageArea.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   展示持久化剧本对话消息，支持流式消息滚动到最新内容
 *
 * ─── 数据边界 ───────────────────────────────────────────────────────
 *   只接收归一化消息和当前流式状态，不调用接口、不持有页面请求状态
 */
import { useEffect, useRef } from 'react';
import { TextButton } from '../ui';
import ScriptMessageLoading from './ScriptMessageLoading';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_SEMIBOLD = "'AlibabaPuHuiTi_2_75_SemiBold','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function ScriptOutlineIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 81.92 81.92" width="16" height="16" style={{ flexShrink: 0 }}>
      <path d="M63.706 48.827H39.506c-.672-.071-1.34.165-1.817.642a2.237 2.237 0 0 0-.643 1.818c-.012.656.243 1.289.708 1.753a2.418 2.418 0 0 0 1.752.707h24.2c.672.071 1.34-.165 1.817-.643a2.237 2.237 0 0 0 .643-1.817c.012-.656-.243-1.29-.708-1.753-.463-.465-1.097-.72-1.752-.707z m0-21.024H39.506c-.672-.071-1.34.165-1.817.642a2.237 2.237 0 0 0-.643 1.818c-.071.672.165 1.34.643 1.817a2.237 2.237 0 0 0 1.817.643h24.2c.672.071 1.34-.165 1.817-.643a2.237 2.237 0 0 0 .643-1.817c.012-.656-.243-1.289-.708-1.753a2.415 2.415 0 0 0-1.752-.707z m0 0" fill="currentColor" />
      <path d="M65.808 6.376H15.978c-6.01.025-10.87 4.904-10.87 10.915v47.325c.025 5.993 4.877 10.846 10.87 10.87h49.83c5.993-.025 10.845-4.877 10.87-10.87V17.291c.062-2.906-1.062-5.71-3.114-7.769-2.05-2.059-4.85-3.194-7.756-3.146z m5.592 58.599a5.548 5.548 0 0 1-1.625 3.967 5.55 5.55 0 0 1-3.967 1.625H15.978a5.549 5.549 0 0 1-3.968-1.625 5.547 5.547 0 0 1-1.624-3.967V17.291a5.549 5.549 0 0 1 1.608-3.996 5.546 5.546 0 0 1 3.983-1.64h49.83a5.548 5.548 0 0 1 5.592 5.592v47.728z m0 0" fill="currentColor" />
      <path d="M25.103 43.592c-4.459 0-8.074 3.615-8.073 8.075s3.614 8.074 8.073 8.073 8.074-3.614 8.075-8.073-3.616-8.074-8.075-8.075z m0 10.512c-.766.07-1.525-.205-2.069-.748a2.595 2.595 0 0 1-.748-2.069 2.594 2.594 0 0 1 .748-2.069c.544-.544 1.302-.818 2.069-.75.766-.07 1.525.205 2.069.75.544.544.818 1.302.75 2.069.012.751-.281 1.475-.812 2.005a2.771 2.771 0 0 1-2.007.812zM31.41 23.598l-7.694 7.694-3.489-3.489a2.326 2.326 0 0 0-1.744-.788c-.668 0-1.303.287-1.745.788a2.326 2.326 0 0 0-.788 1.745c0 .667.287 1.303.788 1.744l5.547 5.636a2.953 2.953 0 0 0 2.102.716c1.074 0 1.074-.358 2.103-.716l9.483-9.393a2.325 2.325 0 0 0 .787-1.745c0-.667-.286-1.303-.787-1.745-2.102-.984-3.49-.984-4.563-.447z m0 0" fill="currentColor" />
    </svg>
  );
}

function MiiooMark() {
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" style={{ width: '28px', height: '28px', flexShrink: 0, borderRadius: '50%' }}>
      <rect width="28" height="28" rx="14" fill="#FEFC8E" />
      <rect x="0.5" y="0.5" width="27" height="27" rx="13.5" fill="none" stroke="#FFFFFF80" />
      <path d="M16.028 20.344C16.028 21.48 15.12 22.4 14 22.4C12.88 22.4 11.973 21.48 11.973 20.344C11.973 19.209 12.88 18.288 14 18.288C15.12 18.288 16.028 19.209 16.028 20.344Z" fill="#00D4FF" />
      <path d="M5.6 5.6C5.6 5.6 5.6 5.6 5.6 5.6C5.612 7.379 6.161 9.028 7.092 10.389C7.96 11.658 8.728 13.064 8.728 14.601V20.836C8.728 21.7 8.028 22.4 7.164 22.4C6.3 22.4 5.6 21.7 5.6 20.836V5.6C5.6 5.6 5.6 5.6 5.6 5.6Z" fill="#191919" />
      <path d="M22.4 20.836C22.4 21.7 21.699 22.4 20.836 22.4C19.972 22.4 19.271 21.7 19.271 20.836V14.601C19.271 13.064 20.04 11.658 20.907 10.389C21.838 9.028 22.387 7.379 22.399 5.6C22.399 5.6 22.399 5.6 22.399 5.6C22.4 5.6 22.4 5.6 22.4 5.6V20.836Z" fill="#191919" />
      <path d="M21.818 8.66C21.937 8.354 22.399 8.385 22.399 8.713C22.399 13.418 18.639 17.231 13.999 17.231C9.36 17.231 5.6 13.418 5.6 8.713C5.6 8.385 6.062 8.354 6.18 8.66C7.408 11.821 10.446 14.059 13.999 14.059C17.553 14.059 20.591 11.821 21.818 8.66Z" fill="#191919" />
    </svg>
  );
}

function MessageBubble({ message, isActive }) {
  const isUser = message.role === 'user';
  const isError = message.status === 'failed' || message.status === 'interrupted';
  const showLoading = isActive && message.role === 'assistant' && message.status === 'streaming' && !message.content;

  if (!isUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: '6px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', flexShrink: 0 }}>
          <MiiooMark />
          <span style={{ color: '#FFFFFFB3', fontFamily: FONT_SEMIBOLD, fontSize: '14px', lineHeight: '18px', fontWeight: 600 }}>Miioo</span>
        </div>
        <div style={{ alignSelf: 'stretch', paddingLeft: '32px', color: isError ? '#F75F5F' : '#FFFFFF', fontFamily: FONT, fontSize: '14px', lineHeight: '20px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {showLoading ? <ScriptMessageLoading /> : message.content || (isError ? (message.errorMessage || '本次创作未完成') : '')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '100%' }}>
      <div
        style={{
          maxWidth: '100%',
          padding: '8px 12px',
          borderRadius: '999px 999px 999px 0px',
          background: '#343435',
          color: isError ? '#F75F5F' : '#FFFFFF',
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '18px',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {message.content || (isError ? (message.errorMessage || '本次创作未完成') : '')}
      </div>
    </div>
  );
}

export default function ScriptMessageArea({ messages = [], activeMessageId = null, hasScript = false, onOpenScript }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, activeMessageId]);

  return (
    <div
      ref={scrollRef}
      style={{
        width: 'min(800px, 100%)',
        maxWidth: '100%',
        alignSelf: 'center',
        minHeight: 0,
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '0px 24px 16px',
        boxSizing: 'border-box',
        scrollbarGutter: 'stable',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }}>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} isActive={message.id === activeMessageId} />
        ))}
        {hasScript && onOpenScript && (
          <TextButton
            type="button"
            variant="link"
            icon={<ScriptOutlineIcon />}
            onClick={onOpenScript}
            className="rounded-[6px] text-[14px] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#2DC3E180]"
            contentClassName="text-[14px] leading-[20px]"
            style={{ alignSelf: 'flex-start', marginLeft: '32px', fontFamily: FONT, lineHeight: '20px' }}
          >
            确认初稿，进入剧本编排
          </TextButton>
        )}
      </div>
    </div>
  );
}
