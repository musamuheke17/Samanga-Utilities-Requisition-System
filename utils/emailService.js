const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

// ===== SEND APPROVAL REQUEST =====
const sendApprovalRequest = async (toEmail, requisition, roleKey, roleLabel) => {
  if (!toEmail || toEmail === 'undefined' || toEmail === 'null') {
    console.log('⚠️ Skipping email: No valid email provided');
    return;
  }

  const displayRole = roleLabel || roleKey || 'Approver';
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const editUrl = `${baseUrl}/edit-requisition?id=${requisition._id}&role=${roleKey}`;

  // Build items table with editable fields using HTML
  let itemsHtml = requisition.items.map((item, index) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">
        <strong>${item.itemName}</strong>
        ${item.originalQuantity && item.originalQuantity !== item.quantity ? 
          `<div style="color:#888;font-size:11px;">Original: ${item.originalQuantity} x $${(item.originalUnitPrice || 0).toFixed(2)}</div>` : ''}
      </td>
      <td style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">
        <input type="number" name="qty_${index}" value="${item.quantity}" 
               min="0" step="1" style="width:60px;padding:4px;border:1px solid #ddd;border-radius:4px;text-align:center;">
      </td>
      <td style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">
        <input type="number" name="price_${index}" value="${item.unitPrice || 0}" 
               min="0" step="0.01" style="width:80px;padding:4px;border:1px solid #ddd;border-radius:4px;text-align:center;">
      </td>
      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd; font-weight: bold;">
        $${(item.quantity * (item.unitPrice || 0)).toFixed(2)}
      </td>
    </tr>
  `).join('');

  // Build the email HTML with inline editing
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: `📋 Requisition ${requisition.referenceNumber} - Pending Your Approval (${displayRole})`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="text-align: center; border-bottom: 3px solid #1a73e8; padding-bottom: 20px; margin-bottom: 25px;">
            <h1 style="color: #1a73e8; margin: 0;">📋 Samanga Utilities</h1>
            <p style="color: #555; font-size: 16px; margin: 5px 0 0;">Requisition Approval System</p>
          </div>

          <!-- Requisition Details -->
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #1a73e8;">
            <h3 style="margin: 0 0 10px 0; color: #1a73e8;">📄 Requisition Details</h3>
            <p style="margin: 5px 0;"><strong>Reference:</strong> ${requisition.referenceNumber}</p>
            <p style="margin: 5px 0;"><strong>Project:</strong> ${requisition.projectName}</p>
            <p style="margin: 5px 0;"><strong>Voucher:</strong> ${requisition.voucherNumber}</p>
            <p style="margin: 5px 0;"><strong>Requestor:</strong> ${requisition.requestor.name} (${requisition.requestor.email})</p>
            <p style="margin: 5px 0;"><strong>Department:</strong> ${requisition.requestor.department || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Your Role:</strong> ${displayRole}</p>
          </div>

          <!-- Editable Items Table -->
          <div style="margin: 20px 0; padding: 15px; background: #fff8e1; border-radius: 8px; border: 2px solid #ffc107;">
            <h3 style="margin: 0 0 10px 0; color: #e65100;">✏️ Items - Edit Directly Below</h3>
            <p style="color: #666; font-size: 13px; margin: 0 0 10px 0;">
              <strong>💡 Instructions:</strong> Update quantities or prices directly, then click "Save Changes" below.
            </p>
            
            <form action="${baseUrl}/api/requisitions/${requisition._id}/items" method="POST">
              <input type="hidden" name="role" value="${roleKey}">
              <input type="hidden" name="redirect" value="${editUrl}">
              
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: #1a73e8; color: white;">
                    <th style="padding: 10px; text-align: left;">Item</th>
                    <th style="padding: 10px; text-align: center;">Quantity</th>
                    <th style="padding: 10px; text-align: center;">Unit Price ($)</th>
                    <th style="padding: 10px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${requisition.items.map((item, index) => `
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #eee;">
                        <strong>${item.itemName}</strong>
                        ${item.originalQuantity && item.originalQuantity !== item.quantity ? 
                          `<div style="color:#888;font-size:11px;">🔹 Original: ${item.originalQuantity} x $${(item.originalUnitPrice || 0).toFixed(2)}</div>` : ''}
                      </td>
                      <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">
                        <input type="number" name="qty_${index}" value="${item.quantity}" 
                               min="0" step="1" style="width:60px;padding:6px;border:2px solid #ddd;border-radius:4px;text-align:center;font-size:14px;">
                      </td>
                      <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">
                        <input type="number" name="price_${index}" value="${item.unitPrice || 0}" 
                               min="0" step="0.01" style="width:80px;padding:6px;border:2px solid #ddd;border-radius:4px;text-align:center;font-size:14px;">
                      </td>
                      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee; font-weight: bold;">
                        $${(item.quantity * (item.unitPrice || 0)).toFixed(2)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background: #e3f2fd; font-weight: bold;">
                    <td colspan="3" style="padding: 10px; text-align: right; font-size: 16px;">GRAND TOTAL</td>
                    <td style="padding: 10px; text-align: right; font-size: 16px; color: #1a73e8;">
                      $${requisition.items.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <!-- Save Changes Button -->
              <div style="margin: 15px 0; text-align: center;">
                <button type="submit" style="background: #1a73e8; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
                  💾 Save Changes
                </button>
                <span style="color: #888; font-size: 12px; margin-left: 10px;">(Changes saved before approval)</span>
              </div>
            </form>
          </div>

          <!-- Comments Section -->
          <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">💬 Comments</h3>
            
            <form action="${baseUrl}/api/requisitions/${requisition._id}/comment" method="POST">
              <input type="hidden" name="role" value="${roleKey}">
              <input type="hidden" name="redirect" value="${editUrl}">
              
              <textarea name="comment" placeholder="Write your comment here..." 
                        style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; min-height: 60px; font-family: Arial; font-size: 14px; box-sizing: border-box;"></textarea>
              <div style="margin-top: 8px; text-align: right;">
                <button type="submit" style="background: #2e7d32; color: white; border: none; padding: 8px 20px; border-radius: 5px; font-size: 14px; cursor: pointer;">
                  ➕ Add Comment
                </button>
              </div>
            </form>

            ${requisition.comments && requisition.comments.length > 0 ? 
              `<div style="margin-top: 15px; max-height: 150px; overflow-y: auto; background: white; padding: 10px; border-radius: 5px;">
                ${requisition.comments.map(c => `
                  <div style="padding: 8px; border-bottom: 1px solid #eee;">
                    <strong style="color: #1a73e8;">${c.author?.name || 'Unknown'}</strong> 
                    <span style="color: #888; font-size: 12px;">(${c.author?.role || 'User'})</span>
                    <p style="margin: 5px 0 0 0; font-size: 14px;">${c.comment}</p>
                  </div>
                `).join('')}
              </div>` : 
              `<p style="color: #888; font-size: 14px;">No comments yet.</p>`
            }
          </div>

          <!-- Approval Actions -->
          <div style="margin: 20px 0; padding: 15px; background: #e8f5e9; border-radius: 8px; border: 2px solid #2e7d32;">
            <h3 style="margin: 0 0 10px 0; color: #2e7d32;">✅ Approval Actions</h3>
            <p style="color: #555; font-size: 14px; margin: 0 0 10px 0;">
              <strong>💡 Tip:</strong> Make sure you've saved any changes above before approving.
            </p>
            
            <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
              <a href="${baseUrl}/api/requisitions/${requisition._id}/approve?role=${roleKey}&status=approved" 
                 style="display: inline-block; background: #2e7d32; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
                ✅ Approve
              </a>
              <a href="${baseUrl}/api/requisitions/${requisition._id}/approve?role=${roleKey}&status=rejected" 
                 style="display: inline-block; background: #c62828; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
                ❌ Reject
              </a>
              <a href="${editUrl}" 
                 style="display: inline-block; background: #1a73e8; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
                📋 Full Edit Page
              </a>
            </div>
            
            <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 5px; font-size: 13px; color: #856404;">
              <strong>📌 Note:</strong> To add a comment with your approval/rejection, use the "Full Edit Page" link or the comment box above before approving.
            </div>
          </div>

          <!-- Tracking & Info -->
          <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
            <p style="margin: 0; color: #0d47a1; font-size: 13px;">
              🔗 <a href="${baseUrl}/tracking" style="color: #0d47a1; text-decoration: none;">Track this requisition</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center;">
            <p style="color: #888; font-size: 12px; margin: 0;">
              📌 This is an automated notification from <strong>Samanga Utilities System</strong>
            </p>
            <p style="color: #999; font-size: 11px; margin: 5px 0 0;">
              Reference: ${requisition.referenceNumber} | ${new Date().toLocaleString()}
            </p>
          </div>

        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Approval email sent to ${toEmail} (${displayRole})`);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
  }
};

// ===== SEND STATUS UPDATE =====
const sendStatusUpdate = async (toEmail, requisition, statusMessage) => {
  if (!toEmail || toEmail === 'undefined' || toEmail === 'null') {
    console.log('⚠️ Skipping email: No valid email provided');
    return;
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: `📋 Requisition ${requisition.referenceNumber} - ${statusMessage}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; border-bottom: 2px solid #1a73e8; padding-bottom: 15px; margin-bottom: 20px;">
            <h1 style="color: #1a73e8; margin: 0;">📋 Samanga Utilities</h1>
            <p style="color: #555; font-size: 16px;">Requisition Status Update</p>
          </div>

          <h2 style="color: #333; text-align: center;">${statusMessage}</h2>

          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>Reference Number:</strong> ${requisition.referenceNumber}</p>
            <p><strong>Project Name:</strong> ${requisition.projectName}</p>
            <p><strong>Requestor:</strong> ${requisition.requestor.name}</p>
            <p><strong>Current Status:</strong> ${requisition.status.replace(/_/g, ' ').toUpperCase()}</p>
          </div>

          <div style="margin: 20px 0; padding: 15px; background: #e3f2fd; border-radius: 8px;">
            <h3 style="margin-top: 0;">📌 Tracking History</h3>
            <ul style="padding-left: 20px;">
              ${requisition.trackingHistory.slice(-3).reverse().map(t => `
                <li style="margin: 5px 0;">${t.action} - ${t.comment || ''}</li>
              `).join('')}
            </ul>
            <p style="margin-top: 10px;"><a href="${baseUrl}/tracking" style="color: #1a73e8;">View full tracking details →</a></p>
          </div>

          <div style="margin-top: 30px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
            <p style="color: #666; font-size: 14px; margin: 0;">📌 Automated notification from Samanga Utilities System</p>
          </div>
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

// ===== SEND TO MULTIPLE RECIPIENTS =====
const sendToMultiple = async (emails, requisition, roleKey, roleLabel) => {
  for (const email of emails) {
    if (email && email !== 'undefined' && email !== 'null') {
      await sendApprovalRequest(email, requisition, roleKey, roleLabel);
    }
  }
};

module.exports = { sendApprovalRequest, sendStatusUpdate, sendToMultiple };