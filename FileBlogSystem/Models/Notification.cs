namespace FileBlogSystem.Models;
public class Notification
{
  public int Id { get; set; }
  public string RecipientUsername { get; set; } = string.Empty;
  public string Message { get; set; } = string.Empty;
  public bool IsRead { get; set; } = false;
  public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
