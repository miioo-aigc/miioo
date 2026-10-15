import { useId } from 'react';

export function EditFilmIcon({ active = false }) {
  const gradientId = useId();
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }} aria-hidden="true">
      {active && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="2.333" x2="0" y2="13.667" gradientUnits="userSpaceOnUse">
            <stop stopColor="oklab(93.3% -0.043 -0.030)" />
            <stop offset="0.314" stopColor="oklab(84.4% -0.0725 -0.051)" />
            <stop offset="1" stopColor="oklab(75.5% -0.102 -0.072)" />
          </linearGradient>
        </defs>
      )}
      <g stroke={active ? `url(#${gradientId})` : 'currentColor'} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.333 5.667V3H11.333M14.333 5.667V10.333M14.333 5.667H11.333M11.333 3V5.667M11.333 3H10M14.333 10.333V13H11.333M14.333 10.333H11.333M11.333 5.667H10M1.667 5.667V3H4.667M1.667 5.667V10.333M1.667 5.667H4.667M4.667 3V5.667M4.667 3H6M1.667 10.333V13H4.667M1.667 10.333H4.667M4.667 5.667H6M4.667 13V10.333M4.667 13H6M4.667 10.333H6M11.333 13V10.333M11.333 13H10M11.333 10.333H10" />
        <path d="M8 2.333V3.667M8 5.667V7M8 9V10.333M8 12.333V13.667" />
      </g>
    </svg>
  );
}

export function EditExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 81.92 81.92" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }} aria-hidden="true">
      <path d="M37.547 13.653m3.413 0l0 0q3.413 0 3.414 3.414l0 34.133q0 3.413-3.414 3.413l0 0q-3.413 0-3.413-3.413l0-34.133q0-3.413 3.413-3.414Z" />
      <path d="M64.854 27.307h-6.827v6.826h6.827v27.307H17.067v-27.307h6.827V27.307H17.067a6.827 6.827 0 0 0-6.827 6.826v27.307a6.827 6.827 0 0 0 6.827 6.827h47.787a6.827 6.827 0 0 0 6.826-6.827v-27.307a6.827 6.827 0 0 0-6.826-6.826zM39.049 8.738L28.536 19.251A2.731 2.731 0 0 0 30.481 23.893h20.958a2.731 2.731 0 0 0 1.946-4.642l-10.513-10.513a2.697 2.697 0 0 0-3.823 0z" />
    </svg>
  );
}
