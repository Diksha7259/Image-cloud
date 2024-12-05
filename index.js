
const express = require("express");
const multer = require("multer");
const dotenv = require("dotenv");
const path = require("path");
const mysql = require("mysql2/promise");
const mega = require("megajs");

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up static files directory
app.use(express.static(path.join(__dirname, "public")));

// Set up multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
});

// Connect to MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306,
  connectionLimit: 5,
});

// Connect to MEGA
let megaStorage;
(async () => {
  megaStorage = await new mega.Storage({
    email: process.env.MEGA_EMAIL,
    password: process.env.MEGA_PASSWORD,
  });

  const folderName = "imageupload";
  let folder = megaStorage.root.children.find((child) => child.name === folderName);
  if (!folder) {
    folder = megaStorage.root.createFolder(folderName);
  }
  console.log("Connected to MEGA.");
  console.log(`'${folderName}' folder ready.`);
})().catch((err) => {
  console.error("Error connecting to MEGA:", err);
});

// File upload route
app.post("/upload", upload.single("imgfile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const { buffer, originalname } = req.file;

    // Upload file to MEGA
    const folder = megaStorage.root.children.find((child) => child.name === "imageupload");
    if (!folder) throw new Error("MEGA folder not found.");

    const megaFile = folder.upload({ name: originalname }, buffer);

    await new Promise((resolve, reject) => {
      megaFile.on("complete", resolve);
      megaFile.on("error", reject);
    });

    // Save metadata to MySQL
    const connection = await pool.getConnection();
    const query = "INSERT INTO file_metadata (filename, size, upload_timestamp) VALUES (?, ?, ?)";
    await connection.execute(query, [originalname, buffer.length, new Date()]);
    connection.release();

    res.status(200).json({
      message: "File uploaded successfully!",
      fileName: originalname,
    });
  } catch (error) {
    console.error("Error uploading file:", error.message);
    res.status(500).send("File upload failed.");
  }
});

// Serve the front-end
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
