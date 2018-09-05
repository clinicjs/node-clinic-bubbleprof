'use strict'

// This lookup object of HTML content types is necessary to prevent circular dependencies
// e.g. if an A contains a B which contains an A
module.exports = {
  // Parent class, for generic HTML content with optional collapse, load indicator, etc
  HtmlContent: require('./html-content.js'),

  // Sub classes which extend HtmlContent
  BreadcrumbPanel: require('./breadcrumb-panel.js'),
  Frames: require('./frames.js'),
  HoverBox: require('./hover-box.js'),
  InteractiveKey: require('./interactive-key.js'),
  AreaChart: require('./area-chart.js'),
  Lookup: require('./lookup.js'),
  SvgContainer: require('./svg-container.js'),
  SideBarDrag: require('./side-bar-drag.js')
}
