export function hideDomElement(element) {
  element.classList.add("hidden");
  element.classList.remove("active");
}

export function showDomElement(element) {
  element.classList.remove("hidden");
  element.classList.add("active");
}

export function createAndSetDomElementAttributes(
  elementType,
  attrNames,
  attrValues,
  textContent = ""
) {
  const element = document.createElement(elementType);
  for (let i = 0; i < attrNames.length; i++) {
    element.setAttribute(attrNames[i], attrValues[i]);
  }
  element.textContent = textContent;

  return element;
}

export function decodeMaterialItem(obj, id, materialNames) {
  const name = decodeIFCString(obj.Name.value);
  addMaterialNameToArray(name, id, materialNames);
}

export function decodeMaterialLayersItem(materialObjectsArray, id, materialNames) {
  for (const material of materialObjectsArray) {
    const name = decodeIFCString(material.Material.Name.value);
    addMaterialNameToArray(name, id, materialNames);
  }
}

export function compileCustomId(ids, prefix) {
  return prefix + ids.slice(0, 10).join("");
}

export function decodeIFCString(ifcString) {
  const ifcUnicodeRegEx = /\\X2\\(.*?)\\X0\\/giu;
  let resultString = ifcString;
  let match = ifcUnicodeRegEx.exec(ifcString);
  while (match) {
    const unicodeChar = String.fromCharCode(parseInt(match[1], 16));
    resultString = resultString.replace(match[0], unicodeChar);
    match = ifcUnicodeRegEx.exec(ifcString);
  }
  return resultString;
}

function addMaterialNameToArray(name, id, materialNames) {
  if (!materialNames[name]) {
    materialNames[name] = [];
    materialNames[name].push(id);
  } else {
    materialNames[name].push(id);
  }
}
