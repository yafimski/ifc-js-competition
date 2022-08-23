import { Color, MeshLambertMaterial } from "three";
import { IfcViewerAPI } from "web-ifc-viewer";
import { IfcCategories, categoryNameMap, panelNames, colorSet } from "./enums.js";
import * as Utils from "./utils.js";

const container = document.getElementById("viewer-container");
const viewer = new IfcViewerAPI({
  container,
  backgroundColor: new Color(0xffffff),
});
viewer.grid.setGrid();
viewer.axes.setAxes();
const scene = viewer.context.getScene();

const ifcManager = viewer.IFC.loader.ifcManager;

let models = [];
let modelData = {
  categories: {},
  materials: {},
  expressIds: [],
  subsets: {},
};
let modelSubsets = [];

let colorHexValue;
let colorResult;
let colorPicker;
let prevButton = undefined;
let prevDropdown = undefined;

const input = document.getElementById("file-input");
input.addEventListener(
  "change",
  async () => {
    await purgeModels();

    const url = URL.createObjectURL(input.files[0]);
    const model = await viewer.IFC.loadIfcUrl(url);
    models.push(model);
    scene.add(model);

    await setMainButtonEvents(model.modelID);
    viewer.context.renderer.postProduction.active = true;
    await compileModelData(model.modelID);
  },
  false
);

async function purgeModels() {
  removeElementsFromScene(models);
  removeElementsFromScene(modelSubsets);
  models = [];
  modelSubsets = [];
  modelData = {
    categories: {},
    materials: {},
    expressIds: [],
    subsets: {},
  };

  const buttons = document.getElementsByClassName("dynamic");
  for (const button of buttons) {
    button.outerHTML = button.outerHTML;
  }

  const sidePanel = document.getElementById("side-panel");
  Utils.hideDomElement(sidePanel);
}

async function setMainButtonEvents(modelID) {
  const buttons = document.getElementsByClassName("dynamic");

  for (const button of buttons) {
    button.addEventListener("click", function () {
      const sidePanel = document.getElementById("side-panel");
      Utils.hideDomElement(sidePanel);
      for (const button of buttons) {
        button.style.backgroundColor = "white";
        button.style.border = "0.5px solid black";
      }

      if (button === prevButton) {
        prevButton.style.backgroundColor = "white";
        prevButton.style.border = "0.5px solid black";
        prevButton = undefined;
      } else {
        if (button.id == panelNames.Randomize) {
          colorAllCategoriesAtRandom(Object.values(categoryNameMap), modelID);
        } else {
          compileAndShowUserPanel(button.id, modelID);
        }
        button.style.backgroundColor = "navajowhite";
        button.style.border = "none";
        prevButton = button;
      }
    });
  }
}

async function colorAllCategoriesAtRandom(categories, modelID) {
  const shuffledColors = Utils.shuffle(colorSet);
  for (let i = 0; i < categories.length; i++) {
    console.log(i);
    const ids = modelData.categories[categories[i]];
    const categoryName = Object.keys(categoryNameMap)[categories[i]];
    const hexColor = parseInt(shuffledColors[i]);
    applyColorToElements(ids, hexColor, categoryName, modelID);
  }
}

async function compileAndShowUserPanel(buttonId, modelID) {
  await toggleButtonSidePanel(buttonId, modelID);
  const hexSpan = document.getElementById("hex-span");
  hexSpan.textContent = colorHexValue;
}

async function toggleButtonSidePanel(buttonId, modelID) {
  const sidePanel = document.getElementById("side-panel");
  while (sidePanel.firstChild) {
    sidePanel.removeChild(sidePanel.lastChild);
  }

  let values = [];
  if (buttonId == panelNames.Category) {
    const categoryKeys = Object.keys(modelData.categories);
    const categoryValues = Object.values(modelData.categories);
    for (let i = 0; i < categoryKeys.length; i++) {
      if (categoryValues[i].length > 0) {
        const categoryName = Object.keys(categoryNameMap).find(
          (key) => categoryNameMap[key] === categoryKeys[i]
        );
        values.push(categoryName);
      }
    }
  } else if (buttonId == panelNames.Material) {
    values = Object.keys(modelData.materials);
  }
  await populateSidePanel(buttonId, sidePanel, values, modelID);
  Utils.showDomElement(sidePanel);

  window.ondblclick = () => {
    Utils.hideDomElement(sidePanel);
    if (prevButton != undefined) {
      prevButton.style.backgroundColor = "white";
      prevButton.style.border = "0.5px solid black";
      prevButton = undefined;
    }
  };
}

