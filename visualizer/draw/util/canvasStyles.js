const getCssVarValue = require('./getCssVarValue')
const cssVarValues = getCssVarValue()

module.exports = function canvasStyles () {
  const colours = {
    'party-user': cssVarValues('--party-colour-1'),
    'party-external': cssVarValues('--party-colour-2'),
    'party-nodecore': cssVarValues('--party-colour-3'),
    'party-root': cssVarValues('--party-colour-3'),
    'type-files-streams': cssVarValues('--type-colour-1'),
    'type-networks': cssVarValues('--type-colour-2'),
    'type-crypto': cssVarValues('--type-colour-3'),
    'type-timing-promises': cssVarValues('--type-colour-4'),
    'type-other': cssVarValues('--type-colour-5'),
    'outer-path': cssVarValues('--node-background'),
    'outer-path-stroke': cssVarValues('--shortcut-stroke'),
    'selected-node': cssVarValues('--highlight-bg-color'),
    'inner-circle': cssVarValues('--main-bg-color')
  }

  const solid = []
  const dashed = [1.3, 0.7]

  const strokeDash = {
    'party-user': solid,
    'party-external': solid,
    'party-nodecore': dashed,
    'party-root': dashed,
    'type-files-streams': dashed,
    'type-networks': solid,
    'type-crypto': dashed,
    'type-timing-promises': solid,
    'type-other': dashed
  }

  const lineWidths = {
    'party-user': 1.5,
    'party-external': 1.5,
    'party-nodecore': 1.5,
    'party-root': 1.5,
    'type-files-streams': 3.5,
    'type-networks': 3.5,
    'type-crypto': 3.5,
    'type-timing-promises': 3.5,
    'type-other': 3.5,
    'outer-path': 0.5
  }

  return {
    colours,
    strokeDash,
    lineWidths
  }
}
