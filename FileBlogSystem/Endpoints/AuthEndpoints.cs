using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using Microsoft.AspNetCore.Authorization;
using System.Text.RegularExpressions;

namespace FileBlogSystem.Endpoints;

public static class AuthEndpoints
{
  public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
  {
    app.MapPost("/api/auth/login", async (LoginRequest request, IUserService userService) =>
    {
      var validationResult = ValidateLoginRequest(request);
      if (validationResult != null)
        return Results.BadRequest(new { message = validationResult });

      Console.WriteLine($"Logging in user: {request.Username}");
      return await userService.LoginUser(request.Username, request.Password);
    })
    .AllowAnonymous()
    .WithName("Login")
    .WithTags("Authentication");

    app.MapPost("/api/auth/register", async (RegisterRequest request, IUserService userService) =>
    {
      var validationResult = ValidateRegisterRequest(request);
      if (validationResult != null)
        return Results.BadRequest(new { message = validationResult });

      Console.WriteLine($"Registering user: {request.Username}");
      return await userService.RegisterUser(
              request.Username,
              request.Password,
              request.Email);
    })
    .AllowAnonymous()
    .WithName("Register")
    .WithTags("Authentication");

    app.MapGet("/api/users/{username}", async (string username, IUserService userService) =>
    {
      return await userService.GetUserProfile(username);
    })
    .RequireAuthorization()
    .WithName("GetUserProfile")
    .WithTags("Users");

    app.MapPut("/api/users/promote/{username}", [Authorize(Roles = "Admin")] async (string username, IUserService userService, HttpContext ctx) =>
    {
      var currentUser = ctx.User.Identity?.Name;

      if (string.IsNullOrEmpty(currentUser))
        return Results.Unauthorized();

      var result = await userService.PromoteUserToAdmin(username, currentUser);
      return result;
    });
  }

  private static string? ValidateLoginRequest(LoginRequest request)
  {
    if (string.IsNullOrWhiteSpace(request.Username))
      return "Username is required.";
    if (string.IsNullOrWhiteSpace(request.Password))
      return "Password is required.";
    if (request.Username.Length < 3 || request.Username.Length > 20)
      return "Username must be between 3 and 20 characters.";
    if (request.Password.Length < 6)
      return "Password must be at least 6 characters long.";

    return null;
  }

  private static string? ValidateRegisterRequest(RegisterRequest request)
  {
    if (string.IsNullOrWhiteSpace(request.Username))
      return "Username is required.";
    if (string.IsNullOrWhiteSpace(request.Password))
      return "Password is required.";
    if (string.IsNullOrWhiteSpace(request.Email))
      return "Email is required.";

    if (request.Username.Length < 3 || request.Username.Length > 20)
      return "Username must be between 3 and 20 characters.";
    if (request.Password.Length < 6)
      return "Password must be at least 6 characters long.";
    if (!IsValidEmail(request.Email))
      return "Email format is invalid.";

    return null;
  }

  private static bool IsValidEmail(string email)
  {
    var emailPattern = @"^[^@\s]+@[^@\s]+\.[^@\s]+$";
    return Regex.IsMatch(email, emailPattern, RegexOptions.IgnoreCase);
  }
}
