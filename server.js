require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const requisitionController = require('./controllers/requisitionController');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// ===== MONGODB CONNECTION =====
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/samanga_requisition')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ===== ROUTES =====

// --- Serve HTML Pages ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'requisition-form.html'));
});

app.get('/requisition-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'requisition-form.html'));
});

app.get('/tracking', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tracking.html'));
});

// ✅ FIX 1: Edit Requisition Page Route
app.get('/edit-requisition', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'edit-requisition.html'));
});

// ===== API ROUTES =====

// ✅ FIX 2: Create Requisition
app.post('/api/requisitions', requisitionController.createRequisition);

// ✅ FIX 3: Update Items (POST and PUT support)
app.post('/api/requisitions/:id/items', requisitionController.updateItems);
app.put('/api/requisitions/:id/items', requisitionController.updateItems);

// ✅ FIX 4: Add Comment (POST)
app.post('/api/requisitions/:id/comment', requisitionController.addComment);

// ✅ FIX 5: Process Approval (GET and POST support)
app.get('/api/requisitions/:id/approve', requisitionController.processApproval);
app.post('/api/requisitions/:id/approve', requisitionController.processApproval);
app.put('/api/requisitions/:id/approve', requisitionController.processApproval);

// ✅ FIX 6: Get Requisition with Tracking
app.get('/api/requisitions/:id/tracking', requisitionController.getRequisitionWithTracking);

// ✅ FIX 7: Get by Status
app.get('/api/requisitions/status/:status', requisitionController.getRequisitionsByStatus);

// ✅ FIX 8: Get All Requisitions
app.get('/api/requisitions', requisitionController.getAllRequisitions);

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Form: http://localhost:${PORT}/requisition-form`);
  console.log(`📊 API: http://localhost:${PORT}/api/requisitions`);
  console.log(`✏️ Edit: http://localhost:${PORT}/edit-requisition`);
});