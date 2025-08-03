using System;
namespace FileBlogSystem.Models;

public class Notification
{
    // Numeric unique identifier
    public int Id { get; set; }
    public string Message { get; set; } = string.Empty;
    public string Link { get; set; } = string.Empty;
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}