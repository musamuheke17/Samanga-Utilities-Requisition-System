const Requisition = require('../models/Requisition');
const { sendApprovalRequest, sendStatusUpdate, sendToMultiple } = require('../utils/emailService');

// ===== APPROVAL FLOW =====
const APPROVAL_FLOW = {
  supervisor: {
    email: process.env.SUPERVISOR_EMAIL || 'rogers.dembe@samangasolutions.com',
    role: 'supervisor',
    label: 'Project Supervisor'
  },
  procurement: {
    emails: [
      process.env.PROCUREMENT_EMAIL_1 || 'justin.oketch@samangasolutions.com',
      process.env.PROCUREMENT_EMAIL_2 || 'baron.rukuuta@samangasolutions.com',
      process.env.PROCUREMENT_EMAIL_3 || 'irene.kayaga@samangasolutions.com'
    ],
    role: 'procurement',
    label: 'Procurement Office'
  },
  ceo: {
    email: process.env.CEO_EMAIL || 'rahel.nkya@samangasolutions.com',
    role: 'ceo',
    label: 'CEO'
  },
  manager: {
    email: process.env.MANAGER_EMAIL || 'emma.lokech@samangasolutions.com',
    role: 'manager',
    label: 'Project Manager'
  },
  finance: {
    emails: [
      process.env.FINANCE_EMAIL_1 || 'judith.kafuko@samangasolutions.com',
      process.env.FINANCE_EMAIL_2 || 'vivian.akenyo@samangasolutions.com'
    ],
    role: 'finance',
    label: 'Finance Department'
  }
};

const APPROVAL_ORDER = ['supervisor', 'procurement', 'ceo', 'manager', 'finance'];

const getNextApprover = (currentRole) => {
  const currentIndex = APPROVAL_ORDER.indexOf(currentRole);
  return currentIndex < APPROVAL_ORDER.length - 1 ? APPROVAL_ORDER[currentIndex + 1] : null;
};

// ===== CREATE REQUISITION =====
const createRequisition = async (req, res) => {
  try {
    const { projectName, voucherNumber, items, requestor } = req.body;

    const itemsWithTracking = items.map(item => ({
      ...item,
      originalQuantity: item.quantity,
      originalUnitPrice: item.unitPrice || 0,
      totalPrice: (item.quantity || 0) * (item.unitPrice || 0)
    }));

    const requisition = new Requisition({
      projectName,
      voucherNumber,
      items: itemsWithTracking,
      requestor: {
        name: requestor.name,
        email: requestor.email,
        department: requestor.department || 'General'
      },
      approvals: [
        { role: 'supervisor', approverEmail: APPROVAL_FLOW.supervisor.email, status: 'pending' },
        { role: 'procurement', approverEmail: 'procurement@samangasolutions.com', status: 'pending' },
        { role: 'ceo', approverEmail: APPROVAL_FLOW.ceo.email, status: 'pending' },
        { role: 'manager', approverEmail: APPROVAL_FLOW.manager.email, status: 'pending' },
        { role: 'finance', approverEmail: 'finance@samangasolutions.com', status: 'pending' }
      ],
      comments: [{
        author: {
          name: requestor.name,
          email: requestor.email,
          role: 'Requestor'
        },
        comment: `Initial requisition submitted for ${projectName}`
      }],
      trackingHistory: [{
        action: 'Submitted',
        fromRole: 'Requestor',
        toRole: 'Project Supervisor',
        comment: `Requisition submitted by ${requestor.name}`
      }]
    });

    await requisition.save();

    await sendApprovalRequest(
      APPROVAL_FLOW.supervisor.email,
      requisition,
      'supervisor',
      'Project Supervisor'
    );

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

// ===== ADD COMMENT =====
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, role } = req.body;

    console.log('📝 Adding comment to:', id);
    console.log('📝 Comment:', comment);
    console.log('📝 Role:', role);

    const requisition = await Requisition.findById(id);
    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    if (!requisition.comments) {
      requisition.comments = [];
    }

    const roleConfig = APPROVAL_FLOW[role];
    const authorName = roleConfig?.label || role || 'Unknown';
    const authorEmail = roleConfig?.email || 'unknown@samangasolutions.com';

    requisition.comments.push({
      author: {
        name: authorName,
        email: authorEmail,
        role: role || 'Unknown'
      },
      comment: comment
    });

    await requisition.save();

    // Check if there's a redirect (for email form submissions)
    if (req.body.redirect) {
      return res.redirect(req.body.redirect);
    }

    res.json({
      success: true,
      message: 'Comment added successfully',
      data: requisition
    });

  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message
    });
  }
};

