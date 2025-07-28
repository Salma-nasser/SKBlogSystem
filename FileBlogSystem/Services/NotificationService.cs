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
    // Store notifications in Content/users/{username}
    _usersDirectory = Path.Combine(env.ContentRootPath, "Content", "users");
    Console.WriteLine($"NotificationService initialized. Users directory: {_usersDirectory}");
  }

  private string GetUserNotificationPath(string username)
  {
    // A more robust way to create a safe filename from a username.
    // This prevents path traversal attacks (e.g., "..\..\etc\passwd")
    // and handles other invalid characters.
    string safeUsername = string.Join("_", username.Split(Path.GetInvalidFileNameChars()));
    if (string.IsNullOrWhiteSpace(safeUsername))
    {
      Console.WriteLine($"[NotificationService] Invalid username for notification path: '{username}'");
      throw new ArgumentException("Username results in an empty or invalid file path.", nameof(username));
    }
    var path = Path.Combine(_usersDirectory, safeUsername, "notifications.json");
    Console.WriteLine($"[NotificationService] Notification path for '{username}': {path}");
    return path;
  }

  // Return all notifications (read and unread)
  public async Task<List<Notification>> GetAllAsync(string username)
  {
    var notifications = await LoadNotificationsAsync(username);
    return notifications.OrderByDescending(n => n.CreatedAt).ToList();
    // ...existing code...
  }

  private async Task<List<Notification>> LoadNotificationsAsync(string username)
  {
    var path = GetUserNotificationPath(username);
    if (!File.Exists(path))
    {
      Console.WriteLine($"[NotificationService] No notifications file for '{username}'. Returning empty list.");
      return new List<Notification>();
    }

    try
    {
      var json = await File.ReadAllTextAsync(path);
      if (string.IsNullOrWhiteSpace(json))
      {
        Console.WriteLine($"[NotificationService] Notifications file for '{username}' is empty.");
        return new List<Notification>();
      }
      var result = JsonSerializer.Deserialize<List<Notification>>(json);
      Console.WriteLine($"[NotificationService] Loaded {result?.Count ?? 0} notifications for '{username}'.");
      return result ?? new List<Notification>();
    }
    catch (JsonException ex)
    {
      Console.WriteLine($"[NotificationService] Error deserializing notifications for user '{username}': {ex.Message}");
      throw;
    }
    catch (Exception ex)
    {
      Console.WriteLine($"[NotificationService] General error loading notifications for '{username}': {ex.Message}");
      throw;
    }
  }

  private async Task SaveNotificationsAsync(string username, List<Notification> notifications)
  {
    var path = GetUserNotificationPath(username);
    var directory = Path.GetDirectoryName(path);
    if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
    {
      Directory.CreateDirectory(directory);
      Console.WriteLine($"[NotificationService] Created directory for notifications: {directory}");
    }

    var json = JsonSerializer.Serialize(notifications, new JsonSerializerOptions { WriteIndented = true });
    await File.WriteAllTextAsync(path, json);
    Console.WriteLine($"[NotificationService] Saved {notifications.Count} notifications for '{username}'.");
  }

  public async Task NotifyAsync(string recipientUsername, string message)
  {
    // Get or create a lock specific to this user to ensure thread safety.
    var userLock = _userLocks.GetOrAdd(recipientUsername, _ => new SemaphoreSlim(1, 1));

    await userLock.WaitAsync();
    try
    {
      Console.WriteLine($"[NotificationService] Notifying user '{recipientUsername}' with message: {message}");
      var notifications = await LoadNotificationsAsync(recipientUsername);
      var nextId = notifications.Any() ? notifications.Max(n => n.Id) + 1 : 1;

      var newNotification = new Notification
      {
        Id = nextId,
        RecipientUsername = recipientUsername,
        Message = message,
        CreatedAt = DateTime.UtcNow
      };

      notifications.Add(newNotification);
      await SaveNotificationsAsync(recipientUsername, notifications);

      var unreadCount = notifications.Count(n => !n.IsRead);
      Console.WriteLine($"[NotificationService] User '{recipientUsername}' now has {unreadCount} unread notifications.");
      await _hubContext.Clients.User(recipientUsername).SendAsync("ReceiveNotification", newNotification);
      await _hubContext.Clients.User(recipientUsername).SendAsync("UpdateUnreadCount", unreadCount);
    }
    catch (Exception ex)
    {
      Console.WriteLine($"[NotificationService] Error notifying user '{recipientUsername}': {ex.Message}");
      throw;
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
