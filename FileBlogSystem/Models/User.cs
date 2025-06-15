using System.Text.Json.Serialization;

namespace FileBlogSystem.Models;
public class User
{
    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "Author";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}