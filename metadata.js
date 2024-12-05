
require('dotenv').config(); // To load environment variables from .env file
const mysql = require('mysql2/promise');
const mega = require('megajs');

// Initialize the MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST, // localhost or IP address
  user: process.env.DB_USER, // Your MySQL username
  password: process.env.DB_PASSWORD, // Your MySQL password
  database: process.env.DB_NAME, // Database name
  port: 3306, // Default MySQL port
  connectionLimit: 5, // Connection pool limit
});

// Initialize MEGA storage credentials
const storage = new mega.Storage({
  email: process.env.MEGA_EMAIL, // Your MEGA email
  password: process.env.MEGA_PASSWORD, // Your MEGA password
});

// Function to upload file to MEGA and save metadata in MySQL
exports.saveFileMetadata = async (event) => {
  const { fileName, fileBuffer } = event; // Assume event contains file name and buffer

  try {
    console.log('Uploading file to MEGA...');
    
    // Upload file to MEGA
    const megaFile = storage.upload({ name: fileName }, fileBuffer);

    // Wait for upload completion
    await new Promise((resolve, reject) => {
      megaFile.on('complete', resolve);
      megaFile.on('error', reject);
    });

    // Retrieve file metadata
    const uploadedFile = storage.root.children.find((file) => file.name === fileName);
    if (!uploadedFile) {
      throw new Error('Uploaded file not found in MEGA storage.');
    }

    const fileSize = uploadedFile.size;
    const uploadTimestamp = new Date().toISOString(); // MEGA does not provide exact timestamps

    console.log(`File Metadata: Name=${fileName}, Size=${fileSize}, Uploaded At=${uploadTimestamp}`);

    // Save metadata in MySQL
    const connection = await pool.getConnection();
    const query = 'INSERT INTO file_metadata (filename, size, upload_timestamp) VALUES (?, ?, ?)';
    await connection.execute(query, [fileName, fileSize, uploadTimestamp]);
    connection.release();

    console.log('Metadata saved to database.');
  } catch (err) {
    console.error('Error processing file:', err);
  }
};

