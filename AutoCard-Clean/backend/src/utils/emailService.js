import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logoPath = path.join(__dirname, "../images/techwareLogo.jpg");

/**
 * Create reusable email transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send welcome email to new employee with login credentials
 * @param {Object} params - Email parameters
 * @param {string} params.employeeEmail - Employee email address
 * @param {string} params.employeeName - Employee full name
 * @param {string} params.employeeCode - Employee code
 * @param {string} params.password - Plain text password
 * @param {string} params.loginUrl - Login URL
 */
export const sendWelcomeEmail = async ({
  employeeEmail,
  employeeName,
  employeeCode,
  password,
  loginUrl = "http://localhost:5173/login/employee",
}) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Techware Automation India" <${process.env.EMAIL_USER}>`,
      to: employeeEmail,
      subject: "Welcome Aboard! Your Techware Automation India Account is Ready",
       attachments: [
    {
      filename: "techwareLogo.jpg",
      path: logoPath,
      cid: "companylogo",
    },
  ],
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.6; 
              color: #2c3e50;
              background: #f5f5f5;
            }
            .email-container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: #ffffff;
              border: 1px solid #ddd;
              font-size: 14px;
            }
            .header {
              background: #ffffff;
              padding: 30px;
              text-align: center;
              border-bottom: 2px solid #2A3791;
            }
            .logo-section {
              margin-bottom: 20px;
            }
            .logo-image {
              width: 80px;
              height: auto;
              margin-bottom: 15px;
            }
            .company-name {
              font-size: 24px;
              font-weight: 700;
              color: #2A3791;
              margin-bottom: 8px;
              letter-spacing: 1px;
            }
            .tagline {
              font-size: 13px;
              color: #666;
              margin-bottom: 3px;
            }
            .welcome-msg {
              font-size: 13px;
              color: #666;
              font-style: italic;
            }
            .divider {
              border-top: 2px solid #2A3791;
              margin: 20px 0;
            }
            .content { 
              padding: 30px;
            }
            .section-header {
              font-size: 14px;
              font-weight: 700;
              color: #2A3791;
              margin: 20px 0 15px 0;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .employee-details {
              background: #f9f9f9;
              padding: 15px;
              border-left: 3px solid #339DE0;
              margin-bottom: 20px;
              font-size: 13px;
              line-height: 1.8;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .detail-label {
              font-weight: 600;
              color: #2A3791;
              min-width: 100px;
            }
            .detail-value {
              color: #333;
              word-break: break-word;
            }
            .steps-list {
              list-style: none;
              padding-left: 0;
              font-size: 13px;
              line-height: 1.8;
            }
            .steps-list li {
              padding: 6px 0 6px 25px;
              position: relative;
              color: #333;
            }
            .steps-list li:before {
              content: counter(step);
              counter-increment: step;
              position: absolute;
              left: 0;
              font-weight: 700;
              color: #2A3791;
              font-size: 12px;
            }
            .steps-list {
              counter-reset: step;
            }
            .help-section {
              background: #f0f7ff;
              padding: 15px;
              border-left: 3px solid #339DE0;
              margin-top: 20px;
              font-size: 13px;
            }
            .help-title {
              font-weight: 700;
              color: #2A3791;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .help-item {
              margin: 5px 0;
              color: #333;
            }
            .help-link {
              color: #2A3791;
              text-decoration: none;
              font-weight: 600;
            }
            .footer {
              background: #2c3e50;
              color: #ecf0f1;
              text-align: center;
              padding: 20px;
              font-size: 11px;
              border-top: 2px solid #2A3791;
            }
            .footer-content {
              margin-bottom: 8px;
            }
            .footer-logo {
              font-weight: 700;
              font-size: 14px;
              margin-bottom: 5px;
              letter-spacing: 1px;
            }
            .footer-copyright {
              color: #bbb;
              margin-top: 8px;
              border-top: 1px solid #34495e;
              padding-top: 8px;
            }
            @media only screen and (max-width: 600px) {
              .email-container { margin: 0; }
              .content { padding: 20px; }
              .header { padding: 20px; }
              .detail-row { flex-direction: column; }
              .detail-label { margin-bottom: 4px; }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <!-- Header Section with Logo -->
            <div class="header">
              <div class="logo-section">
                <img
                  src="cid:companylogo"
                  alt="Techware Automation India"
                  class="logo-image"
                />
              </div>
              <div class="company-name">Techware Automation India</div>
              <div class="tagline">Welcome to Our Team</div>
              <div class="welcome-msg">Thank you for joining us. We're excited to have you as part of our team.</div>
            </div>

            <div class="divider"></div>

            <!-- Main Content -->
            <div class="content">
              <!-- Employee Details Section -->
              <div class="section-header">👤 Employee Details</div>
              <div class="employee-details">
                <div class="detail-row">
                  <div class="detail-label">Name</div>
                  <div class="detail-value">${employeeName}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Employee ID</div>
                  <div class="detail-value">${employeeCode}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Email</div>
                  <div class="detail-value">${employeeEmail}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Password</div>
                  <div class="detail-value" style="font-family: 'Courier New', monospace; font-weight: 600; border-bottom: 1px dashed #339DE0; padding-bottom: 4px;">${password}</div>
                </div>
              </div>

              <div class="divider"></div>

              <!-- Onboarding Steps Section -->
              <div class="section-header">✔ Complete Your Onboarding</div>
              <ol class="steps-list">
                <li>Login to your account</li>
                <li>Upload Profile Photo</li>
                <li>Fill Personal Details</li>
                <li>Add Bank Details</li>
                <li>Add Emergency Contact</li>
                <li>Submit Onboarding Form</li>
                <li>Wait for HR Approval</li>
              </ol>

              <!-- Help Section -->
              <div class="help-section">
                <div class="help-title">📧 Need Help?</div>
                <div class="help-item">Email: <a href="mailto:hr@techwareautomationindia.com" class="help-link">hr@techwareautomationindia.com</a></div>
                <div class="help-item">Website: <a href="https://www.techwareautomationindia.com" class="help-link">www.techwareautomationindia.com</a></div>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <div class="footer-content">
                <div class="footer-logo">
                <img
                  src="cid:companylogo"
                  alt="Techware Automation India"
                  class="logo-image"
                />
                </div>
                <div>Techware Automation India</div>
              </div>
              <div class="footer-copyright">
                © Techware Automation India
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
════════════════════════════════════════════
        TECHWARE AUTOMATION INDIA
════════════════════════════════════════════

Welcome to Our Team

Thank you for joining us. We're excited to have you as part of our team.

════════════════════════════════════════════

👤 Employee Details

Name          : ${employeeName}
Employee ID   : ${employeeCode}
Email         : ${employeeEmail}
Password      : ${password}

════════════════════════════════════════════

✔ Complete Your Onboarding

1. Login to your account
2. Upload Profile Photo
3. Fill Personal Details
4. Add Bank Details
5. Add Emergency Contact
6. Submit Onboarding Form
7. Wait for HR Approval

════════════════════════════════════════════

Need Help?

📧 hr@techwareautomationindia.com
🌐 www.techwareautomationindia.com

════════════════════════════════════════════

© Techware Automation India
This is an automated message from our HR Management System.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Email] Welcome email sent to ${employeeEmail} - Message ID: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ [Email] Failed to send welcome email to ${employeeEmail}:`, error);
    throw error;
  }
};

/**
 * Send welcome email to new customer with login credentials
 * @param {Object} params - Email parameters
 * @param {string} params.customerEmail - Customer email address
 * @param {string} params.customerName - Customer full name
 * @param {string} params.companyName - Company name (optional)
 * @param {string} params.password - Plain text password
 * @param {string} params.loginUrl - Login URL
 */
export const sendCustomerWelcomeEmail = async ({
  customerEmail,
  customerName,
  companyName,
  password,
  loginUrl = "http://localhost:5173/login/customer",
}) => {
  try {
    const transporter = createTransporter();

    const supportEmail = "support@techwareautomationindia.com";
    const companyWebsite = "www.techwareautomationindia.com";

    const mailOptions = {
      from: `"Techware Automation India" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: "Welcome to Techware Automation India",
      attachments: [
        {
          filename: "techwareLogo.jpg",
          path: logoPath,
          cid: "companylogo",
        },
      ],
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.8; 
              color: #333333;
              background: #f4f4f4;
            }
            .email-container { 
              max-width: 600px; 
              margin: 30px auto; 
              background: #ffffff;
              border: 1px solid #e0e0e0;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header {
              background: #ffffff;
              padding: 30px 30px 20px 30px;
              text-align: center;
              border-bottom: 3px solid #2A3791;
            }
            .logo-image {
              width: 100px;
              height: auto;
              margin-bottom: 15px;
            }
            .company-name {
              font-size: 26px;
              font-weight: 700;
              color: #2A3791;
              margin-bottom: 5px;
              letter-spacing: 0.5px;
            }
            .content { 
              padding: 40px 30px;
            }
            .greeting {
              font-size: 15px;
              color: #333;
              margin-bottom: 20px;
            }
            .intro-text {
              font-size: 15px;
              color: #333;
              margin-bottom: 25px;
              line-height: 1.8;
            }
            .section-title {
              font-size: 16px;
              font-weight: 700;
              color: #2A3791;
              margin: 30px 0 15px 0;
            }
            .credentials-box {
              background: #f9f9f9;
              border: 1px solid #e0e0e0;
              border-left: 4px solid #2A3791;
              padding: 20px;
              margin: 20px 0;
            }
            .credential-item {
              margin: 12px 0;
              font-size: 14px;
            }
            .credential-label {
              font-weight: 600;
              color: #2A3791;
              display: inline-block;
              width: 90px;
            }
            .credential-value {
              color: #333;
              font-weight: 500;
            }
            .password-value {
              font-family: 'Courier New', monospace;
              background: #fff;
              padding: 4px 8px;
              border: 1px dashed #2A3791;
              border-radius: 3px;
            }
            .security-note {
              background: #fff3cd;
              border: 1px solid #ffc107;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 25px 0;
              font-size: 14px;
              color: #856404;
            }
            .closing-text {
              font-size: 15px;
              color: #333;
              margin: 25px 0;
              line-height: 1.8;
            }
            .signature {
              margin-top: 30px;
              font-size: 15px;
              color: #333;
            }
            .signature-line {
              margin: 5px 0;
            }
            .company-info {
              font-weight: 600;
              color: #2A3791;
            }
            .contact-link {
              color: #2A3791;
              text-decoration: none;
            }
            .footer {
              background: #2c3e50;
              color: #ecf0f1;
              text-align: center;
              padding: 20px;
              font-size: 12px;
            }
            .footer-logo {
              width: 60px;
              height: auto;
              margin-bottom: 10px;
            }
            @media only screen and (max-width: 600px) {
              .email-container { margin: 0; }
              .content { padding: 30px 20px; }
              .header { padding: 25px 20px 15px 20px; }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <!-- Header with Logo -->
            <div class="header">
              <img
                src="cid:companylogo"
                alt="Techware Automation India"
                class="logo-image"
              />
              <div class="company-name">Techware Automation India</div>
            </div>

            <!-- Main Content -->
            <div class="content">
              <div class="greeting">Dear <strong>${customerName}</strong>,</div>
              
              <div class="intro-text">
                Welcome to <strong>Techware Automation India</strong>!
              </div>

              <div class="intro-text">
                Your customer account has been created successfully. You can now access our customer portal using the login credentials below.
              </div>

              <!-- Login Credentials -->
              <div class="section-title">Login Details</div>
              <div class="credentials-box">
                <div class="credential-item">
                  <span class="credential-label">Portal:</span>
                  <a href="${loginUrl}" class="contact-link credential-value">${loginUrl}</a>
                </div>
                <div class="credential-item">
                  <span class="credential-label">Email:</span>
                  <span class="credential-value">${customerEmail}</span>
                </div>
                <div class="credential-item">
                  <span class="credential-label">Password:</span>
                  <span class="credential-value password-value">${password}</span>
                </div>
              </div>

              <!-- Security Note -->
              <div class="security-note">
                <strong>⚠️ Security Notice:</strong> Please keep your login credentials secure and do not share them with anyone.
              </div>

              <div class="closing-text">
                If you experience any difficulty accessing your account or need assistance, our support team will be happy to help.
              </div>

              <div class="closing-text">
                Thank you for choosing <strong>Techware Automation India</strong>. We look forward to serving you.
              </div>

              <!-- Signature -->
              <div class="signature">
                <div class="signature-line">Best Regards,</div>
                <div class="signature-line company-info">Techware Automation India</div>
                <div class="signature-line">Customer Support</div>
                <div class="signature-line">
                  <a href="mailto:${supportEmail}" class="contact-link">${supportEmail}</a>
                </div>
                <div class="signature-line">
                  <a href="https://${companyWebsite}" class="contact-link">${companyWebsite}</a>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <img
                src="cid:companylogo"
                alt="Techware Automation India"
                class="footer-logo"
              />
              <div style="margin-top: 10px;">© ${new Date().getFullYear()} Techware Automation India. All Rights Reserved.</div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Dear ${customerName},

Welcome to Techware Automation India!

Your customer account has been created successfully. You can now access our customer portal using the login credentials below.

════════════════════════════════════════════
LOGIN DETAILS
════════════════════════════════════════════

Portal:   ${loginUrl}
Email:    ${customerEmail}
Password: ${password}

════════════════════════════════════════════

Please keep your login credentials secure and do not share them with anyone.

If you experience any difficulty accessing your account or need assistance, our support team will be happy to help.

Thank you for choosing Techware Automation India. We look forward to serving you.

Best Regards,

Techware Automation India
Customer Support
${supportEmail}
${companyWebsite}

════════════════════════════════════════════
© ${new Date().getFullYear()} Techware Automation India. All Rights Reserved.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Email] Customer welcome email sent to ${customerEmail} - Message ID: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ [Email] Failed to send customer welcome email to ${customerEmail}:`, error);
    throw error;
  }
};

/**
 * Send password reset notification email to customer
 * @param {Object} params - Email parameters
 * @param {string} params.customerEmail - Customer email address
 * @param {string} params.customerName - Customer full name
 * @param {string} params.companyName - Company name (optional)
 * @param {string} params.password - New password
 * @param {string} params.loginUrl - Login URL
 */
export const sendPasswordResetEmail = async ({
  customerEmail,
  customerName,
  companyName,
  password,
  loginUrl = "http://localhost:5173/login/customer",
}) => {
  try {
    const transporter = createTransporter();

    const supportEmail = "support@techwareautomationindia.com";
    const companyWebsite = "www.techwareautomationindia.com";

    const mailOptions = {
      from: `"Techware Automation India" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: "Password Reset - Techware Automation India",
      attachments: [
        {
          filename: "techwareLogo.jpg",
          path: logoPath,
          cid: "companylogo",
        },
      ],
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.8; 
              color: #333333;
              background: #f4f4f4;
            }
            .email-container { 
              max-width: 600px; 
              margin: 30px auto; 
              background: #ffffff;
              border: 1px solid #e0e0e0;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header {
              background: #ffffff;
              padding: 30px 30px 20px 30px;
              text-align: center;
              border-bottom: 3px solid #f59e0b;
            }
            .logo-image {
              width: 100px;
              height: auto;
              margin-bottom: 15px;
            }
            .company-name {
              font-size: 26px;
              font-weight: 700;
              color: #2A3791;
              margin-bottom: 5px;
              letter-spacing: 0.5px;
            }
            .content { 
              padding: 40px 30px;
            }
            .greeting {
              font-size: 15px;
              color: #333;
              margin-bottom: 20px;
            }
            .intro-text {
              font-size: 15px;
              color: #333;
              margin-bottom: 25px;
              line-height: 1.8;
            }
            .alert-box {
              background: #fff3cd;
              border: 1px solid #f59e0b;
              border-left: 4px solid #f59e0b;
              padding: 20px;
              margin: 25px 0;
              border-radius: 5px;
            }
            .alert-title {
              font-size: 16px;
              font-weight: 700;
              color: #92400e;
              margin-bottom: 10px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .section-title {
              font-size: 16px;
              font-weight: 700;
              color: #2A3791;
              margin: 30px 0 15px 0;
            }
            .credentials-box {
              background: #f9f9f9;
              border: 1px solid #e0e0e0;
              border-left: 4px solid #f59e0b;
              padding: 20px;
              margin: 20px 0;
            }
            .credential-item {
              margin: 12px 0;
              font-size: 14px;
            }
            .credential-label {
              font-weight: 600;
              color: #f59e0b;
              display: inline-block;
              width: 90px;
            }
            .credential-value {
              color: #333;
              font-weight: 500;
            }
            .password-value {
              font-family: 'Courier New', monospace;
              background: #fff;
              padding: 4px 8px;
              border: 1px dashed #f59e0b;
              border-radius: 3px;
              font-size: 16px;
              font-weight: 600;
            }
            .security-note {
              background: #fef3c7;
              border: 1px solid #fcd34d;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 25px 0;
              font-size: 14px;
              color: #92400e;
            }
            .closing-text {
              font-size: 15px;
              color: #333;
              margin: 25px 0;
              line-height: 1.8;
            }
            .signature {
              margin-top: 30px;
              font-size: 15px;
              color: #333;
            }
            .signature-line {
              margin: 5px 0;
            }
            .company-info {
              font-weight: 600;
              color: #2A3791;
            }
            .contact-link {
              color: #2A3791;
              text-decoration: none;
            }
            .footer {
              background: #2c3e50;
              color: #ecf0f1;
              text-align: center;
              padding: 20px;
              font-size: 12px;
            }
            .footer-logo {
              width: 60px;
              height: auto;
              margin-bottom: 10px;
            }
            @media only screen and (max-width: 600px) {
              .email-container { margin: 0; }
              .content { padding: 30px 20px; }
              .header { padding: 25px 20px 15px 20px; }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <!-- Header with Logo -->
            <div class="header">
              <img
                src="cid:companylogo"
                alt="Techware Automation India"
                class="logo-image"
              />
              <div class="company-name">Techware Automation India</div>
            </div>

            <!-- Main Content -->
            <div class="content">
              <div class="greeting">Dear <strong>${customerName}</strong>,</div>

              <div class="alert-box">
                <div class="alert-title">🔐 Password Reset Notification</div>
                <p style="color: #92400e; margin: 0;">
                  Your account password has been reset by our administrator.
                </p>
              </div>

              <div class="intro-text">
                This email confirms that your password for <strong>Techware Automation India</strong> customer portal has been reset. You can now log in using your new password.
              </div>

              <!-- Login Credentials -->
              <div class="section-title">Your New Login Credentials</div>
              <div class="credentials-box">
                <div class="credential-item">
                  <span class="credential-label">Portal:</span>
                  <a href="${loginUrl}" class="contact-link credential-value">${loginUrl}</a>
                </div>
                <div class="credential-item">
                  <span class="credential-label">Email:</span>
                  <span class="credential-value">${customerEmail}</span>
                </div>
                <div class="credential-item">
                  <span class="credential-label">New Password:</span>
                  <span class="credential-value password-value">${password}</span>
                </div>
              </div>

              <!-- Security Note -->
              <div class="security-note">
                <strong>⚠️ Important Security Notice:</strong><br>
                For your security, we strongly recommend changing this password after your first login. You can do this from your account settings in the customer portal.
              </div>

              <div class="closing-text">
                If you did not request this password reset or have any concerns about your account security, please contact our support team immediately.
              </div>

              <!-- Signature -->
              <div class="signature">
                <div class="signature-line">Best Regards,</div>
                <div class="signature-line company-info">Techware Automation India</div>
                <div class="signature-line">Customer Support</div>
                <div class="signature-line">
                  <a href="mailto:${supportEmail}" class="contact-link">${supportEmail}</a>
                </div>
                <div class="signature-line">
                  <a href="https://${companyWebsite}" class="contact-link">${companyWebsite}</a>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <img
                src="cid:companylogo"
                alt="Techware Automation India"
                class="footer-logo"
              />
              <div style="margin-top: 10px;">© ${new Date().getFullYear()} Techware Automation India. All Rights Reserved.</div>
              <div style="margin-top: 8px; font-size: 11px; color: #bbb;">
                This is an automated security notification from our Customer Management System.
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Dear ${customerName},

🔐 PASSWORD RESET NOTIFICATION

Your account password has been reset by our administrator.

This email confirms that your password for Techware Automation India customer portal has been reset. You can now log in using your new password.

════════════════════════════════════════════
YOUR NEW LOGIN CREDENTIALS
════════════════════════════════════════════

Portal:       ${loginUrl}
Email:        ${customerEmail}
New Password: ${password}

════════════════════════════════════════════

⚠️ IMPORTANT SECURITY NOTICE

For your security, we strongly recommend changing this password after your first login. You can do this from your account settings in the customer portal.

If you did not request this password reset or have any concerns about your account security, please contact our support team immediately.

Best Regards,

Techware Automation India
Customer Support
${supportEmail}
${companyWebsite}

════════════════════════════════════════════
© ${new Date().getFullYear()} Techware Automation India. All Rights Reserved.
This is an automated security notification from our Customer Management System.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Email] Password reset email sent to ${customerEmail} - Message ID: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ [Email] Failed to send password reset email to ${customerEmail}:`, error);
    throw error;
  }
};

/**
 * Send test email to verify email configuration
 */
export const sendTestEmail = async (toEmail) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: "Test Email - Techware Automation India",
      text: "This is a test email from Techware Automation India HR System. Email configuration is working!",
      html: "<p>This is a test email from <strong>Techware Automation India</strong>.</p><p>Email configuration is working! ✅</p>",
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Email] Test email sent - Message ID: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ [Email] Test email failed:", error);
    throw error;
  }
};

/**
 * Send roster assignment notification to an employee
 */
export const sendRosterAssignmentEmail = async ({
  employeeEmail,
  employeeName,
  date,
  shiftName,
  startTime,
  endTime,
  locationName = null,
  locationCity = null,
  note = null,
}) => {
  try {
    const transporter = createTransporter();

    const fmtDate = (d) =>
      new Date(d).toLocaleDateString("en-IN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });

    const dateLabel    = fmtDate(date);
    const locationLine = locationName
      ? `${locationName}${locationCity ? `, ${locationCity}` : ""}`
      : "Not specified";

    const mailOptions = {
      from: `"Techware Automation India" <${process.env.EMAIL_USER}>`,
      to:   employeeEmail,
      subject: `Roster Assignment — ${shiftName} on ${dateLabel}`,
      attachments: [
        { filename: "techwareLogo.jpg", path: logoPath, cid: "companylogo" },
      ],
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; line-height:1.6; color:#2c3e50; background:#f5f5f5; }
    .wrap { max-width:600px; margin:20px auto; background:#fff; border:1px solid #ddd; font-size:14px; }
    .hdr  { background:#fff; padding:28px; text-align:center; border-bottom:2px solid #2A3791; }
    .logo { width:75px; height:auto; margin-bottom:12px; }
    .co   { font-size:22px; font-weight:700; color:#2A3791; letter-spacing:1px; }
    .body { padding:28px; }
    .hi   { font-size:15px; margin-bottom:14px; }
    .lead { font-size:13px; color:#444; margin-bottom:20px; }
    .ttl  { font-size:13px; font-weight:700; color:#2A3791; margin:18px 0 10px; }
    .box  { background:#f9f9f9; border-left:3px solid #2A3791; padding:14px 16px; font-size:13px; line-height:2; }
    .row  { display:flex; gap:8px; }
    .lbl  { font-weight:600; color:#2A3791; min-width:90px; }
    .val  { color:#333; }
    .note { background:#fff8e1; border-left:3px solid #f59e0b; padding:12px 16px; margin-top:16px; font-size:13px; color:#6b4a00; }
    .foot { background:#2c3e50; color:#ecf0f1; text-align:center; padding:18px; font-size:11px; margin-top:0; }
    .flogo{ width:55px; height:auto; margin-bottom:8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <img src="cid:companylogo" alt="Techware" class="logo"/>
      <div class="co">Techware Automation India</div>
    </div>
    <div class="body">
      <div class="hi">Dear <strong>${employeeName}</strong>,</div>
      <div class="lead">
        Your roster has been updated by the admin. Please review your assigned shift details below.
      </div>
      <div class="ttl">📅 Roster Assignment</div>
      <div class="box">
        <div class="row"><span class="lbl">Date</span><span class="val">${dateLabel}</span></div>
        <div class="row"><span class="lbl">Shift</span><span class="val">${shiftName}</span></div>
        <div class="row"><span class="lbl">Timing</span><span class="val">${startTime} – ${endTime}</span></div>
        <div class="row"><span class="lbl">Location</span><span class="val">${locationLine}</span></div>
      </div>
      ${note ? `<div class="note"><strong>📝 Admin Note:</strong><br>${note}</div>` : ""}
      <div style="margin-top:22px; font-size:13px; color:#555;">
        If you have any questions, please contact HR at
        <a href="mailto:hr@techwareautomationindia.com" style="color:#2A3791;">hr@techwareautomationindia.com</a>.
      </div>
      <div style="margin-top:20px; font-size:13px; color:#333;">
        Best Regards,<br>
        <strong style="color:#2A3791;">Techware Automation India — HR Team</strong>
      </div>
    </div>
    <div class="foot">
      <img src="cid:companylogo" alt="Techware" class="flogo"/>
      <div>© ${new Date().getFullYear()} Techware Automation India. All Rights Reserved.</div>
      <div style="margin-top:5px; color:#aaa;">This is an automated notification from the HR Management System.</div>
    </div>
  </div>
</body>
</html>`,
      text: `Dear ${employeeName},

Your roster has been updated by the admin.

════════════════════════════════════════════
ROSTER ASSIGNMENT DETAILS
════════════════════════════════════════════

Date      : ${dateLabel}
Shift     : ${shiftName}
Timing    : ${startTime} – ${endTime}
Location  : ${locationLine}
${note ? `\nAdmin Note : ${note}` : ""}

════════════════════════════════════════════

For any queries, contact HR at hr@techwareautomationindia.com

Best Regards,
Techware Automation India — HR Team
© ${new Date().getFullYear()} Techware Automation India`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Email] Roster email sent to ${employeeEmail} — ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ [Email] Roster email failed for ${employeeEmail}:`, err);
    // Non-fatal — log but don't crash the roster save
    return { success: false, error: err.message };
  }
};
