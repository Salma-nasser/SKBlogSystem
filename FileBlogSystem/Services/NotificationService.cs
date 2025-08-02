using FileBlogSystem.Models;
using System.Text.Json;
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
    var notification = new Notification { Message = message, Link = link };

    var userNotificationPath = Path.Combine(_userDataDirectory, username, "notifications");
    Directory.CreateDirectory(userNotificationPath);

    var filePath = Path.Combine(userNotificationPath, $"{notification.Id}.json");
    var json = JsonSerializer.Serialize(notification, new JsonSerializerOptions { WriteIndented = true });

    await File.WriteAllTextAsync(filePath, json);
  }
  public async Task<List<Notification>> GetAllAsync(string username)
  {
    var notifications = new List<Notification>();
    var userNotificationPath = Path.Combine(_userDataDirectory, username, "notifications");
    if (!Directory.Exists(userNotificationPath)) return notifications;
    var files = Directory.GetFiles(userNotificationPath, "*.json");
    foreach (var file in files)
    {
      var json = await File.ReadAllTextAsync(file);
      var notif = JsonSerializer.Deserialize<Notification>(json);
      if (notif != null) notifications.Add(notif);
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
    var userNotificationPath = Path.Combine(_userDataDirectory, username, "notifications");
    var filePath = Path.Combine(userNotificationPath, $"{notificationId}.json");
    if (!File.Exists(filePath)) return;
    var json = await File.ReadAllTextAsync(filePath);
    var notif = JsonSerializer.Deserialize<Notification>(json);
    if (notif == null || notif.IsRead) return;
    notif.IsRead = true;
    var updated = JsonSerializer.Serialize(notif, new JsonSerializerOptions { WriteIndented = true });
    await File.WriteAllTextAsync(filePath, updated);
  }
}