const nodemailer = require('nodemailer');

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
    subject: `📋 Requisition ${requisition.referenceNumber} - Pending Your Approval`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a73e8;">📋 Requisition Pending Approval</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <p><strong>Reference Number:</strong> ${requisition.referenceNumber}</p>
          <p><strong>Project Name:</strong> ${requisition.projectName}</p>
          <p><strong>Requestor:</strong> ${requisition.requestor.name}</p>
          <p><strong>Requestor Email:</strong> ${requisition.requestor.email}</p>
          <p><strong>Voucher Number:</strong> ${requisition.voucherNumber}</p>
          <p><strong>Status:</strong> Awaiting <strong>${approverRole}</strong> approval</p>
        </div>
        <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107;">
          <h3>📝 Items Requested</h3>
          <ul>
            ${requisition.items.map(item => `
              <li>${item.itemName} - Quantity: ${item.quantity}</li>
            `).join('')}
          </ul>
        </div>
        <div style="margin: 20px 0; padding: 15px; background: #e8f5e9; border-radius: 8px;">
          <h3>🔗 Quick Actions</h3>
          <p><strong>Approve:</strong> <a href="${process.env.BASE_URL}/api/requisitions/${requisition._id}/approve?role=${approverRole}&status=approved" style="color: green;">Click to Approve</a></p>
          <p><strong>Reject:</strong> <a href="${process.env.BASE_URL}/api/requisitions/${requisition._id}/approve?role=${approverRole}&status=rejected" style="color: red;">Click to Reject</a></p>
        </div>
        <div style="margin-top: 30px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
          <p style="color: #666; font-size: 14px;">📌 This is an automated notification from Samanga Utilities System</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Approval email sent to ${toEmail}`);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
  }
};

const sendStatusUpdate = async (toEmail, requisition, statusMessage) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: `📋 Requisition ${requisition.referenceNumber} - ${statusMessage}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a73e8;">📋 Requisition Status Update</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <p><strong>Reference Number:</strong> ${requisition.referenceNumber}</p>
          <p><strong>Project Name:</strong> ${requisition.projectName}</p>
          <p><strong>Requestor:</strong> ${requisition.requestor.name}</p>
          <p><strong>Current Status:</strong> ${statusMessage}</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Status email sent to ${toEmail}`);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
  }
};

module.exports = { sendApprovalRequest, sendStatusUpdate };