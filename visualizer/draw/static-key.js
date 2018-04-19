'use strict'

const svgBubble = `
  <svg class="key-item-image bubbleprof">
    <g class="party-user bubble-wrapper" transform="translate(24,24)">
      <circle class="bubble-outer by-variable" r="22" style="stroke-width: 2;"></circle>
      <circle class="bubble-inner" r="18"></circle>
    </g>
  </svg>
`

const svgLink = `
  <svg class="key-item-image bubbleprof">
    <g class="party-user link-wrapper transform="translate(8,0)">
      <path class="link-outer by-variable" d="M21.5,0L21.5,42.5,24,45,26.5,42.5,26.5,0" style="stroke-width: 2;"></path>
    </g>
  </svg>
`

const svgText = `
  <svg class="key-item-image bubbleprof">
    <g class="party-user bubble-wrapper" transform="translate(24,24)">
      <text class="time-label text-label">1,234&thinsp;ms</text>
    </g>
  </svg>
`

const svgDonut = `
  <svg class="key-item-image bubbleprof">
    <g class="bubble-donut" transform="translate(24,24),scale(0.20513)">
    <path class="type-files-streams donut-segment" d="M-75.20022028443083,85.0128041483933A113.5,113.5,0,0,1,-25.382475550498956,-110.62540365995653A113.5,113.5,0,0,0,-75.20022028443083,85.0128041483933Z"></path>
    <path class="type-networks donut-segment" d="M6.949870585161229e-15,-113.5A113.5,113.5,0,1,1,-75.20022028443083,85.0128041483933A113.5,113.5,0,1,0,6.949870585161229e-15,-113.5Z"></path>
    <path class="type-other donut-segment" d="M-25.382475550498956,-110.62540365995653A113.5,113.5,0,0,1,-7.824214201613295,-113.22999457797069A113.5,113.5,0,0,0,-25.382475550498956,-110.62540365995653Z"></path>
    <path class="type-crypto donut-segment" d="M-2.0849611755483687e-14,-113.5L-2.0849611755483687e-14,-113.5Z"></path>
    <path class="type-timing-promises donut-segment" d="M-7.824214201613295,-113.22999457797069A113.5,113.5,0,0,1,-2.0849611755483687e-14,-113.5A113.5,113.5,0,0,0,-7.824214201613295,-113.22999457797069Z"></path>
    </g>
  </svg>
`

const keyHtml = `
  <p>
    Bubbleprof observes the async_hooks created in your application, measures their delays, and groups them to map out where the delays most occur in your application's async flow.
  </p>
  <p>
    ${svgBubble}
    Each bubble represents the delays while the flow stayed within your own code, a module, or node core.
  </p>
  <p>
    ${svgLink}
    The length of arrows pointing out from a bubble show delays while moving on to the next module or party.
  </p>
  <p>
    ${svgDonut}
    Inner coloured lines indicate the types of async_hooks responsible for this delay. Click to explore.
  </p>
  <p>
    ${svgText}
    The lengths of the lines between and around the bubbles indicate the aggregated delay in miliseconds (ms).
  </p>
`

module.exports = keyHtml
