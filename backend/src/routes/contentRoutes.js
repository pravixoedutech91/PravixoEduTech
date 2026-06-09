const express = require("express");
const router = express.Router();

const {
  createContent,
  getAllContent,
  getContentBySlug,
  updateContent,
  deleteContent,
} = require("../controllers/contentController");

// Create Content
router.post("/", createContent);

// Get All Content
router.get("/", getAllContent);

// Get Single Content By Slug
router.get("/:slug", getContentBySlug);

//update content
router.put("/:id", updateContent);

//delete content
router.delete("/:id", deleteContent);

module.exports = router;