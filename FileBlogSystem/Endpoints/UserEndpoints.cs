using FileBlogSystem.Interfaces;
using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Microsoft.AspNetCore.Authorization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.RateLimiting;
namespace FileBlogSystem.Endpoints;


[EnableRateLimiting("Fixed")]
public static class UserEndpoints
{
  public static void MapUserEndpoints(this IEndpointRouteBuilder app)
  {
    // Username must be 3-20 alphanumeric or underscore
    const string UsernamePattern = "^[a-zA-Z0-9_]{3,20}$";
    static bool IsValidUsername(string u) => Regex.IsMatch(u ?? string.Empty, UsernamePattern);
    // Email must be valid format
    const string EmailPattern = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$";
    static bool IsValidEmail(string e) => Regex.IsMatch(e ?? string.Empty, EmailPattern);
    // OTP code 4-6 alphanumeric
    const string OTPPattern = "^[0-9A-Za-z]{4,6}$";
    static bool IsValidOtp(string o) => Regex.IsMatch(o ?? string.Empty, OTPPattern);
    // Password at least 8 chars
    const string PasswordPattern = ".{8,}";
    static bool IsValidPassword(string p) => Regex.IsMatch(p ?? string.Empty, PasswordPattern);

    app.MapGet("/api/users/{username}", async (string username, IUserService userService, HttpContext ctx) =>
    {
      if (!IsValidUsername(username))
        return Results.BadRequest(new { message = "Invalid username parameter." });
      var requestingUser = ctx.User.Identity?.Name;
      return await userService.GetUserProfile(username, requestingUser);
    });

    app.MapPut("/api/users/{username}", [Authorize] async (
        string username,
        HttpContext context,
        IUserService userService,
        UpdateProfileRequest request) =>
    {
      if (!IsValidUsername(username))
        return Results.BadRequest(new { message = "Invalid username parameter." });
      var currentUser = context.User.Identity?.Name;
      if (string.IsNullOrEmpty(currentUser) || !string.Equals(currentUser, username, StringComparison.OrdinalIgnoreCase))
        return Results.Unauthorized();
      if (request == null)
        return Results.BadRequest(new { message = "Invalid profile data." });
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

    app.MapGet("/notifications", GetNotificationsAsync );

    async Task<IResult> GetNotificationsAsync(HttpContext ctx, INotificationService notificationService)
    {
      var username = ctx.User.Identity?.Name;
      if (username == null)
        return Results.Unauthorized();
      // Check for ?all=true query parameter
      var allParam = ctx.Request.Query["all"].ToString();
      bool getAll = !string.IsNullOrEmpty(allParam) && allParam.ToLower() == "true";
      var notifications = getAll
        ? await notificationService.GetAllAsync(username)
        : await notificationService.GetUnreadAsync(username);
      return Results.Ok(notifications);
    };

    app.MapPost("/notifications/read/{id}", async (string id, HttpContext ctx, INotificationService service) =>
    {
      var username = ctx.User.Identity?.Name;
      if (username == null)
        return Results.Unauthorized();
      // Accept numeric IDs for notifications
      if (!int.TryParse(id, out _))
        return Results.BadRequest(new { message = "Invalid notification id format." });
      await service.MarkAsReadAsync(username, id);
      return Results.Ok();
    });

    app.MapPost("/notifications/mark-all-read", async (HttpContext ctx, INotificationService service) =>
    {
      var username = ctx.User.Identity?.Name;
      if (username == null)
        return Results.Unauthorized();
      var notifications = await service.GetUnreadAsync(username);
      foreach (var notif in notifications)
      {
        await service.MarkAsReadAsync(username, notif.Id.ToString());
      }
      return Results.Ok();
    });
    app.MapPost("/api/users/forgot-password", async (Models.ForgotPasswordRequest request, IUserService userService, EmailService emailService) =>
    {
      if (request == null)
        return Results.BadRequest(new { message = "Invalid request body." });
      if (!IsValidUsername(request.Username))
        return Results.BadRequest(new { message = "Invalid username." });
      if (string.IsNullOrEmpty(request.Email) || !IsValidEmail(request.Email))
        return Results.BadRequest(new { message = "Valid email is required." });
      return await userService.ForgotPassword(request.Username, request.Email, emailService);
    });
    app.MapPost("/api/users/verify-otp", async (Models.VerifyOtpRequest request, IUserService userService) =>
    {
      if (request == null)
        return Results.BadRequest(new { message = "Invalid request body." });
      if (!IsValidUsername(request.Username) || string.IsNullOrEmpty(request.OTPCode) || !IsValidOtp(request.OTPCode))
        return Results.BadRequest(new { message = "Valid username and OTP code are required." });
      return await userService.VerifyOtp(request.Username, request.OTPCode);
    });
    app.MapPost("/api/users/reset-password", async (Models.ResetPasswordRequest request, IUserService userService) =>
    {
      if (request == null)
        return Results.BadRequest(new { message = "Invalid request body." });
      if (!IsValidUsername(request.Username) || !IsValidPassword(request.NewPassword))
        return Results.BadRequest(new { message = "Valid username and password (min 6 chars) are required." });
      return await userService.ResetPassword(request.Username, request.NewPassword);
    });
  }
}