using System.Net;
using System.Net.Mail;

namespace FileBlogSystem.Services;

public class EmailService
{
    private readonly SmtpClient _smtpClient;
    private readonly string _fromAddress;

    public EmailService(string smtpHost, int smtpPort, string fromAddress, string smtpUser, string smtpPassword)
    {
        _fromAddress = fromAddress;
        _smtpClient = new SmtpClient(smtpHost, smtpPort)
        {
            Credentials = new NetworkCredential(smtpUser, smtpPassword),
            EnableSsl = true
        };
    }

    public async Task SendPasswordResetEmail(string toEmail, string username, string resetToken)
    {
        string resetLink = $"https://yourdomain.com/reset-password.html?token={Uri.EscapeDataString(resetToken)}";

        string body = $@"
            <h2>Password Reset Requested</h2>
            <p>Hi {username},</p>
            <p>Click the link below to reset your password:</p>
            <p><a href='{resetLink}'>{resetLink}</a></p>
            <p>This link will expire in 15 minutes.</p>";

        MailMessage message = new MailMessage(_fromAddress, toEmail)
        {
            Subject = "Reset Your Password",
            Body = body,
            IsBodyHtml = true
        };

        await _smtpClient.SendMailAsync(message);
    }
}
