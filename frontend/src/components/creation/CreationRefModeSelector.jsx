import { useEffect, useRef, useState } from 'react';
import { FONT } from './CreationSelectorPrimitives';

const REF_MODE_ICON_ALL_SELECTED = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M12.619 6.667V8V9.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.155 12.667L10.309 12L11.464 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.845 12.667L5.69 12L4.536 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.381 6.667V8V9.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.536 4.667L5.69 4L6.845 3.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.155 3.333L10.309 4L11.464 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 14.667C8.736 14.667 9.333 14.07 9.333 13.333C9.333 12.597 8.736 12 8 12C7.264 12 6.667 12.597 6.667 13.333C6.667 14.07 7.264 14.667 8 14.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 4C8.736 4 9.333 3.403 9.333 2.667C9.333 1.93 8.736 1.333 8 1.333C7.264 1.333 6.667 1.93 6.667 2.667C6.667 3.403 7.264 4 8 4Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 9.333C8.736 9.333 9.333 8.736 9.333 8C9.333 7.264 8.736 6.667 8 6.667C7.264 6.667 6.667 7.264 6.667 8C6.667 8.736 7.264 9.333 8 9.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.667 6.667C13.403 6.667 14 6.07 14 5.333C14 4.597 13.403 4 12.667 4C11.93 4 11.333 4.597 11.333 5.333C11.333 6.07 11.93 6.667 12.667 6.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.667 12C13.403 12 14 11.403 14 10.667C14 9.93 13.403 9.333 12.667 9.333C11.93 9.333 11.333 9.93 11.333 10.667C11.333 11.403 11.93 12 12.667 12Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.333 6.667C4.07 6.667 4.667 6.07 4.667 5.333C4.667 4.597 4.07 4 3.333 4C2.597 4 2 4.597 2 5.333C2 6.07 2.597 6.667 3.333 6.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.333 12C4.07 12 4.667 11.403 4.667 10.667C4.667 9.93 4.07 9.333 3.333 9.333C2.597 9.333 2 9.93 2 10.667C2 11.403 2.597 12 3.333 12Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const REF_MODE_ICON_ALL_DEFAULT = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M12.619 6.667V8V9.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.155 12.667L10.309 12L11.464 11.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.845 12.667L5.69 12L4.536 11.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.381 6.667V8V9.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.536 4.667L5.69 4L6.845 3.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.155 3.333L10.309 4L11.464 4.667" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 14.667C8.736 14.667 9.333 14.07 9.333 13.333C9.333 12.597 8.736 12 8 12C7.264 12 6.667 12.597 6.667 13.333C6.667 14.07 7.264 14.667 8 14.667Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 4C8.736 4 9.333 3.403 9.333 2.667C9.333 1.93 8.736 1.333 8 1.333C7.264 1.333 6.667 1.93 6.667 2.667C6.667 3.403 7.264 4 8 4Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 9.333C8.736 9.333 9.333 8.736 9.333 8C9.333 7.264 8.736 6.667 8 6.667C7.264 6.667 6.667 7.264 6.667 8C6.667 8.736 7.264 9.333 8 9.333Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.667 6.667C13.403 6.667 14 6.07 14 5.333C14 4.597 13.403 4 12.667 4C11.93 4 11.333 4.597 11.333 5.333C11.333 6.07 11.93 6.667 12.667 6.667Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.667 12C13.403 12 14 11.403 14 10.667C14 9.93 13.403 9.333 12.667 9.333C11.93 9.333 11.333 9.93 11.333 10.667C11.333 11.403 11.93 12 12.667 12Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.333 6.667C4.07 6.667 4.667 6.07 4.667 5.333C4.667 4.597 4.07 4 3.333 4C2.597 4 2 4.597 2 5.333C2 6.07 2.597 6.667 3.333 6.667Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.333 12C4.07 12 4.667 11.403 4.667 10.667C4.667 9.93 4.07 9.333 3.333 9.333C2.597 9.333 2 9.93 2 10.667C2 11.403 2.597 12 3.333 12Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const REF_MODE_ICON_FRAME_DEFAULT = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
    <path d="M9.446 1.733C9.888 1.733 10.246 2.092 10.246 2.533V21.855C10.246 22.297 9.888 22.655 9.447 22.655C9.005 22.655 8.646 22.297 8.646 21.855V2.533C8.646 2.092 9.005 1.733 9.447 1.733H9.446Z" fill="#FFFFFF99" />
    <path d="M9.194 3.483V5.083H4.706C4.411 5.083 4.172 5.322 4.172 5.617V18.946C4.172 19.241 4.411 19.479 4.706 19.479H9.194V21.079H4.706C3.527 21.079 2.572 20.124 2.572 18.946V5.617C2.572 4.438 3.527 3.483 4.706 3.483H9.194Z" fill="#FFFFFF99" />
    <path d="M3.814 8.787H9.446V7.187H3.814V8.787ZM3.814 17.402H9.446V15.802H3.814V17.402ZM14.706 1.733C14.264 1.733 13.906 2.092 13.906 2.533V21.855C13.906 22.297 14.264 22.655 14.706 22.655C15.148 22.655 15.506 22.297 15.506 21.855V2.533C15.506 2.092 15.148 1.733 14.706 1.733Z" fill="#FFFFFF99" />
    <path d="M14.957 3.483V5.083H19.446C19.74 5.083 19.979 5.322 19.979 5.617V18.946C19.979 19.241 19.74 19.479 19.446 19.479H14.957V21.079H19.446C20.624 21.079 21.579 20.124 21.579 18.946V5.617C21.579 4.438 20.624 3.483 19.446 3.483H14.957Z" fill="#FFFFFF99" />
    <path d="M20.339 8.787H14.707V7.187H20.339V8.787ZM20.339 17.402H14.707V15.802H20.339V17.402Z" fill="#FFFFFF99" />
  </svg>
);
const REF_MODE_ICON_FRAME_SELECTED = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
    <path d="M9.446 1.733C9.888 1.733 10.246 2.092 10.246 2.533V21.855C10.246 22.297 9.888 22.655 9.447 22.655C9.005 22.655 8.646 22.297 8.646 21.855V2.533C8.646 2.092 9.005 1.733 9.447 1.733H9.446Z" fill="#FFFFFF" />
    <path d="M9.194 3.483V5.083H4.706C4.411 5.083 4.172 5.322 4.172 5.617V18.946C4.172 19.241 4.411 19.479 4.706 19.479H9.194V21.079H4.706C3.527 21.079 2.572 20.124 2.572 18.946V5.617C2.572 4.438 3.527 3.483 4.706 3.483H9.194Z" fill="#FFFFFF" />
    <path d="M3.814 8.787H9.446V7.187H3.814V8.787ZM3.814 17.402H9.446V15.802H3.814V17.402ZM14.706 1.733C14.264 1.733 13.906 2.092 13.906 2.533V21.855C13.906 22.297 14.264 22.655 14.706 22.655C15.148 22.655 15.506 22.297 15.506 21.855V2.533C15.506 2.092 15.148 1.733 14.706 1.733Z" fill="#FFFFFF" />
    <path d="M14.957 3.483V5.083H19.446C19.74 5.083 19.979 5.322 19.979 5.617V18.946C19.979 19.241 19.74 19.479 19.446 19.479H14.957V21.079H19.446C20.624 21.079 21.579 20.124 21.579 18.946V5.617C21.579 4.438 20.624 3.483 19.446 3.483H14.957Z" fill="#FFFFFF" />
    <path d="M20.339 8.787H14.707V7.187H20.339V8.787ZM20.339 17.402H14.707V15.802H20.339V17.402Z" fill="#FFFFFF" />
  </svg>
);
const REF_MODE_ICON_MULTI_DEFAULT = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, opacity: 0.6 }}>
    <path opacity="0.6" d="M8.38096 12.3819L2.51207 13.6294L0.640869 4.82605L3.57531 4.20231L4.30892 4.04638" stroke="white" strokeLinejoin="round" />
    <path opacity="0.8" d="M7.5 12H4.5V3H10.5V3.79344" stroke="white" strokeLinejoin="round" />
    <rect x="9.78113" y="3.27368" width="6" height="9" transform="rotate(18 9.78113 3.27368)" stroke="white" strokeLinejoin="round" />
  </svg>
);
const REF_MODE_ICON_MULTI_SELECTED = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path opacity="0.6" d="M8.38096 12.3819L2.51207 13.6294L0.640869 4.82605L3.57531 4.20231L4.30892 4.04638" stroke="white" strokeLinejoin="round" />
    <path opacity="0.8" d="M7.5 12H4.5V3H10.5V3.79344" stroke="white" strokeLinejoin="round" />
    <rect x="9.78113" y="3.27368" width="6" height="9" transform="rotate(18 9.78113 3.27368)" stroke="white" strokeLinejoin="round" />
  </svg>
);

