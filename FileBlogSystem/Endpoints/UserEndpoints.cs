using FileBlogSystem.Interfaces;
using FileBlogSystem.Models;
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
  }
}