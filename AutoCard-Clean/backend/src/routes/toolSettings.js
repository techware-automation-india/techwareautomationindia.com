import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETTINGS_FILE = path.join(__dirname, "../../data/tools_settings.json");

const DEFAULT_SETTINGS = {
  categories: ["Tools", "Project"],
  productTypes: ["Mechanical", "Electrical", "Other"],
  projects: ["AutoCard Assembly Line 1", "AutoCard Assembly Line 2", "Project Titan", "Other / Custom Project"],
};

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      const dir = path.dirname(SETTINGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      return DEFAULT_SETTINGS;
    }
    const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(content);
    return {
      categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : DEFAULT_SETTINGS.categories,
      productTypes: Array.isArray(parsed.productTypes) && parsed.productTypes.length > 0 ? parsed.productTypes : DEFAULT_SETTINGS.productTypes,
      projects: Array.isArray(parsed.projects) && parsed.projects.length > 0 ? parsed.projects : DEFAULT_SETTINGS.projects,
    };
  } catch (err) {
    console.error("Error reading tools settings file:", err);
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings) {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return true;
  } catch (err) {
    console.error("Error writing tools settings file:", err);
    return false;
  }
}

// GET /api/tools-settings - fetch dynamic categories, product types, and projects
router.get("/", requireAuth, (_req, res) => {
  const settings = readSettings();
  res.json(settings);
});

// PUT /api/tools-settings - update categories, product types, and projects
router.put("/", requireAuth, (req, res) => {
  const { categories, productTypes, projects } = req.body;

  const current = readSettings();
  const nextCategories = Array.isArray(categories)
    ? categories.map((c) => String(c).trim()).filter(Boolean)
    : current.categories;

  const nextProductTypes = Array.isArray(productTypes)
    ? productTypes.map((p) => String(p).trim()).filter(Boolean)
    : current.productTypes;

  const nextProjects = Array.isArray(projects)
    ? projects.map((pr) => String(pr).trim()).filter(Boolean)
    : current.projects;

  const updated = {
    categories: nextCategories.length > 0 ? nextCategories : DEFAULT_SETTINGS.categories,
    productTypes: nextProductTypes.length > 0 ? nextProductTypes : DEFAULT_SETTINGS.productTypes,
    projects: nextProjects.length > 0 ? nextProjects : DEFAULT_SETTINGS.projects,
  };

  writeSettings(updated);
  res.json({ settings: updated, message: "Tools & Equipment settings updated successfully." });
});

export default router;
