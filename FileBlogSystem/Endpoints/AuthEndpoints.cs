using FileBlogSystem.Models;
using FileBlogSystem.Interfaces;
using Microsoft.AspNetCore.Authorization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.RateLimiting;
namespace FileBlogSystem.Endpoints;

[EnableRateLimiting("AuthFixed")]
public static class AuthEndpoints
{
  public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
  {
    // Endpoint Definitions
    app.MapPost("/api/auth/login", LoginUserAsync)
      .AllowAnonymous()
      .WithName("Login")
      .WithTags("Authentication");

    app.MapPost("/api/auth/register", RegisterUserAsync)
      .AllowAnonymous()
      .WithName("Register")
      .WithTags("Authentication");

    app.MapPut("/api/users/{username}/password", ChangeUserPasswordAsync)
      .RequireAuthorization()
      .WithName("ChangePassword")
      .WithTags("Users");
  }

  // Endpoint Implementation Functions
  private static async Task<IResult> LoginUserAsync(LoginRequest request, IUserService userService)
  {
    if (request == null)
      return Results.BadRequest(new { message = "Invalid login data." });

    var validationResult = ValidateLoginRequest(request);
    if (validationResult != null)
      return Results.BadRequest(new { message = validationResult });

    Console.WriteLine($"Logging in user: {request.Username}");
    return await userService.LoginUser(request.Username, request.Password);
  }

  private static async Task<IResult> RegisterUserAsync(RegisterRequest request, IUserService userService)
  {
    if (request == null)
      return Results.BadRequest(new { message = "Invalid registration data." });

    var validationResult = ValidateRegisterRequest(request);
    if (validationResult != null)
      return Results.BadRequest(new { message = validationResult });

    Console.WriteLine($"Registering user: {request.Username}");
    return await userService.RegisterUser(
        request.Username,
        request.Password,
        request.Email);
  }

  [Authorize]
  private static async Task<IResult> ChangeUserPasswordAsync(
      string username,
      HttpContext context,
      IUserService userService,
      ChangePasswordRequest request)
  {
    // Validate path parameter
    if (string.IsNullOrWhiteSpace(username) || username.Length < 3 || username.Length > 20)
      return Results.BadRequest(new { message = "Invalid username." });

    var currentUser = context.User.Identity?.Name;
    if (currentUser == null || !string.Equals(currentUser, username, StringComparison.OrdinalIgnoreCase))
      return Results.Forbid();

    var validationResult = ValidateChangePasswordRequest(request);
    if (validationResult != null)
      return Results.BadRequest(new { message = validationResult });

    return await userService.UpdatePassword(username, request.CurrentPassword, request.NewPassword);
  }

  // Validation Helper Functions
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

  private static string? ValidateChangePasswordRequest(ChangePasswordRequest request)
  {
    if (string.IsNullOrWhiteSpace(request.CurrentPassword))
      return "Current password is required.";
    if (string.IsNullOrWhiteSpace(request.NewPassword))
      return "New password is required.";
    if (request.NewPassword.Length < 6)
      return "New password must be at least 6 characters long.";

    return null;
  }
}
