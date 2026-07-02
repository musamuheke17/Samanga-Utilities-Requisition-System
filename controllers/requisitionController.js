const Requisition = require('../models/Requisition');
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
        comment: `Requisition submitted by ${requestor.name}`
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
        message: `Invalid role: ${role}`
      });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This requisition has already been ${approval.status}`
      });
    }

    approval.status = status;
    approval.comment = comment || '';
    approval.date = new Date();

    requisition.trackingHistory.push({
      action: status === 'approved' ? 'Approved' : 'Rejected',
      fromRole: role,
      toRole: getNextApprover(role),
      comment: comment || `${role} ${status} the requisition`
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
          requisition.status = `${nextApprover}_approved`;
        }
      }
    }

    await requisition.save();

    res.json({
      success: true,
      message: `Requisition ${status} by ${role}`,
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
};