import { FONT_MEDIUM, FONT_REGULAR } from './adminSharedUtils';

export default function AdminConsoleSidebar({
  sections,
  activeSection,
  onChange,
}) {
  return (
    <aside className="rounded-medium border border-stroke-normal bg-neutral-300 p-[16px]">
      <div className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
        功能导航
      </div>
      <div className="mt-[12px] flex flex-col gap-[8px]">
        {sections.map((section) => {
          const active = section.key === activeSection;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onChange(section.key)}
              className={`rounded-medium border px-[14px] py-[12px] text-left transition-all ${
                active
                  ? 'border-blue-alpha-60 bg-blue-alpha-20'
                  : 'border-stroke-normal bg-neutral-200 hover:border-white-20'
              }`}
            >
              <div
                className={`text-font-size-14 ${active ? 'text-blue-200' : 'text-text-primary'}`}
                style={{ fontFamily: FONT_MEDIUM }}
              >
                {section.label}
              </div>
              <div
                className={`mt-[6px] text-font-size-12 ${active ? 'text-blue-200' : 'text-text-hint'}`}
                style={{ fontFamily: FONT_REGULAR }}
              >
                {section.description}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