const REF_MODE_ICON_AVATAR_DEFAULT = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, opacity: 0.6 }}>
    <path d="M1.66787 14.077C1.66787 14.2185 1.78598 14.3333 1.9317 14.3333L14.0674 14.3333C14.2131 14.3333 14.3312 14.2186 14.3312 14.0771V13.771C14.3373 13.6788 14.3496 13.2185 14.0462 12.7096C13.8549 12.3887 13.5772 12.1115 13.2209 11.8857C12.7898 11.6126 12.2415 11.4146 11.5782 11.2955C11.5733 11.2948 11.0815 11.2296 10.5777 11.101C9.70029 10.8769 9.62359 10.6785 9.62309 10.6766C9.61793 10.657 9.61046 10.6382 9.60089 10.6205C9.59373 10.5835 9.57599 10.4442 9.60989 10.0712C9.69596 9.12363 10.2042 8.56363 10.6126 8.11369C10.7414 7.97179 10.8631 7.83776 10.9568 7.70633C11.3609 7.13933 11.3984 6.49459 11.4001 6.45463C11.4001 6.37366 11.3908 6.30709 11.3709 6.24539C11.3312 6.12193 11.2566 6.04499 11.2021 5.98883L11.2017 5.98843C11.188 5.97429 11.175 5.96089 11.1644 5.94859C11.1604 5.94389 11.1496 5.93146 11.1594 5.86763C11.1953 5.63266 11.2168 5.43593 11.2271 5.24849C11.2455 4.91456 11.2599 4.41516 11.1738 3.92913C11.1631 3.84613 11.1449 3.75846 11.1164 3.65403C11.0254 3.31934 10.8792 3.0332 10.6761 2.79704C10.6412 2.75903 9.79183 1.86423 7.32623 1.68063C6.98529 1.65525 6.64826 1.66892 6.31649 1.68588C6.23653 1.68983 6.12703 1.69526 6.02456 1.72181C5.76999 1.78775 5.70206 1.9491 5.68423 2.03941C5.65466 2.18899 5.70663 2.30534 5.74099 2.38235C5.74599 2.39352 5.75216 2.40734 5.74139 2.44328C5.68416 2.53192 5.59413 2.61183 5.50233 2.68754C5.47579 2.71009 4.85753 3.24319 4.82353 3.93959C4.73186 4.46923 4.73879 5.29443 4.84719 5.86476C4.85349 5.89626 4.86279 5.94289 4.84769 5.97439C4.73113 6.07886 4.59899 6.19726 4.59933 6.46743C4.60073 6.49459 4.63823 7.13933 5.04236 7.70633C5.13596 7.83766 5.25749 7.97159 5.38619 8.11339L5.38649 8.11369C5.79489 8.56363 6.30313 9.12363 6.38923 10.0711C6.42309 10.4442 6.40536 10.5835 6.39819 10.6204C6.38863 10.6381 6.38116 10.657 6.37603 10.6766C6.37549 10.6785 6.29909 10.8762 5.42569 11.0998C4.92183 11.2289 4.42579 11.2948 4.41099 11.2969C3.76643 11.4057 3.22142 11.5987 2.79113 11.8705C2.436 12.0948 2.15781 12.3725 1.96426 12.6959C1.65502 13.2126 1.66338 13.6832 1.66787 13.7691V14.077Z" stroke="white" strokeLinejoin="round" />
  </svg>
);
const REF_MODE_ICON_AVATAR_SELECTED = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M1.66787 14.077C1.66787 14.2185 1.78598 14.3333 1.9317 14.3333L14.0674 14.3333C14.2131 14.3333 14.3312 14.2186 14.3312 14.0771V13.771C14.3373 13.6788 14.3496 13.2185 14.0462 12.7096C13.8549 12.3887 13.5772 12.1115 13.2209 11.8857C12.7898 11.6126 12.2415 11.4146 11.5782 11.2955C11.5733 11.2948 11.0815 11.2296 10.5777 11.101C9.70029 10.8769 9.62359 10.6785 9.62309 10.6766C9.61793 10.657 9.61046 10.6382 9.60089 10.6205C9.59373 10.5835 9.57599 10.4442 9.60989 10.0712C9.69596 9.12363 10.2042 8.56363 10.6126 8.11369C10.7414 7.97179 10.8631 7.83776 10.9568 7.70633C11.3609 7.13933 11.3984 6.49459 11.4001 6.45463C11.4001 6.37366 11.3908 6.30709 11.3709 6.24539C11.3312 6.12193 11.2566 6.04499 11.2021 5.98883L11.2017 5.98843C11.188 5.97429 11.175 5.96089 11.1644 5.94859C11.1604 5.94389 11.1496 5.93146 11.1594 5.86763C11.1953 5.63266 11.2168 5.43593 11.2271 5.24849C11.2455 4.91456 11.2599 4.41516 11.1738 3.92913C11.1631 3.84613 11.1449 3.75846 11.1164 3.65403C11.0254 3.31934 10.8792 3.0332 10.6761 2.79704C10.6412 2.75903 9.79183 1.86423 7.32623 1.68063C6.98529 1.65525 6.64826 1.66892 6.31649 1.68588C6.23653 1.68983 6.12703 1.69526 6.02456 1.72181C5.76999 1.78775 5.70206 1.9491 5.68423 2.03941C5.65466 2.18899 5.70663 2.30534 5.74099 2.38235C5.74599 2.39352 5.75216 2.40734 5.74139 2.44328C5.68416 2.53192 5.59413 2.61183 5.50233 2.68754C5.47579 2.71009 4.85753 3.24319 4.82353 3.93959C4.73186 4.46923 4.73879 5.29443 4.84719 5.86476C4.85349 5.89626 4.86279 5.94289 4.84769 5.97439C4.73113 6.07886 4.59899 6.19726 4.59933 6.46743C4.60073 6.49459 4.63823 7.13933 5.04236 7.70633C5.13596 7.83766 5.25749 7.97159 5.38619 8.11339L5.38649 8.11369C5.79489 8.56363 6.30313 9.12363 6.38923 10.0711C6.42309 10.4442 6.40536 10.5835 6.39819 10.6204C6.38863 10.6381 6.38116 10.657 6.37603 10.6766C6.37549 10.6785 6.29909 10.8762 5.42569 11.0998C4.92183 11.2289 4.42579 11.2948 4.41099 11.2969C3.76643 11.4057 3.22142 11.5987 2.79113 11.8705C2.436 12.0948 2.15781 12.3725 1.96426 12.6959C1.65502 13.2126 1.66338 13.6832 1.66787 13.7691V14.077Z" stroke="white" strokeLinejoin="round" />
  </svg>
);