async function populateSidePanel(buttonId, sidePanel, valueList, modelID) {
  const dropdownContainer = Utils.createAndSetDomElementAttributes("div", ["id"], ["dropdown"]);

  sidePanel.appendChild(createPanelContent(dropdownContainer, buttonId, valueList));

  const dropdownSelections = document.getElementById("dropdown").querySelectorAll("li");

  await createColorPicker();
  createPanelFooter();

  await dropdownEvents(dropdownSelections);
  applyPanelFooterEvents(buttonId, modelID);
}

function applyPanelFooterEvents(buttonId, modelID) {
  const buttonApply = document.getElementById("apply-button");
  const buttonReset = document.getElementById("reset-button");

  buttonApply.addEventListener("click", async function () {
    await applyColorsEventLogic(buttonId, modelID);
  });
  buttonReset.addEventListener("click", async function () {
    await removeElementsFromScene(modelSubsets);
  });
}

async function applyColorsEventLogic(buttonId, modelID) {
  let matchingElementIds = undefined;
  const currentDropdownText = prevDropdown.textContent;

  if (buttonId == panelNames.Category) {
    const categoryString = categoryNameMap[currentDropdownText];
    matchingElementIds = modelData.categories[categoryString];
  } else if (buttonId == panelNames.Material) {
    matchingElementIds = await collectElementsWithMaterials(currentDropdownText, modelID);
  }
  await removeSingleSubset(currentDropdownText);
  applyColorToElements(matchingElementIds, colorResult, currentDropdownText, modelID);
}

function createPanelFooter() {
  const panelFooterDiv = Utils.createAndSetDomElementAttributes("div", ["id"], ["panel-footer"]);
  const colorPickerDiv = document.getElementById("color-picker");
  colorPickerDiv.appendChild(panelFooterDiv);

  const hexSpan = Utils.createAndSetDomElementAttributes("span", ["id"], ["hex-span"]);
  const buttonReset = Utils.createAndSetDomElementAttributes("a", ["id"], ["reset-button"]);
  const buttonApply = Utils.createAndSetDomElementAttributes("a", ["id"], ["apply-button"]);

  const iconReset = Utils.createAndSetDomElementAttributes(
    "i",
    ["class"],
    ["panel-icon fa-solid fa-rotate-right fa-1x"]
  );
  const iconApply = Utils.createAndSetDomElementAttributes(
    "i",
    ["class"],
    ["panel-icon fa-solid fa-check fa-1x"]
  );
  buttonReset.appendChild(iconReset);
  buttonApply.appendChild(iconApply);

  panelFooterDiv.appendChild(hexSpan);
  panelFooterDiv.appendChild(buttonReset);
  panelFooterDiv.appendChild(buttonApply);
}

function createPanelContent(dropdownContainer, buttonId, values) {
  const dropdownSpan = Utils.createAndSetDomElementAttributes(
    "span",
    ["id"],
    ["title-span"],
    "Color by " + buttonId + ":"
  );
  dropdownContainer.appendChild(dropdownSpan);

  const dropdownDiv = Utils.createAndSetDomElementAttributes("div", ["id"], ["dropdown-content"]);
  const dropdownUl = Utils.createAndSetDomElementAttributes(
    "ul",
    ["id", "tabindex", "role"],
    ["elem_list", "0", "listbox"]
  );
  for (const value of values) {
    const dropdownLi = Utils.createAndSetDomElementAttributes(
      "li",
      ["id", "role"],
      [value, "option"],
      value
    );
    dropdownUl.appendChild(dropdownLi);
  }
  dropdownDiv.appendChild(dropdownUl);
  dropdownContainer.appendChild(dropdownDiv);

  const colorDiv = Utils.createAndSetDomElementAttributes("div", ["id"], ["color-picker"]);
  dropdownContainer.appendChild(colorDiv);

  return dropdownContainer;
}

