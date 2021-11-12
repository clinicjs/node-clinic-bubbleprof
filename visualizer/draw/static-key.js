'use strict'
const extLinkIcon = require('@clinic/clinic-common/icons/external-link')

const svgSample = `
  <svg class="key-item-image bubbleprof" style="width: 70px; height: 180px; display: block;">
    <g class="node-group" name="11" transform="rotate(-16) translate(-254,-285)">
      <path class="outer-path" d="M 294.6726593852533 304.365025784205 Q 287.82548583124384 291.99101211066295 275.4514721661044 298.838185648429L 245.9456762943194 401.45313620513423 A 34.49862255765599 34.49862255765599 0 1 0 265.1668635174329 406.97997632712253 Z"></path>
      <line style="stroke-width: 1.5;" class="line-segment party-nodecore" x1="288.9063032183193" x2="259.4005073465343" y1="302.70697374760846" y2="405.3219243043137"></line>
      <line style="stroke-width: 3.5;" class="line-segment type-networks" x1="292.75054066294194" x2="263.24474479115696" y1="303.81234177200616" y2="406.4272923287114"></line>
      <circle class="inner-circle" cx="246.29919333121512" cy="436.4107210714518" r="22.49862255765599"></circle>
      <path style="stroke-width: 1.5;" class="line-segment party-nodecore" d="M1.8675020246818336e-15,-30.49862255765599A30.49862255765599,30.49862255765599,0,1,1,-18.040781191743168,-24.590571199262715A30.49862255765599,30.49862255765599,0,1,0,1.8675020246818336e-15,-30.49862255765599Z" transform="translate(246.29919333121512, 436.4107210714518)"></path>
      <path style="stroke-width: 1.5;" class="line-segment party-external" d="M-18.040781191743168,-24.590571199262715A30.49862255765599,30.49862255765599,0,0,1,-5.602506074045501e-15,-30.49862255765599A30.49862255765599,30.49862255765599,0,0,0,-18.040781191743168,-24.590571199262715Z" transform="translate(246.29919333121512, 436.4107210714518)"></path>
      <path style="stroke-width: 3.5;" class="line-segment type-networks" d="M1.622572664852363e-15,-26.49862255765599A26.49862255765599,26.49862255765599,0,1,1,-22.827271325232676,-13.457068079538168A26.49862255765599,26.49862255765599,0,1,0,1.622572664852363e-15,-26.49862255765599Z" transform="translate(246.29919333121512, 436.4107210714518)"></path>
      <path style="stroke-width: 3.5;" class="line-segment type-timing-promises" d="M-22.827271325232676,-13.457068079538168A26.49862255765599,26.49862255765599,0,0,1,-4.867717994557089e-15,-26.49862255765599A26.49862255765599,26.49862255765599,0,0,0,-22.827271325232676,-13.457068079538168Z" transform="translate(246.29919333121512, 436.4107210714518)"></path>
      <text class="party-nodecore text-label name-label upper-label on-line-label" transform="translate(270.3091678378041, 352.90908100156344) rotate(-73.95799506878697)">example–1.2&#8202;s</text>
    </g>
  </svg>
`

const keyHtml = `
  <div class="key-bubble-sample">${svgSample}</div>
  <p>
    <strong>⬋ Grouped async operations.</strong> Size represents time spent executing code and waiting for responses.
  </p>
  <p>
    The straight line segment represents async operations in this group initiated in the previous group.
  </p>
  <p>
    Colors indicate type and area of the grouped operations (labels above expand to give more details).
  </p>
  <h4>How to start exploring this</h4>
  <p>
    The diagram shows how groups of async operations branch out from the start point of this application, which is at the top centre.
  </p>
  <p>
    <strong>Click on bubbles to explore deeper.</strong> When you reach groupings of only one async operation, call stacks are shown, allowing you to find the code behind the biggest delays.
  </p>
  <p>
    See also the <a href="https://clinicjs.org/bubbleprof/walkthrough" class="external-link"><span>walkthrough and guides on the ClinicJs website</span> ${extLinkIcon}</a>.
  </p>
`

module.exports = keyHtml