const REF_MODE_ICON_LIP_SYNC_DEFAULT = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, opacity: 0.6 }}>
    <path d="M8.00004 14.6667C11.6819 14.6667 14.6667 11.6819 14.6667 8.00004C14.6667 4.31814 11.6819 1.33337 8.00004 1.33337C4.31814 1.33337 1.33337 4.31814 1.33337 8.00004C1.33337 11.6819 4.31814 14.6667 8.00004 14.6667Z" stroke="white" strokeLinejoin="round" />
    <path d="M10.3334 6V6.33333" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.66663 6V6.33333" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.33329 9.33333C9.33329 8.59695 8.73634 8 7.99996 8C7.26358 8 6.66663 8.59695 6.66663 9.33333V10.6667C6.66663 11.403 7.26358 12 7.99996 12C8.73634 12 9.33329 11.403 9.33329 10.6667V9.33333Z" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const REF_MODE_ICON_LIP_SYNC_SELECTED = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M8.00004 14.6667C11.6819 14.6667 14.6667 11.6819 14.6667 8.00004C14.6667 4.31814 11.6819 1.33337 8.00004 1.33337C4.31814 1.33337 1.33337 4.31814 1.33337 8.00004C1.33337 11.6819 4.31814 14.6667 8.00004 14.6667Z" stroke="white" strokeLinejoin="round" />
    <path d="M10.3334 6V6.33333" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.66663 6V6.33333" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.33329 9.33333C9.33329 8.59695 8.73634 8 7.99996 8C7.26358 8 6.66663 8.59695 6.66663 9.33333V10.6667C6.66663 11.403 7.26358 12 7.99996 12C8.73634 12 9.33329 11.403 9.33329 10.6667V9.33333Z" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const REF_MODE_ICON_MOTION_CONTROL_DEFAULT = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, opacity: 0.6 }}>
    <path d="M2.66663 3.33337L6.66663 6.75137V9.98947L3.61899 14.6667" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.3334 3.33337L9.33337 6.75137V9.98947L12.381 14.6667" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.99996 4.00004C8.73634 4.00004 9.33329 3.40309 9.33329 2.66671C9.33329 1.93033 8.73634 1.33337 7.99996 1.33337C7.26358 1.33337 6.66663 1.93033 6.66663 2.66671C6.66663 3.40309 7.26358 4.00004 7.99996 4.00004Z" stroke="white" />
  </svg>
);
const REF_MODE_ICON_MOTION_CONTROL_SELECTED = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M2.66663 3.33337L6.66663 6.75137V9.98947L3.61899 14.6667" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.3334 3.33337L9.33337 6.75137V9.98947L12.381 14.6667" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.99996 4.00004C8.73634 4.00004 9.33329 3.40309 9.33329 2.66671C9.33329 1.93033 8.73634 1.33337 7.99996 1.33337C7.26358 1.33337 6.66663 1.93033 6.66663 2.66671C6.66663 3.40309 7.26358 4.00004 7.99996 4.00004Z" stroke="white" />
  </svg>
);

