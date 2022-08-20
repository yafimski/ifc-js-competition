import { Color, MeshLambertMaterial } from "three";
import { IFCLoader } from "web-ifc-three";
import { IfcViewerAPI } from "web-ifc-viewer";
import { IfcCategories, categoryNameMap, panelNames } from "./enums.js";
import * as Utils from "./utils.js";

const container = document.getElementById("viewer-container");
const viewer = new IfcViewerAPI({
  container,
  backgroundColor: new Color(0xffffff),
});
viewer.grid.setGrid();
viewer.axes.setAxes();
const scene = viewer.context.getScene();

let loader = viewer.IFC.loader.ifcManager;

let models = [];
let modelData = {
  categories: {},
  materials: {},
  expressIds: [],
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
    console.log(input.files[0]);

    if (models.length > 0) {
      console.log("Purging Models...");
      await purgeModels();
    }

    console.log(models.length);

    const url = URL.createObjectURL(input.files[0]);
    const model = await viewer.IFC.loadIfcUrl(url);
    models.push(model);
    scene.add(model);

    console.log(models);

    viewer.context.renderer.postProduction.active = true;
    await compileModelData();

    console.log(model.modelID);
    console.log(modelData);

    await setMainButtonEvents();
  },
  false
);

async function purgeModels() {
  removeElementsFromScene(models);
  removeElementsFromScene(modelSubsets);
  modelData = {
    categories: {},
    materials: {},
    expressIds: [],
  };

  loader = null;
  loader = new IFCLoader();
  loader = viewer.IFC.loader.ifcManager;

  const buttons = document.getElementsByClassName("dynamic");
  for (const button of buttons) {
    button.outerHTML = button.outerHTML;
  }

  // const sidePanel = document.getElementById("side-panel");
  // sidePanel.firstChild.remove();
}

async function setMainButtonEvents() {
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
        compileAndShowUserPanel(button.id);
        button.style.backgroundColor = "navajowhite";
        button.style.border = "none";
        prevButton = button;
      }
    });
  }
}

async function compileAndShowUserPanel(buttonId) {
  await toggleButtonSidePanel(buttonId);
  const hexSpan = document.getElementById("hex-span");
  hexSpan.textContent = colorHexValue;
}

async function toggleButtonSidePanel(buttonId) {
  const sidePanel = document.getElementById("side-panel");
  while (sidePanel.firstChild) {
    sidePanel.removeChild(sidePanel.lastChild);
  }

  let values = [];
  if (buttonId == panelNames.Category) {
    values = Object.keys(categoryNameMap);
  } else if (buttonId == panelNames.Material) {
    values = Object.keys(modelData.materials);
  }
  await populateSidePanel(buttonId, sidePanel, values);
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

async function populateSidePanel(buttonId, sidePanel, valueList) {
  const dropdownContainer = Utils.createAndSetDomElementAttributes("div", ["id"], ["dropdown"]);

  sidePanel.appendChild(createPanelContent(dropdownContainer, buttonId, valueList));

  const dropdownSelections = document.getElementById("dropdown").querySelectorAll("li");

  await createColorPicker();
  createPanelFooter();

  await applyDropdownEvents(dropdownSelections);
  applyPanelFooterEvents(buttonId);
}

function applyPanelFooterEvents(buttonId) {
  const buttonApply = document.getElementById("apply-button");
  const buttonReset = document.getElementById("reset-button");

  buttonApply.addEventListener("click", async function () {
    await applyColorsEventLogic(buttonId);
  });
  buttonReset.addEventListener("click", async function () {
    await removeElementsFromScene(modelSubsets);
  });
}

async function applyColorsEventLogic(buttonId) {
  let matchingElementIds = undefined;
  const currentDropdownText = prevDropdown.textContent;

  if (buttonId == panelNames.Category) {
    const categoryString = categoryNameMap[currentDropdownText];
    matchingElementIds = modelData.categories[categoryString];
  } else if (buttonId == panelNames.Material) {
    matchingElementIds = await collectElementsWithMaterials(currentDropdownText);
  }

  await removeSingleSubset(matchingElementIds, currentDropdownText, loader);
  applyColorToElements(matchingElementIds, colorResult, currentDropdownText);
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
    ["ss_elem_list", "0", "listbox"]
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

async function applyDropdownEvents(selections) {
  for (const dropdown of selections) {
    dropdown.addEventListener("click", async function () {
      for (const dropdown of selections) {
        dropdown.style.backgroundColor = "white";
      }
      prevDropdown = dropdown;
      dropdown.style.backgroundColor = "rgb(241, 240, 237)";
    });
  }
}

async function collectElementsWithMaterials(materialName) {
  const matchingElementIds = [];
  for (const id of modelData.expressIds) {
    const materialNames = {};

    const materialProps = await loader.getMaterialsProperties(models[0].modelID, id, true);
    if (materialProps[0] != undefined) {
      filterMaterialByType(id, materialProps[0], materialNames);
    }

    if (Object.keys(materialNames).length > 0 && materialName in materialNames) {
      matchingElementIds.push(id);
    }
  }
  return matchingElementIds;
}

async function applyColorToElements(expressIds, hex, currentDropdownText) {
  const highlightMaterial = new MeshLambertMaterial({
    transparent: true,
    opacity: 0.6,
    color: hex,
    depthTest: false,
  });

  const subset = await createSubsetFromIds(expressIds, highlightMaterial, currentDropdownText);
  console.log(subset);
  console.log(subset.id);
  console.log(subset.name);

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

async function compileModelData() {
  for (const categoryName of Object.keys(IfcCategories)) {
    const category = IfcCategories[categoryName];
    const ids = await loader.getAllItemsOfType(0, category, true);
    const expressIDs = ids.map((id) => id.expressID);
    modelData.categories[`${categoryName}`] = expressIDs;

    modelData.expressIds = [...modelData.expressIds, ...expressIDs];

    const materialsObjects = await collectElementsMaterials(expressIDs);
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

async function collectElementsMaterials(expressIDs) {
  const materials = {};
  for (const id of expressIDs) {
    const materialProps = await loader.getMaterialsProperties(models[0].modelID, id, true);
    if (materialProps.length > 0) {
      materials[id] = materialProps;
    }
  }
  return materials;
}

async function removeSingleSubset(ids, customIdPrefix) {
  const customIdString = Utils.compileCustomId(ids, customIdPrefix);
  console.log(customIdString);
  console.log(modelSubsets);
  // ifcLoader.clearSubset(models[0].modelID, ids, customIdString);
  // const relevantSubset = ifcLoader.getSubset(models[0].modelID, customIdString);
  // console.log(relevantSubset);
  // ifcLoader.removeFromSubset(models[0].modelID, ids, customIdString)
  for (const subset of modelSubsets) {
    if (subset.customID == customIdString) {
      scene.remove(subset);
    }
  }
}

async function removeElementsFromScene(elements) {
  for (const element of elements) {
    scene.remove(element);
  }
  elements = [];
}

async function createSubsetFromIds(ids, pickedMaterial, currentDropdownText) {
  const customIdString = Utils.compileCustomId(ids, currentDropdownText);

  return loader.createSubset({
    modelID: models[0].modelID,
    material: pickedMaterial,
    ids,
    scene,
    removePrevious: true,
    customID: customIdString,
  });
}
