using FileBlogSystem.Interfaces;
using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authorization;
namespace FileBlogSystem.Endpoints;

public static class UserEndpoints
{
  public static void MapUserEndpoints(this IEndpointRouteBuilder app)
  {
    app.MapGet("/api/users/{username}", async (string username, IUserService userService, HttpContext ctx) =>
    {
      var requestingUser = ctx.User.Identity?.Name;
      return await userService.GetUserProfile(username, requestingUser);
    });

    app.MapPut("/api/users/{username}", [Authorize] async (
        string username,
        HttpContext context,
        IUserService userService,
        UpdateProfileRequest request) =>
    {
      var currentUser = context.User.Identity?.Name;
      if (currentUser == null || currentUser != username)
        return Results.Unauthorized();

      return await userService.UpdateUserProfile(username, request);
    })
    .RequireAuthorization()
    .WithName("UpdateUserProfile")
    .WithTags("Users");
    app.MapPatch("/api/users/delete/{username}", [Authorize] async (
        string username,
        HttpContext context,
        IUserService userService) =>
    {
      var currentUser = context.User.Identity?.Name;
      if (currentUser == null || currentUser != username)
        return Results.Unauthorized();
      return await userService.DeleteUser(username);
    })
    .RequireAuthorization()
    .WithName("DeleteUser");
    app.MapGet("/notifications", async (HttpContext ctx, NotificationService notificationService) =>
{
  var username = ctx.User.Identity?.Name;
  if (username == null) return Results.Unauthorized();

  var notifications = await notificationService.GetUnreadAsync(username);
  return Results.Ok(notifications);
});

    app.MapPost("/notifications/read/{id:int}", async (int id, HttpContext ctx, NotificationService service) =>
    {
      var username = ctx.User.Identity?.Name;
      if (username == null) return Results.Unauthorized();

      await service.MarkAsReadAsync(username, id);
      return Results.Ok();
    });

  }
}