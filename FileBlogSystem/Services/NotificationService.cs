using System.Collections.Concurrent;
using System.Text.Json;
using FileBlogSystem.Hubs;
using FileBlogSystem.Models;
using Microsoft.AspNetCore.SignalR;
namespace FileBlogSystem.Services;
public class NotificationService
{
  private readonly string _usersDirectory;
  private readonly IHubContext<NotificationHub> _hubContext;
  // A dictionary of locks to prevent race conditions when modifying a user's notification file.
  private readonly ConcurrentDictionary<string, SemaphoreSlim> _userLocks = new();

  public NotificationService(IWebHostEnvironment env, IHubContext<NotificationHub> hubContext)
  {
    _hubContext = hubContext;
    _usersDirectory = Path.Combine(env.ContentRootPath, "UserData");
  }

  private string GetUserNotificationPath(string username)
  {
    // A more robust way to create a safe filename from a username.
    // This prevents path traversal attacks (e.g., "..\..\etc\passwd")
    // and handles other invalid characters.
    string safeUsername = string.Join("_", username.Split(Path.GetInvalidFileNameChars()));
    if (string.IsNullOrWhiteSpace(safeUsername))
    {
      throw new ArgumentException("Username results in an empty or invalid file path.", nameof(username));
    }
    return Path.Combine(_usersDirectory, safeUsername, "notifications.json");
  }

  private async Task<List<Notification>> LoadNotificationsAsync(string username)
  {
    var path = GetUserNotificationPath(username);
    if (!File.Exists(path))
      return new List<Notification>();

    try
    {
      var json = await File.ReadAllTextAsync(path);
      // If the file is empty or just whitespace, return an empty list to avoid deserialization errors.
      if (string.IsNullOrWhiteSpace(json))
      {
        return new List<Notification>();
      }
      return JsonSerializer.Deserialize<List<Notification>>(json) ?? new List<Notification>();
    }
    catch (JsonException ex)
    {
      // It's crucial to handle cases where the JSON file might be corrupted.
      // Consider injecting a logger here to record the error.
      // Re-throwing ensures the operation fails instead of overwriting a corrupt file with a new one.
      Console.WriteLine($"Error deserializing notifications for user '{username}': {ex.Message}");
      throw;
    }
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
    // Get or create a lock specific to this user to ensure thread safety.
    var userLock = _userLocks.GetOrAdd(recipientUsername, _ => new SemaphoreSlim(1, 1));

    await userLock.WaitAsync();
    try
    {
      var notifications = await LoadNotificationsAsync(recipientUsername);
      // Using .Any() is slightly more expressive than .Count > 0
      var nextId = notifications.Any() ? notifications.Max(n => n.Id) + 1 : 1;
      
      var newNotification = new Notification
      {
        Id = nextId,
        RecipientUsername = recipientUsername,
        Message = message
      };

      notifications.Add(newNotification);
      await SaveNotificationsAsync(recipientUsername, notifications);

      var unreadCount = notifications.Count(n => !n.IsRead);
      // After successfully saving, send a real-time notification to the user if they are connected.
      // SignalR will find the connection(s) associated with this user identifier.
      await _hubContext.Clients.User(recipientUsername).SendAsync("ReceiveNotification", newNotification);
      await _hubContext.Clients.User(recipientUsername).SendAsync("UpdateUnreadCount", unreadCount);
    }
    finally
    {
      userLock.Release();
    }
  }

  public async Task<List<Notification>> GetUnreadAsync(string username)
  {
    // Reading can be done without a lock if we assume it's okay to read slightly stale data
    // while a write operation is in progress. For this use case, that's a safe assumption.
    var notifications = await LoadNotificationsAsync(username);
    return notifications.Where(n => !n.IsRead).OrderByDescending(n => n.CreatedAt).ToList();
  }

  public async Task MarkAsReadAsync(string username, int id)
  {
    // A lock is required here to prevent race conditions with other write operations.
    var userLock = _userLocks.GetOrAdd(username, _ => new SemaphoreSlim(1, 1));

    await userLock.WaitAsync();
    try
    {
      var notifications = await LoadNotificationsAsync(username);
      var notif = notifications.FirstOrDefault(n => n.Id == id);
      if (notif != null && !notif.IsRead)
      {
        notif.IsRead = true;
        await SaveNotificationsAsync(username, notifications);
        
        var unreadCount = notifications.Count(n => !n.IsRead);
        // Notify the client that a notification was read so the UI can update the unread count.
        await _hubContext.Clients.User(username).SendAsync("NotificationMarkedAsRead", id);
        await _hubContext.Clients.User(username).SendAsync("UpdateUnreadCount", unreadCount);
      }
    }
    finally
    {
      userLock.Release();
    }
  }
}
