/**
* Get the value of a CSS variable
* @param {String} varName
*/

module.exports = function () {
  const cssVarValues = {}
  return function getCSSVarValue (varName) {
    if (!cssVarValues[varName]) {
      cssVarValues[varName] = window.getComputedStyle(document.body).getPropertyValue(varName)
    }
    return cssVarValues[varName]
  }
}
