using System.Text.Json.Serialization;

namespace FileBlogSystem.Models;

public class User
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string ProfilePictureUrl { get; set; } = string.Empty;
    public string Bio { get; set; } = string.Empty;
    public DateTime LastLoginDate { get; set; }
    public bool IsActive { get; set; } = true;

    public string? ResetToken { get; set; }
    public DateTime? ResetTokenExpiration { get; set; }
    public bool? ResetTokenVerified { get; set; }
}