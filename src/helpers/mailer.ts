import nodemailer from "nodemailer";

// Type definitions for mail content and sendEmail options
interface EmailContentOptions {
  username: string;
  link: string;
}

interface SendEmailOptions {
  email: string;
  subject: string;
  html: string;
  text: string;
}

// Helper to build verification email content
function buildVerificationContent({ username, link }: EmailContentOptions) {
  const text = `
Hi ${username},

Welcome to our App! We're excited to have you on board.

To verify your email, please click the following link:
${link}

Need help or have questions? Just reply to this email — we'd love to help.
`;

  const html = `
  <div style="font-family:sans-serif;max-width:480px;">
    <p>Hi <b>${username}</b>,</p>
    <p>Welcome to our App! We're excited to have you on board.</p>
    <p>
      <b>To verify your email, please click the button below:</b>
    </p>
    <p>
      <a href="${link}" 
         style="display:inline-block;
                padding:10px 20px;
                background:#22BC66;
                color:white;
                border-radius:4px;
                text-decoration:none;">
        Verify your email
      </a>
    </p>
    <p>Need help or have questions? Just reply to this email — we'd love to help.</p>
  </div>
  `;
  return { html, text };
}

// Helper to build a forgot password email
function buildForgotPasswordContent({ username, link }: EmailContentOptions) {
  const text = `
Hi ${username},

We received a request to reset your account password.

To reset your password, please use the following link:
${link}

Need help or have questions? Just reply to this email — we'd love to help.
`;

  const html = `
  <div style="font-family:sans-serif;max-width:480px;">
    <p>Hi <b>${username}</b>,</p>
    <p>We received a request to reset your account password.</p>
    <p>
      <b>To reset your password, click below:</b>
    </p>
    <p>
      <a href="${link}"
         style="display:inline-block;
                padding:10px 20px;
                background:#22BC66;
                color:white;
                border-radius:4px;
                text-decoration:none;">
        Reset password
      </a>
    </p>
    <p>Need help or have questions? Just reply to this email — we'd love to help.</p>
  </div>
  `;
  return { html, text };
}

// Send email function
const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: process.env.MAILTRAP_SMTP_HOST,
    port: Number(process.env.MAILTRAP_SMTP_PORT),
    auth: {
      user: process.env.MAILTRAP_SMTP_USER,
      pass: process.env.MAILTRAP_SMTP_PASS,
    },
  });

  const mail = {
    from: "mail.taskmanager@example.com",
    to: options.email,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    await transporter.sendMail(mail);
  } catch (error) {
    console.error(
      "Email service failed silently. Make sure that MAILTRAP credentials are set in the .env file.",
    );
    console.error("Error:", error);
  }
};

// Exposed email content generators with type compatibility for your existing usage
function emailVerificationMailgenContent(username: string, verificationUrl: string) {
  return buildVerificationContent({ username, link: verificationUrl });
}

function forgotPasswordMailgenContent(username: string, passwordResetUrl: string) {
  return buildForgotPasswordContent({ username, link: passwordResetUrl });
}

export {
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
  sendEmail,
};
