using System.Text.Json;
using FileBlogSystem.Models;
namespace FileBlogSystem.Services;
public class NotificationService
{
  private readonly string _usersDirectory;

  public NotificationService(IWebHostEnvironment env)
  {
    _usersDirectory = Path.Combine(env.ContentRootPath, "UserData");
  }

  private string GetUserNotificationPath(string username)
  {
    string safeUsername = username.Replace(" ", "_"); // simple sanitization
    return Path.Combine(_usersDirectory, safeUsername, "notifications.json");
  }

  private async Task<List<Notification>> LoadNotificationsAsync(string username)
  {
    var path = GetUserNotificationPath(username);
    if (!File.Exists(path))
      return new List<Notification>();

    var json = await File.ReadAllTextAsync(path);
    return JsonSerializer.Deserialize<List<Notification>>(json) ?? new List<Notification>();
  }

  private async Task SaveNotificationsAsync(string username, List<Notification> notifications)
  {
    var path = GetUserNotificationPath(username);
    var directory = Path.GetDirectoryName(path);
    if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
      Directory.CreateDirectory(directory);

    var json = JsonSerializer.Serialize(notifications, new JsonSerializerOptions { WriteIndented = true });
    await File.WriteAllTextAsync(path, json);
  }

  public async Task NotifyAsync(string recipientUsername, string message)
  {
    var notifications = await LoadNotificationsAsync(recipientUsername);
    var nextId = notifications.Count > 0 ? notifications.Max(n => n.Id) + 1 : 1;

    notifications.Add(new Notification
    {
      Id = nextId,
      RecipientUsername = recipientUsername,
      Message = message
    });

    await SaveNotificationsAsync(recipientUsername, notifications);
  }

  public async Task<List<Notification>> GetUnreadAsync(string username)
  {
    var notifications = await LoadNotificationsAsync(username);
    return notifications.Where(n => !n.IsRead).OrderByDescending(n => n.CreatedAt).ToList();
  }

  public async Task MarkAsReadAsync(string username, int id)
  {
    var notifications = await LoadNotificationsAsync(username);
    var notif = notifications.FirstOrDefault(n => n.Id == id);
    if (notif != null)
    {
      notif.IsRead = true;
      await SaveNotificationsAsync(username, notifications);
    }
  }
}
