require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const requisitionController = require('./controllers/requisitionController');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/samanga_requisition')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ===== ROUTES =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'requisition-form.html'));
});

app.get('/requisition-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'requisition-form.html'));
});

// ✅ ADD THIS NEW ROUTE
app.get('/tracking', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tracking.html'));
});

// API Routes
app.post('/api/requisitions', requisitionController.createRequisition);
app.put('/api/requisitions/:id/approve', requisitionController.processApproval);
app.get('/api/requisitions/:id/tracking', requisitionController.getRequisitionWithTracking);
app.get('/api/requisitions/status/:status', requisitionController.getRequisitionsByStatus);
app.get('/api/requisitions', requisitionController.getAllRequisitions);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Form: http://localhost:${PORT}/requisition-form`);
  console.log(`📊 API: http://localhost:${PORT}/api/requisitions`);
});