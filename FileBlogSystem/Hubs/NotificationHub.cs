using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using FileBlogSystem.Services;

namespace FileBlogSystem.Hubs;

[Authorize]
public class NotificationHub : Hub
{
  private readonly NotificationService _notificationService;

  public NotificationHub(NotificationService notificationService)
  {
    _notificationService = notificationService;
  }

  public override async Task OnConnectedAsync()
  {
    var username = Context.User?.FindFirstValue(ClaimTypes.Name);
    if (!string.IsNullOrEmpty(username))
    {
      Console.WriteLine($"--> SignalR client connected: {Context.ConnectionId}, User: {username}");
      var unreadNotifications = await _notificationService.GetUnreadAsync(username);
      await Clients.Caller.SendAsync("UpdateUnreadCount", unreadNotifications.Count);
    }
    await base.OnConnectedAsync();
  }
}
