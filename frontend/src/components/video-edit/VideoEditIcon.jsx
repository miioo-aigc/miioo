/** 视频详情与画布共用的编辑图标。 */
const ICONS = {
  "智能超清": (<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
                      <path d="M447.849 45.176a53.489 53.489 0 0 1 0 106.978H226.424c-49.393 0-89.33 39.936-89.33 89.33l0.121 122.88c393.276 37.466 594.04 216.666 602.353 537.6h58.067c46.622 0 84.871-35.6 88.967-81.198l0.362-8.132V527.12a53.368 53.368 0 0 1 106.857 0v285.515c0 108.424-87.823 196.307-196.307 196.307h-571.09A196.247 196.247 0 0 1 30.057 812.634v-571.09A196.367 196.367 0 0 1 226.363 45.176H447.85z m-153.24 581.271a32.407 32.407 0 0 0-32.406 32.407v64.873H197.33v-64.873a32.407 32.407 0 0 0-64.873 0v194.62a32.407 32.407 0 0 0 64.873 0V788.6h64.873v64.874a32.407 32.407 0 0 0 64.874 0v-194.56a32.407 32.407 0 0 0-32.467-32.467z m162.215 0H391.95a32.407 32.407 0 0 0-32.286 29.094l-0.18 3.313v194.62c0 17.95 14.516 32.467 32.466 32.467h64.874a97.28 97.28 0 0 0 97.28-97.34v-64.874c0-53.73-43.55-97.28-97.28-97.28z m0 64.873c17.89 0 32.406 14.517 32.406 32.407V788.6a32.407 32.407 0 0 1-32.406 32.467h-32.467V691.32zM812.994 0a22.89 22.89 0 0 1 21.264 14.456l11.384 27.709c19.276 46.742 55.658 84.269 101.798 104.93l32.407 14.456a23.853 23.853 0 0 1 0 43.37l-34.334 15.3A197.15 197.15 0 0 0 845.22 322.017l-11.204 25.359a22.89 22.89 0 0 1-42.165 0l-11.083-25.48A196.97 196.97 0 0 0 680.477 220.22l-34.274-15.3a23.974 23.974 0 0 1 0-43.369l32.347-14.456a197.15 197.15 0 0 0 101.677-104.99l11.445-27.649A22.89 22.89 0 0 1 812.995 0z" fill="currentColor" />
                    </svg>),
  "去字幕": (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <path d="M2 11V13C2 13.5523 2.44772 14 3 14H5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M11 14H13C13.5523 14 14 13.5523 14 13V11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 5V3C14 2.44772 13.5523 2 13 2H11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2 5V3C2 2.44772 2.44772 2 3 2H5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 5V11.6667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M5.66663 5H7.99996H10.3333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>),
  "选帧": (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <path opacity="0.6" d="M8.38096 12.3819L2.51207 13.6294L0.640869 4.82605L3.57531 4.20231L4.30892 4.04638" stroke="currentColor" strokeLinejoin="round" />
                      <path opacity="0.8" d="M7.5 12H4.5V3H10.5V3.79344" stroke="currentColor" strokeLinejoin="round" />
                      <rect x="9.78113" y="3.27368" width="6" height="9" transform="rotate(18 9.78113 3.27368)" stroke="currentColor" strokeLinejoin="round" />
                    </svg>),
  "剪辑": (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <path d="M14.3333 5.66667V3H11.3333M14.3333 5.66667V10.3333M14.3333 5.66667H11.3333M11.3333 3V5.66667M11.3333 3H9.99996M14.3333 10.3333V13H11.3333M14.3333 10.3333H11.3333M11.3333 5.66667H9.99996M1.66663 5.66667V3H4.66663M1.66663 5.66667V10.3333M1.66663 5.66667H4.66663M4.66663 3V5.66667M4.66663 3H5.99996M1.66663 10.3333V13H4.66663M1.66663 10.3333H4.66663M4.66663 5.66667H5.99996M4.66663 13V10.3333M4.66663 13H5.99996M4.66663 10.3333H5.99996M11.3333 13V10.3333M11.3333 13H9.99996M11.3333 10.3333H9.99996" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 2.33337V3.66671" stroke="currentColor" strokeLinecap="round" />
                      <path d="M8 5.66663V6.99996" stroke="currentColor" strokeLinecap="round" />
                      <path d="M8 9V10.3333" stroke="currentColor" strokeLinecap="round" />
                      <path d="M8 12.3334V13.6667" stroke="currentColor" strokeLinecap="round" />
                    </svg>),
};
export default function VideoEditIcon({ label }) { return ICONS[label] || null; }