// ===== UPDATE ITEMS =====
const updateItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, role } = req.body;

    console.log('📦 Updating items for:', id);
    console.log('📦 Items:', items);

    const requisition = await Requisition.findById(id);
    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Check if user is allowed to edit
    const currentApproval = requisition.approvals.find(a => a.status === 'pending');
    if (!currentApproval) {
      return res.status(403).json({
        success: false,
        message: 'No pending approval found'
      });
    }

    // Get items from request body (supports both array and object with items array)
    let itemsArray = items;
    if (typeof itemsArray === 'string') {
      try {
        itemsArray = JSON.parse(itemsArray);
      } catch (e) {
        // Not JSON, keep as is
      }
    }

    // If items is not an array, try to extract from form data
    if (!Array.isArray(itemsArray)) {
      // Handle form data: qty_0, price_0, qty_1, price_1, etc.
      const formItems = [];
      let index = 0;
      while (req.body[`qty_${index}`] !== undefined) {
        const qty = parseFloat(req.body[`qty_${index}`]) || 0;
        const price = parseFloat(req.body[`price_${index}`]) || 0;
        formItems.push({ quantity: qty, unitPrice: price });
        index++;
      }
      if (formItems.length > 0) {
        itemsArray = formItems;
      }
    }

    if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid items provided'
      });
    }

    itemsArray.forEach((updatedItem, index) => {
      if (requisition.items[index]) {
        // Save original values if not already saved
        if (!requisition.items[index].originalQuantity) {
          requisition.items[index].originalQuantity = requisition.items[index].quantity;
        }
        if (!requisition.items[index].originalUnitPrice) {
          requisition.items[index].originalUnitPrice = requisition.items[index].unitPrice || 0;
        }

        requisition.items[index].quantity = updatedItem.quantity || updatedItem.qty || 0;
        requisition.items[index].unitPrice = updatedItem.unitPrice || updatedItem.price || 0;
        requisition.items[index].totalPrice = (requisition.items[index].quantity || 0) * (requisition.items[index].unitPrice || 0);
        requisition.items[index].editedBy = {
          role: role || currentApproval.role,
          email: 'unknown@samangasolutions.com',
          date: new Date()
        };
      }
    });

    requisition.trackingHistory.push({
      action: 'Items Edited',
      fromRole: role || currentApproval.role,
      toRole: role || currentApproval.role,
      comment: `Items updated by ${role || currentApproval.role}`
    });

    await requisition.save();

    // Check if there's a redirect (for email form submissions)
    if (req.body.redirect) {
      return res.redirect(req.body.redirect);
    }

    res.json({
      success: true,
      message: 'Items updated successfully',
      data: requisition
    });

  } catch (error) {
    console.error('Error updating items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update items',
      error: error.message
    });
  }
};

// ===== PROCESS APPROVAL =====
const processApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, status, comment } = req.query;

    console.log('✅ Processing approval for:', id);
    console.log('✅ Role:', role);
    console.log('✅ Status:', status);
    console.log('✅ Comment:', comment);

    const requisition = await Requisition.findById(id);
    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Check if approval exists
    const approval = requisition.approvals.find(a => a.role === role);
    if (!approval) {
      return res.status(400).json({
        success: false,
        message: `Invalid role: ${role}`
      });
    }

    // Check if already processed
    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This requisition has already been ${approval.status}`
      });
    }

    // Add comment if provided
    if (comment) {
      if (!requisition.comments) {
        requisition.comments = [];
      }
      const roleConfig = APPROVAL_FLOW[role];
      requisition.comments.push({
        author: {
          name: roleConfig?.label || role,
          email: approval.approverEmail || 'unknown@samangasolutions.com',
          role: role
        },
        comment: comment
      });
    }

    // Update approval
    approval.status = status;
    approval.comment = comment || '';
    approval.date = new Date();

    const nextRole = getNextApprover(role);

    requisition.trackingHistory.push({
      action: status === 'approved' ? 'Approved' : 'Rejected',
      fromRole: role,
      toRole: nextRole || 'Completed',
      comment: comment || `${role} ${status} the requisition`
    });

    // If rejected
    if (status === 'rejected') {
      requisition.status = 'rejected';
      
      await sendStatusUpdate(
        requisition.requestor.email,
        requisition,
        `❌ Requisition Rejected by ${APPROVAL_FLOW[role]?.label || role}`
      );

      await requisition.save();
      return res.redirect('/tracking?message=Requisition+Rejected');
    }

    // Check if all approvals are done
    const allApproved = requisition.approvals.every(a => a.status === 'approved');

    if (allApproved) {
      requisition.status = 'completed';
      
      await sendStatusUpdate(
        requisition.requestor.email,
        requisition,
        '✅ All approvals completed! Requisition is now complete.'
      );
      
      // Notify Finance
      const financeEmails = APPROVAL_FLOW.finance.emails.filter(e => e && e !== 'undefined' && e !== 'null');
      if (financeEmails.length > 0) {
        await sendToMultiple(
          financeEmails,
          requisition,
          'finance',
          'Finance Department - Payment Release'
        );
      }
    } else if (nextRole) {
      const nextApproverConfig = APPROVAL_FLOW[nextRole];
      
      if (nextApproverConfig && nextApproverConfig.emails && nextApproverConfig.emails.length > 0) {
        const validEmails = nextApproverConfig.emails.filter(e => e && e !== 'undefined' && e !== 'null');
        if (validEmails.length > 0) {
          await sendToMultiple(
            validEmails,
            requisition,
            nextRole,
            nextApproverConfig.label
          );
        }
      } else if (nextApproverConfig && nextApproverConfig.email) {
        await sendApprovalRequest(
          nextApproverConfig.email,
          requisition,
          nextRole,
          nextApproverConfig.label
        );
      }
      
      requisition.status = `${nextRole}_approved`;
    }

    await requisition.save();

    res.redirect('/tracking?message=Requisition+Approved');

  } catch (error) {
    console.error('Error processing approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process approval',
      error: error.message
    });
  }
};

// ===== GET REQUISITION WITH TRACKING =====
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
        approvals: requisition.approvals,
        comments: requisition.comments || []
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

// ===== GET ALL REQUISITIONS =====
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

// ===== GET REQUISITIONS BY STATUS =====
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

module.exports = {
  createRequisition,
  addComment,
  updateItems,
  processApproval,
  getRequisitionWithTracking,
  getAllRequisitions,
  getRequisitionsByStatus
};