const path = require("path");

// Lets the code use the "@/..." alias (same as in the original project).
module.exports = {
  webpack: { alias: { "@": path.resolve(__dirname, "src") } },
};