async function dropdownEvents(selections) {
  for (const dropdown of selections) {
    dropdown.addEventListener("click", async function () {
      for (const dropdown of selections) {
        dropdown.style.backgroundColor = "white";
      }
      prevDropdown = dropdown;
      dropdown.style.backgroundColor = "rgb(240, 240, 240)";
    });
  }
}

async function collectElementsWithMaterials(materialName, modelID) {
  const matchingElementIds = [];
  for (const id of modelData.expressIds) {
    const materialNames = {};

    const materialProps = await ifcManager.getMaterialsProperties(modelID, id, true);
    if (materialProps[0] != undefined) {
      filterMaterialByType(id, materialProps[0], materialNames);
    }

    if (Object.keys(materialNames).length > 0 && materialName in materialNames) {
      matchingElementIds.push(id);
    }
  }
  return matchingElementIds;
}

async function applyColorToElements(expressIds, hex, currentDropdownText, modelID) {
  const highlightMaterial = new MeshLambertMaterial({
    transparent: true,
    opacity: 0.5,
    color: hex,
    depthTest: false,
  });

  const subset = await createSubsetFromIds(expressIds, highlightMaterial, modelID);

  modelData.subsets[`${currentDropdownText}`] = subset;
  scene.add(subset);
  modelSubsets.push(subset);
}

async function createColorPicker() {
  const colorPickerDiv = document.getElementById("color-picker");
  colorPicker = new iro.ColorPicker("#color-picker", {
    width: 100,
    color: "#ff0000",
    layout: [
      {
        component: iro.ui.Wheel,
      },
    ],
  });

  colorPicker.on(["color:init", "color:change"], function (color) {
    colorHexValue = color.hexString.toUpperCase();
    colorResult = parseInt(colorHexValue.replace("#", "0x"), 16);
    if (document.getElementById("hex-span")) {
      document.getElementById("hex-span").textContent = colorHexValue;
    }
  });

  const dropdown = document.getElementById("dropdown");
  dropdown.appendChild(colorPickerDiv);
}

async function compileModelData(modelID) {
  for (const categoryName of Object.keys(IfcCategories)) {
    const category = IfcCategories[categoryName];
    const ids = await ifcManager.getAllItemsOfType(modelID, category, true);
    const expressIDs = ids.map((id) => id.expressID);
    modelData.categories[`${categoryName}`] = expressIDs;

    modelData.expressIds = [...modelData.expressIds, ...expressIDs];
    const materialsObjects = await collectElementsMaterials(expressIDs, modelID);
    const materialNames = await materialNamesFromObjects(materialsObjects);
    modelData.materials = { ...modelData.materials, ...materialNames };
  }
}

async function materialNamesFromObjects(materialsObjects) {
  const materialNames = {};
  Object.keys(materialsObjects).forEach((id) => {
    filterMaterialByType(id, materialsObjects[id][0], materialNames);
  });

  return materialNames;
}

async function filterMaterialByType(id, item, materialNames) {
  let matArray;
  const itemType = item.type;
  if (itemType === 1303795690) {
    matArray = item.ForLayerSet.MaterialLayers;
    Utils.decodeMaterialLayersItem(matArray, id, materialNames);
  } else if (itemType === 3303938423) {
    matArray = item.MaterialLayers;
    Utils.decodeMaterialLayersItem(matArray, id, materialNames);
  } else if (itemType === 2199411900) {
    for (const material of item.Materials) {
      Utils.decodeMaterialItem(material, id, materialNames);
    }
  } else {
    Utils.decodeMaterialItem(item, id, materialNames);
  }
}

async function collectElementsMaterials(expressIDs, modelID) {
  const materials = {};
  for (const id of expressIDs) {
    const materialProps = await ifcManager.getMaterialsProperties(modelID, id, true);
    if (materialProps.length > 0) {
      materials[id] = materialProps;
    }
  }
  return materials;
}

async function removeSingleSubset(currentDropdownText) {
  const subsetToRemove = modelData.subsets[`${currentDropdownText}`];
  scene.remove(subsetToRemove);
}

async function removeElementsFromScene(elements) {
  for (const element of elements) {
    scene.remove(element);
  }
}

async function createSubsetFromIds(ids, pickedMaterial, modelID) {
  const subset = ifcManager.createSubset({
    modelID: modelID,
    material: pickedMaterial,
    ids,
    scene,
    removePrevious: true,
  });

  return subset;
}
