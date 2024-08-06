const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 44300;

app.use(express.json());

const filePath = path.join(__dirname, 'tab_schedule.json');

// Serve the JSON file
app.get('/tab_schedule.json', (req, res) => {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Error reading file');
    }
    res.header('Content-Type', 'application/json');
    res.send(data);
  });
});

// Update the JSON file
app.post('/tab_schedule.json', (req, res) => {
  const schedule = req.body;
  fs.writeFile(filePath, JSON.stringify(schedule, null, 2), 'utf8', (err) => {
    if (err) {
      return res.status(500).send('Error writing file');
    }
    res.send('Schedule updated successfully');
  });
});

app.listen(PORT, () => {
  console.log(`Server running at https://localhost:${PORT}`);
});
