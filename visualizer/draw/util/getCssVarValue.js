/**
* Get the value of a CSS variable
* @param {String} varName
*/

module.exports = function (theme = 'default') {
  const cssVarValues = { [theme]: {} }
  return function getCSSVarValue (varName) {
    if (!cssVarValues[theme][varName]) {
      cssVarValues[theme][varName] = window.getComputedStyle(document.body).getPropertyValue(varName)
    }
    return cssVarValues[theme][varName]
  }
}
