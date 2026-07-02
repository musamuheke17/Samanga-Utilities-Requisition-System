const fs = require('fs');
const path = require('path');

// Define folder structure
const folders = ['models', 'controllers', 'utils', 'public'];

// Define files with their content
const files = {
  'package.json': JSON.stringify({
    name: "samanga-requisition-system",
    version: "1.0.0",
    description: "Samanga Utilities Requisition System",
    main: "server.js",
    scripts: {
      start: "node server.js",
      dev: "nodemon server.js"
    },
    dependencies: {
      cors: "^2.8.5",
      dotenv: "^16.4.5",
      express: "^4.19.2",
      mongoose: "^8.5.2",
      nodemailer: "^6.9.13"
    },
    devDependencies: {
      nodemon: "^3.1.4"
    }
  }, null, 2),

  '.env': `PORT=3000
MONGODB_URI=mongodb://localhost:27017/samanga_requisition
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
SUPERVISOR_EMAIL=kotieng.gadafi@samangasolutions.com
MANAGER_EMAIL=musamuheke17@gmail.com
CEO_EMAIL=mm238242@students.cavendish.ac.ug
FINANCE_EMAIL=financesupport@gmail.com
BASE_URL=http://localhost:3000`,

  'server.js': `require('dotenv').config();
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'requisition-form.html'));
});

app.get('/requisition-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'requisition-form.html'));
});

app.post('/api/requisitions', requisitionController.createRequisition);
app.put('/api/requisitions/:id/approve', requisitionController.processApproval);
app.get('/api/requisitions/:id/tracking', requisitionController.getRequisitionWithTracking);
app.get('/api/requisitions/status/:status', requisitionController.getRequisitionsByStatus);
app.get('/api/requisitions', requisitionController.getAllRequisitions);

app.listen(PORT, () => {
  console.log(\`🚀 Server running on http://localhost:\${PORT}\`);
  console.log(\`📋 Form: http://localhost:\${PORT}/requisition-form\`);
  console.log(\`📊 API: http://localhost:\${PORT}/api/requisitions\`);
});`,

  'models/Requisition.js': `const mongoose = require('mongoose');

const requisitionSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true
  },
  voucherNumber: {
    type: String,
    required: [true, 'Voucher number is required'],
    unique: true,
    trim: true
  },
  items: [{
    itemName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      default: 0
    },
    totalPrice: {
      type: Number,
      default: 0
    }
  }],
  requestor: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    department: String
  },
  status: {
    type: String,
    enum: ['pending', 'supervisor_approved', 'manager_approved', 'ceo_approved', 'finance_approved', 'completed', 'rejected'],
    default: 'pending'
  },
  approvals: [{
    role: {
      type: String,
      enum: ['supervisor', 'manager', 'ceo', 'finance']
    },
    approverEmail: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    comment: String,
    date: Date
  }],
  trackingHistory: [{
    action: String,
    fromRole: String,
    toRole: String,
    comment: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  referenceNumber: {
    type: String,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

requisitionSchema.pre('save', function(next) {
  if (!this.referenceNumber) {
    const prefix = 'SAM-';
    const random = Math.floor(100000 + Math.random() * 900000);
    this.referenceNumber = prefix + random;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Requisition', requisitionSchema);`,

  'controllers/requisitionController.js': `const Requisition = require('../models/Requisition');
const { sendApprovalRequest, sendStatusUpdate } = require('../utils/emailService');

const APPROVAL_FLOW = {
  supervisor: {
    email: process.env.SUPERVISOR_EMAIL || 'kotieng.gadafi@samangasolutions.com',
    role: 'supervisor'
  },
  manager: {
    email: process.env.MANAGER_EMAIL || 'musamuheke17@gmail.com',
    role: 'manager'
  },
  ceo: {
    email: process.env.CEO_EMAIL || 'mm238242@students.cavendish.ac.ug',
    role: 'ceo'
  },
  finance: {
    email: process.env.FINANCE_EMAIL || 'financesupport@gmail.com',
    role: 'finance'
  }
};

const getNextApprover = (currentRole) => {
  const flow = ['supervisor', 'manager', 'ceo', 'finance'];
  const currentIndex = flow.indexOf(currentRole);
  return currentIndex < flow.length - 1 ? flow[currentIndex + 1] : null;
};

const createRequisition = async (req, res) => {
  try {
    const { projectName, voucherNumber, items, requestor } = req.body;

    const itemsWithTotals = items.map(item => ({
      ...item,
      totalPrice: item.quantity * (item.unitPrice || 0)
    }));

    const requisition = new Requisition({
      projectName,
      voucherNumber,
      items: itemsWithTotals,
      requestor: {
        name: requestor.name,
        email: requestor.email,
        department: requestor.department || 'General'
      },
      approvals: [
        { role: 'supervisor', approverEmail: APPROVAL_FLOW.supervisor.email, status: 'pending' },
        { role: 'manager', approverEmail: APPROVAL_FLOW.manager.email, status: 'pending' },
        { role: 'ceo', approverEmail: APPROVAL_FLOW.ceo.email, status: 'pending' },
        { role: 'finance', approverEmail: APPROVAL_FLOW.finance.email, status: 'pending' }
      ],
      trackingHistory: [{
        action: 'Submitted',
        fromRole: 'Requestor',
        toRole: 'Supervisor',
        comment: \`Requisition submitted by \${requestor.name}\`
      }]
    });

    await requisition.save();
    await sendApprovalRequest(APPROVAL_FLOW.supervisor.email, requisition, 'Supervisor');

    res.status(201).json({
      success: true,
      message: 'Requisition submitted successfully!',
      data: requisition
    });
  } catch (error) {
    console.error('Error creating requisition:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create requisition',
      error: error.message
    });
  }
};

const processApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, status, comment } = req.query;

    const requisition = await Requisition.findById(id);
    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    const approval = requisition.approvals.find(a => a.role === role);
    if (!approval) {
      return res.status(400).json({
        success: false,
        message: \`Invalid role: \${role}\`
      });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: \`This requisition has already been \${approval.status}\`
      });
    }

    approval.status = status;
    approval.comment = comment || '';
    approval.date = new Date();

    requisition.trackingHistory.push({
      action: status === 'approved' ? 'Approved' : 'Rejected',
      fromRole: role,
      toRole: getNextApprover(role),
      comment: comment || \`\${role} \${status} the requisition\`
    });

    if (status === 'rejected') {
      requisition.status = 'rejected';
      await sendStatusUpdate(requisition.requestor.email, requisition, '❌ Requisition Rejected');
      await requisition.save();
      return res.json({
        success: true,
        message: 'Requisition rejected',
        data: requisition
      });
    }

    const allApproved = requisition.approvals.every(a => a.status === 'approved');

    if (allApproved) {
      requisition.status = 'completed';
      await sendApprovalRequest(APPROVAL_FLOW.finance.email, requisition, 'Finance - Payment Release');
      await sendStatusUpdate(requisition.requestor.email, requisition, '✅ All approvals completed!');
    } else {
      const nextApprover = getNextApprover(role);
      if (nextApprover) {
        const nextApproval = requisition.approvals.find(a => a.role === nextApprover);
        if (nextApproval) {
          await sendApprovalRequest(
            nextApproval.approverEmail,
            requisition,
            nextApprover.charAt(0).toUpperCase() + nextApprover.slice(1)
          );
          requisition.status = \`\${nextApprover}_approved\`;
        }
      }
    }

    await requisition.save();

    res.json({
      success: true,
      message: \`Requisition \${status} by \${role}\`,
      data: requisition
    });
  } catch (error) {
    console.error('Error processing approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process approval',
      error: error.message
    });
  }
};

const getRequisitionWithTracking = async (req, res) => {
  try {
    const { id } = req.params;
    const requisition = await Requisition.findById(id);

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    res.json({
      success: true,
      data: {
        requisition,
        tracking: requisition.trackingHistory,
        approvals: requisition.approvals
      }
    });
  } catch (error) {
    console.error('Error fetching requisition:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requisition',
      error: error.message
    });
  }
};

const getRequisitionsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const requisitions = await Requisition.find({ status });

    res.json({
      success: true,
      count: requisitions.length,
      data: requisitions
    });
  } catch (error) {
    console.error('Error fetching requisitions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requisitions',
      error: error.message
    });
  }
};

const getAllRequisitions = async (req, res) => {
  try {
    const requisitions = await Requisition.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: requisitions.length,
      data: requisitions
    });
  } catch (error) {
    console.error('Error fetching requisitions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requisitions',
      error: error.message
    });
  }
};

module.exports = {
  createRequisition,
  processApproval,
  getRequisitionWithTracking,
  getRequisitionsByStatus,
  getAllRequisitions
};`,

  'utils/emailService.js': `const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendApprovalRequest = async (toEmail, requisition, approverRole) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: \`📋 Requisition \${requisition.referenceNumber} - Pending Your Approval\`,
    html: \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a73e8;">📋 Requisition Pending Approval</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <p><strong>Reference Number:</strong> \${requisition.referenceNumber}</p>
          <p><strong>Project Name:</strong> \${requisition.projectName}</p>
          <p><strong>Requestor:</strong> \${requisition.requestor.name}</p>
          <p><strong>Requestor Email:</strong> \${requisition.requestor.email}</p>
          <p><strong>Voucher Number:</strong> \${requisition.voucherNumber}</p>
          <p><strong>Status:</strong> Awaiting <strong>\${approverRole}</strong> approval</p>
        </div>
        <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107;">
          <h3>📝 Items Requested</h3>
          <ul>
            \${requisition.items.map(item => \`
              <li>\${item.itemName} - Quantity: \${item.quantity}</li>
            \`).join('')}
          </ul>
        </div>
        <div style="margin: 20px 0; padding: 15px; background: #e8f5e9; border-radius: 8px;">
          <h3>🔗 Quick Actions</h3>
          <p><strong>Approve:</strong> <a href="\${process.env.BASE_URL}/api/requisitions/\${requisition._id}/approve?role=\${approverRole}&status=approved" style="color: green;">Click to Approve</a></p>
          <p><strong>Reject:</strong> <a href="\${process.env.BASE_URL}/api/requisitions/\${requisition._id}/approve?role=\${approverRole}&status=rejected" style="color: red;">Click to Reject</a></p>
        </div>
        <div style="margin-top: 30px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
          <p style="color: #666; font-size: 14px;">📌 This is an automated notification from Samanga Utilities System</p>
        </div>
      </div>
    \`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(\`✅ Approval email sent to \${toEmail}\`);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
  }
};

const sendStatusUpdate = async (toEmail, requisition, statusMessage) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: \`📋 Requisition \${requisition.referenceNumber} - \${statusMessage}\`,
    html: \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a73e8;">📋 Requisition Status Update</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <p><strong>Reference Number:</strong> \${requisition.referenceNumber}</p>
          <p><strong>Project Name:</strong> \${requisition.projectName}</p>
          <p><strong>Requestor:</strong> \${requisition.requestor.name}</p>
          <p><strong>Current Status:</strong> \${statusMessage}</p>
        </div>
      </div>
    \`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(\`✅ Status email sent to \${toEmail}\`);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
  }
};

module.exports = { sendApprovalRequest, sendStatusUpdate };`,

  'public/requisition-form.html': `<!DOCTYPE html>
<html>
<head>
    <title>Samanga Utilities Requisition Form</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h2 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }
        fieldset { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
        legend { font-weight: bold; padding: 0 10px; }
        label { display: block; margin: 10px 0 5px; font-weight: bold; }
        input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
        .item-row { display: flex; gap: 10px; margin: 10px 0; align-items: center; }
        .item-row input { flex: 1; }
        .item-row button { background: #dc3545; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; }
        .btn-add { background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px 0; }
        .btn-submit { background: #1a73e8; color: white; border: none; padding: 15px 30px; border-radius: 5px; cursor: pointer; font-size: 16px; width: 100%; margin-top: 20px; }
        .btn-submit:hover { background: #1557b0; }
        .message { margin: 20px 0; padding: 15px; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <h2>📋 Samanga Utilities Requisition Form</h2>
        <form id="requisitionForm">
            <fieldset>
                <legend>👤 Requestor Information</legend>
                <div>
                    <label>Full Name:</label>
                    <input type="text" id="requestorName" required>
                </div>
                <div>
                    <label>Email:</label>
                    <input type="email" id="requestorEmail" required>
                </div>
                <div>
                    <label>Department:</label>
                    <input type="text" id="requestorDepartment">
                </div>
            </fieldset>

            <fieldset>
                <legend>📁 Project Information</legend>
                <div>
                    <label>Project Name:</label>
                    <input type="text" id="projectName" required>
                </div>
                <div>
                    <label>Voucher Number:</label>
                    <input type="text" id="voucherNumber" required>
                </div>
            </fieldset>

            <fieldset>
                <legend>📦 Items Requested</legend>
                <div id="itemsContainer">
                    <div class="item-row">
                        <input type="text" placeholder="Item Name" class="itemName" required>
                        <input type="number" placeholder="Quantity" class="itemQuantity" required>
                        <input type="number" placeholder="Unit Price" class="itemPrice">
                        <button type="button" onclick="removeItem(this)">✕</button>
                    </div>
                </div>
                <button type="button" class="btn-add" onclick="addItem()">➕ Add Item</button>
            </fieldset>

            <button type="submit" class="btn-submit">Submit Requisition</button>
        </form>

        <div id="responseMessage"></div>
    </div>

    <script>
        function addItem() {
            const container = document.getElementById('itemsContainer');
            const row = document.createElement('div');
            row.className = 'item-row';
            row.innerHTML = \`
                <input type="text" placeholder="Item Name" class="itemName" required>
                <input type="number" placeholder="Quantity" class="itemQuantity" required>
                <input type="number" placeholder="Unit Price" class="itemPrice">
                <button type="button" onclick="removeItem(this)">✕</button>
            \`;
            container.appendChild(row);
        }

        function removeItem(button) {
            if (document.querySelectorAll('.item-row').length > 1) {
                button.parentElement.remove();
            } else {
                alert('You need at least one item!');
            }
        }

        document.getElementById('requisitionForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const items = [];
            document.querySelectorAll('.item-row').forEach(row => {
                const name = row.querySelector('.itemName').value;
                const quantity = parseInt(row.querySelector('.itemQuantity').value);
                const unitPrice = parseFloat(row.querySelector('.itemPrice').value) || 0;
                if (name && quantity > 0) {
                    items.push({ itemName: name, quantity, unitPrice });
                }
            });

            if (items.length === 0) {
                alert('Please add at least one item!');
                return;
            }

            const formData = {
                projectName: document.getElementById('projectName').value,
                voucherNumber: document.getElementById('voucherNumber').value,
                requestor: {
                    name: document.getElementById('requestorName').value,
                    email: document.getElementById('requestorEmail').value,
                    department: document.getElementById('requestorDepartment').value
                },
                items: items
            };

            const messageDiv = document.getElementById('responseMessage');

            try {
                const response = await fetch('/api/requisitions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (data.success) {
                    messageDiv.className = 'message success';
                    messageDiv.innerHTML = \`
                        ✅ <strong>Requisition submitted successfully!</strong><br>
                        Reference Number: <strong>\${data.data.referenceNumber}</strong><br>
                        A notification has been sent to your supervisor for approval.
                    \`;
                    document.getElementById('requisitionForm').reset();
                    document.getElementById('itemsContainer').innerHTML = \`
                        <div class="item-row">
                            <input type="text" placeholder="Item Name" class="itemName" required>
                            <input type="number" placeholder="Quantity" class="itemQuantity" required>
                            <input type="number" placeholder="Unit Price" class="itemPrice">
                            <button type="button" onclick="removeItem(this)">✕</button>
                        </div>
                    \`;
                } else {
                    messageDiv.className = 'message error';
                    messageDiv.innerHTML = \`❌ Error: \${data.message}\`;
                }
            } catch (error) {
                messageDiv.className = 'message error';
                messageDiv.innerHTML = \`❌ Error: \${error.message}\`;
            }
        });
    </script>
</body>
</html>`
};

// Create folders
folders.forEach(folder => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    console.log(`📁 Created folder: ${folder}`);
  }
});

// Create files
Object.keys(files).forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  // Ensure the directory exists
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, files[filePath]);
  console.log(`📄 Created file: ${filePath}`);
});

console.log('✅ All files created successfully!');
console.log('🚀 Now run: npm install');
console.log('🚀 Then run: npm start');