// Icon map for ref modes — icons are static frontend assets, not from backend
const REF_MODE_ICON_MAP = {
  all:   { iconSelected: REF_MODE_ICON_ALL_SELECTED,    iconDefault: REF_MODE_ICON_ALL_DEFAULT,    triggerIcon: REF_MODE_ICON_ALL_SELECTED    },
  frame: { iconSelected: REF_MODE_ICON_FRAME_SELECTED,  iconDefault: REF_MODE_ICON_FRAME_DEFAULT,  triggerIcon: REF_MODE_ICON_FRAME_SELECTED  },
  multi_shot: { iconSelected: REF_MODE_ICON_MULTI_SELECTED, iconDefault: REF_MODE_ICON_MULTI_DEFAULT, triggerIcon: REF_MODE_ICON_MULTI_SELECTED },
  kling_motion_control: { iconSelected: REF_MODE_ICON_MOTION_CONTROL_SELECTED, iconDefault: REF_MODE_ICON_MOTION_CONTROL_DEFAULT, triggerIcon: REF_MODE_ICON_MOTION_CONTROL_SELECTED },
  kling_lip_sync: { iconSelected: REF_MODE_ICON_LIP_SYNC_SELECTED, iconDefault: REF_MODE_ICON_LIP_SYNC_DEFAULT, triggerIcon: REF_MODE_ICON_LIP_SYNC_SELECTED },
  kling_avatar: { iconSelected: REF_MODE_ICON_AVATAR_SELECTED, iconDefault: REF_MODE_ICON_AVATAR_DEFAULT, triggerIcon: REF_MODE_ICON_AVATAR_SELECTED },
};

