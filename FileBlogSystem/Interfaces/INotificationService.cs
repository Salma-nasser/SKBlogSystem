namespace FileBlogSystem.Services;

using FileBlogSystem.Models;

public interface INotificationService
{
    Task SendNotificationAsync(string username, string message, string link);
    Task<List<Notification>> GetAllAsync(string username);
    Task<List<Notification>> GetUnreadAsync(string username);
    Task MarkAsReadAsync(string username, string notificationId);
}