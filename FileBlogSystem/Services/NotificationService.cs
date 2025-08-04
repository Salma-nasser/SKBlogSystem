using FileBlogSystem.Models;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.IO;
using System.Linq;
using System.Collections.Generic;

namespace FileBlogSystem.Services;

public class NotificationService : INotificationService
{
  private readonly string _userDataDirectory;

  public NotificationService(IConfiguration configuration)
  {
    _userDataDirectory = configuration["UserDataDirectory"] ?? "UserData";
  }

  public async Task SendNotificationAsync(string username, string message, string link)
  {
    // Store all notifications in a single notifications.json file per user
    var userDir = Path.Combine(_userDataDirectory, username);
    Directory.CreateDirectory(userDir);
    var filePath = Path.Combine(userDir, "notifications.json");
    List<Notification> notifications;
    if (File.Exists(filePath))
    {
      var existing = await File.ReadAllTextAsync(filePath);
      notifications = JsonSerializer.Deserialize<List<Notification>>(existing)
                     ?? new List<Notification>();
    }
    else
    {
      notifications = new List<Notification>();
    }
    // Assign unique numeric Id
    var nextId = notifications.Any() ? notifications.Max(n => n.Id) + 1 : 1;
    var notification = new Notification { Id = nextId, Message = message, Link = link };
    notifications.Add(notification);
    var json = JsonSerializer.Serialize(notifications, new JsonSerializerOptions { WriteIndented = true });
    await File.WriteAllTextAsync(filePath, json);
  }
  public async Task<List<Notification>> GetAllAsync(string username)
  {
    var notifications = new List<Notification>();
    var userDir = Path.Combine(_userDataDirectory, username);
    var filePath = Path.Combine(userDir, "notifications.json");
    if (!File.Exists(filePath)) return notifications;
    var content = await File.ReadAllTextAsync(filePath);
    // Manually parse JSON array to safely handle numeric and string IDs
    try
    {
      using var doc = JsonDocument.Parse(content);
      foreach (var elem in doc.RootElement.EnumerateArray())
      {
        int id;
        var idProp = elem.GetProperty("Id");
        if (idProp.ValueKind == JsonValueKind.Number)
        {
          if (!idProp.TryGetInt32(out id)) continue;
        }
        else if (idProp.ValueKind == JsonValueKind.String &&
                 int.TryParse(idProp.GetString(), out var parsed))
        {
          id = parsed;
        }
        else
        {
          continue; // Skip invalid ID
        }
        var message = elem.GetProperty("Message").GetString() ?? string.Empty;
        var link = elem.GetProperty("Link").GetString() ?? string.Empty;
        var isRead = elem.GetProperty("IsRead").GetBoolean();
        var createdAt = elem.GetProperty("CreatedAt").GetDateTime();
        notifications.Add(new Notification
        {
          Id = id,
          Message = message,
          Link = link,
          IsRead = isRead,
          CreatedAt = createdAt
        });
      }
    }
    catch
    {
      // If parsing fails, return empty list or existing notifications
    }
    return notifications;
  }
  public async Task<List<Notification>> GetUnreadAsync(string username)
  {
    var all = await GetAllAsync(username);
    return all.Where(n => !n.IsRead).ToList();
  }
  public async Task MarkAsReadAsync(string username, string notificationId)
  {
    // Load notifications list
    var userDir = Path.Combine(_userDataDirectory, username);
    var filePathAll = Path.Combine(userDir, "notifications.json");
    if (!File.Exists(filePathAll)) return;
    var content = await File.ReadAllTextAsync(filePathAll);
    // Allow IDs stored as strings or numbers when reading
    var readOptions = new JsonSerializerOptions
    {
      PropertyNameCaseInsensitive = true,
      NumberHandling = JsonNumberHandling.AllowReadingFromString
    };
    var notifications = JsonSerializer.Deserialize<List<Notification>>(content, readOptions)
                        ?? new List<Notification>();
    // Parse and mark matching notification
    if (int.TryParse(notificationId, out int id))
    {
      var notif = notifications.FirstOrDefault(n => n.Id == id);
      if (notif != null && !notif.IsRead)
      {
        notif.IsRead = true;
        var updated = JsonSerializer.Serialize(notifications, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(filePathAll, updated);
      }
    }
  }
}