// ─── Reference mode selector ──────────────────────────────────────────────────
export function RefModeSelector({ value, onChange, disabled, options = [] }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOpt = options.find((o) => o.value === value) ?? options[0];
  const selectedIcons = REF_MODE_ICON_MAP[selectedOpt?.value] ?? REF_MODE_ICON_MAP.all;
  const isActive = open || hovered;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '32px',
          paddingLeft: '12px',
          paddingRight: '6px',
          borderRadius: '8px',
          justifyContent: 'space-between',
          flexShrink: 0,
          border: '1px solid',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: open ? '#252525' : isActive ? '#222222' : '#1D1E1E',
          borderColor: open ? '#2DC3E199' : '#FFFFFF14',
          outline: '1px solid #00000080',
          boxShadow: open ? '#2DC3E11A 0px 0px 10px' : 'none',
          transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
          opacity: disabled ? 0.45 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isActive ? selectedIcons.iconSelected : selectedIcons.iconDefault}
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>
            {selectedOpt?.label}
          </span>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          zIndex: 50,
          left: 0,
          bottom: 'calc(100% + 4px)',
          borderRadius: '8px',
          background: '#1D1E1E',
          border: '1px solid #FFFFFF0D',
          boxShadow: '0px 4px 16px #00000066',
          width: '112px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0px',
        }}>
          {options.map((opt) => {
            const sel = opt.value === value;
            const icons = REF_MODE_ICON_MAP[opt.value] ?? REF_MODE_ICON_MAP.all;
            return (
              <RefModeDropdownItem
                key={opt.value}
                label={opt.label}
                iconDefault={icons.iconDefault}
                iconSelected={icons.iconSelected}
                selected={sel}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function RefModeDropdownItem({ label, iconDefault, iconSelected, selected, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        width: '100%',
        paddingLeft: '12px',
        paddingRight: '12px',
        paddingTop: '8px',
        paddingBottom: '8px',
        borderRadius: '6px',
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        fontFamily: FONT,
        fontSize: '14px',
        lineHeight: '18px',
        color: selected ? '#FFFFFFCC' : '#FFFFFF99',
        background: selected ? '#FFFFFF0D' : hovered ? '#FFFFFF0A' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {selected || hovered ? iconSelected : iconDefault}
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}
