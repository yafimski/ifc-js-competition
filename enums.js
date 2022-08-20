import {
  IFCWALLSTANDARDCASE,
  IFCSLAB,
  IFCFURNISHINGELEMENT,
  IFCDOOR,
  IFCWINDOW,
  IFCPLATE,
  IFCMEMBER,
} from "web-ifc";

export const IfcCategories = {
  IFCWALLSTANDARDCASE,
  IFCSLAB,
  IFCFURNISHINGELEMENT,
  IFCDOOR,
  IFCWINDOW,
  IFCPLATE,
  IFCMEMBER,
};

export const categoryNameMap = {
  Walls: "IFCWALLSTANDARDCASE",
  Slabs: "IFCSLAB",
  Furniture: "IFCFURNISHINGELEMENT",
  Doors: "IFCDOOR",
  Windows: "IFCWINDOW",
  CurtainPanels: "IFCPLATE",
  StructuralMembers: "IFCMEMBER",
};

export const panelNames = {
  Category: "Category",
  Material: "Material",
};
