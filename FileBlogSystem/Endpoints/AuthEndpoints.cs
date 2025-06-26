using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authorization;


namespace FileBlogSystem.Endpoints;

public static class AuthEndpoints
{
  public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
  {
    app.MapPost("/api/auth/login", async (LoginRequest request, UserService userService) =>
    {
      Console.WriteLine($"Logging in user: {request.Username}");
      return await userService.LoginUser(request.Username, request.Password);
    })
    .AllowAnonymous()
    .WithName("Login")
    .WithTags("Authentication");

    app.MapPost("/api/auth/register", async (RegisterRequest request, UserService userService) =>
    {
      Console.WriteLine($"Registering user: {request.Username}");
      return await userService.RegisterUser(
              request.Username,
              request.Password,
              request.Email);
    })
    .AllowAnonymous()
    .WithName("Register")
    .WithTags("Authentication");

    app.MapGet("/api/users/{username}", async (string username, UserService userService) =>
    {
      return await userService.GetUserProfile(username);
    })
    .RequireAuthorization()
    .WithName("GetUserProfile")
    .WithTags("Users");

    app.MapPut("/api/users/promote/{username}", [Authorize(Roles = "Admin")] async (string username, UserService userService, HttpContext ctx) =>
    {
      var currentUser = ctx.User.Identity?.Name;

      if (string.IsNullOrEmpty(currentUser))
        return Results.Unauthorized();

      var result = await userService.PromoteUserToAdmin(username, currentUser);
      return result;
    });
  }
}